// Date presentation helpers for the frontend.
//
// `relativeLabel` is the frontend twin of the backend's notification helper of
// the same name (backend/src/services/notificationsService.ts). It is
// intentionally NOT imported from the backend — the frontend has its own English,
// activity-feed-tuned wording (Today / Yesterday / N days ago / 'DD MMM').

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local start-of-day, so day differences count calendar days, not 24h windows. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  if (!dateStr) return 'Recently';
  // 'YYYY-MM-DD' is parsed as UTC midnight by the Date ctor; anchor it to local
  // midnight instead so the calendar-day math below matches the viewer's day.
  const parsed = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Recently';

  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(parsed).getTime()) / 86_400_000,
  );

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return `${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]}`;
}
