import { describe, it, expect } from 'vitest';
import { formatDisplayTime } from '../shared/utils/date';

function safeFormatTime(raw?: string): string {
  if (!raw) return '—';
  const str = String(raw).trim();
  if (!str || str === '—') return '—';
  return formatDisplayTime(raw);
}

function parseDisplayTimeToMinutes(tStr?: string): number | null {
  if (!tStr || tStr === '—') return null;
  const match = tStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

describe('Past Unclosed Attendance Session 5:30 PM Default', () => {
  it('defaults clockOut to 5:30 PM on a past date when clockOut is missing', () => {
    const pastDate = '2026-10-06';
    const clockIn = '2026-10-06T03:52:12.893+00:00'; // 09:22 AM IST
    const clockOut = null; // Unclosed session

    const todayStr = '2026-11-05';
    const isPastDate = pastDate < todayStr;
    expect(isPastDate).toBe(true);

    const effectiveClockOut = clockOut || (isPastDate && clockIn ? `${pastDate}T17:30:00+05:30` : undefined);
    const startStr = safeFormatTime(clockIn);
    const endStr = safeFormatTime(effectiveClockOut);

    expect(startStr).toBe('09:22 AM');
    expect(endStr).toBe('05:30 PM');

    const startMins = parseDisplayTimeToMinutes(startStr);
    const endMins = parseDisplayTimeToMinutes(endStr);

    expect(startMins).toBe(9 * 60 + 22); // 562
    expect(endMins).toBe(17 * 60 + 30); // 1050

    const grossMins = (endMins && startMins) ? endMins - startMins : 0;
    expect(grossMins).toBe(488); // 8h 8m

    const duration = `${Math.floor(grossMins / 60)}h ${grossMins % 60}m`;
    expect(duration).toBe('8h 8m');
  });

  it('preserves actual clockOut when already provided', () => {
    const clockIn = '2026-10-01T04:06:00.000Z'; // 09:36 AM IST
    const clockOut = '2026-10-01T12:10:00.000Z'; // 05:40 PM IST
    const isPastDate = true;

    const effectiveClockOut = clockOut || (isPastDate && clockIn ? '2026-10-01T17:30:00+05:30' : undefined);
    const endStr = safeFormatTime(effectiveClockOut);
    expect(endStr).toBe('05:40 PM');
  });
});
