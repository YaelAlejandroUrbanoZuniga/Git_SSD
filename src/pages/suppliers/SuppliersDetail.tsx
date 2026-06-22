import { useParams } from 'react-router-dom';
import { pipelineSuppliers, blacklistedSuppliers } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { SupplierDetailBody } from '../pipeline/PipelineSupplierDetail';

export function SuppliersDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();

  const supplier: PipelineSupplier | undefined =
    pipelineSuppliers.find(s => s.id === supplierId) ??
    (blacklistedSuppliers.find(s => s.id === supplierId) as PipelineSupplier | undefined);

  if (!supplier) {
    return <p style={{ padding: 32, color: '#808285' }}>Supplier not found.</p>;
  }

  return <SupplierDetailBody supplier={supplier} origin="suppliers" />;
}
