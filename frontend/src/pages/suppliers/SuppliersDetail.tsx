import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import type { TrackerSupplier } from '../../types';
import { getSupplierById } from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { LoadingState } from '../../components/LoadingState';
import { moduleIcons } from '../../components/moduleIcons';
import { SupplierDetailBody } from '../tracker/TrackerSupplierDetail';
import { BRAND_COLORS } from '../../constants/designTokens';

export function SuppliersDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const toast = useToast();
  const [supplier, setSupplier] = useState<TrackerSupplier | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setLoading(true);
    getSupplierById(supplierId)
      .then(s => { if (!cancelled) setSupplier(s); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load the supplier.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplierId, toast]);

  if (loading) return <LoadingState entity="Supplier" icon={moduleIcons.suppliers} fill />;
  if (!supplier) return <p style={{ padding: 32, color: BRAND_COLORS.sidebar }}>Supplier not found.</p>;

  // Terminal suppliers have their own detail screens.
  if ('rejectionReason' in supplier) {
    return <Navigate to={`/tracker/blacklisted/supplier/${supplierId}?from=suppliers`} replace />;
  }
  if ('completedDate' in supplier) {
    return <Navigate to={`/tracker/completed/supplier/${supplierId}`} replace />;
  }

  return <SupplierDetailBody supplier={supplier} origin="suppliers" />;
}
