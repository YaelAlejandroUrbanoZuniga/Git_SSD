import { Router } from 'express';
import type { Deps } from '../types/deps';
import { homeController } from '../controllers/homeController';

/** No requireRole — reachable by any authenticated user, including 'Guest'. */
export function createHomeRouter(deps: Deps): Router {
  const router = Router();
  const controller = homeController(deps);

  router.get('/summary', controller.summary);

  return router;
}
