import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faMapMarkerAlt, faUser, faArrowLeft, faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { pipelineSuppliers, pipelineStageConfig } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { getDocsBarColor, getInfoCompletionPercent } from '../../utils/pipeline-helpers';

const stageIconMap: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
};
const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierStageCard({ supplier, stageColor }: { supplier: PipelineSupplier; stageColor: string }) {
  const navigate = useNavigate();
  const stage = supplier.stage;

  const displayBuyer = stage === 'Parking Lot'
    ? (supplier.parkingBuyer ?? supplier.buyer)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_buyer ?? supplier.buyer)
    : supplier.buyer;

  const displayCommodity = stage === 'Parking Lot'
    ? (supplier.parkingCommodity ?? supplier.commodity)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_commodity ?? supplier.commodity)
    : supplier.commodity;

  const displayProductType = stage === 'Parking Lot'
    ? supplier.parkingProductType
    : supplier.productType;

  const displayCountry = stage === 'Parking Lot'
    ? (supplier.parkingManufacturingCountry ?? supplier.country)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_manufacturingCountry ?? supplier.country)
    : supplier.country;

  const displayDays = stage === 'Parking Lot'
    ? (supplier.parkingDaysElapsed ?? supplier.daysInStage)
    : supplier.daysInStage;

  const displaySubStatus = supplier.subStatus ?? supplier.parkingSubStatus ?? null;

  const contextLine: string | null =
    stage === 'Scouting Event'
      ? (supplier.scoutingInput ?? null)
    : stage === 'Preliminary Evaluation'
      ? (supplier.prelim_primaryDriver ? `Driver: ${supplier.prelim_primaryDriver}` : null)
    : stage === 'Supplier Evaluation'
      ? (supplier.prelim_parts && supplier.prelim_parts.length > 0 && supplier.prelim_parts[0].partNumber
          ? `PN: ${supplier.prelim_parts[0].partNumber}` : null)
    : stage === 'Intelex Handoff'
      ? (supplier.intelex_investigateRecordNumber ? `Record #${supplier.intelex_investigateRecordNumber}` : null)
    : null;

  return (
    <div
      onClick={() => navigate(`/pipeline/supplier/${supplier.id}`)}
      className="bg-white"
      style={{ borderRadius: 8, padding: 20, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s ease-out', borderRight: `4px solid ${stageColor}` }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{supplier.name}</span>
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#3D3D3D', margin: '0 0 4px' }}>
        {displayCommodity}{displayProductType ? ` · ${displayProductType}` : ''}
      </p>

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 11, color: stageColor }} />
        {displayCountry}
      </p>

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faUser} style={{ fontSize: 11, color: stageColor }} />
        {displayBuyer}
      </p>

      {contextLine && (
        <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 6px', fontStyle: 'italic' }}>{contextLine}</p>
      )}

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 8px' }}>
        Days in stage: <span style={{ color: '#3D3D3D', fontWeight: 600 }}>{displayDays}</span>
      </p>

      {displaySubStatus && subStatusStyles[displaySubStatus] && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ backgroundColor: subStatusStyles[displaySubStatus].bg, color: subStatusStyles[displaySubStatus].text, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3 }}>
            {displaySubStatus}
          </span>
        </div>
      )}

      {(() => {
        const pct = getInfoCompletionPercent(supplier);
        return (
          <div className="flex items-center" style={{ gap: 8 }}>
            <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(pct), width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#808285' }}>{pct}%</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0 }} />
          </div>
        );
      })()}
    </div>
  );
}

export function PipelineStage() {
  const { stageName } = useParams<{ stageName: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState<'gt' | 'lt' | ''>('');
  const [daysValue, setDaysValue] = useState('');
  const navigate = useNavigate();
  const decodedStage = decodeURIComponent(stageName ?? '');
  const stageConfig = pipelineStageConfig.find(s => s.name === decodedStage);
  const stageSuppliers = pipelineSuppliers.filter(s => s.stage === decodedStage);

  const filtered = stageSuppliers
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 s.commodity.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(s => commodityFilter ? s.commodity === commodityFilter : true)
    .filter(s => {
      if (!daysFilter || !daysValue) return true;
      const days = s.daysInStage ?? 0;
      return daysFilter === 'gt' ? days > Number(daysValue) : days < Number(daysValue);
    });

  const hasActiveFilters = !!(searchTerm || commodityFilter || (daysFilter && daysValue));

  return (
    <div>
      {/* ── Stage Hero Header ─────────────────────────────────── */}
      <div style={{
        backgroundColor: stageConfig?.color ?? '#808285',
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
              onClick={() => navigate('/pipeline')}
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
            href="/pipeline"
            onClick={e => { e.preventDefault(); navigate('/pipeline'); }}
            style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}
          >
            Pipeline
          </a>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{decodedStage}</span>
        </span>
      </nav>

      {/* Search + filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 auto' }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text" placeholder="Search supplier..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>

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
        {(commodityFilter || daysFilter) && (
          <button
            onClick={() => { setCommodityFilter(''); setDaysFilter(''); setDaysValue(''); }}
            style={{ fontSize: 12, color: '#DC0202', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid of cards - 3 per row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(supplier => (
          <SupplierStageCard key={supplier.id} supplier={supplier} stageColor={stageConfig?.color ?? '#808285'} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '48px 0' }}>
          No suppliers in this stage.
        </p>
      )}
    </div>
  );
}
