import type { CSSProperties } from 'react';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

/** Matches the input styling used across the supplier/event forms. */
const SELECT_STYLE: CSSProperties = {
  width: '100%', padding: '8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: BRAND_COLORS.cards,
};

/**
 * <select> whose options come from a C_* catalog.
 *
 * A stored value outside the catalog (older demo records) is preserved as an
 * extra option, so opening a record never silently drops what it already had.
 */
export function CatalogSelect({
  value, onChange, options, placeholder = 'Select', style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  style?: CSSProperties;
}) {
  const isKnown = value === '' || options.includes(value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...SELECT_STYLE, ...style }}>
      <option value="">{placeholder}</option>
      {!isKnown && <option value={value}>{value}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
