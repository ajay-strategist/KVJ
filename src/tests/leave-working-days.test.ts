import { describe, it, expect } from 'vitest';
import { calculateWorkingDays } from '../modules/leave/utils/working-days';

describe('Leave Working Days Calculation under No-Sandwich Policy', () => {
  it('treats Saturday as a regular working day for the company (NOT a holiday)', () => {
    // 2026-11-07 is Saturday
    const days = calculateWorkingDays('2026-11-07', '2026-11-07', 'Full Day');
    expect(days).toBe(1);
  });

  it('treats Sunday as a holiday and excludes it from deduction', () => {
    // 2026-11-08 is Sunday
    const days = calculateWorkingDays('2026-11-08', '2026-11-08', 'Full Day');
    expect(days).toBe(0);
  });

  it('accurately calculates 9 working days for 05-11-2026 to 14-11-2026 (User Screenshot Case)', () => {
    // 2026-11-05 (Thu) to 2026-11-14 (Sat)
    // Total calendar days = 10
    // Sundays = 1 (2026-11-08) -> excluded
    // Saturdays = 2 (2026-11-07, 2026-11-14) -> counted as working days
    // Total working days = 10 - 1 = 9
    const days = calculateWorkingDays('2026-11-05', '2026-11-14', 'Full Day');
    expect(days).toBe(9);
  });

  it('excludes declared holidays from leave deduction', () => {
    const declaredHolidays = new Set(['2026-11-10']); // Tuesday declared holiday
    const days = calculateWorkingDays('2026-11-05', '2026-11-14', 'Full Day', declaredHolidays);
    // 10 calendar days - 1 Sunday - 1 Declared Holiday = 8 working days
    expect(days).toBe(8);
  });

  it('calculates single Friday to Monday range including Saturday and excluding Sunday', () => {
    // 2026-11-06 (Fri), 2026-11-07 (Sat), 2026-11-08 (Sun), 2026-11-09 (Mon)
    // 4 calendar days - 1 Sunday = 3 working days (Fri, Sat, Mon)
    const days = calculateWorkingDays('2026-11-06', '2026-11-09', 'Full Day');
    expect(days).toBe(3);
  });

  it('returns 0.5 for half day shifts regardless of date range', () => {
    expect(calculateWorkingDays('2026-11-05', '2026-11-05', 'Morning Half Day')).toBe(0.5);
    expect(calculateWorkingDays('2026-11-07', '2026-11-07', 'Afternoon Half Day')).toBe(0.5);
  });

  it('returns 0 for empty or invalid dates', () => {
    expect(calculateWorkingDays('', '', 'Full Day')).toBe(0);
    expect(calculateWorkingDays('2026-11-14', '2026-11-05', 'Full Day')).toBe(0);
  });
});
