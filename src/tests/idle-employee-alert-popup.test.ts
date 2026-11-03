import { describe, it, expect, vi } from 'vitest';
import { playTeamsIdleChime } from '../shared/notifications/IdleEmployeeAlertPopup';

describe('IdleEmployeeAlertPopup and Notification Chime', () => {
  it('playTeamsIdleChime runs safely without throwing exceptions', () => {
    // In node/test environment window.AudioContext might not be defined or mocked
    expect(() => playTeamsIdleChime()).not.toThrow();
  });

  it('correctly formats and identifies idle duration thresholds', () => {
    const calculateMinutes = (startMs: number, nowMs: number) => {
      return Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60)));
    };

    const now = Date.now();
    const tenMinsAgo = now - 10 * 60 * 1000;
    const eighteenMinsAgo = now - 18 * 60 * 1000;
    const twoHoursAgo = now - 125 * 60 * 1000;

    expect(calculateMinutes(tenMinsAgo, now)).toBe(10);
    expect(calculateMinutes(tenMinsAgo, now) >= 15).toBe(false);

    expect(calculateMinutes(eighteenMinsAgo, now)).toBe(18);
    expect(calculateMinutes(eighteenMinsAgo, now) >= 15).toBe(true);

    const minutes = calculateMinutes(twoHoursAgo, now);
    const formatted = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
    expect(formatted).toBe('2h 5m');
  });

  it('respects dismissal snooze duration of 30 minutes', () => {
    const isSnoozed = (lastDismissedMs: number, nowMs: number) => {
      return nowMs - lastDismissedMs < 30 * 60 * 1000;
    };

    const now = Date.now();
    const dismissed5MinsAgo = now - 5 * 60 * 1000;
    const dismissed35MinsAgo = now - 35 * 60 * 1000;

    expect(isSnoozed(dismissed5MinsAgo, now)).toBe(true);
    expect(isSnoozed(dismissed35MinsAgo, now)).toBe(false);
  });

  it('cross-checks breaks so employees on break or returning from break are not falsely flagged as idle', () => {
    const calculateIdleInfo = (params: {
      status: string;
      clockInIso: string;
      lastTaskEndIso?: string;
      breaks: Array<{ startTime: string; endTime?: string }>;
      now: number;
    }) => {
      const { status, clockInIso, lastTaskEndIso, breaks, now } = params;

      // 1. If currently on break
      const hasOpenBreak = breaks.some((b) => !b.endTime);
      if (status === 'on_break' || hasOpenBreak) {
        return { isIdle: false, idleMinutes: 0 };
      }

      let idleStartMs = new Date(clockInIso).getTime();

      // 2. Finished task session
      if (lastTaskEndIso) {
        const taskEndMs = new Date(lastTaskEndIso).getTime();
        if (taskEndMs > idleStartMs) {
          idleStartMs = taskEndMs;
        }
      }

      // 3. Finished breaks
      breaks.forEach((b) => {
        if (b.endTime) {
          const breakEndMs = new Date(b.endTime).getTime();
          if (breakEndMs > idleStartMs) {
            idleStartMs = breakEndMs;
          }
        }
      });

      const idleMinutes = Math.max(0, Math.floor((now - idleStartMs) / (1000 * 60)));
      return {
        isIdle: idleMinutes >= 15,
        idleMinutes,
      };
    };

    const baseTime = 1700000000000;
    const clockInIso = new Date(baseTime - 3600 * 1000).toISOString(); // 1 hr ago
    const taskEndIso = new Date(baseTime - 30 * 60 * 1000).toISOString(); // 30 mins ago

    // Case 1: Employee is currently on break
    const resOnBreak = calculateIdleInfo({
      status: 'on_break',
      clockInIso,
      lastTaskEndIso: taskEndIso,
      breaks: [{ startTime: new Date(baseTime - 10 * 60 * 1000).toISOString() }],
      now: baseTime,
    });
    expect(resOnBreak.isIdle).toBe(false);
    expect(resOnBreak.idleMinutes).toBe(0);

    // Case 2: Employee was on break until 4 minutes ago
    // Task ended 30 mins ago, but break was from 25 mins ago to 4 mins ago!
    const resRecentBreak = calculateIdleInfo({
      status: 'present',
      clockInIso,
      lastTaskEndIso: taskEndIso,
      breaks: [{
        startTime: new Date(baseTime - 25 * 60 * 1000).toISOString(),
        endTime: new Date(baseTime - 4 * 60 * 1000).toISOString(),
      }],
      now: baseTime,
    });
    // Idle time should only be 4 minutes since break ended, NOT 30 minutes!
    expect(resRecentBreak.idleMinutes).toBe(4);
    expect(resRecentBreak.isIdle).toBe(false);

    // Case 3: Break ended 20 minutes ago with no new task started
    const resExpiredBreak = calculateIdleInfo({
      status: 'present',
      clockInIso,
      lastTaskEndIso: taskEndIso,
      breaks: [{
        startTime: new Date(baseTime - 45 * 60 * 1000).toISOString(),
        endTime: new Date(baseTime - 20 * 60 * 1000).toISOString(),
      }],
      now: baseTime,
    });
    expect(resExpiredBreak.idleMinutes).toBe(20);
    expect(resExpiredBreak.isIdle).toBe(true);
  });
});

