import type { CSSProperties, ReactNode } from 'react';
import { BRAND_COLORS } from '../constants/designTokens';

const labelStyle: CSSProperties = {
  fontSize: 13, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 4,
};

/**
 * Label-above-control wrapper for a single filter inside `FilterPanel`, matching
 * the label style already used across the app's modals (e.g. EventFormModal's
 * `labelStyle`) so filter fields and form fields read as one system.
 */
export function FilterField({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
