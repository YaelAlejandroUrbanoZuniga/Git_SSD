import type { StrategyEntry } from '../types';

// Shared by StrategyPage (the per-commodity table and its drilldown) and
// Dashboard ("Strategy: Need vs. Achieved by Commodity"), so the two pages
// can never disagree on what a commodity's 2026 need or "achieved" count is.

/** A commodity's 2026 strategy need, or 0 when it has no entry yet. */
export function strategyNeed2026(entry: StrategyEntry | undefined): number {
  return entry?.strategyNeeds['2026'] ?? 0;
}

/**
 * A supplier counts as "achieved" once it has reached Completed, or Intelex
 * Handoff with a real L2 date recorded — Intelex Handoff alone isn't enough,
 * since the L2 review is what actually closes the strategy need out.
 */
export function isAchievedSupplier(stage: string, intelexL2Real: string | null): boolean {
  return stage === 'Completed' || (stage === 'Intelex Handoff' && intelexL2Real !== null);
}
