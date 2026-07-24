import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { TrackerSupplier } from '../../types';
import { getScoutingEvents } from '../../services/eventsService';
import { COMMODITIES, PENDING_GSM_COMMODITY, SUB_STATUSES, YES_NO_WORDS } from '../../constants/catalogs';
import { CatalogSelect } from '../../components/CatalogSelect';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../../components/modalPanelStyle';
import { getStageColor } from '../../utils/tracker-helpers';
import { StageNoteField, STAGE_NOTE_MIN, isValidStageNote } from '../../components/StageNoteField';
import { useToast } from '../../context/ToastContext';
import { useModalTransition } from '../../hooks/useModalTransition';

interface Props {
  supplier: TrackerSupplier;
  onClose: () => void;
  /** `note` is the mandatory move note recorded on the Scouting → Parking Lot transition. */
  onConfirm: (updatedFields: Partial<TrackerSupplier>, note: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};

function FieldLabel({ text, required, prefilled }: { text: string; required?: boolean; prefilled?: boolean }) {
  return (
    <label style={{ fontSize: 13, color: '#000000', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {text}{required && <span style={{ color: '#DC0202' }}>*</span>}
      {prefilled && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: '#6ABF4B' }} />}
    </label>
  );
}

export function ParkingLotPrefillModal({ supplier, onClose, onConfirm }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [eventNames, setEventNames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    getScoutingEvents()
      .then(list => { if (!cancelled) setEventNames(list.map(e => e.name)); })
      .catch(() => { /* the dropdown just stays empty if events can't load */ });
    return () => { cancelled = true; };
  }, []);

  const [onboardingDate, setOnboardingDate] = useState(today);
  const [timeless, setTimeless] = useState(false);
  const [dateToMove, setDateToMove] = useState('');
  const [daysElapsed, setDaysElapsed] = useState('');
  const [scoutingInput, setScoutingInput] = useState(supplier.scoutingInput || '');
  const [status, setStatus] = useState('');

  const [isRecommendation] = useState(false);
  const [buyer, setBuyer] = useState(supplier.buyer || '');
  const [companyName, setCompanyName] = useState(supplier.name || '');
  const [b2bMeeting, setB2bMeeting] = useState<string>(supplier.b2bStatus || '');
  const [name1, setName1] = useState(supplier.contactName || '');
  const [website, setWebsite] = useState(supplier.website || '');
  const [email1, setEmail1] = useState(supplier.contactEmail || '');
  const [phone, setPhone] = useState(supplier.phone || '');

  const [commodity, setCommodity] = useState<string>(supplier.commodity || '');
  const [productType, setProductType] = useState(supplier.productType || '');
  const [mfgCountry, setMfgCountry] = useState(supplier.country || '');
  const [mfgAddress, setMfgAddress] = useState(supplier.manufacturingAddress || '');
  const [comments, setComments] = useState('');
  const [note, setNote] = useState('');

  const toast = useToast();
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  /** Confirm stays clickable so the toast can name what is still missing. */
  function handleConfirm() {
    const empty = [
      ...(onboardingDate.trim() ? [] : ['Supplier onboarding date']),
      ...(companyName.trim() ? [] : ['Company name']),
      ...(status.trim() ? [] : ['Status']),
      // Commodity is defined here — this is the moment GSM assigns it. It must be a
      // real value: blank, or still the pending placeholder, does not count.
      ...(commodity.trim() && commodity !== PENDING_GSM_COMMODITY ? [] : ['Commodity']),
    ];
    if (empty.length > 0) {
      const isPendingCommodity = commodity === PENDING_GSM_COMMODITY && empty.length === 1;
      toast.validationError(
        'Missing required information',
        isPendingCommodity
          ? 'This supplier still has the pending "TBD -- Pending GSM" commodity. Choose a real commodity before moving to Parking Lot.'
          : empty.length === 1
            ? `"${empty[0]}" is required before moving to Parking Lot.`
            : `These required fields are empty: ${empty.map(f => `"${f}"`).join(', ')}.`,
      );
      return;
    }
    if (!timeless && dateToMove && dateToMove < onboardingDate) {
      toast.validationError(
        'Check this before saving',
        '"Date to move to Preliminary" cannot be earlier than the onboarding date. Pick a later date, or tick "Timeless".',
      );
      return;
    }
    if (!isValidStageNote(note)) {
      toast.validationError(
        'Move note required',
        `Explain why ${supplier.name} is moving to Parking Lot — at least ${STAGE_NOTE_MIN} characters.`,
      );
      return;
    }

    onConfirm({
      stage: 'Parking Lot',
      scoutingPhase: null,
      daysSinceParkingLot: 0,
      subStatus: (status as TrackerSupplier['subStatus']) || null,
      parkingOnboardingDate: onboardingDate || null,
      parkingTimeless: timeless,
      parkingDateToMovePreliminary: timeless ? null : (dateToMove || null),
      parkingDaysElapsed: daysElapsed ? Number(daysElapsed) : 0,
      parkingScoutingInput: scoutingInput || null,
      parkingSubStatus: (status as TrackerSupplier['parkingSubStatus']) || null,
      parkingIsRecommendation: isRecommendation,
      parkingBuyer: buyer || null,
      parkingCompanyName: companyName || null,
      parkingB2BMeeting: (b2bMeeting as TrackerSupplier['parkingB2BMeeting']) || null,
      parkingName1: name1 || null,
      parkingWebsite: website || null,
      parkingEmail1: email1 || null,
      parkingPhone: phone || null,
      parkingCommodity: commodity || null,
      parkingProductType: productType || null,
      parkingManufacturingCountry: mfgCountry || null,
      parkingManufacturingAddress: mfgAddress || null,
      parkingAdditionalComments: comments || null,
      parkingTabsCompleted: { overview: !!status, contact: false, details: false },
    }, note.trim());
  }

  return (
    <div
      onClick={requestClose}
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...MODAL_PANEL_BASE, width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <ModalHeader
          title="Move to Parking Lot — Review information"
          subtitle="Fields already filled from Scouting are pre-populated. Review, complete missing fields, and confirm."
          accentColor={getStageColor('Parking Lot')}
          onClose={requestClose}
        />

        <div style={{ overflowY: 'auto', padding: MODAL_BODY_PADDING }}>
        {/* Overview */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel text="Supplier onboarding date" required />
              <input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Date to move to Preliminary" />
              <input type="date" value={dateToMove} onChange={e => setDateToMove(e.target.value)} disabled={timeless} style={{ ...inputStyle, opacity: timeless ? 0.45 : 1, cursor: timeless ? 'not-allowed' : 'text' }} />
            </div>
            <div>
              <FieldLabel text="Days elapsed" />
              <input type="number" value={daysElapsed} onChange={e => setDaysElapsed(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Scouting input" prefilled={!!supplier.scoutingInput} />
              <CatalogSelect value={scoutingInput} onChange={setScoutingInput} options={eventNames} placeholder="Select event" />
            </div>
            <div>
              <FieldLabel text="Status" required />
              <CatalogSelect value={status} onChange={setStatus} options={SUB_STATUSES} placeholder="Select status" />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
            <input type="checkbox" checked={timeless} onChange={e => setTimeless(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#000000' }}>Timeless (no fixed date to move)</span>
          </label>
        </div>

        {/* Contact */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Contact</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel text="Buyer" prefilled={!!supplier.buyer} />
              <input type="text" value={buyer} onChange={e => setBuyer(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Company name" required prefilled={!!supplier.name} />
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="B2B meeting" prefilled={!!supplier.b2bStatus} />
              <CatalogSelect value={b2bMeeting} onChange={setB2bMeeting} options={YES_NO_WORDS} />
            </div>
            <div>
              <FieldLabel text="Name 1" prefilled={!!supplier.contactName} />
              <input type="text" value={name1} onChange={e => setName1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Website" prefilled={!!supplier.website} />
              <input type="text" value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Email 1" prefilled={!!supplier.contactEmail} />
              <input type="email" value={email1} onChange={e => setEmail1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Phone" prefilled={!!supplier.phone} />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel text="Commodity" required prefilled={!!supplier.commodity && supplier.commodity !== PENDING_GSM_COMMODITY} />
              <CatalogSelect value={commodity} onChange={setCommodity} options={COMMODITIES} placeholder="Select commodity" />
            </div>
            <div>
              <FieldLabel text="Product type" prefilled={!!supplier.productType} />
              <input type="text" value={productType} onChange={e => setProductType(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing country" prefilled={!!supplier.country} />
              <input type="text" value={mfgCountry} onChange={e => setMfgCountry(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing address" prefilled={!!supplier.manufacturingAddress} />
              <input type="text" value={mfgAddress} onChange={e => setMfgAddress(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <FieldLabel text="Additional comments" />
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Mandatory move note — recorded on the stage transition. */}
        <div style={{ marginBottom: 24 }}>
          <StageNoteField
            note={note}
            onChange={setNote}
            placeholder={`Explain why ${supplier.name} is moving to Parking Lot...`}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <button
            onClick={requestClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
          >
            Confirm move &rarr;
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
