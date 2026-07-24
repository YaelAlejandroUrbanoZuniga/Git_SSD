import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../domain/errors';
import type { Deps } from '../types/deps';
import { logAction } from '../services/auditService';

/**
 * Needs deps only for the audit write, hence the factory (the 400/401/403/404/409
 * paths are untouched — those responses are already typed and self-explanatory,
 * so they carry no requestId and are not audited).
 */
export function createErrorHandler(deps: Deps): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }

    // Genuine 500: the only case where the user sees a reference code. The same
    // requestId is on the [req] line and on the audit row, so a reported code
    // reconstructs the whole request without asking what they were doing.
    const requestId = req.requestId ?? '-';
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[unhandled] ${requestId} ${req.method} ${req.originalUrl} user=${req.user?.username ?? '-'}:`,
      err,
    );
    logAction(deps.prisma, {
      action: 'SYSTEM_ERROR',
      requestId,
      userId: req.user?.id ?? null,
      entityType: null,
      detail: `${req.method} ${req.originalUrl} — ${message}`,
    });

    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL', requestId });
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
}
