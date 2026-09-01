import { apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { EventProspect, EventProspectsResponse } from '../types';

export interface ProspectImportRowInput {
  companyName: string;
  productType?: string | null;
  website?: string | null;
}

export interface ImportProspectsResult {
  created: number;
  updated: number;
  skipped: number;
  importBatchId: string;
  prospects: EventProspect[];
}

export interface DeleteImportBatchResult {
  deleted: number;
  importBatchId: string;
}

export interface ProspectB2bInput {
  b2bScheduled: boolean;
  b2bDateTime?: string | null;
  b2bLocation?: string | null;
}

export function getProspects(eventId: string): Promise<EventProspectsResponse> {
  return apiGet(`/events/${eventId}/prospects`);
}

export function importProspects(
  eventId: string,
  rows: ProspectImportRowInput[],
  sourceFileName?: string,
): Promise<ImportProspectsResult> {
  return apiPost(`/events/${eventId}/prospects/import`, { rows, sourceFileName });
}

/** SSD only — undoes one Excel import (hard delete). */
export function deleteImportBatch(eventId: string, importBatchId: string): Promise<DeleteImportBatchResult> {
  return apiDelete(`/events/${eventId}/prospects/import/${importBatchId}`);
}

/** Any of SSD/PM/Buyer/SDE. 409 if someone else already marked it. */
export function markInterest(eventId: string, prospectId: number): Promise<EventProspect> {
  return apiPost(`/events/${eventId}/prospects/${prospectId}/interest`);
}

/** Owner only — 403 otherwise. */
export function unmarkInterest(eventId: string, prospectId: number): Promise<EventProspect> {
  return apiDelete(`/events/${eventId}/prospects/${prospectId}/interest`);
}

/** SSD only. */
export function setProspectB2b(
  eventId: string,
  prospectId: number,
  input: ProspectB2bInput,
): Promise<EventProspect> {
  return apiPatch(`/events/${eventId}/prospects/${prospectId}/b2b`, input);
}
