/**
 * Shared, consistent formatting helpers for the PDF report.
 * One place for currency, dates and safe-value handling so the whole document
 * is uniform (no mixed ₹125000 / 125,000 / raw ISO dates).
 */

/** Indian-grouped rupee amount, always 2 decimals, negatives in parentheses. */
export function formatINR(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(₹${abs})` : `₹${abs}`;
}

/** Plain integer with Indian grouping (for counts, marks). */
export function formatNum(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** One consistent human date: "10 Aug 2026". Accepts ISO or dd/mm/yyyy. */
export function formatReportDate(input: string | null | undefined): string {
  const s = String(input ?? '').trim();
  if (!s) return '—';
  let d: Date | null = null;
  // ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!d && dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  if (!d || isNaN(d.getTime())) return s; // leave unrecognised strings untouched
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Trim to a max length with an ellipsis so a long value can't break a cell. */
export function truncate(s: string | null | undefined, max: number): string {
  const t = String(s ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Non-empty string or a fallback. */
export function safe(v: unknown, fallback = '—'): string {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s.length > 0 ? s : fallback;
}
