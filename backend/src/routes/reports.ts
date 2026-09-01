import { Router } from 'express';
import type { Deps } from '../types/deps';
import { reportsController } from '../controllers/reportsController';

/**
 * Read-only reporting module. Mounted behind the same operationalRead gate as
 * tracker/suppliers/events/strategy (app.ts), so SSD/PM/Buyer/SDE can all view
 * reports and Guest is blocked. There are no mutating routes — nothing to write.
 */
export function createReportsRouter(deps: Deps): Router {
  const router = Router();
  const controller = reportsController(deps);

  router.get('/weekly', controller.weekly);              // ?from=&to=&commodityId=
  router.get('/weekly/latest', controller.latest);        // ?commodityId=
  router.get('/commodities', controller.commodities);     // {id,name}[] for the filter

  return router;
}
