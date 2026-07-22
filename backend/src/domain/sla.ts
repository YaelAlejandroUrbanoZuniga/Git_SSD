// Pure SLA-colour functions of days-in-stage (and days-since-Parking-Lot for the
// global cycle). No DB access here; persistence lives in services/slaService.ts.

import type { SlaValue } from './constants';

interface Thresholds {
  /** days >= this ⇒ 'yellow' */
  yellow: number;
  /** days >= this ⇒ 'red' */
  red: number;
}

// Per-stage day limits — only business-confirmed stages. Scouting Event,
// Supplier Evaluation and Intelex Handoff have no agreed limit (no auto colour).
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

/** Whole days since an ISO date, floored at 0; null if absent/unparseable (⇒ use fallback). */
export function daysSince(dateISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateISO) return null;
  const then = new Date(dateISO).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY));
}

/** Stage colour from days-in-stage; null ⇒ no confirmed threshold (keep current value). */
export function slaForStage(stage: string, daysInStage: number): SlaValue | null {
  const t = STAGE_THRESHOLDS[stage];
  return t ? colorFor(daysInStage, t) : null;
}

/** Full-cycle colour; null ⇒ cycle never started (pre-Parking Lot) ⇒ null FK_GlobalSla. */
export function globalSlaForDays(daysSinceParkingLot: number | null | undefined): SlaValue | null {
  return daysSinceParkingLot == null ? null : colorFor(daysSinceParkingLot, GLOBAL_THRESHOLDS);
}

/** Everything the SLA depends on, read off a supplier row. */
interface SlaSource {
  stage: string;
  /** ParkingData.onboardingDate — when the Parking Lot / global clock started. */
  parkingOnboardingDate?: string | null;
  /** PreliminaryData.startDate — when the Preliminary Evaluation clock started. */
  preliminaryStartDate?: string | null;
  /** Stored counters. Only used when the matching anchor date is missing. */
  daysInStage: number;
  daysSinceParkingLot: number | null;
}

interface SlaResolution {
  /** Null ⇒ stage has no threshold; keep the supplier's current colour. */
  sla: SlaValue | null;
  globalSla: SlaValue | null;
  daysSinceParkingLot: number | null;
}

/**
 * Derives both colours for one supplier. Days count from the stage anchor date
 * when present (colour advances with the calendar, no write needed); the stored
 * counters are a frozen fallback for rows seeded without an anchor (README §5).
 */
export function resolveSla(src: SlaSource, now: Date = new Date()): SlaResolution {
  const anchor =
    src.stage === 'Parking Lot' ? src.parkingOnboardingDate
    : src.stage === 'Preliminary Evaluation' ? src.preliminaryStartDate
    : null;
  const daysInStage = daysSince(anchor, now) ?? src.daysInStage;
  // Global clock always anchors on the parking date — it runs from Parking Lot on.
  const daysSinceParkingLot = daysSince(src.parkingOnboardingDate, now) ?? src.daysSinceParkingLot;

  return {
    sla: slaForStage(src.stage, daysInStage),
    globalSla: globalSlaForDays(daysSinceParkingLot),
    daysSinceParkingLot,
  };
}
