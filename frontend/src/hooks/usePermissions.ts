import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types';

/**
 * Coarse write-permission gate. `canWrite` is true only for `SSD` — mirroring
 * the backend's OPERATIONAL_WRITE_ROLES so the UI hides what the API would
 * 403. `PM`/`Buyer`/`SQD` are read-only everywhere this hook gates, with two
 * named exceptions the backend allows outside OPERATIONAL_WRITE_ROLES
 * (supplier/event notes, marking prospect interest) — those are handled
 * locally by their own components, not through this hook.
 *
 * Deliberately a single global boolean. If per-module/per-activity permissions
 * are ever needed, expand THIS hook (e.g. `canWrite(module)`), not every
 * page — the call sites already funnel through here.
 */
const WRITE_ROLES: AppRole[] = ['SSD'];

export function usePermissions() {
  const { user } = useAuth();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  return { canWrite, role: user?.role ?? null };
}
