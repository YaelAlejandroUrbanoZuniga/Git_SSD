import { Router } from 'express';
import type { Deps } from '../types/deps';
import { notificationsController } from '../controllers/notificationsController';

export function createNotificationsRouter(deps: Deps): Router {
  const router = Router();
  const controller = notificationsController(deps);

  router.get('/', controller.list);
  router.patch('/:id/read', controller.markRead);
  router.post('/read-all', controller.markAllRead);

  return router;
}
