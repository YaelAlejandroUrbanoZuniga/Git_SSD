import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useHover } from '../hooks/useHover';
import { colors, tint } from '../tokens/colors';
import { type, iconSize } from '../tokens/typography';
import { padding, radius, shadows, gap } from '../tokens/spacing';
import { transitions } from '../tokens/motion';

/**
 * primary     action red, hover = SHADOW (never a color change)
 * secondary   white + border, hover = #F7F7F7 background
 * text        no background/border, hover = color + '14'
 * danger      IDENTICAL to primary. What separates a delete from a save is the
 *             ConfirmDialog in front of it, not a "redder" red.
 * onColor     translucent white, for a colored band (DetailHero)
 * onColorSolid solid white with the band's color as text: the single primary
 *             action on a band.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'onColor' | 'onColorSolid';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  /** "The button takes the radius of its neighbourhood": primary/danger are
   *  radius 8 + 14px in a toolbar, radius 6 + 13px inside a modal footer. */
  context?: 'toolbar' | 'modal';
  /** Leading icon (12px). */
  icon?: IconDefinition;
  /** Shows a spinner, keeps the label, blocks clicks (no double submit). */
  loading?: boolean;
  /** Required whenever the button is disabled for a reason the user can fix. */
  disabledReason?: string;
  /** Text variant color (default: link blue). onColorSolid text color (the band color). */
  color?: string;
}

export function Button({
  children, variant = 'primary', context = 'toolbar', icon, loading = false,
  disabled, disabledReason, color, style, title, type: buttonType = 'button', ...rest
}: Props) {
  const inactive = !!disabled || loading;
  const [hovered, hoverProps] = useHover(inactive);
  const isSolid = variant === 'primary' || variant === 'danger';
  const inModal = context === 'modal';

  let look: CSSProperties;
  switch (variant) {
    case 'primary':
    case 'danger':
      look = {
        ...(inModal ? type.buttonModal : type.buttonPrimary),
        padding: padding.buttonPrimary,
        borderRadius: inModal ? radius.buttonModal : radius.buttonPrimary,
        backgroundColor: colors.core.action,
        color: colors.core.surface,
        border: 'none',
        boxShadow: hovered ? shadows.buttonHover : 'none',
      };
      break;
    case 'secondary':
      look = {
        ...type.buttonSecondary,
        padding: padding.buttonSecondary,
        borderRadius: radius.buttonSecondary,
        backgroundColor: hovered ? colors.neutral.tableHeader : colors.core.surface,
        color: colors.core.text,
        border: `1px solid ${colors.neutral.border}`,
      };
      break;
    case 'text': {
      const c = color ?? colors.semantic.link;
      look = {
        ...type.buttonSecondary,
        padding: padding.buttonText,
        borderRadius: radius.buttonText,
        backgroundColor: hovered ? tint(c, 'hover') : 'transparent',
        color: c,
        border: 'none',
      };
      break;
    }
    case 'onColor':
      look = {
        ...type.buttonSecondary,
        padding: padding.buttonOnColor,
        borderRadius: radius.buttonOnColor,
        backgroundColor: hovered ? colors.overlay.onColorButtonHover : colors.overlay.onColorButton,
        color: colors.core.surface,
        border: `1px solid ${colors.overlay.onColorBorder}`,
      };
      break;
    case 'onColorSolid':
      look = {
        ...type.buttonSecondary,
        fontWeight: 700,
        padding: padding.buttonOnColor,
        borderRadius: radius.buttonOnColor,
        backgroundColor: colors.core.surface,
        color: color ?? colors.core.action,
        border: 'none',
        boxShadow: hovered ? shadows.buttonHover : 'none',
      };
      break;
  }

  return (
    <button
      type={buttonType}
      disabled={inactive}
      title={title ?? (disabled ? disabledReason : undefined)}
      aria-busy={loading || undefined}
      {...hoverProps}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: gap.iconTextButton,
        whiteSpace: 'nowrap',
        cursor: inactive ? (loading ? 'progress' : 'not-allowed') : 'pointer',
        opacity: disabled ? 0.45 : loading ? 0.7 : 1, // disabled keeps its color: grey would read as "secondary"
        transition: isSolid || variant === 'onColorSolid' ? transitions.shadow : transitions.background,
        ...look,
        ...style,
      }}
    >
      {loading
        ? <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: iconSize.button }} />
        : icon && <FontAwesomeIcon icon={icon} style={{ fontSize: iconSize.button }} />}
      {children}
    </button>
  );
}
