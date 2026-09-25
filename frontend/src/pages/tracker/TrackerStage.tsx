import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faBuilding } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TrackerSupplier, SLAStatus } from '../../types';
import { TRACKER_STAGE_CONFIG } from '../../constants/stage-config';
import { STAGE_FILTER_CONFIG } from './stageFilterConfig';
import { getTrackerSuppliers } from '../../services/trackerService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor, slaLabels } from '../../utils/tracker-helpers';
import { filterBySearch } from '../../utils/search-filter';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { FilterField } from '../../components/FilterField';
import { CatalogSelect } from '../../components/CatalogSelect';
import { NumberOperatorFilter } from '../../components/NumberOperatorFilter';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { moduleIcons } from '../../components/moduleIcons';
import { SupplierTrackerCard } from './SupplierTrackerCard';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

const slaSelectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
  fontSize: 13, color: '#000000', backgroundColor: BRAND_COLORS.cards, outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
};

const SLA_OPTIONS: SLAStatus[] = ['green', 'yellow', 'red'];

const stageIconMap: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
};

export function TrackerStage() {
  const { stageName } = useParams<{ stageName: string }>();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState<SLAStatus | ''>('');
  const [daysFilter, setDaysFilter] = useState<'gt' | 'lt' | ''>('');
  const [daysValue, setDaysValue] = useState('');
  // Stage-specific filter values, keyed by each STAGE_FILTER_CONFIG entry's `key`.
  const [stageFilterValues, setStageFilterValues] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const toast = useToast();
  const decodedStage = decodeURIComponent(stageName ?? '');
  const stageConfig = TRACKER_STAGE_CONFIG.find(s => s.name === decodedStage);
  const stageFilters = STAGE_FILTER_CONFIG[decodedStage as TrackerSupplier['stage']] ?? [];

  const [stageSuppliers, setStageSuppliers] = useState<TrackerSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  // The API already filters the board to Direct material and ACTIVE+COMPLETED.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrackerSuppliers(decodedStage as TrackerSupplier['stage'])
      .then(list => { if (!cancelled) setStageSuppliers(list); })
      .catch(err => {
        if (cancelled) return;
        toast.systemError(
          err instanceof ApiError ? err.message : 'Could not load the suppliers for this stage.',
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [decodedStage, toast]);

  // Every filter (search + all globals + all stage-specific) resets on a stage
  // change, then re-seeds from the URL (`?commodity=`, `?buyer=`, … and one per
  // stage-specific filter key) the same way the initial load already did — so a
  // direct link like `?buyer=Acme` still opens pre-filtered on first mount.
  useEffect(() => {
    setSearchTerm('');
    setCommodityFilter(searchParams.get('commodity') ?? '');
    setBuyerFilter(searchParams.get('buyer') ?? '');
    setCountryFilter(searchParams.get('country') ?? '');
    setSlaFilter((searchParams.get('sla') as SLAStatus | null) ?? '');
    setDaysFilter((searchParams.get('daysOperator') as 'gt' | 'lt' | null) ?? '');
    setDaysValue(searchParams.get('daysValue') ?? '');
    const seeded: Record<string, string> = {};
    (STAGE_FILTER_CONFIG[decodedStage as TrackerSupplier['stage']] ?? []).forEach(f => {
      seeded[f.key] = searchParams.get(f.key) ?? '';
    });
    setStageFilterValues(seeded);
    // Only the stage should trigger a reset — not every render where the (stable)
    // searchParams reference happens to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedStage]);

  const filtered = filterBySearch(stageSuppliers, searchTerm, s =>
    [s.name, s.folio, s.commodity, s.buyer, s.country])
    .filter(s => commodityFilter ? s.commodity === commodityFilter : true)
    .filter(s => buyerFilter ? s.buyer === buyerFilter : true)
    .filter(s => countryFilter ? s.country === countryFilter : true)
    .filter(s => slaFilter ? s.sla === slaFilter : true)
    .filter(s => {
      if (!daysFilter || !daysValue) return true;
      const days = s.daysInStage ?? 0;
      return daysFilter === 'gt' ? days > Number(daysValue) : days < Number(daysValue);
    })
    .filter(s => stageFilters.every(f => {
      const value = stageFilterValues[f.key];
      return value ? f.matches(s, value) : true;
    }));

  const stageFilterActiveCount = Object.values(stageFilterValues).filter(Boolean).length;
  const hasActiveFilters = !!(
    searchTerm || commodityFilter || buyerFilter || countryFilter || slaFilter ||
    (daysFilter && daysValue) || stageFilterActiveCount > 0
  );
  const activeFilterCount = (commodityFilter ? 1 : 0) + (buyerFilter ? 1 : 0) + (countryFilter ? 1 : 0) +
    (slaFilter ? 1 : 0) + (daysFilter && daysValue ? 1 : 0) + stageFilterActiveCount;
  const clearFilters = () => {
    setCommodityFilter(''); setBuyerFilter(''); setCountryFilter('');
    setSlaFilter(''); setDaysFilter(''); setDaysValue(''); setStageFilterValues({});
  };

  return (
    <div>
      {/* ── Stage Hero Header ─────────────────────────────────── */}
      <div style={{
        backgroundColor: getStageColor(decodedStage),
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
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => navigate('/tracker')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
            </button>
          </div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            {stageConfig?.icon && stageIconMap[stageConfig.icon] && (
              <FontAwesomeIcon icon={stageIconMap[stageConfig.icon]} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            )}
            <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: 0, letterSpacing: '-0.02em' }}>
              {decodedStage}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {hasActiveFilters
              ? `${filtered.length} of ${stageSuppliers.length} suppliers`
              : `${stageSuppliers.length} supplier${stageSuppliers.length !== 1 ? 's' : ''} in this stage`}
          </p>
        </div>
      </div>

      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <a
            href="/tracker"
            onClick={e => { e.preventDefault(); navigate('/tracker'); }}
            style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}
          >
            Tracker
          </a>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{decodedStage}</span>
        </span>
      </nav>

      {/* Search + filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search supplier, folio, buyer, country..."
          style={{ flex: '1 1 auto', maxWidth: 'none' }}
        />

        <FilterPanel activeCount={activeFilterCount} onClearAll={clearFilters}>
          {/* Global filters — same 5, same order, on every stage. */}
          <FilterField label="Commodity">
            <CatalogSelect
              value={commodityFilter}
              onChange={setCommodityFilter}
              options={[...new Set(stageSuppliers.map(s => s.commodity))].sort()}
              placeholder="All commodities"
            />
          </FilterField>

          <FilterField label="Buyer">
            <CatalogSelect
              value={buyerFilter}
              onChange={setBuyerFilter}
              options={[...new Set(stageSuppliers.map(s => s.buyer))].sort()}
              placeholder="All buyers"
            />
          </FilterField>

          <FilterField label="Country">
            <CatalogSelect
              value={countryFilter}
              onChange={setCountryFilter}
              options={[...new Set(stageSuppliers.map(s => s.country))].sort()}
              placeholder="All countries"
            />
          </FilterField>

          {/* SLA status filter — sla is already on each supplier (backend-derived) */}
          <FilterField label="SLA status">
            <select
              value={slaFilter}
              onChange={e => setSlaFilter(e.target.value as SLAStatus | '')}
              style={slaSelectStyle}
            >
              <option value="">All statuses</option>
              {SLA_OPTIONS.map(s => <option key={s} value={s}>{slaLabels[s]}</option>)}
            </select>
          </FilterField>

          {/* Days in stage filter */}
          <FilterField label="Days in stage">
            <NumberOperatorFilter
              operator={daysFilter}
              onOperatorChange={setDaysFilter}
              value={daysValue}
              onValueChange={setDaysValue}
              placeholder="Select…"
              gtLabel="> days"
              ltLabel="< days"
            />
          </FilterField>

          {/* Stage-specific filters, declared in STAGE_FILTER_CONFIG. */}
          {stageFilters.length > 0 && (
            <div style={{
              gridColumn: '1 / -1', marginTop: 4, paddingTop: 10,
              borderTop: `1px solid ${NEUTRAL_COLORS.borderLight}`,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
            }}>
              <span style={{
                gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {decodedStage}
              </span>
              {stageFilters.map(f => (
                <FilterField key={f.key} label={f.label}>
                  <CatalogSelect
                    value={stageFilterValues[f.key] ?? ''}
                    onChange={v => setStageFilterValues(prev => ({ ...prev, [f.key]: v }))}
                    options={f.getOptions(stageSuppliers)}
                    placeholder="All"
                  />
                </FilterField>
              ))}
            </div>
          )}
        </FilterPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(supplier => (
          <SupplierTrackerCard key={supplier.id} supplier={supplier} stageColor={getStageColor(decodedStage)} />
        ))}
      </div>

      {loading && <LoadingState entity="Suppliers" icon={moduleIcons.tracker} style={{ padding: '48px 0' }} />}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={faBuilding} title="No suppliers" description="No suppliers in this stage." />
      )}
    </div>
  );
}
