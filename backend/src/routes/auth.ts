import { Router } from 'express';
import type { Deps } from '../types/deps';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

export function createAuthRouter(deps: Deps): Router {
  const router = Router();
  const controller = authController(deps);

  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate(deps.env), controller.me);

  return router;
}
