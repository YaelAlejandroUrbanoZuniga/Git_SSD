import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPenToSquare, faTrash, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { mrlRequirements } from '../../data/pipeline-demo';
import type { MRLRequirement } from '../../types';
import { EditModal, ConfirmDeleteModal, type FormState } from './MRLList';

const priorityStyles: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: '#DC020226', text: '#DC0202', label: 'P1' },
  2: { bg: '#E3650B26', text: '#E3650B', label: 'P2' },
  3: { bg: '#D4A01726', text: '#D4A017', label: 'P3' },
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#808285', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: value ? '#000000' : '#9CA3AF', display: 'block' }}>
        {value ?? '—'}
      </span>
    </div>
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

const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

type TabId = 'overview' | 'volume' | 'requirements';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'volume', label: 'Volume & Commercial' },
  { id: 'requirements', label: 'Requirements' },
];

export function MRLRequirementDetail() {
  const { requirementId } = useParams<{ requirementId: string }>();
  const navigate = useNavigate();
  const req = mrlRequirements.find(r => r.id === requirementId);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!req) {
    return <p style={{ padding: 32, color: '#808285' }}>Requirement not found.</p>;
  }

  const title = req.partDescription || req.partNumber || 'Requirement';
  const subtitle = [req.partNumber, req.buyerName].filter(Boolean).join(' · ');

  return (
    <div>
      {/* Hero header */}
      <div style={{
        backgroundColor: '#6366F1',
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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
            <PriorityBadge priority={req.priority} />
          </div>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <button
            onClick={() => setShowEditModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#6366F1', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 12 }} />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #DC0202', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#DC0202', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#DC020208')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
            Delete
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/strategy" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Strategy</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <Link to="/strategy/mrl" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>MRL Requirements</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>{req.partDescription || req.partNumber}</span>
        </span>
      </nav>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid #E0E0E0', marginBottom: 24, gap: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#000000' : '#808285',
              borderBottom: activeTab === tab.id ? '2px solid #DC0202' : '2px solid transparent',
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
            <DetailField label="Buyer Name" value={req.buyerName} />
            <DetailField label="Commodity" value={req.commodity} />
            <DetailField label="Nexteer Product Line" value={req.nexteerProductLine} />
          </DetailCard>
          <DetailCard title="Part Details">
            <DetailField label="Part Number" value={req.partNumber} />
            <DetailField label="Part Description" value={req.partDescription} />
            <DetailField label="Main Materials / Spec / Technology & Info" value={req.mainMaterialsSpecTech} />
          </DetailCard>
        </div>
      )}

      {activeTab === 'volume' && (
        <div>
          <DetailCard title="Volume by Year">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {YEARS.map(yr => (
                <div key={yr} style={{ textAlign: 'center', padding: '8px 4px', border: '1px solid #EEEEEE', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, color: '#808285', margin: '0 0 4px', fontWeight: 600 }}>{yr}</p>
                  <p style={{ fontSize: 13, color: '#000000', margin: 0, fontWeight: 500 }}>
                    {req.volumeByYear[yr] != null ? req.volumeByYear[yr]!.toLocaleString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          </DetailCard>
          <DetailCard title="Commercial">
            <DetailField label="Peak Volume" value={req.peakVolume != null ? req.peakVolume.toLocaleString() : '—'} />
            <DetailField label="Target Price" value={req.targetPrice != null ? `$${req.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} />
            <DetailField label="Program" value={req.program} />
            <DetailField label="EOP" value={req.eop} />
          </DetailCard>
        </div>
      )}

      {activeTab === 'requirements' && (
        <DetailCard title="Requirements">
          <DetailField label="Primary Driver" value={req.primaryDriver} />
          <DetailField label="Key Manufacturing Capabilities" value={req.keyManufacturingCapabilities} />
          <DetailField label="Certifications" value={req.certifications} />
          <DetailField label="Safety-critical part" value={<YesNoBadge value={req.safetyCriticalPart} />} />
          <DetailField label="Supplier experience in safety required" value={<YesNoBadge value={req.supplierExperienceInSafetyRequired} />} />
          <DetailField label="Knowledge of CQIs" value={<YesNoBadge value={req.knowsCQIs} />} />
        </DetailCard>
      )}

      {showEditModal && (
        <EditModal
          editingReq={req}
          onClose={() => setShowEditModal(false)}
          onSave={(form: FormState) => {
            Object.assign(req, form);
            setShowEditModal(false);
          }}
        />
      )}
      {showDeleteModal && (
        <ConfirmDeleteModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={() => {
            const idx = mrlRequirements.findIndex((r: MRLRequirement) => r.id === req.id);
            if (idx !== -1) mrlRequirements.splice(idx, 1);
            navigate('/strategy/mrl');
          }}
        />
      )}
    </div>
  );
}
