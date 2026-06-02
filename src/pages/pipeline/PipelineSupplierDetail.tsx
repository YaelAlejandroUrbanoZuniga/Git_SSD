import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload, faArrowRight, faArrowLeft, faCheckCircle, faClock, faMinusCircle,
  faStickyNote, faFilePdf, faFileExcel, faFileWord, faFileAlt, faFolderOpen, faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';
import { MoveStageModal } from './MoveStageModal';

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

        {/* Commercial */}
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
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Origin */}
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <SectionTitle title="Origin & Traceability" />
          <InfoRow label="Scouting Input" value={supplier.scoutingInput} />
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

export function SupplierDetailBody({ supplier, origin = 'pipeline' }: { supplier: PipelineSupplier; origin?: 'suppliers' | 'pipeline' }) {
  const [activeTab, setActiveTab] = useState<'general' | 'documents' | 'evaluation' | 'history' | 'notes' | 'files'>('general');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [currentStage, setCurrentStage] = useState(supplier.stage);
  const stageColor = pipelineStageConfig.find(s => s.name === currentStage)?.color ?? '#808285';
  const isBlacklisted = blacklistedSuppliers.some(s => s.id === supplier.id);

  const handleStageMove = (newStage: string) => {
    setCurrentStage(newStage as typeof currentStage);
    const idx = pipelineSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      (pipelineSuppliers[idx] as { stage: string }).stage = newStage;
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'documents' as const, label: 'Documents' },
    { id: 'evaluation' as const, label: 'Evaluation' },
    { id: 'history' as const, label: 'History' },
    { id: 'notes' as const, label: 'Notes' },
    { id: 'files' as const, label: 'Files' },
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
            <button style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: '1px solid #D1D3D4', backgroundColor: '#FFF', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12 }} /> Export
            </button>
            <button onClick={() => setShowMoveModal(true)} style={{ padding: '8px 16px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'box-shadow 0.15s ease-out' }}>
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 12 }} /> Move stage
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid #E0E0E0', marginBottom: 24, gap: 0 }}>
        {tabs.map(tab => (
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
      {activeTab === 'general' && <TabGeneral supplier={supplier} />}
      {activeTab === 'documents' && <TabDocuments supplier={supplier} />}
      {activeTab === 'evaluation' && <TabEvaluation supplier={supplier} />}
      {activeTab === 'history' && <TabHistory supplier={supplier} />}
      {activeTab === 'notes' && <TabNotes />}
      {activeTab === 'files' && <TabFiles supplier={supplier} />}

      {showMoveModal && (
        <MoveStageModal
          supplier={supplier}
          onClose={() => setShowMoveModal(false)}
          onConfirm={handleStageMove}
          origin={origin}
        />
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
