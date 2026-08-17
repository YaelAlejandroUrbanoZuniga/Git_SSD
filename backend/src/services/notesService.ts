import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { todayISO } from '../domain/constants';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import { assertMeaningfulText } from '../domain/textValidation';
import type { AuthUser } from '../middleware/auth';

// Notes are stage-tagged; edit/delete restricted to the author.
// Note text goes through the shared "meaningful text" rule (see textValidation).

/**
 * Is `actor` the author of this note? By user id when one was stored; by display
 * name otherwise. Same rule (and same reasoning) as
 * eventProspectsService.isInterestOwner: `authorId` is null for notes written
 * before the column existed and for notes written by an identity with no C_User
 * row (the AUTH_OPTIONAL demo user), and those must still be editable by their
 * author.
 *
 * Comparing display names ALONE — which is what this used to do — meant two
 * employees sharing a name could edit each other's notes, and anyone whose AD
 * name changed lost access to their own (authService refreshes displayName on
 * every login).
 */
function isNoteOwner(note: { authorId?: string | null; author: string }, actor: AuthUser): boolean {
  if (note.authorId != null) return note.authorId === actor.id;
  return note.author === actor.displayName;
}

/**
 * FK_AuthorUser points at C_User, so it can only carry an id that really exists
 * there. Under AUTH_OPTIONAL the actor is DEMO_USER, whose id has no row —
 * storing it would fail the constraint, so the note is recorded by display name
 * alone (ownership still works, see isNoteOwner). Mirrors
 * eventProspectsService.resolveInterestedById.
 */
async function resolveAuthorId(prisma: PrismaClient, actor: AuthUser): Promise<string | null> {
  if (!actor.id) return null;
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { id: true } });
  return user?.id ?? null;
}

export async function addSupplierNote(
  prisma: PrismaClient,
  supplierId: string,
  text: string,
  actor: AuthUser,
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { stage: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);
  const stageName = supplier.stage.name; // stage-tagged at creation time
  const authorId = await resolveAuthorId(prisma, actor);
  const note = await prisma.supplierNote.create({
    data: {
      id: `note-${randomUUID()}`,
      supplier: { connect: { id: supplierId } },
      text: assertMeaningfulText(text, 'Note text'),
      author: actor.displayName,
      // Relation-connect form (the other FKs here use it too); omitted entirely
      // when there is no C_User row to point at — see resolveAuthorId.
      ...(authorId ? { authorUser: { connect: { id: authorId } } } : {}),
      role: actor.role,
      date: todayISO(),
      stage: { connect: { name: stageName } },
    },
  });
  return {
    id: note.id, text: note.text, author: note.author, authorId: note.authorId,
    role: note.role, date: note.date, stage: stageName,
  };
}

export async function updateSupplierNote(
  prisma: PrismaClient,
  supplierId: string,
  noteId: string,
  text: string,
  actor: AuthUser,
) {
  const note = await prisma.supplierNote.findUnique({ where: { id: noteId } });
  if (!note || note.supplierId !== supplierId) throw new NotFoundError('Note not found');
  if (!isNoteOwner(note, actor)) {
    throw new ForbiddenError('Only the original author can edit this note');
  }
  const updated = await prisma.supplierNote.update({
    where: { id: noteId },
    data: { text: assertMeaningfulText(text, 'Note text') },
    include: { stage: true },
  });
  return {
    id: updated.id, text: updated.text, author: updated.author, authorId: updated.authorId,
    role: updated.role, date: updated.date, stage: updated.stage.name,
  };
}

export async function deleteSupplierNote(
  prisma: PrismaClient,
  supplierId: string,
  noteId: string,
  actor: AuthUser,
) {
  const note = await prisma.supplierNote.findUnique({ where: { id: noteId } });
  if (!note || note.supplierId !== supplierId) throw new NotFoundError('Note not found');
  if (!isNoteOwner(note, actor)) {
    throw new ForbiddenError('Only the original author can delete this note');
  }
  await prisma.supplierNote.delete({ where: { id: noteId } });
}

// ── Event notes (same authorship rule; not stage-tagged) ────────────────

export async function addEventNote(
  prisma: PrismaClient,
  eventId: string,
  text: string,
  actor: AuthUser,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError(`Event ${eventId} not found`);
  const note = await prisma.eventNote.create({
    data: {
      id: `evnote-${randomUUID()}`,
      eventId,
      text: assertMeaningfulText(text, 'Note text'),
      author: actor.displayName,
      authorId: await resolveAuthorId(prisma, actor),
      role: actor.role,
      date: todayISO(),
    },
  });
  return {
    id: note.id, text: note.text, author: note.author, authorId: note.authorId,
    role: note.role, date: note.date,
  };
}

export async function updateEventNote(
  prisma: PrismaClient,
  eventId: string,
  noteId: string,
  text: string,
  actor: AuthUser,
) {
  const note = await prisma.eventNote.findUnique({ where: { id: noteId } });
  if (!note || note.eventId !== eventId) throw new NotFoundError('Note not found');
  if (!isNoteOwner(note, actor)) {
    throw new ForbiddenError('Only the original author can edit this note');
  }
  const updated = await prisma.eventNote.update({
    where: { id: noteId },
    data: { text: assertMeaningfulText(text, 'Note text') },
  });
  return {
    id: updated.id, text: updated.text, author: updated.author, authorId: updated.authorId,
    role: updated.role, date: updated.date,
  };
}

export async function deleteEventNote(
  prisma: PrismaClient,
  eventId: string,
  noteId: string,
  actor: AuthUser,
) {
  const note = await prisma.eventNote.findUnique({ where: { id: noteId } });
  if (!note || note.eventId !== eventId) throw new NotFoundError('Note not found');
  if (!isNoteOwner(note, actor)) {
    throw new ForbiddenError('Only the original author can delete this note');
  }
  await prisma.eventNote.delete({ where: { id: noteId } });
}
