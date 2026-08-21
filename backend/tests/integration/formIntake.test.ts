import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { FORM_INTAKE_HEADER } from '../../src/middleware/formIntakeAuth';
import {
  asPrisma, createMockPrisma, fakeSlaCatalog, fakeSupplierRow, type MockPrisma,
} from '../helpers/mockPrisma';

const SECRET = 'form-intake-test-secret';
const ENDPOINT = '/api/public/form-intake';

// AUTH_OPTIONAL=false on purpose: with strict Bearer auth turned on, every 201
// below is also proof that this router really is mounted ABOVE
// `app.use('/api', authenticate())` — a tokenless POST anywhere else under /api
// would be a 401.
const baseEnv = {
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false',
} as NodeJS.ProcessEnv;

const env = loadEnv({ ...baseEnv, FORM_INTAKE_SECRET: SECRET });
/** The same server with the integration switched off (variable absent). */
const envUnconfigured = loadEnv(baseEnv);

const body = {
  name: 'ACME METALS',
  commodity: 'Machining',
  entrySource: 'Recommendation',
  dunsNumber: '123456789',
  country: 'Mexico',
  manufacturingAddress: 'Celaya, GTO',
};

describe('POST /api/public/form-intake', () => {
  let mock: MockPrisma;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mock = createMockPrisma();
    mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
    app = createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
  });

  const post = () => request(app).post(ENDPOINT).set(FORM_INTAKE_HEADER, SECRET);

  describe('the shared secret', () => {
    it('201s a valid submission carrying no JWT at all', async () => {
      const res = await post().send(body);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'ps1', folio: 'SSD-2026-001' });
    });

    it('401s a missing key, without touching the database', async () => {
      const res = await request(app).post(ENDPOINT).send(body);
      expect(res.status).toBe(401);
      expect(mock.companyInfo.findFirst).not.toHaveBeenCalled();
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });

    it('401s a wrong key, without touching the database', async () => {
      const res = await request(app).post(ENDPOINT).set(FORM_INTAKE_HEADER, 'wrong').send(body);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });

    it('503s every request when FORM_INTAKE_SECRET is unset — never open auth', async () => {
      const closed = createApp({
        prisma: asPrisma(mock), env: envUnconfigured, ldap: new MockLdapAuthClient(),
      });
      // Even a request that would otherwise be perfectly valid.
      const res = await request(closed).post(ENDPOINT).set(FORM_INTAKE_HEADER, SECRET).send(body);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('NOT_CONFIGURED');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });
  });

  describe('request-shape validation', () => {
    it('400s a missing required field in the ZodError shape, not a 500', async () => {
      const { dunsNumber: _omitted, ...withoutDuns } = body;
      const res = await post().send(withoutDuns);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toBe('Invalid request body');
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('dunsNumber');
    });

    it('400s a wrong type', async () => {
      const res = await post().send({ ...body, foundedYear: 'nineteen ninety-eight' });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('foundedYear');
    });

    it('400s an unknown entrySource', async () => {
      const res = await post().send({ ...body, entrySource: 'Walk-in' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400s an Event submission with no event name', async () => {
      const res = await post().send({ ...body, entrySource: 'Event' });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('eventName');
    });

    it('400s a whitespace-only required answer', async () => {
      const res = await post().send({ ...body, name: '   ' });
      expect(res.status).toBe(400);
    });

    it('400s an answer wider than its column', async () => {
      const res = await post().send({ ...body, country: 'x'.repeat(101) });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('country');
    });

    it('400s — naming the field — a revenue that would not fit AnnualRevenue', async () => {
      const res = await post().send({
        // 40 + 1 space + 10 = 51 characters, against an NVarChar(50) column.
        ...body, annualRevenueAmount: '1'.repeat(40), annualRevenueCurrency: 'MXN pesos+',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toContain('annualRevenue');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });

    it('ignores unknown keys rather than rejecting them (the Form gains questions)', async () => {
      const res = await post().send({ ...body, aBrandNewQuestion: 'some answer' });
      expect(res.status).toBe(201);
    });
  });

  describe('duplicates', () => {
    it('409s with the existing id and folio, and creates nothing', async () => {
      mock.companyInfo.findFirst.mockResolvedValue({
        supplier: { id: 'ps-existing', folio: 'SSD-2026-0042' },
      });

      const res = await post().send(body);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'CONFLICT', id: 'ps-existing', folio: 'SSD-2026-0042',
      });
      expect(res.body.error).toContain('123456789');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });
  });

  describe('entrySource routing', () => {
    it('links the supplier to the event whose NAME the vendor picked', async () => {
      mock.event.findFirst.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });
      mock.event.findUnique.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });

      const res = await post().send({
        ...body, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });

      expect(res.status).toBe(201);
      expect(mock.eventSupplierEntry.create).toHaveBeenCalledTimes(1);
    });

    it('201s an unmatched event name too — the registration is never dropped', async () => {
      mock.event.findFirst.mockResolvedValue(null);
      mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }]);

      const res = await post().send({
        ...body, entrySource: 'Event', eventName: 'Feria Regional del Bajío',
      });

      expect(res.status).toBe(201);
      expect(mock.eventSupplierEntry.create).not.toHaveBeenCalled();
      const messages = mock.notification.createMany.mock.calls
        .flatMap(call => (call[0].data as Array<{ message: string }>))
        .map(row => row.message);
      expect(messages.some(m => m.includes('"Feria Regional del Bajío"'))).toBe(true);
    });
  });

  // The profile threshold, end to end. `foundedYear` is the field the Zod schema
  // is deliberately looser about than the column (any Int passes the wire check,
  // but the column holds a YEAR), so it is what an unstorable answer looks like
  // on a live request.
  describe('unstorable profile answers', () => {
    beforeEach(() => {
      mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }]);
      mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
      mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
      mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
      mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
    });

    const messages = () => mock.notification.createMany.mock.calls
      .flatMap(call => (call[0].data as Array<{ message: string }>))
      .map(row => row.message);

    it('201s and warns nobody when every answered profile field is storable', async () => {
      const res = await post().send({
        ...body, foundedYear: 1998, technology: 'CNC', facilities: 3,
      });

      expect(res.status).toBe(201);
      expect(messages().some(m => m.includes('no se pudieron guardar'))).toBe(false);
    });

    it('201s but names the dropped field when a minority of the answers cannot be stored', async () => {
      // 1 unstorable out of 3 answered — below the threshold, so the supplier is
      // worth registering without it.
      const res = await post().send({
        ...body, foundedYear: 0, technology: 'CNC', facilities: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'ps1', folio: 'SSD-2026-001' });
      // The two good answers still landed; the bad one never reached the patch.
      expect(mock.technicalInfo.upsert.mock.calls[0][0].update).toMatchObject({ technology: 'CNC' });
      expect(mock.commercialInfo.upsert.mock.calls[0][0].update).toMatchObject({ facilities: 3 });
      expect(mock.companyInfo.upsert).not.toHaveBeenCalled();

      const warning = messages().find(m => m.includes('no se pudieron guardar'));
      expect(warning).toContain('foundedYear');
      expect(warning).toContain('SSD-2026-001');
    });

    it('400s — creating nothing — when most of the answers cannot be stored', async () => {
      // The only profile question answered is unstorable: 1 of 1, past the threshold.
      const res = await post().send({ ...body, foundedYear: 0 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toContain('foundedYear');
      // No supplier, no folio, no notification, no profile write.
      expect(mock.supplier.create).not.toHaveBeenCalled();
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(mock.notification.createMany).not.toHaveBeenCalled();
      expect(mock.companyInfo.upsert).not.toHaveBeenCalled();
    });

    it('201s a Form left mostly blank — a skipped question is not a failed one', async () => {
      const res = await post().send({
        ...body,
        technology: 'CNC',
        // Everything else the Form asks, left blank the way an unanswered
        // optional question arrives.
        taxIdNumber: '',
        companyType: '',
        headquarters: '',
        machineryType: '',
        processMethod: '',
        materials: '',
        complementaryOperations: '',
        certifications: '',
        productionVolume: '',
        topCustomers: '',
        employeeRange: '',
        annualRevenueAmount: '',
        annualRevenueCurrency: '',
        pressCapacityValue: '',
        pressCapacityUnit: '',
      });

      expect(res.status).toBe(201);
      expect(mock.technicalInfo.upsert.mock.calls[0][0].update).toEqual({ technology: 'CNC' });
      expect(messages().some(m => m.includes('no se pudieron guardar'))).toBe(false);
    });
  });
});
