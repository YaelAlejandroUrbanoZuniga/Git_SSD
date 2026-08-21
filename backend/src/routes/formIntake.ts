import { Router } from 'express';
import type { Deps } from '../types/deps';
import { formIntakeController } from '../controllers/formIntakeController';
import { requireFormIntakeKey } from '../middleware/formIntakeAuth';

/**
 * The public intake for supplier registrations coming from the external MS Form
 * via Power Automate. Mounted in app.ts BEFORE `app.use('/api', authenticate())`
 * — Power Automate holds no Nexteer identity and cannot obtain a JWT, so this
 * router is the one place in the API where requests never carry `req.user`.
 *
 * Its only credential is the shared secret checked by `requireFormIntakeKey`,
 * which also closes the route entirely (503) when none is configured. There is
 * NO role gate below it: the request has no role to gate on.
 */
export function createFormIntakeRouter(deps: Deps): Router {
  const router = Router();
  const controller = formIntakeController(deps);

  router.post('/', requireFormIntakeKey(deps.env), controller.intake);

  return router;
}
