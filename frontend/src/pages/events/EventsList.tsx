import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronLeft, faChevronRight, faMapMarkerAlt, faUsers, faCalendarAlt, faMagnifyingGlass, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { scoutingEvents } from '../../data/events-demo';
import type { ScoutingEvent, EventStatus } from '../../types';
import { NewEventModal } from './NewEventModal';

const statusColors: Record<EventStatus, string> = {
  Upcoming: '#02B3E1',
  Ongoing: '#6ABF4B',
  Completed: '#6B7280',
};

type FilterChip = 'All' | EventStatus;

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${s.getFullYear()}`;
}

function EventCard({ event, onClick }: { event: ScoutingEvent; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const startDate = new Date(event.dateStart + 'T00:00:00');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 16,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        cursor: 'pointer',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Date block */}
      <div style={{
        minWidth: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: statusColors[event.status] + '12',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${statusColors[event.status]}30`,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: statusColors[event.status], lineHeight: 1.1 }}>
          {startDate.getDate()}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColors[event.status], letterSpacing: 0.5 }}>
          {months[startDate.getMonth()]}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#000000', margin: 0, lineHeight: 1.3 }}>
            {event.name}
          </h3>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: statusColors[event.status] + '15',
            color: statusColors[event.status],
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {event.status}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#808285' }}>
            <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: 10 }} />
            {formatDateRange(event.dateStart, event.dateEnd)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#808285' }}>
            <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 10 }} />
            {event.location}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#808285' }}>
            <FontAwesomeIcon icon={faUsers} style={{ fontSize: 10 }} />
            {event.suppliersRegistered} suppliers
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({ events }: { events: ScoutingEvent[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 5, 1));

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const daysInMonth = lastDay.getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const eventDayColors = useMemo(() => {
    const map: Record<number, string> = {};
    events.forEach(evt => {
      const start = new Date(evt.dateStart + 'T00:00:00');
      const end = new Date(evt.dateEnd + 'T00:00:00');
      if (start.getFullYear() === year || end.getFullYear() === year) {
        const iterDate = new Date(Math.max(start.getTime(), new Date(year, month, 1).getTime()));
        const endDate = new Date(Math.min(end.getTime(), new Date(year, month + 1, 0).getTime()));
        while (iterDate <= endDate) {
          if (iterDate.getMonth() === month) {
            map[iterDate.getDate()] = statusColors[evt.status];
          }
          iterDate.setDate(iterDate.getDate() + 1);
        }
      }
    });
    return map;
  }, [events, year, month]);

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#808285' }}>
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 12 }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#000000' }}>
          {monthNames[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#808285' }}>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12 }} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {dayNames.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#808285', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const color = eventDayColors[day];
          return (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: color ? 600 : 400,
                color: color || '#333333',
                padding: '6px 0',
                borderRadius: 4,
                backgroundColor: color ? color + '15' : 'transparent',
                position: 'relative',
              }}
            >
              {day}
              {color && (
                <div style={{
                  position: 'absolute',
                  bottom: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: color,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(['Upcoming', 'Ongoing', 'Completed'] as EventStatus[]).map(status => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColors[status] }} />
            <span style={{ fontSize: 11, color: '#808285' }}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusFilterDropdown({ value, onChange }: { value: FilterChip; onChange: (v: FilterChip) => void }) {
  const options: FilterChip[] = ['All', 'Upcoming', 'Ongoing', 'Completed'];
  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as FilterChip)}
        style={{
          appearance: 'none', WebkitAppearance: 'none', padding: '8px 32px 8px 12px',
          border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: '#000000',
          backgroundColor: '#FFFFFF', cursor: 'pointer', outline: 'none',
        }}
      >
        {options.map(o => <option key={o} value={o}>{o === 'All' ? 'All statuses' : o}</option>)}
      </select>
      <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
    </div>
  );
}

export function EventsList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterChip>('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filteredEvents = useMemo(() => {
    const sorted = [...scoutingEvents].sort((a, b) => {
      const order: Record<EventStatus, number> = { Ongoing: 0, Upcoming: 1, Completed: 2 };
      return order[a.status] - order[b.status] || new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime();
    });
    let result = filter === 'All' ? sorted : sorted.filter(e => e.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return result;
  }, [filter, search]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0 }}>Events</h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>Scouting event management</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            backgroundColor: '#DC0202', color: '#FFFFFF',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#B80000')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#DC0202')}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} />
          New Event
        </button>
      </div>

      {/* Search + filter row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 360 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text"
            placeholder="Search event, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
        <StatusFilterDropdown value={filter} onChange={setFilter} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Event cards - 65% */}
        <div style={{ flex: '0 0 65%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#808285', fontSize: 14 }}>
              No events for this filter.
            </div>
          ) : (
            filteredEvents.map(evt => (
              <EventCard
                key={evt.id}
                event={evt}
                onClick={() => navigate(`/events/${evt.id}`)}
              />
            ))
          )}
        </div>

        {/* Mini calendar - 35% */}
        <div style={{ flex: '0 0 calc(35% - 24px)' }}>
          <MiniCalendar events={scoutingEvents} />
        </div>
      </div>

      {showModal && <NewEventModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
