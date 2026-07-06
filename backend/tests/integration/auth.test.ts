import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { MockLdapAuthClient } from '../../src/auth/ldapClient';
import { asPrisma, createMockPrisma, type MockPrisma } from '../helpers/mockPrisma';

const env = loadEnv({
  JWT_SECRET: 'test-secret',
  AUTH_MODE: 'mock',
  AUTH_OPTIONAL: 'false', // strict mode: every endpoint requires a token
} as NodeJS.ProcessEnv);

const dbUser = {
  id: 'u-ana',
  username: 'ana.garcia',
  displayName: 'Ana García',
  email: 'a.garcia@nexteer.com',
  adObjectId: 'ad-guid-ana-garcia',
  appRole: 'Buyer',
  createdAt: new Date(),
  lastLoginAt: new Date(),
};

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

describe('POST /api/auth/login', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('logs in a valid LDAP user, upserts them and returns JWT + refresh token', async () => {
    mock.user.findUnique.mockResolvedValue(null); // new user
    mock.user.create.mockResolvedValue(dbUser);
    mock.refreshToken.create.mockResolvedValue({});

    const res = await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: MockLdapAuthClient.PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      username: 'ana.garcia',
      displayName: 'Ana García',
      role: 'Buyer',
    });
    // user was persisted and refresh token stored hashed (not the raw token)
    expect(mock.user.create).toHaveBeenCalledOnce();
    const storedHash = mock.refreshToken.create.mock.calls[0][0].data.tokenHash as string;
    expect(storedHash).not.toBe(res.body.refreshToken);
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('updates (not duplicates) an existing user on login', async () => {
    mock.user.findUnique.mockResolvedValueOnce(dbUser); // found by adObjectId
    mock.user.update.mockResolvedValue(dbUser);
    mock.refreshToken.create.mockResolvedValue({});

    const res = await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: MockLdapAuthClient.PASSWORD });

    expect(res.status).toBe(200);
    expect(mock.user.update).toHaveBeenCalledOnce();
    expect(mock.user.create).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(mock.user.create).not.toHaveBeenCalled();
    expect(mock.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects unknown users with 401', async () => {
    const res = await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'intruso', password: MockLdapAuthClient.PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with 400', async () => {
    const res = await request(buildApp(mock)).post('/api/auth/login').send({ username: 'ana.garcia' });
    expect(res.status).toBe(400);
  });
});

describe('token verification', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  async function login(app: ReturnType<typeof buildApp>) {
    mock.user.findUnique.mockResolvedValue(null);
    mock.user.create.mockResolvedValue(dbUser);
    mock.refreshToken.create.mockResolvedValue({});
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: MockLdapAuthClient.PASSWORD });
    return res.body.token as string;
  }

  it('GET /api/auth/me returns the token identity', async () => {
    const app = buildApp(mock);
    const token = await login(app);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'ana.garcia', role: 'Buyer' });
  });

  it('rejects an invalid token with 401', async () => {
    const res = await request(buildApp(mock))
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects protected endpoints without a token when AUTH_OPTIONAL=false', async () => {
    const res = await request(buildApp(mock)).get('/api/suppliers');
    expect(res.status).toBe(401);
  });
});

describe('refresh & logout', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('rotates the refresh token', async () => {
    mock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'x',
      userId: dbUser.id,
      user: dbUser,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });
    mock.refreshToken.update.mockResolvedValue({});
    mock.refreshToken.create.mockResolvedValue({});

    const res = await request(buildApp(mock))
      .post('/api/auth/refresh')
      .send({ refreshToken: 'some-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.refreshToken).not.toBe('some-refresh-token');
    expect(mock.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
  });

  it('rejects an expired refresh token', async () => {
    mock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'x',
      userId: dbUser.id,
      user: dbUser,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
    });
    const res = await request(buildApp(mock))
      .post('/api/auth/refresh')
      .send({ refreshToken: 'stale' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    mock.refreshToken.findUnique.mockResolvedValue(null);
    const res = await request(buildApp(mock))
      .post('/api/auth/refresh')
      .send({ refreshToken: 'ghost' });
    expect(res.status).toBe(401);
  });

  it('logout revokes the refresh token and is idempotent', async () => {
    mock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(buildApp(mock))
      .post('/api/auth/logout')
      .send({ refreshToken: 'tok' });
    expect(res.status).toBe(204);

    const res2 = await request(buildApp(mock)).post('/api/auth/logout').send({});
    expect(res2.status).toBe(204);
  });
});
