import { Router } from 'express';
import type { Deps } from '../types/deps';
import { pipelineController } from '../controllers/pipelineController';

export function createPipelineRouter(deps: Deps): Router {
  const router = Router();
  const controller = pipelineController(deps);

  router.get('/stage-config', controller.stageConfig);
  router.get('/suppliers', controller.list);           // ?stage=Parking%20Lot
  router.get('/suppliers/:id', controller.detail);
  router.post('/suppliers/:id/move', controller.move); // { newStage }
  router.post('/suppliers/:id/blacklist', controller.blacklist); // { reason } — mandatory
  router.patch('/suppliers/:id/substatus', controller.subStatus); // { subStatus, reason? }

  return router;
}
