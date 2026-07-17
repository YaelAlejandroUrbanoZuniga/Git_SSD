import { apiGet, apiPatch, apiPost } from './api.config';
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
