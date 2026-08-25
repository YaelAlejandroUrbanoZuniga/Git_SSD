import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { signAccessToken, type AuthUser } from '../../src/middleware/auth';
import {
  asPrisma, createMockPrisma, fakeSlaCatalog, fakeSupplierRow, type MockPrisma,
} from '../helpers/mockPrisma';
import type { SupplierWithRelations } from '../../src/mappers/supplierMapper';

/**
 * Q34 ("Certificación IMMEX") on the in-app wire contract, both directions.
 *
 * The question has one answer and now travels as one value. It used to be the
 * `hasIMMEX`/`planIMMEX` boolean pair, which every client had to derive and
 * which admitted a combination the question cannot express (both true), silently
 * resolved in favour of 'In Plan'. These cases pin the replacement: PATCH takes
 * the Form's label, GET returns the catalog name, and neither speaks booleans.
 */

const env = loadEnv({
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false',
} as NodeJS.ProcessEnv);

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'SSD' };
const token = () => signAccessToken(env, actor);

/** The full C_ImmexStatus catalog, so a wrong mapping picks a wrong id, not none. */
const IMMEX_CATALOG = [
  { id: 1, name: 'Yes' },
  { id: 2, name: 'No' },
  { id: 3, name: 'In Plan' },
  { id: 4, name: 'TBC' },
];

describe('the single IMMEX answer on /api/suppliers', () => {
  let mock: MockPrisma;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mock = createMockPrisma();
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
    mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
    mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
    mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
    mock.immexStatus.findMany.mockResolvedValue(IMMEX_CATALOG);
    app = createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
  });

  const patch = (payload: Record<string, unknown>) => request(app)
    .patch('/api/suppliers/ps1')
    .set('Authorization', `Bearer ${token()}`)
    .send(payload);

  const commercialUpdate = () =>
    mock.commercialInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>;

  describe('PATCH /api/suppliers/:id', () => {
    it.each([
      ['Yes', 1],
      ['No, with a plan', 3],
      ['No, without a plan', 2],
    ])('resolves %s to the single FK_ImmexStatus', async (immexAnswer, immexStatusId) => {
      const res = await patch({ immexAnswer });

      expect(res.status).toBe(200);
      expect(commercialUpdate()).toEqual({ immexStatusId });
    });

    it('400s an answer outside the three, before any write', async () => {
      // 'In Plan' is the CATALOG name, not a Form answer: the two vocabularies
      // are deliberately different and only catalogMapping bridges them.
      const res = await patch({ immexAnswer: 'In Plan' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('immexAnswer');
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('400s the retired boolean pair rather than guessing an answer from it', async () => {
      // PATCH lists the keys it cannot route, unlike the public intake endpoint
      // which ignores unknown keys — so the old pair fails loudly here.
      const res = await patch({ hasIMMEX: true, planIMMEX: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('hasIMMEX');
      expect(res.body.error).toContain('planIMMEX');
      expect(mock.commercialInfo.upsert).not.toHaveBeenCalled();
    });

    it('leaves the FK untouched when the patch omits the answer', async () => {
      const res = await patch({ topCustomers: 'OEM A, OEM B' });

      expect(res.status).toBe(200);
      expect(commercialUpdate()).toEqual({ topCustomers: 'OEM A, OEM B' });
    });

    it('gives a fresh CommercialInfo row the answered status, not the No default', async () => {
      // The create branch seeds required FKs with 'No'; the answer must win.
      await patch({ immexAnswer: 'Yes' });

      const create = mock.commercialInfo.upsert.mock.calls[0][0].create as Record<string, unknown>;
      expect(create.immexStatusId).toBe(1);
    });
  });

  describe('GET /api/suppliers/:id', () => {
    const rowWithImmex = (name: string | null): SupplierWithRelations => ({
      ...fakeSupplierRow(),
      commercialInfo: {
        immexStatus: name === null ? null : { name },
        confidenceLevel: { code: 'M' },
      } as SupplierWithRelations['commercialInfo'],
    });

    const get = () => request(app)
      .get('/api/suppliers/ps1')
      .set('Authorization', `Bearer ${token()}`);

    it.each(['Yes', 'No', 'In Plan'])('returns %s as the immexStatus string', async (name) => {
      mock.supplier.findUnique.mockResolvedValue(rowWithImmex(name));

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.immexStatus).toBe(name);
    });

    it('returns null when the supplier has no commercial data yet', async () => {
      mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.immexStatus).toBeNull();
    });

    it('no longer returns the boolean pair in any form', async () => {
      mock.supplier.findUnique.mockResolvedValue(rowWithImmex('In Plan'));

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('hasIMMEX');
      expect(res.body).not.toHaveProperty('planIMMEX');
    });
  });
});
