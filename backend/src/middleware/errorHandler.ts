import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../domain/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
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
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
}
