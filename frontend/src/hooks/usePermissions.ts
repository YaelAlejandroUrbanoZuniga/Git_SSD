import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types';

/**
 * Coarse write-permission gate. `canWrite` is true for the operational writer
 * roles (SSD/PM/Buyer) and false for read-only SQD and Guest — mirroring the
 * backend's OPERATIONAL_WRITE_ROLES so the UI hides what the API would 403.
 *
 * Deliberately a single global boolean for now. When RASIC defines permissions
 * per module/activity, expand THIS hook (e.g. `canWrite(module)`), not every
 * page — the call sites already funnel through here.
 */
const WRITE_ROLES: AppRole[] = ['SSD', 'PM', 'Buyer'];

export function usePermissions() {
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  return { canWrite, role: user?.role ?? null };
}
