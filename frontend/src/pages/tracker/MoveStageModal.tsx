import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { TrackerSupplier } from '../../types';
import { getStageColor } from '../../utils/tracker-helpers';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../../components/modalPanelStyle';
import { RejectionReasonField, REJECTION_REASON_MIN, isValidRejectionReason } from '../../components/RejectionReasonField';
import { StageNoteField, STAGE_NOTE_MIN, isValidStageNote } from '../../components/StageNoteField';
import { useToast } from '../../context/ToastContext';
import { useModalTransition } from '../../hooks/useModalTransition';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

interface Props {
  supplier: TrackerSupplier;
  onClose: () => void;
  /**
   * `rejectionReason` is only set when moving to Blacklisted; `note` is the
   * mandatory move note set on every advance transition. Neither is ever a
   * default string.
   */
  onConfirm: (newStage: string, rejectionReason?: string, note?: string) => void;
  origin?: 'suppliers' | 'tracker';
}

const allowedTransitions: Record<string, string[]> = {
  'Scouting Event': ['Parking Lot', 'Blacklisted'],
  'Parking Lot': ['Preliminary Evaluation', 'Blacklisted'],
  'Preliminary Evaluation': ['Supplier Evaluation', 'Blacklisted'],
  'Supplier Evaluation': ['Intelex Handoff', 'Blacklisted'],
  'Intelex Handoff': ['Blacklisted'],
  'Completed': [],
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

export function MoveStageModal({ supplier, onClose, onConfirm, origin = 'tracker' }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const isScoutingIdentified = supplier.stage === 'Scouting Event' && supplier.scoutingPhase === 'Identified';
  const forwardStages = allowedTransitions[supplier.stage] ?? [];

  const options: string[] = isScoutingIdentified
    ? ['Promote to B2B', ...forwardStages]
    : [...forwardStages];

  const defaultOption = options.length > 0 ? options[0] : 'Blacklisted';
  const [selectedStage, setSelectedStage] = useState<string>(defaultOption);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [note, setNote] = useState('');

  const isBlacklisted = selectedStage === 'Blacklisted';
  const isPromoteB2B = selectedStage === 'Promote to B2B';
  const currentChecklist = checklistRequirements[selectedStage] || [];

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStage(e.target.value);
    setCheckedItems({});
    setRejectionReason('');
    setNote('');
  };

  const handleCheckboxChange = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  /**
   * Confirm stays clickable: a dead button can't tell the user what is missing,
   * so the rule is checked here and reported as a validation toast instead.
   */
  const handleConfirm = () => {
    if (isBlacklisted) {
      if (!isValidRejectionReason(rejectionReason)) {
        toast.validationError(
          'Rejection reason required',
          `Explain why ${supplier.name} is being blacklisted — at least ${REJECTION_REASON_MIN} characters.`,
        );
        return;
      }
    } else if (!isPromoteB2B) {
      const pending = currentChecklist.filter(item => !checkedItems[item]);
      if (pending.length > 0) {
        toast.validationError(
          `${supplier.name} is not ready for ${selectedStage}`,
          `Tick every requirement before moving. Still pending: ${pending.join('; ')}.`,
        );
        return;
      }
      // Advancing a stage requires a real note (mandatory server-side).
      if (!isValidStageNote(note)) {
        toast.validationError(
          'Move note required',
          `Explain why ${supplier.name} is advancing to ${selectedStage} — at least ${STAGE_NOTE_MIN} characters.`,
        );
        return;
      }
    }

    // Promote to B2B is not a stage transition and carries no move note.
    onConfirm(
      selectedStage,
      isBlacklisted ? rejectionReason.trim() : undefined,
      isBlacklisted || isPromoteB2B ? undefined : note.trim(),
    );
    onClose();
    if (origin === 'tracker' && selectedStage !== 'Blacklisted') {
      navigate(`/tracker/stage/${encodeURIComponent(isPromoteB2B ? 'Scouting Event' : selectedStage)}`);
    }
  };

  return (
    <div
      onClick={requestClose}
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...MODAL_PANEL_BASE, width: 560, backgroundColor: isBlacklisted ? 'rgba(220,2,2,0.03)' : BRAND_COLORS.cards }}
      >
        <ModalHeader
          title="Move to next stage"
          subtitle={`Review requirements before advancing ${supplier.name}`}
          accentColor={getStageColor(selectedStage)}
          onClose={requestClose}
        />

        <div style={{ padding: MODAL_BODY_PADDING }}>
        {/* Stage selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 4 }}>Move to:</label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedStage}
              onChange={handleStageChange}
              style={{ border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, width: '100%', appearance: 'none', paddingRight: 32, cursor: 'pointer', backgroundColor: BRAND_COLORS.cards }}
            >
              {options.filter(o => o !== 'Blacklisted').map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
              <option value="Blacklisted" style={{ color: getStageColor('Blacklisted') }}>Blacklisted</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 12, color: BRAND_COLORS.sidebar }} />
          </div>

          {/* Stage color indicator */}
          {!isBlacklisted && !isPromoteB2B && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: getStageColor(selectedStage) }} />
              <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>Stage: {selectedStage}</span>
            </div>
          )}
          {isPromoteB2B && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ACCENT_COLORS.info }} />
              <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>Phase: B2B (within Scouting Event)</span>
            </div>
          )}
        </div>

        {isBlacklisted ? (
          <div style={{ marginBottom: 20 }}>
            <RejectionReasonField
              reason={rejectionReason}
              onChange={setRejectionReason}
              placeholder={`Explain why ${supplier.name} is being blacklisted...`}
              autoFocus={false}
            />
          </div>
        ) : isPromoteB2B ? (
          <div style={{ marginBottom: 20, padding: '12px 16px', backgroundColor: `${ACCENT_COLORS.info}10`, borderRadius: 8, border: `1px solid ${ACCENT_COLORS.info}30` }}>
            <p style={{ fontSize: 13, color: '#000000', margin: 0 }}>
              This will promote the supplier to the <strong>B2B phase</strong> within Scouting Event. The supplier will be scheduled for a B2B meeting.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              REQUIREMENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentChecklist.map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checkedItems[item] || false}
                    onChange={() => handleCheckboxChange(item)}
                    style={{ accentColor: BRAND_COLORS.accentRed, cursor: 'pointer', width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 13, color: '#000000', marginLeft: 10 }}>{item}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <StageNoteField
                note={note}
                onChange={setNote}
                placeholder={`Explain why ${supplier.name} is advancing to ${selectedStage}...`}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16 }}>
          <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: 0 }}>This action will be logged in the supplier's history.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={requestClose}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: 'pointer' }}
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
