import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBan, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { getStageColor, stageIndex } from '../../utils/tracker-helpers';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { LoadingState } from '../../components/LoadingState';
import { moduleIcons } from '../../components/moduleIcons';
import { useAuth } from '../../context/AuthContext';
import {
  addSupplierNote, deleteSupplierNote, editSupplierNote, getSupplierById,
} from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import type { BlacklistedSupplier, SupplierNote } from '../../types';
import {
  HistoryTimeline, TabCompletedOverview,
  TabROScoutingEvent, TabROSupplierInfo,
  TabROParkingOverview, TabROParkingContact, TabROParkingDetails,
  TabROPrelimOverview, TabROPrelimCapabilities,
  TabROSECompetitiveness, TabROSEFundamentals, TabROSEVisit,
  TabROIntelexRecord, TabROIntelexTimeline, TabROIntelexEfficiency,
} from './read-only-tabs';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#000000', lineHeight: 1.5, display: 'block' }}>{value}</span>
    </div>
  );
}

function CardTitle({ title }: { title: string }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>{title}</h3>
  );
}

type MainTab = 'overview' | 'scouting' | 'parking' | 'preliminary' | 'supplierEval' | 'intelex' | 'timeline';

/**
 * `minStageIndex` is the earliest working-stage index (see `stageIndex`) at
 * which this stage's data could exist. A supplier blacklisted from stage X
 * only ever populated tabs up to X, so tabs past it would just be empty —
 * these are hidden rather than shown blank. Timeline has no threshold: the
 * history log exists no matter how far the supplier got.
 */
const ALL_TABS: { id: MainTab; label: string; minStageIndex: number }[] = [
  { id: 'overview', label: 'Overview', minStageIndex: 0 },
  { id: 'scouting', label: 'Scouting', minStageIndex: 0 },
  { id: 'parking', label: 'Parking Lot', minStageIndex: 1 },
  { id: 'preliminary', label: 'Preliminary', minStageIndex: 2 },
  { id: 'supplierEval', label: 'Supplier Eval', minStageIndex: 3 },
  { id: 'intelex', label: 'Intelex Handoff', minStageIndex: 4 },
];

function SubTabBar({ tabs, active, onChange, accentColor }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; accentColor: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
            fontWeight: active === t.id ? 700 : 500,
            border: active === t.id ? `1px solid ${accentColor}` : `1px solid ${NEUTRAL_COLORS.border}`,
            backgroundColor: active === t.id ? accentColor + '15' : BRAND_COLORS.cards,
            color: active === t.id ? accentColor : BRAND_COLORS.sidebar,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function BlacklistedSupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const from = new URLSearchParams(location.search).get('from');

  const [supplier, setSupplier] = useState<BlacklistedSupplier | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<SupplierNote[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [seSubTab, setSeSubTab] = useState('competitiveness');
  const [intelexSubTab, setIntelexSubTab] = useState('record');

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setLoading(true);
    getSupplierById(supplierId)
      .then(s => {
        if (cancelled) return;
        setSupplier(s as BlacklistedSupplier | undefined);
        setNotes(s?.notes ?? []);
      })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the supplier.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplierId, toast]);

  if (loading) {
    return <LoadingState entity="Supplier" icon={moduleIcons.tracker} fill />;
  }
  if (!supplier) {
    return <p style={{ padding: 32, color: BRAND_COLORS.sidebar }}>Supplier not found.</p>;
  }
  const supplierId_ = supplier.id;

  function addNote(text: string) {
    addSupplierNote(supplierId_, text)
      .then(note => setNotes(prev => [note, ...prev]))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be added.'));
  }

  function editNote(id: string, text: string) {
    editSupplierNote(supplierId_, id, text)
      .then(updated => setNotes(prev => prev.map(n => (n.id === id ? updated : n))))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be edited.'));
  }

  function deleteNote(id: string) {
    deleteSupplierNote(supplierId_, id)
      .then(() => setNotes(prev => prev.filter(n => n.id !== id)))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be deleted.'));
  }

  // `stage` carries the stage the supplier was rejected from (see
  // supplierMapper.ts — the backend substitutes `stageBeforeExit` into `stage`
  // for blacklisted rows), so it doubles as both the "Last stage" badge value
  // and the cutoff for which tabs have data to show.
  const stageColor = getStageColor(supplier.stage);
  const reachedIndex = stageIndex(supplier.stage);
  const visibleTabs = ALL_TABS.filter(t => t.minStageIndex <= reachedIndex);
  const mainTabs = [...visibleTabs, { id: 'timeline' as const, label: 'Timeline', minStageIndex: -1 }];

  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: getStageColor('Blacklisted'),
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
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} /> Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faBan} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: 0, letterSpacing: '-0.02em' }}>{supplier.name}</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {supplier.folio} · {supplier.commodity} · {supplier.country}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12, marginTop: 4 }}>
          <button
            onClick={() => setShowNotes(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faStickyNote} style={{ fontSize: 12 }} /> Notes
            {notes.length > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {notes.length}
              </span>
            )}
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.22)', color: BRAND_COLORS.cards,
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 4,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            Blacklisted
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          {from === 'suppliers' ? (
            <Link to="/suppliers" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Suppliers</Link>
          ) : (
            <>
              <Link to="/tracker" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
              <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
              <Link to="/tracker/blacklisted" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Blacklisted</Link>
            </>
          )}
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{supplier.name}</span>
        </span>
      </nav>

      {/* Rejection Details — always visible, regardless of the active tab */}
      <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${getStageColor('Blacklisted')}`, marginBottom: 16 }}>
        <CardTitle title="Rejection Details" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <InfoRow label="Rejected by" value={supplier.rejectedBy} />
          <InfoRow label="Rejection date" value={supplier.rejectionDate} />
          <InfoRow
            label="Last stage"
            value={
              <span style={{ backgroundColor: stageColor + '1F', color: stageColor, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 3, display: 'inline-block' }}>
                {supplier.stage}
              </span>
            }
          />
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
            Rejection reason
          </span>
          <span style={{ fontSize: 13, color: '#000000', lineHeight: 1.5, display: 'block' }}>{supplier.rejectionReason}</span>
        </div>
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, marginBottom: 20, gap: 0 }}>
        {mainTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : BRAND_COLORS.sidebar,
              borderBottom: activeTab === tab.id ? `2px solid ${stageColor}` : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <TabCompletedOverview supplier={supplier} />}

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
        </div>
      )}

      {activeTab === 'supplierEval' && (
        <div>
          <SubTabBar
            tabs={[{ id: 'competitiveness', label: 'Competitiveness' }, { id: 'fundamentals', label: 'Fundamentals' }, { id: 'visit', label: 'Visit' }]}
            active={seSubTab}
            onChange={setSeSubTab}
            accentColor={stageColor}
          />
          {seSubTab === 'competitiveness' && <TabROSECompetitiveness supplier={supplier} />}
          {seSubTab === 'fundamentals' && <TabROSEFundamentals supplier={supplier} />}
          {seSubTab === 'visit' && <TabROSEVisit supplier={supplier} />}
        </div>
      )}

      {activeTab === 'intelex' && (
        <div>
          <SubTabBar
            tabs={[{ id: 'record', label: 'Record' }, { id: 'timeline', label: 'Timeline' }, { id: 'efficiency', label: 'Efficiency' }]}
            active={intelexSubTab}
            onChange={setIntelexSubTab}
            accentColor={stageColor}
          />
          {intelexSubTab === 'record' && <TabROIntelexRecord supplier={supplier} />}
          {intelexSubTab === 'timeline' && <TabROIntelexTimeline supplier={supplier} />}
          {intelexSubTab === 'efficiency' && <TabROIntelexEfficiency supplier={supplier} />}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <HistoryTimeline history={supplier.history} />
        </div>
      )}

      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date, tag: n.stage }))}
          currentUserName={user?.displayName ?? ''}
          currentUserId={user?.id}
          accentColor={getStageColor('Blacklisted')}
          onAdd={addNote}
          onEdit={editNote}
          onDelete={deleteNote}
          onClose={() => setShowNotes(false)}
        />
      )}
    </div>
  );
}
