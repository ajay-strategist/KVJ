/**
 * Date helpers — LOCAL time only.
 *
 * Never use `new Date().toISOString().split('T')[0]` to get "today". Because
 * `toISOString()` converts to UTC first, any timezone ahead of UTC
 * (Asia/Kolkata is UTC+5:30) rolls local midnight back to the previous day, so
 * "today" silently becomes yesterday. That bug shifted the whole Training
 * Calendar by one day and dropped the last day of every month.
 */

/** Format a Date as YYYY-MM-DD using LOCAL calendar fields. */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}

/** `days` from today (may be negative) as YYYY-MM-DD in local time. */
export function addDaysISO(days: number, from: Date = new Date()): string {
  return toLocalISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}
