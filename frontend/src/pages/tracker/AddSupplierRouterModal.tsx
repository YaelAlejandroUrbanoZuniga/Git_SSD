import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { useModalTransition } from '../../hooks/useModalTransition';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING, MODAL_MAX_HEIGHT } from '../../components/modalPanelStyle';
import { ExternalRegistrationForm } from './supplier-forms/ExternalRegistrationForm';
import { InternalRecommendationForm } from './supplier-forms/InternalRecommendationForm';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

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
        border: selected ? `2px solid ${BRAND_COLORS.accentRed}` : `1px solid ${NEUTRAL_COLORS.border}`,
        backgroundColor: selected ? `${BRAND_COLORS.accentRed}08` : BRAND_COLORS.cards, transition: 'all 0.15s',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 16, color }} />
      </div>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#000000', marginBottom: 4 }}>{title}</span>
      <span style={{ display: 'block', fontSize: 12, color: BRAND_COLORS.sidebar, lineHeight: 1.5 }}>{desc}</span>
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

  // The title/subtitle live on the shared header band now, not inside each step
  // (form components had their own <h2>/<p> — those were removed).
  const header = {
    select: { title: 'Add Supplier', subtitle: 'Choose how this supplier is entering the tracker.' },
    external: { title: 'External Registration', subtitle: 'The supplier registers itself — enters the tracker in Scouting Event.' },
    internal: { title: 'Internal Recommendation', subtitle: 'Someone at Nexteer recommends a supplier — enters the tracker in Parking Lot.' },
  }[step];

  return (
    <div
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...MODAL_PANEL_BASE, width: 560, maxHeight: MODAL_MAX_HEIGHT, display: 'flex', flexDirection: 'column' }}
      >
        {/* Header band stays fixed while the (up to 7-section) form scrolls under it. */}
        <ModalHeader title={header.title} subtitle={header.subtitle} accentColor={BRAND_COLORS.accentRed} onClose={requestClose} />

        <div style={{ overflowY: 'auto', padding: MODAL_BODY_PADDING }}>
        {step === 'select' && (
          <>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16 }}>
              <button
                onClick={() => channel && setStep(channel)}
                disabled={!channel}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: channel ? 'pointer' : 'not-allowed', opacity: channel ? 1 : 0.45 }}
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
    </div>
  );
}
