import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { signAccessToken, type AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, fakeSupplierRow, type MockPrisma } from '../helpers/mockPrisma';

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

describe('tracker endpoints', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('GET /api/tracker/stage-config returns the 5 working stages', async () => {
    const res = await request(buildApp(mock))
      .get('/api/tracker/stage-config')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({ name: 'Scouting Event' });
  });

  it('GET /api/tracker/suppliers maps DB rows to the flat frontend shape', async () => {
    mock.supplier.findMany.mockResolvedValue([
      fakeSupplierRow({
        scoutingData: {
          supplierId: 'ps1',
          tabScoutingEvent: true, tabSupplierInfo: true, tabAttendees: false,
          tabAgenda: false, tabNextStep: false,
          b2bStatus: null, b2bWhoAttends: null, b2bManager: null, b2bBuyer: null,
          b2bComments: null, agendaStatus: null, agendaTeamsLink: null,
          agendaScheduledDate: null, agendaTimezone: null, agendaStand: null,
          agendaStartTime: null, agendaEndTime: null, agendaDuration: null,
          selectedForParking: null, selectionReason: null,
        } as never,
      }),
    ]);

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    const s = res.body[0];
    expect(s).toMatchObject({
      id: 'ps1',
      folio: 'SSD-2026-001',
      commodity: 'Machining',
      stage: 'Scouting Event',
      scoutingTabsCompleted: {
        scoutingEvent: true, supplierInfo: true, attendees: false, agenda: false, nextStep: false,
      },
      parkingTabsCompleted: null,
      notes: [],
      prelim_parts: [],
    });
    // flat contract: prelim_/intelex_ fields present even when satellites are absent
    expect(s.prelim_startDate).toBeNull();
    expect(s.intelex_efficiencyL0).toBeNull();
    expect(s.intelex_efficiencyGlobal).toBeNull();
  });

  it('GET /api/tracker/suppliers emits the stored Intelex efficiencies, gradual values included', async () => {
    const row = fakeSupplierRow({ stage: 'Intelex Handoff' });
    // A handoff scored by the backend: L0 eight days late (0.875), L1 on time,
    // the rest not captured — the shape the Tracker's Efficiency card renders.
    (row as unknown as { intelexData: unknown }).intelexData = {
      recordCreationDate: '2026-01-05',
      l0Expected: '2026-02-01', l0Real: '2026-02-09',
      l1Expected: '2026-03-01', l1Real: '2026-03-01',
      efficiencyL0: 0.875, efficiencyL1: 0.95,
      efficiencyL2: null, efficiencyL3: null, efficiencyL4: null,
      efficiencyGlobal: 0.9125,
    };
    mock.supplier.findMany.mockResolvedValue([row]);

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    const s = res.body[0];
    // Neither 0 nor 1: the stepped scale, not the old planned/actual ratio.
    expect(s.intelex_efficiencyL0).toBeCloseTo(0.875, 10);
    expect(s.intelex_efficiencyL1).toBeCloseTo(0.95, 10);
    expect(s.intelex_efficiencyL4).toBeNull();
    // Average of the two scored levels — what the "Global" row shows.
    expect(s.intelex_efficiencyGlobal).toBeCloseTo(0.9125, 10);
  });

  it('GET /api/tracker/suppliers?stage=Nope → 400', async () => {
    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers?stage=Nope')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
  });

  it('POST /:id/move with a valid transition → 200', async () => {
    const row = fakeSupplierRow({ stage: 'Scouting Event' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 2, name: 'Parking Lot' });
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.supplierNote.create.mockResolvedValue({});

    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/move')
      .set('Authorization', `Bearer ${token()}`)
      .send({ newStage: 'Parking Lot', note: 'Advancing after the B2B meeting' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ps1');
  });

  it('POST /:id/move without a note → 400', async () => {
    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/move')
      .set('Authorization', `Bearer ${token()}`)
      .send({ newStage: 'Parking Lot' });
    expect(res.status).toBe(400);
    // The note is validated before any DB access.
    expect(mock.supplier.findUnique).not.toHaveBeenCalled();
  });

  it('POST /:id/move to an unknown stage → 400', async () => {
    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/move')
      .set('Authorization', `Bearer ${token()}`)
      .send({ newStage: 'Warp Zone', note: 'Trying to move to a bogus stage' });
    expect(res.status).toBe(400);
  });

  it('POST /:id/move on a completed supplier → 409', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ status: 'COMPLETED', stage: 'Completed' }),
    );
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 2, name: 'Parking Lot' });
    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/move')
      .set('Authorization', `Bearer ${token()}`)
      .send({ newStage: 'Parking Lot', note: 'Attempting to move a completed supplier' });
    expect(res.status).toBe(409);
  });

  it('POST /:id/blacklist without reason → 400', async () => {
    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/blacklist')
      .set('Authorization', `Bearer ${token()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /:id/blacklist with reason → 200 and records the rejection', async () => {
    const row = fakeSupplierRow({ stage: 'Parking Lot' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 6, name: 'Blacklisted' });
    mock.supplier.update.mockResolvedValue(row);
    mock.blacklistEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    const res = await request(buildApp(mock))
      .post('/api/tracker/suppliers/ps1/blacklist')
      .set('Authorization', `Bearer ${token()}`)
      .send({ reason: 'Financial instability' });

    expect(res.status).toBe(200);
    expect(mock.blacklistEntry.create).toHaveBeenCalledOnce();
  });

  it('PATCH /:id/substatus "No Go" without reason → 400', async () => {
    const res = await request(buildApp(mock))
      .patch('/api/tracker/suppliers/ps1/substatus')
      .set('Authorization', `Bearer ${token()}`)
      .send({ subStatus: 'No Go' });
    expect(res.status).toBe(400);
  });

  it('GET /api/tracker/suppliers/:id unknown id → 404', async () => {
    mock.supplier.findUnique.mockResolvedValue(null);
    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ghost')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
  });

  it('requires a token when AUTH_OPTIONAL=false', async () => {
    const res = await request(buildApp(mock)).get('/api/tracker/suppliers');
    expect(res.status).toBe(401);
  });

  it('attributes writes to the demo user when AUTH_OPTIONAL=true and no token is sent', async () => {
    const relaxedEnv = loadEnv({
      JWT_SECRET: 'test-secret',
      AUTH_OPTIONAL: 'true',
    } as NodeJS.ProcessEnv);
    const app = createApp({ prisma: asPrisma(mock), env: relaxedEnv, ldap: new MockLdapAuthClient() });

    const row = fakeSupplierRow({ stage: 'Parking Lot' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 6, name: 'Blacklisted' });
    mock.supplier.update.mockResolvedValue(row);
    mock.blacklistEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/tracker/suppliers/ps1/blacklist')
      .send({ reason: 'demo mode test' });

    expect(res.status).toBe(200);
    expect(mock.blacklistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectedBy: 'Yael Urbano' }),
      }),
    );
  });
});
