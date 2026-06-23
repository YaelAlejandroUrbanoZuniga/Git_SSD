import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faArrowLeft, faTimes, faBan } from '@fortawesome/free-solid-svg-icons';
import { blacklistedSuppliers } from '../../data/pipeline-demo';
import type { BlacklistedSupplier } from '../../types';

function ViewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
      <span style={{ fontSize: 12, color: '#808285', flex: '0 0 44%' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#000000', textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  );
}

function ViewGroupLabel({ title }: { title: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px', borderBottom: '0.5px solid #EEEEEE', paddingBottom: 4 }}>
      {title}
    </p>
  );
}

interface ViewModalProps {
  supplier: BlacklistedSupplier;
  onClose: () => void;
}

function BlacklistedViewModal({ supplier, onClose }: ViewModalProps) {
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

        {/* Header */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 6px', paddingRight: 32 }}>
          {supplier.name}
        </h2>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: '#808285' }}>{supplier.folio}</span>
          <span style={{ backgroundColor: '#DC020226', color: '#DC0202', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3 }}>
            Blacklisted
          </span>
        </div>

        {/* Group 1 — Rejection Info */}
        <div style={{ marginBottom: 20 }}>
          <ViewGroupLabel title="Rejection Info" />
          <ViewRow label="Rejected by" value={supplier.rejectedBy} />
          <ViewRow label="Rejection date" value={supplier.rejectionDate} />
          <div style={{ padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: '#808285', display: 'block', marginBottom: 4 }}>Rejection reason</span>
            <span style={{ fontSize: 13, color: '#000000', lineHeight: 1.5, display: 'block' }}>{supplier.rejectionReason}</span>
          </div>
        </div>

        {/* Group 2 — Company Info */}
        <div style={{ marginBottom: 24 }}>
          <ViewGroupLabel title="Company Info" />
          <ViewRow label="Company" value={supplier.fullName} />
          <ViewRow label="Commodity" value={supplier.commodity} />
          <ViewRow label="Product type" value={supplier.productType} />
          <ViewRow label="Scouting input" value={supplier.scoutingInput} />
          <ViewRow label="Buyer" value={supplier.buyer} />
          <ViewRow label="Manufacturing country" value={supplier.country} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '0.5px solid #D1D3D4', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function PipelineBlacklisted() {
  const navigate = useNavigate();
  const [selectedSupplier, setSelectedSupplier] = useState<BlacklistedSupplier | null>(null);

  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#DC0202',
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
            onClick={() => navigate('/pipeline')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faBan} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>Blacklisted</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {blacklistedSuppliers.length} rejected suppliers
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Pipeline</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>Blacklisted</span>
        </span>
      </nav>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input type="text" placeholder="Search supplier..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
        {['Commodity', 'Buyer'].map(f => (
          <button key={f} className="flex items-center" style={{ gap: 6, padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {f} <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: '#808285' }} />
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Folio', 'Company', 'Commodity', 'Product type', 'Scouting Input', 'Buyer', 'Rejected by', 'Date', 'Reason'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: '0.5px solid #D1D3D4' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blacklistedSuppliers.map(s => (
              <tr
                key={s.id}
                style={{ borderBottom: '0.5px solid #D1D3D4', cursor: 'pointer', transition: 'background-color 0.1s' }}
                onClick={() => setSelectedSupplier(s)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.folio}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#000000' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.commodity}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.productType}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.scoutingInput}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.buyer}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.rejectedBy}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.rejectionDate}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285', maxWidth: 220 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.rejectionReason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {selectedSupplier && (
        <BlacklistedViewModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
        />
      )}
    </div>
  );
}
