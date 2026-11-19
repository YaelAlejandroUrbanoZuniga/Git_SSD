// The strategy "achieved" criterion — shared by `strategyService.getStrategyOverview`
// (the commodity overview) and its drilldown. Kept beside `intelexLevels.ts`
// since it reads one of that module's Real-date levels.
//
// Mirrors `frontend/src/utils/strategy-helpers.ts` — the frontend cannot import
// this file (separate deploys), so the rule is duplicated there, not shared.

/**
 * THE level a supplier must close in Intelex to count as "achieved" against a
 * commodity's strategy need — the single point to change if the business
 * criterion moves to another level (today L3: L4 takes roughly a year and
 * isn't expected).
 */
export const STRATEGY_ACHIEVED_LEVEL = 'L3';

/**
 * A supplier counts as "achieved" once it has reached Completed, or Intelex
 * Handoff with a real `STRATEGY_ACHIEVED_LEVEL` (L3) date recorded — Intelex
 * Handoff alone isn't enough, and neither is an earlier level's Real date.
 */
export function isAchievedSupplier(stage: string, intelexL3Real: string | null | undefined): boolean {
  return stage === 'Completed' || (stage === 'Intelex Handoff' && intelexL3Real != null);
}
