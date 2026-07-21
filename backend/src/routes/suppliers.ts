import { Router } from 'express';
import type { Deps } from '../types/deps';
import { suppliersController } from '../controllers/suppliersController';
import { requireRole, OPERATIONAL_WRITE_ROLES } from '../middleware/auth';

export function createSuppliersRouter(deps: Deps): Router {
  const router = Router();
  const controller = suppliersController(deps);
  // Read access is gated at the mount in app.ts; `write` blocks read-only SQD.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);

  router.get('/', controller.list);                 // ?q=&stage=&commodity=&country=&status=
  router.get('/tracker', controller.listTracker);
  router.get('/blacklisted', controller.listBlacklisted);
  router.get('/completed', controller.listCompleted);
  router.get('/:id', controller.detail);
  router.post('/', write, controller.create);              // form A / form B (entrySource)
  router.patch('/:id', write, controller.update);
  router.delete('/:id', write, controller.remove);         // only in Scouting Event

  router.post('/:id/notes', write, controller.addNote);
  router.patch('/:id/notes/:noteId', write, controller.editNote);
  router.delete('/:id/notes/:noteId', write, controller.removeNote);

  return router;
}
