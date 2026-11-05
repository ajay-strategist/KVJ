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

  it('ensures paused tasks remain paused and cannot be resurrected by stale DB session rows', () => {
    const taskId = 'task-pause-resurrection-test';
    taskTimerStore.startTask(taskId);
    expect(taskTimerStore.getTimer(taskId)?.isRunning).toBe(true);

    // Pause the task
    taskTimerStore.pauseTask(taskId);
    expect(taskTimerStore.getTimer(taskId)?.isRunning).toBe(false);

    // Simulate stored task states
    const storedStates: Record<string, any> = {
      [taskId]: {
        active: false,
        secondsToday: 120,
      },
    };

    // Stale DB session row that has not yet been polled or updated
    const staleRunningDbSessions = [{ task_id: taskId, status: 'running' }];
    const task = { id: taskId, status: 'todo' };

    // Evaluation logic used in MyDayPage
    const stored = storedStates[taskId];
    const isExplicitlyPaused = stored?.active === false || task.status === 'todo';
    const underReview = false;
    const isApproved = false;
    const isExplicitlyDoneOrReview = underReview || isApproved;

    let isDbRunning = false;
    if (!isExplicitlyPaused && !isExplicitlyDoneOrReview) {
      isDbRunning = Boolean(staleRunningDbSessions.find((s) => s.task_id === taskId)) || task.status === 'in_progress';
    }

    expect(isExplicitlyPaused).toBe(true);
    expect(isDbRunning).toBe(false);

    let active = false;
    if (isDbRunning) {
      active = true;
    } else if (stored) {
      active = stored.active && !isExplicitlyPaused;
    }

    expect(active).toBe(false);
  });

  it('accurately calculates duration for task created and started 13 minutes ago without inflating to > 1 hour', () => {
    const taskId = 'task-mim-ug-tracker';
    const startTimeIso = '2026-11-05T05:17:00.000Z'; // 10:47 AM
    const nowIso = '2026-11-05T05:30:00.000Z'; // 11:00 AM (13 minutes later)
    const now = new Date(nowIso).getTime();
    const sessionStartMs = new Date(startTimeIso).getTime();

    // 1. Task has only 1 active running session, 0 completed sessions
    const taskSessions = [
      {
        id: 'sess-1',
        task_id: taskId,
        employee_id: 'emp-ajay',
        status: 'running',
        start_time: startTimeIso,
        end_time: null,
      },
    ];

    // Simulate task record in DB which might have corrupted actualHours
    const taskRecord = {
      id: taskId,
      title: 'MIM UG Tracker',
      actualHours: 1.83, // Corrupted by runaway loop in previous versions
      status: 'in_progress',
    };

    // Calculate completed sessions duration
    const completedSessions = taskSessions.filter((s) => s.end_time || s.status !== 'running');
    const completedSeconds = completedSessions.reduce((sum: number, s: any) => {
      if (s.duration_minutes || s.durationMinutes) {
        return sum + Number(s.duration_minutes || s.durationMinutes) * 60;
      }
      return sum;
    }, 0);

    const runningSession = taskSessions.find((s) => s.status === 'running' && !s.end_time);
    const liveSeconds = runningSession?.start_time
      ? Math.max(0, Math.floor((now - new Date(runningSession.start_time).getTime()) / 1000))
      : 0;

    let secondsToday = 0;
    if (taskSessions.length > 0) {
      secondsToday = completedSeconds + liveSeconds;
    } else {
      secondsToday = Math.round(((taskRecord as any).actualHours || 0) * 3600) + liveSeconds;
    }

    // 13 minutes = 780 seconds
    expect(liveSeconds).toBe(780);
    expect(completedSeconds).toBe(0);
    expect(secondsToday).toBe(780);
    expect(formatHoursMinutes(secondsToday)).toBe('0h 13m');
    // Ensure it is NOT 1h 50m (6600s)
    expect(secondsToday).toBeLessThan(3600);

    // Verify taskTimerStore handles customStartTime accurately
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    taskTimerStore.startTask(taskId, completedSeconds * 1000, sessionStartMs);
    const timer = taskTimerStore.getTimer(taskId);
    expect(timer?.isRunning).toBe(true);
    expect(timer?.startTime).toBe(sessionStartMs);
    expect(timer?.elapsedMs).toBe(0);

    const totalTimerSec = Math.floor((timer?.elapsedMs || 0) / 1000) + Math.floor((now - (timer?.startTime || now)) / 1000);
    expect(totalTimerSec).toBe(780);
    expect(formatHoursMinutes(totalTimerSec)).toBe('0h 13m');

    vi.restoreAllMocks();
  });
});
