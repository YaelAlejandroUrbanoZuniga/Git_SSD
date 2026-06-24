import { useParams, Navigate } from 'react-router-dom';
import { pipelineSuppliers, blacklistedSuppliers } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { SupplierDetailBody } from '../pipeline/PipelineSupplierDetail';

export function SuppliersDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();

  const isBlacklisted = blacklistedSuppliers.some(s => s.id === supplierId);
  if (isBlacklisted) {
    return <Navigate to={`/pipeline/blacklisted/supplier/${supplierId}?from=suppliers`} replace />;
  }

  const supplier: PipelineSupplier | undefined = pipelineSuppliers.find(s => s.id === supplierId);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return <SupplierDetailBody supplier={supplier} origin="suppliers" />;
}
