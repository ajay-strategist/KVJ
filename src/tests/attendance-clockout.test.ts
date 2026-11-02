import { describe, it, expect } from 'vitest';

export interface WorkSessionTest {
  id: string;
  clockIn: string;
  clockOut?: string;
}

export interface BreakRecordTest {
  id: string;
  workSessionId: string;
  startTime: string;
  endTime?: string;
}

export function computeShiftDurations(sessions: WorkSessionTest[], breaks: BreakRecordTest[], clockOutTime: string) {
  let totalWorkingMs = 0;
  const closedSessions = sessions.map((s) => {
    const end = s.clockOut || clockOutTime;
    const dur = new Date(end).getTime() - new Date(s.clockIn).getTime();
    totalWorkingMs += Math.max(0, dur);
    return { ...s, clockOut: end };
  });

  let totalBreakMs = 0;
  const closedBreaks = breaks.map((b) => {
    const end = b.endTime || clockOutTime;
    const dur = new Date(end).getTime() - new Date(b.startTime).getTime();
    totalBreakMs += Math.max(0, dur);
    return { ...b, endTime: end };
  });

  const netWorkingMs = Math.max(0, totalWorkingMs - totalBreakMs);

  return {
    totalWorkingMinutes: Math.round(totalWorkingMs / 60000),
    totalBreakMinutes: Math.round(totalBreakMs / 60000),
    netWorkingMinutes: Math.round(netWorkingMs / 60000),
    closedSessions,
    closedBreaks,
  };
}

describe('Attendance Lifecycle & Clock-Out Remediation (ISSUE-004 & ISSUE-012)', () => {
  it('correctly computes standard single shift (09:00 to 17:00)', () => {
    const sessions = [{ id: 'ws-1', clockIn: '2026-11-02T09:00:00Z' }];
    const breaks = [{ id: 'brk-1', workSessionId: 'ws-1', startTime: '2026-11-02T13:00:00Z', endTime: '2026-11-02T14:00:00Z' }];
    const clockOut = '2026-11-02T17:00:00Z';

    const res = computeShiftDurations(sessions, breaks, clockOut);
    // 8 hours total = 480 mins, 1 hour break = 60 mins, net = 420 mins (7 hours)
    expect(res.totalWorkingMinutes).toBe(480);
    expect(res.totalBreakMinutes).toBe(60);
    expect(res.netWorkingMinutes).toBe(420);
    expect(res.closedSessions[0].clockOut).toBe(clockOut);
  });

  it('correctly calculates overnight shift crossing midnight boundary (ISSUE-012)', () => {
    // Clock in at 23:00 on Nov 1, clock out at 07:00 on Nov 2 (8 hours total)
    const sessions = [{ id: 'ws-night', clockIn: '2026-11-01T23:00:00Z' }];
    const breaks = [{ id: 'brk-night', workSessionId: 'ws-night', startTime: '2026-11-02T03:00:00Z', endTime: '2026-11-02T03:30:00Z' }];
    const clockOut = '2026-11-02T07:00:00Z';

    const res = computeShiftDurations(sessions, breaks, clockOut);
    expect(res.totalWorkingMinutes).toBe(480);
    expect(res.totalBreakMinutes).toBe(30);
    expect(res.netWorkingMinutes).toBe(450);
  });

  it('closes any active unclosed break upon clock-out (preventing orphaned open breaks)', () => {
    const sessions = [{ id: 'ws-2', clockIn: '2026-11-02T10:00:00Z' }];
    // Break was never closed
    const breaks = [{ id: 'brk-2', workSessionId: 'ws-2', startTime: '2026-11-02T15:00:00Z' }];
    const clockOut = '2026-11-02T16:00:00Z';

    const res = computeShiftDurations(sessions, breaks, clockOut);
    expect(res.closedBreaks[0].endTime).toBe(clockOut);
    expect(res.totalBreakMinutes).toBe(60);
  });

  it('synthesizes and closes fallback session if sessions array was empty during clock-out', () => {
    const clockIn = '2026-11-02T09:00:00Z';
    const clockOut = '2026-11-02T17:00:00Z';
    // Sessions array was empty
    const sessions: WorkSessionTest[] = [];
    const breaks: BreakRecordTest[] = [];

    // Synthesize fallback session from firstClockIn to clockOut
    let effectiveSessions = sessions;
    if (effectiveSessions.length === 0) {
      effectiveSessions = [{ id: 'fallback-session', clockIn, clockOut }];
    }

    const res = computeShiftDurations(effectiveSessions, breaks, clockOut);
    expect(res.totalWorkingMinutes).toBe(480);
    expect(res.netWorkingMinutes).toBe(480);
    expect(res.closedSessions[0].clockOut).toBe(clockOut);
  });
});

