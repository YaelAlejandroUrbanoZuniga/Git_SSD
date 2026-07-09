import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { todayISO } from '../domain/constants';
import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors';
import type { AuthUser } from '../middleware/auth';

// Supplier notes are stage-tagged, and edit/delete is restricted to the
// original author. Enforced here (service layer), not just in the UI.
// Ownership is by author display name — same convention as the frontend
// (NotesSidePanel compares note.author to the current user's name).

function assertText(text: unknown): string {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new ValidationError('Note text is required');
  return trimmed;
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
  const note = await prisma.supplierNote.create({
    data: {
      id: `note-${randomUUID()}`,
      supplier: { connect: { id: supplierId } },
      text: assertText(text),
      author: actor.displayName,
      role: actor.role,
      date: todayISO(),
      stage: { connect: { name: stageName } },
    },
  });
  return {
    id: note.id, text: note.text, author: note.author,
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
  if (note.author !== actor.displayName) {
    throw new ForbiddenError('Only the original author can edit this note');
  }
  const updated = await prisma.supplierNote.update({
    where: { id: noteId },
    data: { text: assertText(text) },
    include: { stage: true },
  });
  return {
    id: updated.id, text: updated.text, author: updated.author,
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
  if (note.author !== actor.displayName) {
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
      text: assertText(text),
      author: actor.displayName,
      role: actor.role,
      date: todayISO(),
    },
  });
  return { id: note.id, text: note.text, author: note.author, role: note.role, date: note.date };
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
  if (note.author !== actor.displayName) {
    throw new ForbiddenError('Only the original author can edit this note');
  }
  const updated = await prisma.eventNote.update({
    where: { id: noteId },
    data: { text: assertText(text) },
  });
  return { id: updated.id, text: updated.text, author: updated.author, role: updated.role, date: updated.date };
}

export async function deleteEventNote(
  prisma: PrismaClient,
  eventId: string,
  noteId: string,
  actor: AuthUser,
) {
  const note = await prisma.eventNote.findUnique({ where: { id: noteId } });
  if (!note || note.eventId !== eventId) throw new NotFoundError('Note not found');
  if (note.author !== actor.displayName) {
    throw new ForbiddenError('Only the original author can delete this note');
  }
  await prisma.eventNote.delete({ where: { id: noteId } });
}
