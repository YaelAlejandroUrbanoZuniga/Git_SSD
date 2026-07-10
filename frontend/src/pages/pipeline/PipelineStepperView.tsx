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

const PREVIEW_LIMIT = 4;

// Exploratory "stepper + side panels" reinterpretation of the Kanban board.
// Reuses the same underlying data (pipelineSuppliers / blacklistedSuppliers /
// completedSuppliers / pipelineStageConfig) and the shared SupplierPipelineCard
// so this stays purely a UI comparison, not a second source of truth.
//
// Everything starts collapsed. Clicking a stage/Completed/Blacklisted pill
// expands a single bounded preview box (max PREVIEW_LIMIT items) below it;
// clicking another pill swaps which one is expanded. The full lists still
// live on their existing screens (PipelineStage / PipelineCompleted /
// PipelineBlacklisted) — this view only teases them.
export function PipelineStepperView() {
  const navigate = useNavigate();
  // null = everything collapsed. Otherwise a stage name, or 'completed' / 'blacklisted'.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const getSuppliersByStage = (stageName: string) => pipelineSuppliers.filter(s => s.stage === stageName);

  const toggle = (key: string) => setExpandedKey(prev => (prev === key ? null : key));

  const expandedStageConfig = pipelineStageConfig.find(s => s.name === expandedKey);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: 0 }}>Pipeline Stepper</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '4px 0 0' }}>
          Exploratory layout — click a stage, Completed or Blacklisted to preview it.
        </p>
      </div>

      <div className="flex" style={{ gap: 24, alignItems: 'flex-start' }}>
        {/* ── Main column: stepper pills + expanded stage preview ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex" style={{ gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {pipelineStageConfig.map(stage => {
              const count = getSuppliersByStage(stage.name).length;
              const icon = stageIconMap[stage.icon];
              const isExpanded = expandedKey === stage.name;

              return (
                <StagePill
                  key={stage.name}
                  label={stage.name}
                  count={count}
                  color={stage.color}
                  icon={icon}
                  isExpanded={isExpanded}
                  onClick={() => toggle(stage.name)}
                />
              );
            })}
          </div>

          {expandedKey && expandedStageConfig && (
            <StagePreviewBox
              stageName={expandedKey}
              stageColor={expandedStageConfig.color}
              suppliers={getSuppliersByStage(expandedKey)}
              onNavigateToStage={() => navigate(`/pipeline/stage/${encodeURIComponent(expandedKey)}`)}
            />
          )}
        </div>

        {/* ── Right sidebar: Completed / Blacklisted collapsible pills ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StagePill
            label="Completed"
            count={completedSuppliers.length}
            color="#6ABF4B"
            icon={faCircleCheck}
            isExpanded={expandedKey === 'completed'}
            onClick={() => toggle('completed')}
          />
          {expandedKey === 'completed' && (
            <ListPreviewBox
              items={completedSuppliers.map(s => ({ id: s.id, name: s.name, commodity: s.commodity }))}
              onItemClick={id => navigate(`/pipeline/completed/supplier/${id}`)}
              onNavigateToAll={() => navigate('/pipeline/completed')}
              totalCount={completedSuppliers.length}
              emptyLabel="No completed suppliers yet."
            />
          )}

          <StagePill
            label="Blacklisted"
            count={blacklistedSuppliers.length}
            color="#DC0202"
            icon={faBan}
            isExpanded={expandedKey === 'blacklisted'}
            onClick={() => toggle('blacklisted')}
          />
          {expandedKey === 'blacklisted' && (
            <ListPreviewBox
              items={blacklistedSuppliers.map(s => ({ id: s.id, name: s.name, commodity: s.commodity }))}
              onItemClick={id => navigate(`/pipeline/blacklisted/supplier/${id}?from=pipeline`)}
              onNavigateToAll={() => navigate('/pipeline/blacklisted')}
              totalCount={blacklistedSuppliers.length}
              emptyLabel="No blacklisted suppliers."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Solid-color pill, same visual language as the Kanban column header
// (PipelineKanban.tsx ~L233-247): solid stage.color background, white
// icon + name, translucent white circular count badge.
function StagePill({
  label, count, color, icon, isExpanded, onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon?: IconDefinition;
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between"
      style={{
        flex: '1 1 0',
        minWidth: 176,
        gap: 10,
        padding: '12px 16px',
        borderRadius: 8,
        cursor: 'pointer',
        border: 'none',
        backgroundColor: color,
        boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.10)',
        transition: 'box-shadow 0.15s ease-out',
      }}
    >
      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
        {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }} />}
        <span style={{
          fontWeight: 700, fontSize: 13, color: '#FFFFFF',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
      </div>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        backgroundColor: 'rgba(255,255,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#FFFFFF',
      }}>
        {count}
      </span>
    </button>
  );
}

// Single white card, full width of the main column. Clicking anywhere on it
// (except a supplier card) goes to the full PipelineStage screen. Shows only
// the most recently arrived suppliers (lowest daysInStage first).
function StagePreviewBox({
  stageName, stageColor, suppliers, onNavigateToStage,
}: {
  stageName: string;
  stageColor: string;
  suppliers: import('../../types').PipelineSupplier[];
  onNavigateToStage: () => void;
}) {
  const preview = [...suppliers]
    .sort((a, b) => (a.daysInStage ?? 0) - (b.daysInStage ?? 0))
    .slice(0, PREVIEW_LIMIT);

  return (
    <div
      onClick={onNavigateToStage}
      className="bg-white"
      style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, cursor: 'pointer' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>{stageName}</h3>
        <span style={{ fontSize: 12, color: '#808285' }}>
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} in this stage
        </span>
      </div>

      {preview.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${preview.length}, minmax(0, 1fr))`, gap: 16 }}>
          {preview.map(supplier => (
            <div key={supplier.id} onClick={e => e.stopPropagation()}>
              <SupplierPipelineCard supplier={supplier} stageColor={stageColor} />
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '24px 0', margin: 0 }}>
          No suppliers in this stage.
        </p>
      )}

      {suppliers.length > 0 && (
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0084C0', textDecoration: 'none' }}>
            View all ({suppliers.length}) &rarr;
          </span>
        </div>
      )}
    </div>
  );
}

// Compact "name + commodity" list used by the Completed / Blacklisted
// expanded pills. Clicking the box goes to the full existing screen;
// clicking an individual row goes straight to that supplier's detail.
function ListPreviewBox({
  items, onItemClick, onNavigateToAll, totalCount, emptyLabel,
}: {
  items: { id: string; name: string; commodity: string }[];
  onItemClick: (id: string) => void;
  onNavigateToAll: () => void;
  totalCount: number;
  emptyLabel: string;
}) {
  const preview = items.slice(0, PREVIEW_LIMIT);

  return (
    <div
      onClick={onNavigateToAll}
      className="bg-white"
      style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '4px 0', cursor: 'pointer' }}
    >
      {preview.map((item, idx) => (
        <div
          key={item.id}
          onClick={e => { e.stopPropagation(); onItemClick(item.id); }}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            borderBottom: idx === preview.length - 1 ? 'none' : '1px solid #EEEEEE',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#808285', marginTop: 2 }}>{item.commodity}</div>
        </div>
      ))}

      {preview.length === 0 && (
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 16px', margin: 0 }}>
          {emptyLabel}
        </p>
      )}

      {totalCount > 0 && (
        <div style={{ padding: '10px 16px 6px', textAlign: 'right', borderTop: preview.length > 0 ? '1px solid #EEEEEE' : 'none' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0084C0', textDecoration: 'none' }}>
            View all ({totalCount}) &rarr;
          </span>
        </div>
      )}
    </div>
  );
}
