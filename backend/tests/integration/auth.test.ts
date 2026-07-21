import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadEnv } from '../../src/config/env';
import { HttpLdapAuthClient, MockLdapAuthClient } from '../../src/auth/ldapClient';
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
  roleId: 3,
  // appRole became an FK relation; authService reads user.role.name
  role: { id: 3, name: 'Buyer' },
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

  it('assigns the least-privilege default role "Guest" (not "Buyer") to a new user', async () => {
    mock.user.findUnique.mockResolvedValue(null); // new user
    mock.user.create.mockResolvedValue(dbUser);
    mock.refreshToken.create.mockResolvedValue({});

    await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: MockLdapAuthClient.PASSWORD });

    expect(mock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: { connect: { name: 'Guest' } } }),
      }),
    );
  });

  it('resolves an existing user by username (netid) first — never overwrites roleId', async () => {
    mock.user.findUnique.mockResolvedValueOnce(dbUser); // matched by username
    mock.user.update.mockResolvedValue(dbUser);
    mock.refreshToken.create.mockResolvedValue({});

    await request(buildApp(mock))
      .post('/api/auth/login')
      .send({ username: 'ana.garcia', password: MockLdapAuthClient.PASSWORD });

    // First lookup is by username, and the update never carries a roleId.
    expect(mock.user.findUnique.mock.calls[0][0]).toMatchObject({ where: { username: 'ana.garcia' } });
    const updateData = mock.user.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData).not.toHaveProperty('roleId');
    expect(updateData).not.toHaveProperty('role');
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

describe('HttpLdapAuthClient — real POST /auth/login contract', () => {
  const okResponse = (body: unknown) => ({ json: async () => body }) as unknown as Response;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats 200 + { success:false } as invalid credentials (never throws on res.ok)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({ success: false, message: 'Authentication failed' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpLdapAuthClient('http://ldap.local', 'secret-key');
    const result = await client.validate('ivan.mendoza.guadarrama', 'pw');

    expect(result.ok).toBe(false);
    // login does NOT send X-API-Key
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers).not.toHaveProperty('X-API-Key');
    expect(fetchMock.mock.calls[0][0]).toBe('http://ldap.local/auth/login');
  });

  it('maps netid → username, name → displayName, and leaves adObjectId null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          success: true,
          message: 'Authentication successful',
          user: {
            employee_number: '100777',
            name: 'Ivan Mendoza',
            email: 'ivan.mendoza.guadarrama@nexteer.com',
            department: 'Purchasing',
            job_title: 'Buyer',
            supervisor_name: 'Itzel Campos',
            netid: 'ivan.mendoza.guadarrama',
          },
        }),
      ),
    );

    const client = new HttpLdapAuthClient('http://ldap.local', 'secret-key');
    const result = await client.validate('IVAN.MENDOZA.GUADARRAMA@nexteer.com', 'pw');

    expect(result.ok).toBe(true);
    expect(result.user).toMatchObject({
      username: 'ivan.mendoza.guadarrama',
      displayName: 'Ivan Mendoza',
      email: 'ivan.mendoza.guadarrama@nexteer.com',
      department: 'Purchasing',
      jobTitle: 'Buyer',
      supervisorName: 'Itzel Campos',
      employeeNumber: '100777',
      adObjectId: null,
    });
  });

  it('falls back to the typed username (lowercased, no @nexteer.com) when netid is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({ success: true, user: { netid: null, name: null } }),
      ),
    );
    const client = new HttpLdapAuthClient('http://ldap.local', 'secret-key');
    const result = await client.validate('Vianey.Perea@nexteer.com', 'pw');
    expect(result.user?.username).toBe('vianey.perea');
    expect(result.user?.displayName).toBe('vianey.perea'); // falls back to username
  });

  it('returns "LDAP service unreachable" on a network error/timeout (no raw throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const client = new HttpLdapAuthClient('http://ldap.local', 'secret-key');
    const result = await client.validate('someone', 'pw');
    expect(result).toEqual({ ok: false, error: 'LDAP service unreachable' });
  });
});
