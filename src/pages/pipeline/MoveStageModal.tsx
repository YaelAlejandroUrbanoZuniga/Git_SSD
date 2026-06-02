import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { pipelineStageConfig, PipelineSupplier, PipelineStage } from '../../data/pipeline-demo';

interface Props {
  supplier: PipelineSupplier;
  onClose: () => void;
  onConfirm: (newStage: string) => void;
}

const stageOrder: PipelineStage[] = [
  'Scouting Event',
  'B2B',
  'Parking Lot',
  'Preliminary Evaluation',
  'RFQ',
  'Intelex Handoff',
];

const checklistRequirements: Record<string, string[]> = {
  'B2B': [
    'NDA sent to supplier',
    'B2B meeting scheduled',
    'Supplier confirmed attendance',
  ],
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
  'RFQ': [
    'Pre-evaluation completed within 60 days',
    'DUNS number validated',
    'ELM score documented',
    'SQD quality assessment submitted',
    'No critical deviations pending',
    'TC&Cs and TTC&Cs signed',
  ],
  'Intelex Handoff': [
    'RFQ package received from supplier',
    'Price delta analysis completed',
    'Buyer approval obtained',
    'PM approval obtained',
    'DUNS confirmed for legal entity',
    'NSR and SDA signed',
  ],
};

export function MoveStageModal({ supplier, onClose, onConfirm }: Props) {
  const currentStageIndex = stageOrder.indexOf(supplier.stage);
  const forwardStages = stageOrder.slice(currentStageIndex + 1);

  const defaultStage = forwardStages.length > 0 ? forwardStages[0] : 'Blacklisted';
  const [selectedStage, setSelectedStage] = useState<string>(defaultStage);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [rejectionReason, setRejectionReason] = useState('');

  const isBlacklisted = selectedStage === 'Blacklisted';
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
  const isConfirmEnabled = isBlacklisted ? rejectionReason.length >= 20 : allChecked;

  const handleConfirm = () => {
    onConfirm(selectedStage);
    onClose();
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
              {forwardStages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
              <option value="Blacklisted" style={{ color: '#DC0202' }}>Blacklisted</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 12, color: '#808285' }} />
          </div>

          {/* Stage color indicator */}
          {!isBlacklisted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: getStageColor(selectedStage) }} />
              <span style={{ fontSize: 11, color: '#808285' }}>Stage: {selectedStage}</span>
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

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <p style={{ fontSize: 11, color: '#808285', margin: 0 }}>This action will be logged in the supplier's history.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: isConfirmEnabled ? 'pointer' : 'not-allowed', opacity: isConfirmEnabled ? 1 : 0.45 }}
            >
              Confirm move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
