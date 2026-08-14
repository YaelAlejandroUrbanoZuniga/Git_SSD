import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faArrowLeft, faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faBuilding } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TrackerSupplier, SLAStatus } from '../../types';
import { TRACKER_STAGE_CONFIG } from '../../constants/stage-config';
import { INTELEX_LEVELS } from '../../constants/intelex-levels';
import { getTrackerSuppliers } from '../../services/trackerService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor, slaLabels } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { moduleIcons } from '../../components/moduleIcons';
import { SupplierTrackerCard } from './SupplierTrackerCard';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

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
  // `?commodity=` (e.g. from a Reports matrix cell) only seeds the initial
  // value — the in-page dropdown and Clear button own it from then on.
  const [commodityFilter, setCommodityFilter] = useState(() => searchParams.get('commodity') ?? '');
  const [slaFilter, setSlaFilter] = useState<SLAStatus | ''>('');
  const [daysFilter, setDaysFilter] = useState<'gt' | 'lt' | ''>('');
  const [daysValue, setDaysValue] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const decodedStage = decodeURIComponent(stageName ?? '');
  const stageConfig = TRACKER_STAGE_CONFIG.find(s => s.name === decodedStage);

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

  const q = searchTerm.trim().toLowerCase();
  const filtered = stageSuppliers
    .filter(s => !q ||
                 s.name.toLowerCase().includes(q) ||
                 s.folio.toLowerCase().includes(q) ||
                 s.commodity.toLowerCase().includes(q) ||
                 s.buyer.toLowerCase().includes(q) ||
                 s.country.toLowerCase().includes(q))
    .filter(s => commodityFilter ? s.commodity === commodityFilter : true)
    .filter(s => slaFilter ? s.sla === slaFilter : true)
    .filter(s => {
      if (!daysFilter || !daysValue) return true;
      const days = s.daysInStage ?? 0;
      return daysFilter === 'gt' ? days > Number(daysValue) : days < Number(daysValue);
    });

  const hasActiveFilters = !!(searchTerm || commodityFilter || slaFilter || (daysFilter && daysValue));

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

        {/* Commodity filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={commodityFilter}
            onChange={e => setCommodityFilter(e.target.value)}
            style={{ padding: '8px 32px 8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 8, fontSize: 13, color: commodityFilter ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: BRAND_COLORS.cards, cursor: 'pointer', appearance: 'none', outline: 'none' }}
          >
            <option value="">Commodity</option>
            {[...new Set(stageSuppliers.map(s => s.commodity))].sort().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
        </div>

        {/* SLA status filter — sla is already on each supplier (backend-derived) */}
        <div style={{ position: 'relative' }}>
          <select
            value={slaFilter}
            onChange={e => setSlaFilter(e.target.value as SLAStatus | '')}
            style={{ padding: '8px 32px 8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 8, fontSize: 13, color: slaFilter ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: BRAND_COLORS.cards, cursor: 'pointer', appearance: 'none', outline: 'none' }}
          >
            <option value="">SLA status</option>
            {SLA_OPTIONS.map(s => <option key={s} value={s}>{slaLabels[s]}</option>)}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
        </div>

        {/* Days in stage filter */}
        <div className="flex items-center" style={{ gap: 4, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 8, padding: '4px 10px', backgroundColor: BRAND_COLORS.cards }}>
          <select
            value={daysFilter}
            onChange={e => setDaysFilter(e.target.value as 'gt' | 'lt' | '')}
            style={{ border: 'none', fontSize: 13, color: daysFilter ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: 'transparent', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Days in stage</option>
            <option value="gt">&gt; days</option>
            <option value="lt">&lt; days</option>
          </select>
          {daysFilter && (
            <input
              type="number"
              value={daysValue}
              onChange={e => setDaysValue(e.target.value)}
              placeholder="0"
              style={{ width: 44, border: 'none', fontSize: 13, color: '#000000', backgroundColor: 'transparent', outline: 'none' }}
            />
          )}
        </div>

        {/* Clear filters */}
        {(commodityFilter || slaFilter || daysFilter) && (
          <button
            onClick={() => { setCommodityFilter(''); setSlaFilter(''); setDaysFilter(''); setDaysValue(''); }}
            style={{ fontSize: 12, color: BRAND_COLORS.accentRed, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Intelex Handoff is the one stage with a sub-status inside it, so its
          board is grouped by level instead of one flat grid. Every other stage
          keeps the plain 3-per-row grid. */}
      {decodedStage === 'Intelex Handoff' ? (
        <IntelexLevelGroups suppliers={filtered} stageColor={getStageColor(decodedStage)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map(supplier => (
            <SupplierTrackerCard key={supplier.id} supplier={supplier} stageColor={getStageColor(decodedStage)} />
          ))}
        </div>
      )}

      {loading && <LoadingState entity="Suppliers" icon={moduleIcons.tracker} style={{ padding: '48px 0' }} />}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={faBuilding} title="No suppliers" description="No suppliers in this stage." />
      )}
    </div>
  );
}

// ── Intelex Handoff — the per-level grouping ──────────────────────────────────
//
// Intelex Handoff stays ONE stage: this only splits the cards already on the
// screen into the seven sub-levels of `intelex_currentLevel`. All seven are
// always listed, in sequence order, so the shape of the handoff is visible even
// where a level is empty; empty ones render collapsed and muted. Any level value
// outside the sequence (legacy rows) lands in a trailing "Other" group rather
// than silently disappearing from the board.
const OTHER_LEVEL = 'Other';

function IntelexLevelGroups({ suppliers, stageColor }: { suppliers: TrackerSupplier[]; stageColor: string }) {
  const groups: { level: string; items: TrackerSupplier[] }[] = INTELEX_LEVELS.map(level => ({
    level,
    items: suppliers.filter(s => s.intelex_currentLevel === level),
  }));
  const other = suppliers.filter(s => !(INTELEX_LEVELS as string[]).includes(s.intelex_currentLevel));
  if (other.length > 0) groups.push({ level: OTHER_LEVEL, items: other });

  // Collapsed by exception: a level the user closed. Empty levels start closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groups.filter(g => g.items.length === 0).map(g => g.level)),
  );
  const toggle = (level: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(group => {
        const isOpen = !collapsed.has(group.level);
        const empty = group.items.length === 0;
        return (
          <div key={group.level}>
            <button
              onClick={() => toggle(group.level)}
              aria-expanded={isOpen}
              className="flex items-center"
              style={{
                width: '100%', gap: 10, padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${empty ? NEUTRAL_COLORS.borderLight : `${stageColor}66`}`,
                backgroundColor: empty ? '#FAFAFA' : `${stageColor}14`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <FontAwesomeIcon
                icon={isOpen ? faChevronUp : faChevronDown}
                style={{ fontSize: 11, color: empty ? BRAND_COLORS.sidebar : stageColor }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: empty ? BRAND_COLORS.sidebar : '#000000' }}>
                {group.level}
              </span>
              <span style={{
                marginLeft: 'auto', minWidth: 22, padding: '1px 7px', borderRadius: 10,
                fontSize: 11, fontWeight: 700, textAlign: 'center',
                color: empty ? BRAND_COLORS.sidebar : stageColor,
                backgroundColor: empty ? BRAND_COLORS.background : `${stageColor}26`,
              }}>
                {group.items.length}
              </span>
            </button>

            {isOpen && (
              <div style={{ paddingTop: 12 }}>
                {empty ? (
                  <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: '0 0 4px', paddingLeft: 14 }}>
                    No suppliers at this level.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {group.items.map(supplier => (
                      <SupplierTrackerCard key={supplier.id} supplier={supplier} stageColor={stageColor} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
