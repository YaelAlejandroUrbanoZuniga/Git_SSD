// Pure rules for event prospects (T_Event_Prospect). No Prisma, no I/O — the
// service layer owns persistence, this file owns the arithmetic and the formats.

/**
 * Hard cap on one Excel import call. Matches `MAX_PROSPECT_ROWS` in the
 * frontend's `utils/prospectTemplate.ts`, which the template and the client-side
 * parser already enforce — this is the server-side half of the same limit.
 */
export const MAX_PROSPECT_IMPORT_ROWS = 500;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_MINUTES = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Trims and collapses internal whitespace runs to a single space. */
export function normalizeCompanyName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * A calendar-real 'YYYY-MM-DD' as a UTC instant, or null. Rejects a date the
 * calendar does not have (2026-02-30) rather than letting Date roll it forward.
 */
function parseCalendarDate(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Leading 'YYYY-MM-DD' of a date or ISO timestamp string, as a UTC instant. */
function parseDayStart(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value.slice(0, 10));
  if (!match) return null;
  return parseCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Last day on which marking interest still makes sense: 14 days after the list
 * was imported, or the day before the event starts — whichever comes FIRST.
 * Interest declared after the event has begun is useless (the B2B agenda is
 * already fixed), and a list imported months ahead should not leave the window
 * open for months.
 *
 * Returns null when either input is not a real 'YYYY-MM-DD'/ISO date.
 */
export function interestDeadline(importedAt: string, eventDateStart: string): string | null {
  const imported = parseDayStart(importedAt);
  const start = parseDayStart(eventDateStart);
  if (!imported || !start) return null;
  const importedLimit = imported.getTime() + 14 * DAY_MS;
  const eventLimit = start.getTime() - DAY_MS;
  return toISODate(new Date(Math.min(importedLimit, eventLimit)));
}

/**
 * ADVISORY ONLY — a hint the UI renders ("the interest window closed"). The
 * service must NEVER reject a write because of it: a late mark is still real
 * information, and an SSD scheduling a B2B on the event's own morning is normal.
 */
export function isInterestDeadlinePassed(deadline: string | null, today: string): boolean {
  const limit = parseDayStart(deadline);
  const now = parseDayStart(today);
  if (!limit || !now) return false;
  return now.getTime() > limit.getTime();
}

/** Strict 'YYYY-MM-DDTHH:mm' with a real calendar date and a real wall clock. */
export function isValidB2bDateTime(value: string): boolean {
  const match = ISO_DATETIME_MINUTES.exec(value);
  if (!match) return false;
  const [, y, m, d, hh, mm] = match;
  if (!parseCalendarDate(Number(y), Number(m), Number(d))) return false;
  const hours = Number(hh);
  const minutes = Number(mm);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
