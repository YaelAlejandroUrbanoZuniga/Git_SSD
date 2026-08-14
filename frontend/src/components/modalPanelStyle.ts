import type { CSSProperties } from 'react';
import { BRAND_COLORS } from '../constants/designTokens';

/**
 * The panel skeleton every centred modal (§6.6) shares — white surface, 12px
 * radius, the standard elevation shadow. `overflow: hidden` clips the coloured
 * `ModalHeader` band so its square bottom edge never pokes past the panel's
 * rounded corners.
 *
 * The body padding is **not** here — it belongs to a wrapper below the header
 * (see `MODAL_BODY_PADDING`) so the header band can span the full panel width.
 * Callers spread their own per-modal props after the base, e.g.
 * `style={{ ...MODAL_PANEL_BASE, width: 560 }}`.
 */
export const MODAL_PANEL_BASE: CSSProperties = {
  backgroundColor: BRAND_COLORS.cards,
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
  overflow: 'hidden',
};

/** Padding for a modal's body content, applied to a wrapper below the header band. */
export const MODAL_BODY_PADDING = '28px 32px';
