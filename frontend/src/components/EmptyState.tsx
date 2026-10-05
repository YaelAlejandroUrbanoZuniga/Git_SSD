import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useHover } from '../hooks/useHover';
import { colors } from '../tokens/colors';
import { type, iconSize } from '../tokens/typography';
import { padding, radius, shadows, widths, heights } from '../tokens/spacing';
import { transitions } from '../tokens/motion';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: IconDefinition;
  title: string;
  description: string;
  /** Optional primary action. "No data yet" → create (if the role can). "No matches" → "Clear filters". */
  action?: EmptyStateAction;
  /** `card` (default): its own card. `inline`: inside an existing card, chart or panel — no card, less padding. */
  variant?: 'card' | 'inline';
  /** Icon color. Default structure grey; error states pass the action red. */
  iconColor?: string;
}

/**
 * Canonical empty state (Nexteer UI Kit v7). Two empty situations are NOT the
 * same: the system has no data yet (no "Clear filters" — there is nothing to
 * clear) vs. a filter/search found nothing ("Clear filters").
 */
export function EmptyState({ icon, title, description, action, variant = 'card', iconColor = colors.core.structure }: EmptyStateProps) {
  const [hovered, hoverProps] = useHover();
  const inline = variant === 'inline';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: inline ? padding.emptyInline : padding.emptyState,
        ...(inline ? {} : { backgroundColor: colors.core.surface, borderRadius: radius.card, boxShadow: shadows.card }),
      }}
    >
      <div style={{
        width: heights.stateCircle, height: heights.stateCircle, borderRadius: radius.circle, backgroundColor: colors.core.canvas,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: inline ? 12 : 16, flexShrink: 0,
      }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: iconSize.emptyState, color: iconColor }} />
      </div>
      <p style={{ ...type.stateTitle, fontSize: inline ? 14 : 15, margin: '0 0 4px' }}>{title}</p>
      <p style={{ ...type.stateDescription, fontSize: inline ? 12 : 13, margin: 0, maxWidth: widths.emptyStateText }}>{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          {...hoverProps}
          style={{
            ...type.buttonPrimary, marginTop: 20, padding: padding.buttonPrimary, color: colors.core.surface,
            // The ONE documented exception to "primary hover = shadow": on a large white
            // surface a shadow is barely visible, so this button darkens to brand red.
            backgroundColor: hovered ? colors.core.header : colors.core.action,
            border: 'none', borderRadius: radius.buttonModal, cursor: 'pointer', transition: transitions.background,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
