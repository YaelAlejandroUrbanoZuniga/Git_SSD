import { apiDelete, apiGet, apiPatch, apiPost } from './api.config';
import type { Notification } from '../types';

export function getNotifications(): Promise<Notification[]> {
  return apiGet('/notifications');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiPatch(`/notifications/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<void> {
  return apiPost('/notifications/read-all', {});
}

/**
 * Deletes a selection. The backend refuses the whole batch with a 404 if any id
 * is not the caller's, so a partial delete cannot happen.
 * A POST because the id list travels in the body.
 */
export function deleteNotifications(ids: string[]): Promise<void> {
  return apiPost('/notifications/delete', { ids });
}

/** Deletes every notification the signed-in user owns. */
export function deleteAllNotifications(): Promise<void> {
  return apiDelete('/notifications');
}
