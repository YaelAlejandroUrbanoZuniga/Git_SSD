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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AccessTokenClaims {
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
 * Role guard: rejects (403) any authenticated user whose role isn't in the list.
 * Applied per-router (see app.ts) — e.g. the tracker/suppliers/events/strategy
 * routers require an operational role, blocking 'Default'; /api/users requires
 * the master role 'SSD'.
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
