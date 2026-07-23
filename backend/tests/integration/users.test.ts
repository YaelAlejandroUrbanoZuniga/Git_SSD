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
const authHeader = () => `Bearer ${signAccessToken(env, ssd)}`;

function buildApp(mock: MockPrisma) {
  return createApp({ prisma: asPrisma(mock), env, ldap: new MockLdapAuthClient() });
}

const withRole = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, username: 'x', displayName: 'X', email: 'x@nexteer.com', adObjectId: null,
  role: { id: 1, name }, ...extra,
});

describe('/api/users CRUD (SSD only)', () => {
  let mock: MockPrisma;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mock = createMockPrisma();
    app = buildApp(mock);
  });

  it('GET lists users', async () => {
    mock.user.findMany.mockResolvedValue([
      withRole('u1', 'SSD', { username: 'vianey.perea', displayName: 'Vianey Perea', email: 'vianey.perea@nexteer.com' }),
    ]);
    const res = await request(app).get('/api/users').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 'u1', username: 'vianey.perea', role: 'SSD' });
  });

  it('GET excludes Guest users from the listing (they only logged in, not granted a role)', async () => {
    mock.user.findMany.mockResolvedValue([]);
    await request(app).get('/api/users').set('Authorization', authHeader());
    expect(mock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: { is: { name: { not: 'Guest' } } } } }),
    );
  });

  it('POST pre-provisions with a "pending:" placeholder username (real netid arrives on first login)', async () => {
    mock.user.findFirst.mockResolvedValue(null); // no clash
    mock.user.create.mockResolvedValue(
      withRole('u9', 'Buyer', { username: 'pending:new.buyer', displayName: 'New Buyer', email: 'new.buyer@nexteer.com' }),
    );
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'New.Buyer@nexteer.com', role: 'Buyer' });

    expect(res.status).toBe(201);
    const createData = mock.user.create.mock.calls[0][0].data as Record<string, unknown>;
    // Placeholder, not the email local part — the email-derived name is NOT the AD netid.
    expect(createData.username).toBe('pending:new.buyer');
    expect(createData.displayName).toBe('New Buyer'); // capitalized fallback
    expect(createData.adObjectId).toBeNull();
  });

  it('POST rejects an invalid email (400)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'not-an-email', role: 'Buyer' });
    expect(res.status).toBe(400);
  });

  it('POST rejects a role outside the catalog (400)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'someone@nexteer.com', role: 'Overlord' });
    expect(res.status).toBe(400);
  });

  it('POST returns 409 when a NON-Guest user with that email already exists', async () => {
    mock.user.findFirst.mockResolvedValue(withRole('u1', 'Buyer', { email: 'dup@nexteer.com' }));
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'dup@nexteer.com', role: 'Buyer' });
    expect(res.status).toBe(409);
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('POST reclaims an existing Guest row (promote in place, not 409, no new row)', async () => {
    // A Guest who already signed in: real netid stamped on username, email set.
    mock.user.findFirst.mockResolvedValue(
      withRole('u-guest', 'Guest', { username: 'GZJGZE', displayName: 'Citlaly Hernandez', email: 'reclaim@nexteer.com' }),
    );
    mock.user.update.mockResolvedValue(
      withRole('u-guest', 'Buyer', { username: 'GZJGZE', displayName: 'Citlaly Hernandez', email: 'reclaim@nexteer.com' }),
    );
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'reclaim@nexteer.com', role: 'Buyer' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'u-guest', username: 'GZJGZE', role: 'Buyer', promotedFromGuest: true });
    expect(mock.user.create).not.toHaveBeenCalled();
    // Only the role changes — username/displayName are preserved.
    expect(mock.user.update.mock.calls[0][0].data).toEqual({ role: { connect: { name: 'Buyer' } } });
  });

  it('POST still 409s on a username-only clash, even when that row is a Guest (different email)', async () => {
    // Matched by username (a real netid that equals the new email local part) but
    // a DIFFERENT email — not the same person, so it stays a genuine conflict.
    mock.user.findFirst.mockResolvedValue(
      withRole('u-other', 'Guest', { username: 'someone', email: 'different@nexteer.com' }),
    );
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', authHeader())
      .send({ email: 'someone@nexteer.com', role: 'Buyer' });
    expect(res.status).toBe(409);
    expect(mock.user.update).not.toHaveBeenCalled();
    expect(mock.user.create).not.toHaveBeenCalled();
  });

  it('PATCH changes only the role (200)', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'Buyer'));
    mock.user.update.mockResolvedValue(withRole('u1', 'SQD'));
    const res = await request(app)
      .patch('/api/users/u1')
      .set('Authorization', authHeader())
      .send({ role: 'SQD' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('SQD');
  });

  it('PATCH 404 for an unknown user', async () => {
    mock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/users/ghost')
      .set('Authorization', authHeader())
      .send({ role: 'SQD' });
    expect(res.status).toBe(404);
  });

  it('PATCH refuses to demote the LAST SSD user (400)', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'SSD'));
    mock.user.count.mockResolvedValue(1); // only one SSD left
    const res = await request(app)
      .patch('/api/users/u1')
      .set('Authorization', authHeader())
      .send({ role: 'Buyer' });
    expect(res.status).toBe(400);
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('PATCH refuses to reassign ANY SSD user, even with other SSDs present (400) — DB-only', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'SSD'));
    mock.user.count.mockResolvedValue(2); // another SSD remains, yet still blocked
    const res = await request(app)
      .patch('/api/users/u1')
      .set('Authorization', authHeader())
      .send({ role: 'Buyer' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/database directly/i);
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('DELETE removes a non-SSD user (204)', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'Buyer'));
    mock.user.delete.mockResolvedValue({});
    const res = await request(app).delete('/api/users/u1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(mock.user.delete).toHaveBeenCalledOnce();
  });

  it('DELETE refuses to remove the LAST SSD user (400)', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'SSD'));
    mock.user.count.mockResolvedValue(1);
    const res = await request(app).delete('/api/users/u1').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(mock.user.delete).not.toHaveBeenCalled();
  });

  it('DELETE refuses to remove ANY SSD user, even with other SSDs present (400) — DB-only', async () => {
    mock.user.findUnique.mockResolvedValue(withRole('u1', 'SSD'));
    mock.user.count.mockResolvedValue(2); // another SSD remains, yet still blocked
    const res = await request(app).delete('/api/users/u1').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be deleted from the application/i);
    expect(mock.user.delete).not.toHaveBeenCalled();
  });
});
