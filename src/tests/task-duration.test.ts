import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateTaskTotalSeconds,
  formatHoursMinutes,
  formatDurationFromHours,
} from '../shared/utils/taskDuration';
import { taskTimerStore } from '../shared/utils/taskTimerStore';

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

describe('Continuous Task Duration Accumulation and Resume Across Start/Pause Cycles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('continuously accumulates duration across multiple Start, Pause, and Resume cycles (2h + 1h = 3h)', () => {
    const taskId = 'task-acc-test-1';
    let mockNow = 1700000000000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);

    // 1. Employee starts task in the morning and works for 2 hours (7200 seconds)
    taskTimerStore.startTask(taskId);
    let timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(true);
    expect(timer?.elapsedMs).toBe(0);

    // Fast-forward 2 hours (7,200,000 ms)
    mockNow += 2 * 3600 * 1000;

    // 2. Employee pauses task: accumulated duration is now 2 hours
    taskTimerStore.pauseTask(taskId);
    timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(false);
    expect(timer?.elapsedMs).toBe(7200000); // 2 hours
    const durationAfterFirstPause = formatHoursMinutes(Math.floor((timer?.elapsedMs || 0) / 1000));
    expect(durationAfterFirstPause).toBe('2h 0m');

    // Fast-forward 1 hour of break / other activity
    mockNow += 1 * 3600 * 1000;

    // 3. Employee resumes the same task: timer MUST resume from 2-hour mark, NOT restart from 0
    taskTimerStore.startTask(taskId);
    timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(true);
    expect(timer?.elapsedMs).toBe(7200000); // Resumes from 2h mark!

    // 4. Employee works for another 1 hour (3600 seconds)
    mockNow += 1 * 3600 * 1000;

    // 5. Employee pauses the task again: accumulated duration is now 3 hours
    taskTimerStore.pauseTask(taskId);
    timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(false);
    expect(timer?.elapsedMs).toBe(10800000); // 3 hours (7200000 + 3600000)
    const durationAfterSecondPause = formatHoursMinutes(Math.floor((timer?.elapsedMs || 0) / 1000));
    expect(durationAfterSecondPause).toBe('3h 0m');

    // 6. Resuming again continues from 3-hour mark
    mockNow += 30 * 60 * 1000;
    taskTimerStore.startTask(taskId);
    timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(true);
    expect(timer?.elapsedMs).toBe(10800000);

    vi.restoreAllMocks();
  });

  it('resumes from existing database actualHours when started for the first time in a new session', () => {
    const taskId = 'task-db-resume-test';
    const existingDbHours = 2.0; // 2 hours from DB
    const initialElapsedMs = Math.round(existingDbHours * 3600 * 1000); // 7,200,000 ms

    // Starting task with existing hours preserves them
    taskTimerStore.startTask(taskId, initialElapsedMs);
    const timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(true);
    expect(timer?.elapsedMs).toBe(7200000); // 2 hours preserved, not zero!
  });
});
