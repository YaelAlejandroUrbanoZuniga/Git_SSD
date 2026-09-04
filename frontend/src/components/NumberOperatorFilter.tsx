import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

export type NumberOperator = 'gt' | 'lt' | '';

/**
 * Operator + number combo — a dropdown to pick `>`/`<` paired with a number
 * input that only appears once an operator is chosen. Extracted from
 * TrackerStage's "Days in stage" filter so the same interaction/state shape
 * (`operator: 'gt' | 'lt' | ''` + a separate string value) is reusable for any
 * other numeric column a caller wants to filter the same way.
 */
export function NumberOperatorFilter({
  operator, onOperatorChange, value, onValueChange,
  placeholder = 'Select…', gtLabel = '> value', ltLabel = '< value', numberPlaceholder = '0', style,
}: {
  operator: NumberOperator;
  onOperatorChange: (op: NumberOperator) => void;
  value: string;
  onValueChange: (v: string) => void;
  /** Text shown for the empty/unset option. */
  placeholder?: string;
  gtLabel?: string;
  ltLabel?: string;
  numberPlaceholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="flex items-center"
      style={{ gap: 4, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 8, padding: '4px 10px', backgroundColor: BRAND_COLORS.cards, ...style }}
    >
      <select
        value={operator}
        onChange={e => onOperatorChange(e.target.value as NumberOperator)}
        style={{ flex: 1, border: 'none', fontSize: 13, color: operator ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: 'transparent', outline: 'none', cursor: 'pointer' }}
      >
        <option value="">{placeholder}</option>
        <option value="gt">{gtLabel}</option>
        <option value="lt">{ltLabel}</option>
      </select>
      {operator && (
        <input
          type="number"
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={numberPlaceholder}
          style={{ width: 44, border: 'none', fontSize: 13, color: '#000000', backgroundColor: 'transparent', outline: 'none' }}
        />
      )}
    </div>
  );
}
