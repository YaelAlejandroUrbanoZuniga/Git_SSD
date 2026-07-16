/** A rejection reason must be written by hand — it can never be a default string. */
export const REJECTION_REASON_MIN = 20;

export function isValidRejectionReason(reason: string): boolean {
  return reason.trim().length >= REJECTION_REASON_MIN;
}

/** Shared by every flow that sends a supplier to Blacklisted. */
export function RejectionReasonField({
  reason, onChange, placeholder, autoFocus = true,
}: {
  reason: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const valid = isValidRejectionReason(reason);
  return (
    <div>
      <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 8 }}>
        Rejection reason (required, min. {REJECTION_REASON_MIN} characters)
      </label>
      <textarea
        value={reason}
        onChange={e => onChange(e.target.value)}
        rows={4}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ fontSize: 11, color: valid ? '#6ABF4B' : '#808285', textAlign: 'right', marginTop: 4 }}>
        {reason.trim().length}/{REJECTION_REASON_MIN} characters
      </div>
    </div>
  );
}
