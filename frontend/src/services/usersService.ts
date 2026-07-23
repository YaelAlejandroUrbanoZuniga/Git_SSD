import { apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { AppRole } from '../types';

/** A user row as returned by the backend /api/users endpoints. */
export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  supervisorName: string | null;
  role: AppRole;
}

export function getUsers(): Promise<ManagedUser[]> {
  return apiGet('/users');
}

/**
 * Creates or reclaims a user. If the email already belongs to a Guest row (they
 * logged in once, or were pre-provisioned as Guest), the backend promotes that
 * same row to the requested role and flags it with `promotedFromGuest` instead
 * of returning a 409 — so the caller can tailor the success message.
 */
export function createUser(
  input: { email: string; role: AppRole },
): Promise<ManagedUser & { promotedFromGuest?: boolean }> {
  return apiPost('/users', input);
}

export function updateUserRole(id: string, input: { role: AppRole }): Promise<ManagedUser> {
  return apiPatch(`/users/${id}`, input);
}

export function deleteUser(id: string): Promise<void> {
  return apiDelete(`/users/${id}`);
}
