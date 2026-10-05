import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useHover } from '../hooks/useHover';
import { colors, tint } from '../tokens/colors';
import { type, iconSize } from '../tokens/typography';
import { padding, radius, shadows, heights } from '../tokens/spacing';
import { transitions } from '../tokens/motion';

interface KpiCardProps {
  icon: IconDefinition;
  /** Accent: left stripe, icon and icon circle (color + '1F'). */
  color: string;
  label: string;
  value: number | string;
  /** Optional 11px line under the value ("+3 this week"). */
  sub?: string;
  /** Optional: navigates to the list behind the number. */
  onClick?: () => void;
}

/**
 * Canonical KPI card (Nexteer UI Kit v7): label/value on the left; a 48px icon
 * circle on the right, centered against the FULL HEIGHT of the card — never
 * against the label.
 */
export function KpiCard({ icon, color, label, value, sub, onClick }: KpiCardProps) {
  const [hovered, hoverProps] = useHover(!onClick);
  return (
    <div
      {...(onClick ? hoverProps : {})}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick(); } : undefined}
      style={{
        backgroundColor: colors.core.surface,
        borderRadius: radius.card,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        borderLeft: `4px solid ${color}`,
        padding: padding.kpiCard,
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? transitions.shadow : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ ...type.kpiLabel, display: 'block' }}>{label}</span>
        <span style={{ ...type.kpiValue, display: 'block', marginTop: 4 }}>{value}</span>
        {sub && <span style={{ ...type.kpiSubtext, display: 'block', marginTop: 4 }}>{sub}</span>}
      </div>
      <div
        style={{
          width: heights.kpiCircle, height: heights.kpiCircle, borderRadius: radius.circle,
          backgroundColor: tint(color, 'soft'), flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <FontAwesomeIcon icon={icon} style={{ fontSize: iconSize.kpiCircle, color }} />
      </div>
    </div>
  );
}
