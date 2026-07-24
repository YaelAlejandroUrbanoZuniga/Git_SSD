import type { PrismaClient } from '@prisma/client';

// Only the client surface this service touches, so an interactive-transaction
// client (`tx`) works here too — same shape trick as notificationsService.
type AuditClient = Pick<PrismaClient, 'auditLog'>;

export interface AuditInput {
  /** Screaming-snake verb: LOGIN_OK, LOGIN_FAILED, EVENT_CREATED, SYSTEM_ERROR… */
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Human-readable sentence. Never just "error" — it's the whole point of the row. */
  detail?: string | null;
  requestId?: string | null;
}

/** NVarChar(1000) on Detail — truncate rather than blow up the insert. */
function fit(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Writes one row to T_Audit_Log **fire-and-forget** — it never blocks or fails
 * the response, exactly like the notification fan-out in eventsService /
 * suppliersService / trackerService. Call sites do NOT await this.
 */
export function logAction(prisma: AuditClient, input: AuditInput): void {
  try {
    // Promise.resolve() so a synchronous throw (or a non-promise stub) can't
    // escape: an audit write must never turn a working request into a 500.
    Promise.resolve(
      prisma.auditLog.create({
        data: {
          requestId: fit(input.requestId, 20),
          action: fit(input.action, 100) ?? 'UNKNOWN',
          userId: fit(input.userId, 50),
          userEmail: fit(input.userEmail, 200),
          entityType: fit(input.entityType, 50),
          entityId: fit(input.entityId, 50),
          detail: fit(input.detail, 1000),
        },
      }),
    ).catch(err => console.error('[audit] logAction failed:', input.action, err));
  } catch (err) {
    console.error('[audit] logAction failed:', input.action, err);
  }
}
