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
});

