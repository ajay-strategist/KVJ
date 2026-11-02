import { describe, it, expect } from 'vitest';
import {
  calculateTaskTotalSeconds,
  formatHoursMinutes,
  formatDurationFromHours,
} from '../shared/utils/taskDuration';

describe('Task Duration Calculations & Formatting (ISSUE-001)', () => {
  it('formats whole and fractional hours into Xh Ym', () => {
    expect(formatDurationFromHours(0)).toBe('0h 0m');
    expect(formatDurationFromHours(1.5)).toBe('1h 30m');
    expect(formatDurationFromHours(2.25)).toBe('2h 15m');
    expect(formatDurationFromHours(0.75)).toBe('0h 45m');
    expect(formatDurationFromHours(10)).toBe('10h 0m');
  });

  it('calculates total duration for paused or idle task with historical hours', () => {
    // 2.5 hours historical, timer paused with 300 seconds (5m)
    const totalSec = calculateTaskTotalSeconds({
      historicalHours: 2.5,
      timerElapsedMs: 300000,
      isRunning: false,
    });
    // 2.5 * 3600 = 9000s + 300s = 9300s = 2h 35m
    expect(totalSec).toBe(9300);
    expect(formatHoursMinutes(totalSec)).toBe('2h 35m');
  });

  it('correctly adds live running timer seconds to historical hours without refresh jumping', () => {
    const baseTime = 1700000000000;
    // Task has 1.0 hour historical (3600s). Started 120s ago.
    const totalSec = calculateTaskTotalSeconds({
      historicalHours: 1.0,
      timerStartTime: baseTime,
      isRunning: true,
      now: baseTime + 120000, // 2 minutes later
    });
    // 3600 + 120 = 3720s = 1h 2m
    expect(totalSec).toBe(3720);
    expect(formatHoursMinutes(totalSec)).toBe('1h 2m');
  });

  it('handles zero or negative inputs gracefully', () => {
    expect(formatHoursMinutes(-50)).toBe('0h 0m');
    expect(calculateTaskTotalSeconds({ historicalHours: -1 })).toBe(0);
  });
});

