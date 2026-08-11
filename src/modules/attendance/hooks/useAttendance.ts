import { useState, useEffect, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import type { AttendanceRecord, WorkSessionType } from '../attendance.repository';
import type { GeoPoint } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';
import { useGeolocation } from './useGeolocation';
import { toLocalISODate } from '../../../shared/utils/date';
import { hoursThisMonth as calcHoursThisMonth, attendancePercent } from '../../../shared/utils/metrics';
import { TASK_WORK_SESSION_REPOSITORY_TOKEN, type TaskWorkSession } from '../../project/project.repository';

/** localStorage key holding the tasks auto-paused by the current break, per user. */
const breakPausedKey = (userId: string) => `kvj_break_paused_tasks_${userId}`;

/** Only a real Supabase Auth UUID is safe to write into uuid columns. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ERR = 'Your session is not fully verified. Please log out and sign in again with your registered email and password.';

export function useAttendance() {
  const service = useMemo(() => container.resolve(ATTENDANCE_SERVICE_TOKEN), []);
  const { user } = useAuth();
  const { getPosition } = useGeolocation();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayRecord = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await service.getRecordForToday(user.id);
    if (res.ok) {
      setRecord(res.value);
      setError(null);
    } else {
      setError(res.error.message);
    }

    // This month's history — used for the real "Hours this Month" and
    // "Attendance %" figures (formerly hardcoded on My Day).
    const now = new Date();
    const from = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = toLocalISODate(now);
    const hist = await service.getHistory(user.id, { from, to });
    if (hist.ok) setMonthRecords(hist.value);

    setLoading(false);
  }, [service, user]);

  /** Real monthly aggregates (0 when there is no attendance yet). */
  const monthly = useMemo(() => {
    const hours = calcHoursThisMonth(monthRecords);
    // Attendance % = present days ÷ recorded working days × 100.
    const total = monthRecords.length;
    const present = monthRecords.filter((r) => !!r.firstClockIn).length;
    return { hours, attendancePct: attendancePercent(present, total) };
  }, [monthRecords]);

  const clockIn = useCallback(async (workType: WorkSessionType) => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    if (!UUID_RE.test(user.id)) return { ok: false, error: SESSION_ERR };
    setLoading(true);
    let geo: GeoPoint | undefined;
    try {
      geo = await getPosition();
    } catch {
      console.warn('Geolocation failed. Clocking in without coordinates.');
    }
    const res = await service.clockIn(user.id, workType, geo);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, getPosition]);

  const clockOut = useCallback(async () => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    if (!UUID_RE.test(user.id)) return { ok: false, error: SESSION_ERR };
    setLoading(true);
    let geo: GeoPoint | undefined;
    try {
      geo = await getPosition();
    } catch {
      console.warn('Geolocation failed. Clocking out without coordinates.');
    }
    const res = await service.clockOut(user.id, geo);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, getPosition]);

  /**
   * Break ⇄ task-session coupling: starting a break pauses whatever task the
   * user is actively working on, and ending the break resumes exactly those
   * task(s). Best-effort — any task-session error is swallowed so it can never
   * block the break itself. Nothing is deleted; a paused session is just closed
   * with status 'paused', and resuming opens a fresh 'running' session.
   */
  const pauseRunningTasksForBreak = useCallback(async () => {
    if (!user) return;
    try {
      const taskRepo = container.resolve(TASK_WORK_SESSION_REPOSITORY_TOKEN);
      const actor = { id: user.id, role: user.role };
      const page = await taskRepo.findMany({ pageSize: 500 });
      const running = (page.data || []).filter(
        (s: TaskWorkSession) => s.employeeId === user.id && (s as any).status === 'running' && !(s as any).deletedAt,
      );
      const resumeList: Partial<TaskWorkSession>[] = [];
      for (const s of running) {
        const endTime = new Date();
        const durationMinutes = Math.max(0, Math.round((endTime.getTime() - new Date(s.startTime).getTime()) / 60000));
        await taskRepo.update(s.id, { endTime: endTime.toISOString(), durationMinutes, status: 'paused' } as Partial<TaskWorkSession>, actor);
        resumeList.push({
          taskId: s.taskId, projectId: s.projectId, workTitle: s.workTitle, workCode: s.workCode,
          supervisorId: s.supervisorId, supervisorName: s.supervisorName,
        });
      }
      localStorage.setItem(breakPausedKey(user.id), JSON.stringify(resumeList));
    } catch (e) {
      console.warn('Auto-pause task on break failed:', e);
    }
  }, [user]);

  const resumeTasksAfterBreak = useCallback(async () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(breakPausedKey(user.id));
      if (!raw) return;
      const list: Partial<TaskWorkSession>[] = JSON.parse(raw) || [];
      const taskRepo = container.resolve(TASK_WORK_SESSION_REPOSITORY_TOKEN);
      const actor = { id: user.id, role: user.role };
      for (const t of list) {
        await taskRepo.create(
          { ...t, employeeId: user.id, startTime: new Date().toISOString(), status: 'running' } as Partial<TaskWorkSession>,
          actor,
        );
      }
      localStorage.removeItem(breakPausedKey(user.id));
    } catch (e) {
      console.warn('Auto-resume task after break failed:', e);
    }
  }, [user]);

  const startBreak = useCallback(async (reason?: string) => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    if (!UUID_RE.test(user.id)) return { ok: false, error: SESSION_ERR };
    setLoading(true);
    const res = await service.startBreak(user.id, reason);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      await pauseRunningTasksForBreak();
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, pauseRunningTasksForBreak]);

  const endBreak = useCallback(async () => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    if (!UUID_RE.test(user.id)) return { ok: false, error: SESSION_ERR };
    setLoading(true);
    const res = await service.endBreak(user.id);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      await resumeTasksAfterBreak();
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, resumeTasksAfterBreak]);

  useEffect(() => {
    fetchTodayRecord();
  }, [fetchTodayRecord]);

  return {
    record,
    monthRecords,
    hoursThisMonth: monthly.hours,
    monthAttendancePct: monthly.attendancePct,
    loading,
    error,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    refresh: fetchTodayRecord,
  };
}
