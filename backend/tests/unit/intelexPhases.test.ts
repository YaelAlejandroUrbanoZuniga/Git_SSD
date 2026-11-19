import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasIntelexReal,
  intelexLevelsOfPhase,
  intelexPhaseOf,
  isIntelexMonitoringLevel,
} from '../../src/domain/intelexLevels';
import { STRATEGY_ACHIEVED_LEVEL } from '../../src/domain/strategyRules';
import { listByStage } from '../../src/services/trackerService';
import { ValidationError } from '../../src/domain/errors';
import { asPrisma, createMockPrisma, type MockPrisma } from '../helpers/mockPrisma';

describe('Intelex Handoff phases (development / KPI achieved – monitoring)', () => {
  it('puts Investigate through L2 in development', () => {
    for (const level of ['Investigate', 'L0', 'L1', 'L2']) {
      expect(intelexPhaseOf(level)).toBe('development');
      expect(isIntelexMonitoringLevel(level)).toBe(false);
    }
  });

  it('puts L3 and L4 in monitoring — the KPI level and after', () => {
    for (const level of ['L3', 'L4']) {
      expect(intelexPhaseOf(level)).toBe('monitoring');
      expect(isIntelexMonitoringLevel(level)).toBe(true);
    }
  });

  it('anchors monitoring on the strategy KPI level instead of redefining it', () => {
    expect(intelexLevelsOfPhase('monitoring')[0]).toBe(STRATEGY_ACHIEVED_LEVEL);
    expect(intelexLevelsOfPhase('monitoring')).toEqual(['L3', 'L4']);
    expect(intelexLevelsOfPhase('development')).toEqual(['Investigate', 'L0', 'L1', 'L2']);
  });

  it('has no phase for levels outside the sequence (Completed, legacy values)', () => {
    for (const level of ['Completed', 'L5', '', null, undefined]) {
      expect(intelexPhaseOf(level)).toBeNull();
      expect(isIntelexMonitoringLevel(level)).toBe(false);
    }
  });

  it('hasIntelexReal requires a real YYYY-MM-DD day', () => {
    expect(hasIntelexReal({ l4Real: '2026-10-01' }, 'l4Real')).toBe(true);
    expect(hasIntelexReal({ l4Real: '2026-10-01T00:00:00.000Z' }, 'l4Real')).toBe(true);
    expect(hasIntelexReal({ l4Real: null }, 'l4Real')).toBe(false);
    expect(hasIntelexReal({ l4Real: '   ' }, 'l4Real')).toBe(false);
    expect(hasIntelexReal({ l4Real: 'pending' }, 'l4Real')).toBe(false);
    expect(hasIntelexReal(null, 'l4Real')).toBe(false);
  });
});

describe('listByStage phase filter', () => {
  let mock: MockPrisma;
  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('filters Intelex Handoff by the monitoring levels', async () => {
    await listByStage(asPrisma(mock), 'Intelex Handoff', 'monitoring');
    expect(mock.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        stage: { is: { name: 'Intelex Handoff' } },
        intelexData: { is: { currentLevel: { in: ['L3', 'L4'] } } },
      }),
    }));
  });

  it('leaves the plain stage listing unfiltered by level', async () => {
    await listByStage(asPrisma(mock), 'Intelex Handoff');
    const where = mock.supplier.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('intelexData');
  });

  it('rejects an unknown phase, or a phase on another stage', async () => {
    await expect(listByStage(asPrisma(mock), 'Intelex Handoff', 'done')).rejects.toBeInstanceOf(ValidationError);
    await expect(listByStage(asPrisma(mock), 'Parking Lot', 'monitoring')).rejects.toBeInstanceOf(ValidationError);
    await expect(listByStage(asPrisma(mock), undefined, 'monitoring')).rejects.toBeInstanceOf(ValidationError);
    expect(mock.supplier.findMany).not.toHaveBeenCalled();
  });
});
