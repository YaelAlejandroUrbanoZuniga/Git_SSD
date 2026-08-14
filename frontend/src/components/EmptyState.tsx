import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { BRAND_COLORS } from '../constants/designTokens';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: IconDefinition;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

/** Canonical empty state (Nexteer UI v4): a badge icon, title, description, and an optional primary action. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{
      backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', backgroundColor: BRAND_COLORS.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, flexShrink: 0,
      }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 18, color: BRAND_COLORS.sidebar }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 13, color: BRAND_COLORS.sidebar, margin: 0, maxWidth: 360 }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            marginTop: 20, padding: '8px 16px', fontSize: 14, fontWeight: 700, color: BRAND_COLORS.cards,
            backgroundColor: hovered ? BRAND_COLORS.header : BRAND_COLORS.accentRed, border: 'none', borderRadius: 6, cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
