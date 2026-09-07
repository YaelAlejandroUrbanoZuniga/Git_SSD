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

const buyer: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };
const guest: AuthUser = { id: 'u2', username: 'guest.user', displayName: 'Guest User', role: 'Guest' };

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

describe('GET /api/reports/recent-activity', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('defaults to 15 and passes it through to both source queries', async () => {
    const app = buildApp(mock);
    const res = await request(app)
      .get('/api/reports/recent-activity')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`);

    expect(res.status).toBe(200);
    expect(mock.supplierHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 15 }),
    );
    expect(mock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 15 }),
    );
  });

  it('honors an explicit ?limit=', async () => {
    const app = buildApp(mock);
    const res = await request(app)
      .get('/api/reports/recent-activity?limit=3')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`);

    expect(res.status).toBe(200);
    expect(mock.supplierHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('caps ?limit= at 50', async () => {
    const app = buildApp(mock);
    const res = await request(app)
      .get('/api/reports/recent-activity?limit=500')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`);

    expect(res.status).toBe(400); // exceeds the max — rejected, not silently clamped
  });

  it('rejects a non-positive limit', async () => {
    const app = buildApp(mock);
    const res = await request(app)
      .get('/api/reports/recent-activity?limit=0')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`);

    expect(res.status).toBe(400);
  });

  it('blocks Guest', async () => {
    const app = buildApp(mock);
    const res = await request(app)
      .get('/api/reports/recent-activity')
      .set('Authorization', `Bearer ${signAccessToken(env, guest)}`);

    expect(res.status).toBe(403);
  });
});
