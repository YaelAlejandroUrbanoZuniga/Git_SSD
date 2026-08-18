import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faStickyNote, faPen, faUsers } from '@fortawesome/free-solid-svg-icons';
import type { ScoutingEvent, B2BStatus, EventStatus, EventNote } from '../../types';
import {
  addEventNote, deleteEventNote, editEventNote, getEventById, updateEvent,
} from '../../services/eventsService';
import { getSuppliers } from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { moduleIcons } from '../../components/moduleIcons';
import { useAuth } from '../../context/AuthContext';
import { EventFormModal } from './EventFormModal';
import { TabProspects } from './TabProspects';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

/** supplierId → { name, commodity }, for the event's supplier table. */
type SupplierIndex = Map<string, { name: string; commodity: string }>;

const b2bStatusColors: Record<B2BStatus, string> = {
  Accepted: '#6ABF4B',
  Rejected: BRAND_COLORS.accentRed,
  Cancelled: BRAND_COLORS.sidebar,
};

const statusColors: Record<EventStatus, string> = {
  Ongoing: ACCENT_COLORS.info,
  Upcoming: '#EC4899',
  Completed: '#6ABF4B',
  Canceled: '#000000',
};
const eventStatusOptions: EventStatus[] = ['Upcoming', 'Ongoing', 'Completed', 'Canceled'];

type TabId = 'general' | 'prospects' | 'suppliers';

function TabGeneralInfo({ event }: { event: ScoutingEvent }) {
  const infoItems = [
    { label: 'Organizer', value: event.organizer },
    { label: 'Registered suppliers', value: String(event.suppliersRegistered) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Description */}
      <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#000000', margin: '0 0 8px' }}>Description</h3>
        <p style={{ fontSize: 13, color: NEUTRAL_COLORS.textDark, margin: 0, lineHeight: 1.6 }}>{event.description}</p>
      </div>

      {/* Objective */}
      <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#000000', margin: '0 0 8px' }}>Objective</h3>
        <p style={{ fontSize: 13, color: NEUTRAL_COLORS.textDark, margin: 0, lineHeight: 1.6 }}>{event.objective}</p>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {infoItems.map(item => (
          <div key={item.label} style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar, fontWeight: 500 }}>{item.label}</span>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#000000', margin: '4px 0 0' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabSuppliers({ event, supplierIndex }: { event: ScoutingEvent; supplierIndex: SupplierIndex }) {
  const navigate = useNavigate();
  if (event.supplierEntries.length === 0) {
    return <EmptyState icon={faUsers} title="No suppliers" description="No suppliers registered for this event." />;
  }

  return (
    <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg, borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Supplier</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Commodity</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>B2B</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Status</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {event.supplierEntries.map((entry, i) => (
            <tr key={entry.supplierId + i} style={{ borderBottom: '1px solid #F0F0F0' }}>
              <td style={{ padding: '10px 16px' }}>
                <button
                  onClick={() => navigate(`/suppliers/supplier/${entry.supplierId}`)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ACCENT_COLORS.info, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {supplierIndex.get(entry.supplierId)?.name || 'Unknown'}
                </button>
              </td>
              <td style={{ padding: '10px 16px', color: NEUTRAL_COLORS.textDark }}>
                {supplierIndex.get(entry.supplierId)?.commodity || '—'}
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: entry.b2bMeeting ? '#6ABF4B15' : `${BRAND_COLORS.sidebar}15`,
                  color: entry.b2bMeeting ? '#6ABF4B' : BRAND_COLORS.sidebar,
                }}>
                  {entry.b2bMeeting ? 'Yes' : 'No'}
                </span>
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: b2bStatusColors[entry.status] + '15',
                  color: b2bStatusColors[entry.status],
                }}>
                  {entry.status}
                </span>
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: entry.result === 'Included' ? '#6ABF4B15' : `${BRAND_COLORS.accentRed}15`,
                  color: entry.result === 'Included' ? '#6ABF4B' : BRAND_COLORS.accentRed,
                }}>
                  {entry.result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = usePermissions();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const [event, setEvent] = useState<ScoutingEvent | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [supplierIndex, setSupplierIndex] = useState<SupplierIndex>(new Map());
  const [showNotes, setShowNotes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [status, setStatus] = useState<EventStatus>('Upcoming');

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getEventById(eventId), getSuppliers()])
      .then(([ev, suppliers]) => {
        if (cancelled) return;
        setEvent(ev);
        setNotes(ev?.notes ?? []);
        setStatus(ev?.status ?? 'Upcoming');
        setSupplierIndex(new Map(suppliers.map(s => [s.id, { name: s.name, commodity: s.commodity }])));
      })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the event.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId, toast]);

  if (loading) {
    return <LoadingState entity="Event" icon={moduleIcons.events} fill />;
  }
  if (!event) {
    return <p style={{ padding: 32, color: BRAND_COLORS.sidebar }}>Event not found.</p>;
  }
  const currentEvent = event;

  function changeStatus(newStatus: EventStatus) {
    const previous = status;
    setStatus(newStatus);
    updateEvent(currentEvent.id, { status: newStatus }).catch(err => {
      setStatus(previous);
      toast.systemError(err instanceof ApiError ? err.message : 'The status could not be updated.');
    });
  }

  function addNote(text: string) {
    addEventNote(currentEvent.id, text)
      .then(note => setNotes(prev => [note, ...prev]))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be added.'));
  }

  function editNote(id: string, text: string) {
    editEventNote(currentEvent.id, id, text)
      .then(updated => setNotes(prev => prev.map(n => (n.id === id ? updated : n))))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be edited.'));
  }

  function deleteNote(id: string) {
    deleteEventNote(currentEvent.id, id)
      .then(() => setNotes(prev => prev.filter(n => n.id !== id)))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The note could not be deleted.'));
  }

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'general', label: 'General Information' },
    { id: 'prospects', label: 'Prospects', badge: event.prospectsRegistered },
    { id: 'suppliers', label: 'Event Suppliers' },
  ];

  const startDate = new Date(event.dateStart + 'T00:00:00');
  const endDate = new Date(event.dateEnd + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatDate(d: Date) {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <div>
      {/* ── Event Hero Header ─────────────────────────────────── */}
      <div style={{
        backgroundColor: '#04BF6E',
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
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
            </button>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {event.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {event.type} · {event.location} · {formatDate(startDate)} – {formatDate(endDate)}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 12, marginTop: 4 }}>
          {role === 'SSD' && (
            <button
              onClick={() => setShowEdit(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 12 }} /> Edit
            </button>
          )}
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
            backgroundColor: BRAND_COLORS.cards, color: statusColors[status],
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>
            {status}
          </span>
        </div>
      </div>

      <nav style={{ margin: '16px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', padding: 0, color: ACCENT_COLORS.info, fontWeight: 500, fontSize: 12, cursor: 'pointer' }}
          >
            Events
          </button>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{event.name}</span>
        </span>
        {/* Changing the event status is a write, gated exactly like the Edit button
            above (`role === 'SSD'`, not the coarser `canWrite` — PM/Buyer can view
            events but not edit them). Everyone else still sees the current status:
            it is rendered as a badge in the header block above. Without this gate a
            PM/Buyer/SQD got a fully interactive dropdown whose every use produced an
            optimistic change, a 403, a silent revert and a "technical problem" toast. */}
        {role === 'SSD' && (
          <select
            value={status}
            onChange={e => changeStatus(e.target.value as EventStatus)}
            style={{
              fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 4,
              backgroundColor: BRAND_COLORS.cards, color: statusColors[status],
              border: `1px solid ${statusColors[status]}`, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            }}
          >
            {eventStatusOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </nav>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, marginBottom: 20, gap: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : BRAND_COLORS.sidebar,
              borderBottom: activeTab === tab.id ? `2px solid ${BRAND_COLORS.accentRed}` : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
            {!!tab.badge && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                backgroundColor: activeTab === tab.id ? BRAND_COLORS.accentRed : NEUTRAL_COLORS.borderLight,
                color: activeTab === tab.id ? BRAND_COLORS.cards : NEUTRAL_COLORS.textDark,
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <TabGeneralInfo event={event} />}
      {activeTab === 'prospects' && (
        <TabProspects
          eventId={event.id}
          eventName={event.name}
          onCountChange={total => setEvent(prev => (prev ? { ...prev, prospectsRegistered: total } : prev))}
        />
      )}
      {activeTab === 'suppliers' && <TabSuppliers event={event} supplierIndex={supplierIndex} />}

      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date }))}
          currentUserName={user?.displayName ?? ''}
          currentUserId={user?.id}
          accentColor="#04BF6E"
          onAdd={addNote}
          onEdit={editNote}
          onDelete={deleteNote}
          onClose={() => setShowNotes(false)}
        />
      )}

      {showEdit && (
        <EventFormModal
          event={currentEvent}
          onClose={() => setShowEdit(false)}
          onUpdated={updated => {
            setEvent(updated);
            setStatus(updated.status);
          }}
        />
      )}
    </div>
  );
}
