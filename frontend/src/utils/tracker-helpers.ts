import type { TrackerSupplier, TrackerStage, SLAStatus } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';
import { BRAND_COLORS } from '../constants/designTokens';

export function getStageColor(name: string): string {
  return TRACKER_STAGE_CONFIG.find(s => s.name === name)?.color ?? BRAND_COLORS.sidebar;
}

/** The 5 working stages a supplier moves through on the board, in order. */
const WORKING_STAGE_ORDER: TrackerStage[] = TRACKER_STAGE_CONFIG
  .filter(s => s.name !== 'Blacklisted' && s.name !== 'Completed')
  .map(s => s.name as TrackerStage);

/**
 * Position of `stage` among the 5 working stages (Scouting Event = 0 …
 * Intelex Handoff = 4), or -1 for a non-working stage (`Completed`,
 * `Blacklisted`). Mirrors the ordering `stageIndex` enforces server-side in
 * `backend/src/domain/constants.ts` (backward stage moves are rejected there);
 * this copy exists because the frontend cannot import backend domain code.
 */
export function stageIndex(stage: string): number {
  return WORKING_STAGE_ORDER.indexOf(stage as TrackerStage);
}

// ── SLA presentation ────────────────────────────────────────────────────
// The SLA state itself is derived and persisted by the backend (see
// backend/src/domain/sla.ts) and arrives on `supplier.sla` / `supplier.globalSla`.
// The frontend only renders it: never re-derive a colour from a day count here,
// or the two will disagree the moment the thresholds change.

export const slaColors: Record<SLAStatus, string> = {
  green: '#6ABF4B',
  yellow: '#D4A017',
  red: BRAND_COLORS.accentRed,
};

/** Plain-language meaning of each SLA state (time-in-stage, not data completeness). */
export const slaLabels: Record<SLAStatus, string> = {
  green: 'On track',
  yellow: 'At risk',
  red: 'Overdue',
};

/**
 * Denominator for the progress bars, in days — a full bar means "at the red
 * threshold". Display scale only: it mirrors the backend's red thresholds so the
 * bar and the colour tell the same story, but it decides nothing.
 */
export const slaBarScaleDays = {
  'Parking Lot': 30,
  'Preliminary Evaluation': 60,
  global: 90,
} as const;

export function getDocsBarColor(percent: number): string {
  if (percent >= 75) return '#6ABF4B';
  if (percent >= 50) return '#D4A017';
  return BRAND_COLORS.accentRed;
}

// ── Information completeness ────────────────────────────────────────────
// The percentage on every tracker card answers "how much of this supplier's
// data is captured for the stage it is in right now".
//
// It used to count completed *tabs*, which measured the wrong thing: marking a
// tab complete is a click, not data, so a supplier could read 100% with almost
// every field still empty (the case GSM reported: 100% with only the NDA set).
// It now counts **filled fields**, so the number can only move when real data
// is entered.
//
// The lists below are the fields each stage's own tabs display, transcribed
// from the read-only tab components in
// `pages/tracker/read-only-tabs.tsx` — those components are the
// authoritative enumeration of what a stage holds. Keep them in sync: adding a
// field to a tab means adding its key here, or the denominator silently lies.
// Nothing is listed that no tab shows.
//
// Deliberately excluded from every list:
//   - **Derived values** a tab renders but nobody types — Intelex Record's
//     "Days from Pre-eval" and the whole Intelex Efficiency tab (computed from
//     the Timeline dates), and `intelex_currentLevel` (server-derived, and
//     never null, so it would inflate every Intelex supplier's score).
//   - **Tab-completion booleans** — that is exactly the signal this function
//     stopped trusting.
//
// These are display fields, not a validation contract: listing a field here
// does **not** make it required to save a tab or to advance a stage. Whether
// any of them become mandatory is a separate, still-open decision.

/** Scouting Event — Scouting Event, Supplier Info, Attendees, Agenda, Next Step. */
export const SCOUTING_EVENT_FIELDS: readonly (keyof TrackerSupplier)[] = [
  // Scouting Event tab
  'scoutingInput', 'buyer', 'name', 'commodity', 'country', 'productType',
  // Supplier Info tab
  'manufacturingAddress', 'dunsNumber', 'website', 'contactEmail', 'phone', 'certifications',
  // Attendees tab
  'b2bStatus', 'b2bWhoAttends', 'b2bManager', 'b2bBuyer', 'b2bComments',
  // Agenda tab
  'agendaStatus', 'agendaScheduledDate', 'agendaStartTime', 'agendaEndTime',
  'agendaDuration', 'agendaTimezone', 'agendaStand', 'agendaTeamsLink',
  // Next Step tab
  'selectedForParking', 'selectionReason',
];

/** Parking Lot — Overview, Contact, Details. */
export const PARKING_LOT_FIELDS: readonly (keyof TrackerSupplier)[] = [
  // Overview tab
  'parkingOnboardingDate', 'parkingSubStatus', 'parkingScoutingInput', 'parkingBuyer',
  'parkingCommodity', 'parkingProductType', 'parkingB2BMeeting',
  'parkingDateToMovePreliminary', 'parkingAdditionalComments',
  // Contact tab
  'parkingName1', 'parkingWebsite', 'parkingEmail1', 'parkingPhone',
  // Details tab
  'parkingManufacturingCountry', 'parkingManufacturingAddress', 'parkingCompanyName',
];

/** Preliminary Evaluation — Overview, Capabilities (Visit moved to Supplier Evaluation). */
export const PRELIMINARY_EVALUATION_FIELDS: readonly (keyof TrackerSupplier)[] = [
  // Overview tab
  'prelim_startDate', 'prelim_priority', 'prelim_scoutingInput', 'prelim_buyer',
  'prelim_commodity', 'prelim_primaryDriver', 'prelim_companyName', 'prelim_dunsNumber',
  'prelim_hqAddress', 'prelim_hqCity', 'prelim_hqCountry',
  'prelim_manufacturingAddress', 'prelim_manufacturingCity', 'prelim_manufacturingCountry',
  'prelim_companyType', 'prelim_foundedYear', 'prelim_footprint', 'prelim_yearsInMexico',
  'prelim_facilities', 'prelim_employees', 'prelim_annualRevenue', 'prelim_mainTechnology',
  'prelim_certifications', 'prelim_hasIMMEX', 'prelim_planToGetIMMEX',
  // Capabilities tab
  'prelim_machineryType', 'prelim_processingMethod', 'prelim_complementaryOps',
  'prelim_toolingDesign', 'prelim_materials', 'prelim_rawMaterialIndex', 'prelim_applications',
];

/**
 * Supplier Evaluation — Competitiveness, Fundamentals, Visit.
 *
 * `prelim_parts` is the whole Competitiveness tab in one key: it is a repeatable
 * list, so it counts as one filled field once it holds at least one part, rather
 * than as twelve per-part columns that would swamp the other two tabs.
 *
 * The Visit fields keep their `prelim_` prefix because those columns stayed in
 * `PreliminaryData` when the tab moved here — see the frontend README.
 */
export const SUPPLIER_EVALUATION_FIELDS: readonly (keyof TrackerSupplier)[] = [
  // Competitiveness tab
  'prelim_parts',
  // Fundamentals tab
  'prelim_rfqReceived', 'prelim_ndaSigned', 'prelim_tcsSigned', 'prelim_ttcsSigned',
  'prelim_nsrSigned', 'prelim_sdaSigned', 'prelim_costModel',
  // Visit tab
  'prelim_visitDatePlanned', 'prelim_visitDateCompleted', 'prelim_visitParticipants',
  'prelim_strengths', 'prelim_weaknesses', 'prelim_observations', 'prelim_recommendations',
];

/**
 * Intelex Handoff — Record, Timeline. The Efficiency tab contributes nothing:
 * every bar on it is computed from the Timeline dates already counted here.
 */
export const INTELEX_HANDOFF_FIELDS: readonly (keyof TrackerSupplier)[] = [
  // Record tab ("Days from Pre-eval" is derived, so it is not a field)
  'intelex_recordCreationDate', 'intelex_investigateRecordNumber',
  // Timeline tab — Expected / Real per level
  'intelex_investigateExpected', 'intelex_investigateReal',
  'intelex_l0Expected', 'intelex_l0Real',
  'intelex_l1Expected', 'intelex_l1Real',
  'intelex_l2Expected', 'intelex_l2Real',
  'intelex_l3Expected', 'intelex_l3Real',
  'intelex_l4Expected', 'intelex_l4Real',
];

/**
 * The one field list per stage. `Completed` has no entry on purpose — see the
 * note on terminal suppliers in `getInfoCompletionPercent`.
 */
const STAGE_FIELDS: Partial<Record<TrackerStage, readonly (keyof TrackerSupplier)[]>> = {
  'Scouting Event': SCOUTING_EVENT_FIELDS,
  'Parking Lot': PARKING_LOT_FIELDS,
  'Preliminary Evaluation': PRELIMINARY_EVALUATION_FIELDS,
  'Supplier Evaluation': SUPPLIER_EVALUATION_FIELDS,
  'Intelex Handoff': INTELEX_HANDOFF_FIELDS,
};

/**
 * Whether a field counts towards the percentage. `false` and `0` are real
 * answers a user gave, so they count as filled; only null/undefined, a blank or
 * whitespace-only string, and an empty list count as missing.
 */
function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Percentage (0–100) of the current stage's fields that carry a value.
 *
 * Scoped to the current stage only, which is what makes the number restart on
 * its own when a supplier advances: the new stage's fields are simply a
 * different denominator. A stage nothing prefilled starts at 0%; one entered
 * through a prefill modal or a registration form starts at whatever those
 * populated. There is deliberately **no** explicit reset step.
 *
 * **Terminal suppliers.** A blacklisted supplier already arrives carrying the
 * stage it was rejected from (the backend mapper substitutes `stageBeforeExit`
 * into `stage` for those rows), so it scores against that stage's fields like
 * any other supplier. A completed one reports `stage: 'Completed'`, and the
 * pre-exit stage is not on the wire at all — nothing sensible can be counted,
 * so it returns 0 rather than inventing a denominator.
 */
export function getInfoCompletionPercent(supplier: TrackerSupplier): number {
  const fields = STAGE_FIELDS[supplier.stage];
  if (!fields || fields.length === 0) return 0;

  const filled = fields.filter(key => isFilled(supplier[key])).length;
  return Math.round((filled / fields.length) * 100);
}
