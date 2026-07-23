import { useState, useEffect, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import type { AttendanceRecord, WorkSessionType } from '../attendance.repository';
import type { GeoPoint } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';
import { useGeolocation } from './useGeolocation';
import { toLocalISODate } from '../../../shared/utils/date';
import { hoursThisMonth as calcHoursThisMonth, attendancePercent } from '../../../shared/utils/metrics';

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

  const startBreak = useCallback(async (reason?: string) => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    setLoading(true);
    const res = await service.startBreak(user.id, reason);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const endBreak = useCallback(async () => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    setLoading(true);
    const res = await service.endBreak(user.id);
    setLoading(false);
    if (res.ok) {
      setRecord(res.value);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

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
