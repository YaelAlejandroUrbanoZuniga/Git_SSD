import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { ACCENT_COLORS } from '../constants/designTokens';

interface CardHeaderProps {
  icon: IconDefinition;
  iconColor: string;
  title: string;
  action?: { label: string; onClick: () => void };
}

/** Shared title row for the info cards on Home: an icon next to the h2, with an optional trailing action link. */
export function CardHeader({ icon, iconColor, title, action }: CardHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 14, color: iconColor }} />
        {title}
      </h2>
      {action && (
        <button
          onClick={action.onClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: ACCENT_COLORS.info, padding: 0 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
