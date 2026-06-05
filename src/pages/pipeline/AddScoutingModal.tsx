import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, PipelineSupplier } from '../../data/pipeline-demo';

interface Props {
  onClose: () => void;
}

export function AddScoutingModal({ onClose }: Props) {
  const [eventName, setEventName] = useState('');
  const [isDirect, setIsDirect] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [typeOfProducts, setTypeOfProducts] = useState('');
  const [commodity, setCommodity] = useState('');
  const [website, setWebsite] = useState('');

  const eventComplete = eventName.trim().length > 0;
  const supplierInfoComplete =
    companyName.trim().length > 0 &&
    typeOfProducts.trim().length > 0 &&
    commodity.trim().length > 0 &&
    website.trim().length > 0;

  const canSubmit = eventComplete && supplierInfoComplete;

  function handleSubmit() {
    if (!canSubmit) return;

    const newId = `ps-${Date.now()}`;
    const folio = `SSD-2026-${String(pipelineSuppliers.length + 1).padStart(3, '0')}`;

    const newSupplier: PipelineSupplier = {
      id: newId,
      folio,
      name: companyName.trim().toUpperCase(),
      stage: 'Scouting Event',
      scoutingPhase: 'Identified',
      entrySource: isDirect ? 'Recommendation' : 'Scouting Event',
      commodity: commodity.trim(),
      productType: typeOfProducts.trim(),
      country: '',
      manufacturingAddress: '',
      buyer: '',
      scoutingInput: isDirect ? 'Registro directo' : eventName.trim(),
      daysInStage: 0,
      daysSinceParkingLot: null,
      docsPercent: 0,
      sla: 'green',
      globalSla: null,
      subStatus: null,
      fullName: companyName.trim(),
      dunsNumber: '',
      companyType: '',
      foundedYear: 0,
      headquarters: '',
      website: website.trim(),
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
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          action: isDirect ? 'Supplier registered directly' : `Supplier registered from Scouting Event: ${eventName.trim()}`,
          user: 'Yael Urbano',
          role: 'IT Trainee',
        },
      ],
      onboardingDate: new Date().toISOString().split('T')[0],
      scoutingTabsCompleted: {
        scoutingEvent: eventComplete,
        supplierInfo: supplierInfoComplete,
        attendees: false,
        agenda: false,
        nextStep: false,
      },
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
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Add supplier to Scouting</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a new supplier from a scouting event</p>

        {/* Group 1 — Scouting Event */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Scouting Event</p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 4 }}>Name of event <span style={{ color: '#DC0202' }}>*</span></label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="e.g. Automotive Supplier Summit 2026"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isDirect}
              onChange={e => setIsDirect(e.target.checked)}
              style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#000000' }}>Direct registration (not from an event)</span>
          </label>
        </div>

        {/* Group 2 — Supplier Info */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Supplier Info</p>

          {[
            { label: 'Company name', value: companyName, setter: setCompanyName, placeholder: 'e.g. BOSCH México S.A. de C.V.' },
            { label: 'Type of products', value: typeOfProducts, setter: setTypeOfProducts, placeholder: 'e.g. Torque sensors, EPS components' },
            { label: 'Commodity', value: commodity, setter: setCommodity, placeholder: 'e.g. E-Mechanical Components' },
            { label: 'Website', value: website, setter: setWebsite, placeholder: 'e.g. https://bosch.com' },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 4 }}>
                {field.label} <span style={{ color: '#DC0202' }}>*</span>
              </label>
              <input
                type="text"
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45 }}
          >
            Add supplier
          </button>
        </div>
      </div>
    </div>
  );
}
