import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { LdapAuthClient } from '../auth/ldapClient';
import type { AppRole } from '../domain/constants';
import { UnauthorizedError, ValidationError } from '../domain/errors';
import { signAccessToken, type AuthUser } from '../middleware/auth';

// Password used only for LDAP validation; never stored or logged.

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

  // appRole (SSD/PM/Buyer/SQD) is app-owned, not from AD; defaults to 'Buyer'.
  const existing =
    (info.adObjectId
      ? await prisma.user.findUnique({ where: { adObjectId: info.adObjectId }, include: { role: true } })
      : null) ??
    (await prisma.user.findUnique({ where: { username: info.username }, include: { role: true } }));

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId ?? existing.adObjectId,
          lastLoginAt: new Date(),
        },
        include: { role: true },
      })
    : await prisma.user.create({
        data: {
          username: info.username,
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId,
          // Default role is resolved here (the FK carries no text default).
          role: { connect: { name: 'Buyer' } },
          lastLoginAt: new Date(),
        },
        include: { role: true },
      });

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role.name as AppRole,
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
      role: user.role.name as AppRole,
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
    include: { user: { include: { role: true } } },
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
    role: stored.user.role.name as AppRole,
  };
  return {
    token: signAccessToken(env, authUser),
    refreshToken: newToken,
    user: {
      id: stored.user.id,
      username: stored.user.username,
      displayName: stored.user.displayName,
      email: stored.user.email,
      role: stored.user.role.name as AppRole,
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
