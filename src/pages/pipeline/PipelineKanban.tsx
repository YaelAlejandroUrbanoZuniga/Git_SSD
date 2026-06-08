import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardList, faBan, faPlus, faClipboard } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, pipelineStageConfig, blacklistedSuppliers, mrlRequirements, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';
import { AddSupplierModal } from '../suppliers/AddSupplierModal';
import { AddScoutingModal } from './AddScoutingModal';
import { AddParkingModal } from './AddParkingModal';

const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierCard({ supplier, stageColor, isLast }: { supplier: PipelineSupplier; stageColor: string; isLast: boolean }) {
  const navigate = useNavigate();
  const isScouting = supplier.stage === 'Scouting Event';
  const isParkingLot = supplier.stage === 'Parking Lot';
  const isRecommendation = supplier.entrySource === 'Recommendation';

  return (
    <div
      onClick={() => navigate(`/pipeline/supplier/${supplier.id}`)}
      style={{
        padding: '12px 14px',
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
      <div className="flex items-start justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#000000' }}>{supplier.name}</span>
        <div className="flex items-center" style={{ gap: 4 }}>
          {isScouting && supplier.scoutingPhase === 'B2B' && (
            <span style={{ backgroundColor: '#6366F126', color: '#6366F1', fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 3 }}>B2B</span>
          )}
          {isParkingLot && isRecommendation && (
            <span style={{ backgroundColor: '#E3650B26', color: '#E3650B', fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 3 }}>Rec</span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 2px' }}>{supplier.commodity}</p>
      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 4px' }}>Days in stage: {supplier.daysInStage}</p>
      {supplier.subStatus && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            backgroundColor: subStatusStyles[supplier.subStatus].bg,
            color: subStatusStyles[supplier.subStatus].text,
            fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
          }}>
            {supplier.subStatus}
          </span>
        </div>
      )}
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(supplier.docsPercent), width: `${supplier.docsPercent}%` }} />
        </div>
        <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>Docs {supplier.docsPercent}%</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0, display: 'inline-block' }} />
      </div>
    </div>
  );
}

export function PipelineKanban() {
  const navigate = useNavigate();
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [showAddScoutingModal, setShowAddScoutingModal] = useState(false);
  const [showAddParkingModal, setShowAddParkingModal] = useState(false);

  const getSuppliersByStage = (stageName: string) =>
    pipelineSuppliers.filter(s => s.stage === stageName);

  const openMrlCount = mrlRequirements.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Pipeline</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Supplier tracking Kanban
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

      {/* MRL + Blacklisted access cards */}
      <div className="flex" style={{ gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => navigate('/pipeline/mrl')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #E0E0E0', transition: 'box-shadow 0.15s ease-out' }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#02B3E115', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 16, color: '#02B3E1' }} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000000', display: 'block' }}>MRL Requirements</span>
            <span style={{ fontSize: 12, color: '#808285' }}>{openMrlCount} requirement{openMrlCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

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
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div className="flex" style={{ gap: 16, minWidth: 'max-content' }}>
          {pipelineStageConfig.map((stage) => {
            const stageSuppliers = getSuppliersByStage(stage.name);
            const displayed = stageSuppliers.slice(0, 3);
            const hasMore = stageSuppliers.length > 3;

            return (
              <div key={stage.name} style={{ width: 240, flexShrink: 0, borderRadius: 10, backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div
                  className="flex items-center justify-between"
                  style={{ padding: '12px 16px', backgroundColor: stage.color, cursor: 'pointer' }}
                  onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#FFFFFF' }}>{stage.name}</span>
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

                {/* Add supplier (context-aware) */}
                {(stage.name === 'Scouting Event' || stage.name === 'Parking Lot') && (
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #EEEEEE' }}>
                    <button
                      onClick={() => stage.name === 'Scouting Event' ? setShowAddScoutingModal(true) : setShowAddParkingModal(true)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '7px 0', fontSize: 12, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#808285', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#DC0202'; e.currentTarget.style.color = '#DC0202'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D3D4'; e.currentTarget.style.color = '#808285'; }}
                    >
                      <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Add Supplier
                    </button>
                  </div>
                )}

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
      {showAddScoutingModal && <AddScoutingModal onClose={() => setShowAddScoutingModal(false)} />}
      {showAddParkingModal && <AddParkingModal onClose={() => setShowAddParkingModal(false)} />}
    </div>
  );
}
