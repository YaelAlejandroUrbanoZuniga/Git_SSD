import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { LdapAuthClient } from '../auth/ldapClient';
import { OPERATIONAL_ROLES, type AppRole } from '../domain/constants';
import { UnauthorizedError, ValidationError } from '../domain/errors';
import { signAccessToken, type AuthUser } from '../middleware/auth';
import { logAction } from './auditService';

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

  // Access is closed: only a row that was pre-provisioned (seed, or an SSD via
  // /api/users) with an operational role may sign in. There is no "create on
  // first login" path any more — a valid AD credential alone proves nothing
  // about whether this person should have access to the app. A row that
  // doesn't exist, or exists but still holds a non-operational role (see
  // OPERATIONAL_ROLES in domain/constants.ts — this is where a legacy row
  // whose role was never promoted ends up), is denied EXACTLY like a wrong
  // password: same error, same status, no update, no token, and the row (if
  // any) is left untouched. The audit detail carries the internal reason plus
  // the AD identity LDAP returned, to diagnose a mismatched pre-provisioned
  // email without ever logging the password.
  if (!existing || !OPERATIONAL_ROLES.includes(existing.role.name as AppRole)) {
    logAction(prisma, {
      action: 'LOGIN_DENIED',
      requestId,
      userEmail: username.trim(),
      detail: existing
        ? `Login denied for "${username.trim()}": role "${existing.role.name}" is not authorized `
          + `(AD netid "${info.username}", AD email "${info.email ?? ''}")`
        : `Login denied for "${username.trim()}": not registered `
          + `(AD netid "${info.username}", AD email "${info.email ?? ''}")`,
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  const user = await prisma.user.update({
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
  // A session issued before the user's role was downgraded to a non-operational
  // one must not stay usable for up to refreshExpiresDays more — re-check on
  // every refresh, not just at login.
  if (!OPERATIONAL_ROLES.includes(stored.user.role.name as AppRole)) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const newToken = randomBytes(48).toString('hex');
  await prisma.$transaction(async tx => {
    // Revoke CONDITIONALLY on the token still being live, in the same statement
    // that revokes it. The read above can't carry that guarantee: two requests
    // presenting the same refresh token would both pass it and both walk away
    // with a valid new token. Here the loser updates 0 rows and is rejected.
    const revoked = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    await tx.refreshToken.create({
      data: {
        tokenHash: hashToken(newToken),
        userId: stored.userId,
        expiresAt: new Date(Date.now() + env.refreshExpiresDays * 24 * 60 * 60 * 1000),
      },
    });
  });

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
