import { Router } from 'express';
import type { Deps } from '../types/deps';
import { eventsController } from '../controllers/eventsController';
import { requireRole, OPERATIONAL_WRITE_ROLES } from '../middleware/auth';

export function createEventsRouter(deps: Deps): Router {
  const router = Router();
  const controller = eventsController(deps);
  // Read access is gated at the mount in app.ts; `write` blocks read-only SQD.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);

  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', write, controller.create);
  router.patch('/:id', write, controller.update);
  router.delete('/:id', write, controller.remove);

  router.post('/:id/suppliers', write, controller.addSupplier);      // form A — new supplier
  router.post('/:id/suppliers/link', write, controller.linkSupplier); // link existing supplier

  router.post('/:id/notes', write, controller.addNote);
  router.patch('/:id/notes/:noteId', write, controller.editNote);
  router.delete('/:id/notes/:noteId', write, controller.removeNote);

  return router;
}
