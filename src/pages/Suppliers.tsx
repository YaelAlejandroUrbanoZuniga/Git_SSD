import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faEye } from '@fortawesome/free-solid-svg-icons';
import { suppliers, Supplier } from '../data/demo';
import { SupplierDrawer } from '../components/SupplierDrawer';

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  active:      { bg: '#6ABF4B26', text: '#6ABF4B', label: 'Active' },
  pending:     { bg: '#D4A01726', text: '#D4A017', label: 'Pending' },
  blacklisted: { bg: '#DC020226', text: '#DC0202', label: 'Blacklisted' },
};

const slaIndicator: Record<string, { dot: string; label: string }> = {
  green:  { dot: '#6ABF4B', label: 'OK' },
  yellow: { dot: '#D4A017', label: 'At Risk' },
  red:    { dot: '#DC0202', label: 'Overdue' },
};

export function Suppliers() {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const filters = ['All', 'Active', 'Pending', 'Blacklisted'];

  return (
    <div>
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Suppliers</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            128 proveedores registrados
          </p>
        </div>
        <button
          className="btn-primary"
          style={{
            backgroundColor: '#DC0202', color: '#FFFFFF',
            fontWeight: 700, fontSize: 14,
            padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: 'pointer',
            transition: 'box-shadow 0.15s ease-out',
          }}
        >
          + Agregar Supplier
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: 1 }}>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }}
          />
          <input
            type="text"
            placeholder="Buscar proveedor..."
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 16,
              paddingTop: 10, paddingBottom: 10,
              border: '1px solid #E0E0E0', borderRadius: 6,
              fontSize: 13, color: '#000000',
              backgroundColor: '#FFFFFF', outline: 'none',
            }}
          />
        </div>
        <div className="flex" style={{ gap: 4 }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              style={{
                padding: '8px 16px', fontSize: 13, borderRadius: 8,
                border: '1px solid',
                cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: filter === f.toLowerCase() ? '#000000' : '#FFFFFF',
                borderColor: filter === f.toLowerCase() ? '#000000' : '#E0E0E0',
                color: filter === f.toLowerCase() ? '#FFFFFF' : '#000000',
                fontWeight: filter === f.toLowerCase() ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          style={{
            padding: '8px 12px', border: '1px solid #E0E0E0',
            borderRadius: 8, fontSize: 13, color: '#000000',
            backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer',
          }}
        >
          <option>By Category</option>
          <option>Auto Parts</option>
          <option>Electronics</option>
          <option>Steel</option>
          <option>Bearings</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
              {['Supplier Name', 'Category', 'Current Stage', 'Status', 'Days in Stage', 'SLA', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 13, fontWeight: 700, color: '#000000' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier, i) => {
              const badge = statusBadge[supplier.status];
              const sla = slaIndicator[supplier.sla];
              return (
                <tr
                  key={supplier.id}
                  style={{
                    borderBottom: i < suppliers.length - 1 ? '1px solid #E0E0E0' : undefined,
                    backgroundColor: i % 2 === 1 ? '#FAFAFA' : '#FFFFFF',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: '#000000' }}>
                    {supplier.name}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#808285' }}>{supplier.category}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#808285' }}>{supplier.stage}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ backgroundColor: badge.bg, color: badge.text, fontSize: 11, fontWeight: 500, padding: '3px 7px', borderRadius: 4 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#808285' }}>{supplier.daysInStage}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: sla.dot, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 13, color: '#808285' }}>{sla.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => setSelectedSupplier(supplier)}
                      className="flex items-center"
                      style={{ gap: 6, fontSize: 13, fontWeight: 500, color: '#0084C0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <FontAwesomeIcon icon={faEye} style={{ fontSize: 13, color: '#0084C0' }} />
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SupplierDrawer supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
    </div>
  );
}
