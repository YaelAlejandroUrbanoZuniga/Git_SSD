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

export async function listNotifications(prisma: PrismaClient) {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(n => ({
    id: n.id,
    message: n.message,
    time: relativeLabel(n.createdAt),
    type: n.type,
    read: n.read,
    link: n.link,
  }));
}

export async function markNotificationRead(prisma: PrismaClient, id: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Notification ${id} not found`);
  const n = await prisma.notification.update({ where: { id }, data: { read: true } });
  return {
    id: n.id, message: n.message, time: relativeLabel(n.createdAt),
    type: n.type, read: n.read, link: n.link,
  };
}

export async function markAllNotificationsRead(prisma: PrismaClient) {
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
}
