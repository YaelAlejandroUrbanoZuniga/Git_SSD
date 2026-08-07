import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight, faArrowLeft, faCheckCircle, faClock, faMinusCircle,
  faStickyNote, faFilePdf, faFileExcel, faFileWord, faFileAlt, faFolderOpen, faPlus,
  faLock, faTriangleExclamation, faDownload, faTrash, faArrowUpRightFromSquare,
  faBan,
} from '@fortawesome/free-solid-svg-icons';
import type { TrackerSupplier, SupplierNote, Commodity, IntelexLevel } from '../../types';
import { CURRENT_USER } from '../../constants/currentUser';
import {
  COMMODITIES, SUB_STATUSES, IMMEX_STATUSES, PRIORITIES, PRIMARY_DRIVERS,
  PART_CONFIDENCE_LEVELS, YES_NO_CODES, YES_NO_WORDS,
} from '../../constants/catalogs';
import {
  getDocsBarColor, getStageColor, slaBarScaleDays, slaColors, slaLabels,
} from '../../utils/tracker-helpers';
import {
  addSupplierNote, deleteSupplier, deleteSupplierNote, editSupplierNote,
  getSupplierById, updateSupplier,
} from '../../services/suppliersService';
import {
  blacklistSupplier as blacklistSupplierApi, moveSupplierToStage, promoteSupplierToB2B,
} from '../../services/trackerService';
import { getScoutingEvents } from '../../services/eventsService';
import { ApiError } from '../../services/api.config';
import { usePermissions } from '../../hooks/usePermissions';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../../components/modalPanelStyle';
import { ModalHeader } from '../../components/ModalHeader';
import { MoveStageModal } from './MoveStageModal';
import { ParkingLotPrefillModal } from './ParkingLotPrefillModal';
import { PreliminaryPrefillModal } from './PreliminaryPrefillModal';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { LoadingState } from '../../components/LoadingState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RejectionReasonField, REJECTION_REASON_MIN, isValidRejectionReason } from '../../components/RejectionReasonField';
import { StageNoteField, isValidStageNote } from '../../components/StageNoteField';
import { useToast } from '../../context/ToastContext';
import { useModalTransition } from '../../hooks/useModalTransition';

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};

// Keys `PATCH /api/suppliers/:id` cannot accept: immutable, or owned by a
// dedicated endpoint, or (prelim_hasIMMEX) derived with no column to write.
const PATCH_DENYLIST = new Set([
  'id', 'folio', 'stage', 'entrySource', 'notes', 'history', 'documents', 'parts',
  'prelim_hasIMMEX',
  // Server-derived from the captured Real dates — never pushed from the client.
  'intelex_currentLevel',
]);

/** Changed top-level fields between two supplier snapshots, minus what PATCH rejects. */
function buildSupplierPatch(
  original: TrackerSupplier,
  draft: TrackerSupplier,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof TrackerSupplier)[]) {
    if (PATCH_DENYLIST.has(key)) continue;
    if (JSON.stringify(draft[key]) !== JSON.stringify(original[key])) {
      patch[key] = draft[key];
    }
  }
  return patch;
}

/** Applies a tab mutation to a clone, PATCHes only the changed fields, returns the fresh supplier. */
async function saveSupplier(
  supplier: TrackerSupplier,
  apply: (s: TrackerSupplier) => void,
): Promise<TrackerSupplier> {
  const draft: TrackerSupplier = JSON.parse(JSON.stringify(supplier));
  apply(draft);
  const patch = buildSupplierPatch(supplier, draft);
  if (Object.keys(patch).length === 0) return supplier;
  return updateSupplier(supplier.id, patch);
}

/** Loads active scouting-event names for the event dropdowns. */
function useEventNames(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    getScoutingEvents()
      .then(list => { if (!cancelled) setNames(list.map(e => e.name)); })
      .catch(() => { /* dropdown stays empty if events can't load */ });
    return () => { cancelled = true; };
  }, []);
  return names;
}

/** Something the user must fix before the save can run. Never a system failure. */
interface ValidationError {
  title: string;
  message: string;
}

/** Names the field, as the user sees it, when it is empty. */
function missing(label: string, value: string | null | undefined): string[] {
  return value && value.trim().length > 0 ? [] : [label];
}

/** Empty required fields → one sentence naming each of them. */
function requiredFields(fields: string[]): ValidationError | null {
  if (fields.length === 0) return null;
  return {
    title: 'Missing required information',
    message: fields.length === 1
      ? `"${fields[0]}" is required. Fill it in and save again.`
      : `These required fields are empty: ${fields.map(f => `"${f}"`).join(', ')}. Fill them in and save again.`,
  };
}

/** A business rule the entered values violate — say what to change. */
function ruleViolation(message: string): ValidationError {
  return { title: 'Check this before saving', message };
}

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

function TabGeneral({ supplier, phase }: { supplier: TrackerSupplier; phase: TrackerSupplier['scoutingPhase'] }) {
  const stageColor = getStageColor(supplier.stage);
  const isScouting = supplier.stage === 'Scouting Event';
  const isIdentified = isScouting && phase === 'Identified';
  const isB2B = isScouting && phase === 'B2B';
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
          {isScouting && <InfoRow label="Scouting phase" value={<Badge bg={isB2B ? '#6366F126' : '#02B3E126'} text={isB2B ? '#6366F1' : '#02B3E1'} label={phase ?? 'N/A'} />} />}
          <InfoRow label="Onboarding date" value={supplier.onboardingDate} />
          <InfoRow label="Days in stage" value={supplier.daysInStage} />
          <InfoRow label="Current stage" value={<Badge bg={stageColor + '26'} text={stageColor} label={supplier.stage} />} />
          {supplier.subStatus && <InfoRow label="Sub-status" value={<Badge bg={subStatusStyles[supplier.subStatus].bg} text={subStatusStyles[supplier.subStatus].text} label={supplier.subStatus} />} />}
          {supplier.daysSinceParkingLot !== null && supplier.globalSla && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: '#808285', margin: '0 0 6px' }}>
                Global SLA ({supplier.daysSinceParkingLot}/{slaBarScaleDays.global} days) · {slaLabels[supplier.globalSla]}
              </p>
              <div style={{ backgroundColor: '#EEEEEE', borderRadius: 4, height: 6, width: '100%' }}>
                <div style={{
                  height: 6, borderRadius: 4,
                  width: `${Math.min((supplier.daysSinceParkingLot / slaBarScaleDays.global) * 100, 100)}%`,
                  backgroundColor: slaColors[supplier.globalSla],
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

function TabDocuments({ supplier }: { supplier: TrackerSupplier }) {
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

function TabEvaluation({ supplier }: { supplier: TrackerSupplier }) {
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

function TabHistory({ supplier }: { supplier: TrackerSupplier }) {
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

function TabFiles({ supplier }: { supplier: TrackerSupplier }) {
  const toast = useToast();

  const files = [
    { name: `NDA_${supplier.name.replace(/ /g, '_')}_2026.pdf`, category: 'NDA', size: '245 KB', date: 'May 20, 2026', uploadedBy: 'Ana Garcia', type: 'pdf' },
    { name: `Technical_Profile_${supplier.name.replace(/ /g, '_')}.xlsx`, category: 'Technical', size: '1.2 MB', date: 'May 12, 2026', uploadedBy: 'Carlos Mendoza', type: 'xlsx' },
    { name: 'Preliminary_Evaluation_Form.pdf', category: 'Evaluation', size: '890 KB', date: 'May 5, 2026', uploadedBy: 'Roberto Sanchez', type: 'pdf' },
    { name: `RFQ_Package_${supplier.name.replace(/ /g, '_')}.docx`, category: 'Supplier Evaluation', size: '340 KB', date: 'Apr 28, 2026', uploadedBy: 'Ana Garcia', type: 'docx' },
  ];

  const fileIcons: Record<string, { icon: typeof faFilePdf; color: string }> = {
    pdf: { icon: faFilePdf, color: '#DC0202' },
    xlsx: { icon: faFileExcel, color: '#6ABF4B' },
    docx: { icon: faFileWord, color: '#02B3E1' },
    other: { icon: faFileAlt, color: '#808285' },
  };

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Files</h3>
        <button onClick={() => toast.info('File upload not available in this demo', 'This action will be enabled in the production version.')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
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
                <button onClick={() => toast.info('Download not available in this demo', 'This action will be enabled in the production version.')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
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

/** Free-text input. Only for values with no controlled vocabulary. */
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

/**
 * <select> backed by a catalog. A stored value outside the catalog (older demo
 * records) is kept as an extra option, so opening a record never silently drops
 * what it already had.
 */
function catalogSelect(
  value: string,
  onChange: (v: string) => void,
  options: readonly string[],
  placeholder = 'Select',
) {
  const isKnown = value === '' || options.includes(value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
      <option value="">{placeholder}</option>
      {!isKnown && <option value={value}>{value}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** <select> for catalogs stored as a short code but shown by label (Y/N, H/M/L). */
function codeSelect(
  value: string,
  onChange: (v: string) => void,
  options: readonly { code: string; label: string }[],
  placeholder = 'Select',
) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}

/** C_Commodity — 36 controlled values. */
const commoditySelect = (value: string, onChange: (v: string) => void) =>
  catalogSelect(value, onChange, COMMODITIES, 'Select commodity');

/** Origin event — must reference an event already registered in the system. */
const scoutingEventSelect = (value: string, onChange: (v: string) => void, eventNames: string[]) =>
  catalogSelect(value, onChange, eventNames, 'Select event');

/** C_SubStatus */
const subStatusSelect = (value: string, onChange: (v: string) => void) =>
  catalogSelect(value, onChange, SUB_STATUSES, 'Select status');

/**
 * Validate → confirm → save → toast. Every tab form on this screen goes through
 * here so the three steps can't drift apart between tabs.
 */
function FormSaveBar({
  label = 'Save',
  confirmTitle,
  confirmMessage,
  validate = () => null,
  onSave,
  successTitle,
  successMessage,
}: {
  label?: string;
  confirmTitle: string;
  confirmMessage: string;
  /** Returns what the user must fix, or null when the form is good to save.
   *  Omit for forms with nothing to validate (e.g. a derived, read-only tab). */
  validate?: () => ValidationError | null;
  /** Performs the write against the API; rejects with ApiError on failure. */
  onSave: () => Promise<unknown>;
  successTitle: string;
  successMessage?: string;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleClick() {
    const error = validate();
    if (error) {
      toast.validationError(error.title, error.message);
      return;
    }
    setConfirming(true);
  }

  async function handleConfirm() {
    setConfirming(false);
    setSaving(true);
    try {
      await onSave();
      toast.success(successTitle, successMessage);
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this change', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The changes could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button
          onClick={handleClick}
          disabled={saving}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : label}
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={label}
          onCancel={() => setConfirming(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

function TabScoutingEvent({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const eventNames = useEventNames();
  const [eventName, setEventName] = useState(supplier.scoutingInput || '');
  const [isDirect, setIsDirect] = useState(supplier.entrySource === 'Recommendation');

  // A directly-registered supplier has no origin event, so the field is not required.
  function validate() {
    return isDirect ? null : requiredFields(missing('Name of event', eventName));
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.scoutingInput = isDirect ? 'Registro directo' : eventName;
      s.entrySource = isDirect ? 'Recommendation' : 'Scouting Event';
      s.scoutingTabsCompleted.scoutingEvent = true;
    });
    onComplete(ok);
    return ok;
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Scouting Event Details</h3>
      <ScoutingField label="Name of event" required={!isDirect}>
        {isDirect
          ? <input type="text" value="Registro directo" disabled style={{ ...selectStyle, backgroundColor: '#EEEEEE', color: '#808285' }} />
          : scoutingEventSelect(eventName, setEventName, eventNames)}
      </ScoutingField>
      <ScoutingField label="Direct registration">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDirect} onChange={e => setIsDirect(e.target.checked)} style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#000000' }}>Supplier was registered directly (not from an event)</span>
        </label>
      </ScoutingField>
      <FormSaveBar
        confirmTitle="Save scouting event details?"
        confirmMessage={`This updates the origin of ${supplier.name} and marks the Scouting Event tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Scouting event details saved"
        successMessage={isDirect ? 'Registered as a direct entry, with no origin event.' : `Origin event set to "${eventName}".`}
      />
    </div>
  );
}

function TabSupplierInfo({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [companyName, setCompanyName] = useState(supplier.fullName || '');
  const [products, setProducts] = useState(supplier.productType || '');
  const [commodity, setCommodity] = useState<string>(supplier.commodity || '');
  const [website, setWebsite] = useState(supplier.website || '');

  function validate() {
    return requiredFields([
      ...missing('Company name', companyName),
      ...missing('Type of products', products),
      ...missing('Commodity', commodity),
      ...missing('Website', website),
    ]);
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.fullName = companyName.trim();
      s.productType = products.trim();
      s.commodity = commodity as Commodity;
      s.website = website.trim();
      s.scoutingTabsCompleted.supplierInfo = true;
    });
    onComplete(ok);
    return ok;
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
        {commoditySelect(commodity, setCommodity)}
      </ScoutingField>
      <ScoutingField label="Website" required>
        {scoutingInput(website, setWebsite, 'e.g. https://bosch.com')}
      </ScoutingField>
      <FormSaveBar
        confirmTitle="Save supplier information?"
        confirmMessage={`This updates the company details of ${supplier.name} and marks the Supplier Info tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Supplier information saved"
        successMessage={`Commodity set to "${commodity}".`}
      />
    </div>
  );
}

function TabAttendees({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [b2bStatus, setB2bStatus] = useState<'Yes' | 'No' | ''>(supplier.b2bStatus || '');
  const [whoAttends, setWhoAttends] = useState(supplier.b2bWhoAttends || '');
  const [manager, setManager] = useState(supplier.b2bManager || '');
  const [buyer, setBuyer] = useState(supplier.b2bBuyer || '');
  const [comments, setComments] = useState(supplier.b2bComments || '');

  function validate() {
    return requiredFields([
      ...missing('B2B meeting confirmed?', b2bStatus),
      ...missing('Who attends from supplier', whoAttends),
      ...missing('Manager attending', manager),
      ...missing('Buyer attending', buyer),
    ]);
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.b2bStatus = b2bStatus as 'Yes' | 'No';
      s.b2bWhoAttends = whoAttends.trim();
      s.b2bManager = manager.trim();
      s.b2bBuyer = buyer.trim();
      s.b2bComments = comments.trim() || null;
      if (b2bStatus === 'Yes') s.scoutingPhase = 'B2B';
      s.scoutingTabsCompleted.attendees = true;
    });
    onComplete(ok);
    return ok;
  }

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Attendees & B2B</h3>
      <ScoutingField label="B2B meeting confirmed?" required>
        <div className="flex" style={{ gap: 8 }}>
          {YES_NO_WORDS.map(opt => (
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
      <FormSaveBar
        confirmTitle="Save attendees & B2B?"
        confirmMessage={
          b2bStatus === 'Yes'
            ? `This marks the Attendees tab as complete and promotes ${supplier.name} to the B2B phase.`
            : `This marks the Attendees tab of ${supplier.name} as complete.`
        }
        validate={validate}
        onSave={handleSave}
        successTitle="Attendees & B2B saved"
        successMessage={b2bStatus === 'Yes' ? 'Supplier promoted to the B2B phase.' : 'No B2B meeting confirmed.'}
      />
    </div>
  );
}

function TabAgenda({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [status, setStatus] = useState(supplier.agendaStatus || '');
  const [teamsLink, setTeamsLink] = useState(supplier.agendaTeamsLink || '');
  const [date, setDate] = useState(supplier.agendaScheduledDate || '');
  const [timezone, setTimezone] = useState(supplier.agendaTimezone || '');
  const [stand, setStand] = useState(supplier.agendaStand || '');
  const [startTime, setStartTime] = useState(supplier.agendaStartTime || '');
  const [endTime, setEndTime] = useState(supplier.agendaEndTime || '');

  function validate() {
    const gaps = requiredFields([
      ...missing('Meeting status', status),
      ...missing('Scheduled date', date),
      ...missing('Start time', startTime),
      ...missing('End time', endTime),
    ]);
    if (gaps) return gaps;
    // Business rule: a meeting cannot end before it starts.
    if (endTime <= startTime) {
      return ruleViolation('"End time" must be later than "Start time". Adjust the times and save again.');
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.agendaStatus = status.trim();
      s.agendaTeamsLink = teamsLink.trim() || null;
      s.agendaScheduledDate = date.trim();
      s.agendaTimezone = timezone.trim() || null;
      s.agendaStand = stand.trim() || null;
      s.agendaStartTime = startTime.trim();
      s.agendaEndTime = endTime.trim();
      s.scoutingTabsCompleted.agenda = true;
    });
    onComplete(ok);
    return ok;
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
      <FormSaveBar
        confirmTitle="Save agenda?"
        confirmMessage={`This saves the meeting agenda for ${supplier.name} and marks the Agenda tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Agenda saved"
        successMessage={`Meeting scheduled for ${date} at ${startTime}–${endTime}.`}
      />
    </div>
  );
}

function TabNextStep({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [selected, setSelected] = useState<boolean | ''>(
    supplier.selectedForParking === null ? '' : supplier.selectedForParking
  );
  const [reason, setReason] = useState(supplier.selectionReason || '');

  function validate() {
    return requiredFields([
      ...(selected === '' ? ['Move to Parking Lot?'] : []),
      ...missing('Reason / notes', reason),
    ]);
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.selectedForParking = selected as boolean;
      s.selectionReason = reason.trim();
      s.scoutingTabsCompleted.nextStep = true;
    });
    onComplete(ok);
    return ok;
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
      <FormSaveBar
        confirmTitle="Save next step decision?"
        confirmMessage={
          selected === true
            ? `This records ${supplier.name} as selected for Parking Lot.`
            : `This records ${supplier.name} as discarded. Discarded suppliers are sent to Blacklisted when you move them on.`
        }
        validate={validate}
        onSave={handleSave}
        successTitle="Next step decision saved"
        successMessage={selected === true ? 'Supplier selected for Parking Lot.' : 'Supplier marked as discarded.'}
      />
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

function TabParkingOverview({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const eventNames = useEventNames();
  const today = new Date().toISOString().split('T')[0];
  const [onboardingDate, setOnboardingDate] = useState(supplier.parkingOnboardingDate || today);
  const [timeless, setTimeless] = useState(supplier.parkingTimeless || false);
  const [dateToMove, setDateToMove] = useState(supplier.parkingDateToMovePreliminary || '');
  const [scoutingInputVal, setScoutingInputVal] = useState(supplier.parkingScoutingInput || '');
  const [status, setStatus] = useState<string>(supplier.parkingSubStatus || '');

  const daysElapsed = onboardingDate
    ? Math.max(0, Math.floor((Date.now() - new Date(onboardingDate).getTime()) / 86400000))
    : 0;

  function validate() {
    const gaps = requiredFields([
      ...missing('Supplier onboarding date', onboardingDate),
      ...missing('Status', status),
    ]);
    if (gaps) return gaps;
    // Business rule: a fixed move date is meaningless before onboarding.
    if (!timeless && dateToMove && dateToMove < onboardingDate) {
      return ruleViolation('"Date to move to Preliminary" cannot be earlier than the onboarding date. Pick a later date, or tick "Timeless".');
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.parkingOnboardingDate = onboardingDate;
      s.parkingTimeless = timeless;
      s.parkingDateToMovePreliminary = timeless ? null : (dateToMove || null);
      s.parkingScoutingInput = scoutingInputVal || null;
      s.parkingSubStatus = (status || null) as TrackerSupplier['parkingSubStatus'];
      s.parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...s.parkingTabsCompleted, overview: true };
    });
    onComplete(ok);
    return ok;
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
          {scoutingEventSelect(scoutingInputVal, setScoutingInputVal, eventNames)}
        </ScoutingField>
        <ScoutingField label="Status" required>
          {subStatusSelect(status, setStatus)}
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
            <span style={{ backgroundColor: slaColors[supplier.sla] + '26', color: slaColors[supplier.sla], fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
              {slaLabels[supplier.sla]}
            </span>
          </span>
        </div>
        <div style={{ width: '100%', backgroundColor: '#EEEEEE', borderRadius: 3, height: 6 }}>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: slaColors[supplier.sla], width: `${Math.min(100, (daysElapsed / slaBarScaleDays['Parking Lot']) * 100)}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <FormSaveBar
        confirmTitle="Save Parking Lot overview?"
        confirmMessage={`This updates the onboarding data and status of ${supplier.name}.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Parking Lot overview saved"
        successMessage={`Status set to "${status}".`}
      />
    </ParkingCard>
  );
}

function TabParkingContact({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [isRecommendation, setIsRecommendation] = useState(supplier.parkingIsRecommendation || false);
  const [buyer, setBuyer] = useState(supplier.parkingBuyer || '');
  const [companyName, setCompanyName] = useState(supplier.parkingCompanyName || '');
  const [b2bMeeting, setB2bMeeting] = useState<string>(supplier.parkingB2BMeeting || '');
  const [name1, setName1] = useState(supplier.parkingName1 || '');
  const [website, setWebsite] = useState(supplier.parkingWebsite || '');
  const [email1, setEmail1] = useState(supplier.parkingEmail1 || '');
  const [phone, setPhone] = useState(supplier.parkingPhone || '');

  function validate() {
    const gaps = requiredFields([
      ...missing('Buyer', buyer),
      ...missing('Company name', companyName),
    ]);
    if (gaps) return gaps;
    if (email1.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email1.trim())) {
      return ruleViolation('"Email 1" is not a valid email address. Use the format name@company.com.');
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.parkingIsRecommendation = isRecommendation;
      s.parkingBuyer = buyer || null;
      s.parkingCompanyName = companyName || null;
      s.parkingB2BMeeting = (b2bMeeting || null) as TrackerSupplier['parkingB2BMeeting'];
      s.parkingName1 = name1 || null;
      s.parkingWebsite = website || null;
      s.parkingEmail1 = email1 || null;
      s.parkingPhone = phone || null;
      s.parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...s.parkingTabsCompleted, contact: true };
    });
    onComplete(ok);
    return ok;
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
          {catalogSelect(b2bMeeting, setB2bMeeting, YES_NO_WORDS)}
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
      <FormSaveBar
        confirmTitle="Save Parking Lot contact?"
        confirmMessage={`This updates the contact details of ${supplier.name}.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Parking Lot contact saved"
        successMessage={`Buyer set to "${buyer}".`}
      />
    </ParkingCard>
  );
}

function TabParkingDetails({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [commodity, setCommodity] = useState(supplier.parkingCommodity || '');
  const [productType, setProductType] = useState(supplier.parkingProductType || '');
  const [mfgCountry, setMfgCountry] = useState(supplier.parkingManufacturingCountry || '');
  const [mfgAddress, setMfgAddress] = useState(supplier.parkingManufacturingAddress || '');
  const [comments, setComments] = useState(supplier.parkingAdditionalComments || '');

  function validate() {
    return requiredFields(missing('Commodity', commodity));
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.parkingCommodity = commodity || null;
      s.parkingProductType = productType || null;
      s.parkingManufacturingCountry = mfgCountry || null;
      s.parkingManufacturingAddress = mfgAddress || null;
      s.parkingAdditionalComments = comments || null;
      s.parkingTabsCompleted = { ...{ overview: false, contact: false, details: false }, ...s.parkingTabsCompleted, details: true };
    });
    onComplete(ok);
    return ok;
  }

  return (
    <ParkingCard title="Parking Lot — Details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Commodity" required>
          {commoditySelect(commodity, setCommodity)}
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
      <FormSaveBar
        confirmTitle="Save Parking Lot details?"
        confirmMessage={`This updates the commodity and manufacturing data of ${supplier.name}.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Parking Lot details saved"
        successMessage={`Commodity set to "${commodity}".`}
      />
    </ParkingCard>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────

function DeleteConfirmModal({ supplier, onClose, onConfirm }: { supplier: TrackerSupplier; onClose: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title="Delete supplier?"
      message={<>This will permanently remove <strong style={{ color: '#000000' }}>{supplier.name}</strong> from the tracker. This action cannot be undone.</>}
      confirmLabel="Delete"
      onCancel={onClose}
      onConfirm={onConfirm}
    />
  );
}

// ── Blacklist Confirmation Modal ───────────────────────────────────────────
// Requires a written rejection reason (min. 20 chars) before confirming — same
// validation contract as MoveStageModal / StageTransitionModal. The reason is
// passed back to the caller so it can never be a hardcoded string.

function BlacklistConfirmModal({
  supplier, message, onClose, onConfirm,
}: {
  supplier: TrackerSupplier;
  message: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  // Pre-fill with the reason already captured at Next Step ("No — discard"), so
  // the user isn't asked to write it twice; they can extend it if it's too short.
  const [reason, setReason] = useState(supplier.selectionReason || '');
  const canConfirm = reason.trim().length >= REJECTION_REASON_MIN;

  return (
    <ConfirmDialog
      title="Send to Blacklisted?"
      message={message}
      confirmLabel="Confirm"
      confirmColor="#000000"
      confirmDisabled={!canConfirm}
      onCancel={onClose}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <RejectionReasonField
        reason={reason}
        onChange={setReason}
        placeholder={`Explain why ${supplier.name} is being blacklisted...`}
      />
    </ConfirmDialog>
  );
}

// ── Preliminary Evaluation tabs ────────────────────────────────────────────

type PrelimTabKey = 'overview' | 'capabilities';

function markPrelimComplete(s: TrackerSupplier, key: PrelimTabKey) {
  const tabs = s.preliminaryTabsCompleted ?? { overview: false, capabilities: false };
  tabs[key] = true;
  s.preliminaryTabsCompleted = tabs;
}

function markSupplierEvalComplete(s: TrackerSupplier, key: 'competitiveness' | 'fundamentals' | 'visit') {
  const tabs = s.supplierEvalTabsCompleted ?? { competitiveness: false, fundamentals: false, visit: false };
  tabs[key] = true;
  s.supplierEvalTabsCompleted = tabs;
}

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

function TabPrelimOverview({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const eventNames = useEventNames();
  const [priority, setPriority] = useState<string>(supplier.prelim_priority ? String(supplier.prelim_priority) : '');
  const [scoutingInputVal, setScoutingInputVal] = useState(supplier.prelim_scoutingInput || '');
  const [buyer, setBuyer] = useState(supplier.prelim_buyer || '');
  const [commodity, setCommodity] = useState<string>(supplier.prelim_commodity || '');
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

  function validate() {
    const gaps = requiredFields([
      ...missing('Priority', priority),
      ...missing('Commodity', commodity),
      ...missing('Buyer', buyer),
      ...missing('Primary driver', primaryDriver),
    ]);
    if (gaps) return gaps;
    const currentYear = new Date().getFullYear();
    if (foundedYear != null && (foundedYear < 1800 || foundedYear > currentYear)) {
      return ruleViolation(`"Founded year" must be between 1800 and ${currentYear}.`);
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.prelim_priority = (priority ? Number(priority) : null) as TrackerSupplier['prelim_priority'];
      s.prelim_scoutingInput = scoutingInputVal || null;
      s.prelim_buyer = buyer || null;
      s.prelim_commodity = (commodity || null) as Commodity | null;
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
      s.prelim_hasIMMEX = (hasIMMEX || null) as TrackerSupplier['prelim_hasIMMEX'];
      s.prelim_planToGetIMMEX = (planIMMEX || null) as TrackerSupplier['prelim_planToGetIMMEX'];
      markPrelimComplete(s, 'overview');
    });
    onComplete(ok);
    return ok;
  }

  const prelimStart = supplier.prelim_startDate;
  const days = prelimStart
    ? Math.max(0, Math.floor((Date.now() - new Date(prelimStart).getTime()) / 86400000))
    : null;

  return (
    <ParkingCard title="Preliminary Evaluation — Overview">
      <div style={{ display: 'flex', gap: 24, backgroundColor: '#F5F5F5', borderRadius: 8, padding: '14px 18px', marginBottom: 18 }}>
        <div>
          <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Folio</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#000000' }}>{supplier.folio}</span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Start date</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#000000' }}>{supplier.prelim_startDate ?? supplier.preEvalStartDate ?? 'Auto-set on entry'}</span>
        </div>
      </div>

      <SectionTitle title="Evaluation" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Priority" required>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
            <option value="">Select priority</option>
            {PRIORITIES.map(p => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
          </select>
        </ScoutingField>
        <ScoutingField label="Scouting input">{scoutingEventSelect(scoutingInputVal, setScoutingInputVal, eventNames)}</ScoutingField>
        <ScoutingField label="Buyer" required>{scoutingInput(buyer, setBuyer)}</ScoutingField>
        <ScoutingField label="Commodity" required>{commoditySelect(commodity, setCommodity)}</ScoutingField>
        <ScoutingField label="Primary driver" required>
          {catalogSelect(primaryDriver, setPrimaryDriver, PRIMARY_DRIVERS, 'Select driver')}
        </ScoutingField>
      </div>

      {days != null && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: slaColors[supplier.sla] }}>{slaLabels[supplier.sla]} · {days} days</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, backgroundColor: '#E0E0E0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (days / slaBarScaleDays['Preliminary Evaluation']) * 100)}%`, backgroundColor: slaColors[supplier.sla], borderRadius: 4 }} />
          </div>
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
          {catalogSelect(hasIMMEX, setHasIMMEX, IMMEX_STATUSES)}
        </ScoutingField>
        {hasIMMEX !== 'Yes' && (
          <ScoutingField label="Plan to get IMMEX">
            {codeSelect(planIMMEX, setPlanIMMEX, YES_NO_CODES)}
          </ScoutingField>
        )}
      </div>

      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save preliminary overview?"
        confirmMessage={`This updates the evaluation and company data of ${supplier.name} and marks the Overview tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Preliminary overview saved"
        successMessage={`Commodity "${commodity}", driver "${primaryDriver}".`}
      />
    </ParkingCard>
  );
}

function TabPrelimCapabilities({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [machineryType, setMachineryType] = useState(supplier.prelim_machineryType || '');
  const [processingMethod, setProcessingMethod] = useState(supplier.prelim_processingMethod || '');
  const [complementaryOps, setComplementaryOps] = useState(supplier.prelim_complementaryOps || '');
  const [toolingDesign, setToolingDesign] = useState(supplier.prelim_toolingDesign || '');
  const [materials, setMaterials] = useState(supplier.prelim_materials || '');
  const [rawMaterialIndex, setRawMaterialIndex] = useState(supplier.prelim_rawMaterialIndex || '');
  const [applications, setApplications] = useState(supplier.prelim_applications || '');

  function validate() {
    return requiredFields([
      ...missing('Machinery type', machineryType),
      ...missing('Processing method', processingMethod),
      ...missing('Materials', materials),
    ]);
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.prelim_machineryType = machineryType || null;
      s.prelim_processingMethod = processingMethod || null;
      s.prelim_complementaryOps = complementaryOps || null;
      s.prelim_toolingDesign = toolingDesign || null;
      s.prelim_materials = materials || null;
      s.prelim_rawMaterialIndex = rawMaterialIndex || null;
      s.prelim_applications = applications || null;
      markPrelimComplete(s, 'capabilities');
    });
    onComplete(ok);
    return ok;
  }

  return (
    <ParkingCard title="Preliminary Evaluation — Capabilities">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Machinery type" required>{scoutingInput(machineryType, setMachineryType)}</ScoutingField>
        <ScoutingField label="Processing method" required>{scoutingInput(processingMethod, setProcessingMethod)}</ScoutingField>
        <ScoutingField label="Complementary operations">{scoutingInput(complementaryOps, setComplementaryOps)}</ScoutingField>
        <ScoutingField label="Tooling design">{scoutingInput(toolingDesign, setToolingDesign)}</ScoutingField>
        <ScoutingField label="Materials" required>{scoutingInput(materials, setMaterials)}</ScoutingField>
        <ScoutingField label="Raw material index">{scoutingInput(rawMaterialIndex, setRawMaterialIndex)}</ScoutingField>
        <ScoutingField label="Applications">{scoutingInput(applications, setApplications)}</ScoutingField>
      </div>
      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save capabilities?"
        confirmMessage={`This records the technical capabilities of ${supplier.name} and marks the Capabilities tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Capabilities saved"
      />
    </ParkingCard>
  );
}

type PrelimPart = TrackerSupplier['prelim_parts'][number];

function TabSECompetitiveness({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
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
  function validate() {
    if (parts.length === 0) {
      return ruleViolation('Add at least one part before saving the competitiveness analysis.');
    }
    // Every part must at least be identifiable.
    const unnamed = parts.findIndex(p => !p.partNumber.trim());
    if (unnamed !== -1) {
      return requiredFields([`Part number (Part ${unnamed + 1})`]);
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.prelim_parts = parts;
      markSupplierEvalComplete(s, 'competitiveness');
    });
    onComplete(ok);
    return ok;
  }

  const moneyColor = (v: number | null) => (v == null ? '#000000' : v < 0 ? '#6ABF4B' : v > 0 ? '#DC0202' : '#000000');

  return (
    <ParkingCard title="Supplier Evaluation — Competitiveness">
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
              {codeSelect(
                p.confidence ?? '',
                v => updatePart(i, 'confidence', (v || null) as PrelimPart['confidence']),
                PART_CONFIDENCE_LEVELS,
              )}
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
      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save competitiveness analysis?"
        confirmMessage={`This saves ${parts.length} part${parts.length !== 1 ? 's' : ''} for ${supplier.name} and marks the Competitiveness tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Competitiveness analysis saved"
        successMessage={`${parts.length} part${parts.length !== 1 ? 's' : ''} recorded.`}
      />
    </ParkingCard>
  );
}

function TabSEFundamentals({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [rfq, setRfq] = useState<string>(supplier.prelim_rfqReceived || '');
  const [nda, setNda] = useState<string>(supplier.prelim_ndaSigned || '');
  const [tcs, setTcs] = useState<string>(supplier.prelim_tcsSigned || '');
  const [ttcs, setTtcs] = useState<string>(supplier.prelim_ttcsSigned || '');
  const [nsr, setNsr] = useState<string>(supplier.prelim_nsrSigned || '');
  const [sda, setSda] = useState<string>(supplier.prelim_sdaSigned || '');
  const [costModel, setCostModel] = useState<string>(supplier.prelim_costModel || '');

  const gate: { bg: string; text: string; label: string } =
    rfq === 'Y' && nda === 'Y'
      ? { bg: '#6ABF4B26', text: '#6ABF4B', label: 'Ready for development' }
      : rfq === 'N' || nda === 'N'
        ? { bg: '#D4A01726', text: '#D4A017', label: 'Blocked — RFQ & NDA required' }
        : { bg: '#80828526', text: '#808285', label: 'Pending — RFQ & NDA not set' };

  function validate() {
    return requiredFields([
      ...missing('RFQ received', rfq),
      ...missing('NDA signed', nda),
    ]);
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.prelim_rfqReceived = (rfq || null) as TrackerSupplier['prelim_rfqReceived'];
      s.prelim_ndaSigned = (nda || null) as TrackerSupplier['prelim_ndaSigned'];
      s.prelim_tcsSigned = (tcs || null) as TrackerSupplier['prelim_tcsSigned'];
      s.prelim_ttcsSigned = (ttcs || null) as TrackerSupplier['prelim_ttcsSigned'];
      s.prelim_nsrSigned = (nsr || null) as TrackerSupplier['prelim_nsrSigned'];
      s.prelim_sdaSigned = (sda || null) as TrackerSupplier['prelim_sdaSigned'];
      s.prelim_costModel = (costModel || null) as TrackerSupplier['prelim_costModel'];
      // Cost Model is optional and deliberately NOT part of this gate.
      s.selectedForDevelopment = rfq === 'Y' && nda === 'Y';
      markSupplierEvalComplete(s, 'fundamentals');
    });
    onComplete(ok);
    return ok;
  }

  const ynSelect = (value: string, onChange: (v: string) => void) =>
    codeSelect(value, onChange, YES_NO_CODES);

  return (
    <ParkingCard title="Supplier Evaluation — Fundamentals">
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
        <ScoutingField label="Cost Model">{ynSelect(costModel, setCostModel)}</ScoutingField>
      </div>
      <FormSaveBar
        confirmTitle="Save fundamentals?"
        confirmMessage={`This records the document status of ${supplier.name} and marks the Fundamentals tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Fundamentals saved"
        successMessage={`Gate status: ${gate.label}.`}
      />
    </ParkingCard>
  );
}

// Visit is a Supplier Evaluation tab (last of the three). Its field bindings keep
// the prelim_* names because the columns stayed in PreliminaryData — only the tab
// and its completion flag moved to Supplier Evaluation.
function TabSEVisit({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [planned, setPlanned] = useState(supplier.prelim_visitDatePlanned || '');
  const [completed, setCompleted] = useState(supplier.prelim_visitDateCompleted || '');
  const [participants, setParticipants] = useState(supplier.prelim_visitParticipants || '');
  const [strengths, setStrengths] = useState(supplier.prelim_strengths || '');
  const [weaknesses, setWeaknesses] = useState(supplier.prelim_weaknesses || '');
  const [observations, setObservations] = useState(supplier.prelim_observations || '');
  const [recommendations, setRecommendations] = useState(supplier.prelim_recommendations || '');

  function validate() {
    const gaps = requiredFields(missing('Visit date planned', planned));
    if (gaps) return gaps;
    // Business rule: the visit can't be reported as completed before it happened.
    if (completed && completed < planned) {
      return ruleViolation('"Visit date completed" cannot be earlier than "Visit date planned". Correct the dates and save again.');
    }
    if (completed && !strengths.trim() && !weaknesses.trim()) {
      return ruleViolation('A completed visit needs a report: fill in at least "Strengths" or "Weaknesses" before saving.');
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.prelim_visitDatePlanned = planned || null;
      s.prelim_visitDateCompleted = completed || null;
      s.prelim_visitParticipants = participants || null;
      s.prelim_strengths = strengths || null;
      s.prelim_weaknesses = weaknesses || null;
      s.prelim_observations = observations || null;
      s.prelim_recommendations = recommendations || null;
      markSupplierEvalComplete(s, 'visit');
    });
    onComplete(ok);
    return ok;
  }

  const textarea: React.CSSProperties = { ...selectStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' };

  return (
    <ParkingCard title="Supplier Evaluation — Visit Report">
      {!completed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#D4A01715', border: '1px solid #D4A01740', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 13, color: '#D4A017' }} />
          <span style={{ fontSize: 13, color: '#8a6d10' }}>Visit not yet completed. Enter the completed date to finalize the report.</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Visit date planned" required><input type="date" value={planned} onChange={e => setPlanned(e.target.value)} style={selectStyle} /></ScoutingField>
        <ScoutingField label="Visit date completed"><input type="date" value={completed} onChange={e => setCompleted(e.target.value)} style={selectStyle} /></ScoutingField>
      </div>
      <ScoutingField label="Participants">{scoutingInput(participants, setParticipants)}</ScoutingField>
      <ScoutingField label="Strengths"><textarea value={strengths} onChange={e => setStrengths(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Weaknesses"><textarea value={weaknesses} onChange={e => setWeaknesses(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Observations"><textarea value={observations} onChange={e => setObservations(e.target.value)} style={textarea} /></ScoutingField>
      <ScoutingField label="Recommendations"><textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} style={textarea} /></ScoutingField>
      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save visit report?"
        confirmMessage={`This records the visit report for ${supplier.name} and marks the Visit tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Visit report saved"
        successMessage={completed ? `Visit recorded as completed on ${completed}.` : 'Visit is planned but not yet completed.'}
      />
    </ParkingCard>
  );
}

export function DisplayField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#808285', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: value ? '#000000' : '#9CA3AF', display: 'block' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function DisplayCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Consolidated, de-duplicated snapshot of who the supplier is — one canonical
 * value per fact, read straight from the core supplier record (never the
 * per-stage `prelim_*`/`parking_*` copies), so nothing appears twice. Used as
 * the Completed detail's main "Overview" so a reader can identify and contact
 * the supplier without hunting through five per-stage tabs.
 */
export function TabCompletedOverview({ supplier }: { supplier: TrackerSupplier }) {
  const yesNo = (v: boolean) => (
    <Badge bg={v ? '#6ABF4B26' : '#80828526'} text={v ? '#6ABF4B' : '#808285'} label={v ? 'Yes' : 'No'} />
  );
  const address = [supplier.manufacturingAddress, supplier.country].filter(Boolean).join(', ');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      {/* Identity */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Identity" />
        <InfoRow label="Legal name" value={supplier.fullName || supplier.name} />
        <InfoRow label="Folio" value={supplier.folio} />
        <InfoRow label="Commodity" value={supplier.commodity} />
        <InfoRow label="Product type" value={supplier.productType} />
        <InfoRow label="Company type" value={supplier.companyType} />
        <InfoRow label="Founded year" value={supplier.foundedYear || '—'} />
        <InfoRow label="DUNS number" value={supplier.dunsNumber} />
        <InfoRow label="Tax ID" value={supplier.taxIdNumber ?? '—'} />
      </div>

      {/* Contact */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Contact" />
        <InfoRow label="Main contact" value={supplier.contactName} />
        <InfoRow label="Email" value={supplier.contactEmail} />
        <InfoRow label="Phone" value={supplier.phone} />
        <InfoRow
          label="Website"
          value={supplier.website
            ? <a href={supplier.website} target="_blank" rel="noreferrer" style={{ color: '#02B3E1', textDecoration: 'none' }}>{supplier.website}</a>
            : '—'}
        />
        <InfoRow label="Headquarters" value={supplier.headquarters} />
        <InfoRow label="Manufacturing address" value={address || '—'} />
        <InfoRow label="Assigned buyer" value={supplier.buyer} />
      </div>

      {/* Capabilities */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Capabilities" />
        <InfoRow label="Main technology" value={supplier.technology} />
        <InfoRow label="Process method" value={supplier.processMethod} />
        <InfoRow label="Materials" value={supplier.materials} />
        <InfoRow label="Certifications" value={supplier.certifications} />
        <InfoRow label="Safety-critical part" value={yesNo(supplier.safetyCritical)} />
        <InfoRow label="IMMEX" value={yesNo(supplier.hasIMMEX)} />
        <InfoRow label="Export capability" value={yesNo(supplier.exportCapability)} />
      </div>

      {/* Commercial & outcome */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Commercial & Outcome" />
        <InfoRow label="Annual revenue" value={supplier.annualRevenue} />
        <InfoRow label="Employees" value={supplier.employees ? supplier.employees.toLocaleString() : '—'} />
        <InfoRow label="Facilities" value={supplier.facilities || '—'} />
        <InfoRow label="Top customers" value={supplier.topCustomers} />
        <InfoRow label="Priority" value={<Badge bg={priorityStyles[supplier.priority].bg} text={priorityStyles[supplier.priority].text} label={`Priority ${supplier.priority}`} />} />
        <InfoRow label="Confidence" value={<Badge bg={confidenceStyles[supplier.confidenceLevel].bg} text={confidenceStyles[supplier.confidenceLevel].text} label={supplier.confidenceLevel} />} />
        <InfoRow label="Selected for development" value={yesNo(supplier.selectedForDevelopment)} />
        <InfoRow label="Entry source" value={supplier.entrySource} />
      </div>
    </div>
  );
}

export function TabROScoutingEvent({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Scouting Event">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Scouting Input" value={supplier.scoutingInput} />
        <DisplayField label="Buyer" value={supplier.buyer} />
        <DisplayField label="Company Name" value={supplier.name} />
        <DisplayField label="Commodity" value={supplier.commodity} />
        <DisplayField label="Country" value={supplier.country} />
        <DisplayField label="Product Type" value={supplier.productType} />
      </div>
    </DisplayCard>
  );
}

export function TabROSupplierInfo({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Supplier Info">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Manufacturing Address" value={supplier.manufacturingAddress} />
        <DisplayField label="DUNS Number" value={supplier.dunsNumber} />
        <DisplayField label="Website" value={supplier.website} />
        <DisplayField label="Email" value={supplier.contactEmail} />
        <DisplayField label="Phone" value={supplier.phone} />
        <DisplayField label="Certifications" value={supplier.certifications} />
      </div>
    </DisplayCard>
  );
}

export function TabROAttendees({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Attendees">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="B2B Meeting" value={supplier.b2bStatus} />
        <DisplayField label="Who Attends" value={supplier.b2bWhoAttends} />
        <DisplayField label="Manager" value={supplier.b2bManager} />
        <DisplayField label="Buyer" value={supplier.b2bBuyer} />
        <DisplayField label="Comments" value={supplier.b2bComments} />
      </div>
    </DisplayCard>
  );
}

export function TabROAgenda({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Agenda">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Status" value={supplier.agendaStatus} />
        <DisplayField label="Scheduled Date" value={supplier.agendaScheduledDate} />
        <DisplayField label="Start Time" value={supplier.agendaStartTime} />
        <DisplayField label="End Time" value={supplier.agendaEndTime} />
        <DisplayField label="Duration" value={supplier.agendaDuration} />
        <DisplayField label="Timezone" value={supplier.agendaTimezone} />
        <DisplayField label="Stand" value={supplier.agendaStand} />
        <DisplayField label="Teams Link" value={supplier.agendaTeamsLink} />
      </div>
    </DisplayCard>
  );
}

export function TabRONextStep({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Next Step">
      <DisplayField label="Selected for Parking Lot" value={supplier.selectedForParking === true ? 'Yes' : supplier.selectedForParking === false ? 'No' : '—'} />
      <DisplayField label="Selection Reason" value={supplier.selectionReason} />
    </DisplayCard>
  );
}

export function TabROParkingOverview({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Overview">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Onboarding Date" value={supplier.parkingOnboardingDate} />
        <DisplayField label="Sub Status" value={supplier.parkingSubStatus} />
        <DisplayField label="Scouting Input" value={supplier.parkingScoutingInput} />
        <DisplayField label="Buyer" value={supplier.parkingBuyer} />
        <DisplayField label="Commodity" value={supplier.parkingCommodity} />
        <DisplayField label="Product Type" value={supplier.parkingProductType} />
        <DisplayField label="B2B Meeting" value={supplier.parkingB2BMeeting} />
        <DisplayField label="Date to Move" value={supplier.parkingDateToMovePreliminary} />
        <DisplayField label="Additional Comments" value={supplier.parkingAdditionalComments} />
      </div>
    </DisplayCard>
  );
}

export function TabROParkingContact({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Contact">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Contact Name" value={supplier.parkingName1} />
        <DisplayField label="Website" value={supplier.parkingWebsite} />
        <DisplayField label="Email" value={supplier.parkingEmail1} />
        <DisplayField label="Phone" value={supplier.parkingPhone} />
      </div>
    </DisplayCard>
  );
}

export function TabROParkingDetails({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Manufacturing Country" value={supplier.parkingManufacturingCountry} />
        <DisplayField label="Manufacturing Address" value={supplier.parkingManufacturingAddress} />
        <DisplayField label="Company Name" value={supplier.parkingCompanyName} />
      </div>
    </DisplayCard>
  );
}

export function TabROPrelimOverview({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Preliminary — Overview">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Start Date" value={supplier.prelim_startDate} />
        <DisplayField label="Priority" value={supplier.prelim_priority != null ? String(supplier.prelim_priority) : null} />
        <DisplayField label="Scouting Input" value={supplier.prelim_scoutingInput} />
        <DisplayField label="Buyer" value={supplier.prelim_buyer} />
        <DisplayField label="Commodity" value={supplier.prelim_commodity} />
        <DisplayField label="Primary Driver" value={supplier.prelim_primaryDriver} />
        <DisplayField label="Company Name" value={supplier.prelim_companyName} />
        <DisplayField label="DUNS Number" value={supplier.prelim_dunsNumber} />
        <DisplayField label="HQ Address" value={supplier.prelim_hqAddress} />
        <DisplayField label="HQ City" value={supplier.prelim_hqCity} />
        <DisplayField label="HQ Country" value={supplier.prelim_hqCountry} />
        <DisplayField label="Manufacturing Address" value={supplier.prelim_manufacturingAddress} />
        <DisplayField label="Manufacturing City" value={supplier.prelim_manufacturingCity} />
        <DisplayField label="Manufacturing Country" value={supplier.prelim_manufacturingCountry} />
        <DisplayField label="Company Type" value={supplier.prelim_companyType} />
        <DisplayField label="Founded Year" value={supplier.prelim_foundedYear != null ? String(supplier.prelim_foundedYear) : null} />
        <DisplayField label="Footprint" value={supplier.prelim_footprint} />
        <DisplayField label="Years in Mexico" value={supplier.prelim_yearsInMexico != null ? String(supplier.prelim_yearsInMexico) : null} />
        <DisplayField label="Facilities" value={supplier.prelim_facilities != null ? String(supplier.prelim_facilities) : null} />
        <DisplayField label="Employees" value={supplier.prelim_employees != null ? String(supplier.prelim_employees) : null} />
        <DisplayField label="Annual Revenue" value={supplier.prelim_annualRevenue} />
        <DisplayField label="Main Technology" value={supplier.prelim_mainTechnology} />
        <DisplayField label="Certifications" value={supplier.prelim_certifications} />
        <DisplayField label="IMMEX" value={supplier.prelim_hasIMMEX} />
        <DisplayField label="Plan to get IMMEX" value={supplier.prelim_planToGetIMMEX} />
      </div>
    </DisplayCard>
  );
}

export function TabROPrelimCapabilities({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Preliminary — Capabilities">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Machinery Type" value={supplier.prelim_machineryType} />
        <DisplayField label="Processing Method" value={supplier.prelim_processingMethod} />
        <DisplayField label="Complementary Operations" value={supplier.prelim_complementaryOps} />
        <DisplayField label="Tooling Design" value={supplier.prelim_toolingDesign} />
        <DisplayField label="Materials" value={supplier.prelim_materials} />
        <DisplayField label="Raw Material Reference Index" value={supplier.prelim_rawMaterialIndex} />
        <DisplayField label="Applications" value={supplier.prelim_applications} />
      </div>
    </DisplayCard>
  );
}

export function TabROSECompetitiveness({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Supplier Evaluation — Competitiveness">
      {supplier.prelim_parts && supplier.prelim_parts.length > 0 ? (
        supplier.prelim_parts.map((p, i) => (
          <div key={i} style={{ marginBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, paddingBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, borderBottom: i < supplier.prelim_parts.length - 1 ? '1px solid #EEEEEE' : 'none' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Part {i + 1}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <DisplayField label="Part Number" value={p.partNumber} />
              <DisplayField label="Description" value={p.partDescription} />
              <DisplayField label="PL" value={p.pl} />
              <DisplayField label="Annual Peak Volume" value={p.annualPeakVolume != null ? p.annualPeakVolume.toLocaleString() : null} />
              <DisplayField label="Program" value={p.program} />
              <DisplayField label="EOP" value={p.eop} />
              <DisplayField label="Initial Quote" value={p.initialQuote != null ? `$${p.initialQuote.toFixed(4)}` : null} />
              <DisplayField label="QAD Price" value={p.qadPrice != null ? `$${p.qadPrice.toFixed(4)}` : null} />
              <DisplayField label="Delta $" value={p.delta != null ? `$${p.delta.toFixed(4)}` : null} />
              <DisplayField label="Tooling" value={p.tooling != null ? `$${p.tooling.toLocaleString()}` : null} />
              <DisplayField label="Saving Expected" value={p.savingExpected != null ? `$${p.savingExpected.toLocaleString()}` : null} />
              <DisplayField label="Confidence" value={p.confidence} />
            </div>
          </div>
        ))
      ) : (
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>No parts loaded.</p>
      )}
    </DisplayCard>
  );
}

export function TabROSEFundamentals({ supplier }: { supplier: TrackerSupplier }) {
  const docs = [
    { label: 'RFQ Received',  value: supplier.prelim_rfqReceived },
    { label: 'NDA Signed',    value: supplier.prelim_ndaSigned },
    { label: 'TC&s Signed',   value: supplier.prelim_tcsSigned },
    { label: 'TTC&S Signed',  value: supplier.prelim_ttcsSigned },
    { label: 'NSR Signed',    value: supplier.prelim_nsrSigned },
    { label: 'SDA Signed',    value: supplier.prelim_sdaSigned },
    { label: 'Cost Model',    value: supplier.prelim_costModel },
  ];
  return (
    <DisplayCard title="Supplier Evaluation — Fundamentals">
      {docs.map(doc => (
        <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
          <span style={{ fontSize: 13, color: '#000000' }}>{doc.label}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
            backgroundColor: doc.value === 'Y' ? '#6ABF4B26' : doc.value === 'N' ? '#DC020226' : '#80828526',
            color: doc.value === 'Y' ? '#6ABF4B' : doc.value === 'N' ? '#DC0202' : '#808285',
          }}>
            {doc.value ?? '—'}
          </span>
        </div>
      ))}
    </DisplayCard>
  );
}

export function TabROSEVisit({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <>
      <DisplayCard title="Supplier Evaluation — Visit Scheduling">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <DisplayField label="Visit Date Planned" value={supplier.prelim_visitDatePlanned} />
          <DisplayField label="Visit Date Completed" value={supplier.prelim_visitDateCompleted} />
          <DisplayField label="Participants" value={supplier.prelim_visitParticipants} />
        </div>
      </DisplayCard>
      <DisplayCard title="Supplier Evaluation — Visit Report">
        <DisplayField label="Strengths" value={supplier.prelim_strengths} />
        <DisplayField label="Weaknesses" value={supplier.prelim_weaknesses} />
        <DisplayField label="Observations" value={supplier.prelim_observations} />
        <DisplayField label="Recommendations" value={supplier.prelim_recommendations} />
      </DisplayCard>
    </>
  );
}

// ── Intelex Handoff tabs ───────────────────────────────────────────────────

function markIntelexComplete(s: TrackerSupplier, key: 'record' | 'timeline' | 'efficiency') {
  const tabs = s.intelexTabsCompleted ?? { record: false, timeline: false, efficiency: false };
  tabs[key] = true;
  s.intelexTabsCompleted = tabs;
}

function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

const intelexDaysColor = (d: number) => (d <= 30 ? '#6ABF4B' : d <= 60 ? '#D4A017' : '#DC0202');
const intelexEffColor = (pct: number) => (pct >= 95 ? '#6ABF4B' : pct >= 70 ? '#D4A017' : '#DC0202');

/**
 * Efficiency of an Intelex milestone = planned elapsed vs. actual elapsed,
 * measured from the record creation date (the start of the Intelex process).
 * Returns a fraction 0–1: 1 = hit the expected date or finished earlier, < 1 =
 * proportionally late. `null` when either date (or the anchor) is missing, so a
 * partially-filled Timeline still yields efficiency for the levels it does have.
 */
function intelexEfficiency(
  anchor: string | null | undefined,
  expected: string | null | undefined,
  real: string | null | undefined,
): number | null {
  const plannedDays = daysBetween(anchor, expected);
  const actualDays = daysBetween(anchor, real);
  if (plannedDays == null || actualDays == null) return null;
  if (actualDays <= 0) return plannedDays <= 0 ? 1 : null;
  return Math.max(0, Math.min(1, plannedDays / actualDays));
}

/** Live efficiency badge (bar + %) used by the Timeline and Efficiency tabs. */
function IntelexEffBar({ frac }: { frac: number | null }) {
  const pct = frac == null ? null : Math.round(frac * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#EEEEEE', overflow: 'hidden' }}>
        <div style={{ width: `${pct == null ? 0 : pct}%`, height: '100%', backgroundColor: pct == null ? '#EEEEEE' : intelexEffColor(pct), transition: 'width 0.2s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: pct == null ? '#9CA3AF' : intelexEffColor(pct), width: 44, textAlign: 'right' }}>
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

const INTELEX_LEVELS: { key: string; label: string }[] = [
  { key: 'investigate', label: 'Investigate' },
  { key: 'l0', label: 'L0' },
  { key: 'l1', label: 'L1' },
  { key: 'l2', label: 'L2' },
  { key: 'l3', label: 'L3' },
  { key: 'l4', label: 'L4' },
];

/** Prominent pill showing where the supplier is within the Intelex sequence. */
function IntelexLevelBadge({ level }: { level: IntelexLevel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current level</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0084C0', backgroundColor: '#0084C026', padding: '3px 10px', borderRadius: 4 }}>{level}</span>
    </div>
  );
}

// Greyed style for a "Real" date input that is not yet reachable in the sequence.
const lockedDateStyle: React.CSSProperties = { ...selectStyle, backgroundColor: '#F7F7F7', color: '#9CA3AF', cursor: 'not-allowed' };

const INTELEX_EFF_LEVELS: {
  key: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  field: keyof TrackerSupplier;
  expected: keyof TrackerSupplier;
  real: keyof TrackerSupplier;
}[] = [
  { key: 'L0', field: 'intelex_efficiencyL0', expected: 'intelex_l0Expected', real: 'intelex_l0Real' },
  { key: 'L1', field: 'intelex_efficiencyL1', expected: 'intelex_l1Expected', real: 'intelex_l1Real' },
  { key: 'L2', field: 'intelex_efficiencyL2', expected: 'intelex_l2Expected', real: 'intelex_l2Real' },
  { key: 'L3', field: 'intelex_efficiencyL3', expected: 'intelex_l3Expected', real: 'intelex_l3Real' },
  { key: 'L4', field: 'intelex_efficiencyL4', expected: 'intelex_l4Expected', real: 'intelex_l4Real' },
];

function TabIntelexRecord({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [creationDate, setCreationDate] = useState(supplier.intelex_recordCreationDate || '');
  const [recordNumber, setRecordNumber] = useState(supplier.intelex_investigateRecordNumber || '');
  const preEvalRef = supplier.preEvalStartDate || supplier.prelim_startDate;
  const days = daysBetween(preEvalRef, creationDate);

  function validate() {
    const gaps = requiredFields([
      ...missing('Record creation date', creationDate),
      ...missing('Investigate record number', recordNumber),
    ]);
    if (gaps) return gaps;
    // Business rule: the Intelex record can't predate the pre-evaluation it comes from.
    if (days != null && days < 0) {
      return ruleViolation('"Record creation date" cannot be earlier than the pre-evaluation start date. Correct the date and save again.');
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.intelex_recordCreationDate = creationDate || null;
      s.intelex_investigateRecordNumber = recordNumber || null;
      markIntelexComplete(s, 'record');
    });
    onComplete(ok);
    return ok;
  }

  return (
    <ParkingCard title="Intelex Handoff — Record">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <ScoutingField label="Record creation date" required>
          <input type="date" value={creationDate} onChange={e => setCreationDate(e.target.value)} style={selectStyle} />
        </ScoutingField>
        <ScoutingField label="Investigate record number" required>{scoutingInput(recordNumber, setRecordNumber)}</ScoutingField>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, paddingTop: 14, borderTop: '1px solid #F0F0F0' }}>
        <FontAwesomeIcon icon={faClock} style={{ fontSize: 14, color: '#808285' }} />
        <div>
          <span style={{ fontSize: 11, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Days from Pre-eval</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: days == null ? '#9CA3AF' : intelexDaysColor(days) }}>
            {days == null ? '—' : `${days} days`}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#808285' }}>Calculated automatically from the pre-evaluation start date.</span>
      </div>
      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save Intelex record?"
        confirmMessage={`This links ${supplier.name} to Intelex record ${recordNumber || '—'} and marks the Record tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Intelex record saved"
        successMessage={`Record number ${recordNumber} created on ${creationDate}.`}
      />
    </ParkingCard>
  );
}

function TabIntelexTimeline({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({
    investigateExpected: supplier.intelex_investigateExpected || '', investigateReal: supplier.intelex_investigateReal || '',
    l0Expected: supplier.intelex_l0Expected || '', l0Real: supplier.intelex_l0Real || '',
    l1Expected: supplier.intelex_l1Expected || '', l1Real: supplier.intelex_l1Real || '',
    l2Expected: supplier.intelex_l2Expected || '', l2Real: supplier.intelex_l2Real || '',
    l3Expected: supplier.intelex_l3Expected || '', l3Real: supplier.intelex_l3Real || '',
    l4Expected: supplier.intelex_l4Expected || '', l4Real: supplier.intelex_l4Real || '',
  });
  const set = (k: string, v: string) => setVals(prev => ({ ...prev, [k]: v }));

  // The Intelex record date is the common start; efficiency is planned-vs-actual
  // elapsed from it, so it shows live as soon as a level has both dates.
  const anchor = supplier.intelex_recordCreationDate;

  // No required fields: the Timeline saves whatever the user has so far (e.g.
  // just Investigate) — efficiency fills in level by level as dates are added.
  function validate() {
    if (!anchor) {
      return ruleViolation('Save the Record tab first — efficiency is measured from the record creation date.');
    }
    // A "Real" earlier than the record start is impossible; flag it, but only
    // for levels the user actually filled (blank rows never block the save).
    const bad = INTELEX_LEVELS.find(lvl => {
      const r = daysBetween(anchor, vals[`${lvl.key}Real`]);
      return r != null && r < 0;
    });
    if (bad) {
      return ruleViolation(`"${bad.label} — Real" cannot be earlier than the record creation date. Correct the date and save again.`);
    }
    return null;
  }

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => {
      s.intelex_investigateExpected = vals.investigateExpected || null; s.intelex_investigateReal = vals.investigateReal || null;
      s.intelex_l0Expected = vals.l0Expected || null; s.intelex_l0Real = vals.l0Real || null;
      s.intelex_l1Expected = vals.l1Expected || null; s.intelex_l1Real = vals.l1Real || null;
      s.intelex_l2Expected = vals.l2Expected || null; s.intelex_l2Real = vals.l2Real || null;
      s.intelex_l3Expected = vals.l3Expected || null; s.intelex_l3Real = vals.l3Real || null;
      s.intelex_l4Expected = vals.l4Expected || null; s.intelex_l4Real = vals.l4Real || null;
      // Efficiency is derived from these dates — persist it so read-only views and
      // the backend stay consistent without a second manual entry step.
      INTELEX_EFF_LEVELS.forEach(({ key, field }) => {
        const k = key.toLowerCase();
        (s[field] as number | null) = intelexEfficiency(anchor, vals[`${k}Expected`], vals[`${k}Real`]);
      });
      markIntelexComplete(s, 'timeline');
    });
    onComplete(ok);
    return ok;
  }

  return (
    <ParkingCard title="Intelex Handoff — Timeline">
      <IntelexLevelBadge level={supplier.intelex_currentLevel} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', color: '#1E40AF', fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
        <FontAwesomeIcon icon={faClock} style={{ fontSize: 12 }} />
        Real dates unlock in order: a level opens only once the previous level's Real date is captured. Expected dates can be set anytime.
      </div>
      {!anchor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} />
          Set the record creation date in the Record tab first — efficiency is measured from it.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 1fr 150px', gap: '0 16px', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #E0E0E0', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efficiency</span>
      </div>
      {INTELEX_LEVELS.map((lvl, idx) => {
        // A level's Real input unlocks once the previous level's Real date has a
        // value (live, from the form). Investigate is always open. Mirrors the
        // backend sequencing rule so unreachable levels can't even be typed.
        const realUnlocked = idx === 0 || (vals[`${INTELEX_LEVELS[idx - 1].key}Real`] || '').trim() !== '';
        return (
          <div key={lvl.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 1fr 150px', gap: '0 16px', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{lvl.label}</span>
            <input type="date" value={vals[`${lvl.key}Expected`]} onChange={e => set(`${lvl.key}Expected`, e.target.value)} style={selectStyle} />
            <input
              type="date"
              value={vals[`${lvl.key}Real`]}
              onChange={e => set(`${lvl.key}Real`, e.target.value)}
              disabled={!realUnlocked}
              title={realUnlocked ? undefined : `Capture the "${INTELEX_LEVELS[idx - 1].label}" real date first — Intelex levels advance in order.`}
              style={realUnlocked ? selectStyle : lockedDateStyle}
            />
            <IntelexEffBar frac={intelexEfficiency(anchor, vals[`${lvl.key}Expected`], vals[`${lvl.key}Real`])} />
          </div>
        );
      })}
      <FormSaveBar
        label="Save & Continue"
        confirmTitle="Save Intelex timeline?"
        confirmMessage={`This saves the expected and real dates entered so far for ${supplier.name}, updates the derived efficiency, and marks the Timeline tab as complete.`}
        validate={validate}
        onSave={handleSave}
        successTitle="Intelex timeline saved"
      />
    </ParkingCard>
  );
}

function TabIntelexEfficiency({ supplier, onComplete }: { supplier: TrackerSupplier; onComplete: (fresh: TrackerSupplier) => void }) {
  // Efficiency is fully derived from the Timeline dates — this tab is a live,
  // read-only summary. Saving here only records that it was reviewed.
  const anchor = supplier.intelex_recordCreationDate;
  const rows = INTELEX_EFF_LEVELS.map(({ key, expected, real }) => ({
    key,
    frac: intelexEfficiency(anchor, supplier[expected] as string | null, supplier[real] as string | null),
  }));
  const scored = rows.filter(r => r.frac != null);
  const overall = scored.length > 0
    ? scored.reduce((sum, r) => sum + (r.frac as number), 0) / scored.length
    : null;

  async function handleSave() {
    const ok = await saveSupplier(supplier, s => { markIntelexComplete(s, 'efficiency'); });
    onComplete(ok);
    return ok;
  }

  return (
    <ParkingCard title="Intelex Handoff — Efficiency">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', color: '#1E40AF', fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
        <FontAwesomeIcon icon={faClock} style={{ fontSize: 12 }} />
        Derived automatically from the Timeline: expected vs. real elapsed from the record creation date.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0 16px', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #E0E0E0', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efficiency</span>
      </div>
      {rows.map(({ key, frac }) => (
        <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0 16px', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{key}</span>
          <IntelexEffBar frac={frac} />
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0 16px', alignItems: 'center', marginTop: 4, paddingTop: 14, borderTop: '1px solid #E0E0E0' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#000000' }}>Overall</span>
        <IntelexEffBar frac={overall} />
      </div>

      <FormSaveBar
        confirmTitle="Mark efficiency as reviewed?"
        confirmMessage={`This confirms the derived efficiency for ${supplier.name} and marks the Efficiency tab as complete. Values update automatically from the Timeline.`}
        onSave={handleSave}
        successTitle="Intelex efficiency reviewed"
      />
    </ParkingCard>
  );
}

export function TabROIntelexRecord({ supplier }: { supplier: TrackerSupplier }) {
  const preEvalRef = supplier.preEvalStartDate || supplier.prelim_startDate;
  const days = daysBetween(preEvalRef, supplier.intelex_recordCreationDate);
  return (
    <DisplayCard title="Intelex Handoff — Record">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Record creation date" value={supplier.intelex_recordCreationDate} />
        <DisplayField label="Investigate record number" value={supplier.intelex_investigateRecordNumber} />
        <DisplayField label="Days from Pre-eval" value={days == null ? '—' : `${days} days`} />
      </div>
    </DisplayCard>
  );
}

export function TabROIntelexTimeline({ supplier }: { supplier: TrackerSupplier }) {
  const rows: { label: string; exp: string | null; real: string | null }[] = [
    { label: 'Investigate', exp: supplier.intelex_investigateExpected, real: supplier.intelex_investigateReal },
    { label: 'L0', exp: supplier.intelex_l0Expected, real: supplier.intelex_l0Real },
    { label: 'L1', exp: supplier.intelex_l1Expected, real: supplier.intelex_l1Real },
    { label: 'L2', exp: supplier.intelex_l2Expected, real: supplier.intelex_l2Real },
    { label: 'L3', exp: supplier.intelex_l3Expected, real: supplier.intelex_l3Real },
    { label: 'L4', exp: supplier.intelex_l4Expected, real: supplier.intelex_l4Real },
  ];
  return (
    <DisplayCard title="Intelex Handoff — Timeline">
      <IntelexLevelBadge level={supplier.intelex_currentLevel} />
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0 16px', paddingBottom: 8, borderBottom: '1px solid #E0E0E0', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Expected</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Real</span>
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0 16px', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{r.label}</span>
          <span style={{ fontSize: 13, color: r.exp ? '#000000' : '#9CA3AF' }}>{r.exp ?? '—'}</span>
          <span style={{ fontSize: 13, color: r.real ? '#000000' : '#9CA3AF' }}>{r.real ?? '—'}</span>
        </div>
      ))}
    </DisplayCard>
  );
}

export function TabROIntelexEfficiency({ supplier }: { supplier: TrackerSupplier }) {
  // Derived live from the Timeline dates, same as the editable Efficiency tab.
  const anchor = supplier.intelex_recordCreationDate;
  return (
    <DisplayCard title="Intelex Handoff — Efficiency">
      {INTELEX_EFF_LEVELS.map(({ key, expected, real }) => {
        const frac = intelexEfficiency(anchor, supplier[expected] as string | null, supplier[real] as string | null);
        const pct = frac == null ? null : Math.round(frac * 100);
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 44px', gap: '0 16px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{key}</span>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: '#EEEEEE', overflow: 'hidden' }}>
              <div style={{ width: `${pct == null ? 0 : pct}%`, height: '100%', backgroundColor: pct == null ? '#EEEEEE' : intelexEffColor(pct) }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct == null ? '#9CA3AF' : intelexEffColor(pct), textAlign: 'right' }}>{pct == null ? '—' : `${pct}%`}</span>
          </div>
        );
      })}
    </DisplayCard>
  );
}

export function SupplierDetailBody({ supplier: initialSupplier, origin = 'tracker' }: { supplier: TrackerSupplier; origin?: 'suppliers' | 'tracker' }) {
  const navigate = useNavigate();
  // Read-only roles (SQD/Guest) never see the write action bar (move/blacklist/delete).
  const { canWrite } = usePermissions();
  // Local copy of the supplier: every successful mutation replaces it with the
  // fresh record the API returns, via applyFresh(). The prop only seeds it.
  const [supplier, setSupplier] = useState(initialSupplier);
  const [activeTab, setActiveTab] = useState<
    'general' | 'documents' | 'evaluation' | 'history' | 'notes' | 'files' |
    'scoutingEvent' | 'supplierInfo' | 'attendees' | 'agenda' | 'nextStep' |
    'overview' | 'contact' | 'details' |
    'prelim_overview' | 'prelim_capabilities' |
    'se_competitiveness' | 'se_fundamentals' | 'se_visit' |
    'intelex_record' | 'intelex_timeline' | 'intelex_efficiency'
  >('general');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showParkingPrefill, setShowParkingPrefill] = useState(false);
  const [showPrelimPrefill, setShowPrelimPrefill] = useState(false);
  const [showPrelimConfirm, setShowPrelimConfirm] = useState(false);
  const [showSEConfirm, setShowSEConfirm] = useState(false);
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false);
  const [showIntelexConfirm, setShowIntelexConfirm] = useState(false);
  const toast = useToast();
  const [currentStage, setCurrentStage] = useState(supplier.stage);
  const [scoutingPhase, setScoutingPhase] = useState(supplier.scoutingPhase);
  const [tabsCompleted, setTabsCompleted] = useState({ ...supplier.scoutingTabsCompleted });
  const [parkingTabs, setParkingTabs] = useState(supplier.parkingTabsCompleted ?? { overview: false, contact: false, details: false });
  const [prelimTabs, setPrelimTabs] = useState(supplier.preliminaryTabsCompleted ?? { overview: false, capabilities: false });
  const [seTabs, setSeTabs] = useState(supplier.supplierEvalTabsCompleted ?? { competitiveness: false, fundamentals: false, visit: false });
  const [intelexTabs, setIntelexTabs] = useState(supplier.intelexTabsCompleted ?? { record: false, timeline: false, efficiency: false });
  const stageColor = getStageColor(currentStage);
  // Terminal suppliers arrive with rejection/completion fields; the DTO surfaces
  // a blacklisted row's origin stage, so the flag comes from the field, not the stage.
  const isBlacklisted = 'rejectionReason' in supplier && supplier.rejectionReason != null;
  const heroColor = isBlacklisted ? getStageColor('Blacklisted') : stageColor;
  const isScouting = currentStage === 'Scouting Event';
  const isParkingLot = currentStage === 'Parking Lot';
  const isPreliminary = currentStage === 'Preliminary Evaluation';
  const isSupplierEval = currentStage === 'Supplier Evaluation';
  const isIntelex = currentStage === 'Intelex Handoff';
  const isReadOnly = origin === 'suppliers';

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<SupplierNote[]>(supplier.notes ?? []);

  /** Adopts the fresh supplier an API write returned, syncing all derived state. */
  function applyFresh(fresh: TrackerSupplier) {
    setSupplier(fresh);
    setCurrentStage(fresh.stage);
    setScoutingPhase(fresh.scoutingPhase);
    setTabsCompleted({ ...fresh.scoutingTabsCompleted });
    setParkingTabs(fresh.parkingTabsCompleted ?? { overview: false, contact: false, details: false });
    setPrelimTabs(fresh.preliminaryTabsCompleted ?? { overview: false, capabilities: false });
    setSeTabs(fresh.supplierEvalTabsCompleted ?? { competitiveness: false, fundamentals: false, visit: false });
    setIntelexTabs(fresh.intelexTabsCompleted ?? { record: false, timeline: false, efficiency: false });
    setNotes(fresh.notes ?? []);
  }

  function addNote(text: string) {
    addSupplierNote(supplier.id, text)
      .then(note => setNotes(prev => [note, ...prev]))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be added.'));
  }

  function editNote(id: string, text: string) {
    editSupplierNote(supplier.id, id, text)
      .then(updated => setNotes(prev => prev.map(n => (n.id === id ? updated : n))))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be edited.'));
  }

  function deleteNote(id: string) {
    deleteSupplierNote(supplier.id, id)
      .then(() => setNotes(prev => prev.filter(n => n.id !== id)))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be deleted.'));
  }

  // When switching to scouting view, default to first incomplete tab
  useEffect(() => {
    if (isReadOnly) {
      if (isScouting) setActiveTab('scoutingEvent');
      else if (isParkingLot) setActiveTab('overview');
      else if (isPreliminary) setActiveTab('prelim_overview');
      else if (isSupplierEval) setActiveTab('se_competitiveness');
      else if (isIntelex) setActiveTab('intelex_record');
      else setActiveTab('general');
    } else if (isScouting) {
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
      else setActiveTab('prelim_overview');
    } else if (isSupplierEval) {
      if (!seTabs.competitiveness) setActiveTab('se_competitiveness');
      else if (!seTabs.fundamentals) setActiveTab('se_fundamentals');
      else if (!seTabs.visit) setActiveTab('se_visit');
      else setActiveTab('se_competitiveness');
    } else if (isIntelex) {
      if (!intelexTabs.record) setActiveTab('intelex_record');
      else if (!intelexTabs.timeline) setActiveTab('intelex_timeline');
      else if (!intelexTabs.efficiency) setActiveTab('intelex_efficiency');
      else setActiveTab('intelex_record');
    } else {
      setActiveTab('general');
    }
    // Selects the first incomplete tab on a stage change only — intentionally
    // not re-run when a single tab's completion flag flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly, isScouting, isParkingLot, isPreliminary, isSupplierEval, isIntelex]);

  /** Moves the supplier through a stage transition, then applies the fresh record. */
  async function moveToStage(newStage: string, successMessage: string, note: string, navigateTo?: string) {
    try {
      const fresh = await moveSupplierToStage(supplier.id, newStage as TrackerSupplier['stage'], note);
      applyFresh(fresh);
      toast.success(`${supplier.name} moved to ${newStage}`, successMessage);
      if (navigateTo) navigate(navigateTo);
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('This move is not allowed', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be moved.');
      }
    }
  }

  const handleStageMove = (newStage: string, rejectionReason?: string, note?: string) => {
    // Blacklisting is an exit from the tracker, handled by its own endpoint.
    if (newStage === 'Blacklisted') {
      handleBlacklistConfirm(rejectionReason ?? '');
      return;
    }
    // "Promote to B2B" is an in-stage phase change, not a stage transition.
    if (newStage === 'Promote to B2B') {
      promoteSupplierToB2B(supplier.id)
        .then(fresh => {
          applyFresh(fresh);
          toast.success(`${supplier.name} promoted to B2B`, 'The supplier stays in Scouting Event and is now scheduled for a B2B meeting.');
        })
        .catch(err => {
          if (err instanceof ApiError && err.isUserFixable) toast.validationError('Cannot promote to B2B', err.message);
          else toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be promoted.');
        });
      return;
    }
    void moveToStage(newStage, 'The change was recorded in the supplier history.', note ?? '');
  };

  async function handleDelete() {
    try {
      await deleteSupplier(supplier.id);
      toast.success(`${supplier.name} deleted`, 'The supplier was permanently removed from the tracker.');
      navigate('/tracker');
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) toast.validationError('Cannot delete this supplier', err.message);
      else toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be deleted.');
    }
  }

  /** Rejects a supplier out of the tracker; the reason is mandatory server-side. */
  async function runBlacklist(reason: string) {
    try {
      await blacklistSupplierApi(supplier.id, reason);
      toast.success(`${supplier.name} sent to Blacklisted`, 'The rejection reason was saved with the record.');
      navigate('/tracker');
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) toast.validationError('Cannot blacklist this supplier', err.message);
      else toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be blacklisted.');
    }
  }

  function handleBlacklistConfirm(reason: string) {
    void runBlacklist(reason);
  }

  async function handleParkingPrefillConfirm(updatedFields: Partial<TrackerSupplier>, note: string) {
    setShowParkingPrefill(false);
    try {
      // Stage change goes through the move endpoint; the rest is a normal patch
      // (buildSupplierPatch drops `stage` from the payload automatically).
      await moveSupplierToStage(supplier.id, 'Parking Lot', note);
      const fresh = await saveSupplier(supplier, s => { Object.assign(s, updatedFields); });
      applyFresh(fresh);
      toast.success(`${supplier.name} moved to Parking Lot`, 'Review the remaining Parking Lot tabs to complete its information.');
      navigate('/tracker');
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) toast.validationError('Cannot move to Parking Lot', err.message);
      else toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be moved.');
    }
  }

  /** The blacklist half of every "advance or reject" modal on this screen. */
  function rejectFromStage(reason: string | undefined, close: () => void) {
    close();
    void runBlacklist(reason ?? '');
  }

  function handleIntelexConfirm(choice: StageChoice, reason?: string, note?: string) {
    if (choice === 'blacklist') {
      rejectFromStage(reason, () => setShowIntelexConfirm(false));
      return;
    }
    setShowIntelexConfirm(false);
    // Completion is a move to the terminal 'Completed' stage (Intelex → Completed).
    void moveToStage('Completed', 'The supplier finished the tracker and now appears under Completed.', note ?? '', '/tracker/completed');
  }

  const allScoutingComplete = tabsCompleted.scoutingEvent && tabsCompleted.supplierInfo && tabsCompleted.attendees && tabsCompleted.agenda && tabsCompleted.nextStep;
  const allParkingComplete = parkingTabs.overview && parkingTabs.contact && parkingTabs.details;
  const allPreliminaryComplete = prelimTabs.overview && prelimTabs.capabilities;
  const allSupplierEvalComplete = seTabs.competitiveness && seTabs.fundamentals && seTabs.visit;
  const allIntelexComplete = intelexTabs.record && intelexTabs.timeline && intelexTabs.efficiency;
  const deleteDisabled = tabsCompleted.attendees;
  const parkingStatus = supplier.parkingSubStatus;

  // Shared style for the always-available "Send to Blacklisted" action that sits
  // next to the gated "Move to" button in Preliminary / Supplier Eval / Intelex.
  const sendToBlacklistStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13,
    fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer',
  };

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
    { id: 'files' as const, label: 'Files' },
  ];

  const parkingTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'overview', label: 'Overview', completed: parkingTabs.overview, locked: false },
    { id: 'contact', label: 'Contact', completed: parkingTabs.contact, locked: false },
    { id: 'details', label: 'Details', completed: parkingTabs.details, locked: false },
  ];

  const prelimTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'prelim_overview', label: 'Overview', completed: prelimTabs.overview, locked: false },
    { id: 'prelim_capabilities', label: 'Capabilities', completed: prelimTabs.capabilities, locked: false },
  ];

  const supplierEvalTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'se_competitiveness', label: 'Competitiveness', completed: seTabs.competitiveness, locked: false },
    { id: 'se_fundamentals', label: 'Fundamentals', completed: seTabs.fundamentals, locked: false },
    { id: 'se_visit', label: 'Visit', completed: seTabs.visit, locked: false },
  ];

  const intelexTabDefs: { id: typeof activeTab; label: string; completed: boolean; locked: boolean }[] = [
    { id: 'intelex_record', label: 'Record', completed: intelexTabs.record, locked: false },
    { id: 'intelex_timeline', label: 'Timeline', completed: intelexTabs.timeline, locked: false },
    { id: 'intelex_efficiency', label: 'Efficiency', completed: intelexTabs.efficiency, locked: false },
  ];

  const roTabDefs: { id: typeof activeTab; label: string }[] = isScouting
    ? [
        { id: 'scoutingEvent', label: 'Scouting Event' },
        { id: 'supplierInfo',  label: 'Supplier Info' },
        { id: 'attendees',     label: 'Attendees' },
        { id: 'agenda',        label: 'Agenda' },
        { id: 'nextStep',      label: 'Next Step' },
      ]
    : isParkingLot
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'contact',  label: 'Contact' },
        { id: 'details',  label: 'Details' },
      ]
    : isPreliminary
    ? [
        { id: 'prelim_overview',     label: 'Overview' },
        { id: 'prelim_capabilities', label: 'Capabilities' },
      ]
    : isSupplierEval
    ? [
        { id: 'se_competitiveness', label: 'Competitiveness' },
        { id: 'se_fundamentals',    label: 'Fundamentals' },
        { id: 'se_visit',           label: 'Visit' },
      ]
    : isIntelex
    ? [
        { id: 'intelex_record',     label: 'Record' },
        { id: 'intelex_timeline',   label: 'Timeline' },
        { id: 'intelex_efficiency', label: 'Efficiency' },
      ]
    : [
        { id: 'general',    label: 'General' },
        { id: 'documents',  label: 'Documents' },
        { id: 'evaluation', label: 'Evaluation' },
        { id: 'history',    label: 'History' },
        { id: 'notes',      label: 'Notes' },
        { id: 'files',      label: 'Files' },
      ];

  return (
    <>
      {/* ── Supplier Hero Header ─────────────────────────────── */}
      <div style={{
        backgroundColor: heroColor,
        borderRadius: 0,
        padding: '20px 32px',
        marginBottom: 0,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
            </button>
            <span style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF',
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {currentStage}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FFFFFF', opacity: supplier.sla === 'green' ? 0.9 : supplier.sla === 'yellow' ? 0.7 : 0.5, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{supplier.daysInStage} days in stage</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {supplier.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {[supplier.folio, supplier.commodity, supplier.country, supplier.buyer].filter(Boolean).join(' · ')}
          </p>
          {isParkingLot && parkingStatus && (
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(255,255,255,0.90)',
                color: subStatusStyles[parkingStatus]?.text ?? '#000000',
                fontSize: 12, fontWeight: 700, padding: '4px 12px',
                borderRadius: 4, letterSpacing: '0.03em',
              }}>
                {parkingStatus}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center" style={{ gap: 8, marginTop: 4 }}>
          <button
            onClick={() => setShowNotes(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faStickyNote} style={{ fontSize: 12 }} /> Notes
            {notes.length > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, backgroundColor: '#DC0202', color: '#FFFFFF', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {notes.length}
              </span>
            )}
          </button>

          {!isBlacklisted && !isReadOnly && canWrite && (
            <div className="flex items-center" style={{ gap: 8 }}>
            {isScouting ? (
              <>
                <button
                  onClick={() => { if (!deleteDisabled) setShowDeleteModal(true); }}
                  disabled={deleteDisabled}
                  title={deleteDisabled ? "Cannot delete after Attendees phase is completed. Use 'Send to Blacklisted' instead." : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', backgroundColor: '#DC0202', color: '#FFFFFF', cursor: deleteDisabled ? 'not-allowed' : 'pointer', opacity: deleteDisabled ? 0.45 : 1, transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!deleteDisabled) e.currentTarget.style.background = '#B80000'; }}
                  onMouseLeave={e => (e.currentTarget.style.background = '#DC0202')}
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
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: allScoutingComplete ? 'pointer' : 'not-allowed', opacity: allScoutingComplete ? 1 : 0.45 }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : isParkingLot ? (
              <>
                {parkingStatus === 'No Go' ? (
                  <button
                    onClick={() => setShowBlacklistConfirm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', opacity: 1 }}
                  >
                    Move to Blacklisted <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                  </button>
                ) : parkingStatus === 'On Hold' || parkingStatus === 'Under Evaluation' ? (
                  <button
                    disabled
                    title="Supplier must be marked as 'Go' before advancing."
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: 'not-allowed', opacity: 0.45 }}
                  >
                    Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                  </button>
                ) : (
                  <button
                    onClick={() => { if (allParkingComplete) setShowPrelimPrefill(true); }}
                    disabled={!allParkingComplete}
                    title={!allParkingComplete ? 'Complete all parking tabs to move to the next stage' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: allParkingComplete ? 'pointer' : 'not-allowed', opacity: allParkingComplete ? 1 : 0.45 }}
                  >
                    Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                  </button>
                )}
              </>
            ) : isPreliminary ? (
              <>
                {/* Blacklisting is an exit from the tracker — always available,
                    independent of tab completion. Only advancing is gated. */}
                <button onClick={() => setShowBlacklistConfirm(true)} style={sendToBlacklistStyle}>
                  <FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} /> Send to Blacklisted
                </button>
                <button
                  onClick={() => { if (allPreliminaryComplete) setShowPrelimConfirm(true); }}
                  disabled={!allPreliminaryComplete}
                  title={!allPreliminaryComplete ? 'Complete Overview and Capabilities to move to the next stage' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: allPreliminaryComplete ? 'pointer' : 'not-allowed', opacity: allPreliminaryComplete ? 1 : 0.45 }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : isSupplierEval ? (
              <>
                <button onClick={() => setShowBlacklistConfirm(true)} style={sendToBlacklistStyle}>
                  <FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} /> Send to Blacklisted
                </button>
                <button
                  onClick={() => { if (allSupplierEvalComplete) setShowSEConfirm(true); }}
                  disabled={!allSupplierEvalComplete}
                  title={!allSupplierEvalComplete ? 'Complete Competitiveness, Fundamentals and Visit to move to the next stage' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: allSupplierEvalComplete ? 'pointer' : 'not-allowed', opacity: allSupplierEvalComplete ? 1 : 0.45 }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : isIntelex ? (
              <>
                <button onClick={() => setShowBlacklistConfirm(true)} style={sendToBlacklistStyle}>
                  <FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} /> Send to Blacklisted
                </button>
                <button
                  onClick={() => { if (allIntelexComplete) setShowIntelexConfirm(true); }}
                  disabled={!allIntelexComplete}
                  title={!allIntelexComplete ? 'Complete Record, Timeline and Efficiency to move this supplier' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: allIntelexComplete ? 'pointer' : 'not-allowed', opacity: allIntelexComplete ? 1 : 0.45 }}
                >
                  Move to <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowMoveModal(true)} style={{ padding: '8px 16px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: '#FFFFFF', color: stageColor, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 12 }} /> Move stage
              </button>
            )}
          </div>
        )}

        {isReadOnly && (
          <button
            onClick={() => navigate(`/tracker/supplier/${supplier.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, color: '#FFFFFF', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'background 0.15s', marginTop: 4, background: 'rgba(255,255,255,0.18)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 11 }} />
            Open in Tracker
          </button>
        )}
        </div>
      </div>

      {!isReadOnly && (
        <nav style={{ margin: '16px 0 24px' }}>
          <span style={{ fontSize: 12, color: '#808285' }}>
            <Link to="/tracker" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <Link to={`/tracker/stage/${encodeURIComponent(supplier.stage)}`} style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>{supplier.stage}</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#000000', fontWeight: 600 }}>{supplier.name}</span>
          </span>
        </nav>
      )}

      {/* Tabs */}
      {isReadOnly ? (
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #EEEEEE', marginTop: 24, marginBottom: 24 }}>
          {roTabDefs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? '#000000' : '#808285',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #000000' : '2px solid transparent',
                marginBottom: -2, transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
      <div className="flex" style={{ borderBottom: '1px solid #E0E0E0', marginBottom: 24, gap: 0 }}>
        {!isReadOnly && (isScouting || isParkingLot || isPreliminary || isSupplierEval || isIntelex) ? (isScouting ? scoutingTabs : isParkingLot ? parkingTabDefs : isPreliminary ? prelimTabDefs : isSupplierEval ? supplierEvalTabDefs : intelexTabDefs).map(tab => (
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
      )}

      {/* Tab content */}
      {isReadOnly ? (
        <>
          {activeTab === 'scoutingEvent'       && <TabROScoutingEvent supplier={supplier} />}
          {activeTab === 'supplierInfo'        && <TabROSupplierInfo supplier={supplier} />}
          {activeTab === 'attendees'           && <TabROAttendees supplier={supplier} />}
          {activeTab === 'agenda'              && <TabROAgenda supplier={supplier} />}
          {activeTab === 'nextStep'            && <TabRONextStep supplier={supplier} />}
          {activeTab === 'overview'            && <TabROParkingOverview supplier={supplier} />}
          {activeTab === 'contact'             && <TabROParkingContact supplier={supplier} />}
          {activeTab === 'details'             && <TabROParkingDetails supplier={supplier} />}
          {activeTab === 'prelim_overview'     && <TabROPrelimOverview supplier={supplier} />}
          {activeTab === 'prelim_capabilities' && <TabROPrelimCapabilities supplier={supplier} />}
          {activeTab === 'se_competitiveness'  && <TabROSECompetitiveness supplier={supplier} />}
          {activeTab === 'se_fundamentals'     && <TabROSEFundamentals supplier={supplier} />}
          {activeTab === 'se_visit'            && <TabROSEVisit supplier={supplier} />}
          {activeTab === 'intelex_record'      && <TabROIntelexRecord supplier={supplier} />}
          {activeTab === 'intelex_timeline'    && <TabROIntelexTimeline supplier={supplier} />}
          {activeTab === 'intelex_efficiency'  && <TabROIntelexEfficiency supplier={supplier} />}
          {!['scoutingEvent','supplierInfo','attendees','agenda','nextStep','overview','contact','details','prelim_overview','prelim_capabilities','se_competitiveness','se_fundamentals','se_visit','intelex_record','intelex_timeline','intelex_efficiency'].includes(activeTab) && (
            <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
              <p style={{ fontSize: 13, color: '#808285' }}>No detailed information available for this stage yet.</p>
            </div>
          )}
        </>
      ) : !isReadOnly && isScouting ? (
        <>
          {activeTab === 'scoutingEvent' && <TabScoutingEvent supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('supplierInfo'); }} />}
          {activeTab === 'supplierInfo' && <TabSupplierInfo supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('attendees'); }} />}
          {activeTab === 'attendees' && <TabAttendees supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('agenda'); }} />}
          {activeTab === 'agenda' && <TabAgenda supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('nextStep'); }} />}
          {activeTab === 'nextStep' && <TabNextStep supplier={supplier} onComplete={(fresh) => applyFresh(fresh)} />}
        </>
      ) : !isReadOnly && isParkingLot ? (
        <>
          {activeTab === 'overview' && <TabParkingOverview supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('contact'); }} />}
          {activeTab === 'contact' && <TabParkingContact supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('details'); }} />}
          {activeTab === 'details' && <TabParkingDetails supplier={supplier} onComplete={(fresh) => applyFresh(fresh)} />}
        </>
      ) : !isReadOnly && isPreliminary ? (
        <>
          {activeTab === 'prelim_overview' && <TabPrelimOverview supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('prelim_capabilities'); }} />}
          {/* Capabilities is the last Preliminary tab now that Visit moved to
              Supplier Evaluation — fall back to this stage's own next incomplete
              tab instead of advancing out of the stage. */}
          {activeTab === 'prelim_capabilities' && <TabPrelimCapabilities supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); if (!fresh.preliminaryTabsCompleted?.overview) setActiveTab('prelim_overview'); }} />}
        </>
      ) : !isReadOnly && isSupplierEval ? (
        <>
          {activeTab === 'se_competitiveness' && <TabSECompetitiveness supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('se_fundamentals'); }} />}
          {activeTab === 'se_fundamentals' && <TabSEFundamentals supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('se_visit'); }} />}
          {activeTab === 'se_visit' && <TabSEVisit supplier={supplier} onComplete={(fresh) => applyFresh(fresh)} />}
        </>
      ) : !isReadOnly && isIntelex ? (
        <>
          {activeTab === 'intelex_record' && <TabIntelexRecord supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('intelex_timeline'); }} />}
          {activeTab === 'intelex_timeline' && <TabIntelexTimeline supplier={supplier} onComplete={(fresh) => { applyFresh(fresh); setActiveTab('intelex_efficiency'); }} />}
          {activeTab === 'intelex_efficiency' && <TabIntelexEfficiency supplier={supplier} onComplete={(fresh) => applyFresh(fresh)} />}
        </>
      ) : (
        <>
          {activeTab === 'general' && <TabGeneral supplier={supplier} phase={scoutingPhase} />}
          {activeTab === 'documents' && <TabDocuments supplier={supplier} />}
          {activeTab === 'evaluation' && <TabEvaluation supplier={supplier} />}
          {activeTab === 'history' && <TabHistory supplier={supplier} />}
          {activeTab === 'files' && <TabFiles supplier={supplier} />}
        </>
      )}

      {!isReadOnly && showMoveModal && (
        <MoveStageModal
          supplier={supplier}
          onClose={() => setShowMoveModal(false)}
          onConfirm={handleStageMove}
          origin={origin}
        />
      )}
      {!isReadOnly && showDeleteModal && (
        <DeleteConfirmModal
          supplier={supplier}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
      {!isReadOnly && showParkingPrefill && (
        <ParkingLotPrefillModal
          supplier={supplier}
          onClose={() => setShowParkingPrefill(false)}
          onConfirm={handleParkingPrefillConfirm}
        />
      )}
      {!isReadOnly && showPrelimPrefill && (
        <PreliminaryPrefillModal
          supplier={supplier}
          onClose={() => setShowPrelimPrefill(false)}
          onConfirm={async (updatedFields, note) => {
            setShowPrelimPrefill(false);
            try {
              await moveSupplierToStage(supplier.id, 'Preliminary Evaluation', note);
              const fresh = await saveSupplier(supplier, s => { Object.assign(s, updatedFields); });
              applyFresh(fresh);
              toast.success(`${supplier.name} moved to Preliminary Evaluation`, 'Complete the Overview, Capabilities and Visit tabs to advance further.');
              navigate('/tracker/stage/' + encodeURIComponent('Preliminary Evaluation'));
            } catch (err) {
              if (err instanceof ApiError && err.isUserFixable) toast.validationError('Cannot move to Preliminary Evaluation', err.message);
              else toast.systemError(err instanceof ApiError ? err.message : 'The supplier could not be moved.');
            }
          }}
        />
      )}
      {!isReadOnly && showPrelimConfirm && (
        <PrelimToSupplierEvalModal
          supplier={supplier}
          onClose={() => setShowPrelimConfirm(false)}
          onConfirm={(choice, reason, note) => {
            if (choice === 'blacklist') {
              rejectFromStage(reason, () => setShowPrelimConfirm(false));
              return;
            }
            setShowPrelimConfirm(false);
            void moveToStage('Supplier Evaluation', 'Complete Competitiveness and Fundamentals to advance further.', note ?? '', '/tracker/stage/' + encodeURIComponent('Supplier Evaluation'));
          }}
        />
      )}
      {!isReadOnly && showSEConfirm && (
        <SupplierEvalToIntelexModal
          supplier={supplier}
          onClose={() => setShowSEConfirm(false)}
          onConfirm={(choice, reason, note) => {
            if (choice === 'blacklist') {
              rejectFromStage(reason, () => setShowSEConfirm(false));
              return;
            }
            setShowSEConfirm(false);
            void moveToStage('Intelex Handoff', 'Complete Record, Timeline and Efficiency to close the handoff.', note ?? '', '/tracker/stage/' + encodeURIComponent('Intelex Handoff'));
          }}
        />
      )}
      {!isReadOnly && showIntelexConfirm && (
        <IntelexToCompletedModal
          supplier={supplier}
          onClose={() => setShowIntelexConfirm(false)}
          onConfirm={handleIntelexConfirm}
        />
      )}
      {!isReadOnly && showBlacklistConfirm && (
        <BlacklistConfirmModal
          supplier={supplier}
          message={
            supplier.selectedForParking === false
              ? 'This supplier was not selected for Parking Lot. Confirming will move them to Blacklisted permanently.'
              : 'Confirming will move this supplier to Blacklisted permanently.'
          }
          onClose={() => setShowBlacklistConfirm(false)}
          onConfirm={(reason) => { setShowBlacklistConfirm(false); handleBlacklistConfirm(reason); }}
        />
      )}
      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date, tag: n.stage }))}
          currentUserName={CURRENT_USER.name}
          accentColor={stageColor}
          onAdd={addNote}
          onEdit={editNote}
          onDelete={deleteNote}
          onClose={() => setShowNotes(false)}
        />
      )}
    </>
  );
}

type StageChoice = 'advance' | 'blacklist';

function StageTransitionModal({
  supplier, title, subtitle, advanceLabel, advanceColor, blacklistLabel, onClose, onConfirm,
  advanceOnly = false,
}: {
  supplier: TrackerSupplier;
  title: string;
  subtitle: string;
  advanceLabel: string;
  advanceColor: string;
  blacklistLabel: string;
  onClose: () => void;
  onConfirm: (choice: StageChoice, reason?: string, note?: string) => void;
  /** When set, offers only the advance path (no blacklist radio / reason). */
  advanceOnly?: boolean;
}) {
  const [choice, setChoice] = useState<StageChoice>('advance');
  const [reason, setReason] = useState('');
  // Advancing requires a real note (mandatory server-side); rejecting requires a reason.
  const [note, setNote] = useState('');
  const isBlacklist = choice === 'blacklist';
  const canConfirm = isBlacklist ? isValidRejectionReason(reason) : isValidStageNote(note);
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const optionStyle = (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
    border: `1px solid ${active ? color : '#D1D3D4'}`, backgroundColor: active ? color + '12' : '#FFFFFF',
    cursor: 'pointer', marginBottom: 10,
  });

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
        style={{ ...MODAL_PANEL_BASE, width: 520 }}
      >
        <ModalHeader
          title={title}
          subtitle={`${subtitle} — ${supplier.name}`}
          accentColor={getStageColor(supplier.stage)}
          onClose={requestClose}
        />

        <div style={{ padding: MODAL_BODY_PADDING }}>
        {advanceOnly ? (
          <div style={optionStyle(true, advanceColor)}>
            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 13, color: advanceColor }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{advanceLabel}</span>
          </div>
        ) : (
          <>
            <label style={optionStyle(choice === 'advance', advanceColor)}>
              <input type="radio" checked={choice === 'advance'} onChange={() => setChoice('advance')} style={{ accentColor: advanceColor, width: 16, height: 16, cursor: 'pointer' }} />
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 13, color: advanceColor }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{advanceLabel}</span>
            </label>
            <label style={optionStyle(isBlacklist, '#000000')}>
              <input type="radio" checked={isBlacklist} onChange={() => setChoice('blacklist')} style={{ accentColor: '#000000', width: 16, height: 16, cursor: 'pointer' }} />
              <FontAwesomeIcon icon={faBan} style={{ fontSize: 13, color: '#000000' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{blacklistLabel}</span>
            </label>
          </>
        )}

        {!isBlacklist && (
          <div style={{ marginTop: 6, marginBottom: 4 }}>
            <StageNoteField
              note={note}
              onChange={setNote}
              placeholder={`Explain why ${supplier.name} is advancing...`}
            />
          </div>
        )}

        {!advanceOnly && isBlacklist && (
          <div style={{ marginTop: 6, marginBottom: 4 }}>
            <RejectionReasonField
              reason={reason}
              onChange={setReason}
              placeholder={`Explain why ${supplier.name} is being rejected...`}
              autoFocus={false}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16, marginTop: 16 }}>
          <button
            onClick={requestClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (canConfirm) onConfirm(choice, isBlacklist ? reason : undefined, isBlacklist ? undefined : note); }}
            disabled={!canConfirm}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: isBlacklist ? '#000000' : advanceColor, color: '#FFFFFF', cursor: canConfirm ? 'pointer' : 'not-allowed', opacity: canConfirm ? 1 : 0.45 }}
          >
            Confirm
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function PrelimToSupplierEvalModal({ supplier, onClose, onConfirm }: { supplier: TrackerSupplier; onClose: () => void; onConfirm: (choice: StageChoice, reason?: string, note?: string) => void }) {
  return (
    <StageTransitionModal
      supplier={supplier}
      title="Advance from Preliminary Evaluation"
      subtitle="Confirm advancing to the next stage"
      advanceLabel="Move to Supplier Evaluation"
      advanceColor="#6ABF4B"
      blacklistLabel="Send to Blacklisted"
      advanceOnly
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function SupplierEvalToIntelexModal({ supplier, onClose, onConfirm }: { supplier: TrackerSupplier; onClose: () => void; onConfirm: (choice: StageChoice, reason?: string, note?: string) => void }) {
  return (
    <StageTransitionModal
      supplier={supplier}
      title="Advance from Supplier Evaluation"
      subtitle="Confirm advancing to the next stage"
      advanceLabel="Move to Intelex Handoff"
      advanceColor="#0084C0"
      blacklistLabel="Send to Blacklisted"
      advanceOnly
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function IntelexToCompletedModal({ supplier, onClose, onConfirm }: { supplier: TrackerSupplier; onClose: () => void; onConfirm: (choice: StageChoice, reason?: string, note?: string) => void }) {
  return (
    <StageTransitionModal
      supplier={supplier}
      title="Close Intelex Handoff"
      subtitle="Confirm advancing to the next stage"
      advanceLabel="Move to Completed"
      advanceColor="#6ABF4B"
      blacklistLabel="Send to Blacklisted"
      advanceOnly
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export function TrackerSupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const toast = useToast();
  const [supplier, setSupplier] = useState<TrackerSupplier | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setLoading(true);
    getSupplierById(supplierId)
      .then(s => { if (!cancelled) setSupplier(s); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the supplier.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplierId, toast]);

  if (loading) {
    return <LoadingState entity="Supplier" />;
  }
  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return (
    <div>
      <SupplierDetailBody supplier={supplier} />
    </div>
  );
}
