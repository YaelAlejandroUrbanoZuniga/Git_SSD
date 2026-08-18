import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { TrackerSupplier, Commodity } from '../../types';
import { getScoutingEvents } from '../../services/eventsService';
import { COMMODITIES, PRIMARY_DRIVERS, PRIORITIES } from '../../constants/catalogs';
import { CatalogSelect } from '../../components/CatalogSelect';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../../components/modalPanelStyle';
import { getStageColor } from '../../utils/tracker-helpers';
import { StageNoteField, STAGE_NOTE_MIN, isValidStageNote } from '../../components/StageNoteField';
import { isValidDuns } from './supplier-forms/payload';
import { useModalTransition } from '../../hooks/useModalTransition';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

interface Props {
  supplier: TrackerSupplier;
  onClose: () => void;
  /** `note` is the mandatory move note recorded on the Parking Lot → Preliminary transition. */
  onConfirm: (updatedFields: Partial<TrackerSupplier>, note: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: BRAND_COLORS.cards,
};
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};

function FieldLabel({ text, required, prefilled }: { text: string; required?: boolean; prefilled?: boolean }) {
  return (
    <label style={{ fontSize: 13, color: '#000000', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {text}{required && <span style={{ color: BRAND_COLORS.accentRed }}>*</span>}
      {prefilled && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: '#6ABF4B' }} />}
    </label>
  );
}

export function PreliminaryPrefillModal({ supplier, onClose, onConfirm }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [eventNames, setEventNames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    getScoutingEvents()
      .then(list => { if (!cancelled) setEventNames(list.map(e => e.name)); })
      .catch(() => { /* the dropdown just stays empty if events can't load */ });
    return () => { cancelled = true; };
  }, []);

  const [startDate, setStartDate] = useState(today);
  const [priority, setPriority] = useState('');
  const [scoutingInput, setScoutingInput] = useState(supplier.parkingScoutingInput ?? supplier.scoutingInput ?? '');
  const [buyer, setBuyer] = useState(supplier.parkingBuyer ?? supplier.buyer ?? '');
  const [commodity, setCommodity] = useState<string>(supplier.parkingCommodity ?? supplier.commodity ?? '');
  const [companyName, setCompanyName] = useState(supplier.parkingCompanyName ?? supplier.name ?? '');

  const [dunsNumber, setDunsNumber] = useState(supplier.dunsNumber ?? '');
  const [mfgCountry, setMfgCountry] = useState(supplier.parkingManufacturingCountry ?? supplier.country ?? '');
  const [mfgAddress, setMfgAddress] = useState(supplier.parkingManufacturingAddress ?? supplier.manufacturingAddress ?? '');
  const [primaryDriver, setPrimaryDriver] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const empty = [
    ...(startDate.trim() ? [] : ['Start date']),
    ...(priority.trim() ? [] : ['Priority']),
    ...(commodity.trim() ? [] : ['Commodity']),
    ...(primaryDriver.trim() ? [] : ['Primary driver']),
    // These three come from the supplier's external form (DUNS, manufacturing
    // country/address) — required here AND re-checked by the backend's real
    // gate on the move itself (trackerService.moveSupplierToStage), since a
    // filled field here doesn't always mean the backend's source is filled
    // too (see frontend/README.md).
    ...(dunsNumber.trim() ? [] : ['DUNS number']),
    ...(mfgCountry.trim() ? [] : ['Manufacturing country']),
    ...(mfgAddress.trim() ? [] : ['Manufacturing address']),
  ];

  /**
   * Disabled-until-valid, the contract shared with `MoveStageModal`,
   * `StageTransitionModal` and `ParkingLotPrefillModal`, with the blocking
   * reason rendered next to the button rather than fired as a toast after a
   * pointless click.
   */
  const blockedReason: string | null =
    empty.length > 0
      ? (empty.length === 1
          ? `"${empty[0]}" is required before moving to Preliminary Evaluation.`
          : `These required fields are empty: ${empty.map(f => `"${f}"`).join(', ')}.`)
      // Presence was checked above; the FORMAT was not. Both registration forms
      // enforce the 9-digit rule, and this is the last point of capture before
      // the value becomes the supplier's official DUNS — the backend's gate only
      // checks that it is non-empty, so "123" used to pass every check there is.
      : !isValidDuns(dunsNumber)
        ? '"DUNS number" must be exactly 9 digits.'
        : !isValidStageNote(note)
          ? `A move note of at least ${STAGE_NOTE_MIN} characters is required.`
          : null;

  const canConfirm = blockedReason === null && !submitting;

  function handleConfirm() {
    if (!canConfirm) return;
    // The parent owns the request and its error reporting; this only guards
    // against a second click landing before the modal unmounts.
    setSubmitting(true);
    onConfirm({
      stage: 'Preliminary Evaluation',
      prelim_startDate: startDate,
      prelim_priority: Number(priority) as 1 | 2 | 3,
      prelim_scoutingInput: scoutingInput || null,
      prelim_buyer: buyer || null,
      prelim_commodity: (commodity || null) as Commodity | null,
      prelim_companyName: companyName || null,
      prelim_dunsNumber: dunsNumber || null,
      prelim_manufacturingCountry: mfgCountry || null,
      prelim_manufacturingAddress: mfgAddress || null,
      prelim_primaryDriver: primaryDriver,
      preliminaryTabsCompleted: { overview: false, capabilities: false },
      supplierEvalTabsCompleted: null,
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
          title="Move to Preliminary Evaluation — Review information"
          subtitle="Fields already filled from earlier stages are pre-populated. Review, complete missing fields, and confirm."
          accentColor={getStageColor('Preliminary Evaluation')}
          onClose={requestClose}
        />

        <div style={{ overflowY: 'auto', padding: MODAL_BODY_PADDING }}>
        {/* Identity */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Identity</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel text="Start date" required />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Priority" required />
              <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
                <option value="">Select priority</option>
                {PRIORITIES.map(p => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel text="Scouting input" prefilled={!!(supplier.parkingScoutingInput ?? supplier.scoutingInput)} />
              <CatalogSelect value={scoutingInput} onChange={setScoutingInput} options={eventNames} placeholder="Select event" />
            </div>
            <div>
              <FieldLabel text="Buyer" prefilled={!!(supplier.parkingBuyer ?? supplier.buyer)} />
              <input type="text" value={buyer} onChange={e => setBuyer(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Commodity" required prefilled={!!(supplier.parkingCommodity ?? supplier.commodity)} />
              <CatalogSelect value={commodity} onChange={setCommodity} options={COMMODITIES} placeholder="Select commodity" />
            </div>
            <div>
              <FieldLabel text="Company name" prefilled={!!(supplier.parkingCompanyName ?? supplier.name)} />
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Company essentials */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Company essentials</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel text="DUNS number" required prefilled={!!supplier.dunsNumber} />
              <input type="text" value={dunsNumber} onChange={e => setDunsNumber(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing country" required prefilled={!!(supplier.parkingManufacturingCountry ?? supplier.country)} />
              <input type="text" value={mfgCountry} onChange={e => setMfgCountry(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing address" required prefilled={!!(supplier.parkingManufacturingAddress ?? supplier.manufacturingAddress)} />
              <input type="text" value={mfgAddress} onChange={e => setMfgAddress(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Primary driver" required />
              <CatalogSelect value={primaryDriver} onChange={setPrimaryDriver} options={PRIMARY_DRIVERS} placeholder="Select driver" />
            </div>
          </div>
        </div>

        {/* Mandatory move note — recorded on the stage transition. */}
        <div style={{ marginBottom: 24 }}>
          <StageNoteField
            note={note}
            onChange={setNote}
            placeholder={`Explain why ${supplier.name} is moving to Preliminary Evaluation...`}
          />
        </div>

        {/* Footer */}
        {blockedReason && (
          <p
            aria-live="polite"
            style={{ fontSize: 11, color: BRAND_COLORS.accentRed, margin: '0 0 10px', textAlign: 'right' }}
          >
            {blockedReason}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16 }}>
          <button
            onClick={requestClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#E3650B', color: BRAND_COLORS.cards, cursor: canConfirm ? 'pointer' : 'not-allowed', opacity: canConfirm ? 1 : 0.45 }}
          >
            {submitting ? 'Moving…' : <>Confirm move &rarr;</>}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
