/**
 * Central design tokens — colour palette.
 *
 * This is the single source of truth for the brand/layout colours and the
 * most-repeated neutral greys. It exists because colours were previously
 * inlined as hex literals in every `style={{}}`, so the same colour drifted
 * slightly (or a banned one crept in) with no single place to fix it.
 *
 * Stage colours (Scouting Event, Parking Lot, etc.) are NOT duplicated here —
 * `constants/stage-config.ts` is their natural home since they're paired with
 * icons and stage names there, and `TRACKER_STAGE_CONFIG` is re-exported below
 * so callers only need to import from one place if they want both groups.
 *
 * `#6366F1` (indigo) is intentionally absent — it is banned by the project's
 * visual standard (see `Componentes_UI_Nexteer_v5`) and every former use has
 * been replaced with a colour from this file.
 */

export { TRACKER_STAGE_CONFIG, TERMINAL_STAGE_CONFIG } from './stage-config';

/** Brand / layout colours — used across the app shell and as action accents. */
export const BRAND_COLORS = {
  header: '#AA0202',
  sidebar: '#808285',
  background: '#EEEEEE',
  cards: '#FFFFFF',
  accentRed: '#DC0202',
  userBlock: '#6B7280',
} as const;

/**
 * Neutral greys, ranked by current usage across `frontend/src` (via grep on
 * hex literals). Only the greys that already recur heavily are listed here —
 * this is not a full grey scale, since the project doesn't use one.
 */
export const NEUTRAL_COLORS = {
  border: '#D1D3D4',
  borderLight: '#E0E0E0',
  panelBg: '#F7F7F7',
  textDark: '#333333',
} as const;

/**
 * Secondary accents pulled from the stage palette, reused where a non-stage
 * UI element needs a blue/purple accent (e.g. MRL/Strategy headers, role
 * badges) instead of inventing a new colour outside the approved palette.
 */
export const ACCENT_COLORS = {
  info: '#0084C0',
  purple: '#C026D3',
} as const;
