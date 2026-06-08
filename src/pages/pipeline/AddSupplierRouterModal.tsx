import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faMagnifyingGlass, faCarSide, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, PipelineSupplier } from '../../data/pipeline-demo';

interface Props {
  onClose: () => void;
}

type Step = 'select' | 'scouting' | 'parking';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};
const groupLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};
const labelStyle: React.CSSProperties = { fontSize: 13, color: '#000000', display: 'block', marginBottom: 4 };

function baseSupplier(): PipelineSupplier {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: `ps-${Date.now()}`,
    folio: `SSD-2026-${String(pipelineSuppliers.length + 1).padStart(3, '0')}`,
    name: '',
    stage: 'Scouting Event',
    scoutingPhase: null,
    entrySource: 'Scouting Event',
    commodity: '',
    productType: '',
    country: '',
    manufacturingAddress: '',
    buyer: '',
    scoutingInput: '',
    daysInStage: 0,
    daysSinceParkingLot: null,
    docsPercent: 0,
    sla: 'green',
    globalSla: null,
    subStatus: null,
    fullName: '',
    dunsNumber: '',
    companyType: '',
    foundedYear: 0,
    headquarters: '',
    website: '',
    phone: '',
    contactEmail: '',
    contactName: '',
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
    history: [],
    onboardingDate: today,
    scoutingTabsCompleted: { scoutingEvent: false, supplierInfo: false, attendees: false, agenda: false, nextStep: false },
    b2bStatus: null,
    b2bWhoAttends: null,
    b2bManager: null,
    b2bBuyer: null,
    b2bComments: null,
    agendaStatus: null,
    agendaTeamsLink: null,
    agendaScheduledDate: null,
    agendaTimezone: null,
    agendaStand: null,
    agendaStartTime: null,
    agendaEndTime: null,
    agendaDuration: null,
    selectedForParking: null,
    selectionReason: null,
    parkingOnboardingDate: null,
    parkingTimeless: false,
    parkingDateToMovePreliminary: null,
    parkingDaysElapsed: null,
    parkingScoutingInput: null,
    parkingSubStatus: null,
    parkingIsRecommendation: false,
    parkingBuyer: null,
    parkingCompanyName: null,
    parkingB2BMeeting: null,
    parkingName1: null,
    parkingWebsite: null,
    parkingEmail1: null,
    parkingPhone: null,
    parkingCommodity: null,
    parkingProductType: null,
    parkingManufacturingCountry: null,
    parkingManufacturingAddress: null,
    parkingAdditionalComments: null,
    parkingTabsCompleted: null,
  };
}

function StageCard({ icon, color, title, desc, selected, onClick }: {
  icon: typeof faMagnifyingGlass; color: string; title: string; desc: string; selected: boolean; onClick: () => void;
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

export function AddSupplierRouterModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selectedStage, setSelectedStage] = useState<'Scouting Event' | 'Parking Lot' | ''>('');

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

        {step === 'select' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add Supplier</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Choose which stage to add the supplier to.</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <StageCard
                icon={faMagnifyingGlass} color="#02B3E1" title="Scouting Event"
                desc="Supplier identified at a scouting event or trade show."
                selected={selectedStage === 'Scouting Event'} onClick={() => setSelectedStage('Scouting Event')}
              />
              <StageCard
                icon={faCarSide} color="#D4A017" title="Parking Lot"
                desc="Supplier added via internal recommendation."
                selected={selectedStage === 'Parking Lot'} onClick={() => setSelectedStage('Parking Lot')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => setStep(selectedStage === 'Parking Lot' ? 'parking' : 'scouting')}
                disabled={!selectedStage}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: selectedStage ? 'pointer' : 'not-allowed', opacity: selectedStage ? 1 : 0.45 }}
              >
                Continue &rarr;
              </button>
            </div>
          </>
        )}

        {step === 'scouting' && <ScoutingForm onBack={() => setStep('select')} onClose={onClose} />}
        {step === 'parking' && <ParkingForm onBack={() => setStep('select')} onClose={onClose} />}
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: '#808285', marginBottom: 12 }}
    >
      <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
    </button>
  );
}

function ScoutingForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [eventName, setEventName] = useState('');
  const [isDirect, setIsDirect] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [typeOfProducts, setTypeOfProducts] = useState('');
  const [commodity, setCommodity] = useState('');
  const [website, setWebsite] = useState('');

  const eventComplete = eventName.trim().length > 0;
  const supplierInfoComplete =
    companyName.trim().length > 0 && typeOfProducts.trim().length > 0 &&
    commodity.trim().length > 0 && website.trim().length > 0;
  const canSubmit = eventComplete && supplierInfoComplete;

  function handleSubmit() {
    if (!canSubmit) return;
    const today = new Date().toISOString().split('T')[0];
    const s = baseSupplier();
    s.name = companyName.trim().toUpperCase();
    s.stage = 'Scouting Event';
    s.scoutingPhase = 'Identified';
    s.entrySource = isDirect ? 'Recommendation' : 'Scouting Event';
    s.commodity = commodity.trim();
    s.productType = typeOfProducts.trim();
    s.scoutingInput = isDirect ? 'Registro directo' : eventName.trim();
    s.fullName = companyName.trim();
    s.website = website.trim();
    s.history = [{
      date: today,
      action: isDirect ? 'Supplier registered directly' : `Supplier registered from Scouting Event: ${eventName.trim()}`,
      user: 'Yael Urbano', role: 'IT Trainee',
    }];
    s.scoutingTabsCompleted = { scoutingEvent: eventComplete, supplierInfo: supplierInfoComplete, attendees: false, agenda: false, nextStep: false };
    pipelineSuppliers.push(s);
    onClose();
  }

  return (
    <>
      <BackButton onBack={onBack} />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add supplier to Scouting</h2>
      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a new supplier from a scouting event.</p>

      <div style={{ marginBottom: 24 }}>
        <p style={groupLabelStyle}>Scouting Event</p>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Name of event <span style={{ color: '#DC0202' }}>*</span></label>
          <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Automotive Supplier Summit 2026" style={inputStyle} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDirect} onChange={e => setIsDirect(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#000000' }}>Direct registration (not from an event)</span>
        </label>
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={groupLabelStyle}>Supplier Info</p>
        {[
          { label: 'Company name', value: companyName, setter: setCompanyName, placeholder: 'e.g. BOSCH México S.A. de C.V.' },
          { label: 'Type of products', value: typeOfProducts, setter: setTypeOfProducts, placeholder: 'e.g. Torque sensors, EPS components' },
          { label: 'Commodity', value: commodity, setter: setCommodity, placeholder: 'e.g. E-Mechanical Components' },
          { label: 'Website', value: website, setter: setWebsite, placeholder: 'e.g. https://bosch.com' },
        ].map(field => (
          <div key={field.label} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{field.label} <span style={{ color: '#DC0202' }}>*</span></label>
            <input type="text" value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
        <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={!canSubmit} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45 }}>Add Supplier &rarr;</button>
      </div>
    </>
  );
}

function ParkingForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [onboardingDate, setOnboardingDate] = useState(today);
  const [timeless, setTimeless] = useState(false);
  const [dateToMove, setDateToMove] = useState('');
  const [daysElapsed, setDaysElapsed] = useState('');
  const [scoutingInputVal, setScoutingInputVal] = useState('');

  const [isRecommendation, setIsRecommendation] = useState(true);
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
    const s = baseSupplier();
    s.name = companyName.trim().toUpperCase();
    s.stage = 'Parking Lot';
    s.scoutingPhase = null;
    s.entrySource = 'Recommendation';
    s.commodity = commodity.trim();
    s.productType = productType.trim();
    s.country = mfgCountry.trim();
    s.manufacturingAddress = mfgAddress.trim();
    s.buyer = buyer.trim();
    s.scoutingInput = scoutingInputVal.trim() || 'Registro directo';
    s.daysSinceParkingLot = 0;
    s.globalSla = 'green';
    s.subStatus = null;
    s.fullName = companyName.trim();
    s.website = website.trim();
    s.phone = phone.trim();
    s.contactEmail = email1.trim();
    s.contactName = name1.trim();
    s.history = [{ date: today, action: 'Supplier registered directly to Parking Lot', user: 'Yael Urbano', role: 'IT Trainee' }];
    s.b2bStatus = (b2bMeeting as PipelineSupplier['b2bStatus']) || null;
    s.parkingOnboardingDate = onboardingDate || null;
    s.parkingTimeless = timeless;
    s.parkingDateToMovePreliminary = timeless ? null : (dateToMove || null);
    s.parkingDaysElapsed = daysElapsed ? Number(daysElapsed) : 0;
    s.parkingScoutingInput = scoutingInputVal.trim() || 'Registro directo';
    s.parkingSubStatus = null;
    s.parkingIsRecommendation = isRecommendation;
    s.parkingBuyer = buyer.trim() || null;
    s.parkingCompanyName = companyName.trim();
    s.parkingB2BMeeting = (b2bMeeting as PipelineSupplier['parkingB2BMeeting']) || null;
    s.parkingName1 = name1.trim() || null;
    s.parkingWebsite = website.trim() || null;
    s.parkingEmail1 = email1.trim() || null;
    s.parkingPhone = phone.trim() || null;
    s.parkingCommodity = commodity.trim() || null;
    s.parkingProductType = productType.trim() || null;
    s.parkingManufacturingCountry = mfgCountry.trim() || null;
    s.parkingManufacturingAddress = mfgAddress.trim() || null;
    s.parkingAdditionalComments = comments.trim() || null;
    s.parkingTabsCompleted = { overview: false, contact: companyName.trim().length > 0 && buyer.trim().length > 0, details: false };
    pipelineSuppliers.push(s);
    onClose();
  }

  return (
    <>
      <BackButton onBack={onBack} />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add supplier to Parking Lot</h2>
      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a supplier via internal recommendation.</p>

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

      <div style={{ marginBottom: 24 }}>
        <p style={groupLabelStyle}>Contact</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={isRecommendation} onChange={e => setIsRecommendation(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#000000' }}>Internal recommendation</span>
        </label>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
        <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={!canSubmit} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45 }}>Add Supplier &rarr;</button>
      </div>
    </>
  );
}
