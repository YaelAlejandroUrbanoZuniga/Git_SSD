import cors from 'cors';
import express, { type Express } from 'express';
import type { Deps } from './types/deps';
import { authenticate, requireRole, OPERATIONAL_READ_ROLES } from './middleware/auth';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { createAuthRouter } from './routes/auth';
import { createTrackerRouter } from './routes/tracker';
import { createSuppliersRouter } from './routes/suppliers';
import { createEventsRouter } from './routes/events';
import { createStrategyRouter } from './routes/strategy';
import { createReportsRouter } from './routes/reports';
import { createNotificationsRouter } from './routes/notifications';
import { createUsersRouter } from './routes/users';
import { createHomeRouter } from './routes/home';
import { createFormIntakeRouter } from './routes/formIntake';

/** Builds the Express app with injected deps. */
export function createApp(deps: Deps): Express {
  const app = express();

  app.use(cors({ origin: deps.env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // Stamps req.requestId and logs one [req] line per request on response finish.
  // Mounted first so it also sees /api/auth and requests rejected by authenticate
  // (401), which never reach middleware registered after it — see requestLogger.
  app.use(requestLogger());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Auth endpoints don't require a token
  app.use('/api/auth', createAuthRouter(deps));

  // Public intake for the external supplier-registration MS Form, relayed by
  // Power Automate. MUST stay above the authenticate() line: Power Automate has
  // no Nexteer identity and cannot obtain a JWT, so the router authenticates
  // itself with a shared secret instead (x-form-intake-key — see
  // middleware/formIntakeAuth.ts) and refuses everything with 503 when none is
  // configured. Under '/api/public/' rather than '/api/' so the one route in the
  // API that is deliberately outside JWT auth says so in its own URL.
  app.use('/api/public/form-intake', createFormIntakeRouter(deps));

  // Everything else runs through authentication (see AUTH_OPTIONAL in README)
  app.use('/api', authenticate(deps.env));

  // Operational modules — mount-level READ gate (blocks 'Guest'); each router
  // additionally gates its mutating routes with OPERATIONAL_WRITE_ROLES (SSD-only),
  // except notes (NOTE_WRITE_ROLES) and prospect interest (PROSPECT_INTEREST_ROLES).
  // Net effect: PM/Buyer/SQD can GET all four modules but are 403'd on every
  // POST/PATCH/PUT/DELETE other than those two named exceptions.
  const operationalRead = requireRole(...OPERATIONAL_READ_ROLES);
  app.use('/api/tracker', operationalRead, createTrackerRouter(deps));
  app.use('/api/suppliers', operationalRead, createSuppliersRouter(deps));
  app.use('/api/events', operationalRead, createEventsRouter(deps));
  app.use('/api/strategy', operationalRead, createStrategyRouter(deps));
  // Read-only reporting — same read gate; no mutating routes (SQD can view).
  app.use('/api/reports', operationalRead, createReportsRouter(deps));

  // User administration — master role only (SSD). Unlike the operational modules
  // above, there is NO mount-level guard here: the single `requireRole('SSD')`
  // lives in routes/users.ts, applied with router.use to all four routes. That is
  // deliberate — /api/users has no read tier to separate from its write tier, so a
  // second gate here would restate the same rule in two places. Covered by
  // tests/integration/rbac.test.ts.
  app.use('/api/users', createUsersRouter(deps));

  // Reachable by any authenticated role (including 'Guest').
  app.use('/api/notifications', createNotificationsRouter(deps));
  app.use('/api/home', createHomeRouter(deps));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps));

  return app;
}
