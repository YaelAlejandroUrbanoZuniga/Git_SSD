// Date presentation helpers for the frontend.
//
// `relativeLabel` is the frontend twin of the backend's notification helper of
// the same name (backend/src/services/notificationsService.ts). It is
// intentionally NOT imported from the backend — the frontend has its own English,
// activity-feed-tuned wording (Today / Yesterday / N days ago / 'DD MMM').

/**
 * The one month table for the whole frontend, indexed 0-11 like `Date#getMonth`.
 * Exported because it used to be re-declared per screen, and one of those copies
 * had drifted into Spanish — so the Guest home showed a different month
 * vocabulary than every other role's. Uppercase it at the call site if a badge
 * needs 'JAN'; do not fork the array again.
 */
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local start-of-day, so day differences count calendar days, not 24h windows. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Parses a server date string ('YYYY-MM-DD' or ISO) anchored to LOCAL midnight.
 * 'YYYY-MM-DD' alone is parsed as UTC midnight by the `Date` constructor, which
 * can land on the wrong calendar day once converted to the viewer's timezone —
 * anchoring it explicitly keeps every caller's day-math consistent.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Absolute date: "2 Sep 2026". Tables, detail fields, exports. */
export function formatDate(value: string | null | undefined, empty = '—'): string {
  const d = parseServerDate(value);
  if (!d) return empty;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Human-friendly relative label for a server date string ('YYYY-MM-DD' or ISO).
 *
 * - today (or future)        → 'Today'
 * - yesterday                → 'Yesterday'
 * - within the last 7 days   → 'N days ago'
 * - older                    → 'DD MMM' (e.g. '15 Jun')
 *
 * Returns 'Recently' when the date is missing or unparseable — it never invents
 * a date for activity items that don't carry a real one from the server.
 */
export function relativeLabel(dateStr: string | null | undefined): string {
  const parsed = parseServerDate(dateStr);
  if (!parsed) return 'Recently';

  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(parsed).getTime()) / 86_400_000,
  );

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return `${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]}`;
}
