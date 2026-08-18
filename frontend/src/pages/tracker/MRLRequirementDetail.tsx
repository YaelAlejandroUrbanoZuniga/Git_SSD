import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTrash, faClipboardList, faSave } from '@fortawesome/free-solid-svg-icons';
import type { MRLRequirement, Commodity } from '../../types';
import {
  deleteMRLRequirement, getMRLRequirements, updateMRLRequirement,
} from '../../services/mrlService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ConfirmDeleteModal } from './MRLList';
import { CatalogSelect } from '../../components/CatalogSelect';
import { LoadingState } from '../../components/LoadingState';
import { moduleIcons } from '../../components/moduleIcons';
import { COMMODITIES } from '../../constants/catalogs';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

const priorityStyles: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: `${BRAND_COLORS.accentRed}26`, text: BRAND_COLORS.accentRed, label: 'P1' },
  2: { bg: '#D4A01726', text: '#D4A017', label: 'P2' },
  3: { bg: '#6ABF4B26', text: '#6ABF4B', label: 'P3' },
};

function PriorityBadge({ priority, white }: { priority: 1 | 2 | 3; white?: boolean }) {
  const s = priorityStyles[priority];
  return (
    <span style={{
      backgroundColor: white ? BRAND_COLORS.cards : s.bg,
      color: s.text,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 3
    }}>
      {s.label}
    </span>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span style={{
      backgroundColor: value ? '#6ABF4B26' : `${BRAND_COLORS.sidebar}26`,
      color: value ? '#6ABF4B' : BRAND_COLORS.sidebar,
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
    }}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${NEUTRAL_COLORS.border}`,
  borderRadius: 5,
  padding: '6px 10px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#000000',
  backgroundColor: BRAND_COLORS.cards,
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'none' as const,
};

const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

type TabId = 'overview' | 'volume' | 'requirements';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'volume', label: 'Volume & Commercial' },
  { id: 'requirements', label: 'Requirements' },
];

type Draft = Omit<MRLRequirement, 'id'>;

function initDraft(req: MRLRequirement): Draft {
  const { id: _id, ...rest } = req;
  return { ...rest, volumeByYear: { ...rest.volumeByYear } };
}

/**
 * Changed fields only, mirroring `buildSupplierPatch` in `TrackerSupplierDetail`.
 *
 * This screen used to PATCH the whole ~18-field draft it read when it mounted,
 * which meant a second person editing any other field of the same requirement
 * had their change silently overwritten by whatever this tab had cached. Sending
 * a diff narrows the overwrite to fields this user actually touched.
 */
function buildRequirementPatch(original: Draft, draft: Draft): Partial<Draft> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(original[key])) {
      patch[key] = draft[key];
    }
  }
  return patch as Partial<Draft>;
}

export function MRLRequirementDetail() {
  const { requirementId } = useParams<{ requirementId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  // Standardised on `usePermissions().canWrite`, the same convention MRLList,
  // SuppliersList, EventsList, StrategyPage, TrackerSupplierDetail and
  // TabProspects already use. This file previously imported no permission hook
  // at all, so a read-only user could fill in the whole form and press Save.
  const { canWrite } = usePermissions();

  const [req, setReq] = useState<MRLRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!requirementId) return;
    let cancelled = false;
    setLoading(true);
    getMRLRequirements()
      .then(list => {
        if (cancelled) return;
        const found = list.find(r => r.id === requirementId) ?? null;
        setReq(found);
        setDraft(found ? initDraft(found) : null);
      })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the requirement.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requirementId, toast]);

  if (loading) {
    return <LoadingState entity="MRL Requirement" icon={moduleIcons.tracker} fill />;
  }
  if (!req || !draft) {
    return <p style={{ padding: 32, color: BRAND_COLORS.sidebar }}>Requirement not found.</p>;
  }
  const reqId = req.id;

  function set<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function setVol(year: string, value: string) {
    setDraft(prev => prev ? {
      ...prev,
      volumeByYear: { ...prev.volumeByYear, [year]: value === '' ? null : Number(value) },
    } : prev);
  }

  async function handleSave() {
    if (!draft || !req || saving) return;
    const patch = buildRequirementPatch(initDraft(req), draft);
    if (Object.keys(patch).length === 0) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMRLRequirement(reqId, patch);
      setReq(updated);
      setDraft(initDraft(updated));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
      else if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this change', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The requirement could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  const title = draft.partDescription || draft.partNumber || 'Requirement';
  const subtitle = [draft.partNumber, draft.buyerName].filter(Boolean).join(' · ');

  return (
    <div>
      {/* Hero header */}
      <div style={{
        backgroundColor: ACCENT_COLORS.info,
        padding: '20px 32px',
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        marginBottom: 28,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <button
            onClick={() => navigate('/strategy/mrl')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
            <PriorityBadge priority={draft.priority} white />
          </div>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{subtitle}</p>
          )}
        </div>
        {/* Both writes are gated behind `canWrite`. A read-only user still reaches
            this screen and can read every field, but is no longer offered a Save
            that the backend will 403, nor a Delete whose confirmation dialog asks
            them to commit to an action they cannot perform. */}
        {canWrite && (
          <div className="flex items-center" style={{ gap: 12 }}>
            {savedFlash && (
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND_COLORS.cards, opacity: 0.9 }}>Saved</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: ACCENT_COLORS.info, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => (e.currentTarget.style.opacity = saving ? '0.6' : '1')}
            >
              <FontAwesomeIcon icon={faSave} style={{ fontSize: 12 }} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${BRAND_COLORS.accentRed}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: BRAND_COLORS.accentRed, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1, whiteSpace: 'nowrap' }}
              onMouseEnter={e => { if (!deleting) e.currentTarget.style.backgroundColor = `${BRAND_COLORS.accentRed}08`; }}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.cards)}
            >
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <Link to="/strategy" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Strategy</Link>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <Link to="/strategy/mrl" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>MRL Requirements</Link>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{req.partDescription || req.partNumber}</span>
        </span>
      </nav>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, marginBottom: 24, gap: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : BRAND_COLORS.sidebar,
              borderBottom: activeTab === tab.id ? `2px solid ${BRAND_COLORS.accentRed}` : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <DetailCard title="Identification">
            <FieldRow label="Buyer Name">
              <input style={inputStyle} value={draft.buyerName} onChange={e => set('buyerName', e.target.value)} />
            </FieldRow>
            <FieldRow label="Commodity">
              <CatalogSelect value={draft.commodity} onChange={v => set('commodity', v as Commodity)} options={COMMODITIES} placeholder="Select commodity" />
            </FieldRow>
            <FieldRow label="Nexteer Product Line">
              <input style={inputStyle} value={draft.nexteerProductLine} onChange={e => set('nexteerProductLine', e.target.value)} />
            </FieldRow>
            <FieldRow label="Priority">
              <select
                value={draft.priority}
                onChange={e => set('priority', Number(e.target.value) as 1 | 2 | 3)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={1}>1 — High</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — Low</option>
              </select>
            </FieldRow>
          </DetailCard>
          <DetailCard title="Part Details">
            <FieldRow label="Part Number">
              <input style={inputStyle} value={draft.partNumber} onChange={e => set('partNumber', e.target.value)} />
            </FieldRow>
            <FieldRow label="Part Description">
              <input style={inputStyle} value={draft.partDescription} onChange={e => set('partDescription', e.target.value)} />
            </FieldRow>
            <FieldRow label="Main Materials / Spec / Technology & Info">
              <textarea rows={3} style={textareaStyle} value={draft.mainMaterialsSpecTech} onChange={e => set('mainMaterialsSpecTech', e.target.value)} />
            </FieldRow>
          </DetailCard>
        </div>
      )}

      {activeTab === 'volume' && (
        <div>
          <DetailCard title="Volume by Year">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {YEARS.map(yr => (
                <div key={yr} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '0 0 6px', fontWeight: 600 }}>{yr}</p>
                  <input
                    type="number"
                    min={0}
                    value={draft.volumeByYear[yr] ?? ''}
                    onChange={e => setVol(yr, e.target.value)}
                    style={{ ...inputStyle, textAlign: 'center', padding: '8px 4px' }}
                  />
                </div>
              ))}
            </div>
          </DetailCard>
          <DetailCard title="Commercial">
            <FieldRow label="Peak Volume">
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={draft.peakVolume ?? ''}
                onChange={e => set('peakVolume', e.target.value === '' ? null : Number(e.target.value))}
              />
            </FieldRow>
            <FieldRow label="Target Price (USD)">
              <input
                type="number"
                min={0}
                step={0.01}
                style={inputStyle}
                value={draft.targetPrice ?? ''}
                onChange={e => set('targetPrice', e.target.value === '' ? null : Number(e.target.value))}
              />
            </FieldRow>
            <FieldRow label="Program">
              <input style={inputStyle} value={draft.program} onChange={e => set('program', e.target.value)} />
            </FieldRow>
            <FieldRow label="EOP">
              <input style={inputStyle} value={draft.eop} onChange={e => set('eop', e.target.value)} />
            </FieldRow>
          </DetailCard>
        </div>
      )}

      {activeTab === 'requirements' && (
        <DetailCard title="Requirements">
          <FieldRow label="Primary Driver">
            <input style={inputStyle} value={draft.primaryDriver} onChange={e => set('primaryDriver', e.target.value)} />
          </FieldRow>
          <FieldRow label="Key Manufacturing Capabilities">
            <input style={inputStyle} value={draft.keyManufacturingCapabilities} onChange={e => set('keyManufacturingCapabilities', e.target.value)} />
          </FieldRow>
          <FieldRow label="Certifications">
            <input style={inputStyle} value={draft.certifications} onChange={e => set('certifications', e.target.value)} />
          </FieldRow>
          <FieldRow label="Safety-critical part">
            <button
              onClick={() => set('safetyCriticalPart', !draft.safetyCriticalPart)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <YesNoBadge value={draft.safetyCriticalPart} />
            </button>
          </FieldRow>
          <FieldRow label="Supplier experience in safety required">
            <button
              onClick={() => set('supplierExperienceInSafetyRequired', !draft.supplierExperienceInSafetyRequired)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <YesNoBadge value={draft.supplierExperienceInSafetyRequired} />
            </button>
          </FieldRow>
          <FieldRow label="Knowledge of CQIs">
            <button
              onClick={() => set('knowsCQIs', !draft.knowsCQIs)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <YesNoBadge value={draft.knowsCQIs} />
            </button>
          </FieldRow>
        </DetailCard>
      )}

      {showDeleteModal && (
        <ConfirmDeleteModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await deleteMRLRequirement(reqId);
              navigate('/strategy/mrl');
            } catch (err) {
              // Same split as `handleSave` above: a rejection the user can act on
              // (a requirement still referenced elsewhere, say) reads as a business
              // rule, not as "technical problem — try again".
              if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
              else if (err instanceof ApiError && err.isUserFixable) {
                toast.validationError('This requirement could not be deleted', err.message);
              } else {
                toast.systemError(err instanceof ApiError ? err.message : 'The requirement could not be deleted.');
              }
              setDeleting(false);
              setShowDeleteModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
