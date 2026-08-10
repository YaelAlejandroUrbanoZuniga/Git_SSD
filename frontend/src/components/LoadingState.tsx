import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { MAIN_PADDING_TOP, MAIN_PADDING_BOTTOM } from './layoutConstants';

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
}

/**
 * Canonical loading state (Nexteer UI v4): a spinning ring around a contextual
 * icon, with a message below. Every screen with an initial fetch renders this
 * one component instead of its own spinner.
 */
export function LoadingState({ message, submessage, icon = faChartLine, fullScreen, fill, entity, style }: LoadingStateProps) {
  const resolvedMessage = message ?? (entity ? `Loading ${entity}…` : 'Loading elements…');

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed', inset: 0, backgroundColor: '#FFFFFF', zIndex: 200,
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
          <circle cx={36} cy={36} r={32} fill="none" stroke="#DC0202" strokeWidth={5} strokeLinecap="round" strokeDasharray="60 141" />
        </svg>
        <FontAwesomeIcon
          icon={icon}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 22, color: '#DC0202' }}
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>{resolvedMessage}</p>
        {submessage && <p style={{ fontSize: 13, color: '#808285', margin: '4px 0 0' }}>{submessage}</p>}
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
