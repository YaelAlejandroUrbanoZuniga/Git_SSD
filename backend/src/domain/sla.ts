// SLA colour is derived, never authored: it is a pure function of how long a
// supplier has been sitting in its current stage, and — for the global cycle —
// of how long it has been in the tracker since it entered Parking Lot.
// Nothing here touches the database; see services/slaService.ts for persistence.

import type { SlaValue } from './constants';

interface Thresholds {
  /** days >= this ⇒ 'yellow' */
  yellow: number;
  /** days >= this ⇒ 'red' */
  red: number;
}

/**
 * Per-stage day limits. Only the stages whose limits the business has confirmed
 * appear here — 'Scouting Event', 'Supplier Evaluation' and 'Intelex Handoff'
 * have no agreed limit yet, so they get no automatic colour and keep whatever
 * they already had. Do not invent thresholds for them.
 */
const STAGE_THRESHOLDS: Record<string, Thresholds> = {
  'Parking Lot': { yellow: 25, red: 30 },
  'Preliminary Evaluation': { yellow: 50, red: 60 },
};

/** Full-cycle limit, counted from the day the supplier entered Parking Lot. */
const GLOBAL_THRESHOLDS: Thresholds = { yellow: 75, red: 90 };

const MS_PER_DAY = 86_400_000;

function colorFor(days: number, t: Thresholds): SlaValue {
  if (days >= t.red) return 'red';
  if (days >= t.yellow) return 'yellow';
  return 'green';
}

/**
 * Whole days elapsed since an ISO date, floored at 0. Null when the date is
 * absent or unparseable, which callers read as "no anchor, use the fallback".
 */
export function daysSince(dateISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateISO) return null;
  const then = new Date(dateISO).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY));
}

/**
 * Stage colour from the days spent in that stage. Null ⇒ the stage has no
 * confirmed threshold, so the caller must keep the supplier's current value.
 */
export function slaForStage(stage: string, daysInStage: number): SlaValue | null {
  const t = STAGE_THRESHOLDS[stage];
  return t ? colorFor(daysInStage, t) : null;
}

/**
 * Full-cycle colour. Null ⇒ the cycle never started (the supplier has not
 * reached Parking Lot), which maps to a null FK_GlobalSla.
 */
export function globalSlaForDays(daysSinceParkingLot: number | null | undefined): SlaValue | null {
  return daysSinceParkingLot == null ? null : colorFor(daysSinceParkingLot, GLOBAL_THRESHOLDS);
}

/** Everything the SLA depends on, read off a supplier row. */
export interface SlaSource {
  stage: string;
  /** ParkingData.onboardingDate — when the Parking Lot / global clock started. */
  parkingOnboardingDate?: string | null;
  /** PreliminaryData.startDate — when the Preliminary Evaluation clock started. */
  preliminaryStartDate?: string | null;
  /** Stored counters. Only used when the matching anchor date is missing. */
  daysInStage: number;
  daysSinceParkingLot: number | null;
}

export interface SlaResolution {
  /** Null ⇒ stage has no threshold; keep the supplier's current colour. */
  sla: SlaValue | null;
  globalSla: SlaValue | null;
  daysSinceParkingLot: number | null;
}

/**
 * Derives both colours for one supplier.
 *
 * Days are counted from the stage's anchor date whenever there is one, so the
 * colour advances with the calendar without anything having to write to the
 * row. The stored counters are a fallback only: they are frozen at whatever the
 * last write left behind (nothing recomputes them — see README §5), so rows
 * seeded without an anchor keep a static colour rather than a wrong one.
 */
export function resolveSla(src: SlaSource, now: Date = new Date()): SlaResolution {
  const anchor =
    src.stage === 'Parking Lot' ? src.parkingOnboardingDate
    : src.stage === 'Preliminary Evaluation' ? src.preliminaryStartDate
    : null;
  const daysInStage = daysSince(anchor, now) ?? src.daysInStage;
  // The global clock starts in Parking Lot and keeps running through the later
  // stages, so it always anchors on the parking date regardless of stage.
  const daysSinceParkingLot = daysSince(src.parkingOnboardingDate, now) ?? src.daysSinceParkingLot;

  return {
    sla: slaForStage(src.stage, daysInStage),
    globalSla: globalSlaForDays(daysSinceParkingLot),
    daysSinceParkingLot,
  };
}
