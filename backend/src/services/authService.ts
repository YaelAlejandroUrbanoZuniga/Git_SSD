import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { LdapAuthClient } from '../auth/ldapClient';
import type { AppRole } from '../domain/constants';
import { UnauthorizedError, ValidationError } from '../domain/errors';
import { signAccessToken, type AuthUser } from '../middleware/auth';

// Flow: React → Node (this service) → FastAPI/LDAP.
// The password is used ONLY for the LDAP validation call and is never
// stored, logged, or kept on any object after validate() returns.

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    role: AppRole;
  };
}

export async function login(
  prisma: PrismaClient,
  ldap: LdapAuthClient,
  env: AppEnv,
  username: string,
  password: string,
): Promise<LoginResult> {
  if (!username?.trim() || !password) {
    throw new ValidationError('username and password are required');
  }

  const result = await ldap.validate(username.trim(), password);
  // Password is intentionally not referenced beyond this point.
  if (!result.ok || !result.user) {
    throw new UnauthorizedError('Invalid credentials');
  }
  const info = result.user;

  // Upsert local user. The application role (SSD/PM/Buyer/SQD) is a custom
  // field owned by this app — NOT derived from AD. New users default to
  // 'Buyer'; an admin flow to manage roles is a pending TODO (README).
  const existing =
    (info.adObjectId
      ? await prisma.user.findUnique({ where: { adObjectId: info.adObjectId } })
      : null) ??
    (await prisma.user.findUnique({ where: { username: info.username } }));

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId ?? existing.adObjectId,
          lastLoginAt: new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          username: info.username,
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId,
          appRole: 'Buyer',
          lastLoginAt: new Date(),
        },
      });

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.appRole as AppRole,
  };

  const refreshToken = randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.refreshExpiresDays * 24 * 60 * 60 * 1000),
    },
  });

  return {
    token: signAccessToken(env, authUser),
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.appRole as AppRole,
    },
  };
}

/** Rotates the refresh token and issues a fresh access token. */
export async function refresh(
  prisma: PrismaClient,
  env: AppEnv,
  refreshToken: string,
): Promise<LoginResult> {
  if (!refreshToken) throw new ValidationError('refreshToken is required');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const newToken = randomBytes(48).toString('hex');
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(newToken),
        userId: stored.userId,
        expiresAt: new Date(Date.now() + env.refreshExpiresDays * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  const authUser: AuthUser = {
    id: stored.user.id,
    username: stored.user.username,
    displayName: stored.user.displayName,
    role: stored.user.appRole as AppRole,
  };
  return {
    token: signAccessToken(env, authUser),
    refreshToken: newToken,
    user: {
      id: stored.user.id,
      username: stored.user.username,
      displayName: stored.user.displayName,
      email: stored.user.email,
      role: stored.user.appRole as AppRole,
    },
  };
}

export async function logout(prisma: PrismaClient, refreshToken: string): Promise<void> {
  if (!refreshToken) return; // logout is idempotent
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
