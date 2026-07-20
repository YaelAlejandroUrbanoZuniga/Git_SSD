import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTimes, faTriangleExclamation, faClipboardList, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import type { MRLRequirement, Commodity } from '../../types';
import {
  createMRLRequirement, deleteMRLRequirement, getMRLRequirements, updateMRLRequirement,
} from '../../services/mrlService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { CatalogSelect } from '../../components/CatalogSelect';
import { modalPanelStyle } from '../../components/modalPanelStyle';
import { COMMODITIES } from '../../constants/catalogs';

// Years for MRLRequirement['volumeByYear'] — keep in sync.
const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

// ─── Shared style helpers ────────────────────────────────────────────────────

const priorityStyles: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: '#DC020226', text: '#DC0202', label: 'P1' },
  2: { bg: '#D4A01726', text: '#D4A017', label: 'P2' },
  3: { bg: '#6ABF4B26', text: '#6ABF4B', label: 'P3' },
};

function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const s = priorityStyles[priority];
  return (
    <span style={{ backgroundColor: s.bg, color: s.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3 }}>
      {s.label}
    </span>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span style={{
      backgroundColor: value ? '#6ABF4B26' : '#80828526',
      color: value ? '#6ABF4B' : '#808285',
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
    }}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

// ─── Modal shared overlay ─────────────────────────────────────────────────────

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

interface ConfirmDeleteProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ onCancel, onConfirm }: ConfirmDeleteProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ ...modalPanelStyle('#6366F1'), width: 400, padding: '32px 32px 28px', textAlign: 'center' }}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 24, color: '#DC0202', marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: '0 0 10px' }}>Delete requirement?</h3>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px', lineHeight: 1.5 }}>
          This action cannot be undone. The requirement will be permanently removed.
        </p>
        <div className="flex items-center" style={{ justifyContent: 'center', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

export type FormState = Omit<MRLRequirement, 'id'>;

const emptyForm = (): FormState => ({
  buyerName: '',
  commodity: '' as string as Commodity,
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

interface EditModalProps {
  editingReq: MRLRequirement | null;
  onClose: () => void;
  onSave: (form: FormState) => void;
}

export function EditModal({ editingReq, onClose, onSave }: EditModalProps) {
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
        style={{ ...modalPanelStyle('#6366F1'), width: 600, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}
      >
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
              <CatalogSelect value={form.commodity} onChange={v => set('commodity', v)} options={COMMODITIES} placeholder="Select commodity" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalMode = 'none' | 'edit' | 'confirmDelete';

export function MRLList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [requirements, setRequirements] = useState<MRLRequirement[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>('none');
  const [selectedReq, setSelectedReq] = useState<MRLRequirement | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    getMRLRequirements()
      .then(list => { if (!cancelled) setRequirements(list); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load MRL requirements.');
      });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => reload(), [reload]);

  type MRLSortField = 'priority' | 'buyerName' | 'commodity' | 'partDescription' | 'program' | 'targetPrice';
  type SortDir3 = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<MRLSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir3>(null);

  const handleMRLSort = (field: MRLSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortField(null);
      setSortDir(null);
    } else {
      setSortDir('asc');
    }
  };

  const sortedRequirements = useMemo(() => {
    if (!sortField || !sortDir) return requirements;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...requirements].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortField) {
        case 'priority':
          av = a.priority; bv = b.priority; break;
        case 'targetPrice':
          av = a.targetPrice ?? -Infinity; bv = b.targetPrice ?? -Infinity; break;
        default:
          av = (a[sortField] || '').toLowerCase();
          bv = (b[sortField] || '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [requirements, sortField, sortDir]);


  const openEdit = (req: MRLRequirement | null) => { setSelectedReq(req); setModalMode('edit'); };
  const openCreate = () => openEdit(null);
  const closeAll = () => { setModalMode('none'); setSelectedReq(null); };

  const handleSave = async (form: FormState) => {
    try {
      if (selectedReq) {
        const updated = await updateMRLRequirement(selectedReq.id, form);
        setRequirements(prev => prev.map(r => (r.id === selectedReq.id ? updated : r)));
      } else {
        const created = await createMRLRequirement(form);
        setRequirements(prev => [...prev, created]);
      }
    } catch (err) {
      if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this requirement', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The MRL requirement could not be saved.');
      }
    }
  };

  const handleDelete = async () => {
    if (selectedReq) {
      try {
        await deleteMRLRequirement(selectedReq.id);
        setRequirements(prev => prev.filter(r => r.id !== selectedReq.id));
      } catch (err) {
        toast.systemError(err instanceof ApiError ? err.message : 'The MRL requirement could not be deleted.');
      }
    }
    closeAll();
  };

  const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#808285', verticalAlign: 'middle' };

  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#6366F1',
        padding: '20px 32px',
        marginBottom: 28,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <button
            onClick={() => navigate('/strategy')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>MRL Requirements</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {requirements.length} requirements
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#6366F1', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Add requirement
        </button>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/strategy" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Strategy</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>MRL Requirements</span>
        </span>
      </nav>

      {/* Table */}
      {requirements.length === 0 ? (
        <p style={{ fontSize: 14, color: '#808285', textAlign: 'center', padding: '48px 0' }}>
          No requirements added yet. Use the button above to add the first one.
        </p>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {([
                  { label: 'Priority',         field: 'priority' as MRLSortField },
                  { label: 'Buyer',            field: 'buyerName' as MRLSortField },
                  { label: 'Commodity',        field: 'commodity' as MRLSortField },
                  { label: 'Part Description', field: 'partDescription' as MRLSortField },
                  { label: 'Program',          field: 'program' as MRLSortField },
                  { label: 'Safety Critical',  field: null },
                  { label: 'Target Price',     field: 'targetPrice' as MRLSortField },
                ] as { label: string; field: MRLSortField | null }[]).map(col => (
                  <th
                    key={col.label}
                    onClick={col.field ? () => handleMRLSort(col.field as MRLSortField) : undefined}
                    style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', textAlign: 'left', borderBottom: '0.5px solid #D1D3D4', whiteSpace: 'nowrap', cursor: col.field ? 'pointer' : 'default', userSelect: 'none', backgroundColor: col.field && sortField === col.field ? '#EEEEEE' : '#F7F7F7' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {col.label}
                      {col.field && sortField === col.field && sortDir === 'asc'  && <FontAwesomeIcon icon={faArrowUp}   style={{ fontSize: 10, color: '#000000' }} />}
                      {col.field && sortField === col.field && sortDir === 'desc' && <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 10, color: '#000000' }} />}
                      {col.field && sortField !== col.field && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#D1D3D4' }} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRequirements.map((req, idx) => {
                const isLast = idx === sortedRequirements.length - 1;
                return (
                  <tr
                    key={req.id}
                    onClick={() => navigate(`/strategy/mrl/${req.id}`)}
                    style={{ borderBottom: isLast ? 'none' : '0.5px solid #D1D3D4', cursor: 'pointer', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={tdStyle}>
                      <PriorityBadge priority={req.priority} />
                    </td>
                    <td style={tdStyle}>{req.buyerName || '—'}</td>
                    <td style={tdStyle}>{req.commodity || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: '#000000', maxWidth: 220 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.partDescription || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>{req.program || '—'}</td>
                    <td style={tdStyle}>
                      <YesNoBadge value={req.safetyCriticalPart} />
                    </td>
                    <td style={tdStyle}>
                      {req.targetPrice != null
                        ? `$${req.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modalMode === 'confirmDelete' && selectedReq && (
        <ConfirmDeleteModal
          onCancel={closeAll}
          onConfirm={handleDelete}
        />
      )}

      {modalMode === 'edit' && (
        <EditModal
          editingReq={selectedReq}
          onClose={closeAll}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
