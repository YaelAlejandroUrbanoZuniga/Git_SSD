import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { scoutingEvents } from '../../data/events-demo';
import type { ScoutingEvent } from '../../types';

interface Props {
  onClose: () => void;
}

interface FormState {
  name: string;
  location: string;
  dateStart: string;
  dateEnd: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface TouchedState {
  name: boolean;
  location: boolean;
  dateStart: boolean;
  dateEnd: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid #DC0202',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, color: '#808285', display: 'block', marginBottom: 4,
};

export function NewEventModal({ onClose }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '', location: '', dateStart: '', dateEnd: '',
    contactName: '', contactEmail: '', contactPhone: '',
  });
  const [touched, setTouched] = useState<TouchedState>({
    name: false, location: false, dateStart: false, dateEnd: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function isRequired(field: keyof TouchedState) {
    return !form[field].trim();
  }

  function showError(field: keyof TouchedState) {
    return isRequired(field) && (touched[field] || submitAttempted);
  }

  function handleBlur(field: keyof TouchedState) {
    setTouched(prev => ({ ...prev, [field]: true }));
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    if (isRequired('name') || isRequired('location') || isRequired('dateStart') || isRequired('dateEnd')) {
      return;
    }
    const newEvent: ScoutingEvent = {
      id: 'evt' + (scoutingEvents.length + 1),
      name: form.name.trim(),
      location: form.location.trim(),
      dateStart: form.dateStart,
      dateEnd: form.dateEnd,
      organizer: 'SSD Team',
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      status: 'Upcoming',
      type: 'Direct',
      description: '',
      objective: '',
      topCommodity: '—',
      topCountry: '—',
      suppliersRegistered: 0,
      supplierEntries: [],
      b2bMeetings: [],
    };
    scoutingEvents.push(newEvent);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        {/* Header */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>New Event</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a new scouting event</p>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event Name */}
          <div>
            <label style={labelStyle}>Event Name <span style={{ color: '#DC0202' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Automotive Supplier Summit 2026"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onBlur={() => handleBlur('name')}
              style={showError('name') ? inputErrorStyle : inputStyle}
            />
            {showError('name') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Event name is required.</span>}
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location <span style={{ color: '#DC0202' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. CDMX, Mexico"
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              onBlur={() => handleBlur('location')}
              style={showError('location') ? inputErrorStyle : inputStyle}
            />
            {showError('location') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Location is required.</span>}
          </div>

          {/* Start / End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date <span style={{ color: '#DC0202' }}>*</span></label>
              <input
                type="date"
                value={form.dateStart}
                onChange={e => setForm(p => ({ ...p, dateStart: e.target.value }))}
                onBlur={() => handleBlur('dateStart')}
                style={showError('dateStart') ? inputErrorStyle : inputStyle}
              />
              {showError('dateStart') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Start date is required.</span>}
            </div>
            <div>
              <label style={labelStyle}>End Date <span style={{ color: '#DC0202' }}>*</span></label>
              <input
                type="date"
                value={form.dateEnd}
                onChange={e => setForm(p => ({ ...p, dateEnd: e.target.value }))}
                onBlur={() => handleBlur('dateEnd')}
                style={showError('dateEnd') ? inputErrorStyle : inputStyle}
              />
              {showError('dateEnd') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>End date is required.</span>}
            </div>
          </div>

          {/* Contact Name */}
          <div>
            <label style={labelStyle}>Contact Name</label>
            <input
              type="text"
              placeholder="Person responsible for this event"
              value={form.contactName}
              onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Contact Email */}
          <div>
            <label style={labelStyle}>Contact Email</label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label style={labelStyle}>Contact Phone</label>
            <input
              type="tel"
              value={form.contactPhone}
              onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '0.5px solid #D1D3D4', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#B80000')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#DC0202')}
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}
