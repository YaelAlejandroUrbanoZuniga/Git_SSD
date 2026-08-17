import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSupplierNote,
  deleteSupplierNote,
  updateSupplierNote,
} from '../../src/services/notesService';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/errors';
import type { AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, fakeSupplierRow, type MockPrisma } from '../helpers/mockPrisma';

const ana: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };
const carlos: AuthUser = { id: 'u2', username: 'carlos.mendoza', displayName: 'Carlos Mendoza', role: 'SSD' };

const existingNote = {
  id: 'note-1',
  supplierId: 'ps1',
  text: 'original',
  author: 'Ana García',
  role: 'Buyer',
  date: '2026-06-01',
  stageId: 2,
  // stage is now an FK relation; updateSupplierNote reads updated.stage.name
  stage: { id: 2, name: 'Parking Lot' },
  createdAt: new Date(),
};

describe('supplier notes', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('tags new notes with the supplier current stage', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));
    mock.supplierNote.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...existingNote,
      ...data,
    }));

    const note = await addSupplierNote(asPrisma(mock), 'ps1', 'Primer contacto con el proveedor', ana);

    expect(note.stage).toBe('Parking Lot');
    expect(note.author).toBe('Ana García');
  });

  it('rejects empty note text', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    await expect(addSupplierNote(asPrisma(mock), 'ps1', '   ', ana)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects too-short / junk note text via the shared rule', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    await expect(addSupplierNote(asPrisma(mock), 'ps1', 'ok', ana)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('only the author can edit a note', async () => {
    mock.supplierNote.findUnique.mockResolvedValue(existingNote);
    await expect(
      updateSupplierNote(asPrisma(mock), 'ps1', 'note-1', 'hacked', carlos),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mock.supplierNote.update).not.toHaveBeenCalled();
  });

  it('the author can edit their note', async () => {
    mock.supplierNote.findUnique.mockResolvedValue(existingNote);
    mock.supplierNote.update.mockResolvedValue({ ...existingNote, text: 'Edited note content' });

    const note = await updateSupplierNote(asPrisma(mock), 'ps1', 'note-1', 'Edited note content', ana);
    expect(note.text).toBe('Edited note content');
  });

  it('only the author can delete a note', async () => {
    mock.supplierNote.findUnique.mockResolvedValue(existingNote);
    await expect(
      deleteSupplierNote(asPrisma(mock), 'ps1', 'note-1', carlos),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mock.supplierNote.delete).not.toHaveBeenCalled();

    await deleteSupplierNote(asPrisma(mock), 'ps1', 'note-1', ana);
    expect(mock.supplierNote.delete).toHaveBeenCalledOnce();
  });

  // Ownership is checked by user id when the note carries one; the stored
  // display name is only the fallback for notes without an authorId.
  it('ownership follows the author id, not the display name', async () => {
    // Same display name as Ana, different person.
    const impostor: AuthUser = { ...carlos, displayName: 'Ana García' };
    mock.supplierNote.findUnique.mockResolvedValue({ ...existingNote, authorId: ana.id });

    await expect(
      updateSupplierNote(asPrisma(mock), 'ps1', 'note-1', 'hacked', impostor),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mock.supplierNote.update).not.toHaveBeenCalled();
  });

  it('the author keeps their note after AD changes their display name', async () => {
    const renamed: AuthUser = { ...ana, displayName: 'Ana García López' };
    mock.supplierNote.findUnique.mockResolvedValue({ ...existingNote, authorId: ana.id });
    mock.supplierNote.update.mockResolvedValue({ ...existingNote, text: 'Edited note content' });

    const note = await updateSupplierNote(
      asPrisma(mock), 'ps1', 'note-1', 'Edited note content', renamed,
    );
    expect(note.text).toBe('Edited note content');
  });

  it('404s when the note belongs to another supplier', async () => {
    mock.supplierNote.findUnique.mockResolvedValue({ ...existingNote, supplierId: 'ps2' });
    await expect(
      updateSupplierNote(asPrisma(mock), 'ps1', 'note-1', 'x', ana),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
