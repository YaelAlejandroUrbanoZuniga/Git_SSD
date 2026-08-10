import type { IntelexLevel } from '../types';
import { INTELEX_LEVEL_COLOR } from '../constants/intelex-levels';

/**
 * Where a supplier stands inside the Intelex Handoff sequence
 * (Investigate → L0 → … → L4 → Completed).
 *
 * It lives here rather than next to one of its callers because it now has three:
 * the editable `TabIntelexTimeline` and the read-only `TabROIntelexTimeline`
 * (both via `pages/tracker/read-only-tabs.tsx`, which re-exports it so their
 * existing imports keep working) and `SupplierTrackerCard`.
 *
 * `compact` is the card variant: the pill alone, no "Current level" caption and
 * no bottom margin, so it sits on a line with other card metadata. The default
 * is the labelled block the Timeline cards use at the top of the card.
 */
export function IntelexLevelBadge({ level, compact = false }: { level: IntelexLevel; compact?: boolean }) {
  const pill = (
    <span style={{
      fontSize: compact ? 11 : 13,
      fontWeight: 700,
      color: INTELEX_LEVEL_COLOR,
      backgroundColor: `${INTELEX_LEVEL_COLOR}26`,
      padding: compact ? '2px 8px' : '3px 10px',
      borderRadius: compact ? 3 : 4,
    }}>
      {level}
    </span>
  );

  if (compact) {
    return <span title={`Intelex Handoff level: ${level}`}>{pill}</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current level</span>
      {pill}
    </div>
  );
}
