import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faCircleCheck, faBan, faChevronDown, faChevronUp, faColumns } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { BlacklistedSupplier, CompletedSupplier, TrackerSupplier } from '../../types';
import { TRACKER_STAGE_CONFIG } from '../../constants/stage-config';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { SupplierTrackerCard } from './SupplierTrackerCard';

const stageIconMap: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
  'fa-circle-check':    faCircleCheck,
};

const PREVIEW_LIMIT = 6;

// Vertical accordion of stages; Blacklisted is a top-of-page shortcut.
export function TrackerStepperView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const [trackerSuppliers, setTrackerSuppliers] = useState<TrackerSupplier[]>([]);
  const [blacklistedSuppliers, setBlacklistedSuppliers] = useState<BlacklistedSupplier[]>([]);
  const [completedSuppliers, setCompletedSuppliers] = useState<CompletedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers()])
      .then(([tracker, blacklisted, completed]) => {
        if (cancelled) return;
        setTrackerSuppliers(tracker);
        setBlacklistedSuppliers(blacklisted);
        setCompletedSuppliers(completed);
      })
      .catch(err => {
        if (cancelled) return;
        toast.systemError(
          err instanceof ApiError ? err.message : 'Could not load the tracker.',
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const getSuppliersByStage = (stageName: string) =>
    trackerSuppliers.filter(s => s.stage === stageName);

  const toggleStage = (key: string) => setExpandedStage(prev => (prev === key ? null : key));

  const accordionStages = TRACKER_STAGE_CONFIG.filter(s => s.name !== 'Blacklisted');

  // Every stage count on the board comes from the same three fetches, so the page
  // waits instead of showing a board where every stage reads 0.
  if (loading) {
    return <LoadingState entity="Suppliers" icon={faColumns} />;
  }

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Tracker</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Supplier Tracking
          </p>
        </div>

        {/* ── Top shortcut: Blacklisted goes straight to its full screen ── */}
        <div style={{ paddingTop: 8 }}>
          <BlacklistedButton
            count={blacklistedSuppliers.length}
            onClick={() => navigate('/tracker/blacklisted')}
          />
        </div>
      </div>

      {/* ── Stages: full-width vertical accordion (Completed included) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {accordionStages.map(stage => {
          const isCompleted = stage.name === 'Completed';
          const count = isCompleted ? completedSuppliers.length : getSuppliersByStage(stage.name).length;
          const icon = stageIconMap[stage.icon];
          const isExpanded = expandedStage === stage.name;
          const navigateToFull = isCompleted
            ? () => navigate('/tracker/completed')
            : () => navigate(`/tracker/stage/${encodeURIComponent(stage.name)}`);

          return (
            <div key={stage.name}>
              <StagePill
                label={stage.name}
                count={count}
                color={stage.color}
                icon={icon}
                isExpanded={isExpanded}
                onClick={() => toggleStage(stage.name)}
              />
              <div
                aria-hidden={!isExpanded}
                style={{
                  maxHeight: isExpanded ? 2000 : 0,
                  overflow: 'hidden',
                  opacity: isExpanded ? 1 : 0,
                  transition: 'max-height 0.35s ease-in-out, opacity 0.25s ease-in-out',
                }}
              >
                <StagePreviewBox
                  stageColor={stage.color}
                  suppliers={isCompleted ? completedSuppliers : getSuppliersByStage(stage.name)}
                  onNavigateToStage={navigateToFull}
                />
              </div>
              <StageCollapseHandle
                color={stage.color}
                isExpanded={isExpanded}
                onClick={() => toggleStage(stage.name)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Top-of-page Blacklisted shortcut (white card, side-exit).
function BlacklistedButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        width: 210,
        gap: 12,
        padding: '10px 16px',
        borderRadius: 8,
        cursor: 'pointer',
        border: '1px solid #E0E0E0',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s ease-out',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      <span style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        backgroundColor: '#0000001A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FontAwesomeIcon icon={faBan} style={{ fontSize: 14, color: '#000000' }} />
      </span>
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#000000' }}>Blacklisted</div>
        <div style={{ fontWeight: 400, fontSize: 13, color: '#808285', marginTop: 2 }}>
          {count} rejected supplier{count !== 1 ? 's' : ''}
        </div>
      </div>
    </button>
  );
}

// Solid-color stage pill with a count badge.
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
        padding: '25px 24px',
        borderRadius: 8,
        cursor: 'pointer',
        border: 'none',
        backgroundColor: color,
        boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.10)',
        transition: 'box-shadow 0.15s ease-out',
      }}
    >
      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
        {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }} />}
        <span style={{
          fontWeight: 700, fontSize: 16, color: '#FFFFFF',
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

// Collapse handle below the pill; toggles the accordion.
function StageCollapseHandle({
  color, isExpanded, onClick,
}: {
  color: string;
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        width: '100%',
        height: 36,
        marginTop: 0,
        borderRadius: '0 0 8px 8px',
        border: 'none',
        borderBottom: `1px solid ${color}66`,
        backgroundColor: '#FFFFFF',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s ease-out',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)')}
    >
      <FontAwesomeIcon
        icon={isExpanded ? faChevronUp : faChevronDown}
        style={{ fontSize: 12, color, opacity: 0.7 }}
      />
    </button>
  );
}

// Stage preview card; click opens the full TrackerStage screen.
function StagePreviewBox({
  stageColor, suppliers, onNavigateToStage,
}: {
  stageColor: string;
  suppliers: import('../../types').TrackerSupplier[];
  onNavigateToStage: () => void;
}) {
  const preview = [...suppliers]
    .sort((a, b) => (a.daysInStage ?? 0) - (b.daysInStage ?? 0))
    .slice(0, PREVIEW_LIMIT);

  return (
    <div
      onClick={onNavigateToStage}
      style={{ backgroundColor: `${stageColor}1A`, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, cursor: 'pointer' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} in this stage
        </span>
      </div>

      {preview.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {preview.map(supplier => (
            <div key={supplier.id} onClick={e => e.stopPropagation()}>
              <SupplierTrackerCard supplier={supplier} stageColor={stageColor} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={faBinoculars} title="No suppliers" description="No suppliers in this stage." />
      )}

      {suppliers.length > 0 && (
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', textDecoration: 'none' }}>
            View all ({suppliers.length}) &rarr;
          </span>
        </div>
      )}
    </div>
  );
}
