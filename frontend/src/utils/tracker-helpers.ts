import type { TrackerSupplier, SLAStatus } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';

export function getStageColor(name: string): string {
  return TRACKER_STAGE_CONFIG.find(s => s.name === name)?.color ?? '#808285';
}

// ── SLA presentation ────────────────────────────────────────────────────
// The SLA state itself is derived and persisted by the backend (see
// backend/src/domain/sla.ts) and arrives on `supplier.sla` / `supplier.globalSla`.
// The frontend only renders it: never re-derive a colour from a day count here,
// or the two will disagree the moment the thresholds change.

export const slaColors: Record<SLAStatus, string> = {
  green: '#6ABF4B',
  yellow: '#D4A017',
  red: '#DC0202',
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
  return '#DC0202';
}

export function getInfoCompletionPercent(supplier: TrackerSupplier): number {
  const stage = supplier.stage;

  if (stage === 'Scouting Event') {
    const t = supplier.scoutingTabsCompleted;
    if (!t) return 0;
    const total = 5;
    const done = [t.scoutingEvent, t.supplierInfo, t.attendees, t.agenda, t.nextStep].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Parking Lot') {
    const t = supplier.parkingTabsCompleted;
    if (!t) return 0;
    const total = 3;
    const done = [t.overview, t.contact, t.details].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Preliminary Evaluation') {
    const t = supplier.preliminaryTabsCompleted;
    if (!t) return 0;
    const total = 2;
    const done = [t.overview, t.capabilities].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Supplier Evaluation') {
    const t = supplier.supplierEvalTabsCompleted;
    if (!t) return 0;
    // Visit is the third tab of this stage (moved here from Preliminary).
    const total = 3;
    const done = [t.competitiveness, t.fundamentals, t.visit].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Intelex Handoff') return 100;

  return 0;
}
