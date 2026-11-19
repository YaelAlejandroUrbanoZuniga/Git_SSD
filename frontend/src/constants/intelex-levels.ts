import type { IntelexLevel } from '../types';
import { ACCENT_COLORS } from './designTokens';
import { STRATEGY_ACHIEVED_LEVEL } from '../utils/strategy-helpers';

/**
 * The Intelex Handoff sub-levels, in sequence order.
 *
 * Intelex Handoff is ONE stage (see `TRACKER_STAGE_CONFIG`) with a sub-status
 * inside it — never seven stages. This array is the display order every consumer
 * shares: the Reports matrix's `levelCounts` breakdown and the Level filter of
 * the Tracker stage screen. `Completed` is the level a supplier carries once it
 * leaves the handoff, so it is last and normally empty on the active board.
 */
export const INTELEX_LEVELS: IntelexLevel[] = [
  'Investigate', 'L0', 'L1', 'L2', 'L3', 'L4', 'Completed',
];

/** The six levels a supplier moves through while it is IN the handoff (no `Completed`). */
export const INTELEX_HANDOFF_LEVELS: IntelexLevel[] = ['Investigate', 'L0', 'L1', 'L2', 'L3', 'L4'];

/** The level whose Real date closes the handoff for good (the move to stage Completed). */
export const INTELEX_FINAL_LEVEL: IntelexLevel = 'L4';

/** Stage colour of Intelex Handoff — the accent for every level-scoped chrome. */
export const INTELEX_LEVEL_COLOR = ACCENT_COLORS.info;

// ── Phases inside Intelex Handoff ──────────────────────────────────────────
// The handoff levels split in two phases around the strategy KPI level
// (`STRATEGY_ACHIEVED_LEVEL`, L3 — reused, never redefined here):
//   • development — Investigate, L0, L1, L2;
//   • monitoring  — L3, L4: the KPI is met and the supplier is followed until L4.
// A supplier in monitoring still belongs to the Intelex Handoff STAGE — the phase
// is only a view, so stage counts never change because of it.
// Mirrors the backend's `domain/intelexLevels.ts` (separate deploys, no shared code).

export type IntelexPhase = 'development' | 'monitoring';

export const INTELEX_PHASE_LABELS: Record<IntelexPhase, string> = {
  development: 'Development',
  monitoring: 'KPI achieved – monitoring',
};

const KPI_LEVEL_INDEX = INTELEX_HANDOFF_LEVELS.indexOf(STRATEGY_ACHIEVED_LEVEL as IntelexLevel);

/** The phase a level belongs to, or null when it is outside the handoff sequence. */
export function intelexPhaseOf(level: string | null | undefined): IntelexPhase | null {
  const i = INTELEX_HANDOFF_LEVELS.indexOf(level as IntelexLevel);
  if (i < 0) return null;
  return i >= KPI_LEVEL_INDEX ? 'monitoring' : 'development';
}

/** True once the level is at or past the KPI level (L3+). */
export function isIntelexMonitoringLevel(level: string | null | undefined): boolean {
  return intelexPhaseOf(level) === 'monitoring';
}

/** The handoff levels of one phase, in sequence order. */
export function intelexLevelsOfPhase(phase: IntelexPhase): IntelexLevel[] {
  return INTELEX_HANDOFF_LEVELS.filter(level => intelexPhaseOf(level) === phase);
}
