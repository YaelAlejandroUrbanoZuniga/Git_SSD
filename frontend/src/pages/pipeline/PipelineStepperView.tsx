import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faCircleCheck, faBan } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { pipelineSuppliers, pipelineStageConfig, blacklistedSuppliers, completedSuppliers } from '../../data/pipeline-demo';
import { SupplierPipelineCard } from './SupplierPipelineCard';

const stageIconMap: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
};

const ACTIVE_RED = '#DC0202';

// Exploratory "stepper + side panels" reinterpretation of the Kanban board.
// Reuses the same underlying data (pipelineSuppliers / blacklistedSuppliers /
// completedSuppliers / pipelineStageConfig) and the shared SupplierPipelineCard
// so this stays purely a UI comparison, not a second source of truth.
export function PipelineStepperView() {
  const navigate = useNavigate();
  const [selectedStage, setSelectedStage] = useState<string>(pipelineStageConfig[0].name);

  const getSuppliersByStage = (stageName: string) => pipelineSuppliers.filter(s => s.stage === stageName);
  const activeSuppliers = getSuppliersByStage(selectedStage);
  const activeConfig = pipelineStageConfig.find(s => s.name === selectedStage);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: 0 }}>Pipeline Stepper</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '4px 0 0' }}>
          Exploratory layout — click a stage to review its suppliers. Completed and Blacklisted stay pinned on the right.
        </p>
      </div>

      <div className="flex" style={{ gap: 24, alignItems: 'flex-start' }}>
        {/* ── Main column: stepper + selected stage list ─────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex" style={{ gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
            {pipelineStageConfig.map((stage, idx) => {
              const count = getSuppliersByStage(stage.name).length;
              const isActive = stage.name === selectedStage;
              const icon = stageIconMap[stage.icon];

              return (
                <button
                  key={stage.name}
                  onClick={() => setSelectedStage(stage.name)}
                  style={{
                    flex: '1 1 0',
                    minWidth: 176,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: isActive ? `2px solid ${ACTIVE_RED}` : '1px solid #D1D3D4',
                    backgroundColor: isActive ? `${ACTIVE_RED}1F` : '#FFFFFF',
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.13)' : '0 1px 4px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.15s ease-out, background-color 0.15s',
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#FFFFFF',
                    backgroundColor: isActive ? ACTIVE_RED : stage.color,
                  }}>
                    {idx + 1}
                  </span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 11, color: isActive ? ACTIVE_RED : '#808285' }} />}
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: isActive ? ACTIVE_RED : '#000000',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {stage.name}
                      </span>
                    </div>
                    <span style={{
                      display: 'inline-block', marginTop: 4,
                      fontSize: 11, fontWeight: 700,
                      padding: '1px 7px', borderRadius: 4,
                      backgroundColor: isActive ? `${ACTIVE_RED}1F` : `${stage.color}1F`,
                      color: isActive ? ACTIVE_RED : stage.color,
                    }}>
                      {count} supplier{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>{selectedStage}</h3>
            <span style={{ fontSize: 12, color: '#808285' }}>
              {activeSuppliers.length} supplier{activeSuppliers.length !== 1 ? 's' : ''} in this stage
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {activeSuppliers.map(supplier => (
              <SupplierPipelineCard key={supplier.id} supplier={supplier} stageColor={activeConfig?.color ?? '#808285'} />
            ))}
          </div>

          {activeSuppliers.length === 0 && (
            <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '48px 0' }}>
              No suppliers in this stage.
            </p>
          )}
        </div>

        {/* ── Right sidebar: Completed / Blacklisted, always visible ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SidePanel
            title="Completed"
            icon={faCircleCheck}
            color="#6ABF4B"
            items={completedSuppliers.map(s => ({ id: s.id, name: s.name, commodity: s.commodity }))}
            onItemClick={id => navigate(`/pipeline/completed/supplier/${id}`)}
            emptyLabel="No completed suppliers yet."
          />
          <SidePanel
            title="Blacklisted"
            icon={faBan}
            color={ACTIVE_RED}
            items={blacklistedSuppliers.map(s => ({ id: s.id, name: s.name, commodity: s.commodity }))}
            onItemClick={id => navigate(`/pipeline/blacklisted/supplier/${id}?from=pipeline`)}
            emptyLabel="No blacklisted suppliers."
          />
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  title, icon, color, items, onItemClick, emptyLabel,
}: {
  title: string;
  icon: IconDefinition;
  color: string;
  items: { id: string; name: string; commodity: string }[];
  onItemClick: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div className="flex items-center justify-between" style={{ padding: '12px 16px', backgroundColor: color }}>
        <span className="flex items-center" style={{ gap: 8, fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
          <FontAwesomeIcon icon={icon} style={{ fontSize: 13 }} />
          {title}
        </span>
        <span style={{
          minWidth: 22, height: 22, padding: '0 6px', borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#FFFFFF',
        }}>
          {items.length}
        </span>
      </div>

      <div>
        {items.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item.id)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              borderBottom: idx === items.length - 1 ? 'none' : '1px solid #EEEEEE',
              borderRadius: idx === items.length - 1 ? '0 0 8px 8px' : 0,
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{item.name}</div>
            <div style={{ fontSize: 12, color: '#808285', marginTop: 2 }}>{item.commodity}</div>
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 16px', margin: 0 }}>
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}
