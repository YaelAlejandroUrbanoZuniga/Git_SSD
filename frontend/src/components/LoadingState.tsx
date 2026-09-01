import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { MAIN_PADDING_TOP, MAIN_PADDING_BOTTOM } from './layoutConstants';
import { BRAND_COLORS } from '../constants/designTokens';

interface LoadingStateProps {
  /** Bold 15px message under the ring. Defaults to "Loading elements…", or "Loading {entity}…" when `entity` is set. */
  message?: string;
  /** Optional 13px grey line under the message. */
  submessage?: string;
  /** Font Awesome icon centred inside the ring. Defaults to faChartLine. */
  icon?: IconDefinition;
  /** Full-screen overlay instead of an inline block. */
  fullScreen?: boolean;
  /**
   * Fills and centres within the <main> content area (viewport height minus
   * its top/bottom padding) instead of sitting at the top with a fixed
   * `64px 0` padding. For screens where this is the ONLY thing rendered —
   * not a loader embedded in a card/table that already brings its own
   * `style` padding.
   */
  fill?: boolean;
  /** @deprecated pass `message` instead — kept so pre-existing call sites ("Loading {entity}…") still compile. */
  entity?: string;
  /** Optional container overrides. */
  style?: React.CSSProperties;
  /**
   * Milliseconds to wait before the loader actually mounts. Defaults to 400.
   * Most fetches against the Test server resolve well under that, so callers
   * that unconditionally render `<LoadingState />` while `loading` is true
   * would otherwise flash the spinner on every screen change even though the
   * wait was never perceptible. Pass `0` to skip the delay and show the
   * loader immediately (e.g. a fallback for a genuinely slow operation).
   */
  delayMs?: number;
}

/**
 * Canonical loading state (Nexteer UI v4): a spinning ring around a contextual
 * icon, with a message below. Every screen with an initial fetch renders this
 * one component instead of its own spinner.
 *
 * Renders `null` until `delayMs` has elapsed (default 400ms) so a fetch that
 * resolves quickly never flashes the spinner. Do not remove this delay to
 * "fix" a perceived render bug — it's intentional debouncing, not a bug.
 */
export function LoadingState({ message, submessage, icon = faChartLine, fullScreen, fill, entity, style, delayMs = 400 }: LoadingStateProps) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  const resolvedMessage = message ?? (entity ? `Loading ${entity}…` : 'Loading elements…');

  if (!visible) return null;

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed', inset: 0, backgroundColor: BRAND_COLORS.cards, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      }
    : fill
    ? {
        width: '100%', height: `calc(100vh - ${MAIN_PADDING_TOP}px - ${MAIN_PADDING_BOTTOM}px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      }
    : {
        width: '100%', padding: '64px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      };

  return (
    <div role="status" aria-live="polite" style={{ ...containerStyle, ...style }}>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <svg width={72} height={72} viewBox="0 0 72 72" className="ssd-loading-ring">
          <circle cx={36} cy={36} r={32} fill="none" stroke="#F3D6D6" strokeWidth={5} />
          <circle cx={36} cy={36} r={32} fill="none" stroke={BRAND_COLORS.accentRed} strokeWidth={5} strokeLinecap="round" strokeDasharray="60 141" />
        </svg>
        <FontAwesomeIcon
          icon={icon}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 22, color: BRAND_COLORS.accentRed }}
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>{resolvedMessage}</p>
        {submessage && <p style={{ fontSize: 13, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>{submessage}</p>}
      </div>
      <style>{`
        .ssd-loading-ring { animation: ssd-loading-spin 1.1s linear infinite; }
        @keyframes ssd-loading-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ssd-loading-ring { animation: none; }
        }
      `}</style>
    </div>
  );
}
