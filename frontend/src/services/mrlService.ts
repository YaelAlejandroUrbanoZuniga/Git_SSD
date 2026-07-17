import { apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { MRLRequirement } from '../types';

// MRL requirements are served under the strategy module on the backend
// (`/api/strategy/mrl`); they keep their own service here to match how the
// pages consume them.

export function getMRLRequirements(): Promise<MRLRequirement[]> {
  return apiGet('/strategy/mrl');
}

export function createMRLRequirement(
  input: Partial<MRLRequirement>,
): Promise<MRLRequirement> {
  return apiPost('/strategy/mrl', input);
}

export function updateMRLRequirement(
  id: string,
  patch: Partial<MRLRequirement>,
): Promise<MRLRequirement> {
  return apiPatch(`/strategy/mrl/${id}`, patch);
}

export function deleteMRLRequirement(id: string): Promise<void> {
  return apiDelete(`/strategy/mrl/${id}`);
}
