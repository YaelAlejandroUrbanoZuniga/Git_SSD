import { beforeEach, describe, expect, it } from 'vitest';
import {
  calcIntelexGlobalEfficiency,
  calcIntelexLevelEfficiency,
} from '../../src/domain/intelexEfficiency';
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

// ── The stepped scale, branch by branch ────────────────────────────────────
// Every boundary of the team's Excel formula, so a retune there shows up here
// as a failing expectation instead of a silently different number in the UI.
describe('calcIntelexLevelEfficiency', () => {
  /** Expected date shared by the cases below; `real` is it plus `delay` days. */
  const expected = '2026-03-01';
  const realAfter = (delay: number) => {
    const d = new Date(Date.UTC(2026, 2, 1) + delay * 86400000);
    return d.toISOString().slice(0, 10);
  };

  it('gives the cap when the Real lands before the Expected (no early bonus)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(-10))).toBe(0.95);
    expect(calcIntelexLevelEfficiency(expected, realAfter(-1))).toBe(0.95);
  });

  it('gives the cap exactly on time (delay 0)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(0))).toBe(0.95);
  });

  it('keeps the cap through the 5-day grace period (delay 5)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(5))).toBe(0.95);
  });

  it('starts penalising past the grace period (delay 6 ⇒ 0.925)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(6))).toBeCloseTo(0.925, 10);
  });

  it('hits 0.70 at the end of the 0.025/day slope (delay 15)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(15))).toBeCloseTo(0.70, 10);
  });

  it('switches to the 0.02/day slope past 15 days (delay 16 ⇒ 0.68)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(16))).toBeCloseTo(0.68, 10);
  });

  it('hits the floor exactly at delay 25 (⇒ 0.50)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(25))).toBeCloseTo(0.50, 10);
  });

  it('stays on the floor past 25 days (delay 26 and far beyond)', () => {
    expect(calcIntelexLevelEfficiency(expected, realAfter(26))).toBe(0.50);
    expect(calcIntelexLevelEfficiency(expected, realAfter(365))).toBe(0.50);
  });

  it('is gradual in between — never only 0% or 100% (the bug this replaced)', () => {
    // Ten consecutive delays inside the slopes, all distinct and strictly falling.
    const values = [6, 7, 8, 9, 10, 16, 17, 18, 19, 20]
      .map(d => calcIntelexLevelEfficiency(expected, realAfter(d)) as number);
    values.forEach((v, i) => {
      expect(v).toBeGreaterThan(0.50);
      expect(v).toBeLessThan(0.95);
      if (i > 0) expect(v).toBeLessThan(values[i - 1]);
    });
  });

  it('returns null when either date is missing or unparseable', () => {
    expect(calcIntelexLevelEfficiency(null, '2026-03-10')).toBeNull();
    expect(calcIntelexLevelEfficiency('2026-03-01', null)).toBeNull();
    expect(calcIntelexLevelEfficiency(null, null)).toBeNull();
    expect(calcIntelexLevelEfficiency('2026-03-01', '')).toBeNull();
    expect(calcIntelexLevelEfficiency('2026-03-01', 'TBD')).toBeNull();
  });

  it('reads an ISO instant day-first, like the rest of the Intelex domain', () => {
    expect(calcIntelexLevelEfficiency('2026-03-01', '2026-03-07T18:30:00.000Z'))
      .toBeCloseTo(0.925, 10); // 6 days late, the time part ignored
  });
});

// ── The aggregate ──────────────────────────────────────────────────────────
describe('calcIntelexGlobalEfficiency', () => {
  it('averages only the levels that have a value, ignoring nulls', () => {
    // Averaging 0.95 and 0.75 over the 2 scored levels — NOT over all 5, which
    // treating the nulls as 0 would do (and would give 0.34).
    expect(calcIntelexGlobalEfficiency([0.95, null, 0.75, null, null])).toBeCloseTo(0.85, 10);
  });

  it('equals the single scored level when only one has dates', () => {
    expect(calcIntelexGlobalEfficiency([null, null, 0.68, null, null])).toBeCloseTo(0.68, 10);
  });

  it('averages all five when every level is scored', () => {
    expect(calcIntelexGlobalEfficiency([0.95, 0.95, 0.95, 0.50, 0.50])).toBeCloseTo(0.77, 10);
  });

  it('returns null when no level has a value', () => {
    expect(calcIntelexGlobalEfficiency([null, null, null, null, null])).toBeNull();
    expect(calcIntelexGlobalEfficiency([])).toBeNull();
  });
});

// ── Persistence through updateSupplier ─────────────────────────────────────
describe('Intelex efficiency persistence (updateSupplier)', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
    stubCatalogs(mock);
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Intelex Handoff' }));
    mock.intelexData.upsert.mockResolvedValue({});
  });

  /** The `update` half of the single intelexData.upsert the patch produced. */
  function upsertUpdate(): Record<string, unknown> {
    const arg = mock.intelexData.upsert.mock.calls[0][0] as { update: Record<string, unknown> };
    return arg.update;
  }

  it('scores a level from its own Expected/Real pair and averages into the global', async () => {
    // L0 arrives complete in the patch; L1's Expected is already on file and its
    // Real comes now — both score, and nothing else does.
    mock.intelexData.findUnique.mockResolvedValue({
      investigateReal: '2026-01-01', l0Real: null, l1Expected: '2026-04-01',
    });

    await updateSupplier(
      asPrisma(mock), 'ps1',
      {
        intelex_l0Expected: '2026-03-01', intelex_l0Real: '2026-03-07', // 6 days late
        intelex_l1Real: '2026-04-17', // 16 days late
      },
      actor,
    );

    const update = upsertUpdate();
    expect(update.efficiencyL0).toBeCloseTo(0.925, 10);
    expect(update.efficiencyL1).toBeCloseTo(0.68, 10);
    expect(update.efficiencyL2).toBeNull();
    expect(update.efficiencyL3).toBeNull();
    expect(update.efficiencyL4).toBeNull();
    // Average of the two scored levels only.
    expect(update.efficiencyGlobal).toBeCloseTo(0.8025, 10);
  });

  it('recomputes on an "Expected"-only patch (no Real touched)', async () => {
    mock.intelexData.findUnique.mockResolvedValue({ l0Real: '2026-03-20' });

    // Correcting the Expected date alone changes the delay, so the score moves:
    // 19 days late ⇒ 0.70 - (19 - 15) * 0.02.
    await updateSupplier(asPrisma(mock), 'ps1', { intelex_l0Expected: '2026-03-01' }, actor);

    const update = upsertUpdate();
    expect(update.efficiencyL0).toBeCloseTo(0.62, 10);
    expect(update.efficiencyGlobal).toBeCloseTo(0.62, 10);
  });

  it('clears a level back to null when one of its dates is removed', async () => {
    mock.intelexData.findUnique.mockResolvedValue({
      investigateReal: '2026-01-01', l0Expected: '2026-03-01', l0Real: '2026-03-02',
    });

    await updateSupplier(asPrisma(mock), 'ps1', { intelex_l0Real: null }, actor);

    const update = upsertUpdate();
    expect(update.efficiencyL0).toBeNull();
    expect(update.efficiencyGlobal).toBeNull();
  });

  it('ignores client-sent efficiencies (server derives all six)', async () => {
    mock.intelexData.findUnique.mockResolvedValue({
      investigateReal: '2026-01-01', l0Expected: '2026-03-01',
    });

    // Client claims a perfect score while the Real is 30 days late.
    await updateSupplier(
      asPrisma(mock), 'ps1',
      {
        intelex_l0Expected: '2026-03-01', intelex_l0Real: '2026-03-31',
        intelex_efficiencyL0: 1, intelex_efficiencyGlobal: 1,
      },
      actor,
    );

    const update = upsertUpdate();
    expect(update.efficiencyL0).toBe(0.50);
    expect(update.efficiencyGlobal).toBe(0.50);
  });

  it('leaves the efficiencies alone when the patch touches no Intelex date', async () => {
    await updateSupplier(asPrisma(mock), 'ps1', { intelex_investigateRecordNumber: 'INV-1' }, actor);

    const update = upsertUpdate();
    expect(update).not.toHaveProperty('efficiencyL0');
    expect(update).not.toHaveProperty('efficiencyGlobal');
    // No date moved ⇒ no need to read the stored row at all.
    expect(mock.intelexData.findUnique).not.toHaveBeenCalled();
  });
});
