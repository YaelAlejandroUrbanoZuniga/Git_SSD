import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCircleCheck, faClipboard, faUser, faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { pipelineSuppliers, pipelineStageConfig, blacklistedSuppliers, completedSuppliers } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { getDocsBarColor, getInfoCompletionPercent } from '../../utils/pipeline-helpers';
import { AddSupplierModal } from '../suppliers/AddSupplierModal';

const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const stageIconMap: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
};
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierCard({ supplier, stageColor, isLast }: { supplier: PipelineSupplier; stageColor: string; isLast: boolean }) {
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
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        borderLeft: `3px solid ${stageColor}`,
        borderBottom: isLast ? 'none' : '1px solid #EEEEEE',
        borderRadius: isLast ? '0 0 8px 8px' : 0,
        backgroundColor: '#FFFFFF',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
    >
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{supplier.name}</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#3D3D3D', margin: '0 0 2px' }}>{displayCommodity}</p>
      {displayProductType && (
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: '0 0 4px' }}>{displayProductType}</p>
      )}
      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faUser} style={{ fontSize: 10, color: stageColor }} />
        {displayBuyer}
      </p>
      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px' }}>
        Days in stage: <span style={{ color: '#3D3D3D', fontWeight: 600 }}>{displayDays}</span>
      </p>
      {contextLine && (
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: '0 0 4px', fontStyle: 'italic' }}>
          {contextLine}
        </p>
      )}
      {displaySubStatus && subStatusStyles[displaySubStatus] && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            backgroundColor: subStatusStyles[displaySubStatus].bg,
            color: subStatusStyles[displaySubStatus].text,
            fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
          }}>
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
            <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>{pct}%</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0, display: 'inline-block' }} />
          </div>
        );
      })()}
    </div>
  );
}

export function PipelineKanban() {
  const navigate = useNavigate();
  const [showFormsModal, setShowFormsModal] = useState(false);

  const getSuppliersByStage = (stageName: string) =>
    pipelineSuppliers.filter(s => s.stage === stageName);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Pipeline</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Supplier Tracking Kanban
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button
            onClick={() => setShowFormsModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 8, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <FontAwesomeIcon icon={faClipboard} style={{ fontSize: 12 }} /> Forms
          </button>
        </div>
      </div>

      {/* Blacklisted access card */}
      <div className="flex" style={{ gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => navigate('/pipeline/blacklisted')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #E0E0E0', transition: 'box-shadow 0.15s ease-out' }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#DC020215', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faBan} style={{ fontSize: 16, color: '#DC0202' }} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000000', display: 'block' }}>Blacklisted</span>
            <span style={{ fontSize: 12, color: '#808285' }}>{blacklistedSuppliers.length} rejected suppliers</span>
          </div>
        </div>
        <div
          onClick={() => navigate('/pipeline/completed')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #E0E0E0', transition: 'box-shadow 0.15s ease-out' }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#6ABF4B15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 16, color: '#6ABF4B' }} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000000', display: 'block' }}>Completed</span>
            <span style={{ fontSize: 12, color: '#808285' }}>{completedSuppliers.length} approved suppliers</span>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div className="flex" style={{ gap: 16, minWidth: 'max-content' }}>
          {pipelineStageConfig.map((stage) => {
            const stageSuppliers = getSuppliersByStage(stage.name);
            const displayed = stageSuppliers.slice(0, 3);
            const hasMore = stageSuppliers.length > 3;

            return (
              <div key={stage.name} style={{ width: 280, flexShrink: 0, borderRadius: 10, backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div
                  className="flex items-center justify-between"
                  style={{ padding: '12px 16px', backgroundColor: stage.color, cursor: 'pointer' }}
                  onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                >
                  <div className="flex items-center" style={{ gap: 8 }}>
                    {stageIconMap[stage.icon] && (
                      <FontAwesomeIcon icon={stageIconMap[stage.icon]} style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }} />
                    )}
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#FFFFFF' }}>{stage.name}</span>
                  </div>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
                    {stageSuppliers.length}
                  </span>
                </div>

                {/* Column body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {displayed.map((supplier, idx) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      stageColor={stage.color}
                      isLast={!hasMore && idx === displayed.length - 1}
                    />
                  ))}
                  {stageSuppliers.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '32px 0', margin: 0 }}>No suppliers</p>
                  )}
                </div>

                {/* Footer link */}
                {hasMore && (
                  <button
                    onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                    style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', textAlign: 'center', padding: '12px 16px', background: 'none', border: 'none', borderTop: '1px solid #EEEEEE', cursor: 'pointer', width: '100%' }}
                  >
                    View all ({stageSuppliers.length}) &rarr;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showFormsModal && <AddSupplierModal onClose={() => setShowFormsModal(false)} />}
    </div>
  );
}
