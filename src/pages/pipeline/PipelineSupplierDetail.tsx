import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight, faArrowLeft, faCheckCircle, faClock, faMinusCircle,
  faStickyNote, faFilePdf, faFileExcel, faFileWord, faFileAlt, faFolderOpen, faPlus,
  faLock, faTriangleExclamation, faDownload, faTrash, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';
import { MoveStageModal } from './MoveStageModal';
import { ParkingLotPrefillModal } from './ParkingLotPrefillModal';

const parkingSlaColor = (days: number) => (days >= 90 ? '#DC0202' : days >= 60 ? '#D4A017' : '#6ABF4B');
const parkingSlaLabel = (days: number) => (days >= 90 ? 'Overdue' : days >= 60 ? 'At Risk' : 'OK');
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};

const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};
const priorityStyles: Record<number, { bg: string; text: string }> = {
  1: { bg: '#DC020226', text: '#DC0202' },
  2: { bg: '#E3650B26', text: '#E3650B' },
  3: { bg: '#D4A01726', text: '#D4A017' },
};
const confidenceStyles: Record<string, { bg: string; text: string }> = {
  'High':   { bg: '#6ABF4B26', text: '#6ABF4B' },
  'Medium': { bg: '#D4A01726', text: '#D4A017' },
  'Low':    { bg: '#DC020226', text: '#DC0202' },
};

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return <span style={{ backgroundColor: bg, color: text, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3, display: 'inline-block' }}>{label}</span>;
}

function SectionTitle({ title }: { title: string }) {
  return <h3 style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>{title}</h3>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
      <span style={{ fontSize: 13, color: '#808285', flex: '0 0 44%' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#000000', fontWeight: 400, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  );
}

function TabGeneral({ supplier }: { supplier: PipelineSupplier }) {
  const stageColor = pipelineStageConfig.find(s => s.name === supplier.stage)?.color ?? '#808285';
  const isScouting = supplier.stage === 'Scouting Event';
  const isIdentified = isScouting && supplier.scoutingPhase === 'Identified';
  const isB2B = isScouting && supplier.scoutingPhase === 'B2B';
  const showTechnical = !isIdentified;
  const showCommercial = !isScouting;
  const showAssessment = !isIdentified;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Company info */}
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <SectionTitle title="Company Information" />
          <InfoRow label="Full name" value={supplier.fullName} />
          <InfoRow label="DUNS Number" value={supplier.dunsNumber} />
          <InfoRow label="Company type" value={supplier.companyType} />
          <InfoRow label="Founded year" value={supplier.foundedYear} />
          <InfoRow label="Headquarters" value={supplier.headquarters} />
          <InfoRow label="Manufacturing address" value={supplier.manufacturingAddress + ', ' + supplier.country} />
          <InfoRow label="Website" value={<a href={supplier.website} target="_blank" rel="noreferrer" style={{ color: '#02B3E1', textDecoration: 'none' }}>{supplier.website}</a>} />
          <InfoRow label="Phone" value={supplier.phone} />
          <InfoRow label="Email" value={supplier.contactEmail} />
          <InfoRow label="Main contact" value={supplier.contactName} />
        </div>

        {/* Technical */}
        {showTechnical && (
          <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
            <SectionTitle title="Technical Capabilities" />
            <InfoRow label="Commodity" value={supplier.commodity} />
            <InfoRow label="Product type" value={supplier.productType} />
            <InfoRow label="Main technology" value={supplier.technology} />
            <InfoRow label="Machinery type" value={supplier.machineryType} />
            <InfoRow label="Process method" value={supplier.processMethod} />
            <InfoRow label="Press capacity" value={supplier.pressCapacity} />
            <InfoRow label="Materials" value={supplier.materials} />
            <InfoRow label="Safety-critical part" value={<Badge bg={supplier.safetyCritical ? '#6ABF4B26' : '#80828526'} text={supplier.safetyCritical ? '#6ABF4B' : '#808285'} label={supplier.safetyCritical ? 'Yes' : 'No'} />} />
            <InfoRow label="Safety experience" value={<Badge bg={supplier.safetyExperience ? '#6ABF4B26' : '#80828526'} text={supplier.safetyExperience ? '#6ABF4B' : '#808285'} label={supplier.safetyExperience ? 'Yes' : 'No'} />} />
            <InfoRow label="Certifications" value={supplier.certifications} />
            <InfoRow label="Knows CQIs" value={<Badge bg={supplier.knowsCQIs ? '#6ABF4B26' : '#DC020226'} text={supplier.knowsCQIs ? '#6ABF4B' : '#DC0202'} label={supplier.knowsCQIs ? 'Yes' : 'No'} />} />
          </div>
        )}

        {/* Commercial */}
        {showCommercial && (
          <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
            <SectionTitle title="Commercial Information" />
            <InfoRow label="Assigned buyer" value={supplier.buyer} />
            <InfoRow label="Annual revenue" value={supplier.annualRevenue} />
            <InfoRow label="Production volume" value={supplier.productionVolume} />
            <InfoRow label="Employees" value={supplier.employees.toLocaleString()} />
            <InfoRow label="Facilities" value={supplier.facilities} />
            <InfoRow label="Top Customers" value={supplier.topCustomers} />
            <InfoRow label="IMMEX" value={<Badge bg={supplier.hasIMMEX ? '#6ABF4B26' : '#80828526'} text={supplier.hasIMMEX ? '#6ABF4B' : '#808285'} label={supplier.hasIMMEX ? 'Yes' : 'No'} />} />
            <InfoRow label="Plan IMMEX" value={<Badge bg={supplier.planIMMEX ? '#6ABF4B26' : '#80828526'} text={supplier.planIMMEX ? '#6ABF4B' : '#808285'} label={supplier.planIMMEX ? 'Yes' : 'No'} />} />
            <InfoRow label="Export capability" value={<Badge bg={supplier.exportCapability ? '#6ABF4B26' : '#80828526'} text={supplier.exportCapability ? '#6ABF4B' : '#808285'} label={supplier.exportCapability ? 'Yes' : 'No'} />} />
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Origin */}
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <SectionTitle title="Origin & Traceability" />
          <InfoRow label="Scouting Input" value={supplier.scoutingInput} />
          <InfoRow label="Entry source" value={supplier.entrySource} />
          {isScouting && <InfoRow label="Scouting phase" value={<Badge bg={isB2B ? '#6366F126' : '#02B3E126'} text={isB2B ? '#6366F1' : '#02B3E1'} label={supplier.scoutingPhase ?? 'N/A'} />} />}
          <InfoRow label="Onboarding date" value={supplier.onboardingDate} />
          <InfoRow label="Days in stage" value={supplier.daysInStage} />
          <InfoRow label="Current stage" value={<Badge bg={stageColor + '26'} text={stageColor} label={supplier.stage} />} />
          {supplier.subStatus && <InfoRow label="Sub-status" value={<Badge bg={subStatusStyles[supplier.subStatus].bg} text={subStatusStyles[supplier.subStatus].text} label={supplier.subStatus} />} />}
          {supplier.daysSinceParkingLot !== null && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: '#808285', margin: '0 0 6px' }}>Global SLA ({supplier.daysSinceParkingLot}/90 days)</p>
              <div style={{ backgroundColor: '#EEEEEE', borderRadius: 4, height: 6, width: '100%' }}>
                <div style={{
                  height: 6, borderRadius: 4,
                  width: `${Math.min((supplier.daysSinceParkingLot / 90) * 100, 100)}%`,
                  backgroundColor: supplier.daysSinceParkingLot >= 90 ? '#DC0202' : supplier.daysSinceParkingLot >= 75 ? '#D4A017' : '#6ABF4B',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Evaluation */}
        {showAssessment && (
          <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
            <SectionTitle title="Quick Assessment" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><p style={{ fontSize: 11, color: '#808285', margin: '0 0 3px', fontWeight: 700 }}>Strengths</p><p style={{ fontSize: 13, color: '#000', margin: 0 }}>{supplier.strengths}</p></div>
              <div><p style={{ fontSize: 11, color: '#808285', margin: '0 0 3px', fontWeight: 700 }}>Weaknesses</p><p style={{ fontSize: 13, color: '#000', margin: 0 }}>{supplier.weaknesses}</p></div>
              <div><p style={{ fontSize: 11, color: '#808285', margin: '0 0 3px', fontWeight: 700 }}>Observations</p><p style={{ fontSize: 13, color: '#000', margin: 0 }}>{supplier.observations}</p></div>
              <div><p style={{ fontSize: 11, color: '#808285', margin: '0 0 3px', fontWeight: 700 }}>Recommendations</p><p style={{ fontSize: 13, color: '#000', margin: 0 }}>{supplier.recommendations}</p></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Badge bg={priorityStyles[supplier.priority].bg} text={priorityStyles[supplier.priority].text} label={`Priority ${supplier.priority}`} />
              <Badge bg="#0084C026" text="#0084C0" label={supplier.primaryDriver} />
              <Badge bg={confidenceStyles[supplier.confidenceLevel].bg} text={confidenceStyles[supplier.confidenceLevel].text} label={supplier.confidenceLevel} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabDocuments({ supplier }: { supplier: PipelineSupplier }) {
  const signed = supplier.documents.filter(d => d.status === 'Firmado').length;
  const total = supplier.documents.length;
  const pct = Math.round((signed / total) * 100);

  const statusIcon: Record<string, typeof faCheckCircle> = { 'Firmado': faCheckCircle, 'Pendiente': faClock, 'No aplica': faMinusCircle };
  const statusColor: Record<string, string> = { 'Firmado': '#6ABF4B', 'Pendiente': '#D4A017', 'No aplica': '#808285' };
  const statusLabel: Record<string, string> = { 'Firmado': 'Signed', 'Pendiente': 'Pending', 'No aplica': 'N/A' };

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#000', margin: '0 0 8px' }}>Docs {pct}% completed</p>
        <div style={{ backgroundColor: '#EEEEEE', borderRadius: 4, height: 8, width: '100%' }}>
          <div style={{ height: 8, borderRadius: 4, backgroundColor: getDocsBarColor(pct), width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {supplier.documents.map((doc) => (
          <div key={doc.name} className="flex items-center" style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0', gap: 12 }}>
            <FontAwesomeIcon icon={statusIcon[doc.status]} style={{ fontSize: 14, color: statusColor[doc.status] }} />
            <span style={{ flex: 1, fontSize: 13, color: '#000000' }}>{doc.name}</span>
            <Badge bg={statusColor[doc.status] + '26'} text={statusColor[doc.status]} label={statusLabel[doc.status]} />
            {doc.date && <span style={{ fontSize: 12, color: '#808285' }}>{doc.date}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabEvaluation({ supplier }: { supplier: PipelineSupplier }) {
  if (!supplier.preEvalStartDate) {
    return (
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: '#808285' }}>Evaluation not available for this stage.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Evaluation data */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
        <SectionTitle title="Preliminary Evaluation Data" />
        <InfoRow label="Pre-Evaluation Start Date" value={supplier.preEvalStartDate} />
        <InfoRow label="Days in evaluation" value={supplier.daysInStage} />
        {supplier.initialQuoteSubmitted && (
          <>
            <InfoRow label="QAD Price" value={supplier.qadPrice ?? 'N/A'} />
            <InfoRow label="Saving Expected" value={supplier.savingExpected ?? 'N/A'} />
            <InfoRow label="Tooling" value={supplier.tooling ?? 'N/A'} />
            <InfoRow label="Selected for Development" value={<Badge bg={supplier.selectedForDevelopment ? '#6ABF4B26' : '#80828526'} text={supplier.selectedForDevelopment ? '#6ABF4B' : '#808285'} label={supplier.selectedForDevelopment ? 'Yes' : 'No'} />} />
            {supplier.investigateRecordNumber && <InfoRow label="IR Number" value={supplier.investigateRecordNumber} />}
            {supplier.intelexDate && <InfoRow label="Intelex Date" value={supplier.intelexDate} />}
          </>
        )}
      </div>

      {/* Parts table */}
      {supplier.parts.length > 0 && (
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E0E0E0' }}>
            <SectionTitle title="Parts Evaluation" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>
                  {['Part Number', 'Description', 'PL', 'Peak Vol.', 'Program', 'EOP', 'Target $', 'RFQ $', 'Delta $', 'Confidence'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#000', borderBottom: '0.5px solid #D1D3D4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplier.parts.map(p => (
                  <tr key={p.partNumber} style={{ borderBottom: '0.5px solid #D1D3D4' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500 }}>{p.partNumber}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.partDescription}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.pl}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.peakVolume.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.program}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.eop}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>${p.targetPrice.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>${p.rfqPrice.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: p.rfqPrice < p.targetPrice ? '#6ABF4B' : '#DC0202' }}>
                      ${(p.rfqPrice - p.targetPrice).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge bg={confidenceStyles[p.confidence].bg} text={confidenceStyles[p.confidence].text} label={p.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabHistory({ supplier }: { supplier: PipelineSupplier }) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, backgroundColor: '#E0E0E0' }} />

        {supplier.history.slice().reverse().map((entry, i) => (
          <div key={i} style={{ position: 'relative', paddingBottom: i < supplier.history.length - 1 ? 20 : 0 }}>
            {/* Dot */}
            <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFFFFF', border: '2px solid #0084C0', zIndex: 1 }} />
            <div>
              <p style={{ fontSize: 12, color: '#808285', margin: '0 0 2px' }}>{entry.date}</p>
              <p style={{ fontSize: 13, color: '#000000', margin: '0 0 2px', fontWeight: 500 }}>{entry.action}</p>
              <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{entry.user} · {entry.role}</p>
              {entry.note && <p style={{ fontSize: 12, color: '#808285', margin: '4px 0 0', fontStyle: 'italic' }}>{entry.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface NoteItem { id: string; user: string; role: string; initials: string; text: string; timestamp: string }

function getInitialNotes(): NoteItem[] {
  return [
    { id: 'n1', user: 'Ana Garcia', role: 'Buyer', initials: 'AG', text: 'Supplier confirmed interest in developing capacity for Mexico operations. Follow-up scheduled for next week.', timestamp: 'May 30, 2026 · 2:15 PM' },
    { id: 'n2', user: 'Carlos Mendoza', role: 'SSD Lead', initials: 'CM', text: 'NDA sent via DocuSign. Waiting for supplier\'s legal team signature.', timestamp: 'May 25, 2026 · 9:40 AM' },
    { id: 'n3', user: 'Roberto Sanchez', role: 'Buyer', initials: 'RS', text: 'Initial contact established at scouting event. Good technical capabilities for our requirements.', timestamp: 'May 18, 2026 · 11:05 AM' },
  ];
}

function TabNotes() {
  const [notes, setNotes] = useState<NoteItem[]>(getInitialNotes);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function saveNote() {
    if (!draft.trim()) return;
    const newNote: NoteItem = {
      id: `n-${Date.now()}`,
      user: 'Yael Urbano',
      role: 'IT Trainee',
      initials: 'YU',
      text: draft.trim(),
      timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setNotes([newNote, ...notes]);
    setDraft('');
    setAdding(false);
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Notes</h3>
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add note
        </button>
      </div>

      {adding && (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #E0E0E0', borderRadius: 6, backgroundColor: '#FAFAFA' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Write a note about this supplier..."
            rows={3}
            style={{ width: '100%', border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#000000', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={saveNote} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save note</button>
            <button onClick={() => { setAdding(false); setDraft(''); }} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#FFFFFF', color: '#000000', border: '1px solid #D1D3D4', borderRadius: 4, cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <FontAwesomeIcon icon={faStickyNote} style={{ fontSize: 40, color: '#D1D3D4', marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>No notes yet</p>
          <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>Add the first note using the button above</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notes.map((note, i) => (
            <div key={note.id} style={{ padding: '12px 0', borderBottom: i < notes.length - 1 ? '0.5px solid #D1D3D4' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#808285', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {note.initials}
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{note.user}</span>
                  <span style={{ fontSize: 11, color: '#808285' }}> · {note.role}</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#808285', margin: '0 0 4px', paddingLeft: 38 }}>{note.timestamp}</p>
              <p style={{ fontSize: 13, color: '#000000', margin: 0, paddingLeft: 38, lineHeight: 1.5 }}>{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabFiles({ supplier }: { supplier: PipelineSupplier }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const files = [
    { name: `NDA_${supplier.name.replace(/ /g, '_')}_2026.pdf`, category: 'NDA', size: '245 KB', date: 'May 20, 2026', uploadedBy: 'Ana Garcia', type: 'pdf' },
    { name: `Technical_Profile_${supplier.name.replace(/ /g, '_')}.xlsx`, category: 'Technical', size: '1.2 MB', date: 'May 12, 2026', uploadedBy: 'Carlos Mendoza', type: 'xlsx' },
    { name: 'Preliminary_Evaluation_Form.pdf', category: 'Evaluation', size: '890 KB', date: 'May 5, 2026', uploadedBy: 'Roberto Sanchez', type: 'pdf' },
    { name: `RFQ_Package_${supplier.name.replace(/ /g, '_')}.docx`, category: 'RFQ', size: '340 KB', date: 'Apr 28, 2026', uploadedBy: 'Ana Garcia', type: 'docx' },
  ];

  const fileIcons: Record<string, { icon: typeof faFilePdf; color: string }> = {
    pdf: { icon: faFilePdf, color: '#DC0202' },
    xlsx: { icon: faFileExcel, color: '#6ABF4B' },
    docx: { icon: faFileWord, color: '#02B3E1' },
    other: { icon: faFileAlt, color: '#808285' },
  };

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, backgroundColor: '#FFFFFF', borderRadius: 8, padding: '12px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 13, color: '#808285' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Files</h3>
        <button onClick={() => setToast('File upload feature available in production version')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Upload file
        </button>
      </div>

      {files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <FontAwesomeIcon icon={faFolderOpen} style={{ fontSize: 40, color: '#D1D3D4', marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>No files attached</p>
          <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>Upload files using the button above</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {files.map((file, i) => {
            const fi = fileIcons[file.type] || fileIcons.other;
            return (
              <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < files.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
                <FontAwesomeIcon icon={fi.icon} style={{ fontSize: 18, color: fi.color, width: 20 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#000000', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3, backgroundColor: '#EEEEEE', color: '#808285' }}>{file.category}</span>
                <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>{file.size}</span>
                <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>{file.date}</span>
                <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>{file.uploadedBy}</span>
                <button onClick={() => setToast('Download available in production version')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <FontAwesomeIcon icon={faDownload} style={{ fontSize: 13, color: '#0084C0' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Scouting Tab Components ────────────────────────────────────────────────

function ScoutingField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#DC0202', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function scoutingInput(value: string, onChange: (v: string) => void, placeholder?: string) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
    />
  );
}

function ContinueButton({ enabled, onContinue }: { enabled: boolean; onContinue: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
      <button
        onClick={enabled ? onContinue : undefined}
        disabled={!enabled}
        style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45 }}
      >
        Save
      </button>
    </div>
  );
}

function TabScoutingEvent({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [eventName, setEventName] = useState(supplier.scoutingInput || '');
  const [isDirect, setIsDirect] = useState(supplier.entrySource === 'Recommendation');
  const isComplete = eventName.trim().length > 0;

  function handleContinue() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].scoutingInput = eventName.trim();
      pipelineSuppliers[idx].scoutingTabsCompleted.scoutingEvent = true;
    }
    onComplete();
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Scouting Event Details</h3>
      <ScoutingField label="Name of event" required>
        {scoutingInput(eventName, setEventName, 'e.g. Automotive Supplier Summit 2026')}
      </ScoutingField>
      <ScoutingField label="Direct registration">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDirect} onChange={e => setIsDirect(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#000000' }}>Supplier was registered directly (not from an event)</span>
        </label>
      </ScoutingField>
      <ContinueButton enabled={isComplete} onContinue={handleContinue} />
    </div>
  );
}

function TabSupplierInfo({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [companyName, setCompanyName] = useState(supplier.fullName || '');
  const [products, setProducts] = useState(supplier.productType || '');
  const [commodity, setCommodity] = useState(supplier.commodity || '');
  const [website, setWebsite] = useState(supplier.website || '');
  const isComplete = companyName.trim() && products.trim() && commodity.trim() && website.trim();

  function handleContinue() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].fullName = companyName.trim();
      pipelineSuppliers[idx].productType = products.trim();
      pipelineSuppliers[idx].commodity = commodity.trim();
      pipelineSuppliers[idx].website = website.trim();
      pipelineSuppliers[idx].scoutingTabsCompleted.supplierInfo = true;
    }
    onComplete();
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Supplier Information</h3>
      <ScoutingField label="Company name" required>
        {scoutingInput(companyName, setCompanyName, 'e.g. BOSCH México S.A. de C.V.')}
      </ScoutingField>
      <ScoutingField label="Type of products" required>
        {scoutingInput(products, setProducts, 'e.g. Torque sensors, EPS components')}
      </ScoutingField>
      <ScoutingField label="Commodity" required>
        {scoutingInput(commodity, setCommodity, 'e.g. E-Mechanical Components')}
      </ScoutingField>
      <ScoutingField label="Website" required>
        {scoutingInput(website, setWebsite, 'e.g. https://bosch.com')}
      </ScoutingField>
      <ContinueButton enabled={!!isComplete} onContinue={handleContinue} />
    </div>
  );
}

function TabAttendees({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [b2bStatus, setB2bStatus] = useState<'Yes' | 'No' | ''>(supplier.b2bStatus || '');
  const [whoAttends, setWhoAttends] = useState(supplier.b2bWhoAttends || '');
  const [manager, setManager] = useState(supplier.b2bManager || '');
  const [buyer, setBuyer] = useState(supplier.b2bBuyer || '');
  const [comments, setComments] = useState(supplier.b2bComments || '');
  const isComplete = b2bStatus !== '' && whoAttends.trim() && manager.trim() && buyer.trim();

  function handleContinue() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].b2bStatus = b2bStatus as 'Yes' | 'No';
      pipelineSuppliers[idx].b2bWhoAttends = whoAttends.trim();
      pipelineSuppliers[idx].b2bManager = manager.trim();
      pipelineSuppliers[idx].b2bBuyer = buyer.trim();
      pipelineSuppliers[idx].b2bComments = comments.trim() || null;
      if (b2bStatus === 'Yes') {
        pipelineSuppliers[idx].scoutingPhase = 'B2B';
      }
      pipelineSuppliers[idx].scoutingTabsCompleted.attendees = true;
    }
    onComplete();
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Attendees & B2B</h3>
      <ScoutingField label="B2B meeting confirmed?" required>
        <div className="flex" style={{ gap: 8 }}>
          {(['Yes', 'No'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setB2bStatus(opt)}
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                border: `1px solid ${b2bStatus === opt ? '#DC0202' : '#D1D3D4'}`,
                backgroundColor: b2bStatus === opt ? '#DC020210' : '#FFFFFF',
                color: b2bStatus === opt ? '#DC0202' : '#808285',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </ScoutingField>
      <ScoutingField label="Who attends from supplier" required>
        {scoutingInput(whoAttends, setWhoAttends, 'e.g. Hans Weber, Technical Director')}
      </ScoutingField>
      <ScoutingField label="Manager attending" required>
        {scoutingInput(manager, setManager, 'e.g. Ana García')}
      </ScoutingField>
      <ScoutingField label="Buyer attending" required>
        {scoutingInput(buyer, setBuyer, 'e.g. Carlos Mendoza')}
      </ScoutingField>
      <ScoutingField label="Comments">
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          rows={3}
          placeholder="Any notes about the meeting..."
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </ScoutingField>
      <ContinueButton enabled={!!isComplete} onContinue={handleContinue} />
    </div>
  );
}

function TabAgenda({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [status, setStatus] = useState(supplier.agendaStatus || '');
  const [teamsLink, setTeamsLink] = useState(supplier.agendaTeamsLink || '');
  const [date, setDate] = useState(supplier.agendaScheduledDate || '');
  const [timezone, setTimezone] = useState(supplier.agendaTimezone || '');
  const [stand, setStand] = useState(supplier.agendaStand || '');
  const [startTime, setStartTime] = useState(supplier.agendaStartTime || '');
  const [endTime, setEndTime] = useState(supplier.agendaEndTime || '');
  const isComplete = status.trim() && date.trim() && startTime.trim() && endTime.trim();

  function handleContinue() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].agendaStatus = status.trim();
      pipelineSuppliers[idx].agendaTeamsLink = teamsLink.trim() || null;
      pipelineSuppliers[idx].agendaScheduledDate = date.trim();
      pipelineSuppliers[idx].agendaTimezone = timezone.trim() || null;
      pipelineSuppliers[idx].agendaStand = stand.trim() || null;
      pipelineSuppliers[idx].agendaStartTime = startTime.trim();
      pipelineSuppliers[idx].agendaEndTime = endTime.trim();
      pipelineSuppliers[idx].scoutingTabsCompleted.agenda = true;
    }
    onComplete();
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Agenda</h3>
      <ScoutingField label="Meeting status" required>
        {scoutingInput(status, setStatus, 'e.g. Confirmed, Pending, Cancelled')}
      </ScoutingField>
      <ScoutingField label="Teams link">
        {scoutingInput(teamsLink, setTeamsLink, 'https://teams.microsoft.com/l/meetup-join/...')}
      </ScoutingField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ScoutingField label="Scheduled date" required>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }} />
        </ScoutingField>
        <ScoutingField label="Timezone">
          {scoutingInput(timezone, setTimezone, 'e.g. CST, CET')}
        </ScoutingField>
        <ScoutingField label="Stand / Location">
          {scoutingInput(stand, setStand, 'e.g. B-24')}
        </ScoutingField>
        <ScoutingField label="Start time" required>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }} />
        </ScoutingField>
        <ScoutingField label="End time" required>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }} />
        </ScoutingField>
      </div>
      <ContinueButton enabled={!!isComplete} onContinue={handleContinue} />
    </div>
  );
}

function TabNextStep({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [selected, setSelected] = useState<boolean | ''>(
    supplier.selectedForParking === null ? '' : supplier.selectedForParking
  );
  const [reason, setReason] = useState(supplier.selectionReason || '');
  const isComplete = selected !== '' && reason.trim().length > 0;

  function handleContinue() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].selectedForParking = selected as boolean;
      pipelineSuppliers[idx].selectionReason = reason.trim();
      pipelineSuppliers[idx].scoutingTabsCompleted.nextStep = true;
    }
    onComplete();
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Next Step Decision</h3>
      <ScoutingField label="Move to Parking Lot?" required>
        <div className="flex" style={{ gap: 8 }}>
          {[{ label: 'Yes — select', value: true }, { label: 'No — discard', value: false }].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => setSelected(opt.value)}
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                border: `1px solid ${selected === opt.value ? '#DC0202' : '#D1D3D4'}`,
                backgroundColor: selected === opt.value ? '#DC020210' : '#FFFFFF',
                color: selected === opt.value ? '#DC0202' : '#808285',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </ScoutingField>
      <ScoutingField label="Reason / notes" required>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Explain the decision for this supplier..."
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </ScoutingField>
      <ContinueButton enabled={isComplete} onContinue={handleContinue} />
    </div>
  );
}

// ── Parking Lot tabs ───────────────────────────────────────────────────────

function ParkingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>{title}</h3>
      {children}
    </div>
  );
}

function TabParkingOverview({ supplier }: { supplier: PipelineSupplier }) {
  const today = new Date().toISOString().split('T')[0];
  const [onboardingDate, setOnboardingDate] = useState(supplier.parkingOnboardingDate || today);
  const [timeless, setTimeless] = useState(supplier.parkingTimeless || false);
  const [dateToMove, setDateToMove] = useState(supplier.parkingDateToMovePreliminary || '');
  const [scoutingInputVal, setScoutingInputVal] = useState(supplier.parkingScoutingInput || '');
  const [status, setStatus] = useState<string>(supplier.parkingSubStatus || '');
  const [saved, setSaved] = useState(false);

  const daysElapsed = onboardingDate
    ? Math.max(0, Math.floor((Date.now() - new Date(onboardingDate).getTime()) / 86400000))
    : 0;

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].parkingOnboardingDate = onboardingDate;
      pipelineSuppliers[idx].parkingTimeless = timeless;
      pipelineSuppliers[idx].parkingDateToMovePreliminary = dateToMove || null;
      pipelineSuppliers[idx].parkingScoutingInput = scoutingInputVal || null;
      pipelineSuppliers[idx].parkingSubStatus = (status || null) as PipelineSupplier['parkingSubStatus'];
      pipelineSuppliers[idx].parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...pipelineSuppliers[idx].parkingTabsCompleted, overview: true };
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ParkingCard title="Parking Lot — Overview">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Supplier onboarding date" required>
          <input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} style={selectStyle} />
        </ScoutingField>
        <ScoutingField label="Date to move to Preliminary">
          <input type="date" value={dateToMove} onChange={e => setDateToMove(e.target.value)} disabled={timeless} style={{ ...selectStyle, opacity: timeless ? 0.45 : 1, cursor: timeless ? 'not-allowed' : 'text' }} />
        </ScoutingField>
        <ScoutingField label="Days elapsed">
          <input type="number" value={daysElapsed} readOnly style={{ ...selectStyle, backgroundColor: '#EEEEEE', color: '#808285' }} />
        </ScoutingField>
        <ScoutingField label="Scouting input">
          {scoutingInput(scoutingInputVal, setScoutingInputVal, 'e.g. Recommendation, Event name')}
        </ScoutingField>
        <ScoutingField label="Status" required>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="">Select status</option>
            <option value="Go">Go</option>
            <option value="No Go">No Go</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="On Hold">On Hold</option>
          </select>
        </ScoutingField>
        <ScoutingField label="Timeless">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 8 }}>
            <input type="checkbox" checked={timeless} onChange={e => setTimeless(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#000000' }}>No fixed date to move</span>
          </label>
        </ScoutingField>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days in Parking Lot</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{daysElapsed} days</span>
            <span style={{ backgroundColor: parkingSlaColor(daysElapsed) + '26', color: parkingSlaColor(daysElapsed), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
              {parkingSlaLabel(daysElapsed)}
            </span>
          </span>
        </div>
        <div style={{ width: '100%', backgroundColor: '#EEEEEE', borderRadius: 3, height: 6 }}>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: parkingSlaColor(daysElapsed), width: `${Math.min(100, (daysElapsed / 90) * 100)}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6ABF4B' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
        >
          Save
        </button>
      </div>
    </ParkingCard>
  );
}

function TabParkingContact({ supplier }: { supplier: PipelineSupplier }) {
  const [isRecommendation, setIsRecommendation] = useState(supplier.parkingIsRecommendation || false);
  const [buyer, setBuyer] = useState(supplier.parkingBuyer || '');
  const [companyName, setCompanyName] = useState(supplier.parkingCompanyName || '');
  const [b2bMeeting, setB2bMeeting] = useState<string>(supplier.parkingB2BMeeting || '');
  const [name1, setName1] = useState(supplier.parkingName1 || '');
  const [website, setWebsite] = useState(supplier.parkingWebsite || '');
  const [email1, setEmail1] = useState(supplier.parkingEmail1 || '');
  const [phone, setPhone] = useState(supplier.parkingPhone || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].parkingIsRecommendation = isRecommendation;
      pipelineSuppliers[idx].parkingBuyer = buyer || null;
      pipelineSuppliers[idx].parkingCompanyName = companyName || null;
      pipelineSuppliers[idx].parkingB2BMeeting = (b2bMeeting || null) as PipelineSupplier['parkingB2BMeeting'];
      pipelineSuppliers[idx].parkingName1 = name1 || null;
      pipelineSuppliers[idx].parkingWebsite = website || null;
      pipelineSuppliers[idx].parkingEmail1 = email1 || null;
      pipelineSuppliers[idx].parkingPhone = phone || null;
      pipelineSuppliers[idx].parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...pipelineSuppliers[idx].parkingTabsCompleted, contact: true };
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ParkingCard title="Parking Lot — Contact">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Is recommendation">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 8 }}>
            <input type="checkbox" checked={isRecommendation} onChange={e => setIsRecommendation(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#000000' }}>Entered via internal recommendation</span>
          </label>
        </ScoutingField>
        <ScoutingField label="Buyer" required>
          {scoutingInput(buyer, setBuyer)}
        </ScoutingField>
        <ScoutingField label="Company name" required>
          {scoutingInput(companyName, setCompanyName)}
        </ScoutingField>
        <ScoutingField label="B2B meeting">
          <select value={b2bMeeting} onChange={e => setB2bMeeting(e.target.value)} style={selectStyle}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </ScoutingField>
        <ScoutingField label="Name 1">
          {scoutingInput(name1, setName1)}
        </ScoutingField>
        <ScoutingField label="Website">
          {scoutingInput(website, setWebsite)}
        </ScoutingField>
        <ScoutingField label="Email 1">
          <input type="email" value={email1} onChange={e => setEmail1(e.target.value)} style={selectStyle} />
        </ScoutingField>
        <ScoutingField label="Phone">
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={selectStyle} />
        </ScoutingField>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6ABF4B' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
        >
          Save
        </button>
      </div>
    </ParkingCard>
  );
}

function TabParkingDetails({ supplier }: { supplier: PipelineSupplier }) {
  const [commodity, setCommodity] = useState(supplier.parkingCommodity || '');
  const [productType, setProductType] = useState(supplier.parkingProductType || '');
  const [mfgCountry, setMfgCountry] = useState(supplier.parkingManufacturingCountry || '');
  const [mfgAddress, setMfgAddress] = useState(supplier.parkingManufacturingAddress || '');
  const [comments, setComments] = useState(supplier.parkingAdditionalComments || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].parkingCommodity = commodity || null;
      pipelineSuppliers[idx].parkingProductType = productType || null;
      pipelineSuppliers[idx].parkingManufacturingCountry = mfgCountry || null;
      pipelineSuppliers[idx].parkingManufacturingAddress = mfgAddress || null;
      pipelineSuppliers[idx].parkingAdditionalComments = comments || null;
      pipelineSuppliers[idx].parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...pipelineSuppliers[idx].parkingTabsCompleted, details: true };
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ParkingCard title="Parking Lot — Details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Commodity">
          {scoutingInput(commodity, setCommodity)}
        </ScoutingField>
        <ScoutingField label="Product type">
          {scoutingInput(productType, setProductType)}
        </ScoutingField>
        <ScoutingField label="Manufacturing country">
          {scoutingInput(mfgCountry, setMfgCountry)}
        </ScoutingField>
        <ScoutingField label="Manufacturing address">
          {scoutingInput(mfgAddress, setMfgAddress)}
        </ScoutingField>
      </div>
      <ScoutingField label="Additional comments">
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </ScoutingField>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6ABF4B' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
        >
          Save
        </button>
      </div>
    </ParkingCard>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────

function DeleteConfirmModal({ supplier, onClose, onConfirm }: { supplier: PipelineSupplier; onClose: () => void; onConfirm: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 400, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#DC020215', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 18, color: '#DC0202' }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: 0 }}>Delete supplier?</h2>
        </div>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px', lineHeight: 1.6 }}>
          This will permanently remove <strong style={{ color: '#000000' }}>{supplier.name}</strong> from the pipeline. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preliminary Evaluation tabs ────────────────────────────────────────────

type PrelimTabKey = 'overview' | 'capabilities' | 'visit' | 'competitiveness' | 'fundamentals';

function markPrelimComplete(s: PipelineSupplier, key: PrelimTabKey) {
  const tabs = s.preliminaryTabsCompleted ?? { overview: false, capabilities: false, visit: false, competitiveness: false, fundamentals: false };
  tabs[key] = true;
  s.preliminaryTabsCompleted = tabs;
}

const timelinessColor = (d: number) => (d > 25 ? '#DC0202' : d > 15 ? '#D4A017' : '#6ABF4B');
const timelinessLabel = (d: number) => (d > 25 ? 'Off track' : d > 15 ? 'At risk' : 'On track');

function prelimNumInput(value: number | null, onChange: (v: number | null) => void, placeholder?: string) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      placeholder={placeholder}
      style={selectStyle}
    />
  );
}

function PrelimSaveBar({ label, onSave }: { label: string; onSave: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
      <button
        onClick={onSave}
        style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
      >
        {label}
      </button>
    </div>
  );
}

function TabPrelimOverview({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [folio, setFolio] = useState(supplier.prelim_folio || '');
  const [startDate, setStartDate] = useState(supplier.prelim_startDate || '');
  const [priority, setPriority] = useState<string>(supplier.prelim_priority ? String(supplier.prelim_priority) : '');
  const [scoutingInputVal, setScoutingInputVal] = useState(supplier.prelim_scoutingInput || '');
  const [buyer, setBuyer] = useState(supplier.prelim_buyer || '');
  const [commodity, setCommodity] = useState(supplier.prelim_commodity || '');
  const [primaryDriver, setPrimaryDriver] = useState(supplier.prelim_primaryDriver || '');
  const [companyName, setCompanyName] = useState(supplier.prelim_companyName || '');
  const [duns, setDuns] = useState(supplier.prelim_dunsNumber || '');
  const [hqAddress, setHqAddress] = useState(supplier.prelim_hqAddress || '');
  const [hqCity, setHqCity] = useState(supplier.prelim_hqCity || '');
  const [hqCountry, setHqCountry] = useState(supplier.prelim_hqCountry || '');
  const [mfgAddress, setMfgAddress] = useState(supplier.prelim_manufacturingAddress || '');
  const [mfgCity, setMfgCity] = useState(supplier.prelim_manufacturingCity || '');
  const [mfgCountry, setMfgCountry] = useState(supplier.prelim_manufacturingCountry || '');
  const [companyType, setCompanyType] = useState(supplier.prelim_companyType || '');
  const [foundedYear, setFoundedYear] = useState<number | null>(supplier.prelim_foundedYear);
  const [footprint, setFootprint] = useState(supplier.prelim_footprint || '');
  const [yearsInMexico, setYearsInMexico] = useState<number | null>(supplier.prelim_yearsInMexico);
  const [facilities, setFacilities] = useState<number | null>(supplier.prelim_facilities);
  const [employees, setEmployees] = useState<number | null>(supplier.prelim_employees);
  const [annualRevenue, setAnnualRevenue] = useState(supplier.prelim_annualRevenue || '');
  const [productionVolume, setProductionVolume] = useState(supplier.prelim_productionVolume || '');
  const [mainTech, setMainTech] = useState(supplier.prelim_mainTechnology || '');
  const [pressCapacity, setPressCapacity] = useState(supplier.prelim_pressCapacity || '');
  const [generalManager, setGeneralManager] = useState(supplier.prelim_generalManager || '');
  const [market, setMarket] = useState(supplier.prelim_market || '');
  const [topCustomers, setTopCustomers] = useState(supplier.prelim_topCustomers || '');
  const [exportCapability, setExportCapability] = useState(supplier.prelim_exportCapability || '');
  const [certifications, setCertifications] = useState(supplier.prelim_certifications || '');
  const [hasIMMEX, setHasIMMEX] = useState<string>(supplier.prelim_hasIMMEX || '');
  const [planIMMEX, setPlanIMMEX] = useState<string>(supplier.prelim_planToGetIMMEX || '');
  const [timeliness, setTimeliness] = useState<number | null>(supplier.prelim_timeliness);

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      const s = pipelineSuppliers[idx];
      s.prelim_folio = folio || null;
      s.prelim_startDate = startDate || null;
      s.prelim_priority = (priority ? Number(priority) : null) as PipelineSupplier['prelim_priority'];
      s.prelim_scoutingInput = scoutingInputVal || null;
      s.prelim_buyer = buyer || null;
      s.prelim_commodity = commodity || null;
      s.prelim_primaryDriver = primaryDriver || null;
      s.prelim_companyName = companyName || null;
      s.prelim_dunsNumber = duns || null;
      s.prelim_hqAddress = hqAddress || null;
      s.prelim_hqCity = hqCity || null;
      s.prelim_hqCountry = hqCountry || null;
      s.prelim_manufacturingAddress = mfgAddress || null;
      s.prelim_manufacturingCity = mfgCity || null;
      s.prelim_manufacturingCountry = mfgCountry || null;
      s.prelim_companyType = companyType || null;
      s.prelim_foundedYear = foundedYear;
      s.prelim_footprint = footprint || null;
      s.prelim_yearsInMexico = yearsInMexico;
      s.prelim_facilities = facilities;
      s.prelim_employees = employees;
      s.prelim_annualRevenue = annualRevenue || null;
      s.prelim_productionVolume = productionVolume || null;
      s.prelim_mainTechnology = mainTech || null;
      s.prelim_pressCapacity = pressCapacity || null;
      s.prelim_generalManager = generalManager || null;
      s.prelim_market = market || null;
      s.prelim_topCustomers = topCustomers || null;
      s.prelim_exportCapability = exportCapability || null;
      s.prelim_certifications = certifications || null;
      s.prelim_hasIMMEX = (hasIMMEX || null) as PipelineSupplier['prelim_hasIMMEX'];
      s.prelim_planToGetIMMEX = (planIMMEX || null) as PipelineSupplier['prelim_planToGetIMMEX'];
      s.prelim_timeliness = timeliness;
      markPrelimComplete(s, 'overview');
    }
    onComplete();
  }

  return (
    <ParkingCard title="Preliminary Evaluation — Overview">
      <SectionTitle title="Evaluation" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Folio">{scoutingInput(folio, setFolio, 'e.g. SSD-2026-010')}</ScoutingField>
        <ScoutingField label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={selectStyle} /></ScoutingField>
        <ScoutingField label="Priority">
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
            <option value="">Select priority</option>
            <option value="1">1 — High</option>
            <option value="2">2 — Medium</option>
            <option value="3">3 — Low</option>
          </select>
        </ScoutingField>
        <ScoutingField label="Scouting input">{scoutingInput(scoutingInputVal, setScoutingInputVal)}</ScoutingField>
        <ScoutingField label="Buyer">{scoutingInput(buyer, setBuyer)}</ScoutingField>
        <ScoutingField label="Commodity">{scoutingInput(commodity, setCommodity)}</ScoutingField>
        <ScoutingField label="Primary driver">{scoutingInput(primaryDriver, setPrimaryDriver)}</ScoutingField>
        <ScoutingField label="Timeliness (days)">
          {prelimNumInput(timeliness, setTimeliness)}
        </ScoutingField>
      </div>

      {timeliness != null && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ backgroundColor: timelinessColor(timeliness) + '26', color: timelinessColor(timeliness), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
            {timelinessLabel(timeliness)} · {timeliness} days
          </span>
        </div>
      )}

      <SectionTitle title="Company" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Company name">{scoutingInput(companyName, setCompanyName)}</ScoutingField>
        <ScoutingField label="DUNS number">{scoutingInput(duns, setDuns)}</ScoutingField>
        <ScoutingField label="Company type">{scoutingInput(companyType, setCompanyType)}</ScoutingField>
        <ScoutingField label="Founded year">{prelimNumInput(foundedYear, setFoundedYear)}</ScoutingField>
        <ScoutingField label="General manager">{scoutingInput(generalManager, setGeneralManager)}</ScoutingField>
        <ScoutingField label="Footprint">{scoutingInput(footprint, setFootprint)}</ScoutingField>
        <ScoutingField label="Years in Mexico">{prelimNumInput(yearsInMexico, setYearsInMexico)}</ScoutingField>
        <ScoutingField label="Facilities">{prelimNumInput(facilities, setFacilities)}</ScoutingField>
        <ScoutingField label="Employees">{prelimNumInput(employees, setEmployees)}</ScoutingField>
        <ScoutingField label="Annual revenue">{scoutingInput(annualRevenue, setAnnualRevenue)}</ScoutingField>
        <ScoutingField label="Production volume">{scoutingInput(productionVolume, setProductionVolume)}</ScoutingField>
        <ScoutingField label="Main technology">{scoutingInput(mainTech, setMainTech)}</ScoutingField>
        <ScoutingField label="Press capacity">{scoutingInput(pressCapacity, setPressCapacity)}</ScoutingField>
        <ScoutingField label="Market">{scoutingInput(market, setMarket)}</ScoutingField>
        <ScoutingField label="Top customers">{scoutingInput(topCustomers, setTopCustomers)}</ScoutingField>
        <ScoutingField label="Export capability">{scoutingInput(exportCapability, setExportCapability)}</ScoutingField>
        <ScoutingField label="Certifications">{scoutingInput(certifications, setCertifications)}</ScoutingField>
      </div>

      <SectionTitle title="HQ & Manufacturing" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="HQ address">{scoutingInput(hqAddress, setHqAddress)}</ScoutingField>
        <ScoutingField label="HQ city">{scoutingInput(hqCity, setHqCity)}</ScoutingField>
        <ScoutingField label="HQ country">{scoutingInput(hqCountry, setHqCountry)}</ScoutingField>
        <ScoutingField label="Manufacturing address">{scoutingInput(mfgAddress, setMfgAddress)}</ScoutingField>
        <ScoutingField label="Manufacturing city">{scoutingInput(mfgCity, setMfgCity)}</ScoutingField>
        <ScoutingField label="Manufacturing country">{scoutingInput(mfgCountry, setMfgCountry)}</ScoutingField>
        <ScoutingField label="Has IMMEX">
          <select value={hasIMMEX} onChange={e => setHasIMMEX(e.target.value)} style={selectStyle}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="In Plan">In Plan</option>
            <option value="TBC">TBC</option>
          </select>
        </ScoutingField>
        <ScoutingField label="Plan to get IMMEX">
          <select value={planIMMEX} onChange={e => setPlanIMMEX(e.target.value)} style={selectStyle}>
            <option value="">Select</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        </ScoutingField>
      </div>

      <PrelimSaveBar label="Save & Continue" onSave={handleSave} />
    </ParkingCard>
  );
}

function TabPrelimCapabilities({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [machineryType, setMachineryType] = useState(supplier.prelim_machineryType || '');
  const [processingMethod, setProcessingMethod] = useState(supplier.prelim_processingMethod || '');
  const [complementaryOps, setComplementaryOps] = useState(supplier.prelim_complementaryOps || '');
  const [toolingDesign, setToolingDesign] = useState(supplier.prelim_toolingDesign || '');
  const [materials, setMaterials] = useState(supplier.prelim_materials || '');
  const [rawMaterialIndex, setRawMaterialIndex] = useState(supplier.prelim_rawMaterialIndex || '');
  const [applications, setApplications] = useState(supplier.prelim_applications || '');

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      const s = pipelineSuppliers[idx];
      s.prelim_machineryType = machineryType || null;
      s.prelim_processingMethod = processingMethod || null;
      s.prelim_complementaryOps = complementaryOps || null;
      s.prelim_toolingDesign = toolingDesign || null;
      s.prelim_materials = materials || null;
      s.prelim_rawMaterialIndex = rawMaterialIndex || null;
      s.prelim_applications = applications || null;
      markPrelimComplete(s, 'capabilities');
    }
    onComplete();
  }

  return (
    <ParkingCard title="Preliminary Evaluation — Capabilities">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Machinery type">{scoutingInput(machineryType, setMachineryType)}</ScoutingField>
        <ScoutingField label="Processing method">{scoutingInput(processingMethod, setProcessingMethod)}</ScoutingField>
        <ScoutingField label="Complementary operations">{scoutingInput(complementaryOps, setComplementaryOps)}</ScoutingField>
        <ScoutingField label="Tooling design">{scoutingInput(toolingDesign, setToolingDesign)}</ScoutingField>
        <ScoutingField label="Materials">{scoutingInput(materials, setMaterials)}</ScoutingField>
        <ScoutingField label="Raw material index">{scoutingInput(rawMaterialIndex, setRawMaterialIndex)}</ScoutingField>
        <ScoutingField label="Applications">{scoutingInput(applications, setApplications)}</ScoutingField>
      </div>
      <PrelimSaveBar label="Save & Continue" onSave={handleSave} />
    </ParkingCard>
  );
}

function TabPrelimVisit({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [planned, setPlanned] = useState(supplier.prelim_visitDatePlanned || '');
  const [completed, setCompleted] = useState(supplier.prelim_visitDateCompleted || '');
  const [participants, setParticipants] = useState(supplier.prelim_visitParticipants || '');
  const [strengths, setStrengths] = useState(supplier.prelim_strengths || '');
  const [weaknesses, setWeaknesses] = useState(supplier.prelim_weaknesses || '');
  const [observations, setObservations] = useState(supplier.prelim_observations || '');
  const [recommendations, setRecommendations] = useState(supplier.prelim_recommendations || '');

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      const s = pipelineSuppliers[idx];
      s.prelim_visitDatePlanned = planned || null;
      s.prelim_visitDateCompleted = completed || null;
      s.prelim_visitParticipants = participants || null;
      s.prelim_strengths = strengths || null;
      s.prelim_weaknesses = weaknesses || null;
      s.prelim_observations = observations || null;
      s.prelim_recommendations = recommendations || null;
      markPrelimComplete(s, 'visit');
    }
    onComplete();
  }

  const textarea: React.CSSProperties = { ...selectStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' };

  return (
    <ParkingCard title="Preliminary Evaluation — Visit Report">
      {!completed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#D4A01715', border: '1px solid #D4A01740', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 13, color: '#D4A017' }} />
          <span style={{ fontSize: 13, color: '#8a6d10' }}>Visit not yet completed. Enter the completed date to finalize the report.</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Visit date planned"><input type="date" value={planned} onChange={e => setPlanned(e.target.value)} style={selectStyle} /></ScoutingField>
        <ScoutingField label="Visit date completed"><input type="date" value={completed} onChange={e => setCompleted(e.target.value)} style={selectStyle} /></ScoutingField>
      </div>
      <ScoutingField label="Participants">{scoutingInput(participants, setParticipants)}</ScoutingField>
      <ScoutingField label="Strengths"><textarea value={strengths} onChange={e => setStrengths(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Weaknesses"><textarea value={weaknesses} onChange={e => setWeaknesses(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Observations"><textarea value={observations} onChange={e => setObservations(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Recommendations"><textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} style={textarea} /></ScoutingField>
      <PrelimSaveBar label="Save & Continue" onSave={handleSave} />
    </ParkingCard>
  );
}

type PrelimPart = PipelineSupplier['prelim_parts'][number];

function TabPrelimCompetitiveness({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [parts, setParts] = useState<PrelimPart[]>(() => supplier.prelim_parts.map(p => ({ ...p })));

  function recompute(p: PrelimPart): PrelimPart {
    const delta = p.initialQuote != null && p.qadPrice != null ? +(p.initialQuote - p.qadPrice).toFixed(2) : null;
    const savingExpected = delta != null && p.annualPeakVolume != null ? Math.round(delta * p.annualPeakVolume) : null;
    return { ...p, delta, savingExpected };
  }
  function updatePart<K extends keyof PrelimPart>(i: number, field: K, value: PrelimPart[K]) {
    setParts(prev => prev.map((p, idx) => (idx === i ? recompute({ ...p, [field]: value }) : p)));
  }
  function addPart() {
    setParts(prev => [...prev, { partNumber: '', partDescription: '', pl: '', annualPeakVolume: null, program: '', eop: '', initialQuote: null, qadPrice: null, delta: null, tooling: null, savingExpected: null, confidence: null }]);
  }
  function removePart(i: number) {
    setParts(prev => prev.filter((_, idx) => idx !== i));
  }
  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      pipelineSuppliers[idx].prelim_parts = parts;
      markPrelimComplete(pipelineSuppliers[idx], 'competitiveness');
    }
    onComplete();
  }

  const moneyColor = (v: number | null) => (v == null ? '#000000' : v < 0 ? '#6ABF4B' : v > 0 ? '#DC0202' : '#000000');

  return (
    <ParkingCard title="Preliminary Evaluation — Competitiveness">
      {parts.length === 0 && (
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 16px' }}>No parts added yet.</p>
      )}
      {parts.map((p, i) => (
        <div key={i} style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: 16, marginBottom: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Part {i + 1}</span>
            <button onClick={() => removePart(i)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#DC0202', cursor: 'pointer', fontSize: 12 }}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} /> Remove
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <ScoutingField label="Part number">{scoutingInput(p.partNumber, v => updatePart(i, 'partNumber', v))}</ScoutingField>
            <ScoutingField label="Part description">{scoutingInput(p.partDescription, v => updatePart(i, 'partDescription', v))}</ScoutingField>
            <ScoutingField label="PL">{scoutingInput(p.pl, v => updatePart(i, 'pl', v))}</ScoutingField>
            <ScoutingField label="Program">{scoutingInput(p.program, v => updatePart(i, 'program', v))}</ScoutingField>
            <ScoutingField label="Annual peak volume">{prelimNumInput(p.annualPeakVolume, v => updatePart(i, 'annualPeakVolume', v))}</ScoutingField>
            <ScoutingField label="EOP">{scoutingInput(p.eop, v => updatePart(i, 'eop', v))}</ScoutingField>
            <ScoutingField label="Initial quote">{prelimNumInput(p.initialQuote, v => updatePart(i, 'initialQuote', v))}</ScoutingField>
            <ScoutingField label="QAD price">{prelimNumInput(p.qadPrice, v => updatePart(i, 'qadPrice', v))}</ScoutingField>
            <ScoutingField label="Tooling">{prelimNumInput(p.tooling, v => updatePart(i, 'tooling', v))}</ScoutingField>
            <ScoutingField label="Confidence">
              <select value={p.confidence ?? ''} onChange={e => updatePart(i, 'confidence', (e.target.value || null) as PrelimPart['confidence'])} style={selectStyle}>
                <option value="">Select</option>
                <option value="H">High</option>
                <option value="M">Medium</option>
                <option value="L">Low</option>
              </select>
            </ScoutingField>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 4, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
            <div>
              <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Delta</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: moneyColor(p.delta) }}>{p.delta == null ? '—' : p.delta.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Saving expected</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: moneyColor(p.savingExpected) }}>{p.savingExpected == null ? '—' : p.savingExpected.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addPart} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Add part
      </button>
      <PrelimSaveBar label="Save & Continue" onSave={handleSave} />
    </ParkingCard>
  );
}

function TabPrelimFundamentals({ supplier, onComplete }: { supplier: PipelineSupplier; onComplete: () => void }) {
  const [rfq, setRfq] = useState<string>(supplier.prelim_rfqReceived || '');
  const [nda, setNda] = useState<string>(supplier.prelim_ndaSigned || '');
  const [tcs, setTcs] = useState<string>(supplier.prelim_tcsSigned || '');
  const [ttcs, setTtcs] = useState<string>(supplier.prelim_ttcsSigned || '');
  const [nsr, setNsr] = useState<string>(supplier.prelim_nsrSigned || '');
  const [sda, setSda] = useState<string>(supplier.prelim_sdaSigned || '');

  const gate: { bg: string; text: string; label: string } =
    rfq === 'Y' && nda === 'Y'
      ? { bg: '#6ABF4B26', text: '#6ABF4B', label: 'Ready for development' }
      : rfq === 'N' || nda === 'N'
        ? { bg: '#D4A01726', text: '#D4A017', label: 'Blocked — RFQ & NDA required' }
        : { bg: '#80828526', text: '#808285', label: 'Pending — RFQ & NDA not set' };

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      const s = pipelineSuppliers[idx];
      s.prelim_rfqReceived = (rfq || null) as PipelineSupplier['prelim_rfqReceived'];
      s.prelim_ndaSigned = (nda || null) as PipelineSupplier['prelim_ndaSigned'];
      s.prelim_tcsSigned = (tcs || null) as PipelineSupplier['prelim_tcsSigned'];
      s.prelim_ttcsSigned = (ttcs || null) as PipelineSupplier['prelim_ttcsSigned'];
      s.prelim_nsrSigned = (nsr || null) as PipelineSupplier['prelim_nsrSigned'];
      s.prelim_sdaSigned = (sda || null) as PipelineSupplier['prelim_sdaSigned'];
      s.selectedForDevelopment = rfq === 'Y' && nda === 'Y';
      markPrelimComplete(s, 'fundamentals');
    }
    onComplete();
  }

  const ynSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
      <option value="">Select</option>
      <option value="Y">Yes</option>
      <option value="N">No</option>
    </select>
  );

  return (
    <ParkingCard title="Preliminary Evaluation — Fundamentals">
      <div className="flex items-center" style={{ gap: 10, marginBottom: 18 }}>
        <FontAwesomeIcon icon={gate.text === '#6ABF4B' ? faCheckCircle : faTriangleExclamation} style={{ fontSize: 14, color: gate.text }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate status</span>
        <Badge bg={gate.bg} text={gate.text} label={gate.label} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="RFQ received" required>{ynSelect(rfq, setRfq)}</ScoutingField>
        <ScoutingField label="NDA signed" required>{ynSelect(nda, setNda)}</ScoutingField>
        <ScoutingField label="TC&Cs signed">{ynSelect(tcs, setTcs)}</ScoutingField>
        <ScoutingField label="TTC&Cs signed">{ynSelect(ttcs, setTtcs)}</ScoutingField>
        <ScoutingField label="NSR signed">{ynSelect(nsr, setNsr)}</ScoutingField>
        <ScoutingField label="SDA signed">{ynSelect(sda, setSda)}</ScoutingField>
      </div>
      <PrelimSaveBar label="Save" onSave={handleSave} />
    </ParkingCard>
  );
}

function PrelimNotesFooter({ supplier }: { supplier: PipelineSupplier }) {
  const [notes, setNotes] = useState(supplier.prelim_noteworthyNotes || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) pipelineSuppliers[idx].prelim_noteworthyNotes = notes || null;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
        <FontAwesomeIcon icon={faStickyNote} style={{ fontSize: 13, color: '#808285' }} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Noteworthy Notes</h3>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={5}
        placeholder="Add evaluation notes worth highlighting..."
        style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6ABF4B' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
        >
          Save notes
        </button>
      </div>
    </div>
  );
}

export function SupplierDetailBody({ supplier, origin = 'pipeline' }: { supplier: PipelineSupplier; origin?: 'suppliers' | 'pipeline' }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'general' | 'documents' | 'evaluation' | 'history' | 'notes' | 'files' |
    'scoutingEvent' | 'supplierInfo' | 'attendees' | 'agenda' | 'nextStep' |
    'overview' | 'contact' | 'details' |
    'prelim_overview' | 'prelim_capabilities' | 'prelim_visit' | 'prelim_competitiveness' | 'prelim_fundamentals'
  >('general');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showParkingPrefill, setShowParkingPrefill] = useState(false);
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [currentStage, setCurrentStage] = useState(supplier.stage);
  const [tabsCompleted, setTabsCompleted] = useState({ ...supplier.scoutingTabsCompleted });
  const parkingTabs = supplier.parkingTabsCompleted ?? { overview: false, contact: false, details: false };
  const [prelimTabs, setPrelimTabs] = useState(supplier.preliminaryTabsCompleted ?? { overview: false, capabilities: false, visit: false, competitiveness: false, fundamentals: false });
  const stageColor = pipelineStageConfig.find(s => s.name === currentStage)?.color ?? '#808285';
  const isBlacklisted = blacklistedSuppliers.some(s => s.id === supplier.id);
  const isScouting = currentStage === 'Scouting Event';
  const isParkingLot = currentStage === 'Parking Lot';
  const isPreliminary = currentStage === 'Preliminary Evaluation';

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // When switching to scouting view, default to first incomplete tab
  useEffect(() => {
    if (isScouting) {
      if (!tabsCompleted.scoutingEvent) setActiveTab('scoutingEvent');
      else if (!tabsCompleted.supplierInfo) setActiveTab('supplierInfo');
      else if (!tabsCompleted.attendees) setActiveTab('attendees');
      else if (!tabsCompleted.agenda) setActiveTab('agenda');
      else if (!tabsCompleted.nextStep) setActiveTab('nextStep');
      else setActiveTab('nextStep');
    } else if (isParkingLot) {
      if (!parkingTabs.overview) setActiveTab('overview');
      else if (!parkingTabs.contact) setActiveTab('contact');
      else if (!parkingTabs.details) setActiveTab('details');
      else setActiveTab('overview');
    } else if (isPreliminary) {
      if (!prelimTabs.overview) setActiveTab('prelim_overview');
      else if (!prelimTabs.capabilities) setActiveTab('prelim_capabilities');
      else if (!prelimTabs.visit) setActiveTab('prelim_visit');
      else if (!prelimTabs.competitiveness) setActiveTab('prelim_competitiveness');
      else if (!prelimTabs.fundamentals) setActiveTab('prelim_fundamentals');
      else setActiveTab('prelim_overview');
    } else {
      setActiveTab('general');
    }
  }, [isScouting, isParkingLot, isPreliminary]);

  const handleStageMove = (newStage: string) => {
    setCurrentStage(newStage as typeof currentStage);
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      (pipelineSuppliers[idx] as { stage: string }).stage = newStage;
    }
  };

  function handleDelete() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) pipelineSuppliers.splice(idx, 1);
    navigate('/pipeline');
  }

  function handleBlacklistConfirm() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      blacklistedSuppliers.push({
        ...pipelineSuppliers[idx],
        rejectionReason: 'Not selected for Parking Lot',
        rejectedBy: 'System',
        rejectionDate: new Date().toISOString().split('T')[0],
      });
      pipelineSuppliers.splice(idx, 1);
    }
    navigate('/pipeline');
  }

  function refreshTabs() {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      setTabsCompleted({ ...pipelineSuppliers[idx].scoutingTabsCompleted });
    }
  }

  function handleParkingPrefillConfirm(updatedFields: Partial<PipelineSupplier>) {
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      Object.assign(pipelineSuppliers[idx], updatedFields);
    }
    setShowParkingPrefill(false);
    navigate('/pipeline');
  }

  const allScoutingComplete = tabsCompleted.scoutingEvent && tabsCompleted.supplierInfo && tabsCompleted.attendees && tabsCompleted.agenda && tabsCompleted.nextStep;
  const allParkingComplete = parkingTabs.overview && parkingTabs.contact && parkingTabs.details;
  const allPreliminaryComplete = prelimTabs.overview && prelimTabs.capabilities && prelimTabs.visit && prelimTabs.competitiveness && prelimTabs.fundamentals;
  const deleteDisabled = tabsCompleted.attendees;
  const parkingStatus = supplier.parkingSubStatus;

  // ── Tab definitions ──
  const scoutingTabs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'scoutingEvent', label: 'Scouting Event', completed: tabsCompleted.scoutingEvent, locked: false },
    { id: 'supplierInfo', label: 'Supplier Info', completed: tabsCompleted.supplierInfo, locked: !tabsCompleted.scoutingEvent },
    { id: 'attendees', label: 'Attendees', completed: tabsCompleted.attendees, locked: !tabsCompleted.supplierInfo },
    { id: 'agenda', label: 'Agenda', completed: tabsCompleted.agenda, locked: !tabsCompleted.attendees },
    { id: 'nextStep', label: 'Next Step', completed: tabsCompleted.nextStep, locked: !tabsCompleted.agenda },
  ];

  const standardTabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'documents' as const, label: 'Documents' },
    { id: 'evaluation' as const, label: 'Evaluation' },
    { id: 'history' as const, label: 'History' },
    { id: 'notes' as const, label: 'Notes' },
    { id: 'files' as const, label: 'Files' },
  ];

  const parkingTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'overview', label: 'Overview', completed: parkingTabs.overview, locked: false },
    { id: 'contact', label: 'Contact', completed: parkingTabs.contact, locked: false },
    { id: 'details', label: 'Details', completed: parkingTabs.details, locked: false },
  ];

  const prelimTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'prelim_overview', label: 'Overview', completed: prelimTabs.overview, locked: false },
    { id: 'prelim_capabilities', label: 'Capabilities', completed: prelimTabs.capabilities, locked: !prelimTabs.overview },
    { id: 'prelim_visit', label: 'Visit', completed: prelimTabs.visit, locked: !prelimTabs.capabilities },
    { id: 'prelim_competitiveness', label: 'Competitiveness', completed: prelimTabs.competitiveness, locked: !prelimTabs.visit },
    { id: 'prelim_fundamentals', label: 'Fundamentals', completed: prelimTabs.fundamentals, locked: !prelimTabs.competitiveness },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="flex items-center" style={{ gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0 }}>{supplier.name}</h1>
            <Badge bg={stageColor + '26'} text={stageColor} label={currentStage} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 400, color: '#808285', margin: 0 }}>
            Folio {supplier.folio} · {supplier.commodity} · {supplier.country}
          </p>
        </div>
        {!isBlacklisted && (
          <div className="flex items-center" style={{ gap: 8 }}>
            {isScouting ? (
              <>
                <button
                  onClick={() => { if (!deleteDisabled) setShowDeleteModal(true); }}
                  disabled={deleteDisabled}
                  title={deleteDisabled ? "Cannot delete after Attendees phase is completed. Use 'Send to Blacklisted' instead." : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #DC020230', backgroundColor: '#FFFFFF', color: '#DC0202', cursor: deleteDisabled ? 'not-allowed' : 'pointer', opacity: deleteDisabled ? 0.45 : 1, transition: 'box-shadow 0.15s ease-out' }}
                  onMouseEnter={e => { if (!deleteDisabled) e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,2,2,0.15)'; }}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} /> Delete supplier
                </button>
                <button
                  onClick={() => {
                    if (supplier.selectedForParking === false) setShowBlacklistConfirm(true);
                    else setShowParkingPrefill(true);
                  }}
                  disabled={!allScoutingComplete}
                  title={!allScoutingComplete ? 'Complete all scouting tabs to move to Parking Lot' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFFFFF', cursor: allScoutingComplete ? 'pointer' : 'not-allowed', opacity: allScoutingComplete ? 1 : 0.45, transition: 'box-shadow 0.15s ease-out' }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : isParkingLot ? (
              <>
                {parkingStatus && (
                  <Badge bg={subStatusStyles[parkingStatus].bg} text={subStatusStyles[parkingStatus].text} label={parkingStatus} />
                )}
                <button
                  onClick={() => { if (allParkingComplete) setToast('Next stage transition will be configured in a future update.'); }}
                  disabled={!allParkingComplete}
                  title={!allParkingComplete ? 'Complete all parking tabs to move to the next stage' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFFFFF', cursor: allParkingComplete ? 'pointer' : 'not-allowed', opacity: allParkingComplete ? 1 : 0.45, transition: 'box-shadow 0.15s ease-out' }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : isPreliminary ? (
              <button
                onClick={() => { if (allPreliminaryComplete) setToast('Next stage transition will be configured in a future update.'); }}
                disabled={!allPreliminaryComplete}
                title={!allPreliminaryComplete ? 'Complete all preliminary evaluation tabs to move to the next stage' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFFFFF', cursor: allPreliminaryComplete ? 'pointer' : 'not-allowed', opacity: allPreliminaryComplete ? 1 : 0.45, transition: 'box-shadow 0.15s ease-out' }}
              >
                Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
              </button>
            ) : (
              <button onClick={() => setShowMoveModal(true)} style={{ padding: '8px 16px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'box-shadow 0.15s ease-out' }}>
                <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 12 }} /> Move stage
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid #E0E0E0', marginBottom: 24, gap: 0 }}>
        {(isScouting || isParkingLot || isPreliminary) ? (isScouting ? scoutingTabs : isParkingLot ? parkingTabDefs : prelimTabDefs).map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.locked && setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: tab.locked ? '#D1D3D4' : activeTab === tab.id ? '#000000' : '#808285',
              borderBottom: activeTab === tab.id ? '2px solid #DC0202' : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: tab.locked ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.locked
              ? <FontAwesomeIcon icon={faLock} style={{ fontSize: 10, color: '#D1D3D4' }} />
              : tab.completed
                ? <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: 11, color: '#6ABF4B' }} />
                : null
            }
            {tab.label}
          </button>
        )) : standardTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : '#808285',
              borderBottom: activeTab === tab.id ? '2px solid #DC0202' : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isScouting ? (
        <>
          {activeTab === 'scoutingEvent' && <TabScoutingEvent supplier={supplier} onComplete={() => { refreshTabs(); setActiveTab('supplierInfo'); }} />}
          {activeTab === 'supplierInfo' && <TabSupplierInfo supplier={supplier} onComplete={() => { refreshTabs(); setActiveTab('attendees'); }} />}
          {activeTab === 'attendees' && <TabAttendees supplier={supplier} onComplete={() => { refreshTabs(); setActiveTab('agenda'); }} />}
          {activeTab === 'agenda' && <TabAgenda supplier={supplier} onComplete={() => { refreshTabs(); setActiveTab('nextStep'); }} />}
          {activeTab === 'nextStep' && <TabNextStep supplier={supplier} onComplete={() => refreshTabs()} />}
        </>
      ) : isParkingLot ? (
        <>
          {activeTab === 'overview' && <TabParkingOverview supplier={supplier} />}
          {activeTab === 'contact' && <TabParkingContact supplier={supplier} />}
          {activeTab === 'details' && <TabParkingDetails supplier={supplier} />}
        </>
      ) : isPreliminary ? (
        <>
          {activeTab === 'prelim_overview' && <TabPrelimOverview supplier={supplier} onComplete={() => { setPrelimTabs(prev => ({ ...prev, overview: true })); setActiveTab('prelim_capabilities'); }} />}
          {activeTab === 'prelim_capabilities' && <TabPrelimCapabilities supplier={supplier} onComplete={() => { setPrelimTabs(prev => ({ ...prev, capabilities: true })); setActiveTab('prelim_visit'); }} />}
          {activeTab === 'prelim_visit' && <TabPrelimVisit supplier={supplier} onComplete={() => { setPrelimTabs(prev => ({ ...prev, visit: true })); setActiveTab('prelim_competitiveness'); }} />}
          {activeTab === 'prelim_competitiveness' && <TabPrelimCompetitiveness supplier={supplier} onComplete={() => { setPrelimTabs(prev => ({ ...prev, competitiveness: true })); setActiveTab('prelim_fundamentals'); }} />}
          {activeTab === 'prelim_fundamentals' && <TabPrelimFundamentals supplier={supplier} onComplete={() => setPrelimTabs(prev => ({ ...prev, fundamentals: true }))} />}
          <PrelimNotesFooter supplier={supplier} />
        </>
      ) : (
        <>
          {activeTab === 'general' && <TabGeneral supplier={supplier} />}
          {activeTab === 'documents' && <TabDocuments supplier={supplier} />}
          {activeTab === 'evaluation' && <TabEvaluation supplier={supplier} />}
          {activeTab === 'history' && <TabHistory supplier={supplier} />}
          {activeTab === 'notes' && <TabNotes />}
          {activeTab === 'files' && <TabFiles supplier={supplier} />}
        </>
      )}

      {showMoveModal && (
        <MoveStageModal
          supplier={supplier}
          onClose={() => setShowMoveModal(false)}
          onConfirm={handleStageMove}
          origin={origin}
        />
      )}
      {showDeleteModal && (
        <DeleteConfirmModal
          supplier={supplier}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
      {showParkingPrefill && (
        <ParkingLotPrefillModal
          supplier={supplier}
          onClose={() => setShowParkingPrefill(false)}
          onConfirm={handleParkingPrefillConfirm}
        />
      )}
      {showBlacklistConfirm && (
        <div
          onClick={() => setShowBlacklistConfirm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 400, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', textAlign: 'center' }}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 24, color: '#DC0202', marginBottom: 12 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: '0 0 12px' }}>Send to Blacklisted?</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 20px', lineHeight: 1.6 }}>
              This supplier was not selected for Parking Lot. Confirming will move them to Blacklisted permanently.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setShowBlacklistConfirm(false)}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlacklistConfirm}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10001, backgroundColor: '#000000', color: '#FFFFFF', fontSize: 13, fontWeight: 500, padding: '12px 20px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}
    </>
  );
}

export function PipelineSupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const supplier: PipelineSupplier | undefined =
    pipelineSuppliers.find(s => s.id === supplierId) ??
    (blacklistedSuppliers.find(s => s.id === supplierId) as PipelineSupplier | undefined);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(supplier.stage)}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Back
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none' }}>Pipeline</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <Link to={`/pipeline/stage/${encodeURIComponent(supplier.stage)}`} style={{ color: '#0084C0', textDecoration: 'none' }}>{supplier.stage}</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#000000' }}>{supplier.name}</span>
        </span>
      </nav>

      <SupplierDetailBody supplier={supplier} />
    </div>
  );
}
