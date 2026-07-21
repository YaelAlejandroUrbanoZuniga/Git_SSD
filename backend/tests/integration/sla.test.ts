import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { signAccessToken, type AuthUser } from '../../src/middleware/auth';
import {
  asPrisma,
  createMockPrisma,
  fakeSlaCatalog,
  fakeSupplierRow,
  type MockPrisma,
} from '../helpers/mockPrisma';

const env = loadEnv({
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false',
} as NodeJS.ProcessEnv);

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };
const token = () => signAccessToken(env, actor);

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

const GREEN = 1;
const YELLOW = 2;
const RED = 3;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** The catalog lookups every write path resolves before persisting. */
function stubCatalogs(mock: MockPrisma) {
  mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
  mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
  mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
  mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
  mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
}

describe('SLA is recalculated and persisted on read', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
  });

  it('persists red for a supplier parked 30 days, overriding a stale green', () => {
    return withSupplier(
      fakeSupplierRow({ stage: 'Parking Lot', parkingOnboardingDate: daysAgo(30), sla: 'green', globalSla: 'green' }),
      async res => {
        expect(res.body.sla).toBe('red');
        expect(mock.supplier.update).toHaveBeenCalledWith({
          where: { id: 'ps1' },
          data: { slaId: RED, globalSlaId: GREEN, daysSinceParkingLot: 30 },
        });
      },
    );
  });

  it('persists yellow at the 25-day Parking Lot boundary', () => {
    return withSupplier(
      fakeSupplierRow({ stage: 'Parking Lot', parkingOnboardingDate: daysAgo(25), sla: 'green', globalSla: 'green' }),
      async res => {
        expect(res.body.sla).toBe('yellow');
        expect(mock.supplier.update).toHaveBeenCalledWith({
          where: { id: 'ps1' },
          data: { slaId: YELLOW, globalSlaId: GREEN, daysSinceParkingLot: 25 },
        });
      },
    );
  });

  it('writes nothing when the stored colour already matches (idempotent reads)', () => {
    return withSupplier(
      fakeSupplierRow({
        stage: 'Parking Lot',
        parkingOnboardingDate: daysAgo(24),
        sla: 'green',
        globalSla: 'green',
        daysSinceParkingLot: 24,
      }),
      async res => {
        expect(res.body.sla).toBe('green');
        expect(mock.supplier.update).not.toHaveBeenCalled();
        // The catalog isn't even fetched when there is nothing to reconcile.
        expect(mock.sla.findMany).not.toHaveBeenCalled();
      },
    );
  });

  it('derives the Preliminary colour and the global colour from different anchors', () => {
    return withSupplier(
      fakeSupplierRow({
        stage: 'Preliminary Evaluation',
        preliminaryStartDate: daysAgo(60),
        parkingOnboardingDate: daysAgo(95),
        sla: 'green',
        globalSla: 'green',
      }),
      async res => {
        expect(res.body).toMatchObject({ sla: 'red', globalSla: 'red', daysSinceParkingLot: 95 });
        expect(mock.supplier.update).toHaveBeenCalledWith({
          where: { id: 'ps1' },
          data: { slaId: RED, globalSlaId: RED, daysSinceParkingLot: 95 },
        });
      },
    );
  });

  it('falls back to the stored daysInStage when the stage has no anchor date', () => {
    return withSupplier(
      fakeSupplierRow({ stage: 'Parking Lot', daysInStage: 31, daysSinceParkingLot: 31, sla: 'green', globalSla: 'green' }),
      async res => {
        expect(res.body.sla).toBe('red');
        expect(mock.supplier.update).toHaveBeenCalledWith({
          where: { id: 'ps1' },
          data: { slaId: RED, globalSlaId: GREEN, daysSinceParkingLot: 31 },
        });
      },
    );
  });

  it('leaves stages without a confirmed threshold alone', () => {
    return withSupplier(
      // 400 days in Supplier Evaluation: no threshold exists, so the colour must
      // not move — only the global cycle reacts.
      fakeSupplierRow({ stage: 'Supplier Evaluation', daysInStage: 400, daysSinceParkingLot: 74, sla: 'green', globalSla: 'green' }),
      async res => {
        expect(res.body.sla).toBe('green');
        expect(mock.supplier.update).not.toHaveBeenCalled();
      },
    );
  });

  it('freezes the SLA of a blacklisted supplier at its value on exit', () => {
    return withSupplier(
      fakeSupplierRow({
        status: 'BLACKLISTED',
        stage: 'Blacklisted',
        stageBeforeExit: 'Parking Lot',
        parkingOnboardingDate: daysAgo(300),
        sla: 'yellow',
        globalSla: 'green',
      }),
      async res => {
        expect(res.body.sla).toBe('yellow');
        expect(mock.supplier.update).not.toHaveBeenCalled();
      },
    );
  });

  async function withSupplier(row: ReturnType<typeof fakeSupplierRow>, assert: (res: request.Response) => Promise<void>) {
    mock.supplier.findUnique.mockResolvedValue(row);
    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    await assert(res);
  }
});

describe('SLA is recalculated and persisted on write', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
  });

  it('PATCH /api/suppliers/:id recolours the supplier from the anchor it just changed', async () => {
    // The patch moves the parking clock back to 90 days ago; the response must
    // already carry the recomputed colour.
    const row = fakeSupplierRow({
      stage: 'Parking Lot',
      parkingOnboardingDate: daysAgo(90),
      sla: 'green',
      globalSla: 'green',
    });
    mock.supplier.findUnique.mockResolvedValue(row);

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ parkingOnboardingDate: daysAgo(90) });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sla: 'red', globalSla: 'red' });
    expect(mock.supplier.update).toHaveBeenCalledWith({
      where: { id: 'ps1' },
      data: { slaId: RED, globalSlaId: RED, daysSinceParkingLot: 90 },
    });
  });

  it('a client-supplied sla is overridden by the derived one', async () => {
    const row = fakeSupplierRow({
      stage: 'Parking Lot',
      parkingOnboardingDate: daysAgo(40),
      sla: 'green',
      globalSla: 'green',
    });
    mock.supplier.findUnique.mockResolvedValue(row);

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ sla: 'green' });

    expect(res.status).toBe(200);
    expect(res.body.sla).toBe('red');
    expect(mock.supplier.update).toHaveBeenLastCalledWith({
      where: { id: 'ps1' },
      data: { slaId: RED, globalSlaId: GREEN, daysSinceParkingLot: 40 },
    });
  });

  it('POST /api/suppliers starts a Recommendation at green in Parking Lot', async () => {
    mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
    mock.supplier.findFirst.mockResolvedValue(null);
    mock.supplier.create.mockResolvedValue({});
    // Day zero in Parking Lot: parkingData is created with today's date.
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({
        stage: 'Parking Lot',
        parkingOnboardingDate: daysAgo(0),
        sla: 'green',
        daysSinceParkingLot: 0,
        globalSla: 'green',
      }),
    );

    const res = await request(buildApp(mock))
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Nueva Recomendada', commodity: 'Machining', entrySource: 'Recommendation' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ sla: 'green', globalSla: 'green' });
    // Already correct on day zero — no corrective write.
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('moving stage restarts the clock and clears a red SLA', async () => {
    // 40 days parked ⇒ red; the move to Preliminary resets the stage clock,
    // and the new stage anchor starts today.
    mock.supplier.findUnique
      .mockResolvedValueOnce(fakeSupplierRow({ stage: 'Parking Lot', parkingOnboardingDate: daysAgo(40), sla: 'red' }))
      .mockResolvedValue(
        fakeSupplierRow({
          stage: 'Preliminary Evaluation',
          parkingOnboardingDate: daysAgo(40),
          preliminaryStartDate: daysAgo(0),
          sla: 'red',
          globalSla: 'green',
        }),
      );
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 3, name: 'Preliminary Evaluation' });

    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/move')
      .set('Authorization', `Bearer ${token()}`)
      .send({ newStage: 'Preliminary Evaluation', note: 'Kicking off the preliminary evaluation' });

    expect(res.status).toBe(200);
    expect(res.body.sla).toBe('green');
    expect(mock.supplier.update).toHaveBeenLastCalledWith({
      where: { id: 'ps1' },
      data: { slaId: GREEN, globalSlaId: GREEN, daysSinceParkingLot: 40 },
    });
  });
});
