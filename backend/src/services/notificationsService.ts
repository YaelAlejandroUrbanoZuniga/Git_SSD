import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../domain/errors';

/** Spanish relative label matching the frontend's demo format ('hace 1h'). */
export function relativeLabel(from: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/** Only the notifications owned by `userId` (never everyone's). */
export async function listNotifications(prisma: PrismaClient, userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(n => ({
    id: n.id,
    message: n.message,
    time: relativeLabel(n.createdAt),
    type: n.type,
    read: n.read,
    link: n.link,
  }));
}

/** Marks one notification read — only if it belongs to `userId` (404 otherwise). */
export async function markNotificationRead(prisma: PrismaClient, id: string, userId: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  // Don't reveal that a notification exists for another user: 404 either way.
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError(`Notification ${id} not found`);
  }
  const n = await prisma.notification.update({ where: { id }, data: { read: true } });
  return {
    id: n.id, message: n.message, time: relativeLabel(n.createdAt),
    type: n.type, read: n.read, link: n.link,
  };
}

/** Marks all of `userId`'s unread notifications as read (never touches others'). */
export async function markAllNotificationsRead(prisma: PrismaClient, userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export interface NotifyInput {
  message: string;
  type: 'info' | 'warning' | 'error';
  link?: string | null;
}

// Accepts either the full client or an interactive-transaction client (`tx`),
// so call sites can notify atomically inside a $transaction.
type NotifyClient = Pick<PrismaClient, 'user' | 'notification'>;

/**
 * Fan-out notification to every SSD user (one row each).
 * Provisional audience decision: the whole SSD team is notified of every domain
 * event, until the RASIC matrix defines finer per-role/per-commodity audiences.
 */
export async function notifySsdTeam(prisma: NotifyClient, input: NotifyInput): Promise<void> {
  const ssdUsers = await prisma.user.findMany({ where: { role: { is: { name: 'SSD' } } } });
  if (ssdUsers.length === 0) return;
  await prisma.notification.createMany({
    data: ssdUsers.map(u => ({
      id: `notif-${randomUUID()}`,
      message: input.message,
      type: input.type,
      read: false,
      link: input.link ?? null,
      userId: u.id,
    })),
  });
}
