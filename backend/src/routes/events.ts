import { Router } from 'express';
import type { Deps } from '../types/deps';
import { eventsController } from '../controllers/eventsController';

export function createEventsRouter(deps: Deps): Router {
  const router = Router();
  const controller = eventsController(deps);

  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  router.post('/:id/suppliers', controller.addSupplier);      // form A — new supplier
  router.post('/:id/suppliers/link', controller.linkSupplier); // link existing supplier

  router.post('/:id/notes', controller.addNote);
  router.patch('/:id/notes/:noteId', controller.editNote);
  router.delete('/:id/notes/:noteId', controller.removeNote);

  return router;
}
