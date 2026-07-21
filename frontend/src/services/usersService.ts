import { apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { AppRole } from '../types';

/** A user row as returned by the backend /api/users endpoints. */
export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: AppRole;
}

export function getUsers(): Promise<ManagedUser[]> {
  return apiGet('/users');
}

export function createUser(input: { email: string; role: AppRole }): Promise<ManagedUser> {
  return apiPost('/users', input);
}

export function updateUserRole(id: string, input: { role: AppRole }): Promise<ManagedUser> {
  return apiPatch(`/users/${id}`, input);
}

export function deleteUser(id: string): Promise<void> {
  return apiDelete(`/users/${id}`);
}
