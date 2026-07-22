import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional custom clear handler; defaults to onChange(''). */
  onClear?: () => void;
  /** Container sizing (width / flex) so callers can place it in their layout. */
  style?: React.CSSProperties;
}

/**
 * Canonical free-text search input, extracted from SuppliersList so every module
 * shares one look: magnifier icon at left 12, 36px left padding, #E0E0E0 border,
 * radius 6, 13px, and an × clear button that appears once there is text.
 */
export function SearchBar({ value, onChange, placeholder = 'Search…', onClear, style }: SearchBarProps) {
  return (
    <div className="relative" style={{ flex: '1 1 0', maxWidth: '50%', ...style }}>
      <FontAwesomeIcon
        icon={faMagnifyingGlass}
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14, pointerEvents: 'none' }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', paddingLeft: 36, paddingRight: value ? 34 : 16, paddingTop: 8, paddingBottom: 8,
          border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000',
          backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => (onClear ? onClear() : onChange(''))}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#808285', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 13 }} />
        </button>
      )}
    </div>
  );
}
