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
import type { SupplierWithRelations } from '../../src/mappers/supplierMapper';

const env = loadEnv({
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false',
} as NodeJS.ProcessEnv);

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'SSD' };
const token = () => signAccessToken(env, actor);

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

/** The catalog lookups every write path resolves before persisting. */
function stubCatalogs(mock: MockPrisma) {
  mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
  mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
  mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
  mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
  mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
}

/**
 * A Supplier Evaluation row with both stage satellites populated. The Visit
 * tab's flag (tabVisit) and its data columns (visitDatePlanned…recommendations)
 * both live on supplierEvalData — see backend/DEBT.md entry 1, Part A.
 */
function rowWithSatellites(overrides: {
  supplierEval?: Record<string, unknown>;
  preliminary?: Record<string, unknown>;
} = {}): SupplierWithRelations {
  const base = fakeSupplierRow({ stage: 'Supplier Evaluation' }) as Record<string, unknown>;
  return {
    ...base,
    preliminaryData: {
      supplierId: 'ps1',
      hasTabs: true,
      tabOverview: true,
      tabCapabilities: true,
      ...(overrides.preliminary ?? {}),
    },
    supplierEvalData: {
      supplierId: 'ps1',
      hasTabs: true,
      tabCompetitiveness: true,
      tabFundamentals: true,
      tabVisit: true,
      rfqReceived: 'Y',
      ndaSigned: 'Y',
      tcsSigned: null,
      ttcsSigned: null,
      nsrSigned: null,
      sdaSigned: null,
      costModel: null,
      visitDatePlanned: '2026-06-01',
      visitDateCompleted: '2026-06-10',
      visitParticipants: 'Ana García, Carlos Mendoza',
      strengths: 'Strong tooling shop',
      weaknesses: null,
      observations: null,
      recommendations: null,
      ...(overrides.supplierEval ?? {}),
    },
  } as unknown as SupplierWithRelations;
}

describe('Supplier Evaluation tabs — Visit moved in, Cost Model added', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
  });

  // ── Tab grouping ─────────────────────────────────────────────────────────

  it('maps Visit into supplierEvalTabsCompleted and out of preliminaryTabsCompleted', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.supplierEvalTabsCompleted).toEqual({
      competitiveness: true, fundamentals: true, visit: true,
    });
    expect(res.body.preliminaryTabsCompleted).toEqual({ overview: true, capabilities: true });
    // The old shape must be gone on both sides.
    expect(res.body.preliminaryTabsCompleted).not.toHaveProperty('visit');
  });

  it('an incomplete Visit is reported as visit:false, not omitted', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      rowWithSatellites({ supplierEval: { tabVisit: false } }),
    );

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.supplierEvalTabsCompleted).toEqual({
      competitiveness: true, fundamentals: true, visit: false,
    });
  });

  it('reads the Visit data from SupplierEvalData under its prelim_* wire names', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      prelim_visitDatePlanned: '2026-06-01',
      prelim_visitDateCompleted: '2026-06-10',
      prelim_visitParticipants: 'Ana García, Carlos Mendoza',
      prelim_strengths: 'Strong tooling shop',
    });
  });

  it('PATCH prelim_visit*/strengths fields write SupplierEvalData, never PreliminaryData', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        prelim_visitDatePlanned: '2026-07-01',
        prelim_strengths: 'Great quality systems',
      });

    expect(res.status).toBe(200);
    expect(mock.supplierEvalData.upsert).toHaveBeenCalledWith({
      where: { supplierId: 'ps1' },
      create: { supplierId: 'ps1', visitDatePlanned: '2026-07-01', strengths: 'Great quality systems' },
      update: { visitDatePlanned: '2026-07-01', strengths: 'Great quality systems' },
    });
    expect(mock.preliminaryData.upsert).not.toHaveBeenCalled();
  });

  it('PATCH supplierEvalTabsCompleted.visit writes SupplierEvalData, never PreliminaryData', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ supplierEvalTabsCompleted: { competitiveness: true, fundamentals: true, visit: true } });

    expect(res.status).toBe(200);
    expect(mock.supplierEvalData.upsert).toHaveBeenCalledWith({
      where: { supplierId: 'ps1' },
      create: {
        supplierId: 'ps1', hasTabs: true,
        tabCompetitiveness: true, tabFundamentals: true, tabVisit: true,
      },
      update: {
        hasTabs: true, tabCompetitiveness: true, tabFundamentals: true, tabVisit: true,
      },
    });
    expect(mock.preliminaryData.upsert).not.toHaveBeenCalled();
  });

  it('PATCH preliminaryTabsCompleted no longer carries a visit flag', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ preliminaryTabsCompleted: { overview: true, capabilities: true } });

    expect(res.status).toBe(200);
    expect(mock.preliminaryData.upsert).toHaveBeenCalledWith({
      where: { supplierId: 'ps1' },
      create: { supplierId: 'ps1', hasTabs: true, tabOverview: true, tabCapabilities: true },
      update: { hasTabs: true, tabOverview: true, tabCapabilities: true },
    });
    expect(mock.supplierEvalData.upsert).not.toHaveBeenCalled();
  });

  // ── Cost Model ───────────────────────────────────────────────────────────

  it('round-trips prelim_costModel through SupplierEvalData.costModel', async () => {
    // The read after the write returns the persisted row.
    mock.supplier.findUnique
      .mockResolvedValueOnce(rowWithSatellites())
      .mockResolvedValue(rowWithSatellites({ supplierEval: { costModel: 'Y' } }));

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ prelim_costModel: 'Y' });

    expect(res.status).toBe(200);
    // Routed to the Supplier Evaluation satellite (like the prelim_*Signed
    // fields), with the prelim_ prefix stripped — not to PreliminaryData.
    expect(mock.supplierEvalData.upsert).toHaveBeenCalledWith({
      where: { supplierId: 'ps1' },
      create: { supplierId: 'ps1', costModel: 'Y' },
      update: { costModel: 'Y' },
    });
    expect(mock.preliminaryData.upsert).not.toHaveBeenCalled();
    // …and comes back out on the wire under its prelim_ name.
    expect(res.body.prelim_costModel).toBe('Y');
  });

  it('emits prelim_costModel: null when the satellite has no value', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.prelim_costModel).toBeNull();
  });

  it('emits prelim_costModel: null when there is no SupplierEvalData row at all', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Preliminary Evaluation' }));

    const res = await request(buildApp(mock))
      .get('/api/tracker/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.prelim_costModel).toBeNull();
  });

  it('saving Fundamentals without a Cost Model still succeeds — it is optional', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites());

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        prelim_rfqReceived: 'Y',
        prelim_ndaSigned: 'Y',
        prelim_sdaSigned: 'N',
        selectedForDevelopment: true,
        supplierEvalTabsCompleted: { competitiveness: true, fundamentals: true, visit: false },
      });

    expect(res.status).toBe(200);
    const call = mock.supplierEvalData.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('costModel');
    expect(call.update).toMatchObject({ rfqReceived: 'Y', ndaSigned: 'Y', sdaSigned: 'N' });
  });

  it('clears prelim_costModel when the field is emptied', async () => {
    mock.supplier.findUnique.mockResolvedValue(rowWithSatellites({ supplierEval: { costModel: 'Y' } }));

    const res = await request(buildApp(mock))
      .patch('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ prelim_costModel: null });

    expect(res.status).toBe(200);
    expect(mock.supplierEvalData.upsert).toHaveBeenCalledWith({
      where: { supplierId: 'ps1' },
      create: { supplierId: 'ps1', costModel: null },
      update: { costModel: null },
    });
  });
});
