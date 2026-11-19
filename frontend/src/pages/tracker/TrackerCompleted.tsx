import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowUpRightFromSquare, faCircleCheck, faEye, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import type { CompletedSupplier, TrackerSupplier } from '../../types';
import { getCompletedSuppliers } from '../../services/suppliersService';
import { getIntelexPhaseSuppliers } from '../../services/trackerService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor, optionsWithUnassigned, matchesUnassignable } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { FilterField } from '../../components/FilterField';
import { CatalogSelect } from '../../components/CatalogSelect';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { IntelexLevelBadge } from '../../components/IntelexLevelBadge';
import { moduleIcons } from '../../components/moduleIcons';
import { useTableSort, sortIcon } from '../../hooks/useTableSort';
import { filterBySearch } from '../../utils/search-filter';
import { INTELEX_HANDOFF_LEVELS, intelexLevelsOfPhase } from '../../constants/intelex-levels';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

/** "L3–L4": the levels of the monitoring phase, from the shared phase helper. */
const MONITORING_LEVELS = intelexLevelsOfPhase('monitoring');
const MONITORING_RANGE = `${MONITORING_LEVELS[0]}–${MONITORING_LEVELS[MONITORING_LEVELS.length - 1]}`;

const thStyle = (sortable: boolean, active: boolean): React.CSSProperties => ({
  textAlign: sortable ? 'left' : 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000',
  borderBottom: `1px solid ${NEUTRAL_COLORS.border}`, cursor: sortable ? 'pointer' : 'default', userSelect: 'none',
  backgroundColor: active ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg,
});
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar };
const tableCard: React.CSSProperties = { borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' };

/**
 * Completed has two sections:
 *   • In monitoring (L3–L4) — ACTIVE Intelex Handoff suppliers that already met
 *     the KPI (level L3+). They still belong to the Intelex Handoff stage (no stage
 *     count changes); this is only a view, and they open the editable tracker detail.
 *   • Closed — the terminal Completed stage, read-only, exactly as before.
 */
export function TrackerCompleted() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [completedSuppliers, setCompletedSuppliers] = useState<CompletedSupplier[]>([]);
  const [monitoringSuppliers, setMonitoringSuppliers] = useState<TrackerSupplier[]>([]);
  const [loadingClosed, setLoadingClosed] = useState(true);
  const [loadingMonitoring, setLoadingMonitoring] = useState(true);

  // Seeds from `?buyer=` the same way TrackerStage does, so a deep link from
  // the Visuals "Summary by Buyer" accordion opens pre-filtered.
  useEffect(() => {
    setBuyerFilter(searchParams.get('buyer') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('buyer')]);

  // The two sections load independently, so one failing never hides the other.
  useEffect(() => {
    let cancelled = false;
    setLoadingClosed(true);
    getCompletedSuppliers()
      .then(list => { if (!cancelled) setCompletedSuppliers(list); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load completed suppliers.');
      })
      .finally(() => { if (!cancelled) setLoadingClosed(false); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMonitoring(true);
    getIntelexPhaseSuppliers('monitoring')
      .then(list => { if (!cancelled) setMonitoringSuppliers(list); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load suppliers in monitoring.');
      })
      .finally(() => { if (!cancelled) setLoadingMonitoring(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const allRows = useMemo(
    () => [...monitoringSuppliers, ...completedSuppliers],
    [monitoringSuppliers, completedSuppliers],
  );
  const commodities = useMemo(
    () => Array.from(new Set(allRows.map(s => s.commodity))).sort(),
    [allRows]
  );
  const buyers = useMemo(
    () => optionsWithUnassigned(allRows.map(s => s.buyer)),
    [allRows]
  );

  // One filter set drives both sections.
  function applyFilters<T extends TrackerSupplier>(rows: T[]): T[] {
    const byDropdowns = rows.filter(s =>
      (!commodityFilter || s.commodity === commodityFilter) &&
      (!buyerFilter || matchesUnassignable(s.buyer, buyerFilter)),
    );
    return filterBySearch(byDropdowns, searchTerm, s => [s.name, s.folio, s.commodity, s.buyer]);
  }

  const filtered = useMemo(
    () => applyFilters(completedSuppliers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchTerm, commodityFilter, buyerFilter, completedSuppliers],
  );
  const filteredMonitoring = useMemo(
    () => applyFilters(monitoringSuppliers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchTerm, commodityFilter, buyerFilter, monitoringSuppliers],
  );

  const activeFilterCount = [commodityFilter, buyerFilter].filter(Boolean).length;
  const hasActiveFilters = !!searchTerm || activeFilterCount > 0;
  const clearFilters = () => { setCommodityFilter(''); setBuyerFilter(''); };

  type COSortField = 'folio' | 'name' | 'country' | 'commodity' | 'buyer' | 'completedDate' | 'completedBy';
  const { sortField, sortDir, handleSort: handleCOSort, sortedRows: sorted } = useTableSort<CompletedSupplier, COSortField>(
    filtered,
    (s, field) => (field === 'completedDate' ? new Date(s.completedDate) : s[field]),
  );

  type MOSortField = 'folio' | 'name' | 'commodity' | 'level' | 'l3Real' | 'buyer';
  const { sortField: moSortField, sortDir: moSortDir, handleSort: handleMOSort, sortedRows: sortedMonitoring } =
    useTableSort<TrackerSupplier, MOSortField>(filteredMonitoring, (s, field) => {
      switch (field) {
        case 'level': return INTELEX_HANDOFF_LEVELS.indexOf(s.intelex_currentLevel);
        case 'l3Real': return s.intelex_l3Real;
        default: return s[field];
      }
    });

  const sectionCount = (shown: number, total: number) => (hasActiveFilters ? `${shown} of ${total}` : `${total}`);

  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: getStageColor('Completed'),
        padding: '20px 32px',
        marginBottom: 28,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <button
            onClick={() => navigate('/tracker')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: 0, letterSpacing: '-0.02em' }}>Completed Suppliers</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            Suppliers that achieved the Intelex KPI ({MONITORING_LEVELS[0]}) and are being monitored, and suppliers that closed the full SSD tracker cycle
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <Link to="/tracker" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>Completed</span>
        </span>
      </nav>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search supplier, folio, commodity, buyer..."
          style={{ flex: '1 1 0', maxWidth: 320 }}
        />
        <FilterPanel activeCount={activeFilterCount} onClearAll={clearFilters}>
          <FilterField label="Commodity">
            <CatalogSelect value={commodityFilter} onChange={setCommodityFilter} options={commodities} placeholder="All commodities" />
          </FilterField>
          <FilterField label="Buyer">
            <CatalogSelect value={buyerFilter} onChange={setBuyerFilter} options={buyers} placeholder="All buyers" />
          </FilterField>
        </FilterPanel>
      </div>

      {/* ── In monitoring (L3–L4) ─────────────────────────────── */}
      <SectionHeader
        icon={faHourglassHalf}
        title={`In monitoring (${MONITORING_RANGE})`}
        count={sectionCount(sortedMonitoring.length, monitoringSuppliers.length)}
        description={`KPI achieved — still in Intelex Handoff and editable until the ${MONITORING_LEVELS[MONITORING_LEVELS.length - 1]} Real date closes the handoff.`}
      />
      <div style={{ marginBottom: 36 }}>
        {loadingMonitoring ? (
          <LoadingState entity="Suppliers" icon={moduleIcons.tracker} style={{ padding: '40px 32px' }} />
        ) : monitoringSuppliers.length === 0 ? (
          <EmptyState icon={faHourglassHalf} title="No suppliers in monitoring" description={`No Intelex Handoff supplier has reached ${MONITORING_LEVELS[0]} yet.`} />
        ) : sortedMonitoring.length === 0 ? (
          <EmptyState icon={faHourglassHalf} title="No matches" description="No suppliers in monitoring match the current filters." />
        ) : (
          <div className="bg-white" style={tableCard}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {([
                    { label: 'Folio',         field: 'folio' as MOSortField },
                    { label: 'Supplier',      field: 'name' as MOSortField },
                    { label: 'Commodity',     field: 'commodity' as MOSortField },
                    { label: 'Current Level', field: 'level' as MOSortField },
                    { label: `${MONITORING_LEVELS[0]} Real (KPI)`, field: 'l3Real' as MOSortField },
                    { label: 'Buyer',         field: 'buyer' as MOSortField },
                    { label: 'Actions',       field: null },
                  ] as { label: string; field: MOSortField | null }[]).map(col => {
                    const iconInfo = col.field ? sortIcon(col.field, moSortField, moSortDir) : null;
                    return (
                      <th
                        key={col.label}
                        onClick={col.field ? () => handleMOSort(col.field as MOSortField) : undefined}
                        style={thStyle(!!col.field, !!col.field && moSortField === col.field)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {col.label}
                          {iconInfo && <FontAwesomeIcon icon={iconInfo.icon} style={{ fontSize: 10, color: iconInfo.color }} />}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedMonitoring.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }}
                    onClick={() => navigate(`/tracker/supplier/${s.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}
                  >
                    <td style={{ ...tdStyle, fontSize: 12 }}>{s.folio}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                    <td style={tdStyle}>{s.commodity}</td>
                    <td style={tdStyle}><IntelexLevelBadge level={s.intelex_currentLevel} compact /></td>
                    <td style={tdStyle}>{s.intelex_l3Real ?? '—'}</td>
                    <td style={tdStyle}>{s.buyer}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/tracker/supplier/${s.id}`); }}
                        title="Open in Tracker (editable)"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: ACCENT_COLORS.info }}
                      >
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Closed (terminal Completed stage) ─────────────────── */}
      <SectionHeader
        icon={faCircleCheck}
        title="Closed"
        count={sectionCount(sorted.length, completedSuppliers.length)}
        description="Suppliers that closed the handoff and completed the full SSD tracker cycle. Read-only."
      />
      {loadingClosed ? (
        <LoadingState entity="Suppliers" icon={moduleIcons.tracker} style={{ padding: '64px 32px' }} />
      ) : completedSuppliers.length === 0 ? (
        <EmptyState icon={faCircleCheck} title="No suppliers completed" description="No suppliers have completed the tracker yet." />
      ) : sorted.length === 0 ? (
        <EmptyState icon={faCircleCheck} title="No matches" description="No suppliers match the current filters." />
      ) : (
        <div className="bg-white" style={tableCard}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {([
                  { label: 'Folio',          field: 'folio' as COSortField },
                  { label: 'Supplier',       field: 'name' as COSortField },
                  { label: 'Country',        field: 'country' as COSortField },
                  { label: 'Commodity',      field: 'commodity' as COSortField },
                  { label: 'Buyer',          field: 'buyer' as COSortField },
                  { label: 'Completed Date', field: 'completedDate' as COSortField },
                  { label: 'Completed By',   field: 'completedBy' as COSortField },
                  { label: 'Actions',        field: null },
                ] as { label: string; field: COSortField | null }[]).map(col => {
                  const iconInfo = col.field ? sortIcon(col.field, sortField, sortDir) : null;
                  return (
                    <th
                      key={col.label}
                      onClick={col.field ? () => handleCOSort(col.field as COSortField) : undefined}
                      style={thStyle(!!col.field, !!col.field && sortField === col.field)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {col.label}
                        {iconInfo && <FontAwesomeIcon icon={iconInfo.icon} style={{ fontSize: 10, color: iconInfo.color }} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }}
                  onClick={() => navigate(`/tracker/completed/supplier/${s.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}
                >
                  <td style={{ ...tdStyle, fontSize: 12 }}>{s.folio}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                  <td style={tdStyle}>{s.country}</td>
                  <td style={tdStyle}>{s.commodity}</td>
                  <td style={tdStyle}>{s.buyer}</td>
                  <td style={tdStyle}>{s.completedDate}</td>
                  <td style={tdStyle}>{s.completedBy}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/tracker/completed/supplier/${s.id}`); }}
                      title="View detail"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: ACCENT_COLORS.info }}
                    >
                      <FontAwesomeIcon icon={faEye} style={{ fontSize: 15 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, count, description }: {
  icon: typeof faCircleCheck; title: string; count: string; description: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 14, color: getStageColor('Completed') }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#000000', margin: 0 }}>{title}</h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: BRAND_COLORS.sidebar, backgroundColor: BRAND_COLORS.background, padding: '2px 8px', borderRadius: 10 }}>
          {count}
        </span>
      </div>
      <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>{description}</p>
    </div>
  );
}
