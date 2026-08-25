import { describe, expect, it } from 'vitest';
import { immexNameFromAnswer, normalizeConfidence } from '../../src/services/catalogMapping';
import { IMMEX_ANSWERS, IMMEX_STATUSES } from '../../src/domain/constants';

describe('catalogMapping', () => {
  describe('immexNameFromAnswer', () => {
    // Q34's three answers, and the catalog value each one stores. The mapping is
    // NOT the identity: the two "No…" answers differ only in whether a plan
    // exists, which C_ImmexStatus models as 'No' vs 'In Plan'.
    it.each([
      ['Yes', 'Yes'],
      ['No, with a plan', 'In Plan'],
      ['No, without a plan', 'No'],
    ] as const)('maps %s to the %s catalog value', (answer, name) => {
      expect(immexNameFromAnswer(answer)).toBe(name);
    });

    it('covers every wire answer, so no submission can land without a status', () => {
      // The old hasIMMEX/planIMMEX pair had four combinations for three answers
      // and resolved the contradictory one by letting planIMMEX win. There is no
      // combination left to arbitrate — one answer in, one catalog value out.
      const mapped = IMMEX_ANSWERS.map(a => immexNameFromAnswer(a));
      expect(mapped).toHaveLength(IMMEX_ANSWERS.length);
      expect(mapped.every(name => IMMEX_STATUSES.includes(name))).toBe(true);
      // Distinct: two answers collapsing to one catalog value would lose Q34's meaning.
      expect(new Set(mapped).size).toBe(IMMEX_ANSWERS.length);
    });

    it('never produces TBC — no Q34 answer means "not established"', () => {
      expect(IMMEX_ANSWERS.map(a => immexNameFromAnswer(a))).not.toContain('TBC');
    });
  });

  describe('normalizeConfidence', () => {
    it.each([
      ['H', 'H'], ['high', 'H'], [' High ', 'H'],
      ['M', 'M'], ['medium', 'M'],
      ['L', 'L'], ['low', 'L'],
    ])('normalizes %s to %s', (input, code) => {
      expect(normalizeConfidence(input)).toBe(code);
    });

    it('falls back to TBD on anything it does not recognise', () => {
      expect(normalizeConfidence('')).toBe('TBD');
      expect(normalizeConfidence('unknown')).toBe('TBD');
    });
  });
});
