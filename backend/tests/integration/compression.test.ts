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

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

// A single long message easily pushes the JSON payload past the 1 KB
// threshold `compression()` uses by default once repeated a few times.
function bigNotificationRows(count: number) {
  const message = 'x'.repeat(200);
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    message,
    type: 'info',
    category: null,
    read: false,
    link: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }));
}

describe('gzip compression', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('gzip-compresses a large JSON response when the client accepts it', async () => {
    mock.notification.findMany.mockResolvedValue(bigNotificationRows(20));
    const app = buildApp(mock);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`)
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(JSON.stringify(res.body).length).toBeGreaterThan(1024);
  });

  it('returns plain JSON when the client sends no Accept-Encoding', async () => {
    mock.notification.findMany.mockResolvedValue(bigNotificationRows(20));
    const app = buildApp(mock);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${signAccessToken(env, buyer)}`)
      // superagent sends "gzip, deflate" by default; declaring only "identity"
      // is what actually asserts the no-Accept-Encoding-gzip behavior.
      .set('Accept-Encoding', 'identity');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});
