import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCheckCircle, faCircle, faEye } from '@fortawesome/free-solid-svg-icons';
import type { Supplier } from '../types';

interface SupplierDrawerProps {
  supplier: Supplier | null;
  onClose: () => void;
}

const slaLabel: Record<string, string> = { green: 'On Track', yellow: 'At Risk', red: 'Overdue' };
const slaColor: Record<string, string> = { green: '#6ABF4B', yellow: '#D4A017', red: '#DC0202' };
const slaBg:    Record<string, string> = { green: '#6ABF4B26', yellow: '#D4A01726', red: '#DC020226' };

export function SupplierDrawer({ supplier, onClose }: SupplierDrawerProps) {
  if (!supplier) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-screen flex flex-col bg-white z-50"
        style={{ width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.20)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '0 24px', height: 60, borderBottom: '1px solid #E0E0E0' }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{supplier.name}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', backgroundColor: 'transparent',
              cursor: 'pointer', color: '#808285',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
          {/* Stage badge */}
          <div style={{ marginBottom: 20 }}>
            <span
              style={{
                backgroundColor: '#80828526',
                color: '#808285',
                fontSize: 11, fontWeight: 500,
                padding: '3px 7px', borderRadius: 4,
              }}
            >
              {supplier.stage}
            </span>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Category',      value: supplier.category },
              { label: 'Days in Stage', value: String(supplier.daysInStage) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#000000', margin: 0 }}>{value}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 4px' }}>SLA Status</p>
              <span
                style={{
                  backgroundColor: slaBg[supplier.sla],
                  color: slaColor[supplier.sla],
                  fontSize: 11, fontWeight: 500,
                  padding: '3px 7px', borderRadius: 4,
                  display: 'inline-block',
                }}
              >
                {slaLabel[supplier.sla]}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 4px' }}>
                <FontAwesomeIcon icon={faEye} style={{ marginRight: 4, color: '#0084C0', fontSize: 13 }} />
                Ver completo
              </p>
            </div>
          </div>

          {/* Docs progress */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 8px' }}>Documentation Progress</p>
            <div style={{ width: '100%', backgroundColor: '#EEEEEE', borderRadius: 99, height: 8 }}>
              <div
                style={{
                  height: 8, borderRadius: 99,
                  backgroundColor: '#DC0202',
                  width: `${supplier.docsPercent}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: '#808285', margin: '6px 0 0' }}>{supplier.docsPercent}% complete</p>
          </div>

          {/* Contact */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 6px' }}>Contact</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>Contact info placeholder</p>
          </div>

          {/* Docs checklist */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 10px' }}>Documents Checklist</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['NDA Agreement', 'Quality Certification', 'Financial Assessment', 'Technical Capability'].map((doc, i) => {
                const done = i < Math.ceil(supplier.docsPercent / 25);
                return (
                  <li key={doc} className="flex items-center" style={{ gap: 8, fontSize: 13 }}>
                    <FontAwesomeIcon
                      icon={done ? faCheckCircle : faCircle}
                      style={{ fontSize: 14, color: done ? '#6ABF4B' : '#D1D3D4' }}
                    />
                    <span style={{ color: done ? '#000000' : '#9CA3AF' }}>{doc}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
