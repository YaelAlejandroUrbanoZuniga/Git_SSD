import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faArrowLeft, faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faColumns } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TrackerSupplier, SLAStatus } from '../../types';
import { TRACKER_STAGE_CONFIG } from '../../constants/stage-config';
import { getTrackerSuppliers } from '../../services/trackerService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor, slaLabels } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { SupplierTrackerCard } from './SupplierTrackerCard';

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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s' }}
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
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
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
        <span style={{ fontSize: 12, color: '#808285' }}>
          <a
            href="/tracker"
            onClick={e => { e.preventDefault(); navigate('/tracker'); }}
            style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}
          >
            Tracker
          </a>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
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
            style={{ padding: '8px 32px 8px 12px', border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: commodityFilter ? '#000000' : '#808285', backgroundColor: '#FFFFFF', cursor: 'pointer', appearance: 'none', outline: 'none' }}
          >
            <option value="">Commodity</option>
            {[...new Set(stageSuppliers.map(s => s.commodity))].sort().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
        </div>

        {/* SLA status filter — sla is already on each supplier (backend-derived) */}
        <div style={{ position: 'relative' }}>
          <select
            value={slaFilter}
            onChange={e => setSlaFilter(e.target.value as SLAStatus | '')}
            style={{ padding: '8px 32px 8px 12px', border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: slaFilter ? '#000000' : '#808285', backgroundColor: '#FFFFFF', cursor: 'pointer', appearance: 'none', outline: 'none' }}
          >
            <option value="">SLA status</option>
            {SLA_OPTIONS.map(s => <option key={s} value={s}>{slaLabels[s]}</option>)}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
        </div>

        {/* Days in stage filter */}
        <div className="flex items-center" style={{ gap: 4, border: '1px solid #D1D3D4', borderRadius: 8, padding: '4px 10px', backgroundColor: '#FFFFFF' }}>
          <select
            value={daysFilter}
            onChange={e => setDaysFilter(e.target.value as 'gt' | 'lt' | '')}
            style={{ border: 'none', fontSize: 13, color: daysFilter ? '#000000' : '#808285', backgroundColor: 'transparent', outline: 'none', cursor: 'pointer' }}
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
            style={{ fontSize: 12, color: '#DC0202', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid of cards - 3 per row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(supplier => (
          <SupplierTrackerCard key={supplier.id} supplier={supplier} stageColor={getStageColor(decodedStage)} />
        ))}
      </div>

      {loading && <LoadingState entity="Suppliers" icon={faColumns} style={{ justifyContent: 'center', padding: '48px 0' }} />}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '48px 0' }}>
          No suppliers in this stage.
        </p>
      )}
    </div>
  );
}
