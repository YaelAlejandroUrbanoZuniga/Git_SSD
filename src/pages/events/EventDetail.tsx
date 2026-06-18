import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faMapMarkerAlt, faCalendarAlt, faUsers, faBuilding, faCheckCircle, faTimesCircle, faBan } from '@fortawesome/free-solid-svg-icons';
import { scoutingEvents } from '../../data/events-demo';
import type { ScoutingEvent, EventStatus, B2BStatus } from '../../types';
import { pipelineSuppliers, blacklistedSuppliers } from '../../data/pipeline-demo';

const statusColors: Record<EventStatus, string> = {
  Upcoming: '#02B3E1',
  Ongoing: '#6ABF4B',
  Completed: '#6B7280',
};

const b2bStatusColors: Record<B2BStatus, string> = {
  Accepted: '#6ABF4B',
  Rejected: '#DC0202',
  Cancelled: '#808285',
};

const b2bStatusIcons: Record<B2BStatus, typeof faCheckCircle> = {
  Accepted: faCheckCircle,
  Rejected: faTimesCircle,
  Cancelled: faBan,
};

type TabId = 'general' | 'suppliers' | 'agenda';

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
    { label: 'Type', value: event.type },
    { label: 'Top Commodity', value: event.topCommodity },
    { label: 'Top Country', value: event.topCountry },
    { label: 'Registered suppliers', value: String(event.suppliersRegistered) },
    { label: 'B2B Meetings', value: String(event.b2bMeetings.length) },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
              <td style={{ padding: '10px 16px', fontWeight: 500, color: '#000000' }}>
                {getSupplierName(entry.supplierId)}
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

function TabAgendaB2B({ event }: { event: ScoutingEvent }) {
  if (event.b2bMeetings.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#808285', fontSize: 14 }}>
        No B2B meetings scheduled for this event.
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#F7F7F7', borderBottom: '1px solid #E0E0E0' }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Time</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Stand</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Company</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Commodity</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Manager</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Buyer</th>
            <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 600, color: '#333333' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {event.b2bMeetings.map((meeting, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500, color: '#000000', whiteSpace: 'nowrap' }}>
                {meeting.time}
              </td>
              <td style={{ padding: '10px 16px', color: '#333333' }}>
                {meeting.stand}
              </td>
              <td style={{ padding: '10px 16px', fontWeight: 500, color: '#000000' }}>
                {meeting.companyName}
              </td>
              <td style={{ padding: '10px 16px', color: '#333333' }}>
                {meeting.commodity}
              </td>
              <td style={{ padding: '10px 16px', color: '#333333' }}>
                {meeting.attendeeManager}
              </td>
              <td style={{ padding: '10px 16px', color: '#333333' }}>
                {meeting.attendeeBuyer}
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: b2bStatusColors[meeting.status] + '15',
                  color: b2bStatusColors[meeting.status],
                }}>
                  <FontAwesomeIcon icon={b2bStatusIcons[meeting.status]} style={{ fontSize: 10 }} />
                  {meeting.status}
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

  if (!event) {
    return <p style={{ padding: 32, color: '#808285' }}>Event not found.</p>;
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'General Information' },
    { id: 'suppliers', label: 'Event Suppliers' },
    { id: 'agenda', label: 'B2B Agenda' },
  ];

  const startDate = new Date(event.dateStart + 'T00:00:00');
  const endDate = new Date(event.dateEnd + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatDate(d: Date) {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/events')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Back
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/events" style={{ color: '#0084C0', textDecoration: 'none' }}>Events</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#000000' }}>{event.name}</span>
        </span>
      </nav>

      {/* Event header */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 10px' }}>{event.name}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#808285' }}>
                <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: 11 }} />
                {formatDate(startDate)} – {formatDate(endDate)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#808285' }}>
                <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 11 }} />
                {event.location}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#808285' }}>
                <FontAwesomeIcon icon={faBuilding} style={{ fontSize: 11 }} />
                {event.organizer}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#808285' }}>
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: 11 }} />
                {event.suppliersRegistered} suppliers
              </span>
            </div>
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 4,
            backgroundColor: statusColors[event.status] + '15',
            color: statusColors[event.status],
            flexShrink: 0,
          }}>
            {event.status}
          </span>
        </div>
      </div>

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
      {activeTab === 'agenda' && <TabAgendaB2B event={event} />}
    </div>
  );
}
