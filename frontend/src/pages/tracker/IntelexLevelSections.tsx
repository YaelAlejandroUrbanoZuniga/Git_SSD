import type { IntelexLevel, TrackerSupplier } from '../../types';
import {
  INTELEX_LEVEL_COLOR,
  INTELEX_PHASE_LABELS,
  intelexLevelsOfPhase,
  intelexPhaseOf,
  type IntelexPhase,
} from '../../constants/intelex-levels';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';
import { SupplierTrackerCard } from './SupplierTrackerCard';

const PHASES: IntelexPhase[] = ['development', 'monitoring'];
const OTHER_LEVEL = 'Other';

const cardGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 };

/**
 * The Intelex Handoff board, grouped by sub-level (Investigate → L4) under the
 * two phases — Development and KPI achieved – monitoring (see
 * `constants/intelex-levels.ts`). Receives the already-filtered list, so search
 * and every filter (the Level one included) keep working unchanged; levels with
 * no supplier left after filtering are not rendered. A level outside the
 * sequence (legacy data) lands in a trailing "Other" section.
 */
export function IntelexLevelSections({ suppliers, stageColor }: { suppliers: TrackerSupplier[]; stageColor: string }) {
  const byLevel = new Map<string, TrackerSupplier[]>();
  const other: TrackerSupplier[] = [];
  suppliers.forEach(s => {
    if (intelexPhaseOf(s.intelex_currentLevel) === null) other.push(s);
    else byLevel.set(s.intelex_currentLevel, [...(byLevel.get(s.intelex_currentLevel) ?? []), s]);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {PHASES.map(phase => {
        const levels = intelexLevelsOfPhase(phase);
        const count = levels.reduce((n, level) => n + (byLevel.get(level)?.length ?? 0), 0);
        return (
          <section key={phase}>
            <PhaseHeader label={INTELEX_PHASE_LABELS[phase]} levels={levels} count={count} />
            {count === 0 ? (
              <p style={{ fontSize: 13, color: BRAND_COLORS.sidebar, margin: '0 0 4px' }}>No suppliers in this phase.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {levels.filter(level => byLevel.has(level)).map(level => (
                  <LevelGroup key={level} label={level} suppliers={byLevel.get(level)!} stageColor={stageColor} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {other.length > 0 && (
        <section>
          <PhaseHeader label={OTHER_LEVEL} count={other.length} />
          <LevelGroup label={OTHER_LEVEL} suppliers={other} stageColor={stageColor} muted />
        </section>
      )}
    </div>
  );
}

function PhaseHeader({ label, levels, count }: { label: string; levels?: IntelexLevel[]; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      paddingBottom: 8, borderBottom: `2px solid ${NEUTRAL_COLORS.borderLight}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      {levels && levels.length > 0 && (
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          {levels[0]}{levels.length > 1 ? ` – ${levels[levels.length - 1]}` : ''}
        </span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: BRAND_COLORS.sidebar }}>
        {count} supplier{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

function LevelGroup({ label, suppliers, stageColor, muted = false }: {
  label: string; suppliers: TrackerSupplier[]; stageColor: string; muted?: boolean;
}) {
  const color = muted ? BRAND_COLORS.sidebar : INTELEX_LEVEL_COLOR;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color, backgroundColor: `${color}26`, padding: '3px 10px', borderRadius: 4 }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: BRAND_COLORS.sidebar }}>{suppliers.length}</span>
      </div>
      <div style={cardGrid}>
        {suppliers.map(supplier => (
          <SupplierTrackerCard key={supplier.id} supplier={supplier} stageColor={stageColor} />
        ))}
      </div>
    </div>
  );
}
