import type { StrategyEntry } from '../types';
import { BRAND_COLORS } from '../constants/designTokens';

// Shared by StrategyPage (the per-commodity table and its drilldown) and
// Dashboard ("Strategy: Need vs. Achieved by Commodity"), so the two pages
// can never disagree on what a commodity's need, progress or remaining gap is.

/** A commodity's 2026 strategy need, or 0 when it has no entry yet. */
export function strategyNeed2026(entry: StrategyEntry | undefined): number {
  return entry?.strategyNeeds['2026'] ?? 0;
}

/** A commodity's 2027 strategy need, or null while that year is still undefined. */
export function strategyNeed2027(entry: StrategyEntry | undefined): number | null {
  return entry?.strategyNeeds['2027'] ?? null;
}

/**
 * A supplier counts as "achieved" once it has reached Completed, or Intelex
 * Handoff with a real L2 date recorded — Intelex Handoff alone isn't enough,
 * since the L2 review is what actually closes the strategy need out.
 */
export function isAchievedSupplier(stage: string, intelexL2Real: string | null): boolean {
  return stage === 'Completed' || (stage === 'Intelex Handoff' && intelexL2Real !== null);
}

// Progress against a need is measured with `total`: every supplier currently in
// the pipeline for the commodity, at any stage — tracker + completed, never
// blacklisted. `isAchievedSupplier` is only a secondary "fully closed" count
// now: so few suppliers reach it yet that measuring against it left almost
// every bar empty.

/**
 * Suppliers still missing to meet `need`, given `total` in the pipeline; 0
 * once it is met or exceeded, and when there is no need at all. Both pages
 * render 0 as a blank cell — never a "0" badge — so a met need reads as
 * "nothing left", not as a figure.
 */
export function remainingNeed(need: number, total: number): number {
  return need > 0 ? Math.max(0, need - total) : 0;
}

/** How much of a need is fulfilled: under 70%, 70–99%, or 100% and over. */
export type NeedBand = 'behind' | 'close' | 'met';

/** Lower bound of the 'close' band, as a share of the need. */
export const NEED_CLOSE_THRESHOLD = 0.7;

/** Red / amber / green — the same three colours Strategy uses for need progress. */
export const NEED_BAND_COLORS: Record<NeedBand, string> = {
  behind: BRAND_COLORS.accentRed,
  close: '#D4A017',
  met: '#6ABF4B',
};

/** The band `total` (suppliers in the pipeline) falls in, or null when there is no need to measure against. */
export function needBand(need: number, total: number): NeedBand | null {
  if (need <= 0) return null;
  const ratio = total / need;
  return ratio >= 1 ? 'met' : ratio >= NEED_CLOSE_THRESHOLD ? 'close' : 'behind';
}
