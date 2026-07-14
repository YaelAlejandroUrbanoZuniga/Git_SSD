import cors from 'cors';
import express, { type Express } from 'express';
import type { Deps } from './types/deps';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createTrackerRouter } from './routes/tracker';
import { createSuppliersRouter } from './routes/suppliers';
import { createEventsRouter } from './routes/events';
import { createStrategyRouter } from './routes/strategy';
import { createNotificationsRouter } from './routes/notifications';

/** Builds the Express app with injected deps. */
export function createApp(deps: Deps): Express {
  const app = express();

  app.use(cors({ origin: deps.env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Auth endpoints don't require a token
  app.use('/api/auth', createAuthRouter(deps));

  // Everything else runs through authentication (see AUTH_OPTIONAL in README)
  app.use('/api', authenticate(deps.env));
  app.use('/api/tracker', createTrackerRouter(deps));
  app.use('/api/suppliers', createSuppliersRouter(deps));
  app.use('/api/events', createEventsRouter(deps));
  app.use('/api/strategy', createStrategyRouter(deps));
  app.use('/api/notifications', createNotificationsRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
