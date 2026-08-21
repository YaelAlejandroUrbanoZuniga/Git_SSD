import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppEnv } from '../config/env';
import { ApiError, UnauthorizedError } from '../domain/errors';

/** The header Power Automate puts the shared secret in. */
export const FORM_INTAKE_HEADER = 'x-form-intake-key';

/**
 * 503, not 401: an unconfigured integration is a deployment problem, and saying
 * so is what makes it get fixed. A 401 would look like a bad key and send
 * whoever set up the flow hunting for a typo in Power Automate.
 */
class ServiceUnavailableError extends ApiError {
  constructor(message: string) {
    super(503, message, 'NOT_CONFIGURED');
  }
}

/**
 * Constant-time string comparison. `timingSafeEqual` throws on length-mismatched
 * buffers — and comparing raw secrets would leak the length through that throw —
 * so both sides are hashed first: SHA-256 digests are always 32 bytes, so every
 * comparison takes the same path and the same time regardless of what was sent.
 *
 * `===` would be wrong here for the usual reason: it returns on the first
 * differing byte, so response time reveals how long a shared prefix is, and an
 * attacker who can measure it recovers the secret one character at a time. This
 * endpoint is public and the secret is its only door, so that matters.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * The whole authentication story for /api/public/form-intake. It is mounted
 * before `authenticate()` — the route never sees a JWT and `req.user` never
 * exists on it — so this is the only thing standing between the public internet
 * and a supplier write.
 *
 * Both rejections happen before anything touches the database.
 */
export function requireFormIntakeKey(env: AppEnv): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // No secret configured ⇒ the endpoint is closed. Never "no secret means no
    // check" — that inverts a missing variable into a public write endpoint.
    if (!env.formIntakeSecret) {
      return next(new ServiceUnavailableError(
        'The public form intake is not configured on this server (FORM_INTAKE_SECRET is unset). '
        + 'No registration was accepted.',
      ));
    }

    // A repeated header arrives as an array; only a single value can be right.
    const provided = req.headers[FORM_INTAKE_HEADER];
    if (typeof provided !== 'string' || !secretsMatch(provided, env.formIntakeSecret)) {
      return next(new UnauthorizedError(`Missing or invalid ${FORM_INTAKE_HEADER} header`));
    }

    return next();
  };
}
