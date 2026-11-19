// Intelex Handoff sub-levels — the single definition of the level sequence and
// of what "the level a supplier had reached" means.
//
// Intelex Handoff is ONE tracker stage (see domain/constants.ts) with a sub-status
// inside it: Investigate → L0 → L1 → L2 → L3 → L4 (→ Completed, set only when the
// supplier leaves the stage — see trackerService). The sub-status is never stored
// per transition: the "Real" date of each level IS the historical record, so the
// level on any date is derived from those dates rather than read from a log.
//
// Two consumers share this module:
//   • suppliersService.updateSupplier — sequencing rule + the LIVE currentLevel it
//     persists on IntelexData (every Real that exists, regardless of date).
//   • reportsService.getStageSnapshot — the level a supplier had ON a past date
//     (only the Reals captured on/before that date count).

import { STRATEGY_ACHIEVED_LEVEL } from './strategyRules';

export type IntelexRealKey =
  | 'investigateReal' | 'l0Real' | 'l1Real' | 'l2Real' | 'l3Real' | 'l4Real';

/** The level before any Real is captured — also the DB default of `currentLevel`. */
export const INTELEX_BASE_LEVEL = 'Investigate';

/**
 * Level order. `realKey` is the IntelexData column holding that level's "Real"
 * date (post prefix-strip, i.e. the wire's `intelex_l0Real` → `l0Real`), `label`
 * is how the level is named in user-facing errors.
 */
export const INTELEX_LEVEL_SEQUENCE: { realKey: IntelexRealKey; label: string; level: string }[] = [
  { realKey: 'investigateReal', label: 'Investigate', level: 'Investigate' },
  { realKey: 'l0Real', label: 'L0', level: 'L0' },
  { realKey: 'l1Real', label: 'L1', level: 'L1' },
  { realKey: 'l2Real', label: 'L2', level: 'L2' },
  { realKey: 'l3Real', label: 'L3', level: 'L3' },
  { realKey: 'l4Real', label: 'L4', level: 'L4' },
];

/** The Real-date columns, for a Prisma `select`. */
export const INTELEX_REAL_SELECT = Object.fromEntries(
  INTELEX_LEVEL_SEQUENCE.map(l => [l.realKey, true]),
) as Record<IntelexRealKey, true>;

/** Just the Real dates — what every derivation here needs off an IntelexData row. */
export type IntelexRealDates = Partial<Record<IntelexRealKey, string | null>>;

/**
 * THE criterion, in one place: the furthest level such that it and every level
 * before it counts as reached. Stops at the first gap, so an out-of-order Real
 * (which the update path rejects anyway, but legacy/imported rows may carry)
 * never skips a level. `reached(i)` decides what "reached" means for the caller
 * — mere existence of the Real, or existence *on or before* a given date.
 */
export function deriveIntelexLevelBy(reached: (index: number) => boolean): string {
  let level = INTELEX_BASE_LEVEL;
  for (let i = 0; i < INTELEX_LEVEL_SEQUENCE.length; i++) {
    if (!reached(i)) break;
    level = INTELEX_LEVEL_SEQUENCE[i].level;
  }
  return level;
}

/**
 * The 'YYYY-MM-DD' day of a stored Real date, or null when it is absent or not a
 * date. The columns are NVarChar and the UI writes plain 'YYYY-MM-DD', but an ISO
 * instant would also arrive day-first — slicing keeps both comparable, and that
 * format sorts chronologically under plain string comparison (same convention as
 * the history `date` columns; see reportsService).
 */
function realDay(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * The Intelex sub-level the supplier had reached **as of `asOfDateISO`**: the
 * furthest level whose Real date (and every Real before it) is on or before that
 * day. `'Investigate'` when none is yet — including when the supplier has no
 * IntelexData row at all.
 *
 * This is what makes a PAST report show the level of that date instead of today's:
 * the live `currentLevel` column always reflects the present. Note it can never
 * return `'Completed'` — that value is set when the supplier leaves the stage, and
 * such suppliers are out of the snapshot (COMPLETED is not ACTIVE).
 */
export function deriveIntelexLevelAsOf(
  intelexData: IntelexRealDates | null | undefined,
  asOfDateISO: string,
): string {
  if (!intelexData) return INTELEX_BASE_LEVEL;
  return deriveIntelexLevelBy(i => {
    const day = realDay(intelexData[INTELEX_LEVEL_SEQUENCE[i].realKey]);
    return day !== null && day <= asOfDateISO;
  });
}

// ── Phases inside Intelex Handoff ──────────────────────────────────────────
// The six levels split in two phases around the strategy KPI level
// (`STRATEGY_ACHIEVED_LEVEL`, L3 — reused, never redefined here):
//   • development — Investigate, L0, L1, L2 (KPI not met yet);
//   • monitoring  — L3, L4 ("KPI achieved – monitoring"): the KPI is met, the
//     supplier is followed for about a year until L4 and stays editable.
// A supplier in monitoring is still in the Intelex Handoff STAGE — the phase is
// a view over `currentLevel`, never a stage of its own, so stage counts don't move.
// Mirrored in `frontend/src/constants/intelex-levels.ts`.

export type IntelexPhase = 'development' | 'monitoring';
export const INTELEX_PHASES: readonly IntelexPhase[] = ['development', 'monitoring'];

/** The level whose Real date closes the handoff for good (→ stage Completed). */
export const INTELEX_FINAL_LEVEL = INTELEX_LEVEL_SEQUENCE[INTELEX_LEVEL_SEQUENCE.length - 1];

/** Position of `level` in the sequence, or -1 for anything outside it ('Completed', legacy values). */
export function intelexLevelIndex(level: string | null | undefined): number {
  return INTELEX_LEVEL_SEQUENCE.findIndex(l => l.level === level);
}

const KPI_LEVEL_INDEX = intelexLevelIndex(STRATEGY_ACHIEVED_LEVEL);

/** The phase a level belongs to, or null when the level is outside the sequence. */
export function intelexPhaseOf(level: string | null | undefined): IntelexPhase | null {
  const i = intelexLevelIndex(level);
  if (i < 0) return null;
  return i >= KPI_LEVEL_INDEX ? 'monitoring' : 'development';
}

/** True once the level is at or past the KPI level (L3+): "KPI achieved – monitoring". */
export function isIntelexMonitoringLevel(level: string | null | undefined): boolean {
  return intelexPhaseOf(level) === 'monitoring';
}

/** The `currentLevel` values of each phase, for a Prisma `in` filter. */
export function intelexLevelsOfPhase(phase: IntelexPhase): string[] {
  return INTELEX_LEVEL_SEQUENCE.map(l => l.level).filter(level => intelexPhaseOf(level) === phase);
}

/** True when the given level's Real date is captured (a real 'YYYY-MM-DD' day). */
export function hasIntelexReal(
  intelexData: IntelexRealDates | null | undefined,
  realKey: IntelexRealKey,
): boolean {
  return realDay(intelexData?.[realKey]) !== null;
}
