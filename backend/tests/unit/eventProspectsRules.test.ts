import { describe, expect, it } from 'vitest';
import {
  interestDeadline,
  isInterestDeadlinePassed,
  isValidB2bDateTime,
  normalizeCompanyName,
} from '../../src/domain/eventProspects';

describe('normalizeCompanyName', () => {
  it('trims and collapses internal whitespace runs to a single space', () => {
    expect(normalizeCompanyName('  Acme   Manufacturing  Corp  ')).toBe('Acme Manufacturing Corp');
    expect(normalizeCompanyName('Bosch\tPrecision\nParts')).toBe('Bosch Precision Parts');
  });

  it('leaves an already-clean name untouched', () => {
    expect(normalizeCompanyName('Global Wire Solutions')).toBe('Global Wire Solutions');
  });

  it('reduces a whitespace-only cell to the empty string (the import drops it)', () => {
    expect(normalizeCompanyName('   ')).toBe('');
    expect(normalizeCompanyName('')).toBe('');
  });
});

describe('interestDeadline — the EARLIER of import+14d and eventStart−1d wins', () => {
  it('is capped by the event when it is only 9 days out', () => {
    // eventStart − 1 = 2026-08-21, import + 14 = 2026-08-27 ⇒ the event caps it.
    expect(interestDeadline('2026-08-13', '2026-08-22')).toBe('2026-08-21');
  });

  it('is capped by the 14-day window when the event is 30 days out', () => {
    // import + 14 = 2026-08-27, eventStart − 1 = 2026-09-11 ⇒ the window caps it.
    expect(interestDeadline('2026-08-13', '2026-09-12')).toBe('2026-08-27');
  });

  it('crosses a month boundary correctly in both directions', () => {
    // 14 days from 2026-08-25 lands in September.
    expect(interestDeadline('2026-08-25', '2026-10-01')).toBe('2026-09-08');
    // The day before the 1st is the last day of the previous month.
    expect(interestDeadline('2026-08-25', '2026-09-01')).toBe('2026-08-31');
    // …including a leap-year February.
    expect(interestDeadline('2028-02-20', '2028-03-01')).toBe('2028-02-29');
  });

  it('accepts a full ISO instant for the import date (that is what the DB stores)', () => {
    expect(interestDeadline('2026-08-13T17:42:11.000Z', '2026-09-12')).toBe('2026-08-27');
  });

  it('returns null on garbage input', () => {
    expect(interestDeadline('not a date', '2026-09-12')).toBeNull();
    expect(interestDeadline('2026-08-13', 'TBC')).toBeNull();
    expect(interestDeadline('', '')).toBeNull();
    // A date the calendar does not have is garbage too, not a rolled-forward one.
    expect(interestDeadline('2026-02-30', '2026-09-12')).toBeNull();
    expect(interestDeadline('13/08/2026', '2026-09-12')).toBeNull();
  });
});

describe('isInterestDeadlinePassed — advisory only, never a write gate', () => {
  it('is false on the deadline itself and true the day after', () => {
    expect(isInterestDeadlinePassed('2026-08-27', '2026-08-26')).toBe(false);
    expect(isInterestDeadlinePassed('2026-08-27', '2026-08-27')).toBe(false);
    expect(isInterestDeadlinePassed('2026-08-27', '2026-08-28')).toBe(true);
  });

  it('is false when there is no deadline or the day is unreadable', () => {
    expect(isInterestDeadlinePassed(null, '2026-08-28')).toBe(false);
    expect(isInterestDeadlinePassed('2026-08-27', 'TBC')).toBe(false);
  });
});

describe('isValidB2bDateTime', () => {
  it("accepts a strict 'YYYY-MM-DDTHH:mm'", () => {
    expect(isValidB2bDateTime('2026-08-20T14:30')).toBe(true);
    expect(isValidB2bDateTime('2026-08-20T00:00')).toBe(true);
    expect(isValidB2bDateTime('2026-08-20T23:59')).toBe(true);
  });

  it('rejects a date with no time', () => {
    expect(isValidB2bDateTime('2026-08-20')).toBe(false);
  });

  it('rejects impossible months and days', () => {
    expect(isValidB2bDateTime('2026-13-01T10:00')).toBe(false);
    expect(isValidB2bDateTime('2026-02-30T10:00')).toBe(false);
  });

  it('rejects an impossible wall clock', () => {
    expect(isValidB2bDateTime('2026-08-20T25:00')).toBe(false);
    expect(isValidB2bDateTime('2026-08-20T10:60')).toBe(false);
  });

  it('rejects anything longer or shorter than the exact format', () => {
    expect(isValidB2bDateTime('')).toBe(false);
    expect(isValidB2bDateTime('2026-08-20T14:30:00')).toBe(false);
    expect(isValidB2bDateTime('2026-08-20T14:30Z')).toBe(false);
    expect(isValidB2bDateTime('2026-8-20T14:30')).toBe(false);
    expect(isValidB2bDateTime('20/08/2026 14:30')).toBe(false);
  });
});
