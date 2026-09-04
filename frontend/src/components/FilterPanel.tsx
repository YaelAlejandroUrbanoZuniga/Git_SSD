import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

/**
 * Generic "Filters" trigger + popover, meant to sit next to `SearchBar` and
 * replace the inline `<select>` filters that used to clutter the search row.
 * The panel itself knows nothing about any table's fields — callers pass their
 * own filter controls (typically `FilterField`-wrapped) as `children`.
 */
export function FilterPanel({
  activeCount, onClearAll, children, align = 'right', panelWidth = 320, label = 'Filters',
}: {
  /** Number of filters currently set — drives the trigger's active styling and badge. */
  activeCount: number;
  onClearAll: () => void;
  children: ReactNode;
  /** Which edge of the trigger the panel hangs from, to avoid clipping at the viewport edge. */
  align?: 'left' | 'right';
  panelWidth?: number | string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const active = activeCount > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
          border: active ? 'none' : `1px solid ${NEUTRAL_COLORS.border}`,
          backgroundColor: active ? `${BRAND_COLORS.accentRed}26` : BRAND_COLORS.cards,
          color: active ? BRAND_COLORS.accentRed : BRAND_COLORS.sidebar,
        }}
      >
        <FontAwesomeIcon icon={faFilter} style={{ fontSize: 12 }} />
        {label}
        {active && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
              backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards,
              fontSize: 10, fontWeight: 700, lineHeight: 1,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', [align]: 0,
            width: panelWidth, backgroundColor: BRAND_COLORS.cards,
            border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: 16, zIndex: 50,
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Filters</span>
            {active && (
              <button
                type="button"
                onClick={onClearAll}
                style={{ fontSize: 12, fontWeight: 600, color: BRAND_COLORS.accentRed, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
