import type { CSSProperties } from 'react';

/**
 * The panel skeleton every centered modal (§6.6) shares — white surface, 12px
 * radius, the standard elevation shadow and 28×32 padding. Kept in one place so
 * a modal never re-declares it inline.
 */
export const MODAL_PANEL_BASE: CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
  padding: '28px 32px',
};

/**
 * The shared panel skeleton plus a 4px top accent stripe in `accentColor`,
 * reflecting the screen/stage the modal belongs to. The stripe is a top border,
 * so it follows the panel's 12px radius and only its top corners are rounded.
 *
 * Callers spread their own per-modal props (width, position, maxHeight…) after
 * the return value, e.g. `style={{ ...modalPanelStyle(color), width: 560 }}`.
 */
export function modalPanelStyle(accentColor: string): CSSProperties {
  return {
    ...MODAL_PANEL_BASE,
    borderTop: `4px solid ${accentColor}`,
  };
}
