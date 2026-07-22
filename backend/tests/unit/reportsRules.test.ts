import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStageSnapshot,
  getWeeklyDiff,
} from '../../src/services/reportsService';
import { createSupplier } from '../../src/services/suppliersService';
import type { AuthUser } from '../../src/middleware/auth';
import {
  asPrisma,
  createMockPrisma,
  fakeSlaCatalog,
  fakeSupplierRow,
  type MockPrisma,
} from '../helpers/mockPrisma';

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };

/** Catalog lookups getSupplierById → syncSupplierSla resolves after a create. */
function stubCatalogs(mock: MockPrisma) {
  mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
  mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
  mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
  mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
  mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
}

// ── Section 0: every new supplier is born with a stage-bearing history entry ──
describe('createSupplier writes the report-foundation history entry', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
  });

  it('creates exactly one history entry: fromStage null, toStage = initial stage', async () => {
    mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
    mock.supplier.findFirst.mockResolvedValue(null); // next folio
    mock.supplier.create.mockResolvedValue({});
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Scouting Event' }));

    await createSupplier(
      asPrisma(mock),
      { name: 'ACME', commodity: 'Machining', entrySource: 'Scouting Event' },
      actor,
    );

    const createArg = mock.supplier.create.mock.calls[0][0] as {
      data: { history: { create: Record<string, unknown> } };
    };
    const history = createArg.data.history.create;
    // A single nested entry (object, not array) — exactly one history row.
    expect(Array.isArray(history)).toBe(false);
    // toStageId points at the initial stage (connected by name).
    expect(history.toStage).toEqual({ connect: { name: 'Scouting Event' } });
    // fromStage is never set ⇒ null in the DB.
    expect(history.fromStage).toBeUndefined();
    expect(history.fromStageId).toBeUndefined();
  });

  it('a Recommendation is born in Parking Lot', async () => {
    mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
    mock.supplier.findFirst.mockResolvedValue(null);
    mock.supplier.create.mockResolvedValue({});
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));

    await createSupplier(
      asPrisma(mock),
      { name: 'Recomendada', commodity: 'Machining', entrySource: 'Recommendation' },
      actor,
    );

    const createArg = mock.supplier.create.mock.calls[0][0] as {
      data: { history: { create: Record<string, unknown> } };
    };
    expect(createArg.data.history.create.toStage).toEqual({ connect: { name: 'Parking Lot' } });
  });
});

// ── getStageSnapshot ──────────────────────────────────────────────────────
describe('getStageSnapshot', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('a supplier created before the date and never moved shows in its initial stage', async () => {
    mock.supplier.findMany.mockResolvedValue([
      { id: 'ps1', commodityId: 1, commodity: { name: 'Machining' } },
    ]);
    // Prisma returns the birth entry (date <= asOf, toStageId set).
    mock.supplierHistoryEntry.findMany.mockResolvedValue([
      { supplierId: 'ps1', toStageId: 2, toStage: { name: 'Parking Lot' } },
    ]);

    const snap = await getStageSnapshot(asPrisma(mock), '2026-07-15');

    expect(snap).toEqual([
      { commodityId: 1, commodityName: 'Machining', stageId: 2, stageName: 'Parking Lot', count: 1 },
    ]);
    expect(mock.supplierHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: { lte: '2026-07-15' }, toStageId: { not: null } }),
      }),
    );
  });

  it('a supplier created AFTER the date is excluded (no history on/before it)', async () => {
    mock.supplier.findMany.mockResolvedValue([
      { id: 'ps1', commodityId: 1, commodity: { name: 'Machining' } },
    ]);
    mock.supplierHistoryEntry.findMany.mockResolvedValue([]); // nothing with date <= asOf

    const snap = await getStageSnapshot(asPrisma(mock), '2026-07-01');
    expect(snap).toEqual([]);
  });

  it('takes only the latest stage-bearing entry per supplier and groups by commodity+stage', async () => {
    mock.supplier.findMany.mockResolvedValue([
      { id: 'ps1', commodityId: 1, commodity: { name: 'Machining' } },
      { id: 'ps2', commodityId: 1, commodity: { name: 'Machining' } },
    ]);
    // Already ordered date desc, so the first per supplier is the latest.
    mock.supplierHistoryEntry.findMany.mockResolvedValue([
      { supplierId: 'ps1', toStageId: 3, toStage: { name: 'Preliminary Evaluation' } },
      { supplierId: 'ps1', toStageId: 2, toStage: { name: 'Parking Lot' } },
      { supplierId: 'ps2', toStageId: 3, toStage: { name: 'Preliminary Evaluation' } },
    ]);

    const snap = await getStageSnapshot(asPrisma(mock), '2026-07-15');
    expect(snap).toEqual([
      { commodityId: 1, commodityName: 'Machining', stageId: 3, stageName: 'Preliminary Evaluation', count: 2 },
    ]);
  });

  it('filters by commodityId', async () => {
    mock.supplier.findMany.mockResolvedValue([]);
    await getStageSnapshot(asPrisma(mock), '2026-07-15', 5);
    expect(mock.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ commodityId: 5 }) }),
    );
  });
});

// ── getWeeklyDiff ─────────────────────────────────────────────────────────
describe('getWeeklyDiff', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
    // Snapshots return empty (covered separately) — keeps this focused on
    // movements/notes and avoids the interleaving of the two snapshot queries.
    mock.supplier.findMany.mockResolvedValue([]);
  });

  it('lists a stage transition with fromStage/toStage and its note', async () => {
    mock.supplierHistoryEntry.findMany.mockResolvedValue([
      {
        supplierId: 'ps1',
        date: '2026-07-18',
        note: 'Advancing after the site visit',
        user: 'Ana García',
        role: 'Buyer',
        supplier: { name: 'ACME', commodityId: 1, commodity: { name: 'Machining' } },
        fromStage: { name: 'Parking Lot' },
        toStage: { name: 'Preliminary Evaluation' },
      },
    ]);
    mock.supplierNote.findMany.mockResolvedValue([]);

    const diff = await getWeeklyDiff(asPrisma(mock), '2026-07-14', '2026-07-21');

    expect(diff).toMatchObject({ from: '2026-07-14', to: '2026-07-21', snapshotFrom: [], snapshotTo: [] });
    expect(diff.movements).toEqual([
      {
        supplierId: 'ps1',
        supplierName: 'ACME',
        commodityId: 1,
        commodityName: 'Machining',
        fromStage: 'Parking Lot',
        toStage: 'Preliminary Evaluation',
        date: '2026-07-18',
        note: 'Advancing after the site visit',
        user: 'Ana García',
        role: 'Buyer',
      },
    ]);
  });

  it('movements query excludes non-transition history (toStageId null) via the where clause', async () => {
    mock.supplierHistoryEntry.findMany.mockResolvedValue([]);
    mock.supplierNote.findMany.mockResolvedValue([]);

    await getWeeklyDiff(asPrisma(mock), '2026-07-14', '2026-07-21');

    expect(mock.supplierHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gt: '2026-07-14', lte: '2026-07-21' },
          toStageId: { not: null },
        }),
      }),
    );
  });

  it('maps notes with a real createdAt instant and a UTC day window', async () => {
    mock.supplierHistoryEntry.findMany.mockResolvedValue([]);
    mock.supplierNote.findMany.mockResolvedValue([
      {
        id: 'note-1',
        supplierId: 'ps1',
        text: 'Called the supplier',
        author: 'Ana García',
        role: 'Buyer',
        date: '2026-07-21',
        createdAt: new Date('2026-07-21T14:45:00.000Z'),
        supplier: { name: 'ACME', commodityId: 1, commodity: { name: 'Machining' } },
        stage: { name: 'Preliminary Evaluation' },
      },
    ]);

    const diff = await getWeeklyDiff(asPrisma(mock), '2026-07-14', '2026-07-21');

    expect(diff.notes).toEqual([
      {
        id: 'note-1',
        supplierId: 'ps1',
        supplierName: 'ACME',
        commodityId: 1,
        commodityName: 'Machining',
        stage: 'Preliminary Evaluation',
        text: 'Called the supplier',
        author: 'Ana García',
        role: 'Buyer',
        date: '2026-07-21',
        createdAt: '2026-07-21T14:45:00.000Z',
      },
    ]);
    // Window is [start of fromISO, start of day AFTER toISO).
    expect(mock.supplierNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-07-14T00:00:00.000Z'),
            lt: new Date('2026-07-22T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('filters both movements and notes by commodityId', async () => {
    mock.supplierHistoryEntry.findMany.mockResolvedValue([]);
    mock.supplierNote.findMany.mockResolvedValue([]);

    await getWeeklyDiff(asPrisma(mock), '2026-07-14', '2026-07-21', 5);

    expect(mock.supplierHistoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ supplier: { is: { commodityId: 5 } } }) }),
    );
    expect(mock.supplierNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ supplier: { is: { commodityId: 5 } } }) }),
    );
    expect(mock.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ commodityId: 5 }) }),
    );
  });
});
