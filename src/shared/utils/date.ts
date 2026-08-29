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

/** Standardize any Date or date string to DD-MM-YYYY format for UI rendering. */
export function formatDisplayDate(val?: string | Date | null): string {
  if (!val) return '—';
  if (val === '—') return '—';
  
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-');
    return `${d}-${m}-${y}`;
  }

  const dt = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(dt.getTime())) return String(val);

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${day}-${m}-${y}`;
}

