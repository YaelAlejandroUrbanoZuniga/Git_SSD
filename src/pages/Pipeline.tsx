import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { suppliers, Supplier } from '../data/demo';
import { SupplierDrawer } from '../components/SupplierDrawer';

const slaColors: Record<string, string> = {
  green: '#6ABF4B',
  yellow: '#D4A017',
  red: '#DC0202',
};

const kanbanStages = [
  { name: 'Identified',            color: '#6B7280' },
  { name: 'Scouting Event',        color: '#02B3E1' },
  { name: 'B2B',                   color: '#6366F1' },
  { name: 'Parking Lot',           color: '#D4A017' },
  { name: 'Preliminary Evaluation',color: '#E3650B' },
  { name: 'RFQ',                   color: '#6ABF4B' },
  { name: 'Blacklisted',           color: '#DC0202' },
];

function SupplierCard({ supplier, onClick }: { supplier: Supplier; onClick: () => void }) {
  const stageColor = kanbanStages.find(s => s.name === supplier.stage)?.color ?? '#808285';

  return (
    <div
      onClick={onClick}
      className="bg-white card-hover"
      style={{
        borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        padding: 12, border: '1px solid #E0E0E0', cursor: 'pointer',
      }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#000000' }}>{supplier.name}</span>
        <span
          style={{
            backgroundColor: stageColor + '26',
            color: stageColor,
            fontSize: 10, fontWeight: 500,
            padding: '2px 6px', borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {supplier.stage}
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#808285', margin: '0 0 4px' }}>{supplier.category}</p>
      <p style={{ fontSize: 11, color: '#808285', margin: '0 0 10px' }}>Días en etapa: {supplier.daysInStage}</p>
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 99, height: 4 }}>
          <div style={{ height: 4, borderRadius: 99, backgroundColor: '#DC0202', width: `${supplier.docsPercent}%` }} />
        </div>
        <span style={{ fontSize: 10, color: '#808285' }}>Docs {supplier.docsPercent}%</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0, display: 'inline-block' }} />
      </div>
    </div>
  );
}

export function Pipeline() {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getSuppliersByStage = (stageName: string) =>
    suppliers.filter(s => s.stage === stageName);

  return (
    <div>
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Pipeline</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Kanban de seguimiento de proveedores
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }}
          />
          <input
            type="text"
            placeholder="Buscar proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              border: '1px solid #E0E0E0', borderRadius: 6,
              fontSize: 13, color: '#000000',
              backgroundColor: '#FFFFFF', outline: 'none',
            }}
          />
        </div>
        {['Stage', 'Category', 'SLA Status'].map((f) => (
          <button
            key={f}
            className="flex items-center"
            style={{
              gap: 6, padding: '8px 12px',
              border: '1px solid #E0E0E0', borderRadius: 8,
              fontSize: 13, color: '#000000',
              backgroundColor: '#FFFFFF', cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            {f}
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: '#808285' }} />
          </button>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div className="flex" style={{ gap: 16, minWidth: 'max-content' }}>
          {kanbanStages.map((stage) => {
            const stageSuppliers = getSuppliersByStage(stage.name);
            const displayed = stageSuppliers.slice(0, 3);

            return (
              <div key={stage.name} style={{ width: 255, flexShrink: 0 }}>
                {/* Column header */}
                <div className="flex items-center" style={{ gap: 8, marginBottom: 12, padding: '0 2px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontWeight: 500, fontSize: 13, color: '#000000', flex: 1 }}>{stage.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#808285', backgroundColor: '#EEEEEE', padding: '1px 8px', borderRadius: 99 }}>
                    {stageSuppliers.length}
                  </span>
                </div>

                {/* Column body */}
                <div
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.40)',
                    borderRadius: 8, padding: 8,
                    minHeight: 200,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {displayed.map((supplier) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      onClick={() => setSelectedSupplier(supplier)}
                    />
                  ))}
                  {stageSuppliers.length > 3 && (
                    <button
                      style={{ fontSize: 12, fontWeight: 500, color: '#0084C0', textAlign: 'center', padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Ver todos ({stageSuppliers.length})
                    </button>
                  )}
                  {stageSuppliers.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '32px 0', margin: 0 }}>
                      Sin proveedores
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SupplierDrawer supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
    </div>
  );
}
