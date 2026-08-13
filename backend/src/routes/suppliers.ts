import { Router } from 'express';
import type { Deps } from '../types/deps';
import { suppliersController } from '../controllers/suppliersController';
import { requireRole, OPERATIONAL_WRITE_ROLES, NOTE_WRITE_ROLES } from '../middleware/auth';

export function createSuppliersRouter(deps: Deps): Router {
  const router = Router();
  const controller = suppliersController(deps);
  // Read access is gated at the mount in app.ts; `write` is SSD-only.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);
  // Notes are the one write PM/Buyer/SQD keep — see NOTE_WRITE_ROLES.
  const noteWrite = requireRole(...NOTE_WRITE_ROLES);

  router.get('/', controller.list);                 // ?q=&stage=&commodity=&country=&status=
  router.get('/tracker', controller.listTracker);
  router.get('/blacklisted', controller.listBlacklisted);
  router.get('/completed', controller.listCompleted);
  router.get('/:id', controller.detail);
  router.post('/', write, controller.create);              // form A / form B (entrySource)
  router.patch('/:id', write, controller.update);
  router.delete('/:id', write, controller.remove);         // only in Scouting Event

  router.post('/:id/notes', noteWrite, controller.addNote);
  router.patch('/:id/notes/:noteId', noteWrite, controller.editNote);
  router.delete('/:id/notes/:noteId', noteWrite, controller.removeNote);

  return router;
}
