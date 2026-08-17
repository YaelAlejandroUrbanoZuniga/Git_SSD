import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      /** Short correlation id, echoed to the client on 500s (see errorHandler). */
      requestId?: string;
    }
  }
}

/**
 * One structured console line per request, so a "it got stuck / it didn't save"
 * report from the GSM team can be found in the terminal without guessing.
 *
 *   [req] a1b2c3d4 GET /api/tracker/suppliers 200 42ms user=yael.urbano
 *
 * It is mounted BEFORE authenticate() on purpose, even though the user is only
 * known afterwards: a request that fails auth never reaches middleware mounted
 * after it (authenticate calls next(err), which jumps straight to the error
 * handler), so mounting it later would silently lose every 401. The line is
 * written on res 'finish' instead — by then req.user has been populated by
 * authenticate if the request got that far, and is simply absent (user=-) if it
 * didn't. Same reason it also covers /api/auth, which has no authenticate().
 */
export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    req.requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - startedAt;
      const user = req.user?.username ?? '-';
      console.log(
        `[req] ${req.requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms user=${user}`,
      );
    });
    return next();
  };
}
