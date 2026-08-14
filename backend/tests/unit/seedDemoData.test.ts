import { describe, expect, it } from 'vitest';
import { seedSupplier, type CatalogIds } from '../../prisma/seed';
import { getStageSnapshot } from '../../src/services/reportsService';
import { pipelineSuppliers } from '../../prisma/fixtures/pipeline-demo';
import { asPrisma, createMockPrisma } from '../helpers/mockPrisma';

/** Minimal catalog maps — only the keys seedSupplier's demo fixture needs. */
function fakeCatalogIds(): CatalogIds {
  return {
    commodity: new Map([['Harnesses', 1]]),
    stage: new Map([['Scouting Event', 1], ['Parking Lot', 2]]),
    status: new Map([['ACTIVE', 1]]),
    subStatus: new Map(),
    sla: new Map([['green', 1]]),
    productCategory: new Map([['Direct', 1]]),
    confidence: new Map(),
    immex: new Map([['No', 1]]),
    role: new Map(),
  };
}

describe('seedSupplier — demo suppliers are reportable (§3 fix)', () => {
  it('writes a birth history entry (fromStage null, toStage = current stage) alongside the free-text history', async () => {
    const mock = createMockPrisma();
    mock.supplier.create.mockResolvedValue({});
    const demoSupplier = pipelineSuppliers[0]; // ps1, stage: 'Scouting Event'

    await seedSupplier(asPrisma(mock), demoSupplier, fakeCatalogIds());

    const createArg = mock.supplier.create.mock.calls[0][0] as {
      data: { history: { create: Record<string, unknown>[] } };
    };
    const history = createArg.data.history.create;
    expect(Array.isArray(history)).toBe(true);
    const birthEntry = history[history.length - 1];
    expect(birthEntry.toStageId).toBe(1); // 'Scouting Event' from fakeCatalogIds
    expect(birthEntry.fromStageId).toBeUndefined();
  });

  it('a demo supplier seeded with SEED_DEMO=true appears in getStageSnapshot', async () => {
    const mock = createMockPrisma();
    mock.supplier.create.mockResolvedValue({});
    const demoSupplier = pipelineSuppliers[0];
    const ids = fakeCatalogIds();

    await seedSupplier(asPrisma(mock), demoSupplier, ids);
    const createArg = mock.supplier.create.mock.calls[0][0] as {
      data: { history: { create: Record<string, unknown>[] } };
    };
    const birthEntry = createArg.data.history.create[createArg.data.history.create.length - 1];

    // Wire what seedSupplier just wrote into the mocked reads getStageSnapshot performs.
    mock.supplier.findMany.mockResolvedValue([
      { id: demoSupplier.id, commodityId: 1, commodity: { name: 'Harnesses' } },
    ]);
    mock.supplierHistoryEntry.findMany.mockResolvedValue([
      { supplierId: demoSupplier.id, toStageId: birthEntry.toStageId, toStage: { name: 'Scouting Event' } },
    ]);

    const snap = await getStageSnapshot(asPrisma(mock), birthEntry.date as string);

    expect(snap).toEqual([
      { commodityId: 1, commodityName: 'Harnesses', stageId: 1, stageName: 'Scouting Event', count: 1, levelCounts: null },
    ]);
  });
});
