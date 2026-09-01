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

const ssd: AuthUser = { id: 'u-ssd', username: 'vianey.perea', displayName: 'Vianey Perea', role: 'SSD' };
const sde: AuthUser = { id: 'u-sde', username: 'ramon.gutierrez', displayName: 'Ramon Gutierrez', role: 'SDE' };
const pm: AuthUser = { id: 'u-pm', username: 'p.manager', displayName: 'P Manager', role: 'PM' };
const buyer: AuthUser = { id: 'u-buyer', username: 'a.buyer', displayName: 'A Buyer', role: 'Buyer' };
const guest: AuthUser = { id: 'u-guest', username: 'random.employee', displayName: 'Random Employee', role: 'Guest' };

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

const bearer = (u: AuthUser) => `Bearer ${signAccessToken(env, u)}`;

// Representative GET on each operational router (read gate blocks 'Guest').
const OPERATIONAL_READS = [
  '/api/tracker/suppliers',
  '/api/suppliers',
  '/api/events',
  '/api/strategy/entries',
  '/api/reports/weekly/latest',
];

// Representative mutating (POST) route on each operational router — the write
// gate blocks 'SDE' (and 'Guest') before the controller/body validation runs.
const OPERATIONAL_WRITES = [
  '/api/tracker/suppliers/ps1/move',
  '/api/suppliers',
  '/api/events',
  '/api/strategy/mrl',
];

describe('role-based access control', () => {
  let mock: MockPrisma;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mock = createMockPrisma(); // all findMany default to []
    app = buildApp(mock);
  });

  it.each(OPERATIONAL_READS)('blocks Guest (403) on %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', bearer(guest));
    expect(res.status).toBe(403);
  });

  it.each(OPERATIONAL_READS)('allows SSD (200) on %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', bearer(ssd));
    expect(res.status).toBe(200);
  });

  // SDE is read-only: it can GET every operational module…
  it.each(OPERATIONAL_READS)('allows read-only SDE (200) on GET %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', bearer(sde));
    expect(res.status).toBe(200);
  });

  // …but is 403'd on every mutating route in those same modules.
  it.each(OPERATIONAL_WRITES)('blocks read-only SDE (403) on POST %s', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(sde)).send({});
    expect(res.status).toBe(403);
  });

  it.each(OPERATIONAL_WRITES)('blocks Guest (403) on POST %s too', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(guest)).send({});
    expect(res.status).toBe(403);
  });

  // PM and Buyer used to be operational writers; now they are read-only
  // everywhere except notes and prospect interest (tested separately below).
  it.each(OPERATIONAL_WRITES)('blocks PM (403) on POST %s', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(pm)).send({});
    expect(res.status).toBe(403);
  });

  it.each(OPERATIONAL_WRITES)('blocks Buyer (403) on POST %s', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(buyer)).send({});
    expect(res.status).toBe(403);
  });

  it('blocks PM and Buyer (403) on PATCH /api/suppliers/:id', async () => {
    for (const u of [pm, buyer]) {
      const res = await request(app)
        .patch('/api/suppliers/ps1')
        .set('Authorization', bearer(u))
        .send({ name: 'New Name' });
      expect(res.status).toBe(403);
    }
  });

  it('PM and Buyer can still add a supplier note (200/201)', async () => {
    const row = fakeSupplierRow();
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplierNote.create.mockResolvedValue({
      id: 'note-1', text: 'A meaningful note', author: 'A Buyer', role: 'Buyer', date: '2026-08-13',
    });

    for (const u of [pm, buyer]) {
      const res = await request(app)
        .post('/api/suppliers/ps1/notes')
        .set('Authorization', bearer(u))
        .send({ text: 'A meaningful note about this supplier' });
      expect(res.status).toBe(201);
    }
  });

  it('SDE can mark interest on an event prospect (200)', async () => {
    const prospect = {
      id: 1, eventId: 'ev1', companyName: 'Acme Co', productType: null, website: null,
      interestedBy: null, interestedById: null, interestedAt: null,
      b2bScheduled: false, b2bDateTime: null, b2bLocation: null, b2bSetBy: null, b2bSetAt: null,
      sourceFileName: null, importBatchId: 'batch-1', importedBy: 'SSD User',
      importedAt: new Date(), updatedAt: new Date(),
    };
    mock.eventProspect.findUnique.mockResolvedValue(prospect);
    mock.user.findUnique.mockResolvedValue({ id: sde.id });
    mock.eventProspect.update.mockResolvedValue({
      ...prospect, interestedBy: sde.displayName, interestedById: sde.id, interestedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/events/ev1/prospects/1/interest')
      .set('Authorization', bearer(sde))
      .send({});
    expect(res.status).toBe(200);
  });

  it('blocks Guest (403) on /api/users but allows SSD (200)', async () => {
    const blocked = await request(app).get('/api/users').set('Authorization', bearer(guest));
    expect(blocked.status).toBe(403);
    const allowed = await request(app).get('/api/users').set('Authorization', bearer(ssd));
    expect(allowed.status).toBe(200);
  });

  it('also blocks non-master operational roles (PM/Buyer/SDE) on /api/users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', bearer(buyer));
    expect(res.status).toBe(403);
  });

  it('allows Guest, SDE and SSD (200) on /api/home/summary', async () => {
    for (const u of [guest, sde, ssd]) {
      const res = await request(app).get('/api/home/summary').set('Authorization', bearer(u));
      expect(res.status).toBe(200);
    }
  });

  it('home summary never leaks individual supplier identity fields', async () => {
    const res = await request(app)
      .get('/api/home/summary')
      .set('Authorization', bearer(guest));
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body);
    expect(keys.sort()).toEqual(
      ['stageCounts', 'topCommodities', 'totalActive', 'totalCompleted', 'totalBlacklisted', 'upcomingEvents'].sort(),
    );
  });
});
