import { Router } from 'express';
import type { Deps } from '../types/deps';
import { suppliersController } from '../controllers/suppliersController';

export function createSuppliersRouter(deps: Deps): Router {
  const router = Router();
  const controller = suppliersController(deps);

  router.get('/', controller.list);                 // ?q=&stage=&commodity=&country=&status=
  router.get('/pipeline', controller.listPipeline);
  router.get('/blacklisted', controller.listBlacklisted);
  router.get('/completed', controller.listCompleted);
  router.get('/:id', controller.detail);
  router.post('/', controller.create);              // form A / form B (entrySource)
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);         // only in Scouting Event

  router.post('/:id/notes', controller.addNote);
  router.patch('/:id/notes/:noteId', controller.editNote);
  router.delete('/:id/notes/:noteId', controller.removeNote);

  return router;
}
