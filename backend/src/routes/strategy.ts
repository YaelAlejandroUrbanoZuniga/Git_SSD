import { Router } from 'express';
import type { Deps } from '../types/deps';
import { strategyController } from '../controllers/strategyController';

export function createStrategyRouter(deps: Deps): Router {
  const router = Router();
  const controller = strategyController(deps);

  router.get('/entries', controller.entries);
  router.patch('/entries/:id', controller.updateEntry); // inline edit of needs
  router.get('/overview', controller.overview);         // CommodityStrategyRow[]
  router.get('/commodity/:commodity', controller.drilldown);

  router.get('/mrl', controller.mrlList);
  router.post('/mrl', controller.mrlCreate);
  router.patch('/mrl/:id', controller.mrlUpdate);       // inline edit
  router.delete('/mrl/:id', controller.mrlRemove);

  return router;
}
