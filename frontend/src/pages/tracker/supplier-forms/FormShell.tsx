import type { CSSProperties, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCircleInfo } from '@fortawesome/free-solid-svg-icons';

// Shared chrome + field primitives for the two registration forms (A/B).
// Reuses the existing supplier-modal input/label styles (Estandares_UI_v1.4).

export const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF',
};

export const labelStyle: CSSProperties = {
  fontSize: 13, color: '#000000', display: 'block', marginBottom: 4,
};

export const groupLabelStyle: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 12px',
};

const RED = '#DC0202';

export function Required() {
  return <span style={{ color: RED }}>*</span>;
}

/** A labelled form row. `hint` explains a validation rule or a pending catalog. */
export function Field({
  label, required = false, hint, children,
}: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label} {required && <Required />}</label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: '#808285', margin: '4px 0 0', lineHeight: 1.4 }}>{hint}</p>
      )}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

export function TextArea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
    />
  );
}

/** Checkbox group for the questions the spec defines as multi-select. */
export function MultiSelect({
  options, selected, onChange,
}: { options: readonly string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter(s => s !== option)
        : [...selected, option],
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', paddingTop: 2 }}>
      {options.map(option => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
            style={{ accentColor: RED, width: 15, height: 15, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#000000' }}>{option}</span>
        </label>
      ))}
    </div>
  );
}

/** Radio group — used for the Direct/Indirect filter, where the choice gates the form. */
export function RadioGroup({
  options, value, onChange,
}: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(option => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            checked={value === option}
            onChange={() => onChange(option)}
            style={{ accentColor: RED, width: 15, height: 15, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#000000' }}>{option}</span>
        </label>
      ))}
    </div>
  );
}

/** Year selector, newest first (spec: "Selector de año"). */
export function YearSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 125 }, (_, i) => String(thisYear - i));
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">Select year</option>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

/** Two-column grid for short paired fields. */
export function Grid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );
}

export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <p style={groupLabelStyle}>{title}</p>
      {note && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: '#F4F6F8', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 12, color: '#0084C0', marginTop: 2 }} />
          <span style={{ fontSize: 12, color: '#54585A', lineHeight: 1.5 }}>{note}</span>
        </div>
      )}
    </>
  );
}

/** Step counter + progress bar across the form's sections. */
export function ProgressBar({ step, total, label }: { step: number; total: number; label: string }) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#000000' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#808285' }}>Step {step + 1} of {total}</span>
      </div>
      <div style={{ height: 4, backgroundColor: '#E9ECEF', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: RED, transition: 'width 0.2s' }} />
      </div>
    </div>
  );
}

export function BackButton({ onBack, label = 'Back' }: { onBack: () => void; label?: string }) {
  return (
    <button
      onClick={onBack}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: '#808285', marginBottom: 12 }}
    >
      <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> {label}
    </button>
  );
}

/** Footer: Cancel on the left of the primary action, Back/Next on the right. */
export function FormFooter({
  onCancel, onBack, onNext, nextLabel = 'Next →', nextDisabled = false, busy = false,
}: {
  onCancel: () => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '0.5px solid #D1D3D4', paddingTop: 16, marginTop: 8 }}>
      <button
        onClick={onCancel}
        style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', marginRight: 'auto' }}
      >
        Cancel
      </button>
      {onBack && (
        <button
          onClick={onBack}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
        >
          ← Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled || busy}
        style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: RED, color: '#FFFFFF', cursor: nextDisabled || busy ? 'not-allowed' : 'pointer', opacity: nextDisabled || busy ? 0.45 : 1 }}
      >
        {busy ? 'Saving…' : nextLabel}
      </button>
    </div>
  );
}

/** Terminal state for an Indirect answer — SSD is Direct-only, so the form stops here (spec §0). */
export function IndirectExit({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  return (
    <>
      <BackButton onBack={onBack} />
      <div style={{ textAlign: 'center', padding: '24px 8px 8px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#D4A01715', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 20, color: '#D4A017' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: '0 0 8px' }}>
          This channel is for Direct product suppliers only
        </h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px', lineHeight: 1.6 }}>
          The SSD tracker does not manage Indirect suppliers (services, MRO, consumables).
          Please redirect this supplier to the corresponding channel — no record will be created here.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: RED, color: '#FFFFFF', cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </>
  );
}
