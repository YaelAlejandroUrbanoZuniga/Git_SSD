import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { EventNote, TrackerSupplier, ScoutingEvent } from '../types';

export function getScoutingEvents(): Promise<ScoutingEvent[]> {
  return apiGet('/events');
}

export function getEventById(id: string): Promise<ScoutingEvent | undefined> {
  return apiGet<ScoutingEvent>(`/events/${id}`).catch(err => {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  });
}

export function createEvent(input: Partial<ScoutingEvent>): Promise<ScoutingEvent> {
  return apiPost('/events', input);
}

export function updateEvent(id: string, patch: Partial<ScoutingEvent>): Promise<ScoutingEvent> {
  return apiPatch(`/events/${id}`, patch);
}

export function deleteEvent(id: string): Promise<void> {
  return apiDelete(`/events/${id}`);
}

/** Creates a new supplier in Scouting Event, linked to this event. */
export function addSupplierToEvent(
  eventId: string,
  input: Record<string, unknown>,
): Promise<TrackerSupplier> {
  return apiPost(`/events/${eventId}/suppliers`, input);
}

/** Links a supplier that already exists to this event. */
export function linkSupplierToEvent(eventId: string, supplierId: string): Promise<void> {
  return apiPost(`/events/${eventId}/suppliers/link`, { supplierId });
}

// ── Notes (only the author may edit/delete) ──────────────────────────────

export function addEventNote(eventId: string, text: string): Promise<EventNote> {
  return apiPost(`/events/${eventId}/notes`, { text });
}

export function editEventNote(eventId: string, noteId: string, text: string): Promise<EventNote> {
  return apiPatch(`/events/${eventId}/notes/${noteId}`, { text });
}

export function deleteEventNote(eventId: string, noteId: string): Promise<void> {
  return apiDelete(`/events/${eventId}/notes/${noteId}`);
}
