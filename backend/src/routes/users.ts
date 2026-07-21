import { Router } from 'express';
import type { Deps } from '../types/deps';
import { usersController } from '../controllers/usersController';
import { requireRole } from '../middleware/auth';

/** User administration — master role only (SSD). See requireRole in app.ts too. */
export function createUsersRouter(deps: Deps): Router {
  const router = Router();
  const controller = usersController(deps);

  // Every route on this router is SSD-only.
  router.use(requireRole('SSD'));

  router.get('/', controller.list);
  router.post('/', controller.create);        // pre-provision { email, role }
  router.patch('/:id', controller.updateRole); // { role }
  router.delete('/:id', controller.remove);

  return router;
}
