import { describe, expect, it } from 'vitest';
import { assertMeaningfulText } from '../../src/domain/textValidation';
import { ValidationError } from '../../src/domain/errors';

// The JUNK_VALUES set lives (private) in textValidation.ts — kept in sync here.
const JUNK_VALUES = ['na', 'n/a', 'ok', 'okay', 'ninguna', 'ninguno', 'n/d', '-', '.', '...', 'x'];

describe('assertMeaningfulText', () => {
  it('rejects empty / whitespace-only', () => {
    for (const bad of [undefined, null, '', '   ', '\t\n']) {
      expect(() => assertMeaningfulText(bad, 'Field')).toThrow(ValidationError);
    }
  });

  it('rejects text shorter than the minimum (10 chars)', () => {
    expect(() => assertMeaningfulText('too short', 'Field')).toThrow(ValidationError); // 9 chars
    expect(() => assertMeaningfulText('123456789', 'Field')).toThrow(ValidationError); // 9 chars
  });

  it('rejects text longer than the maximum (2000 chars)', () => {
    expect(() => assertMeaningfulText('a'.repeat(2001), 'Field')).toThrow(ValidationError);
  });

  it('rejects every junk value, case-insensitively', () => {
    for (const junk of JUNK_VALUES) {
      expect(() => assertMeaningfulText(junk, 'Field')).toThrow(ValidationError);
      expect(() => assertMeaningfulText(junk.toUpperCase(), 'Field')).toThrow(ValidationError);
      expect(() => assertMeaningfulText(`  ${junk}  `, 'Field')).toThrow(ValidationError);
    }
  });

  it('accepts normal text and returns it trimmed', () => {
    expect(assertMeaningfulText('  Failed the on-site audit  ', 'Field')).toBe('Failed the on-site audit');
    expect(assertMeaningfulText('a'.repeat(2000), 'Field')).toHaveLength(2000);
  });

  it('names the field in the error message', () => {
    expect(() => assertMeaningfulText('', 'Rejection reason')).toThrow('Rejection reason is required');
  });
});
