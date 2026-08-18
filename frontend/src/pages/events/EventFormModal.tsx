import { useState } from 'react';
import type { ScoutingEvent, EventType } from '../../types';
import { createEvent, updateEvent } from '../../services/eventsService';
import { ApiError } from '../../services/api.config';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../../components/modalPanelStyle';
import { useToast } from '../../context/ToastContext';
import { useModalTransition } from '../../hooks/useModalTransition';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';
import { isValidEmail } from '../tracker/supplier-forms/payload';

interface Props {
  onClose: () => void;
  /** Called after the event is created so the caller can refresh its list. */
  onCreated?: () => void;
  /** When provided, the modal opens pre-filled in edit mode instead of create mode. */
  event?: ScoutingEvent;
  /** Called with the freshly-saved event after a successful edit. */
  onUpdated?: (updated: ScoutingEvent) => void;
}

interface FormState {
  name: string;
  location: string;
  dateStart: string;
  dateEnd: string;
  description: string;
  objective: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  type: EventType;
}

// Only the genuinely-required fields live here. description and objective are
// captured manually after the event exists (GSM), so they are optional now.
interface TouchedState {
  name: boolean;
  location: boolean;
  dateStart: boolean;
  dateEnd: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: BRAND_COLORS.cards,
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: `1px solid ${BRAND_COLORS.accentRed}`,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 4,
};

function formStateFrom(event?: ScoutingEvent): FormState {
  return {
    name: event?.name ?? '',
    location: event?.location ?? '',
    dateStart: event?.dateStart ?? '',
    dateEnd: event?.dateEnd ?? '',
    description: event?.description ?? '',
    objective: event?.objective ?? '',
    contactName: event?.contactName ?? '',
    contactEmail: event?.contactEmail ?? '',
    contactPhone: event?.contactPhone ?? '',
    // Defaults to Direct for a new event — the overwhelming majority — but is a
    // real, editable field now instead of a literal baked into the create
    // payload and omitted from the edit patch. The backend has always accepted
    // both values (`eventSchema.type: z.enum(['Direct','Indirect'])`) and the
    // event header displays the type, so it was shown but never settable.
    type: event?.type ?? 'Direct',
  };
}

export function EventFormModal({ onClose, onCreated, event, onUpdated }: Props) {
  const isEdit = !!event;
  const [form, setForm] = useState<FormState>(() => formStateFrom(event));
  const [touched, setTouched] = useState<TouchedState>({
    name: false, location: false, dateStart: false, dateEnd: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  const FIELD_LABELS: Record<keyof TouchedState, string> = {
    name: 'Event Name', location: 'Location', dateStart: 'Start Date', dateEnd: 'End Date',
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
          ? `"${empty[0]}" is required. Fill it in and ${isEdit ? 'save' : 'create'} the event again.`
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

    if (!isValidEmail(form.contactEmail)) {
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
      // organizer and topCountry are captured manually in the system after the
      // event is created (GSM), so they start empty rather than fabricated.
      organizer: '',
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      status: 'Upcoming',
      type: form.type,
      description: form.description.trim(),
      objective: form.objective.trim(),
      topCountry: '',
    };
    try {
      const created = await createEvent(payload);
      toast.success(`Event "${created.name}" created`, `Scheduled in ${created.location} from ${created.dateStart} to ${created.dateEnd}.`);
      onCreated?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
      else if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this event', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The event could not be created.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!event) return;
    setConfirming(false);
    setSaving(true);
    const patch: Partial<ScoutingEvent> = {
      name: form.name.trim(),
      location: form.location.trim(),
      dateStart: form.dateStart,
      dateEnd: form.dateEnd,
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      description: form.description.trim(),
      objective: form.objective.trim(),
      type: form.type,
    };
    try {
      const updated = await updateEvent(event.id, patch);
      toast.success(`Event "${updated.name}" updated`, `Changes saved for ${updated.location}, ${updated.dateStart} to ${updated.dateEnd}.`);
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
      else if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected these changes', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The event could not be updated.');
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
        style={{ ...MODAL_PANEL_BASE, width: 560 }}
      >
        <ModalHeader
          title={isEdit ? 'Edit Event' : 'New Event'}
          subtitle={isEdit ? 'Update this scouting event' : 'Register a new scouting event'}
          accentColor="#04BF6E"
          onClose={requestClose}
        />

        <div style={{ padding: MODAL_BODY_PADDING }}>
        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event Name */}
          <div>
            <label style={labelStyle}>Event Name <span style={{ color: BRAND_COLORS.accentRed }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Automotive Supplier Summit 2026"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onBlur={() => handleBlur('name')}
              style={showError('name') ? inputErrorStyle : inputStyle}
            />
            {showError('name') && <span style={{ fontSize: 12, color: BRAND_COLORS.accentRed, marginTop: 4, display: 'block' }}>Event name is required.</span>}
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location <span style={{ color: BRAND_COLORS.accentRed }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. CDMX, Mexico"
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              onBlur={() => handleBlur('location')}
              style={showError('location') ? inputErrorStyle : inputStyle}
            />
            {showError('location') && <span style={{ fontSize: 12, color: BRAND_COLORS.accentRed, marginTop: 4, display: 'block' }}>Location is required.</span>}
          </div>

          {/* Type — Direct / Indirect. Always defaulted to Direct before this
              existed, with no way to create an Indirect event or correct one. */}
          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as EventType }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="Direct">Direct</option>
              <option value="Indirect">Indirect</option>
            </select>
          </div>

          {/* Description — optional; captured manually after creation (GSM). */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              rows={3}
              placeholder="What is this event about?"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Objective — optional; captured manually after creation (GSM). */}
          <div>
            <label style={labelStyle}>Objective</label>
            <textarea
              rows={3}
              placeholder="What does SSD want to get out of it?"
              value={form.objective}
              onChange={e => setForm(p => ({ ...p, objective: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Start / End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date <span style={{ color: BRAND_COLORS.accentRed }}>*</span></label>
              <input
                type="date"
                value={form.dateStart}
                onChange={e => setForm(p => ({ ...p, dateStart: e.target.value }))}
                onBlur={() => handleBlur('dateStart')}
                style={showError('dateStart') ? inputErrorStyle : inputStyle}
              />
              {showError('dateStart') && <span style={{ fontSize: 12, color: BRAND_COLORS.accentRed, marginTop: 4, display: 'block' }}>Start date is required.</span>}
            </div>
            <div>
              <label style={labelStyle}>End Date <span style={{ color: BRAND_COLORS.accentRed }}>*</span></label>
              <input
                type="date"
                value={form.dateEnd}
                onChange={e => setForm(p => ({ ...p, dateEnd: e.target.value }))}
                onBlur={() => handleBlur('dateEnd')}
                style={showError('dateEnd') ? inputErrorStyle : inputStyle}
              />
              {showError('dateEnd') && <span style={{ fontSize: 12, color: BRAND_COLORS.accentRed, marginTop: 4, display: 'block' }}>End date is required.</span>}
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
        <div style={{ borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={requestClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.cards)}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#B80000')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.accentRed)}
          >
            {isEdit ? 'Save changes' : 'Create event'}
          </button>
        </div>
        </div>
      </div>

      {confirming && isEdit && (
        <ConfirmDialog
          title="Save these changes?"
          message={<>This updates <strong style={{ color: '#000000' }}>{form.name.trim()}</strong> with the new details.</>}
          confirmLabel={saving ? 'Saving…' : 'Save changes'}
          confirmDisabled={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={handleSaveEdit}
        />
      )}
      {confirming && !isEdit && (
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
