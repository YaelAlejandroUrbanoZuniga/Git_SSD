import { notifications } from '../data/demo';
import type { Notification } from '../types';

export function getNotifications(): Promise<Notification[]> {
  return Promise.resolve(notifications);
}
