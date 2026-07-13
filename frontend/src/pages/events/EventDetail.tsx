import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { scoutingEvents } from '../../data/events-demo';
import type { ScoutingEvent, B2BStatus, EventStatus, EventNote } from '../../types';
import { pipelineSuppliers, blacklistedSuppliers } from '../../data/pipeline-demo';
import { NotesSidePanel } from '../../components/NotesSidePanel';
import { CURRENT_USER } from '../../constants/currentUser';

const b2bStatusColors: Record<B2BStatus, string> = {
  Accepted: '#6ABF4B',
  Rejected: '#DC0202',
  Cancelled: '#808285',
};

const statusColors: Record<EventStatus, string> = {
  Ongoing: '#0084C0',
  Upcoming: '#EC4899',
  Completed: '#6ABF4B',
  Canceled: '#000000',
};
const eventStatusOptions: EventStatus[] = ['Upcoming', 'Ongoing', 'Completed', 'Canceled'];

type TabId = 'general' | 'suppliers';

function getSupplierName(id: string): string {
  const all = [...pipelineSuppliers, ...blacklistedSuppliers];
  return all.find(s => s.id === id)?.name || 'Unknown';
}

function getSupplierCommodity(id: string): string {
  const all = [...pipelineSuppliers, ...blacklistedSuppliers];
  return all.find(s => s.id === id)?.commodity || '—';
}

function TabGeneralInfo({ event }: { event: ScoutingEvent }) {
  const infoItems = [
    { label: 'Organizer', value: event.organizer },
    { label: 'Registered suppliers', value: String(event.suppliersRegistered) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Description */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#000000', margin: '0 0 8px' }}>Description</h3>
        <p style={{ fontSize: 13, color: '#333333', margin: 0, lineHeight: 1.6 }}>{event.description}</p>
      </div>

      {/* Objective */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#000000', margin: '0 0 8px' }}>Objective</h3>
        <p style={{ fontSize: 13, color: '#333333', margin: 0, lineHeight: 1.6 }}>{event.objective}</p>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {infoItems.map(item => (
          <div key={item.label} style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: 11, color: '#808285', fontWeight: 500 }}>{item.label}</span>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#000000', margin: '4px 0 0' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabSuppliers({ event }: { event: ScoutingEvent }) {
  const navigate = useNavigate();
  if (event.supplierEntries.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#808285', fontSize: 14 }}>
        No suppliers registered for this event.
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#F7F7F7', borderBottom: '1px solid #E0E0E0' }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Supplier</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Commodity</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>B2B</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {event.supplierEntries.map((entry, i) => (
            <tr key={entry.supplierId + i} style={{ borderBottom: '1px solid #F0F0F0' }}>
              <td style={{ padding: '10px 16px' }}>
                <button
                  onClick={() => navigate(`/suppliers/supplier/${entry.supplierId}`)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#0084C0', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {getSupplierName(entry.supplierId)}
                </button>
              </td>
              <td style={{ padding: '10px 16px', color: '#333333' }}>
                {getSupplierCommodity(entry.supplierId)}
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: entry.b2bMeeting ? '#6ABF4B15' : '#80828515',
                  color: entry.b2bMeeting ? '#6ABF4B' : '#808285',
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
                  backgroundColor: entry.result === 'Included' ? '#6ABF4B15' : '#DC020215',
                  color: entry.result === 'Included' ? '#6ABF4B' : '#DC0202',
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
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const event = scoutingEvents.find(e => e.id === eventId);

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<EventNote[]>(event?.notes ?? []);
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'Upcoming');

  if (!event) {
    return <p style={{ padding: 32, color: '#808285' }}>Event not found.</p>;
  }

  function changeStatus(newStatus: EventStatus) {
    const idx = scoutingEvents.findIndex(e => e.id === event!.id);
    if (idx !== -1) scoutingEvents[idx].status = newStatus;
    setStatus(newStatus);
  }

  function addNote(text: string) {
    const newNote: EventNote = {
      id: `n-${Date.now()}`,
      author: CURRENT_USER.name,
      role: CURRENT_USER.role,
      text,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    const idx = scoutingEvents.findIndex(e => e.id === event!.id);
    if (idx !== -1) scoutingEvents[idx].notes.unshift(newNote);
    setNotes(prev => [newNote, ...prev]);
  }

  function editNote(id: string, text: string) {
    const idx = scoutingEvents.findIndex(e => e.id === event!.id);
    if (idx !== -1) {
      const target = scoutingEvents[idx].notes.find(n => n.id === id);
      if (target) target.text = text;
    }
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, text } : n)));
  }

  function deleteNote(id: string) {
    const idx = scoutingEvents.findIndex(e => e.id === event!.id);
    if (idx !== -1) scoutingEvents[idx].notes = scoutingEvents[idx].notes.filter(n => n.id !== id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'General Information' },
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
            </button>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {event.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {event.type} · {event.location} · {formatDate(startDate)} – {formatDate(endDate)}
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
            backgroundColor: '#FFFFFF', color: statusColors[status],
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>
            {status}
          </span>
        </div>
      </div>

      <nav style={{ margin: '16px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', padding: 0, color: '#0084C0', fontWeight: 500, fontSize: 12, cursor: 'pointer' }}
          >
            Events
          </button>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{event.name}</span>
        </span>
        <select
          value={status}
          onChange={e => changeStatus(e.target.value as EventStatus)}
          style={{
            fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 4,
            backgroundColor: '#FFFFFF', color: statusColors[status],
            border: `1px solid ${statusColors[status]}`, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          }}
        >
          {eventStatusOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </nav>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E0E0E0', marginBottom: 20, gap: 0 }}>
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
      {activeTab === 'general' && <TabGeneralInfo event={event} />}
      {activeTab === 'suppliers' && <TabSuppliers event={event} />}

      {showNotes && (
        <NotesSidePanel
          title="Notes"
          notes={notes.map(n => ({ id: n.id, text: n.text, author: n.author, role: n.role, date: n.date }))}
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
