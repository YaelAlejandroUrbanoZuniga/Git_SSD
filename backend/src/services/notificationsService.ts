import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../domain/errors';
import { OPERATIONAL_READ_ROLES } from '../middleware/auth';

/**
 * WHAT happened — the domain event behind the notification. Deliberately
 * SEPARATE from the severity `type` (info | warning | error): the severity says
 * how loud the notification is, the category says what it is about, and the
 * panel picks its icon and colour from the category.
 *
 * The tracker events are **granular per stage**, not one generic value each:
 * `supplier_created_*`, `supplier_updated_*` and `stage_advanced_*` name the
 * stage the fact belongs to, so the panel can paint each row with that stage's
 * own colour/icon from the frontend's `TRACKER_STAGE_CONFIG` instead of a
 * parallel notification palette. The suffixes match the stage names:
 * `scouting` | `parking` | `preliminary` | `supplier_eval` | `intelex`
 * (+ `completed`, only reachable as a stage advance).
 *
 * `blacklisted`, the two `event_*`, `strategy_updated` and the three `mrl_*`
 * stay flat: they belong to modules outside the tracker board, so there is no
 * stage to name.
 *
 * Stored in T_User_Notification.Category (nullable, NVARCHAR(30) — the longest
 * value, `supplier_updated_supplier_eval`, is exactly 30 characters). Rows
 * written before 2026-08-07 carry `null` and fall back to the severity styling.
 */
export type NotificationCategory =
  | 'supplier_created_scouting'
  | 'supplier_created_parking'
  | 'supplier_updated_scouting'
  | 'supplier_updated_parking'
  | 'supplier_updated_preliminary'
  | 'supplier_updated_supplier_eval'
  | 'supplier_updated_intelex'
  | 'stage_advanced_scouting'
  | 'stage_advanced_parking'
  | 'stage_advanced_preliminary'
  | 'stage_advanced_supplier_eval'
  | 'stage_advanced_intelex'
  | 'stage_advanced_completed'
  | 'blacklisted'
  | 'event_created'
  | 'event_updated'
  | 'strategy_updated'
  | 'mrl_created'
  | 'mrl_updated'
  | 'mrl_deleted';

/**
 * Stage name → the suffix its granular categories carry. One map, so the two
 * helpers below can never drift apart from each other.
 *
 * 'Blacklisted' is absent on purpose: leaving the board that way is its own
 * flat `blacklisted` category, never a stage advance.
 */
const STAGE_SUFFIX: Record<string, string> = {
  'Scouting Event': 'scouting',
  'Parking Lot': 'parking',
  'Preliminary Evaluation': 'preliminary',
  'Supplier Evaluation': 'supplier_eval',
  'Intelex Handoff': 'intelex',
  Completed: 'completed',
};

/**
 * The category for "a supplier just arrived at `newStage`".
 *
 * `moveSupplierToStage` is the only caller and it has already rejected every
 * name that is not one of the six above ('Blacklisted' included), so the
 * fallback is unreachable in practice — it exists so adding a stage cannot turn
 * a notification into a type error at the call site.
 */
export function categoryForStageAdvance(newStage: string): NotificationCategory {
  const suffix = STAGE_SUFFIX[newStage];
  return (suffix ? `stage_advanced_${suffix}` : 'stage_advanced_scouting') as NotificationCategory;
}

/**
 * The category for "somebody edited a supplier sitting in `stage`".
 *
 * 'Completed' and 'Blacklisted' fall back to `supplier_updated_scouting`: a
 * closed record has left the board, so no stage colour would mean anything on
 * it, and the neutral first-stage styling beats inventing a category for an edit
 * the tracker no longer tracks. (Same fallback the TEST backfill script uses for
 * old rows whose stage cannot be recovered — see
 * `sql/2026-08-25_backfill_notification_categories.sql`.)
 */
export function categoryForSupplierUpdate(stage: string): NotificationCategory {
  const suffix = STAGE_SUFFIX[stage];
  return (suffix && suffix !== 'completed'
    ? `supplier_updated_${suffix}`
    : 'supplier_updated_scouting') as NotificationCategory;
}

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
 *  panel sorts on and derives its relative-time label from — not a filter
 *  input, both tabs show the full, unfiltered list. */
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
  /**
   * The user who performed the action. They are the one person who already
   * knows it happened, so they are excluded from the fan-out — nobody is ever
   * notified of their own save. `null`/omitted notifies everyone (only for
   * events with no human actor).
   */
  excludeUserId?: string | null;
}

// Accepts either the full client or an interactive-transaction client (`tx`),
// so call sites can notify atomically inside a $transaction.
type NotifyClient = Pick<PrismaClient, 'user' | 'notification'>;

/** T_User_Notification column limits — a long message is trimmed, never dropped. */
const MESSAGE_MAX = 500;
const LINK_MAX = 300;

/**
 * Fan-out notification to every user with operational visibility **except the
 * actor** (one row each).
 *
 * The audience is no longer role SSD alone: PM, Buyer and SQD all reach the
 * notification panel (`/api/notifications` has no role guard — see "Roles y
 * control de acceso"), and these domain events are exactly what they need to
 * see even though they cannot write them. There is still no finer
 * per-role/per-commodity targeting.
 *
 * `Guest` is the one account type deliberately left out: it is 403'd from every
 * operational module, and these messages carry supplier names, commodities and
 * links a Guest cannot open. `/api/home/summary` being aggregate-only is the
 * documented boundary keeping supplier identity away from Guest — notifying
 * them here would walk straight around it. Hence `OPERATIONAL_READ_ROLES`,
 * the same list that gates the read routes, rather than "every row in C_User".
 *
 * Exactly **one row per recipient per save operation** — call sites pass a
 * single message summarizing everything the save changed, never one call per
 * changed field.
 */
export async function notifyTeam(prisma: NotifyClient, input: NotifyInput): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      role: { is: { name: { in: OPERATIONAL_READ_ROLES } } },
      // The actor is dropped in SQL, not filtered afterwards.
      ...(input.excludeUserId ? { NOT: { id: input.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map(u => ({
      id: `notif-${randomUUID()}`,
      message: input.message.slice(0, MESSAGE_MAX),
      type: input.type,
      category: input.category,
      read: false,
      link: input.link ? input.link.slice(0, LINK_MAX) : null,
      userId: u.id,
    })),
  });
}

/** How many changed-field labels a message spells out before summarizing. */
const MAX_LISTED_FIELDS = 8;

/**
 * `'DUNS, País, Buyer, Website'` — or `'… y 4 más'` past `MAX_LISTED_FIELDS`.
 * Shared by every "N campos changed" message so a save touching thirty fields
 * still fits in `Message` and stays readable.
 */
export function summarizeChangedFields(labels: string[]): string {
  const listed = labels.slice(0, MAX_LISTED_FIELDS);
  const extra = labels.length - listed.length;
  return extra > 0 ? `${listed.join(', ')} y ${extra} más` : listed.join(', ');
}
