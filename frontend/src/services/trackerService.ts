import { apiGet, apiPatch, apiPost } from './api.config';
import { TERMINAL_STAGE_CONFIG, type StageConfigEntry } from '../constants/stage-config';
import type { IntelexPhase } from '../constants/intelex-levels';
import type { TrackerStage, TrackerSupplier, SubStatus } from '../types';

/**
 * Stage colours/icons for the whole app.
 *
 * The API describes the 5 working stages (the board columns); the two terminal
 * states are appended from `TERMINAL_STAGE_CONFIG` because the backend does not
 * serve them — see that constant for why.
 */
export async function getTrackerStageConfig(): Promise<StageConfigEntry[]> {
  const working = await apiGet<StageConfigEntry[]>('/tracker/stage-config');
  return [...working, ...TERMINAL_STAGE_CONFIG];
}

/** Board list: ACTIVE + COMPLETED, Direct material only (backend business rule). */
export function getTrackerSuppliers(stage?: TrackerStage): Promise<TrackerSupplier[]> {
  return apiGet(`/tracker/suppliers${stage ? `?stage=${encodeURIComponent(stage)}` : ''}`);
}

/**
 * Intelex Handoff suppliers of one phase — `monitoring` is L3+ (KPI achieved),
 * filtered by the backend from the live level. Still Intelex Handoff suppliers:
 * this is a view, not a stage.
 */
export function getIntelexPhaseSuppliers(phase: IntelexPhase): Promise<TrackerSupplier[]> {
  return apiGet(`/tracker/suppliers?stage=${encodeURIComponent('Intelex Handoff')}&phase=${phase}`);
}

export function getTrackerSupplier(id: string): Promise<TrackerSupplier> {
  return apiGet(`/tracker/suppliers/${id}`);
}

/**
 * `note` is mandatory — the backend rejects an empty/short/junk note with a 400
 * (same rule as supplier notes and rejection reasons).
 */
export function moveSupplierToStage(
  supplierId: string,
  newStage: TrackerStage,
  note: string,
): Promise<TrackerSupplier> {
  return apiPost(`/tracker/suppliers/${supplierId}/move`, { newStage, note });
}

/** Scouting Event only: Identified → B2B. */
export function promoteSupplierToB2B(supplierId: string): Promise<TrackerSupplier> {
  return apiPost(`/tracker/suppliers/${supplierId}/promote-b2b`, {});
}

/** The backend rejects an empty reason with a 400 — it is mandatory. */
export function blacklistSupplier(supplierId: string, reason: string): Promise<TrackerSupplier> {
  return apiPost(`/tracker/suppliers/${supplierId}/blacklist`, { reason });
}

/** Parking Lot sub-status. 'No Go' auto-blacklists and therefore needs a reason. */
export function setSupplierSubStatus(
  supplierId: string,
  subStatus: SubStatus,
  reason?: string,
): Promise<TrackerSupplier> {
  return apiPatch(`/tracker/suppliers/${supplierId}/substatus`, { subStatus, reason });
}
