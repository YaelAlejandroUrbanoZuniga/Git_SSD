import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faLock, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { completedSuppliers } from '../../data/pipeline-demo';
import { getStageColor } from '../../utils/pipeline-helpers';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { CURRENT_USER } from '../../constants/currentUser';
import type { SupplierNote } from '../../types';
import {
  TabROScoutingEvent, TabROSupplierInfo,
  TabROParkingOverview, TabROParkingContact, TabROParkingDetails,
  TabROPrelimOverview, TabROPrelimCapabilities, TabROPrelimVisit,
  TabROSECompetitiveness, TabROSEFundamentals,
  TabROIntelexRecord, TabROIntelexTimeline, TabROIntelexEfficiency,
} from './PipelineSupplierDetail';

type MainTab = 'scouting' | 'parking' | 'preliminary' | 'supplierEval' | 'intelex';

const mainTabs: { id: MainTab; label: string }[] = [
  { id: 'scouting', label: 'Scouting' },
  { id: 'parking', label: 'Parking Lot' },
  { id: 'preliminary', label: 'Preliminary' },
  { id: 'supplierEval', label: 'Supplier Eval' },
  { id: 'intelex', label: 'Intelex Handoff' },
];

function SubTabBar({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
            fontWeight: active === t.id ? 700 : 500,
            border: active === t.id ? '1px solid #6ABF4B' : '1px solid #D1D3D4',
            backgroundColor: active === t.id ? '#6ABF4B15' : '#FFFFFF',
            color: active === t.id ? '#3F8F2E' : '#808285',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function CompletedSupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MainTab>('scouting');
  const [seSubTab, setSeSubTab] = useState('competitiveness');
  const [intelexSubTab, setIntelexSubTab] = useState('record');

  const supplier = completedSuppliers.find(s => s.id === supplierId);

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<SupplierNote[]>(supplier?.notes ?? []);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  function addNote(text: string) {
    const newNote: SupplierNote = {
      id: `n-${Date.now()}`,
      author: CURRENT_USER.name,
      role: CURRENT_USER.role,
      text,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      stage: supplier!.stage,
    };
    const idx = completedSuppliers.findIndex(s => s.id === supplier!.id);
    if (idx !== -1) completedSuppliers[idx].notes.unshift(newNote);
    setNotes(prev => [newNote, ...prev]);
  }

  function editNote(id: string, text: string) {
    const idx = completedSuppliers.findIndex(s => s.id === supplier!.id);
    if (idx !== -1) {
      const target = completedSuppliers[idx].notes.find(n => n.id === id);
      if (target) target.text = text;
    }
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, text } : n)));
  }

  function deleteNote(id: string) {
    const idx = completedSuppliers.findIndex(s => s.id === supplier!.id);
    if (idx !== -1) completedSuppliers[idx].notes = completedSuppliers[idx].notes.filter(n => n.id !== id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: getStageColor('Completed'),
        padding: '20px 32px',
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <button
            onClick={() => navigate('/pipeline/completed')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} /> Back
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{supplier.name}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {supplier.folio} · {supplier.commodity} · Completed: {supplier.completedDate}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12, marginTop: 4 }}>
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
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            backgroundColor: '#6ABF4B', color: '#FFFFFF', border: '1px solid #FFFFFF',
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 4,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            Completed
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Pipeline</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <Link to="/pipeline/completed" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Completed</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{supplier.name}</span>
        </span>
      </nav>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E0E0E0', marginBottom: 20, gap: 0 }}>
        {mainTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : '#808285',
              borderBottom: activeTab === tab.id ? '2px solid #6ABF4B' : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'scouting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TabROScoutingEvent supplier={supplier} />
          <TabROSupplierInfo supplier={supplier} />
        </div>
      )}

      {activeTab === 'parking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TabROParkingOverview supplier={supplier} />
          <TabROParkingContact supplier={supplier} />
          <TabROParkingDetails supplier={supplier} />
        </div>
      )}

      {activeTab === 'preliminary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TabROPrelimOverview supplier={supplier} />
          <TabROPrelimCapabilities supplier={supplier} />
          <TabROPrelimVisit supplier={supplier} />
        </div>
      )}

      {activeTab === 'supplierEval' && (
        <div>
          <SubTabBar
            tabs={[{ id: 'competitiveness', label: 'Competitiveness' }, { id: 'fundamentals', label: 'Fundamentals' }]}
            active={seSubTab}
            onChange={setSeSubTab}
          />
          {seSubTab === 'competitiveness' && <TabROSECompetitiveness supplier={supplier} />}
          {seSubTab === 'fundamentals' && <TabROSEFundamentals supplier={supplier} />}
        </div>
      )}

      {activeTab === 'intelex' && (
        <div>
          <SubTabBar
            tabs={[{ id: 'record', label: 'Record' }, { id: 'timeline', label: 'Timeline' }, { id: 'efficiency', label: 'Efficiency' }]}
            active={intelexSubTab}
            onChange={setIntelexSubTab}
          />
          {intelexSubTab === 'record' && <TabROIntelexRecord supplier={supplier} />}
          {intelexSubTab === 'timeline' && <TabROIntelexTimeline supplier={supplier} />}
          {intelexSubTab === 'efficiency' && <TabROIntelexEfficiency supplier={supplier} />}
        </div>
      )}

      {/* Locked info banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, padding: '12px 16px', backgroundColor: '#F7F7F7', border: '1px solid #E0E0E0', borderRadius: 8 }}>
        <FontAwesomeIcon icon={faLock} style={{ fontSize: 14, color: '#808285' }} />
        <span style={{ fontSize: 13, color: '#808285' }}>
          This supplier has completed the full SSD pipeline cycle and is no longer editable.
        </span>
      </div>

      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date, tag: n.stage }))}
          currentUserName={CURRENT_USER.name}
          onAdd={addNote}
          onEdit={editNote}
          onDelete={deleteNote}
          onClose={() => setShowNotes(false)}
        />
      )}
    </div>
  );
}
