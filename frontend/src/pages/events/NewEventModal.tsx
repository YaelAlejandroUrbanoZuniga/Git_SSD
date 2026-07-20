import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import type { ScoutingEvent, EventType } from '../../types';
import { createEvent } from '../../services/eventsService';
import { ApiError } from '../../services/api.config';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CatalogSelect } from '../../components/CatalogSelect';
import { modalPanelStyle } from '../../components/modalPanelStyle';
import { PRODUCT_CATEGORIES } from '../../constants/catalogs';
import { useToast } from '../../context/ToastContext';
import { useModalTransition } from '../../hooks/useModalTransition';

interface Props {
  onClose: () => void;
  /** Called after the event is created so the caller can refresh its list. */
  onCreated?: () => void;
}

interface FormState {
  name: string;
  location: string;
  dateStart: string;
  dateEnd: string;
  productCategory: EventType | '';
  description: string;
  objective: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface TouchedState {
  name: boolean;
  location: boolean;
  dateStart: boolean;
  dateEnd: boolean;
  productCategory: boolean;
  description: boolean;
  objective: boolean;
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

export function NewEventModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '', location: '', dateStart: '', dateEnd: '',
    productCategory: '', description: '', objective: '',
    contactName: '', contactEmail: '', contactPhone: '',
  });
  const [touched, setTouched] = useState<TouchedState>({
    name: false, location: false, dateStart: false, dateEnd: false,
    productCategory: false, description: false, objective: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const FIELD_LABELS: Record<keyof TouchedState, string> = {
    name: 'Event Name', location: 'Location', dateStart: 'Start Date', dateEnd: 'End Date',
    productCategory: 'Product Category', description: 'Description', objective: 'Objective',
  };

  function isRequired(field: keyof TouchedState) {
    return !form[field].trim();
  }

  function showError(field: keyof TouchedState) {
    return isRequired(field) && (touched[field] || submitAttempted);
  }

  function handleBlur(field: keyof TouchedState) {
    setTouched(prev => ({ ...prev, [field]: true }));
  }

  /** Inline errors mark the fields; the toast says what to do about them. */
  function handleSubmit() {
    setSubmitAttempted(true);

    const empty = (Object.keys(FIELD_LABELS) as (keyof TouchedState)[])
      .filter(isRequired)
      .map(f => FIELD_LABELS[f]);
    if (empty.length > 0) {
      toast.validationError(
        'Missing required information',
        empty.length === 1
          ? `"${empty[0]}" is required. Fill it in and create the event again.`
          : `These required fields are empty: ${empty.map(f => `"${f}"`).join(', ')}.`,
      );
      return;
    }

    if (form.dateEnd < form.dateStart) {
      toast.validationError(
        'Check this before saving',
        '"End Date" cannot be earlier than "Start Date". Correct the dates and try again.',
      );
      return;
    }

    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      toast.validationError(
        'Check this before saving',
        '"Contact Email" is not a valid email address. Use the format name@company.com.',
      );
      return;
    }

    setConfirming(true);
  }

  async function handleCreate() {
    setConfirming(false);
    setSaving(true);
    const payload: Partial<ScoutingEvent> = {
      name: form.name.trim(),
      location: form.location.trim(),
      dateStart: form.dateStart,
      dateEnd: form.dateEnd,
      organizer: 'SSD Team',
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      status: 'Upcoming',
      type: form.productCategory as EventType,
      description: form.description.trim(),
      objective: form.objective.trim(),
      topCommodity: '—',
      topCountry: '—',
    };
    try {
      const created = await createEvent(payload);
      toast.success(`Event "${created.name}" created`, `Scheduled in ${created.location} from ${created.dateStart} to ${created.dateEnd}.`);
      onCreated?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this event', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The event could not be created.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={requestClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...modalPanelStyle('#04BF6E'), width: 560, position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={requestClose}
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

          {/* Product Category */}
          <div>
            <label style={labelStyle}>Product Category <span style={{ color: '#DC0202' }}>*</span></label>
            <CatalogSelect
              value={form.productCategory}
              onChange={v => setForm(p => ({ ...p, productCategory: v as EventType | '' }))}
              options={PRODUCT_CATEGORIES}
              placeholder="Select category"
              style={showError('productCategory') ? { border: '1px solid #DC0202' } : undefined}
            />
            {showError('productCategory') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Product category is required.</span>}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description <span style={{ color: '#DC0202' }}>*</span></label>
            <textarea
              rows={3}
              placeholder="What is this event about?"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              onBlur={() => handleBlur('description')}
              style={{ ...(showError('description') ? inputErrorStyle : inputStyle), resize: 'vertical', fontFamily: 'inherit' }}
            />
            {showError('description') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Description is required.</span>}
          </div>

          {/* Objective */}
          <div>
            <label style={labelStyle}>Objective <span style={{ color: '#DC0202' }}>*</span></label>
            <textarea
              rows={3}
              placeholder="What does SSD want to get out of it?"
              value={form.objective}
              onChange={e => setForm(p => ({ ...p, objective: e.target.value }))}
              onBlur={() => handleBlur('objective')}
              style={{ ...(showError('objective') ? inputErrorStyle : inputStyle), resize: 'vertical', fontFamily: 'inherit' }}
            />
            {showError('objective') && <span style={{ fontSize: 12, color: '#DC0202', marginTop: 4, display: 'block' }}>Objective is required.</span>}
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
            onClick={requestClose}
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

      {confirming && (
        <ConfirmDialog
          title="Create this event?"
          message={<>This registers <strong style={{ color: '#000000' }}>{form.name.trim()}</strong> as a new scouting event in {form.location.trim()}.</>}
          confirmLabel={saving ? 'Creating…' : 'Create Event'}
          confirmDisabled={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}
