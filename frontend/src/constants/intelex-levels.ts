import type { IntelexLevel } from '../types';
import { ACCENT_COLORS } from './designTokens';

/**
 * The Intelex Handoff sub-levels, in sequence order.
 *
 * Intelex Handoff is ONE stage (see `TRACKER_STAGE_CONFIG`) with a sub-status
 * inside it — never seven stages. This array is the display order every consumer
 * shares: the Reports matrix's `levelCounts` breakdown and the Tracker stage
 * screen's collapsible per-level groups. `Completed` is the level a supplier
 * carries once it leaves the handoff, so it is last and normally empty on the
 * active board.
 */
export const INTELEX_LEVELS: IntelexLevel[] = [
  'Investigate', 'L0', 'L1', 'L2', 'L3', 'L4', 'Completed',
];

/** Stage colour of Intelex Handoff — the accent for every level-scoped chrome. */
export const INTELEX_LEVEL_COLOR = ACCENT_COLORS.info;
