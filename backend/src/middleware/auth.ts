import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AppEnv } from '../config/env';
import type { AppRole } from '../domain/constants';
import { ForbiddenError, UnauthorizedError } from '../domain/errors';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
}

// Demo identity used when AUTH_OPTIONAL=true and no token is sent.
export const DEMO_USER: AuthUser = {
  id: 'demo-user',
  username: 'yael.urbano',
  displayName: 'Yael Urbano',
  role: 'SSD',
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface AccessTokenClaims {
  sub: string;
  username: string;
  displayName: string;
  role: AppRole;
}

export function signAccessToken(env: AppEnv, user: AuthUser): string {
  const claims: Omit<AccessTokenClaims, 'sub'> = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
  return jwt.sign(claims, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresInSeconds,
  });
}

/** Attaches req.user from a Bearer token; DEMO_USER when authOptional, else 401. */
export function authenticate(env: AppEnv): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      if (env.authOptional) {
        req.user = DEMO_USER;
        return next();
      }
      return next(new UnauthorizedError());
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & AccessTokenClaims;
      req.user = {
        id: payload.sub ?? '',
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
      };
      return next();
    } catch {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}

/**
 * Roles allowed to READ the operational modules (tracker/suppliers/events/
 * strategy) — everyone except 'Guest'.
 */
export const OPERATIONAL_READ_ROLES: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

/**
 * Roles allowed to WRITE (mutating verbs) in the operational modules. `SSD` is
 * the only operational writer — `PM`, `Buyer` and `SQD` are read-only across
 * suppliers/events/strategy/tracker/MRL, with exactly two named exceptions
 * that bypass this constant entirely: supplier/event notes (`NOTE_WRITE_ROLES`
 * below) and marking prospect interest (`PROSPECT_INTEREST_ROLES` below).
 */
export const OPERATIONAL_WRITE_ROLES: AppRole[] = ['SSD'];

/**
 * Adding/editing/deleting a NOTE on a supplier or event — one of the two
 * writes read-only `PM`/`Buyer`/`SQD` keep after OPERATIONAL_WRITE_ROLES
 * narrowed to SSD-only. Deliberately a separate constant rather than a role
 * on OPERATIONAL_WRITE_ROLES: a note is commentary, not a change to the
 * record itself. Used only by the note routes in routes/suppliers.ts and
 * routes/events.ts.
 */
export const NOTE_WRITE_ROLES: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

/**
 * Marking (and unmarking) interest on an event PROSPECT — the other write in
 * the whole app that read-only `SQD` (and `PM`/`Buyer`) are allowed to make.
 * Deliberately a separate constant rather than a widening of
 * OPERATIONAL_WRITE_ROLES: quality's opinion on which companies are worth a
 * B2B meeting is the point of the pre-event list, and this write touches
 * nothing else (it cannot create, move or edit a supplier). Used only by the
 * two interest routes in routes/events.ts.
 */
export const PROSPECT_INTEREST_ROLES: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

/**
 * Role guard: rejects (403) any authenticated user whose role isn't in the list.
 * Applied per-router / per-route (see app.ts and routes/*): operational routers
 * gate GETs with OPERATIONAL_READ_ROLES (blocks 'Guest') and mutating routes with
 * OPERATIONAL_WRITE_ROLES (SSD-only), except note routes (NOTE_WRITE_ROLES) and
 * prospect-interest routes (PROSPECT_INTEREST_ROLES); /api/users requires 'SSD'.
 */
export function requireRole(...roles: AppRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requires role: ${roles.join(' | ')}`));
    }
    return next();
  };
}
