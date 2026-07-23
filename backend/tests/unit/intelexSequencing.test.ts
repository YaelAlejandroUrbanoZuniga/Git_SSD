import { beforeEach, describe, expect, it } from 'vitest';
import { updateSupplier } from '../../src/services/suppliersService';
import type { AuthUser } from '../../src/middleware/auth';
import {
  asPrisma,
  createMockPrisma,
  fakeSlaCatalog,
  fakeSupplierRow,
  type MockPrisma,
} from '../helpers/mockPrisma';

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };

/** Catalog lookups the update path + the trailing getSupplierById need. */
function stubCatalogs(mock: MockPrisma) {
  mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
  mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
  mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
  mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
  mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
}

// ── Intelex Handoff level sequencing (updateSupplier) ──────────────────────
describe('Intelex Handoff "Real" date sequencing', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
    // Full row for the existence check AND the trailing getSupplierById.
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Intelex Handoff' }));
  });

  it('rejects an out-of-sequence Real (L2 before L1) before any write', async () => {
    mock.intelexData.findUnique.mockResolvedValue({
      investigateReal: '2026-01-01', l0Real: '2026-02-01', l1Real: null,
    });

    await expect(
      updateSupplier(asPrisma(mock), 'ps1', { intelex_l2Real: '2026-03-01' }, actor),
    ).rejects.toThrow(/"L1"/);
    // Nothing was written — the rule fires before the transaction.
    expect(mock.$transaction).not.toHaveBeenCalled();
    expect(mock.intelexData.upsert).not.toHaveBeenCalled();
  });

  it('advances currentLevel to the captured level when in sequence', async () => {
    mock.intelexData.findUnique.mockResolvedValue({ investigateReal: '2026-01-01', l0Real: null });
    mock.intelexData.upsert.mockResolvedValue({});

    await updateSupplier(asPrisma(mock), 'ps1', { intelex_l0Real: '2026-02-01' }, actor);

    expect(mock.intelexData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ l0Real: '2026-02-01', currentLevel: 'L0' }) }),
    );
  });

  it('accepts multiple levels captured in order within one patch (⇒ currentLevel = L0)', async () => {
    mock.intelexData.findUnique.mockResolvedValue(null); // no satellite yet
    mock.intelexData.upsert.mockResolvedValue({});

    await updateSupplier(
      asPrisma(mock), 'ps1',
      { intelex_investigateReal: '2026-01-01', intelex_l0Real: '2026-02-01' },
      actor,
    );

    expect(mock.intelexData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ currentLevel: 'L0' }) }),
    );
  });

  it('does NOT sequence "Expected" dates and leaves currentLevel untouched', async () => {
    mock.intelexData.findUnique.mockResolvedValue({ investigateReal: null });
    mock.intelexData.upsert.mockResolvedValue({});

    // A far-ahead Expected date with no Real captured is allowed.
    await updateSupplier(asPrisma(mock), 'ps1', { intelex_l4Expected: '2026-12-01' }, actor);

    const upsertArg = mock.intelexData.upsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(upsertArg.update).toHaveProperty('l4Expected', '2026-12-01');
    expect(upsertArg.update).not.toHaveProperty('currentLevel');
  });

  it('ignores a client-sent currentLevel (server derives it)', async () => {
    mock.intelexData.findUnique.mockResolvedValue({ investigateReal: '2026-01-01' });
    mock.intelexData.upsert.mockResolvedValue({});

    // Client tries to jump straight to L4 by sending currentLevel + a valid Real.
    await updateSupplier(
      asPrisma(mock), 'ps1',
      { intelex_currentLevel: 'L4', intelex_investigateReal: '2026-01-02' },
      actor,
    );

    // Only Investigate's Real is set ⇒ derived level is Investigate, not L4.
    expect(mock.intelexData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ currentLevel: 'Investigate' }) }),
    );
  });
});
