import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { LdapAuthClient } from '../auth/ldapClient';
import type { AppRole } from '../domain/constants';
import { UnauthorizedError, ValidationError } from '../domain/errors';
import { signAccessToken, type AuthUser } from '../middleware/auth';
import { logAction } from './auditService';

// Password used only for LDAP validation; never stored or logged.

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface LoginResult {
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
  requestId?: string,
): Promise<LoginResult> {
  if (!username?.trim() || !password) {
    throw new ValidationError('username and password are required');
  }

  const result = await ldap.validate(username.trim(), password);
  // Password is intentionally not referenced beyond this point.
  if (!result.ok || !result.user) {
    // Audit the attempt with the typed identifier ONLY — never the password, and
    // never the reason LDAP gave (which can leak whether the account exists).
    logAction(prisma, {
      action: 'LOGIN_FAILED',
      requestId,
      userEmail: username.trim(),
      detail: `Failed login attempt for "${username.trim()}"`,
    });
    throw new UnauthorizedError('Invalid credentials');
  }
  const info = result.user;

  // appRole is app-owned, not from AD. Identity matching is EMAIL-based, because
  // the pre-provisioned username is a 'pending:' placeholder (we can't derive the
  // real netid from the email), and roleId is NEVER touched on update.
  //
  //   1. Match by `username` (= the real netid LDAP just returned). Normal path:
  //      someone who has logged in at least once, so their placeholder was already
  //      replaced by the real netid.
  let existing = await prisma.user.findUnique({
    where: { username: info.username },
    include: { role: true },
  });

  //   2. No username match but we know them by email → this is the FIRST real
  //      login of a pre-provisioned user (or a genuine netid change). Claim that
  //      row and stamp the real netid onto it. email is NOT @unique in Prisma
  //      (nullable → its filtered index lives in SQL), so this MUST be findFirst.
  if (!existing && info.email) {
    existing = await prisma.user.findFirst({
      where: { email: info.email },
      include: { role: true },
    });
  }

  //   3. Legacy fallback for the day the service starts returning a GUID.
  //      adObjectId is likewise not @unique in Prisma → findFirst, not findUnique.
  if (!existing && info.adObjectId) {
    existing = await prisma.user.findFirst({
      where: { adObjectId: info.adObjectId },
      include: { role: true },
    });
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          // The real netid replaces the 'pending:' placeholder (or an old netid).
          username: info.username,
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId ?? existing.adObjectId,
          // Auto-fills / refreshes the supervisor name whenever LDAP returns it.
          supervisorName: info.supervisorName ?? null,
          lastLoginAt: new Date(),
          // NB: roleId intentionally omitted — never overwrite an app-assigned role.
        },
        include: { role: true },
      })
    : await prisma.user.create({
        data: {
          // Genuinely new user: we already hold the real netid at this moment,
          // so no placeholder is needed here.
          username: info.username,
          displayName: info.displayName,
          email: info.email,
          adObjectId: info.adObjectId,
          supervisorName: info.supervisorName ?? null,
          // New users get the least-privilege default role: any employee with
          // @nexteer.com credentials can authenticate against AD, so the default
          // must be the lowest privilege ('Guest'). Operational roles
          // (SSD/PM/Buyer/SQD) are assigned explicitly via seed pre-provision or
          // by an SSD through /api/users.
          role: { connect: { name: env.defaultRole } },
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

  logAction(prisma, {
    action: 'LOGIN_OK',
    requestId,
    userId: user.id,
    userEmail: user.email,
    detail: `${user.displayName} (${user.username}) signed in as ${user.role.name}`,
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
