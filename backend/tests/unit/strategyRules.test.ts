import { describe, expect, it } from 'vitest';
import { isAchievedSupplier } from '../../src/domain/strategyRules';

describe('isAchievedSupplier (strategy KPI criterion)', () => {
  it('does not count Intelex Handoff with no L3 real date, even with L2 closed', () => {
    expect(isAchievedSupplier('Intelex Handoff', null)).toBe(false);
  });

  it('counts Intelex Handoff once the L3 real date is captured', () => {
    expect(isAchievedSupplier('Intelex Handoff', '2026-04-01')).toBe(true);
  });

  it('counts Completed regardless of the L3 real date', () => {
    expect(isAchievedSupplier('Completed', null)).toBe(true);
  });

  it('does not count any other stage', () => {
    expect(isAchievedSupplier('Parking Lot', '2026-04-01')).toBe(false);
    expect(isAchievedSupplier('Preliminary Evaluation', null)).toBe(false);
  });
});
