import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import { addSupplierToEvent } from './eventsService';
import type {
  BlacklistedSupplier, CompletedSupplier, TrackerSupplier, SupplierNote,
} from '../types';

export function getSuppliers(): Promise<(TrackerSupplier | BlacklistedSupplier)[]> {
  return apiGet('/suppliers');
}

export function getTrackerSuppliers(): Promise<TrackerSupplier[]> {
  return apiGet('/suppliers/tracker');
}

export function getBlacklistedSuppliers(): Promise<BlacklistedSupplier[]> {
  return apiGet('/suppliers/blacklisted');
}

export function getCompletedSuppliers(): Promise<CompletedSupplier[]> {
  return apiGet('/suppliers/completed');
}

export function getSupplierById(
  id: string,
): Promise<TrackerSupplier | BlacklistedSupplier | undefined> {
  return apiGet<TrackerSupplier | BlacklistedSupplier>(`/suppliers/${id}`).catch(err => {
    // A missing supplier is an answer, not a failure — callers render their
    // own "not found" state rather than an error toast.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  });
}

/** Fields `POST /api/suppliers` accepts (backend `createSchema`); the rest goes via `updateSupplier`. */
export interface CreateSupplierInput {
  name: string;
  commodity: string;
  entrySource: 'Scouting Event' | 'Recommendation';
  productCategory?: 'Direct' | 'Indirect';
  productType?: string;
  country?: string;
  manufacturingAddress?: string;
  buyer?: string;
  scoutingInput?: string;
  recommendedBy?: string;
  recommenderDept?: string;
  fullName?: string;
  dunsNumber?: string;
  website?: string;
  phone?: string;
  contactEmail?: string;
  contactName?: string;
}

export function createSupplier(input: CreateSupplierInput): Promise<TrackerSupplier> {
  return apiPost('/suppliers', input);
}

export function updateSupplier(
  id: string,
  patch: Record<string, unknown>,
): Promise<TrackerSupplier> {
  return apiPatch(`/suppliers/${id}`, patch);
}

/** Hard delete — the backend allows it only while the supplier is in Scouting Event. */
export function deleteSupplier(id: string): Promise<void> {
  return apiDelete(`/suppliers/${id}`);
}

/**
 * Registers a supplier from form A or B in two requests: `POST /suppliers` sets
 * the core row + `entrySource` (which decides the stage), then `PATCH /suppliers/:id`
 * routes the extended profile to its satellite tables.
 */
export async function registerSupplier(
  core: CreateSupplierInput,
  profile: Record<string, unknown> = {},
): Promise<TrackerSupplier> {
  const created = await createSupplier(core);
  if (Object.keys(profile).length === 0) return created;

  try {
    return await updateSupplier(created.id, profile);
  } catch (err) {
    // POST already succeeded — say so, or the user retries and duplicates.
    const detail = err instanceof ApiError ? err.message : String(err);
    throw new ApiError(
      `${created.folio} was created, but its extended profile could not be saved (${detail}). `
      + 'Open the supplier and complete the remaining fields from its detail page.',
      err instanceof ApiError ? err.status : 500,
      'PROFILE_PATCH_FAILED',
    );
  }
}

/**
 * Registers a supplier *from a scouting event*, in the same two-step pattern as
 * `registerSupplier` but through `POST /events/:eventId/suppliers` — which creates
 * the supplier AND its `T_Event_SupplierEntry` link atomically, so the supplier
 * shows up under the event's "Registered suppliers". The backend derives both
 * `entrySource` and `scoutingInput` from the event record, so they are not sent.
 */
export async function registerSupplierForEvent(
  eventId: string,
  core: Omit<CreateSupplierInput, 'entrySource' | 'scoutingInput'>,
  profile: Record<string, unknown> = {},
): Promise<TrackerSupplier> {
  const created = await addSupplierToEvent(eventId, core);
  if (Object.keys(profile).length === 0) return created;

  try {
    return await updateSupplier(created.id, profile);
  } catch (err) {
    // POST already succeeded — say so, or the user retries and duplicates.
    const detail = err instanceof ApiError ? err.message : String(err);
    throw new ApiError(
      `${created.folio} was created, but its extended profile could not be saved (${detail}). `
      + 'Open the supplier and complete the remaining fields from its detail page.',
      err instanceof ApiError ? err.status : 500,
      'PROFILE_PATCH_FAILED',
    );
  }
}

// ── Notes (stage-tagged; only the author may edit/delete) ────────────────

export function addSupplierNote(supplierId: string, text: string): Promise<SupplierNote> {
  return apiPost(`/suppliers/${supplierId}/notes`, { text });
}

export function editSupplierNote(
  supplierId: string, noteId: string, text: string,
): Promise<SupplierNote> {
  return apiPatch(`/suppliers/${supplierId}/notes/${noteId}`, { text });
}

export function deleteSupplierNote(supplierId: string, noteId: string): Promise<void> {
  return apiDelete(`/suppliers/${supplierId}/notes/${noteId}`);
}
