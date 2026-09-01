import { Router } from 'express';
import type { Deps } from '../types/deps';
import { strategyController } from '../controllers/strategyController';
import { requireRole, OPERATIONAL_WRITE_ROLES } from '../middleware/auth';

export function createStrategyRouter(deps: Deps): Router {
  const router = Router();
  const controller = strategyController(deps);
  // Read access is gated at the mount in app.ts; `write` blocks read-only SDE.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);

  router.get('/entries', controller.entries);
  router.patch('/entries/:id', write, controller.updateEntry); // inline edit of needs
  router.patch('/entries/by-commodity/:commodity', write, controller.upsertEntryByCommodity); // upsert needs by commodity
  router.get('/overview', controller.overview);         // CommodityStrategyRow[]
  router.get('/commodity/:commodity', controller.drilldown);

  router.get('/mrl', controller.mrlList);
  router.post('/mrl', write, controller.mrlCreate);
  router.patch('/mrl/:id', write, controller.mrlUpdate);       // inline edit
  router.delete('/mrl/:id', write, controller.mrlRemove);

  return router;
}
