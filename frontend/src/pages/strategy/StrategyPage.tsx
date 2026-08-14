import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronRight, faCheck, faTimes, faPen, faEye, faBullseye, faLayerGroup, faHourglassHalf, faClipboardList, faBuilding, faChartBar } from '@fortawesome/free-solid-svg-icons';
import type { StrategyEntry, TrackerSupplier, CompletedSupplier, MRLRequirement } from '../../types';
import { COMMODITIES } from '../../constants/catalogs';
import { getStrategyEntries, upsertStrategyNeeds } from '../../services/strategyService';
import { getCompletedSuppliers, getTrackerSuppliers } from '../../services/suppliersService';
import { getMRLRequirements } from '../../services/mrlService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTableSort, sortIcon } from '../../hooks/useTableSort';
import { getStageColor, slaColors } from '../../utils/tracker-helpers';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { KpiCard } from '../../components/KpiCard';
import { moduleIcons } from '../../components/moduleIcons';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

// ─── Shared helpers ───────────────────────────────────────────────────────────

interface StageSnapshot {
  stageName: string;
  count: number;
  avgDaysInStage: number;
}

interface StrategyRow {
  commodity: string;
  strategyNeeds2026: number;
  strategyNeeds2027: number;
  /** All six planning years, as stored — the drilldown editor edits these. */
  strategyNeeds: StrategyEntry['strategyNeeds'];
  totalInTracker: number;
  reserved: number;
  inProgress: number;
  achieved: number;
  remaining: number;
  stages: StageSnapshot[];
  entryId: string | null;
  updatedAt: string;
}

const NEED_YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

const EMPTY_NEEDS: StrategyEntry['strategyNeeds'] = {
  '2026': 0, '2027': null, '2028': null, '2029': null, '2030': null, '2031': null,
};

function RemainingBadge({ remaining }: { remaining: number }) {
  const style =
    remaining === 0
      ? { bg: '#6ABF4B26', text: '#6ABF4B' }
      : remaining === 1
      ? { bg: '#D4A01726', text: '#D4A017' }
      : { bg: `${BRAND_COLORS.accentRed}26`, text: BRAND_COLORS.accentRed };
  return (
    <span style={{ backgroundColor: style.bg, color: style.text, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 3, display: 'inline-block', minWidth: 28, textAlign: 'center' }}>
      {remaining}
    </span>
  );
}

// ─── Drilldown view ───────────────────────────────────────────────────────────

function DrilldownView({ row, suppliers, onBack, onNeedsSaved }: {
  row: StrategyRow;
  suppliers: TrackerSupplier[];
  onBack: () => void;
  onNeedsSaved: (entry: StrategyEntry) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { canWrite } = usePermissions();
  const need = row.strategyNeeds2026;
  const total = row.totalInTracker;
  const ratio = need > 0 ? total / need : 1;
  const barColor = ratio >= 1 ? '#6ABF4B' : ratio >= 0.5 ? '#D4A017' : BRAND_COLORS.accentRed;
  const barPct = Math.min(100, Math.round(ratio * 100));

  // ── Needs-by-year editor ──────────────────────────────────────────────
  const [editingNeeds, setEditingNeeds] = useState(false);
  const [savingNeeds, setSavingNeeds] = useState(false);
  const [needsDraft, setNeedsDraft] = useState<Record<string, string>>({});

  function startNeedsEdit() {
    const draft: Record<string, string> = {};
    NEED_YEARS.forEach(y => { const v = row.strategyNeeds[y]; draft[y] = v == null ? '' : String(v); });
    setNeedsDraft(draft);
    setEditingNeeds(true);
  }

  async function saveNeeds() {
    const needs: Partial<StrategyEntry['strategyNeeds']> = {};
    for (const y of NEED_YEARS) {
      const raw = (needsDraft[y] ?? '').trim();
      // 2026 is a required (non-nullable) column — an empty box means 0, not "unset".
      if (y === '2026') {
        needs[y] = raw === '' ? 0 : Number(raw);
      } else {
        needs[y] = raw === '' ? null : Number(raw);
      }
      const val = needs[y];
      if (val != null && (!Number.isInteger(val) || val < 0)) {
        toast.validationError('Invalid strategy need', `The need for ${y} must be a non-negative whole number.`);
        return;
      }
    }
    setSavingNeeds(true);
    try {
      const saved = await upsertStrategyNeeds(row.commodity, needs);
      onNeedsSaved(saved);
      setEditingNeeds(false);
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected these needs', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The strategy needs could not be saved.');
      }
    } finally {
      setSavingNeeds(false);
    }
  }

  type DrillSortField = 'folio' | 'name' | 'stage' | 'daysInStage' | 'subStatus';
  const { sortField: drillSortField, sortDir: drillSortDir, handleSort: handleDrillSort, sortedRows: sortedSuppliers } =
    useTableSort<TrackerSupplier, DrillSortField>(suppliers, (s, field) => {
      switch (field) {
        case 'folio': return s.folio;
        case 'name': return s.name;
        case 'stage': return s.stage;
        case 'daysInStage': return s.daysInStage;
        case 'subStatus': return s.subStatus;
      }
    });

  return (
    <div>
      {/* ── Strategy Drilldown Hero Header ─────────────────────── */}
      <div style={{
        backgroundColor: ACCENT_COLORS.info,
        padding: '20px 32px',
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={onBack}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
            </button>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {row.commodity}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            Strategy need: {need} supplier{need !== 1 ? 's' : ''} · {suppliers.length} currently in tracker
          </p>
        </div>
      </div>

      <nav style={{ margin: '16px 0 24px' }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', padding: 0, color: '#0084C0', fontWeight: 500, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}
          >
            Strategy
          </button>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{row.commodity}</span>
        </span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left — supplier list */}
        {suppliers.length === 0 ? (
          <EmptyState icon={faBuilding} title="No suppliers" description="No suppliers currently in tracker for this commodity." />
        ) : (
          <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {([
                    { label: 'Folio',         field: 'folio'       },
                    { label: 'Supplier Name', field: 'name'        },
                    { label: 'Stage',         field: 'stage'       },
                    { label: 'Days in Stage', field: 'daysInStage' },
                    { label: 'Sub-Status',    field: 'subStatus'   },
                  ] as { label: string; field: DrillSortField }[]).map(col => {
                    const { icon, color: iconColor } = sortIcon(col.field, drillSortField, drillSortDir);
                    return (
                      <th
                        key={col.field}
                        onClick={() => handleDrillSort(col.field)}
                        style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', backgroundColor: drillSortField === col.field ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {col.label}
                          <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: iconColor }} />
                        </span>
                      </th>
                    );
                  })}
                  <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: NEUTRAL_COLORS.panelBg, width: 60 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSuppliers.map((s, i) => {
                  const color = getStageColor(s.stage);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate((s as any).isCompleted ? `/tracker/completed/supplier/${s.id}` : `/tracker/supplier/${s.id}`)}
                      style={{ borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}
                    >
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#0084C0', fontWeight: 500 }}>{s.folio}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: `${color}1F`, color, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                          {s.stage}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[s.sla], flexShrink: 0 }} />
                          {s.daysInStage}d
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.subStatus ?? '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate((s as any).isCompleted ? `/tracker/completed/supplier/${s.id}` : `/tracker/supplier/${s.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <FontAwesomeIcon icon={faEye} style={{ fontSize: 14, color: '#0084C0' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Right — distribution by stage */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: '0 0 16px' }}>Distribution by Stage</h2>

          {row.stages.length === 0 ? (
            <div style={{ marginBottom: 20 }}>
              <EmptyState icon={faChartBar} title="No stage data" description="No suppliers in any stage yet." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {row.stages.map(st => {
                const color = getStageColor(st.stageName);
                return (
                  <div key={st.stageName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: `${color}1F`, color, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                      {st.stageName}
                    </span>
                    <span style={{ fontSize: 13, color: '#4B5563', whiteSpace: 'nowrap' }}>
                      {st.count} supplier{st.count !== 1 ? 's' : ''} · avg {st.avgDaysInStage}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ borderTop: `0.5px solid ${BRAND_COLORS.background}`, paddingTop: 18, marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { label: 'Reserved',    value: row.reserved,   color: getStageColor('Parking Lot') },
                { label: 'In Progress', value: row.inProgress, color: BRAND_COLORS.sidebar },
                { label: 'Achieved',    value: row.achieved,   color: '#6ABF4B' },
              ] as { label: string; value: number; color: string }[]).map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: b.color }} />
                    {b.label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{b.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `0.5px solid ${BRAND_COLORS.background}`, paddingTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Progress vs. Need</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{total} of {need} needed</span>
            </div>
            <div style={{ backgroundColor: BRAND_COLORS.background, borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: barColor, width: `${barPct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Needs by year — editable */}
          <div style={{ borderTop: `0.5px solid ${BRAND_COLORS.background}`, paddingTop: 18, marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>Needs by year</h3>
              {editingNeeds ? (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button
                    onClick={saveNeeds}
                    disabled={savingNeeds}
                    title="Save"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ACCENT_COLORS.info, border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: BRAND_COLORS.cards, cursor: savingNeeds ? 'default' : 'pointer', opacity: savingNeeds ? 0.6 : 1 }}
                  >
                    <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} /> Save
                  </button>
                  <button
                    onClick={() => setEditingNeeds(false)}
                    disabled={savingNeeds}
                    title="Cancel"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: BRAND_COLORS.cards, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: '#000000', cursor: 'pointer' }}
                  >
                    <FontAwesomeIcon icon={faTimes} style={{ fontSize: 11 }} />
                  </button>
                </span>
              ) : canWrite ? (
                <button
                  onClick={startNeedsEdit}
                  title="Edit needs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} /> Edit
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {NEED_YEARS.map(y => (
                <div key={y}>
                  <label style={{ fontSize: 11, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 4, textAlign: 'center' }}>{y}</label>
                  {editingNeeds ? (
                    <input
                      type="number"
                      min={0}
                      value={needsDraft[y] ?? ''}
                      onChange={e => setNeedsDraft(prev => ({ ...prev, [y]: e.target.value }))}
                      style={{ border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '6px 4px', fontSize: 13, width: '100%', boxSizing: 'border-box', textAlign: 'center', outline: 'none', color: '#000000', backgroundColor: BRAND_COLORS.cards }}
                    />
                  ) : (
                    <div style={{ border: `1px solid ${BRAND_COLORS.background}`, borderRadius: 6, padding: '6px 4px', fontSize: 13, textAlign: 'center', color: '#000000', backgroundColor: '#FAFAFA' }}>
                      {row.strategyNeeds[y] ?? '—'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function StrategyPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [entries, setEntries] = useState<StrategyEntry[]>([]);
  const [trackerSuppliers, setTrackerSuppliers] = useState<TrackerSupplier[]>([]);
  const [completedSuppliers, setCompletedSuppliers] = useState<CompletedSupplier[]>([]);
  const [mrlRequirements, setMrlRequirements] = useState<MRLRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStrategyEntries(), getTrackerSuppliers(), getCompletedSuppliers(), getMRLRequirements(),
    ])
      .then(([entriesList, tracker, completed, mrl]) => {
        if (cancelled) return;
        setEntries(entriesList);
        setTrackerSuppliers(tracker);
        setCompletedSuppliers(completed);
        setMrlRequirements(mrl);
      })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the strategy overview.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  type StrategySortField = 'commodity' | 'strategyNeeds2026' | 'strategyNeeds2027' | 'totalInTracker' | 'remaining' | 'updatedAt';

  // The full C_Commodity catalog (36), not just commodities that happen to have
  // suppliers — a commodity with strategy needs but no suppliers stays visible
  // with its tracker columns at 0.
  const allCommodities = useMemo(() => [...COMMODITIES].sort(), []);

  const rowsArr = useMemo<StrategyRow[]>(() => allCommodities.map(commodity => {
    const entry = entries.find(e => e.commodity === commodity);
    const suppliersInCommodity = [...trackerSuppliers, ...completedSuppliers].filter(s => s.commodity === commodity);
    const stageGroups: Record<string, number[]> = {};
    suppliersInCommodity.forEach(s => {
      if (!stageGroups[s.stage]) stageGroups[s.stage] = [];
      stageGroups[s.stage].push(s.daysInStage);
    });
    const stages = Object.entries(stageGroups).map(([stageName, days]) => ({
      stageName,
      count: days.length,
      avgDaysInStage: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    }));
    const total = suppliersInCommodity.length;
    const reserved = suppliersInCommodity.filter(s => s.stage === 'Parking Lot').length;
    const achieved = suppliersInCommodity.filter(
      s => s.stage === 'Completed' || (s.stage === 'Intelex Handoff' && s.intelex_l2Real !== null)
    ).length;
    const inProgress = total - reserved - achieved;
    const need = entry?.strategyNeeds['2026'] ?? 0;
    return {
      commodity,
      strategyNeeds2026: need,
      strategyNeeds2027: entry?.strategyNeeds['2027'] ?? 0,
      strategyNeeds: entry?.strategyNeeds ?? EMPTY_NEEDS,
      totalInTracker: reserved + inProgress + achieved,
      reserved,
      inProgress,
      achieved,
      remaining: need > 0 ? Math.max(0, need - achieved) : 0,
      stages,
      entryId: entry?.id ?? null,
      updatedAt: entry?.updatedAt ?? '—',
    };
  }), [allCommodities, entries, trackerSuppliers, completedSuppliers]);

  const { sortField, sortDir, handleSort, sortedRows: rows } = useTableSort<StrategyRow, StrategySortField>(
    rowsArr,
    (r, field) => {
      switch (field) {
        case 'commodity': return r.commodity;
        case 'strategyNeeds2026': return r.strategyNeeds2026;
        case 'strategyNeeds2027': return r.strategyNeeds2027;
        case 'totalInTracker': return r.totalInTracker;
        case 'remaining': return r.remaining;
        case 'updatedAt': return r.updatedAt === '—' ? null : new Date(r.updatedAt);
      }
    },
  );

  const totalNeeds = rows.reduce((sum, r) => sum + r.strategyNeeds2026, 0);
  const commoditiesDefined = rows.filter(r => r.strategyNeeds2026 > 0).length;
  const commoditiesRemaining = rows.filter(r => r.remaining > 0).length;

  // Adopt the persisted entry the backend returns after a drilldown save, so
  // `rows` recomputes from real data rather than a fabricated local entry.
  function handleNeedsSaved(entry: StrategyEntry) {
    setEntries(prev =>
      prev.some(e => e.commodity === entry.commodity)
        ? prev.map(e => (e.commodity === entry.commodity ? entry : e))
        : [...prev, entry]
    );
  }

  // The KPIs and every row are derived from the four fetches at once, so the whole
  // page waits rather than briefly rendering a "0 commodities defined" board.
  if (loading) {
    return <LoadingState entity="Strategy" icon={moduleIcons.strategy} fill />;
  }

  // Drilldown view
  if (selectedCommodity) {
    const row = rows.find(r => r.commodity === selectedCommodity);
    if (row) {
      return (
        <DrilldownView
          row={row}
          suppliers={[
            ...trackerSuppliers.filter(s => s.commodity === selectedCommodity),
            ...completedSuppliers.filter(s => s.commodity === selectedCommodity).map(s => ({ ...s, isCompleted: true })),
          ]}
          onBack={() => setSelectedCommodity(null)}
          onNeedsSaved={handleNeedsSaved}
        />
      );
    }
  }

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: NEUTRAL_COLORS.panelBg, whiteSpace: 'nowrap' };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>
            Strategy
          </h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
            {commoditiesDefined} commodities defined · Strategy year: 2026
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="flex" style={{ gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <KpiCard label="Total Strategy Needs (2026)" value={totalNeeds} icon={faBullseye} color={BRAND_COLORS.accentRed} />
        </div>
        <div style={{ flex: 1 }}>
          <KpiCard label="Commodities Defined" value={commoditiesDefined} icon={faLayerGroup} color="#02B3E1" />
        </div>
        <div style={{ flex: 1 }}>
          <KpiCard label="Commodities Remaining" value={commoditiesRemaining} icon={faHourglassHalf} color="#D4A017" />
        </div>
      </div>

      {/* Master Requirements List access card */}
      <div
        onClick={() => navigate('/strategy/mrl')}
        className="flex items-center"
        style={{ gap: 14, padding: '16px 20px', marginBottom: 24, backgroundColor: BRAND_COLORS.cards, borderRadius: 10, border: `1px solid ${NEUTRAL_COLORS.borderLight}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: `${ACCENT_COLORS.info}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 16, color: ACCENT_COLORS.info }} />
        </div>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#000000', display: 'block' }}>Master Requirements List</span>
          <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>{mrlRequirements.length} requirements</span>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {([
                { label: 'Commodity',          field: 'commodity'          },
                { label: 'Strategy Need (2026)', field: 'strategyNeeds2026' },
                { label: 'Strategy Need (2027)', field: 'strategyNeeds2027' },
                { label: 'Total',              field: 'totalInTracker'    },
                { label: 'Remaining',          field: 'remaining'          },
                { label: 'Last Updated',       field: 'updatedAt'          },
              ] as { label: string; field: StrategySortField }[]).map(col => {
                const { icon, color: iconColor } = sortIcon(col.field, sortField, sortDir);
                return (
                  <th
                    key={col.field}
                    onClick={() => handleSort(col.field)}
                    style={{
                      textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700,
                      color: '#000000', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
                      backgroundColor: sortField === col.field ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {col.label}
                      <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: iconColor }} />
                    </span>
                  </th>
                );
              })}
              <th style={{ ...thStyle, width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              return (
                <tr
                  key={row.commodity}
                  onClick={() => setSelectedCommodity(row.commodity)}
                  style={{ borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{row.commodity}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#000000' }}>{row.strategyNeeds2026}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#000000' }}>{row.strategyNeeds2027}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{row.totalInTracker}</td>
                  <td style={{ padding: '12px 16px' }}><RemainingBadge remaining={row.remaining} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.userBlock, whiteSpace: 'nowrap' }}>{row.updatedAt}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: '#9CA3AF' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
