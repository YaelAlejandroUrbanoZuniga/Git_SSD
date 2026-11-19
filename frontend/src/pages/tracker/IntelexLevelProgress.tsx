import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import type { IntelexLevel, TrackerSupplier } from '../../types';
import {
  INTELEX_FINAL_LEVEL,
  INTELEX_HANDOFF_LEVELS,
  INTELEX_LEVEL_COLOR,
  INTELEX_PHASE_LABELS,
  intelexPhaseOf,
  isIntelexMonitoringLevel,
} from '../../constants/intelex-levels';
import { STRATEGY_ACHIEVED_LEVEL } from '../../utils/strategy-helpers';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

const DONE_COLOR = '#6ABF4B';

/**
 * Intelex Handoff detail header: where the supplier stands in the sub-level
 * sequence (Investigate → L4), with the KPI level marking the start of the
 * monitoring phase. From the KPI level on, an informational notice explains
 * that the supplier already shows under Completed › In monitoring while the
 * final close still needs the L4 Real date. Purely informative — the tabs below
 * stay editable.
 */
export function IntelexLevelProgress({ supplier, style }: { supplier: TrackerSupplier; style?: React.CSSProperties }) {
  const level = supplier.intelex_currentLevel;
  const currentIndex = INTELEX_HANDOFF_LEVELS.indexOf(level);
  const phase = intelexPhaseOf(level);
  const monitoring = isIntelexMonitoringLevel(level);

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px', marginBottom: 20, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Intelex level progress
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: monitoring ? DONE_COLOR : INTELEX_LEVEL_COLOR }}>
          {phase ? INTELEX_PHASE_LABELS[phase] : `Level: ${level}`}
        </span>
      </div>

      <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
        {INTELEX_HANDOFF_LEVELS.map((step, i) => (
          <Step
            key={step}
            level={step}
            state={currentIndex < 0 || i > currentIndex ? 'pending' : i === currentIndex ? 'current' : 'done'}
            isKpi={step === STRATEGY_ACHIEVED_LEVEL}
            isLast={i === INTELEX_HANDOFF_LEVELS.length - 1}
          />
        ))}
      </ol>

      {monitoring && (
        <div role="status" style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: '10px 12px',
          borderRadius: 6, backgroundColor: `${INTELEX_LEVEL_COLOR}12`, border: `1px solid ${INTELEX_LEVEL_COLOR}40`,
        }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 14, color: INTELEX_LEVEL_COLOR, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: '#000000', margin: 0, lineHeight: 1.5 }}>
            KPI achieved on <strong>{supplier.intelex_l3Real ?? '—'}</strong> ({STRATEGY_ACHIEVED_LEVEL} Real date).
            This supplier already appears under <strong>Completed › In monitoring</strong> and remains editable.
            The final move to Completed requires the <strong>{INTELEX_FINAL_LEVEL} Real date</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function Step({ level, state, isKpi, isLast }: {
  level: IntelexLevel; state: 'done' | 'current' | 'pending'; isKpi: boolean; isLast: boolean;
}) {
  const color = state === 'done' ? DONE_COLOR : state === 'current' ? INTELEX_LEVEL_COLOR : NEUTRAL_COLORS.border;
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : '1 1 0' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
        <span style={{
          width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
          backgroundColor: state === 'pending' ? BRAND_COLORS.cards : color,
          color: state === 'pending' ? BRAND_COLORS.sidebar : BRAND_COLORS.cards,
          border: `2px solid ${color}`,
          boxShadow: state === 'current' ? `0 0 0 3px ${INTELEX_LEVEL_COLOR}33` : 'none',
        }}>
          {state === 'done' ? <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} /> : level === 'Investigate' ? 'Inv' : level}
        </span>
        <span style={{ fontSize: 11, fontWeight: state === 'current' ? 700 : 500, color: state === 'pending' ? BRAND_COLORS.sidebar : '#000000' }}>
          {level}
        </span>
        {/* Marks where "KPI achieved – monitoring" begins. */}
        <span style={{ fontSize: 10, fontWeight: 700, color: isKpi ? DONE_COLOR : 'transparent', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          KPI
        </span>
      </div>
      {!isLast && (
        <span style={{ flex: 1, height: 2, marginBottom: 30, backgroundColor: state === 'done' ? DONE_COLOR : NEUTRAL_COLORS.borderLight }} />
      )}
    </li>
  );
}
