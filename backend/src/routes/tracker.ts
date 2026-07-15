import { Router } from 'express';
import type { Deps } from '../types/deps';
import { trackerController } from '../controllers/trackerController';

export function createTrackerRouter(deps: Deps): Router {
  const router = Router();
  const controller = trackerController(deps);

  router.get('/stage-config', controller.stageConfig);
  router.get('/suppliers', controller.list);           // ?stage=Parking%20Lot
  router.get('/suppliers/:id', controller.detail);
  router.post('/suppliers/:id/move', controller.move); // { newStage }
  router.post('/suppliers/:id/promote-b2b', controller.promoteB2B); // Identified → B2B (in Scouting Event)
  router.post('/suppliers/:id/blacklist', controller.blacklist); // { reason } — mandatory
  router.patch('/suppliers/:id/substatus', controller.subStatus); // { subStatus, reason? }

  return router;
}
