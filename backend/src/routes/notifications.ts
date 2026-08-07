import { Router } from 'express';
import type { Deps } from '../types/deps';
import { notificationsController } from '../controllers/notificationsController';

export function createNotificationsRouter(deps: Deps): Router {
  const router = Router();
  const controller = notificationsController(deps);

  router.get('/', controller.list);
  router.patch('/:id/read', controller.markRead);
  router.post('/read-all', controller.markAllRead);
  // Deletion is always caller-scoped (404 on someone else's row). `/delete`
  // is declared before `/:id` so the literal path is never read as an id.
  router.post('/delete', controller.removeMany);
  router.delete('/', controller.removeAll);
  router.delete('/:id', controller.remove);

  return router;
}
