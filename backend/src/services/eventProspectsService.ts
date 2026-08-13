import { randomUUID } from 'node:crypto';
import type { EventProspect, PrismaClient } from '@prisma/client';
import { todayISO } from '../domain/constants';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors';
import {
  MAX_PROSPECT_IMPORT_ROWS,
  interestDeadline,
  isInterestDeadlinePassed,
  isValidB2bDateTime,
  normalizeCompanyName,
} from '../domain/eventProspects';
import type { AuthUser } from '../middleware/auth';
import { logAction } from './auditService';

// Pre-event prospects for a scouting event. A prospect is NOT a supplier: this
// file never reads or writes the supplier table, and that is a rule, not an
// accident — see the header of sql/2026-08-13_add_event_prospect.sql for what
// contaminating the tracker with prospects would break.
//
// Interest is a single marker owned by one person: the second person to mark
// gets a 409, and anyone but the owner trying to unmark gets a 403. Nothing here
// silently overwrites an interest somebody already recorded.

function toProspectDTO(p: EventProspect) {
  return {
    id: p.id,
    eventId: p.eventId,
    companyName: p.companyName,
    productType: p.productType,
    website: p.website,
    interested: isMarked(p),
    /** Display name, for the list. */
    interestedBy: p.interestedBy,
    /** The owner's user id — the frontend compares it against the current user
     *  to decide whether to show the unmark control at all. */
    interestedById: p.interestedById,
    interestedAt: p.interestedAt?.toISOString() ?? null,
    b2bScheduled: p.b2bScheduled,
    b2bDateTime: p.b2bDateTime,
    b2bLocation: p.b2bLocation,
    b2bSetBy: p.b2bSetBy,
    b2bSetAt: p.b2bSetAt?.toISOString() ?? null,
    sourceFileName: p.sourceFileName,
    importBatchId: p.importBatchId,
    importedBy: p.importedBy,
    importedAt: p.importedAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Marked by someone — the three Interested* columns are always written together. */
function isMarked(p: EventProspect): boolean {
  return p.interestedAt !== null || p.interestedById !== null || p.interestedBy !== null;
}

/**
 * Is `actor` the person who marked this prospect? By user id when one was
 * stored; by display name otherwise — `interestedById` is null for a mark made
 * by an identity with no C_User row (the AUTH_OPTIONAL demo user, see
 * `resolveInterestedById`), and such a mark must still be unmarkable by them.
 */
function isInterestOwner(p: EventProspect, actor: AuthUser): boolean {
  if (p.interestedById !== null) return p.interestedById === actor.id;
  return p.interestedBy !== null && p.interestedBy === actor.displayName;
}

/**
 * FK_InterestedByUser points at C_User, so it can only carry an id that really
 * exists there. Under AUTH_OPTIONAL the actor is DEMO_USER, whose id has no row
 * — storing it would fail the constraint, so the mark is recorded by display
 * name alone (ownership still works, see `isInterestOwner`).
 */
async function resolveInterestedById(prisma: PrismaClient, actor: AuthUser): Promise<string | null> {
  if (!actor.id) return null;
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { id: true } });
  return user?.id ?? null;
}

async function getEventOrThrow(prisma: PrismaClient, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError(`Event ${eventId} not found`);
  return event;
}

async function getProspectOrThrow(prisma: PrismaClient, eventId: string, prospectId: number) {
  const prospect = await prisma.eventProspect.findUnique({ where: { id: prospectId } });
  // A prospect of another event is a 404, not a 403 — the endpoint must not
  // confirm that an id exists somewhere else.
  if (!prospect || prospect.eventId !== eventId) {
    throw new NotFoundError(`Prospect ${prospectId} not found`);
  }
  return prospect;
}

export async function listProspects(prisma: PrismaClient, eventId: string) {
  const event = await getEventOrThrow(prisma, eventId);
  const rows = await prisma.eventProspect.findMany({
    where: { eventId },
    orderBy: { companyName: 'asc' },
  });

  // The window is anchored on the OLDEST import: the earliest list is the one
  // people have had the longest to react to.
  const oldestImport = rows.reduce<Date | null>(
    (min, r) => (min === null || r.importedAt < min ? r.importedAt : min),
    null,
  );
  const deadline = oldestImport
    ? interestDeadline(oldestImport.toISOString(), event.dateStart)
    : null;

  const interested = rows.filter(isMarked).length;
  return {
    prospects: rows.map(toProspectDTO),
    meta: {
      interestDeadline: deadline,
      // Advisory only — nothing in this service rejects a write because of it.
      deadlinePassed: isInterestDeadlinePassed(deadline, todayISO()),
      total: rows.length,
      interested,
      unmarked: rows.length - interested,
      b2bScheduled: rows.filter(r => r.b2bScheduled).length,
    },
  };
}

export interface ProspectImportRow {
  companyName: string;
  productType?: string | null;
  website?: string | null;
}

/** '' / whitespace-only / null all mean "the file had nothing here". */
function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function importProspects(
  prisma: PrismaClient,
  eventId: string,
  rows: ProspectImportRow[],
  actor: AuthUser,
  opts?: { sourceFileName?: string },
) {
  await getEventOrThrow(prisma, eventId);
  if (rows.length === 0) throw new ValidationError('The import contains no rows');
  if (rows.length > MAX_PROSPECT_IMPORT_ROWS) {
    throw new ValidationError(
      `An import may contain at most ${MAX_PROSPECT_IMPORT_ROWS} companies (received ${rows.length})`,
    );
  }

  // De-duplicate inside the payload before touching the database: the unique key
  // is (eventId, companyName), so two rows for the same company in one file
  // would otherwise be an upsert fighting itself. First occurrence wins — it is
  // the one the user sees highest in their spreadsheet.
  const seen = new Set<string>();
  const deduped: { companyName: string; productType: string | null; website: string | null }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const companyName = normalizeCompanyName(row.companyName ?? '');
    if (!companyName) {
      skipped++;
      continue;
    }
    const key = companyName.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    deduped.push({
      companyName,
      productType: cleanOptional(row.productType),
      website: cleanOptional(row.website),
    });
  }

  if (deduped.length === 0) throw new ValidationError('The import contains no usable company names');

  const importBatchId = randomUUID();
  const sourceFileName = cleanOptional(opts?.sourceFileName);
  const importedAt = new Date();
  let created = 0;
  let updated = 0;

  for (const row of deduped) {
    const existing = await prisma.eventProspect.findUnique({
      where: { eventId_companyName: { eventId, companyName: row.companyName } },
    });

    if (existing) {
      await prisma.eventProspect.update({
        where: { id: existing.id },
        data: {
          // Only overwrite with something. A re-import from a thinner file must
          // not blank out a product type or website the first list carried.
          ...(row.productType !== null ? { productType: row.productType } : {}),
          ...(row.website !== null ? { website: row.website } : {}),
          // Stamped on UPDATED rows too, not just created ones: "undo this
          // import" has to be able to find every row this call touched.
          importBatchId,
          sourceFileName,
          importedBy: actor.displayName,
          importedAt,
          // interest* and b2b* are deliberately absent from this update. A
          // re-import must never erase a decision somebody already made.
        },
      });
      updated++;
    } else {
      await prisma.eventProspect.create({
        data: {
          eventId,
          companyName: row.companyName,
          productType: row.productType,
          website: row.website,
          importBatchId,
          sourceFileName,
          importedBy: actor.displayName,
          importedAt,
        },
      });
      created++;
    }
  }

  const prospects = await prisma.eventProspect.findMany({
    where: { eventId },
    orderBy: { companyName: 'asc' },
  });

  logAction(prisma, {
    action: 'EVENT_PROSPECTS_IMPORTED',
    userId: actor.id,
    entityType: 'Event',
    entityId: eventId,
    detail:
      `Imported prospects from "${sourceFileName ?? 'unnamed file'}" ` +
      `(batch ${importBatchId}): ${created} created, ${updated} updated, ${skipped} skipped`,
  });

  return { created, updated, skipped, importBatchId, prospects: prospects.map(toProspectDTO) };
}

/**
 * Undo one Excel import. SSD only — this is a correction of an operator's
 * mistake, not a business discard, which is why it hard-deletes: an unmarked
 * prospect is never deleted for being unmarked (that silence is data), but rows
 * that should never have existed are removed outright.
 */
export async function deleteImportBatch(
  prisma: PrismaClient,
  eventId: string,
  importBatchId: string,
  actor: AuthUser,
) {
  // The route already gates this with requireRole('SSD'); re-checked here so the
  // rule survives the service being called from anywhere else.
  if (actor.role !== 'SSD') throw new ForbiddenError('Only SSD can delete a prospect import');

  await getEventOrThrow(prisma, eventId);
  const count = await prisma.eventProspect.count({ where: { eventId, importBatchId } });
  if (count === 0) throw new NotFoundError(`Import batch ${importBatchId} not found on event ${eventId}`);

  // Scoped by eventId too, so a batch id can never reach across events.
  const result = await prisma.eventProspect.deleteMany({ where: { eventId, importBatchId } });

  logAction(prisma, {
    action: 'EVENT_PROSPECT_IMPORT_DELETED',
    userId: actor.id,
    entityType: 'Event',
    entityId: eventId,
    detail: `Deleted prospect import batch ${importBatchId}: ${result.count} prospect(s) removed`,
  });

  return { deleted: result.count, importBatchId };
}

/** Mark interested. Idempotent for the owner, 409 for anybody else. */
export async function setProspectInterest(
  prisma: PrismaClient,
  eventId: string,
  prospectId: number,
  actor: AuthUser,
) {
  const prospect = await getProspectOrThrow(prisma, eventId, prospectId);

  if (isMarked(prospect)) {
    // Re-marking your own is a no-op, not an error — a double click must not 409.
    if (isInterestOwner(prospect, actor)) return toProspectDTO(prospect);
    throw new ConflictError(
      `${prospect.companyName} was already marked as interesting by ${prospect.interestedBy ?? 'another user'}`,
    );
  }

  const updated = await prisma.eventProspect.update({
    where: { id: prospect.id },
    data: {
      interestedBy: actor.displayName,
      interestedById: await resolveInterestedById(prisma, actor),
      interestedAt: new Date(),
    },
  });

  logAction(prisma, {
    action: 'EVENT_PROSPECT_INTEREST_SET',
    userId: actor.id,
    entityType: 'EventProspect',
    entityId: String(prospect.id),
    detail: `${actor.displayName} marked interest in "${prospect.companyName}" (event ${eventId})`,
  });

  return toProspectDTO(updated);
}

/** Unmark. Only the person who marked it may do this — SSD included. */
export async function unsetProspectInterest(
  prisma: PrismaClient,
  eventId: string,
  prospectId: number,
  actor: AuthUser,
) {
  const prospect = await getProspectOrThrow(prisma, eventId, prospectId);

  // Already unmarked — nothing to undo.
  if (!isMarked(prospect)) return toProspectDTO(prospect);

  if (!isInterestOwner(prospect, actor)) {
    // SSD is NOT special-cased: removing someone else's recorded interest is a
    // different, explicit act. Today the only way is deleteImportBatch.
    throw new ForbiddenError(
      `Only ${prospect.interestedBy ?? 'the user who marked it'} can remove this interest`,
    );
  }

  const updated = await prisma.eventProspect.update({
    where: { id: prospect.id },
    data: { interestedBy: null, interestedById: null, interestedAt: null },
  });

  logAction(prisma, {
    action: 'EVENT_PROSPECT_INTEREST_UNSET',
    userId: actor.id,
    entityType: 'EventProspect',
    entityId: String(prospect.id),
    detail: `${actor.displayName} removed their interest in "${prospect.companyName}" (event ${eventId})`,
  });

  return toProspectDTO(updated);
}

export interface ProspectB2bInput {
  b2bScheduled: boolean;
  b2bDateTime?: string | null;
  b2bLocation?: string | null;
}

/** Schedule (or unschedule) the B2B meeting SSD arranges with a prospect. */
export async function setProspectB2b(
  prisma: PrismaClient,
  eventId: string,
  prospectId: number,
  input: ProspectB2bInput,
  actor: AuthUser,
) {
  const prospect = await getProspectOrThrow(prisma, eventId, prospectId);

  let b2bDateTime: string | null = null;
  let b2bLocation: string | null = null;

  if (input.b2bScheduled) {
    const when = cleanOptional(input.b2bDateTime);
    // A scheduled meeting without a time is not a schedule.
    if (!when) throw new ValidationError('b2bDateTime is required when b2bScheduled is true');
    if (!isValidB2bDateTime(when)) {
      throw new ValidationError(`b2bDateTime must be a valid 'YYYY-MM-DDTHH:mm' value (received "${when}")`);
    }
    b2bDateTime = when;
    b2bLocation = cleanOptional(input.b2bLocation);
  }
  // When unscheduled both are nulled out above — a stale time/room left behind
  // on a cancelled meeting is worse than no data.

  const updated = await prisma.eventProspect.update({
    where: { id: prospect.id },
    data: {
      b2bScheduled: input.b2bScheduled,
      b2bDateTime,
      b2bLocation,
      b2bSetBy: actor.displayName,
      b2bSetAt: new Date(),
    },
  });

  logAction(prisma, {
    action: 'EVENT_PROSPECT_B2B_SET',
    userId: actor.id,
    entityType: 'EventProspect',
    entityId: String(prospect.id),
    detail: input.b2bScheduled
      ? `${actor.displayName} scheduled a B2B with "${prospect.companyName}" at ${b2bDateTime}` +
        `${b2bLocation ? ` (${b2bLocation})` : ''} (event ${eventId})`
      : `${actor.displayName} cancelled the B2B with "${prospect.companyName}" (event ${eventId})`,
  });

  return toProspectDTO(updated);
}
