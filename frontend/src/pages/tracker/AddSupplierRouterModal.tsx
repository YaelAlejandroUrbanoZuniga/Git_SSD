import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faGlobe, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { useModalTransition } from '../../hooks/useModalTransition';
import { ExternalRegistrationForm } from './supplier-forms/ExternalRegistrationForm';
import { InternalRecommendationForm } from './supplier-forms/InternalRecommendationForm';

interface Props {
  onClose: () => void;
  /** Called after a supplier is created, so the caller can refresh its list. */
  onCreated?: () => void;
}

/**
 * Entry point for every supplier that enters the system.
 *
 * Step 1 picks the channel — external (the supplier registers itself) or
 * internal (someone at Nexteer recommends it). Step 2 is the corresponding
 * form, which writes to the database through `POST /api/suppliers`. The channel
 * decides `entrySource`, and the backend derives the starting stage from it:
 * Scouting Event for form A, Parking Lot for form B.
 */
type Step = 'select' | 'external' | 'internal';
type Channel = 'external' | 'internal' | '';

function StageCard({ icon, color, title, desc, selected, onClick }: {
  icon: typeof faGlobe; color: string; title: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', padding: 20, borderRadius: 10, cursor: 'pointer',
        border: selected ? '2px solid #DC0202' : '1px solid #D1D3D4',
        backgroundColor: selected ? '#DC020208' : '#FFFFFF', transition: 'all 0.15s',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 16, color }} />
      </div>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#000000', marginBottom: 4 }}>{title}</span>
      <span style={{ display: 'block', fontSize: 12, color: '#808285', lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}

export function AddSupplierRouterModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [channel, setChannel] = useState<Channel>('');
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const formProps = {
    onBack: () => setStep('select'),
    onClose,
    onCreated: () => onCreated?.(),
  };

  return (
    <div
      onClick={requestClose}
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ width: 560, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <button onClick={requestClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        {step === 'select' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add Supplier</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>
              Choose how this supplier is entering the tracker.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <StageCard
                icon={faGlobe} color="#02B3E1" title="External Registration"
                desc="The supplier registers itself, at a scouting event or directly. Enters in Scouting Event."
                selected={channel === 'external'} onClick={() => setChannel('external')}
              />
              <StageCard
                icon={faUserTie} color="#D4A017" title="Internal Recommendation"
                desc="Someone at Nexteer recommends a supplier they already know. Enters in Parking Lot."
                selected={channel === 'internal'} onClick={() => setChannel('internal')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
              <button onClick={requestClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => channel && setStep(channel)}
                disabled={!channel}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: channel ? 'pointer' : 'not-allowed', opacity: channel ? 1 : 0.45 }}
              >
                Continue &rarr;
              </button>
            </div>
          </>
        )}

        {step === 'external' && <ExternalRegistrationForm {...formProps} />}
        {step === 'internal' && <InternalRecommendationForm {...formProps} />}
      </div>
    </div>
  );
}
