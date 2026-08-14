import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { ModalHeader } from './ModalHeader';
import { HEADER_HEIGHT } from './GlobalHeader';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

interface NoteEntry {
  id: string;
  text: string;
  author: string;
  role: string;
  date: string;
  tag?: string;
}

interface Props {
  title: string;
  notes: NoteEntry[];
  currentUserName: string;
  /** Colour of the header band — the stage/module this notes panel belongs to. */
  accentColor: string;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const TAG_COLOR = '#475569';

function getInitials(author: string) {
  return author.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function NotesSidePanel({ title, notes, currentUserName, accentColor, onAdd, onEdit, onDelete, onClose }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function saveNew() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
    setAdding(false);
  }

  function startEdit(note: NoteEntry) {
    setEditingId(note.id);
    setEditDraft(note.text);
  }

  function saveEdit() {
    const text = editDraft.trim();
    if (!text || !editingId) return;
    onEdit(editingId, text);
    setEditingId(null);
    setEditDraft('');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: HEADER_HEIGHT,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(0,0,0,0.15)',
          zIndex: 98,
        }}
      />

      {/* Right-side sliding panel */}
      <div
        className="flex flex-col"
        style={{
          position: 'fixed',
          top: HEADER_HEIGHT,
          right: 0,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          width: 380,
          backgroundColor: BRAND_COLORS.cards,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.20)',
          zIndex: 99,
        }}
      >
        {/* Coloured header band (square corners — this is a side panel, not centred). */}
        <ModalHeader title={title} accentColor={accentColor} onClose={onClose} rounded={false} />

        {/* "Add note" lives just under the band, on the white body, so it stays
            legible instead of getting lost inside the coloured header. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, flexShrink: 0 }}>
          <button
            onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: BRAND_COLORS.cards, backgroundColor: accentColor, border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add note
          </button>
        </div>

        {/* Add-note composer */}
        {adding && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, backgroundColor: '#FAFAFA', flexShrink: 0 }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write a note..."
              rows={3}
              autoFocus
              style={{ width: '100%', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#000000', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveNew} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save note</button>
              <button onClick={() => { setAdding(false); setDraft(''); }} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: BRAND_COLORS.cards, color: '#000000', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <FontAwesomeIcon icon={faStickyNote} style={{ fontSize: 40, color: NEUTRAL_COLORS.border, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>No notes yet</p>
              <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: 0 }}>Add the first note using the button above</p>
            </div>
          ) : (
            notes.map((note) => {
              const mine = note.author === currentUserName;
              const editing = editingId === note.id;
              return (
                <div
                  key={note.id}
                  style={{ position: 'relative', padding: '14px 20px', borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}` }}
                  onMouseEnter={() => setHoveredId(note.id)}
                  onMouseLeave={() => setHoveredId(prev => (prev === note.id ? null : prev))}
                >
                  <div className="flex items-center" style={{ gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: BRAND_COLORS.sidebar, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND_COLORS.cards, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {getInitials(note.author)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{note.author}</span>
                      <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}> · {note.role}</span>
                    </div>
                    {mine && !editing && hoveredId === note.id && (
                      <div className="flex items-center" style={{ gap: 4, marginLeft: 'auto' }}>
                        <button onClick={() => startEdit(note)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: BRAND_COLORS.sidebar }} aria-label="Edit note">
                          <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
                        </button>
                        <button onClick={() => onDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: BRAND_COLORS.sidebar }} aria-label="Delete note">
                          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center" style={{ gap: 8, margin: '0 0 4px', paddingLeft: 38 }}>
                    <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>{note.date}</span>
                    {note.tag && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: TAG_COLOR, backgroundColor: `${TAG_COLOR}1F`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.02em' }}>
                        {note.tag}
                      </span>
                    )}
                  </div>

                  {editing ? (
                    <div style={{ paddingLeft: 38 }}>
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        style={{ width: '100%', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#000000', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={saveEdit} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditDraft(''); }} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: BRAND_COLORS.cards, color: '#000000', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: '#000000', margin: 0, paddingLeft: 38, lineHeight: 1.5 }}>{note.text}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
