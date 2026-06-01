import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, PipelineSupplier } from '../../data/pipeline-demo';
import { SupplierDetailBody } from '../pipeline/PipelineSupplierDetail';

export function SuppliersDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const supplier: PipelineSupplier | undefined =
    pipelineSuppliers.find(s => s.id === supplierId) ??
    (blacklistedSuppliers.find(s => s.id === supplierId) as PipelineSupplier | undefined);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/suppliers')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Back
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/suppliers" style={{ color: '#0084C0', textDecoration: 'none' }}>Suppliers</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#000000' }}>{supplier.name}</span>
        </span>
      </nav>

      <SupplierDetailBody supplier={supplier} />
    </div>
  );
}
