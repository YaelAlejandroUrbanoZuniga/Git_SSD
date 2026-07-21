/**
 * Mandatory note captured every time a supplier advances a stage. The backend
 * (moveSupplierToStage → assertMeaningfulText) rejects anything shorter than its
 * MIN_LENGTH, so the confirm button stays disabled until this minimum is met.
 *
 * NOTE: this must match the backend MIN_LENGTH in
 * `backend/src/domain/textValidation.ts`. It is intentionally a hardcoded copy —
 * if GSM changes the number there, update this one line to match.
 */
export const STAGE_NOTE_MIN = 10;

export function isValidStageNote(note: string): boolean {
  return note.trim().length >= STAGE_NOTE_MIN;
}

/** Shared by every modal that advances a supplier to the next stage. */
export function StageNoteField({
  note, onChange, placeholder, autoFocus = false,
}: {
  note: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const valid = isValidStageNote(note);
  return (
    <div>
      <label style={{ fontSize: 13, color: '#000000', display: 'block', marginBottom: 8 }}>
        Reason for this move (required)
      </label>
      <textarea
        value={note}
        onChange={e => onChange(e.target.value)}
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
      />
      {/* Fixed hint matching the backend minimum — see STAGE_NOTE_MIN comment. */}
      <div style={{ fontSize: 12, color: valid ? '#6ABF4B' : '#DC0202', marginTop: 4 }}>
        Mínimo {STAGE_NOTE_MIN} caracteres ({note.trim().length}/{STAGE_NOTE_MIN})
      </div>
    </div>
  );
}
