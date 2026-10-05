import type { CSSProperties, ReactNode } from 'react';
import { useHover } from '../hooks/useHover';
import { colors } from '../tokens/colors';
import { padding, radius, shadows } from '../tokens/spacing';
import { transitions } from '../tokens/motion';

interface Props {
  children: ReactNode;
  /** `compact` (20) for KPI/info/grid cards; `section` (24) for a form section,
   *  a chart or a read-only block of a detail screen. */
  size?: 'compact' | 'section';
  /** 4px stripe on the LEFT in this color (category / stage / module). */
  accentColor?: string;
  /** Makes the card clickable: hover shadow + pointer + keyboard access. */
  onClick?: () => void;
  /** No padding — for a table or list that brings its own (overflow hidden clips the corners). */
  flush?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
}

/**
 * The composition unit: everything inside <main> lives in a card, except the
 * page header and the toolbar. Hover raises the SHADOW, never the element — a
 * translateY on a grid of 30 cards makes the page tremble.
 */
export function Card({ children, size = 'compact', accentColor, onClick, flush = false, style, ariaLabel }: Props) {
  const clickable = !!onClick;
  const [hovered, hoverProps] = useHover(!clickable);
  const pad = flush ? 0 : size === 'section' ? padding.sectionCard : padding.card;

  return (
    <div
      {...(clickable ? hoverProps : {})}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      style={{
        backgroundColor: colors.core.surface,
        borderRadius: radius.card,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        padding: pad,
        // The stripe takes 4px, so the left padding gives them back.
        ...(accentColor ? { borderLeft: `4px solid ${accentColor}`, paddingLeft: flush ? 0 : (pad as number) - 4 } : {}),
        overflow: flush ? 'hidden' : undefined,
        cursor: clickable ? 'pointer' : undefined,
        transition: clickable ? transitions.shadow : undefined,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
