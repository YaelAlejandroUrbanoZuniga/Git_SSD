import { Router } from 'express';
import type { Deps } from '../types/deps';
import { eventsController } from '../controllers/eventsController';
import { requireRole, OPERATIONAL_WRITE_ROLES, PROSPECT_INTEREST_ROLES } from '../middleware/auth';

export function createEventsRouter(deps: Deps): Router {
  const router = Router();
  const controller = eventsController(deps);
  // Read access is gated at the mount in app.ts; `write` blocks read-only SQD.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);
  // B2B scheduling and undoing an import are SSD's job alone.
  const b2bOnly = requireRole('SSD');
  // The single exception to "SQD never writes" — see PROSPECT_INTEREST_ROLES.
  const markInterest = requireRole(...PROSPECT_INTEREST_ROLES);

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

  // Pre-event prospects — imported from Excel, never written to T_Supplier.
  router.get('/:id/prospects', controller.listProspects);
  router.post('/:id/prospects/import', write, controller.importProspects);
  router.delete('/:id/prospects/import/:importBatchId', b2bOnly, controller.deleteImportBatch);
  router.post('/:id/prospects/:prospectId/interest', markInterest, controller.setInterest);
  router.delete('/:id/prospects/:prospectId/interest', markInterest, controller.unsetInterest);
  router.patch('/:id/prospects/:prospectId/b2b', b2bOnly, controller.setProspectB2b);

  return router;
}
