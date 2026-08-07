import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../domain/errors';

/**
 * WHAT happened — the domain event behind the notification. Deliberately
 * SEPARATE from the severity `type` (info | warning | error): the severity says
 * how loud the notification is, the category says what it is about, and the
 * panel picks its icon and colour from the category.
 *
 * Stored in T_User_Notification.Category (nullable). Rows written before
 * 2026-08-07 carry `null` and fall back to the severity styling.
 */
export type NotificationCategory =
  | 'supplier_created'
  | 'stage_advanced'
  | 'blacklisted'
  | 'event_created'
  | 'event_updated';

/** Spanish relative label matching the frontend's demo format ('hace 1h'). */
function relativeLabel(from: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/** Row → DTO. `time` stays the display label; `createdAt` is the instant the
 *  panel filters on (its "All" tab shows the last 7 days, which cannot be
 *  derived reliably from the label). */
function toNotificationDTO(n: {
  id: string;
  message: string;
  type: string;
  category: string | null;
  read: boolean;
  link: string | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    message: n.message,
    time: relativeLabel(n.createdAt),
    type: n.type,
    category: n.category,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Only the notifications owned by `userId` (never everyone's). */
export async function listNotifications(prisma: PrismaClient, userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toNotificationDTO);
}

/** Marks one notification read — only if it belongs to `userId` (404 otherwise). */
export async function markNotificationRead(prisma: PrismaClient, id: string, userId: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  // Don't reveal that a notification exists for another user: 404 either way.
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError(`Notification ${id} not found`);
  }
  const n = await prisma.notification.update({ where: { id }, data: { read: true } });
  return toNotificationDTO(n);
}

/** Marks all of `userId`'s unread notifications as read (never touches others'). */
export async function markAllNotificationsRead(prisma: PrismaClient, userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/**
 * Deletes the given notifications — only if every one of them belongs to
 * `userId`. Ownership is checked the same way `markNotificationRead` does it:
 * a row that exists but belongs to someone else is a **404**, never a 403, so
 * the caller cannot probe for other users' notification ids.
 *
 * All-or-nothing: one foreign id aborts the whole batch before anything is
 * removed, so a partially-deleted selection can't happen.
 */
export async function deleteNotifications(prisma: PrismaClient, ids: string[], userId: string) {
  if (ids.length === 0) throw new ValidationError('At least one notification id is required');

  const rows = await prisma.notification.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true },
  });
  const ownedIds = new Set(rows.filter(r => r.userId === userId).map(r => r.id));
  const foreign = ids.find(id => !ownedIds.has(id));
  if (foreign) throw new NotFoundError(`Notification ${foreign} not found`);

  // `userId` stays in the where-clause as a second line of defence.
  const res = await prisma.notification.deleteMany({ where: { id: { in: ids }, userId } });
  return { deleted: res.count };
}

/** Deletes every notification owned by `userId` (never touches others'). */
export async function deleteAllNotifications(prisma: PrismaClient, userId: string) {
  const res = await prisma.notification.deleteMany({ where: { userId } });
  return { deleted: res.count };
}

interface NotifyInput {
  message: string;
  /** Severity — drives nothing but the fallback styling for old rows. */
  type: 'info' | 'warning' | 'error';
  /** The domain event this notification reports; drives the panel's icon/colour. */
  category: NotificationCategory;
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
      category: input.category,
      read: false,
      link: input.link ?? null,
      userId: u.id,
    })),
  });
}
