import { describe, it, expect } from 'vitest';
import {
  calculateProbationDuration,
  formatProbationDuration,
  getProbationCompletionDate,
  isProbationActive,
} from '../shared/utils/probation';

describe('Probation Period Calculations (EMP-Q01 & BR-EMP-002)', () => {
  it('correctly calculates exact 3 months duration', () => {
    // Joining Jan 1, ending March 31 -> exactly 3 months
    const duration = calculateProbationDuration('2026-01-01', '2026-03-31');
    expect(duration).toBe(3.0);
    expect(formatProbationDuration(duration)).toBe('3.0 months');
  });

  it('correctly calculates exact 6 months duration', () => {
    // Joining Jan 1, ending June 30 -> exactly 6 months
    const duration = calculateProbationDuration('2026-01-01', '2026-06-30');
    expect(duration).toBe(6.0);
    expect(formatProbationDuration(duration)).toBe('6.0 months');
  });

  it('correctly supports fractional months with 1 decimal place', () => {
    // Joining Jan 1, ending Feb 15 -> ~1.5 months
    const duration = calculateProbationDuration('2026-01-01', '2026-02-15');
    expect(duration).toBeGreaterThanOrEqual(1.4);
    expect(duration).toBeLessThanOrEqual(1.6);
  });

  it('returns 0 for invalid or reverse dates (probation_end_date < joining_date)', () => {
    const duration = calculateProbationDuration('2026-06-01', '2026-01-01');
    expect(duration).toBe(0);
    expect(formatProbationDuration(duration)).toBe('0.0 months');
  });

  it('computes completion date as day immediately following probation_end_date', () => {
    const completion = getProbationCompletionDate('2026-03-31');
    expect(completion).toBe('2026-04-01');

    const completionLeap = getProbationCompletionDate('2024-02-28');
    expect(completionLeap).toBe('2024-02-29');

    const completionYearEnd = getProbationCompletionDate('2026-12-31');
    expect(completionYearEnd).toBe('2027-01-01');
  });

  it('correctly assesses active probation status', () => {
    expect(isProbationActive('2026-06-30', '2026-05-15')).toBe(true);
    expect(isProbationActive('2026-06-30', '2026-06-30')).toBe(true);
    expect(isProbationActive('2026-06-30', '2026-07-01')).toBe(false);
    expect(isProbationActive(null)).toBe(false);
  });
});

