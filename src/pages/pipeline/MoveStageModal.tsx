import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronDown, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { pipelineStageConfig } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { useRASIC } from "../hooks/useRASIC";
import { useRole } from '../../context/RoleContext';
import { DUAL_APPROVAL_ACTIVITIES } from '../../data/rasic';

interface Props {
  supplier: PipelineSupplier;
  onClose: () => void;
  onConfirm: (newStage: string) => void;
  origin?: 'suppliers' | 'pipeline';
}

const allowedTransitions: Record<string, string[]> = {
  'Scouting Event': ['Parking Lot', 'Blacklisted'],
  'Parking Lot': ['Preliminary Evaluation', 'Blacklisted'],
  'Preliminary Evaluation': ['Supplier Evaluation', 'Blacklisted'],
  'Supplier Evaluation': ['Intelex Handoff', 'Blacklisted'],
  'Intelex Handoff': ['Blacklisted'],
};

const checklistRequirements: Record<string, string[]> = {
  'Parking Lot': [
    'NDA signed by both parties',
    'B2B meeting completed',
    'Supplier evaluation form filled',
  ],
  'Preliminary Evaluation': [
    'Go/No-Go decision: Go',
    'Supplier data complete (contact, country, commodity)',
    'Weekly SSD review completed',
    'Buyer assigned',
  ],
  'Supplier Evaluation': [
    'Preliminary Evaluation completed (Overview, Capabilities, Visit)',
    'Pre-evaluation completed within 60 days',
    'DUNS number validated',
    'SQD quality assessment submitted',
    'No critical deviations pending',
    'NDA and RFQ received',
  ],
  'Intelex Handoff': [
    'Competitiveness analysis completed',
    'Fundamentals gate Ready (RFQ + NDA signed)',
    'Price delta analysis completed',
    'Buyer approval obtained',
    'PM approval obtained',
    'TC&Cs, TTC&Cs, NSR and SDA signed',
  ],
};

export function MoveStageModal({ supplier, onClose, onConfirm, origin = 'pipeline' }: Props) {
  const navigate = useNavigate();
  const { canExecute } = useRASIC();
  const { activeRole } = useRole();
  const hasPermission = canExecute(17);
  const isDualApproval = DUAL_APPROVAL_ACTIVITIES.includes(17);

  const isScoutingIdentified = supplier.stage === 'Scouting Event' && supplier.scoutingPhase === 'Identified';
  const forwardStages = allowedTransitions[supplier.stage] ?? [];

  const options: string[] = isScoutingIdentified
    ? ['Promote to B2B', ...forwardStages]
    : [...forwardStages];

  const defaultOption = options.length > 0 ? options[0] : 'Blacklisted';
  const [selectedStage, setSelectedStage] = useState<string>(defaultOption);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [rejectionReason, setRejectionReason] = useState('');

  const isBlacklisted = selectedStage === 'Blacklisted';
  const isPromoteB2B = selectedStage === 'Promote to B2B';
  const currentChecklist = checklistRequirements[selectedStage] || [];

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStage(e.target.value);
    setCheckedItems({});
    setRejectionReason('');
  };

  const handleCheckboxChange = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const allChecked = currentChecklist.length > 0 && currentChecklist.every(item => checkedItems[item]);
  const isConfirmEnabled = isBlacklisted
    ? rejectionReason.length >= 20
    : isPromoteB2B
      ? true
      : allChecked;

  const handleConfirm = () => {
    onConfirm(selectedStage);
    onClose();
    if (origin === 'pipeline' && selectedStage !== 'Blacklisted') {
      navigate(`/pipeline/stage/${encodeURIComponent(isPromoteB2B ? 'Scouting Event' : selectedStage)}`);
    }
  };

  const getStageColor = (name: string) => pipelineStageConfig.find(s => s.name === name)?.color ?? '#808285';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, backgroundColor: isBlacklisted ? 'rgba(220,2,2,0.03)' : '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: 0 }}>Move to next stage</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '8px 0 20px' }}>
          Review requirements before advancing {supplier.name}
        </p>

        {/* Stage selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#808285', display: 'block', marginBottom: 4 }}>Move to:</label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedStage}
              onChange={handleStageChange}
              style={{ border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px', fontSize: 13, width: '100%', appearance: 'none', paddingRight: 32, cursor: 'pointer', backgroundColor: '#FFFFFF' }}
            >
              {options.filter(o => o !== 'Blacklisted').map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
              <option value="Blacklisted" disabled={activeRole !== 'SSD'} style={{ color: '#DC0202' }}>
                {activeRole !== 'SSD' ? 'Blacklisted (SSD only)' : 'Blacklisted'}
              </option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 12, color: '#808285' }} />
          </div>

          {/* Stage color indicator */}
          {!isBlacklisted && !isPromoteB2B && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: getStageColor(selectedStage) }} />
              <span style={{ fontSize: 11, color: '#808285' }}>Stage: {selectedStage}</span>
            </div>
          )}
          {isPromoteB2B && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#6366F1' }} />
              <span style={{ fontSize: 11, color: '#808285' }}>Phase: B2B (within Scouting Event)</span>
            </div>
          )}
        </div>

        {isBlacklisted ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 8 }}>
              Rejection reason (required, min. 20 characters)
            </label>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={4}
              style={{ width: '100%', border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: rejectionReason.length >= 20 ? '#6ABF4B' : '#808285', textAlign: 'right', marginTop: 4 }}>
              {rejectionReason.length}/20 characters
            </div>
          </div>
        ) : isPromoteB2B ? (
          <div style={{ marginBottom: 20, padding: '12px 16px', backgroundColor: '#6366F110', borderRadius: 8, border: '1px solid #6366F130' }}>
            <p style={{ fontSize: 13, color: '#000000', margin: 0 }}>
              This will promote the supplier to the <strong>B2B phase</strong> within Scouting Event. The supplier will be scheduled for a B2B meeting.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              REQUIREMENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentChecklist.map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checkedItems[item] || false}
                    onChange={() => handleCheckboxChange(item)}
                    style={{ accentColor: '#DC0202', cursor: 'pointer', width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 13, color: '#000000', marginLeft: 10 }}>{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Dual-approval banner */}
        {isDualApproval && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', backgroundColor: '#D4A01712', border: '1px solid #D4A01730', borderRadius: 6, marginBottom: 16 }}>
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 12, color: '#D4A017', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#000000' }}>Dual approval required — PM and Buyer must approve independently.</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <p style={{ fontSize: 11, color: '#808285', margin: 0 }}>This action will be logged in the supplier's history.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              Cancel
            </button>
            <div style={{ position: 'relative' }} title={!hasPermission ? `Your role (${activeRole}) does not have permission for this action.` : undefined}>
              <button
                onClick={handleConfirm}
                disabled={!isConfirmEnabled || !hasPermission}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: (isConfirmEnabled && hasPermission) ? 'pointer' : 'not-allowed', opacity: (isConfirmEnabled && hasPermission) ? 1 : 0.45 }}
              >
                Confirm move
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
