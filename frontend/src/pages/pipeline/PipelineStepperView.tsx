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

// View-local color override — keeps Kanban's shared pipelineStageConfig
// untouched while giving this view its own Scouting Event color.
const stepperColorOverrides: Record<string, string> = {
  'Scouting Event': '#00C39C',
};

const PREVIEW_LIMIT = 6;

// Exploratory "vertical accordion" reinterpretation of the Kanban board.
// Reuses the same underlying data (pipelineSuppliers / blacklistedSuppliers /
// completedSuppliers / pipelineStageConfig) and the shared SupplierPipelineCard
// so this stays purely a UI comparison, not a second source of truth.
//
// Completed / Blacklisted are top-of-page shortcut buttons that navigate
// straight to their existing full screens. Stages are a full-width vertical
// accordion: clicking a stage expands its preview directly below it; only
// one stage is expanded at a time.
export function PipelineStepperView() {
  const navigate = useNavigate();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const getSuppliersByStage = (stageName: string) => pipelineSuppliers.filter(s => s.stage === stageName);

  const toggleStage = (key: string) => setExpandedStage(prev => (prev === key ? null : key));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Pipeline Stepper</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Supplier Tracking Kanban
          </p>
      </div>

      {/* ── Top shortcuts: Completed / Blacklisted go straight to their full screens ── */}
      <div className="flex items-center justify-end" style={{ gap: 12, marginBottom: 20 }}>
        <ShortcutButton
          label="Completed"
          count={completedSuppliers.length}
          color="#6ABF4B"
          icon={faCircleCheck}
          onClick={() => navigate('/pipeline/completed')}
        />
        <ShortcutButton
          label="Blacklisted"
          count={blacklistedSuppliers.length}
          color="#DC0202"
          icon={faBan}
          onClick={() => navigate('/pipeline/blacklisted')}
        />
      </div>

      {/* ── Stages: full-width vertical accordion ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pipelineStageConfig.map(stage => {
          const count = getSuppliersByStage(stage.name).length;
          const icon = stageIconMap[stage.icon];
          const isExpanded = expandedStage === stage.name;
          const color = stepperColorOverrides[stage.name] ?? stage.color;

          return (
            <div key={stage.name}>
              <StagePill
                label={stage.name}
                count={count}
                color={color}
                icon={icon}
                isExpanded={isExpanded}
                onClick={() => toggleStage(stage.name)}
              />
              {isExpanded && (
                <div style={{ marginTop: 8 }}>
                  <StagePreviewBox
                    stageName={stage.name}
                    stageColor={color}
                    suppliers={getSuppliersByStage(stage.name)}
                    onNavigateToStage={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fixed-size secondary button for the top-of-page Completed / Blacklisted
// shortcuts. Same solid-color + icon + badge language as StagePill, but a
// smaller footprint since it navigates directly instead of expanding.
function ShortcutButton({
  label, count, color, icon, onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: IconDefinition;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between"
      style={{
        width: 210,
        gap: 10,
        padding: '10px 16px',
        borderRadius: 8,
        cursor: 'pointer',
        border: 'none',
        backgroundColor: color,
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      }}
    >
      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }} />
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

// Solid-color pill, same visual language as the Kanban column header
// (PipelineKanban.tsx ~L233-247): solid stage.color background, white
// icon + name, translucent white circular count badge. Full-width row
// in the vertical accordion.
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
        width: '100%',
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

// Single white card, full width, shown directly below its stage pill in the
// accordion. Clicking anywhere on it (except a supplier card) goes to the
// full PipelineStage screen. Shows up to PREVIEW_LIMIT most recently
// arrived suppliers (lowest daysInStage first) in a fixed 3-column grid.
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
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: 0 }}>{stageName}</h3>
        <span style={{ fontSize: 12, color: '#808285' }}>
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} in this stage
        </span>
      </div>

      {preview.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0084C0', textDecoration: 'none' }}>
            View all ({suppliers.length}) &rarr;
          </span>
        </div>
      )}
    </div>
  );
}
