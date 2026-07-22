import cors from 'cors';
import express, { type Express } from 'express';
import type { Deps } from './types/deps';
import { authenticate, requireRole, OPERATIONAL_READ_ROLES } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createTrackerRouter } from './routes/tracker';
import { createSuppliersRouter } from './routes/suppliers';
import { createEventsRouter } from './routes/events';
import { createStrategyRouter } from './routes/strategy';
import { createReportsRouter } from './routes/reports';
import { createNotificationsRouter } from './routes/notifications';
import { createUsersRouter } from './routes/users';
import { createHomeRouter } from './routes/home';

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

  // Operational modules — mount-level READ gate (blocks 'Guest'); each router
  // additionally gates its mutating routes with OPERATIONAL_WRITE_ROLES, which
  // excludes read-only 'SQD'. Net effect: SQD can GET all four modules but is
  // 403'd on every POST/PATCH/PUT/DELETE.
  const operationalRead = requireRole(...OPERATIONAL_READ_ROLES);
  app.use('/api/tracker', operationalRead, createTrackerRouter(deps));
  app.use('/api/suppliers', operationalRead, createSuppliersRouter(deps));
  app.use('/api/events', operationalRead, createEventsRouter(deps));
  app.use('/api/strategy', operationalRead, createStrategyRouter(deps));
  // Read-only reporting — same read gate; no mutating routes (SQD can view).
  app.use('/api/reports', operationalRead, createReportsRouter(deps));

  // User administration — master role only (SSD); guard also on the router.
  app.use('/api/users', createUsersRouter(deps));

  // Reachable by any authenticated role (including 'Guest').
  app.use('/api/notifications', createNotificationsRouter(deps));
  app.use('/api/home', createHomeRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
