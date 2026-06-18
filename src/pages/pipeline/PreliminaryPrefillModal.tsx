import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import type { PipelineSupplier } from '../../types';

interface Props {
  supplier: PipelineSupplier;
  onClose: () => void;
  onConfirm: (updatedFields: Partial<PipelineSupplier>) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};

const PRIMARY_DRIVERS = [
  'Dual Source', 'Supplier Back Up', 'Savings', 'Quality', 'Capacity', 'New Technology',
  'Full Resiliency GM', 'USMCA', 'MCIP', 'Leadtime / Delivery', 'Strategy Consolidation',
  'Technical Knowledge', 'Sub Supplier',
];

function FieldLabel({ text, required, prefilled }: { text: string; required?: boolean; prefilled?: boolean }) {
  return (
    <label style={{ fontSize: 13, color: '#000000', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {text}{required && <span style={{ color: '#DC0202' }}>*</span>}
      {prefilled && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: '#6ABF4B' }} />}
    </label>
  );
}

export function PreliminaryPrefillModal({ supplier, onClose, onConfirm }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(today);
  const [priority, setPriority] = useState('');
  const [scoutingInput, setScoutingInput] = useState(supplier.parkingScoutingInput ?? supplier.scoutingInput ?? '');
  const [buyer, setBuyer] = useState(supplier.parkingBuyer ?? supplier.buyer ?? '');
  const [commodity, setCommodity] = useState(supplier.parkingCommodity ?? supplier.commodity ?? '');
  const [companyName, setCompanyName] = useState(supplier.parkingCompanyName ?? supplier.name ?? '');

  const [dunsNumber, setDunsNumber] = useState(supplier.dunsNumber ?? '');
  const [mfgCountry, setMfgCountry] = useState(supplier.parkingManufacturingCountry ?? supplier.country ?? '');
  const [mfgAddress, setMfgAddress] = useState(supplier.parkingManufacturingAddress ?? supplier.manufacturingAddress ?? '');
  const [primaryDriver, setPrimaryDriver] = useState('');

  const canSubmit = startDate.trim().length > 0 && priority.trim().length > 0 && primaryDriver.trim().length > 0;

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm({
      stage: 'Preliminary Evaluation',
      prelim_startDate: startDate,
      prelim_priority: Number(priority) as 1 | 2 | 3,
      prelim_scoutingInput: scoutingInput || null,
      prelim_buyer: buyer || null,
      prelim_commodity: commodity || null,
      prelim_companyName: companyName || null,
      prelim_dunsNumber: dunsNumber || null,
      prelim_manufacturingCountry: mfgCountry || null,
      prelim_manufacturingAddress: mfgAddress || null,
      prelim_primaryDriver: primaryDriver,
      preliminaryTabsCompleted: { overview: false, capabilities: false, visit: false },
      supplierEvalTabsCompleted: null,
    });
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 640, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Move to Preliminary Evaluation — Review information</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>
          Fields already filled from earlier stages are pre-populated. Review, complete missing fields, and confirm.
        </p>

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
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div>
              <FieldLabel text="Scouting input" prefilled={!!(supplier.parkingScoutingInput ?? supplier.scoutingInput)} />
              <input type="text" value={scoutingInput} onChange={e => setScoutingInput(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Buyer" prefilled={!!(supplier.parkingBuyer ?? supplier.buyer)} />
              <input type="text" value={buyer} onChange={e => setBuyer(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Commodity" prefilled={!!(supplier.parkingCommodity ?? supplier.commodity)} />
              <input type="text" value={commodity} onChange={e => setCommodity(e.target.value)} style={inputStyle} />
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
              <FieldLabel text="DUNS number" prefilled={!!supplier.dunsNumber} />
              <input type="text" value={dunsNumber} onChange={e => setDunsNumber(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing country" prefilled={!!(supplier.parkingManufacturingCountry ?? supplier.country)} />
              <input type="text" value={mfgCountry} onChange={e => setMfgCountry(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Manufacturing address" prefilled={!!(supplier.parkingManufacturingAddress ?? supplier.manufacturingAddress)} />
              <input type="text" value={mfgAddress} onChange={e => setMfgAddress(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel text="Primary driver" required />
              <select value={primaryDriver} onChange={e => setPrimaryDriver(e.target.value)} style={inputStyle}>
                <option value="">Select driver</option>
                {PRIMARY_DRIVERS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#E3650B', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45 }}
          >
            Confirm move &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
