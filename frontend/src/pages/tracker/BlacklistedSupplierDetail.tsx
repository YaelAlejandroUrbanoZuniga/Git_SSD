import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBan, faArrowUpRightFromSquare, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { getStageColor } from '../../utils/tracker-helpers';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { LoadingState } from '../../components/LoadingState';
import { CURRENT_USER } from '../../constants/currentUser';
import {
  addSupplierNote, deleteSupplierNote, editSupplierNote, getSupplierById,
} from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import type { BlacklistedSupplier, SupplierNote } from '../../types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
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

export function BlacklistedSupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = new URLSearchParams(location.search).get('from');

  const [supplier, setSupplier] = useState<BlacklistedSupplier | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<SupplierNote[]>([]);

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
    return <LoadingState entity="Supplier" />;
  }
  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
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

  const stageColor = getStageColor(supplier.stage);

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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} /> Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faBan} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>{supplier.name}</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {supplier.folio} · {supplier.commodity} · {supplier.country}
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
            backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF',
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 4,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            Blacklisted
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          {from === 'suppliers' ? (
            <Link to="/suppliers" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Suppliers</Link>
          ) : (
            <>
              <Link to="/tracker" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
              <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
              <Link to="/tracker/blacklisted" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Blacklisted</Link>
            </>
          )}
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{supplier.name}</span>
        </span>
      </nav>

      {/* Card 1 — Rejection Details */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${getStageColor('Blacklisted')}`, marginBottom: 16 }}>
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
          <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
            Rejection reason
          </span>
          <span style={{ fontSize: 13, color: '#000000', lineHeight: 1.5, display: 'block' }}>{supplier.rejectionReason}</span>
        </div>
      </div>

      {/* Cards 2 & 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Card 2 — Company Information */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <CardTitle title="Company Information" />
          <InfoRow label="Folio" value={supplier.folio} />
          <InfoRow label="Company" value={supplier.fullName} />
          <InfoRow label="Commodity" value={supplier.commodity} />
          <InfoRow label="Product type" value={supplier.productType} />
          {supplier.entrySource === 'Scouting Event' && supplier.scoutingInput && (
            <InfoRow label="Scouting input" value={supplier.scoutingInput} />
          )}
          {supplier.intelex_investigateRecordNumber && (
            <InfoRow label="Investigation record" value={supplier.intelex_investigateRecordNumber} />
          )}
          <InfoRow label="Buyer" value={supplier.buyer} />
        </div>

        {/* Card 3 — Contact */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <CardTitle title="Contact" />
          <InfoRow label="Contact name" value={supplier.contactName} />
          <InfoRow
            label="Email"
            value={
              <a href={`mailto:${supplier.contactEmail}`} style={{ color: '#0084C0', textDecoration: 'none' }}>
                {supplier.contactEmail}
              </a>
            }
          />
          <InfoRow label="Phone" value={supplier.phone} />
          <InfoRow
            label="Website"
            value={
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" style={{ color: '#02B3E1', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {supplier.website}
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 10 }} />
              </a>
            }
          />
        </div>
      </div>

      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date, tag: n.stage }))}
          currentUserName={CURRENT_USER.name}
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
