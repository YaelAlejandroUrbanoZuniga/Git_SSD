import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { blacklistedSuppliers } from '../../data/pipeline-demo';

export function PipelineBlacklisted() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/pipeline')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Volver
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 400 }}>Pipeline</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>&gt;</span>
          <span style={{ color: '#000000' }}>Blacklisted</span>
        </span>
      </nav>

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Blacklisted</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          {blacklistedSuppliers.length} proveedores rechazados
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input type="text" placeholder="Buscar proveedor..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
        {['Commodity', 'Buyer'].map(f => (
          <button key={f} className="flex items-center" style={{ gap: 6, padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
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
              {['Folio', 'Empresa', 'Commodity', 'Tipo de producto', 'Scouting Input', 'Buyer', 'Rechazado por', 'Fecha', 'Motivo'].map(h => (
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
                onClick={() => navigate(`/pipeline/supplier/${s.id}`)}
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
    </div>
  );
}
