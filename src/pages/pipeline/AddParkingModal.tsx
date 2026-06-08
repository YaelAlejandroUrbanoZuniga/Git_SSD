import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, PipelineSupplier } from '../../data/pipeline-demo';

interface Props {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};
const labelStyle: React.CSSProperties = { fontSize: 13, color: '#000000', display: 'block', marginBottom: 4 };

export function AddParkingModal({ onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [onboardingDate, setOnboardingDate] = useState(today);
  const [timeless, setTimeless] = useState(false);
  const [dateToMove, setDateToMove] = useState('');
  const [daysElapsed, setDaysElapsed] = useState('');
  const [scoutingInputVal, setScoutingInputVal] = useState('');

  const [buyer, setBuyer] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [b2bMeeting, setB2bMeeting] = useState('');
  const [name1, setName1] = useState('');
  const [website, setWebsite] = useState('');
  const [email1, setEmail1] = useState('');
  const [phone, setPhone] = useState('');

  const [commodity, setCommodity] = useState('');
  const [productType, setProductType] = useState('');
  const [mfgCountry, setMfgCountry] = useState('');
  const [mfgAddress, setMfgAddress] = useState('');
  const [comments, setComments] = useState('');

  const canSubmit = companyName.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const folio = `SSD-2026-${String(pipelineSuppliers.length + 1).padStart(3, '0')}`;
    const newSupplier: PipelineSupplier = {
      id: `ps-${Date.now()}`,
      folio,
      name: companyName.trim().toUpperCase(),
      stage: 'Parking Lot',
      scoutingPhase: null,
      entrySource: 'Recommendation',
      commodity: commodity.trim(),
      productType: productType.trim(),
      country: mfgCountry.trim(),
      manufacturingAddress: mfgAddress.trim(),
      buyer: buyer.trim(),
      scoutingInput: scoutingInputVal.trim() || 'Registro directo',
      daysInStage: 0,
      daysSinceParkingLot: 0,
      docsPercent: 0,
      sla: 'green',
      globalSla: 'green',
      subStatus: null,
      fullName: companyName.trim(),
      dunsNumber: '',
      companyType: '',
      foundedYear: 0,
      headquarters: '',
      website: website.trim(),
      phone: phone.trim(),
      contactEmail: email1.trim(),
      contactName: name1.trim(),
      technology: '',
      machineryType: '',
      processMethod: '',
      pressCapacity: '',
      materials: '',
      safetyCritical: false,
      safetyExperience: false,
      certifications: '',
      knowsCQIs: false,
      annualRevenue: '',
      productionVolume: '',
      employees: 0,
      facilities: 0,
      topCustomers: '',
      hasIMMEX: false,
      planIMMEX: false,
      exportCapability: false,
      strengths: '',
      weaknesses: '',
      observations: '',
      recommendations: '',
      priority: 3,
      primaryDriver: '',
      confidenceLevel: 'Low',
      documents: [],
      preEvalStartDate: null,
      parts: [],
      initialQuoteSubmitted: false,
      qadPrice: null,
      savingExpected: null,
      tooling: null,
      selectedForDevelopment: false,
      investigateRecordNumber: null,
      intelexDate: null,
      history: [
        { date: today, action: 'Supplier registered directly to Parking Lot', user: 'Yael Urbano', role: 'IT Trainee' },
      ],
      onboardingDate: today,
      scoutingTabsCompleted: { scoutingEvent: false, supplierInfo: false, attendees: false, agenda: false, nextStep: false },
      b2bStatus: (b2bMeeting as PipelineSupplier['b2bStatus']) || null,
      b2bWhoAttends: null, b2bManager: null, b2bBuyer: null, b2bComments: null,
      agendaStatus: null, agendaTeamsLink: null, agendaScheduledDate: null, agendaTimezone: null,
      agendaStand: null, agendaStartTime: null, agendaEndTime: null, agendaDuration: null,
      selectedForParking: null, selectionReason: null,
      parkingOnboardingDate: onboardingDate || null,
      parkingTimeless: timeless,
      parkingDateToMovePreliminary: timeless ? null : (dateToMove || null),
      parkingDaysElapsed: daysElapsed ? Number(daysElapsed) : 0,
      parkingScoutingInput: scoutingInputVal.trim() || 'Registro directo',
      parkingSubStatus: null,
      parkingIsRecommendation: true,
      parkingBuyer: buyer.trim() || null,
      parkingCompanyName: companyName.trim(),
      parkingB2BMeeting: (b2bMeeting as PipelineSupplier['parkingB2BMeeting']) || null,
      parkingName1: name1.trim() || null,
      parkingWebsite: website.trim() || null,
      parkingEmail1: email1.trim() || null,
      parkingPhone: phone.trim() || null,
      parkingCommodity: commodity.trim() || null,
      parkingProductType: productType.trim() || null,
      parkingManufacturingCountry: mfgCountry.trim() || null,
      parkingManufacturingAddress: mfgAddress.trim() || null,
      parkingAdditionalComments: comments.trim() || null,
      parkingTabsCompleted: { overview: false, contact: companyName.trim().length > 0 && buyer.trim().length > 0, details: false },
    };
    pipelineSuppliers.push(newSupplier);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add supplier to Parking Lot</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a supplier via internal recommendation.</p>

        {/* Overview */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Supplier onboarding date <span style={{ color: '#DC0202' }}>*</span></label>
              <input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date to move to Preliminary</label>
              <input type="date" value={dateToMove} onChange={e => setDateToMove(e.target.value)} disabled={timeless} style={{ ...inputStyle, opacity: timeless ? 0.45 : 1, cursor: timeless ? 'not-allowed' : 'text' }} />
            </div>
            <div>
              <label style={labelStyle}>Days elapsed</label>
              <input type="number" value={daysElapsed} onChange={e => setDaysElapsed(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Scouting input</label>
              <input type="text" value={scoutingInputVal} onChange={e => setScoutingInputVal(e.target.value)} style={inputStyle} />
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
              <label style={labelStyle}>Buyer</label>
              <input type="text" value={buyer} onChange={e => setBuyer(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Company name <span style={{ color: '#DC0202' }}>*</span></label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. BOSCH México" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>B2B meeting</label>
              <select value={b2bMeeting} onChange={e => setB2bMeeting(e.target.value)} style={inputStyle}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Name 1</label>
              <input type="text" value={name1} onChange={e => setName1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input type="text" value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email 1</label>
              <input type="email" value={email1} onChange={e => setEmail1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ marginBottom: 24 }}>
          <p style={groupLabelStyle}>Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Commodity</label>
              <input type="text" value={commodity} onChange={e => setCommodity(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Product type</label>
              <input type="text" value={productType} onChange={e => setProductType(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Manufacturing country</label>
              <input type="text" value={mfgCountry} onChange={e => setMfgCountry(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Manufacturing address</label>
              <input type="text" value={mfgAddress} onChange={e => setMfgAddress(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Additional comments</label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45 }}
          >
            Add to Parking Lot &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
