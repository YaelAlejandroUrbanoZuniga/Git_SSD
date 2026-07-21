import { Router } from 'express';
import type { Deps } from '../types/deps';
import { trackerController } from '../controllers/trackerController';
import { requireRole, OPERATIONAL_WRITE_ROLES } from '../middleware/auth';

export function createTrackerRouter(deps: Deps): Router {
  const router = Router();
  const controller = trackerController(deps);
  // Mount-level read access is already enforced in app.ts; `write` additionally
  // blocks read-only SQD on every mutating route below.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);

  router.get('/stage-config', controller.stageConfig);
  router.get('/suppliers', controller.list);           // ?stage=Parking%20Lot
  router.get('/suppliers/:id', controller.detail);
  router.post('/suppliers/:id/move', write, controller.move); // { newStage }
  router.post('/suppliers/:id/promote-b2b', write, controller.promoteB2B); // Identified → B2B (in Scouting Event)
  router.post('/suppliers/:id/blacklist', write, controller.blacklist); // { reason } — mandatory
  router.patch('/suppliers/:id/substatus', write, controller.subStatus); // { subStatus, reason? }

  return router;
}
