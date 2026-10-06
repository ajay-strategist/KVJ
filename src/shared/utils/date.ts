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

/** Standardize any Date or date string to DD-MM-YYYY hh:mm AM/PM format for UI rendering. */
export function formatDateTime(val?: string | Date | null): string {
  if (!val) return '—';
  if (val === '—') return '—';

  const dt = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(dt.getTime())) return String(val);

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');

  let hours = dt.getHours();
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}-${m}-${y} ${formattedHours}:${minutes} ${ampm}`;
}

/** Standardize any Date, ISO string, or time string to 12-hour format (hh:mm AM/PM) for UI rendering. */
export function formatDisplayTime(val?: string | Date | null): string {
  if (!val) return '—';
  const str = String(val).trim();
  if (!str || str === '—') return '—';

  // If already formatted with AM/PM (e.g. "09:04 AM" or "9:04 AM"), return normalized
  const match12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    const h = String(parseInt(match12[1], 10)).padStart(2, '0');
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    return `${h}:${m} ${ampm}`;
  }

  // Parse ISO string or Date object
  const dt = typeof val === 'string' ? new Date(val) : val;
  if (!isNaN(dt.getTime())) {
    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  // Parse 24-hour HH:mm string (e.g. "16:26" or "09:04")
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }

  return String(val);
}

/**
 * Convert a local date string (YYYY-MM-DD) and a time string (HH:mm, HH:mm:ss, 12h AM/PM, or ISO string)
 * into a full UTC ISO string (ending in Z) representing that local moment.
 * If the input already has a timezone indicator ('Z' or offset like '+05:30'), it is normalized.
 */
export function localDateTimeToUtcIso(dateStr?: string, timeStr?: string): string {
  // If timeStr is already a full ISO string with timezone, normalize to UTC ISO
  if (timeStr) {
    const trimmed = timeStr.trim();
    if (trimmed.includes('T') && (trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed))) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const baseDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? dateStr.trim()
    : todayISO();

  const [yStr, mStr, dStr] = baseDate.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) - 1;
  let day = parseInt(dStr, 10);

  let hours = 17;
  let minutes = 30;
  let seconds = 0;

  if (timeStr) {
    const str = timeStr.trim();
    // Check if format is "YYYY-MM-DDTHH:mm(:ss)?" without timezone
    const dateTimeMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (dateTimeMatch) {
      year = parseInt(dateTimeMatch[1], 10);
      month = parseInt(dateTimeMatch[2], 10) - 1;
      day = parseInt(dateTimeMatch[3], 10);
      hours = parseInt(dateTimeMatch[4], 10);
      minutes = parseInt(dateTimeMatch[5], 10);
      seconds = dateTimeMatch[6] ? parseInt(dateTimeMatch[6], 10) : 0;
      const localDate = new Date(year, month, day, hours, minutes, seconds);
      return localDate.toISOString();
    }

    // Check 12-hour format "hh:mm(:ss)? AM/PM"
    const match12 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
      hours = parseInt(match12[1], 10);
      minutes = parseInt(match12[2], 10);
      seconds = match12[3] ? parseInt(match12[3], 10) : 0;
      const ampm = match12[4].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else {
      // Check 24-hour format "HH:mm(:ss)?"
      const match24 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (match24) {
        hours = parseInt(match24[1], 10);
        minutes = parseInt(match24[2], 10);
        seconds = match24[3] ? parseInt(match24[3], 10) : 0;
      }
    }
  }

  const localDate = new Date(year, month, day, hours, minutes, seconds);
  return localDate.toISOString();
}

/**
 * Calculates total break minutes by merging overlapping intervals to prevent double-counting.
 * If multiple break records exist for the same period (e.g. from concurrent submissions),
 * their union of time is computed rather than summing durations naively.
 */
export function calculateMergedBreakMinutes(
  breaks?: Array<{ startTime?: string; start_time?: string; endTime?: string; end_time?: string }>,
  options?: {
    isCurrentlyOnBreak?: boolean;
    maxGrossMinutes?: number;
    referenceNow?: number;
  }
): number {
  if (!breaks || breaks.length === 0) return 0;

  const now = options?.referenceNow ?? Date.now();
  const intervals: Array<[number, number]> = [];

  for (const b of breaks) {
    const s = b.startTime || (b as any).start_time;
    const e = b.endTime || (b as any).end_time;
    if (!s) continue;
    const sMs = new Date(s).getTime();
    if (isNaN(sMs)) continue;

    let eMs = e ? new Date(e).getTime() : NaN;
    if (isNaN(eMs) || !e) {
      if (options?.isCurrentlyOnBreak) {
        eMs = now;
      } else {
        continue;
      }
    }

    if (eMs > sMs) {
      intervals.push([sMs, eMs]);
    }
  }

  if (intervals.length === 0) return 0;

  // Sort by start time
  intervals.sort((a, b) => a[0] - b[0]);

  // Merge overlapping or adjacent intervals
  const merged: Array<[number, number]> = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const prev = merged[merged.length - 1];

    if (current[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  // Sum merged intervals in ms
  let totalMs = 0;
  for (const [start, end] of merged) {
    totalMs += (end - start);
  }

  let totalMins = Math.max(0, Math.round(totalMs / 60000));
  if (options?.maxGrossMinutes !== undefined && options.maxGrossMinutes >= 0) {
    totalMins = Math.min(totalMins, options.maxGrossMinutes);
  }

  return totalMins;
}

