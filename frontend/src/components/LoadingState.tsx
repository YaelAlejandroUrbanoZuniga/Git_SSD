import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';

interface LoadingStateProps {
  /** What is being loaded, in the module's own words: "Suppliers", "MRL Requirement", … */
  entity: string;
  /** Optional container overrides (e.g. taller padding on a full-page view). */
  style?: React.CSSProperties;
}

/**
 * Canonical loading state. Every screen with an initial fetch renders this one
 * component instead of its own spinner: faCircleNotch spinning in nexteer.red
 * with a "Loading {entity}…" label, so a slow screen always looks the same and
 * is never mistaken for a blank/broken one.
 */
export function LoadingState({ entity, style }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, color: '#808285', fontSize: 14, ...style }}
    >
      <FontAwesomeIcon icon={faCircleNotch} spin style={{ fontSize: 16, color: '#DC0202' }} />
      Loading {entity}…
    </div>
  );
}
