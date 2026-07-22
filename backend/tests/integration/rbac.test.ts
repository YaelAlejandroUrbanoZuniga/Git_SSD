import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { signAccessToken, type AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, type MockPrisma } from '../helpers/mockPrisma';

const env = loadEnv({
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false',
} as NodeJS.ProcessEnv);

const ssd: AuthUser = { id: 'u-ssd', username: 'vianey.perea', displayName: 'Vianey Perea', role: 'SSD' };
const sqd: AuthUser = { id: 'u-sqd', username: 'ramon.gutierrez', displayName: 'Ramon Gutierrez', role: 'SQD' };
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
// gate blocks 'SQD' (and 'Guest') before the controller/body validation runs.
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

  // SQD is read-only: it can GET every operational module…
  it.each(OPERATIONAL_READS)('allows read-only SQD (200) on GET %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', bearer(sqd));
    expect(res.status).toBe(200);
  });

  // …but is 403'd on every mutating route in those same modules.
  it.each(OPERATIONAL_WRITES)('blocks read-only SQD (403) on POST %s', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(sqd)).send({});
    expect(res.status).toBe(403);
  });

  it.each(OPERATIONAL_WRITES)('blocks Guest (403) on POST %s too', async path => {
    const res = await request(app).post(path).set('Authorization', bearer(guest)).send({});
    expect(res.status).toBe(403);
  });

  it('blocks Guest (403) on /api/users but allows SSD (200)', async () => {
    const blocked = await request(app).get('/api/users').set('Authorization', bearer(guest));
    expect(blocked.status).toBe(403);
    const allowed = await request(app).get('/api/users').set('Authorization', bearer(ssd));
    expect(allowed.status).toBe(200);
  });

  it('also blocks non-master operational roles (PM/Buyer/SQD) on /api/users', async () => {
    const buyer: AuthUser = { id: 'u-b', username: 'a.buyer', displayName: 'A Buyer', role: 'Buyer' };
    const res = await request(app).get('/api/users').set('Authorization', bearer(buyer));
    expect(res.status).toBe(403);
  });

  it('allows Guest, SQD and SSD (200) on /api/home/summary', async () => {
    for (const u of [guest, sqd, ssd]) {
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
