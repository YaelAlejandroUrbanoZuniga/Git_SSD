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
const def: AuthUser = { id: 'u-def', username: 'random.employee', displayName: 'Random Employee', role: 'Default' };

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

// Representative GET on each router guarded by requireRole (blocks 'Default').
const OPERATIONAL_ENDPOINTS = [
  '/api/tracker/suppliers',
  '/api/suppliers',
  '/api/events',
  '/api/strategy/entries',
];

describe('role-based access control', () => {
  let mock: MockPrisma;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mock = createMockPrisma(); // all findMany default to []
    app = buildApp(mock);
  });

  it.each(OPERATIONAL_ENDPOINTS)('blocks Default (403) on %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', `Bearer ${signAccessToken(env, def)}`);
    expect(res.status).toBe(403);
  });

  it.each(OPERATIONAL_ENDPOINTS)('allows SSD (200) on %s', async endpoint => {
    const res = await request(app).get(endpoint).set('Authorization', `Bearer ${signAccessToken(env, ssd)}`);
    expect(res.status).toBe(200);
  });

  it('blocks Default (403) on /api/users but allows SSD (200)', async () => {
    const blocked = await request(app).get('/api/users').set('Authorization', `Bearer ${signAccessToken(env, def)}`);
    expect(blocked.status).toBe(403);
    const allowed = await request(app).get('/api/users').set('Authorization', `Bearer ${signAccessToken(env, ssd)}`);
    expect(allowed.status).toBe(200);
  });

  it('also blocks non-master operational roles (PM/Buyer/SQD) on /api/users', async () => {
    const buyer: AuthUser = { id: 'u-b', username: 'a.buyer', displayName: 'A Buyer', role: 'Buyer' };
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${signAccessToken(env, buyer)}`);
    expect(res.status).toBe(403);
  });

  it('allows both Default and SSD (200) on /api/home/summary', async () => {
    const asDefault = await request(app)
      .get('/api/home/summary')
      .set('Authorization', `Bearer ${signAccessToken(env, def)}`);
    expect(asDefault.status).toBe(200);
    const asSsd = await request(app)
      .get('/api/home/summary')
      .set('Authorization', `Bearer ${signAccessToken(env, ssd)}`);
    expect(asSsd.status).toBe(200);
  });

  it('home summary never leaks individual supplier identity fields', async () => {
    const res = await request(app)
      .get('/api/home/summary')
      .set('Authorization', `Bearer ${signAccessToken(env, def)}`);
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body);
    expect(keys.sort()).toEqual(
      ['stageCounts', 'topCommodities', 'totalActive', 'totalCompleted', 'totalBlacklisted', 'upcomingEvents'].sort(),
    );
  });
});
