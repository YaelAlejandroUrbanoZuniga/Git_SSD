import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, type IconDefinition } from '@fortawesome/free-solid-svg-icons';

interface LoadingStateProps {
  /** Bold 15px message under the ring. Defaults to "Loading elements…", or "Loading {entity}…" when `entity` is set. */
  message?: string;
  /** Optional 13px grey line under the message. */
  submessage?: string;
  /** Font Awesome icon centred inside the ring. Defaults to faChartLine. */
  icon?: IconDefinition;
  /** Full-screen overlay instead of an inline block. */
  fullScreen?: boolean;
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
export function LoadingState({ message, submessage, icon = faChartLine, fullScreen, entity, style }: LoadingStateProps) {
  const resolvedMessage = message ?? (entity ? `Loading ${entity}…` : 'Loading elements…');

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed', inset: 0, backgroundColor: '#FFFFFF', zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      }
    : {
        width: '100%', padding: '64px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      };

  return (
    <div role="status" aria-live="polite" style={{ ...containerStyle, ...style }}>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <svg width={72} height={72} viewBox="0 0 72 72" style={{ animation: 'ssd-loading-spin 1.1s linear infinite' }}>
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
        @keyframes ssd-loading-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
