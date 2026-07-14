import { useParams, Navigate } from 'react-router-dom';
import { pipelineSuppliers, blacklistedSuppliers, completedSuppliers } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { SupplierDetailBody } from '../tracker/TrackerSupplierDetail';

export function SuppliersDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();

  const isBlacklisted = blacklistedSuppliers.some(s => s.id === supplierId);
  if (isBlacklisted) {
    return <Navigate to={`/tracker/blacklisted/supplier/${supplierId}?from=suppliers`} replace />;
  }

  const isCompleted = completedSuppliers.some(s => s.id === supplierId);
  if (isCompleted) {
    return <Navigate to={`/tracker/completed/supplier/${supplierId}`} replace />;
  }

  const supplier: PipelineSupplier | undefined = pipelineSuppliers.find(s => s.id === supplierId);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return <SupplierDetailBody supplier={supplier} origin="suppliers" />;
}
