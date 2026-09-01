import { Router } from 'express';
import type { Deps } from '../types/deps';
import { eventsController } from '../controllers/eventsController';
import { requireRole, OPERATIONAL_WRITE_ROLES, NOTE_WRITE_ROLES, PROSPECT_INTEREST_ROLES } from '../middleware/auth';

export function createEventsRouter(deps: Deps): Router {
  const router = Router();
  const controller = eventsController(deps);
  // Read access is gated at the mount in app.ts; `write` is SSD-only.
  const write = requireRole(...OPERATIONAL_WRITE_ROLES);
  // Notes are the one write PM/Buyer/SDE keep — see NOTE_WRITE_ROLES.
  const noteWrite = requireRole(...NOTE_WRITE_ROLES);
  // Scheduling a B2B meeting and undoing a prospect import are SSD's job alone.
  // Named for what it grants, not for one of the two routes it guards (it used
  // to be `b2bOnly`, which said nothing about the import-undo route).
  //
  // The literal 'SSD' is deliberate and NOT `OPERATIONAL_WRITE_ROLES`: the two
  // sets happen to be identical today, but this one is "the module owner may
  // undo a destructive bulk action", which must not silently widen if the
  // operational write set ever grows.
  const ssdOnly = requireRole('SSD');
  // The single exception to "SDE never writes" — see PROSPECT_INTEREST_ROLES.
  const markInterest = requireRole(...PROSPECT_INTEREST_ROLES);

  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', write, controller.create);
  router.patch('/:id', write, controller.update);
  router.delete('/:id', write, controller.remove);

  router.post('/:id/suppliers', write, controller.addSupplier);      // form A — new supplier
  router.post('/:id/suppliers/link', write, controller.linkSupplier); // link existing supplier

  router.post('/:id/notes', noteWrite, controller.addNote);
  router.patch('/:id/notes/:noteId', noteWrite, controller.editNote);
  router.delete('/:id/notes/:noteId', noteWrite, controller.removeNote);

  // Pre-event prospects — imported from Excel, never written to T_Supplier.
  router.get('/:id/prospects', controller.listProspects);
  router.post('/:id/prospects/import', write, controller.importProspects);
  router.delete('/:id/prospects/import/:importBatchId', ssdOnly, controller.deleteImportBatch);
  router.post('/:id/prospects/:prospectId/interest', markInterest, controller.setInterest);
  router.delete('/:id/prospects/:prospectId/interest', markInterest, controller.unsetInterest);
  router.patch('/:id/prospects/:prospectId/b2b', ssdOnly, controller.setProspectB2b);

  return router;
}
