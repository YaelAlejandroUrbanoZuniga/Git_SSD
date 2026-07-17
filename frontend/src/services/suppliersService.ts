import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type {
  BlacklistedSupplier, CompletedSupplier, PipelineSupplier, SupplierNote,
} from '../types';

export function getSuppliers(): Promise<(PipelineSupplier | BlacklistedSupplier)[]> {
  return apiGet('/suppliers');
}

export function getTrackerSuppliers(): Promise<PipelineSupplier[]> {
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
): Promise<PipelineSupplier | BlacklistedSupplier | undefined> {
  return apiGet<PipelineSupplier | BlacklistedSupplier>(`/suppliers/${id}`).catch(err => {
    // A missing supplier is an answer, not a failure — callers render their
    // own "not found" state rather than an error toast.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  });
}

/**
 * The fields `POST /api/suppliers` accepts (the backend's `createSchema`).
 *
 * Anything outside this list is dropped silently by zod, so the registration
 * forms must send the rest through `updateSupplier` — see `registerSupplier`.
 */
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

export function createSupplier(input: CreateSupplierInput): Promise<PipelineSupplier> {
  return apiPost('/suppliers', input);
}

export function updateSupplier(
  id: string,
  patch: Record<string, unknown>,
): Promise<PipelineSupplier> {
  return apiPatch(`/suppliers/${id}`, patch);
}

/** Hard delete — the backend allows it only while the supplier is in Scouting Event. */
export function deleteSupplier(id: string): Promise<void> {
  return apiDelete(`/suppliers/${id}`);
}

/**
 * Registers a supplier from form A or form B.
 *
 * Two requests, because the write surface is split: `POST /suppliers` takes the
 * core row and is the only thing that can set `entrySource` (which decides the
 * starting stage), while the extended technical/commercial profile has to go
 * through `PATCH /suppliers/:id` — that's what knows how to route each flat
 * field to its satellite table.
 */
export async function registerSupplier(
  core: CreateSupplierInput,
  profile: Record<string, unknown> = {},
): Promise<PipelineSupplier> {
  const created = await createSupplier(core);
  if (Object.keys(profile).length === 0) return created;

  try {
    return await updateSupplier(created.id, profile);
  } catch (err) {
    // The POST already succeeded, so the supplier exists with its core data.
    // Say so explicitly, or the user retries and creates a duplicate.
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
