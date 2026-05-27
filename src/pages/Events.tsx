import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faUsers, faXmark } from '@fortawesome/free-solid-svg-icons';
import { events, Event } from '../data/demo';

const statusBadge: Record<string, { bg: string; text: string }> = {
  Upcoming:  { bg: '#02B3E126', text: '#02B3E1' },
  Ongoing:   { bg: '#D4A01726', text: '#D4A017' },
  Completed: { bg: '#6ABF4B26', text: '#6ABF4B' },
};

function EventModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const badge = statusBadge[event.status];
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: 480, borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
          maxHeight: '80vh', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '1px solid #E0E0E0' }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{event.name}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#808285',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 16 }} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Location',  value: event.location },
              { label: 'Date',      value: event.date },
              { label: 'Organizer', value: event.organizer },
              { label: 'Suppliers', value: `${event.supplierCount} registered` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#000000', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 6px' }}>Status</p>
            <span style={{ backgroundColor: badge.bg, color: badge.text, fontSize: 11, fontWeight: 500, padding: '3px 7px', borderRadius: 4 }}>
              {event.status}
            </span>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 6px' }}>Description</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
              Event details placeholder — agenda, attendees, and logistics will be shown here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Events() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  return (
    <div>
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Scouting Events</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Gestión de eventos donde se conocen proveedores
          </p>
        </div>
        <button
          className="btn-primary"
          style={{
            backgroundColor: '#DC0202', color: '#FFFFFF',
            fontWeight: 700, fontSize: 14,
            padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: 'pointer',
            transition: 'box-shadow 0.15s ease-out',
          }}
        >
          + New Event
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ maxWidth: 320, flex: '1 1 0' }}>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }}
          />
          <input
            type="text"
            placeholder="Buscar evento..."
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              border: '1px solid #E0E0E0', borderRadius: 6,
              fontSize: 13, color: '#000000',
              backgroundColor: '#FFFFFF', outline: 'none',
            }}
          />
        </div>
        {['Upcoming', 'Ongoing', 'Completed'].map((s) => (
          <button
            key={s}
            style={{
              padding: '8px 12px', border: '1px solid #E0E0E0',
              borderRadius: 8, fontSize: 13, color: '#000000',
              backgroundColor: '#FFFFFF', cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((event) => {
          const badge = statusBadge[event.status];
          return (
            <div
              key={event.id}
              className="bg-white card-hover flex items-center"
              style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, gap: 20 }}
            >
              {/* Date block */}
              <div
                className="flex flex-col items-center justify-center shrink-0"
                style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#DC0202' }}
              >
                <span style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                  {event.month}
                </span>
                <span style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
                  {event.day}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 600, fontSize: 15, color: '#000000', margin: '0 0 4px' }}>{event.name}</h3>
                <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>{event.location} · {event.organizer}</p>
              </div>

              {/* Right */}
              <div className="flex items-center" style={{ gap: 16 }}>
                <span className="flex items-center" style={{ gap: 6, fontSize: 13, color: '#808285' }}>
                  <FontAwesomeIcon icon={faUsers} style={{ fontSize: 13 }} />
                  {event.supplierCount}
                </span>
                <span style={{ backgroundColor: badge.bg, color: badge.text, fontSize: 11, fontWeight: 500, padding: '3px 7px', borderRadius: 4 }}>
                  {event.status}
                </span>
                <button
                  onClick={() => setSelectedEvent(event)}
                  style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Ver detalles
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
