import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPen, faTrash, faTimes } from '@fortawesome/free-solid-svg-icons';
import { mrlRequirements as initialRequirements, MRLRequirement } from '../../data/pipeline-demo';

const priorityStyles: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: '#DC020226', text: '#DC0202', label: 'P1' },
  2: { bg: '#E3650B26', text: '#E3650B', label: 'P2' },
  3: { bg: '#D4A01726', text: '#D4A017', label: 'P3' },
};

const emptyForm = (): Omit<MRLRequirement, 'id'> => ({
  buyerName: '',
  commodity: '',
  nexteerProductLine: '',
  volumeByYear: { '2026': null, '2027': null, '2028': null, '2029': null, '2030': null, '2031': null },
  partNumber: '',
  partDescription: '',
  mainMaterialsSpecTech: '',
  peakVolume: null,
  program: '',
  eop: '',
  targetPrice: null,
  priority: 3,
  primaryDriver: '',
  keyManufacturingCapabilities: '',
  safetyCriticalPart: false,
  supplierExperienceInSafetyRequired: false,
  certifications: '',
  knowsCQIs: false,
});

type FormState = Omit<MRLRequirement, 'id'>;

const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

function SectionLabel({ title }: { title: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
      {title}
    </p>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: '1px solid #D1D3D4',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    ...extra,
  };
}

interface ModalProps {
  editingReq: MRLRequirement | null;
  onClose: () => void;
  onSave: (form: FormState) => void;
}

function MRLModal({ editingReq, onClose, onSave }: ModalProps) {
  const [form, setForm] = useState<FormState>(
    editingReq ? (({ id: _id, ...rest }) => rest)(editingReq) : emptyForm()
  );

  const set = (field: keyof FormState, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const setVol = (year: string, value: string) =>
    setForm(prev => ({
      ...prev,
      volumeByYear: { ...prev.volumeByYear, [year]: value === '' ? null : Number(value) },
    }));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 600, maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative' }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 24px' }}>
          {editingReq ? 'Edit requirement' : 'New requirement'}
        </h2>

        {/* Group 1 — Identification */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel title="Identification" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Buyer Name</label>
              <input style={inputStyle()} value={form.buyerName} onChange={e => set('buyerName', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Commodity</label>
              <input style={inputStyle()} value={form.commodity} onChange={e => set('commodity', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Nexteer Product Line</label>
              <input style={inputStyle()} value={form.nexteerProductLine} onChange={e => set('nexteerProductLine', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Priority</label>
              <select
                value={form.priority}
                onChange={e => set('priority', Number(e.target.value) as 1 | 2 | 3)}
                style={inputStyle({ appearance: 'none', cursor: 'pointer' })}
              >
                <option value={1}>1 — High</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Group 2 — Part details */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel title="Part Details" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Part Number</label>
              <input style={inputStyle()} value={form.partNumber} onChange={e => set('partNumber', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Part Description</label>
              <input style={inputStyle()} value={form.partDescription} onChange={e => set('partDescription', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Main Materials, Spec, Technology & Info</label>
            <textarea
              rows={3}
              value={form.mainMaterialsSpecTech}
              onChange={e => set('mainMaterialsSpecTech', e.target.value)}
              style={inputStyle({ resize: 'none' })}
            />
          </div>
        </div>

        {/* Group 3 — Volume by year */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel title="Volume by year" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {YEARS.map(yr => (
              <div key={yr}>
                <label style={{ fontSize: 11, color: '#808285', display: 'block', marginBottom: 4, textAlign: 'center' }}>{yr}</label>
                <input
                  type="number"
                  min={0}
                  value={form.volumeByYear[yr] ?? ''}
                  onChange={e => setVol(yr, e.target.value)}
                  style={inputStyle({ textAlign: 'center', padding: '8px 4px' })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Group 4 — Commercial */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel title="Commercial" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Peak Volume</label>
              <input
                type="number"
                min={0}
                value={form.peakVolume ?? ''}
                onChange={e => set('peakVolume', e.target.value === '' ? null : Number(e.target.value))}
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Target Price (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.targetPrice ?? ''}
                onChange={e => set('targetPrice', e.target.value === '' ? null : Number(e.target.value))}
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Program</label>
              <input style={inputStyle()} value={form.program} onChange={e => set('program', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>EOP</label>
              <input style={inputStyle()} value={form.eop} onChange={e => set('eop', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Group 5 — Requirements */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel title="Requirements" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Primary Driver</label>
              <input style={inputStyle()} value={form.primaryDriver} onChange={e => set('primaryDriver', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Key Manufacturing Capabilities</label>
              <input style={inputStyle()} value={form.keyManufacturingCapabilities} onChange={e => set('keyManufacturingCapabilities', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Certifications</label>
              <input style={inputStyle()} value={form.certifications} onChange={e => set('certifications', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10, paddingBottom: 2 }}>
              {([
                ['safetyCriticalPart', 'Safety-critical part'],
                ['supplierExperienceInSafetyRequired', 'Supplier experience in safety required'],
                ['knowsCQIs', 'Knowledge of CQIs'],
              ] as [keyof FormState, string][]).map(([field, label]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#000000' }}>
                  <input
                    type="checkbox"
                    checked={form[field] as boolean}
                    onChange={e => set(field, e.target.checked)}
                    style={{ accentColor: '#DC0202', width: 16, height: 16, cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function MRLList() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<MRLRequirement[]>(initialRequirements);
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<MRLRequirement | null>(null);

  const openCreate = () => { setEditingReq(null); setShowModal(true); };
  const openEdit = (req: MRLRequirement) => { setEditingReq(req); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSave = (form: FormState) => {
    if (editingReq) {
      setRequirements(prev => prev.map(r => r.id === editingReq.id ? { ...form, id: editingReq.id } : r));
    } else {
      setRequirements(prev => [...prev, { ...form, id: 'mrl-' + Date.now() }]);
    }
  };

  const handleDelete = (id: string) =>
    setRequirements(prev => prev.filter(r => r.id !== id));

  const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#000000', verticalAlign: 'middle' };

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/pipeline')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Pipeline
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none' }}>Pipeline</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#000000' }}>Master Requirements List</span>
        </span>
      </nav>

      {/* Header row */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Master Requirements List</h1>
          <p style={{ fontSize: 16, color: '#808285', margin: '4px 0 0', fontWeight: 400 }}>
            Shared notes on supplier needs — guides sourcing prioritization
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Add requirement
        </button>
      </div>

      {/* Table */}
      {requirements.length === 0 ? (
        <p style={{ fontSize: 14, color: '#808285', textAlign: 'center', padding: '48px 0' }}>
          No requirements added yet. Use the button above to add the first one.
        </p>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F5F5F5' }}>
                {['Priority', 'Buyer', 'Commodity', 'Part Description', 'Program', 'Safety Critical', 'Target Price', 'Actions'].map(col => (
                  <th
                    key={col}
                    style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requirements.map((req, idx) => {
                const ps = priorityStyles[req.priority];
                const isLast = idx === requirements.length - 1;
                return (
                  <tr
                    key={req.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid #EEEEEE', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={tdStyle}>
                      <span style={{ backgroundColor: ps.bg, color: ps.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3 }}>
                        {ps.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{req.buyerName || '—'}</td>
                    <td style={tdStyle}>{req.commodity || '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 220 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.partDescription || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>{req.program || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        backgroundColor: req.safetyCriticalPart ? '#6ABF4B26' : '#80828526',
                        color: req.safetyCriticalPart ? '#6ABF4B' : '#808285',
                        fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
                      }}>
                        {req.safetyCriticalPart ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {req.targetPrice != null
                        ? `$${req.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div className="flex items-center" style={{ gap: 12 }}>
                        <button
                          onClick={() => openEdit(req)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#808285', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
                          title="Edit"
                        >
                          <FontAwesomeIcon icon={faPen} style={{ fontSize: 13 }} />
                        </button>
                        <button
                          onClick={() => handleDelete(req.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#DC0202', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <MRLModal editingReq={editingReq} onClose={closeModal} onSave={handleSave} />
      )}
    </div>
  );
}
