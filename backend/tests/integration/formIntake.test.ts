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

  // ── The fifteen answers added 2026-08-24 ────────────────────────────
  // They used to be stripped by the Zod schema and never reach a column. These
  // cases run the whole endpoint — schema, mapper, profile check, patch — and
  // assert each one arrives at the satellite table it belongs to.
  describe('the profile answers aligned with the 48-question Form', () => {
    beforeEach(() => {
      mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }]);
      mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
      mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
      mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
      mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
    });

    /** Every one of the fifteen, answered. */
    const fifteenNew = {
      // CompanyInfo
      hqCity: 'Querétaro',
      hqCountry: 'Mexico',
      manufacturingCity: 'Celaya',
      generalManager: 'Ana García',
      firstContactWithNexteer: true,
      // TechnicalInfo
      toolingDesign: 'In-house',
      rawMaterialIndex: 'LME Aluminium',
      applications: 'Steering columns, brackets',
      // CommercialInfo
      footprint: 'Global',
      yearsInMexico: 26,
      market: 'Mixed',
      businessSector: 'Automotive tier 2',
      automotivePercent: 65,
      exportLocalContentPercent: 40,
      exportDestinationCountries: 'USA, Canada',
    };

    /** The `update` half of each satellite upsert the profile patch issued. */
    const patched = () => ({
      company: mock.companyInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
      tech: mock.technicalInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
      commercial: mock.commercialInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
    });

    const expectAllFifteenPersisted = () => {
      const { company, tech, commercial } = patched();

      expect(company).toMatchObject({
        hqCity: 'Querétaro',
        hqCountry: 'Mexico',
        manufacturingCity: 'Celaya',
        generalManager: 'Ana García',
        firstContactWithNexteer: true,
      });
      expect(tech).toMatchObject({
        toolingDesign: 'In-house',
        rawMaterialIndex: 'LME Aluminium',
        applications: 'Steering columns, brackets',
      });
      expect(commercial).toMatchObject({
        footprint: 'Global',
        yearsInMexico: 26,
        market: 'Mixed',
        businessSector: 'Automotive tier 2',
        automotivePercent: 65,
        exportLocalContentPercent: 40,
        exportDestinationCountries: 'USA, Canada',
        // Derived from the two above, and written as the string the column holds.
        exportCapability: 'true',
      });
    };

    it('persists all fifteen on a Recommendation submission', async () => {
      const res = await post().send({ ...body, ...fifteenNew });

      expect(res.status).toBe(201);
      expectAllFifteenPersisted();
      // Nothing was reported unstorable.
      expect(mock.notification.createMany.mock.calls
        .flatMap(call => (call[0].data as Array<{ message: string }>))
        .some(row => row.message.includes('no se pudieron guardar'))).toBe(false);
    });

    it('persists all fifteen on an Event submission too', async () => {
      mock.event.findFirst.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });
      mock.event.findUnique.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });

      const res = await post().send({
        ...body, ...fifteenNew, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });

      expect(res.status).toBe(201);
      expect(mock.eventSupplierEntry.create).toHaveBeenCalledTimes(1);
      expectAllFifteenPersisted();
    });

    it('201s with all fifteen absent — the endpoint stays additive, never required', async () => {
      const res = await post().send(body);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'ps1', folio: 'SSD-2026-001' });
      // No profile answers at all, so no satellite patch was even attempted.
      expect(mock.companyInfo.upsert).not.toHaveBeenCalled();
      expect(mock.technicalInfo.upsert).not.toHaveBeenCalled();
      expect(mock.commercialInfo.upsert).not.toHaveBeenCalled();
    });

    it('drops the automotive percentage when the market answer is not Mixed', async () => {
      const res = await post().send({
        ...body, ...fifteenNew, market: 'Automotive', automotivePercent: 65,
      });

      expect(res.status).toBe(201);
      expect(patched().commercial).toMatchObject({ market: 'Automotive' });
      expect(patched().commercial).not.toHaveProperty('automotivePercent');
    });

    it('derives exportCapability false when nothing leaves the country', async () => {
      const res = await post().send({
        ...body, exportLocalContentPercent: 100, exportDestinationCountries: 'None',
      });

      expect(res.status).toBe(201);
      expect(patched().commercial).toMatchObject({ exportCapability: 'false' });
    });

    it('leaves exportCapability out of the patch when neither export question was answered', async () => {
      const res = await post().send({ ...body, footprint: 'Global' });

      expect(res.status).toBe(201);
      expect(patched().commercial).toEqual({ footprint: 'Global' });
    });

    it('400s a percentage outside 0–100, naming the field', async () => {
      const res = await post().send({ ...body, automotivePercent: 140 });

      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('automotivePercent');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });

    it('400s a years-in-Mexico answer past the Form\'s own 0–150 bound', async () => {
      const res = await post().send({ ...body, yearsInMexico: 400 });

      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('yearsInMexico');
    });

    it('no longer accepts the retired exportCapability boolean — it is stripped, not stored', async () => {
      // It is an unknown key now, and unknown keys are ignored (the Form gains
      // and loses questions without this endpoint 400-ing).
      const res = await post().send({ ...body, exportCapability: true, footprint: 'Global' });

      expect(res.status).toBe(201);
      expect(patched().commercial).toEqual({ footprint: 'Global' });
    });
  });

  // ── Q34: one question, one value ──────────────────────────────────────
  // The Form asks whether the supplier holds an IMMEX certification and offers
  // three answers. It used to arrive as `hasIMMEX`/`planIMMEX`, which Power
  // Automate had to derive: four combinations for three answers, one of which
  // silently overrode the other. Now the answer travels verbatim.
  describe('the single IMMEX answer', () => {
    beforeEach(() => {
      mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }]);
      mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
      mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
      mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
      // The whole catalog, so a wrong mapping picks a wrong id instead of none.
      mock.immexStatus.findMany.mockResolvedValue([
        { id: 1, name: 'Yes' }, { id: 2, name: 'No' },
        { id: 3, name: 'In Plan' }, { id: 4, name: 'TBC' },
      ]);
    });

    const commercial = () =>
      mock.commercialInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>;

    it.each([
      ['Yes', 1],
      ['No, with a plan', 3],
      ['No, without a plan', 2],
    ])('stores %s as the single FK_ImmexStatus', async (answer, immexStatusId) => {
      const res = await post().send({ ...body, immexAnswer: answer });

      expect(res.status).toBe(201);
      expect(commercial()).toEqual({ immexStatusId });
    });

    it('400s an answer outside the three, naming the field', async () => {
      // 'In Plan' is the CATALOG name, not a Form answer — the two vocabularies
      // are deliberately different and only catalogMapping bridges them.
      const res = await post().send({ ...body, immexAnswer: 'In Plan' });

      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('immexAnswer');
      expect(mock.supplier.create).not.toHaveBeenCalled();
    });

    it('no longer accepts the retired hasIMMEX/planIMMEX pair — it is stripped', async () => {
      // Unknown keys are ignored rather than rejected, so a Power Automate flow
      // still sending the old pair registers the supplier WITHOUT an IMMEX answer
      // instead of quietly writing one nobody chose.
      const res = await post().send({
        ...body, hasIMMEX: true, planIMMEX: false, footprint: 'Global',
      });

      expect(res.status).toBe(201);
      expect(commercial()).toEqual({ footprint: 'Global' });
    });

    it('leaves the FK alone when Q34 was skipped', async () => {
      const res = await post().send({ ...body, footprint: 'Global' });

      expect(res.status).toBe(201);
      expect(commercial()).toEqual({ footprint: 'Global' });
    });
  });
});
