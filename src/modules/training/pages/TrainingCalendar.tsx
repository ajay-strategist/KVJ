/**
 * Training Resource Planner — a single Resource Matrix workspace.
 *
 * Provides date range selection, comprehensive multi-dimensional filters,
 * real-time conflict detection, KPI metrics, cell assignment, and virtualized
 * matrix grid rendering.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button, Avatar } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { isEligibleTrainer, sortEmployeesByCode } from '../../employee/employee.repository';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { todayISO, formatDisplayDate } from '../../../shared/utils/date';
import {
  fetchScheduleRange, detectConflicts, eachDate, presetRange, PRESETS, CONFLICT_META,
  type ScheduleRangeResult, type ScheduleSession, type ScheduleConflict,
  type ConflictStatus, type PresetId,
} from '../schedule.data';
import { BATCH_REPOSITORY_TOKEN, COURSE_REPOSITORY_TOKEN, type Batch, type Course } from '../training.repository';
import { cleanBatchCode } from '../utils/batch-formatter';
import { supabase } from '../../../shared/integration/supabase';
import { useTraining } from '../hooks/useTraining';

const EMPTY: ScheduleRangeResult = { sessions: [], leaves: [], holidays: [], daysLoaded: 0 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toValidUuid = (val?: string | null): string | null => (val && UUID_RE.test(val) ? val : null);

const FROZEN = { date: 116, day: 56, holiday: 132 };
const FROZEN_W = FROZEN.date + FROZEN.day + FROZEN.holiday;
const COL_W = 250;

interface FilterState {
  search: string;
  trainer: string;
  college: string;
  course: string;
  batch: string;
  status: string;
  leave: string;
  holiday: string;
  venue: string;
  coordinator: string;
  year: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  trainer: 'all',
  college: 'all',
  course: 'all',
  batch: 'all',
  status: 'all',
  leave: 'all',
  holiday: 'all',
  venue: 'all',
  coordinator: 'all',
  year: 'all',
};

const SAVED_KEY = 'kvj.planner.savedFilters';

export interface RecurrenceConfig {
  mode: 'none' | 'consecutive' | 'range' | 'custom_days';
  startDate: string; // YYYY-MM-DD
  consecutiveDays?: number; // e.g. 3
  endDate?: string; // YYYY-MM-DD
  selectedWeekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  repeatWeeks?: number; // e.g. 2
  skipSundays?: boolean; // default true
  skipSaturdays?: boolean; // default false
  skipHolidays?: boolean; // default true
  holidayDates?: Set<string>; // set of YYYY-MM-DD holiday strings
}

export function computeRecurrenceDates(config: RecurrenceConfig): string[] {
  const {
    mode,
    startDate,
    consecutiveDays = 1,
    endDate,
    selectedWeekdays = [1, 2, 3, 4, 5],
    repeatWeeks = 1,
    skipSundays = true,
    skipSaturdays = false,
    skipHolidays = true,
    holidayDates = new Set<string>(),
  } = config;

  if (!startDate) return [];
  if (mode === 'none') return [startDate];

  const results: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  if (isNaN(start.getTime())) return [startDate];

  if (mode === 'consecutive') {
    const curr = new Date(start);
    let collected = 0;
    const maxSafety = 60;
    let iterations = 0;

    while (collected < consecutiveDays && iterations < maxSafety) {
      iterations++;
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat

      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const isHoliday = holidayDates.has(dateStr);

      const skip =
        (skipSundays && isSunday) ||
        (skipSaturdays && isSaturday) ||
        (skipHolidays && isHoliday);

      if (!skip) {
        results.push(dateStr);
        collected++;
      }
      curr.setDate(curr.getDate() + 1);
    }
  } else if (mode === 'range') {
    if (!endDate || endDate < startDate) return [startDate];
    const end = new Date(`${endDate}T00:00:00`);
    const curr = new Date(start);
    const maxSafety = 90;
    let iterations = 0;

    while (curr <= end && iterations < maxSafety) {
      iterations++;
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = curr.getDay();

      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const isHoliday = holidayDates.has(dateStr);

      const skip =
        (skipSundays && isSunday) ||
        (skipSaturdays && isSaturday) ||
        (skipHolidays && isHoliday);

      if (!skip) {
        results.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
    }
  } else if (mode === 'custom_days') {
    const totalDays = (repeatWeeks || 1) * 7;
    const curr = new Date(start);
    const maxSafety = Math.min(totalDays + 14, 90);
    let iterations = 0;

    while (iterations < maxSafety && results.length < 30) {
      iterations++;
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = curr.getDay();

      if (endDate && dateStr > endDate) break;

      const isMatchingWeekday = selectedWeekdays.includes(dayOfWeek);
      const isHoliday = holidayDates.has(dateStr);
      const skip = !isMatchingWeekday || (skipHolidays && isHoliday);

      if (!skip) {
        results.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
      if (iterations >= totalDays && !endDate) break;
    }
  }

  return results.length > 0 ? results : [startDate];
}

export function TrainingCalendar() {
  const { user } = useAuth();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isExecutive = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const { saveCalendarSession, deleteCalendarSession } = useTraining();
  const [submittingSession, setSubmittingSession] = useState(false);

  // ── Date range (default: current month) ──
  const [preset, setPreset] = useState<PresetId>('current_month');
  const [range, setRange] = useState(() => presetRange('current_month'));

  const [data, setData] = useState<ScheduleRangeResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  // Additional user-created sessions in state loaded from Supabase + localStorage
  const [customSessions, setCustomSessions] = useState<ScheduleSession[]>(() => {
    try {
      const saved = localStorage.getItem('kvj_planner_custom_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kvj_planner_custom_sessions', JSON.stringify(customSessions));
    } catch {}
  }, [customSessions]);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  // Real enrolled-student count per batch (from the batch's actual student data),
  // not the batch capacity. Keyed by batch id.
  const [batchStudentCounts, setBatchStudentCounts] = useState<Record<string, number>>({});

  // Load schedule sessions from canonical Supabase flwdsk_schedule_sessions table (CAL-Q01 & ISSUE-005)
  // with resilient fallback to flwdsk_calendar_sessions for unmigrated environments
  const loadDbSessions = useCallback(async () => {
    try {
      const [schedRes, calRes] = await Promise.allSettled([
        supabase
          .from('flwdsk_schedule_sessions')
          .select('*')
          .is('deleted_at', null),
        supabase
          .from('flwdsk_calendar_sessions')
          .select('*')
          .is('deleted_at', null),
      ]);

      const schedRows = schedRes.status === 'fulfilled' && schedRes.value.data ? schedRes.value.data : [];
      const calRows = calRes.status === 'fulfilled' && calRes.value.data ? calRes.value.data : [];

      // Combine rows: prefer schedule_sessions if it has session_title/color; otherwise pull from calendar_sessions
      const mergedMap = new Map<string, any>();

      calRows.forEach((r: any) => {
        mergedMap.set(r.id, r);
      });

      schedRows.forEach((r: any) => {
        if (!r.student_id) { // Only parent calendar session rows, not individual student attendance rows
          const existing = mergedMap.get(r.id);
          mergedMap.set(r.id, {
            ...existing,
            ...r,
            session_title: r.session_title || existing?.session_title || r.notes,
            color: r.color || existing?.color || 'var(--brand)',
            start_time: r.start_time || existing?.start_time || '09:00',
            end_time: r.end_time || existing?.end_time || '16:00',
            venue: r.venue || existing?.venue,
            mode: r.mode || existing?.mode,
          });
        }
      });

      const combinedRows = Array.from(mergedMap.values());

      if (combinedRows.length > 0) {
        const dbSess: ScheduleSession[] = combinedRows.map((r: any) => {
          const matchedBatch = batches.find((b) => b.id === r.batch_id);
          const matchedCourse = matchedBatch ? courses.find((c) => c.id === matchedBatch.courseId) : undefined;

          return {
            id: r.id,
            trainerId: r.trainer_id || user?.id || (trainers[0]?.id ?? ''),
            date: r.date,
            name: r.session_title || matchedBatch?.trainingName || matchedCourse?.title || 'Training Session',
            batchCode: matchedBatch?.code || r.session_title || 'Training Batch',
            college: matchedBatch?.college || 'College',
            course: matchedCourse?.title || 'Training',
            academicYear: matchedBatch?.academicYear || '2026-27',
            coordinator: matchedBatch?.coordinator || 'Coordinator',
            startTime: r.start_time || '09:00',
            endTime: r.end_time || '16:00',
            venue: r.venue || matchedBatch?.venue || 'Campus',
            mode: (r.mode === 'Online' ? 'Online' : 'Offline') as any,
            studentCount: r.student_count || matchedBatch?.capacity || 30,
            status: (r.status || 'Scheduled') as any,
            color: r.color || 'var(--brand)',
          };
        });

        setCustomSessions(dbSess);
      } else {
        setCustomSessions([]);
      }
    } catch (e) {
      console.warn('Could not load calendar sessions:', e);
    }
  }, [batches, courses, user, trainers]);

  useEffect(() => {
    loadDbSessions();
  }, [loadDbSessions]);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [savedFilters, setSavedFilters] = useState<Record<string, FilterState>>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}');
    } catch {
      return {};
    }
  });

  const [conflictOverrides, setConflictOverrides] = useState<Record<string, ConflictStatus>>({});
  const [conflictFilter, setConflictFilter] = useState({ trainer: 'all', severity: 'all', status: 'Open', date: 'all' });
  const [showConflictsPanel, setShowConflictsPanel] = useState(false);
  const [detailConflict, setDetailConflict] = useState<ScheduleConflict | null>(null);
  const [detailSession, setDetailSession] = useState<ScheduleSession | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Assign / Edit Schedule Drawer state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    date: string;
    trainerId: string;
    name: string;
    batchCode: string;
    batchId: string;
    college: string;
    course: string;
    academicYear: string;
    coordinator: string;
    startTime: string;
    endTime: string;
    venue: string;
    mode: 'Offline' | 'Online';
    studentCount: number;
    capacity?: number;
    batchStartDate?: string;
    batchEndDate?: string;
    phase?: string;
  }>({
    date: todayISO(),
    trainerId: '',
    name: '',
    batchCode: '',
    batchId: '',
    college: '',
    course: '',
    academicYear: '',
    coordinator: '',
    startTime: '09:00',
    endTime: '12:00',
    venue: '',
    mode: 'Offline',
    studentCount: 0,
  });

  // Repeating / Recurrence state for Assign Schedule
  const [repeatMode, setRepeatMode] = useState<'none' | 'consecutive' | 'range' | 'custom_days'>('none');
  const [repeatDaysCount, setRepeatDaysCount] = useState<number>(3);
  const [repeatEndDate, setRepeatEndDate] = useState<string>('');
  const [repeatSkipSundays, setRepeatSkipSundays] = useState<boolean>(true);
  const [repeatSkipSaturdays, setRepeatSkipSaturdays] = useState<boolean>(false);
  const [repeatSkipHolidays, setRepeatSkipHolidays] = useState<boolean>(true);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [repeatWeeksCount, setRepeatWeeksCount] = useState<number>(2);

  const holidayDateSet = useMemo(() => {
    const set = new Set<string>();
    (data.holidays || []).forEach((h) => {
      if (h.date) set.add(h.date);
    });
    return set;
  }, [data.holidays]);

  const scheduledDates = useMemo(() => {
    if (editingSessionId || repeatMode === 'none') {
      return [assignForm.date];
    }
    return computeRecurrenceDates({
      mode: repeatMode,
      startDate: assignForm.date,
      consecutiveDays: repeatDaysCount,
      endDate: repeatEndDate,
      selectedWeekdays: repeatWeekdays,
      repeatWeeks: repeatWeeksCount,
      skipSundays: repeatSkipSundays,
      skipSaturdays: repeatSkipSaturdays,
      skipHolidays: repeatSkipHolidays,
      holidayDates: holidayDateSet,
    });
  }, [
    editingSessionId,
    repeatMode,
    assignForm.date,
    repeatDaysCount,
    repeatEndDate,
    repeatWeekdays,
    repeatWeeksCount,
    repeatSkipSundays,
    repeatSkipSaturdays,
    repeatSkipHolidays,
    holidayDateSet,
  ]);

  const [batchFilterText, setBatchFilterText] = useState('');

  const filteredScheduleBatches = useMemo(() => {
    if (!batchFilterText.trim()) return batches;
    const q = batchFilterText.toLowerCase().trim();
    return batches.filter((b) => {
      const crs = courses.find((c) => c.id === b.courseId);
      const code = (cleanBatchCode(b.code, b.batchNo) || b.code || '').toLowerCase();
      const name = (b.trainingName || '').toLowerCase();
      const college = (b.college || '').toLowerCase();
      const course = (crs?.title || '').toLowerCase();
      return code.includes(q) || name.includes(q) || college.includes(q) || course.includes(q);
    });
  }, [batches, courses, batchFilterText]);

  const applyBatchToForm = useCallback((batchId: string, currentTrainerId?: string) => {
    const b = batches.find((item) => item.id === batchId);
    if (!b) return;
    const c = courses.find((item) => item.id === b.courseId);
    const enrolledCount = batchStudentCounts[b.id] ?? b.capacity ?? 0;
    const cleanCode = cleanBatchCode(b.code, b.batchNo) || b.code || 'Training Batch';
    const topicName = b.trainingName || c?.title || cleanCode;

    if (b.endDate && b.endDate >= (b.startDate || '')) {
      setRepeatEndDate(b.endDate);
    }

    setAssignForm((f) => ({
      ...f,
      batchId: b.id,
      batchCode: cleanCode,
      name: topicName,
      college: b.college || '—',
      course: c?.title || b.trainingName || '—',
      academicYear: b.academicYear || '2026-2027',
      coordinator: b.coordinator || '—',
      venue: f.venue && f.venue !== 'Campus HQ' && f.venue !== 'Lab 1' ? f.venue : (b.venue || 'Campus HQ'),
      mode: (b.onlineLink ? 'Online' : 'Offline') as 'Online' | 'Offline',
      studentCount: enrolledCount,
      capacity: b.capacity,
      batchStartDate: b.startDate,
      batchEndDate: b.endDate,
      phase: b.phase || 'Scheduled',
      trainerId: currentTrainerId || f.trainerId || b.trainerId || (trainers[0]?.id ?? ''),
    }));
  }, [batches, courses, batchStudentCounts, trainers]);

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((r) => {
      if (r.ok) {
        // Training Calendar is a shared resource: EVERY user (Admin/CEO/Manager
        // and all employees) sees and can edit ALL trainers' schedules — no
        // user-level filter. Previously non-executives saw only their own row.
        const activeTrainers = sortEmployeesByCode((r.value || []).filter(isEligibleTrainer));
        setTrainers(activeTrainers);
      }
    });

    const batchRepo = container.resolve(BATCH_REPOSITORY_TOKEN);
    const courseRepo = container.resolve(COURSE_REPOSITORY_TOKEN);
    Promise.all([
      batchRepo.findMany({ pageSize: 1000, page: 1 }),
      courseRepo.findMany({ pageSize: 1000, page: 1 }),
    ]).then(([bRes, cRes]) => {
      setBatches(bRes.data);
      setCourses(cRes.data);
    });

    // Real enrolled-student counts per batch (not capacity). Count the batch's
    // actual, non-deleted enrollments.
    supabase
      .from('flwdsk_enrollments')
      .select('batch_id')
      .is('deleted_at', null)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((e: any) => {
          if (e.batch_id) counts[e.batch_id] = (counts[e.batch_id] || 0) + 1;
        });
        setBatchStudentCounts(counts);
      });
  }, [isExecutive, user]);

  const dynamicBatchPresets = useMemo(() => {
    const list: Array<{
      id: string;
      batchCode: string;
      name: string;
      college: string;
      course: string;
      coordinator: string;
      venue: string;
      mode: 'Online' | 'Offline';
      studentCount: number;
      fullLabel: string;
    }> = [];

    const seenLabels = new Set<string>();

    (batches || []).forEach((b) => {
      const course = courses.find((c) => c.id === b.courseId);
      const cleanCode = cleanBatchCode(b.code, b.batchNo) || b.code || 'Training Batch';
      const courseTitle = course?.title || b.trainingName || '';
      const name = b.trainingName || courseTitle || cleanCode;

      let fullLabel = cleanCode;
      if (courseTitle && !cleanCode.toLowerCase().includes(courseTitle.toLowerCase())) {
        fullLabel = `${cleanCode} - ${courseTitle}`;
      }

      if (seenLabels.has(fullLabel)) {
        return; // Skip duplicate batch option label
      }

      seenLabels.add(fullLabel);
      list.push({
        id: b.id,
        batchCode: cleanCode,
        name,
        college: b.college || '—',
        course: course?.title || '—',
        coordinator: b.coordinator || '—',
        venue: b.venue || '—',
        mode: (b.onlineLink ? 'Online' : 'Offline') as 'Online' | 'Offline',
        // Real enrolled-student count from the batch's student data (not capacity).
        studentCount: batchStudentCounts[b.id] ?? 0,
        fullLabel,
      });
    });

    return list;
  }, [batches, courses, batchStudentCounts]);

  const trainerIds = useMemo(() => trainers.map((t) => t.id), [trainers]);
  const trainerName = useCallback(
    (id: string) => {
      const t = trainers.find((x) => x.id === id);
      return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
    },
    [trainers],
  );

  // Reload data when range changes
  useEffect(() => {
    if (trainerIds.length === 0) return;
    let alive = true;
    setLoading(true);
    fetchScheduleRange({ from: range.from, to: range.to }, trainerIds).then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [range.from, range.to, trainerIds]);

  const combinedSessions = useMemo(() => {
    return [...data.sessions, ...customSessions];
  }, [data.sessions, customSessions]);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    if (id !== 'custom') setRange(presetRange(id));
  };

  // ── Filtering ──
  const visibleTrainers = useMemo(
    () => (filters.trainer === 'all' ? trainers : trainers.filter((t) => t.id === filters.trainer)),
    [trainers, filters.trainer],
  );

  const opts = useMemo(() => ({
    colleges: [...new Set(combinedSessions.map((s) => s.college))].filter(Boolean).sort(),
    courses: [...new Set(combinedSessions.map((s) => s.course))].filter(Boolean).sort(),
    batches: [...new Set(combinedSessions.map((s) => s.batchCode))].filter(Boolean).sort(),
    venues: [...new Set(combinedSessions.map((s) => s.venue))].filter(Boolean).sort(),
    coordinators: [...new Set(combinedSessions.map((s) => s.coordinator))].filter(Boolean).sort(),
    years: [...new Set(combinedSessions.map((s) => s.academicYear))].filter(Boolean).sort(),
  }), [combinedSessions]);

  const sessionMatches = useCallback((s: ScheduleSession) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !`${s.name} ${s.batchCode} ${s.college} ${s.course} ${s.venue} ${s.coordinator}`.toLowerCase().includes(q)) return false;
    if (filters.college !== 'all' && s.college !== filters.college) return false;
    if (filters.course !== 'all' && s.course !== filters.course) return false;
    if (filters.batch !== 'all' && s.batchCode !== filters.batch) return false;
    if (filters.venue !== 'all' && s.venue !== filters.venue) return false;
    if (filters.coordinator !== 'all' && s.coordinator !== filters.coordinator) return false;
    if (filters.year !== 'all' && s.academicYear !== filters.year) return false;
    if (filters.status !== 'all' && s.status !== filters.status) return false;
    return true;
  }, [filters]);

  /** Indexed lookups */
  const index = useMemo(() => {
    const sessionsMap = new Map<string, ScheduleSession[]>();
    for (const s of combinedSessions) {
      if (!sessionMatches(s)) continue;
      const k = `${s.date}|${s.trainerId}`;
      const list = sessionsMap.get(k);
      if (list) list.push(s); else sessionsMap.set(k, [s]);
    }
    const leavesMap = new Map<string, typeof data.leaves[number]>();
    for (const l of data.leaves) {
      if (filters.leave !== 'all' && l.status !== filters.leave) continue;
      leavesMap.set(`${l.date}|${l.trainerId}`, l);
    }
    const holidaysMap = new Map(data.holidays.map((h) => [h.date, h]));
    return { sessions: sessionsMap, leaves: leavesMap, holidays: holidaysMap };
  }, [combinedSessions, data.leaves, data.holidays, sessionMatches, filters.leave]);

  const rows = useMemo(() => {
    const all = eachDate(range.from, range.to);
    return all
      .filter((d) => {
        if (filters.holiday === 'only') return index.holidays.has(d);
        if (filters.holiday === 'exclude') return !index.holidays.has(d);
        return true;
      })
      .map((date) => {
        const dt = new Date(`${date}T00:00:00`);
        return {
          date,
          dayName: dt.toLocaleDateString(undefined, { weekday: 'short' }),
          holiday: index.holidays.get(date),
          isToday: date === todayISO(),
        };
      });
  }, [range.from, range.to, index.holidays, filters.holiday]);

  // ── Conflicts (range-scoped) ──
  const conflicts = useMemo(
    () => detectConflicts(combinedSessions, data.leaves, data.holidays, trainers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))).map((c) => ({ ...c, status: conflictOverrides[c.id] ?? c.status })),
    [data.leaves, data.holidays, combinedSessions, trainers, conflictOverrides],
  );

  const shownConflicts = useMemo(() => conflicts.filter((c) => {
    if (conflictFilter.status !== 'all' && c.status !== conflictFilter.status) return false;
    if (conflictFilter.trainer !== 'all' && c.trainerId !== conflictFilter.trainer) return false;
    if (conflictFilter.severity !== 'all' && c.severity !== conflictFilter.severity) return false;
    if (conflictFilter.date !== 'all' && c.date !== conflictFilter.date) return false;
    return true;
  }), [conflicts, conflictFilter]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const t = todayISO();
    const inRange = t >= range.from && t <= range.to;
    return {
      todaySessions: inRange ? combinedSessions.filter((s) => s.date === t).length : 0,
      todayInRange: inRange,
      availableTrainers: Math.max(0, visibleTrainers.length - (inRange ? data.leaves.filter((l) => l.date === t && l.status === 'Approved').length : 0)),
      pendingLeaves: data.leaves.filter((l) => l.status === 'Pending').length,
      openConflicts: conflicts.filter((c) => c.status === 'Open').length,
    };
  }, [combinedSessions, data.leaves, conflicts, range, visibleTrainers.length]);

  // ── Precise Dynamic Row Height Estimation ──
  const getRowEstimate = useCallback(
    (indexIdx: number) => {
      const r = rows[indexIdx];
      if (!r) return 56;

      let maxCnt = 1;
      for (const t of visibleTrainers) {
        const cnt = (index.sessions.get(`${r.date}|${t.id}`) ?? []).length;
        if (cnt > maxCnt) maxCnt = cnt;
      }

      const isExpanded = !!expanded[r.date];
      const cardHeight = isExpanded ? 94 : 38;
      const padding = 16;
      const calculatedHeight = padding + maxCnt * (cardHeight + 6);

      return Math.max(isExpanded ? 116 : 56, calculatedHeight);
    },
    [rows, expanded, visibleTrainers, index],
  );

  // ── Virtualization ──
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getRowEstimate,
    overscan: 6,
  });

  // Re-measure virtual grid items whenever expansion state changes
  useEffect(() => {
    rowVirt.measure();
  }, [expanded, rowVirt]);

  // Auto-scroll to Today's row on calendar load
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (rows.length > 0 && !hasScrolledToToday.current) {
      const todayIdx = rows.findIndex((r) => r.isToday);
      if (todayIdx >= 0) {
        setTimeout(() => {
          rowVirt.scrollToIndex(todayIdx, { align: 'center' });
        }, 80);
        hasScrolledToToday.current = true;
      }
    }
  }, [rows, rowVirt]);

  const colVirt = useVirtualizer({
    horizontal: true,
    count: visibleTrainers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COL_W,
    overscan: 2,
  });

  const vRows = rowVirt.getVirtualItems();
  const vCols = colVirt.getVirtualItems();
  const bodyW = FROZEN_W + colVirt.getTotalSize();

  const setConflictStatus = (id: string, status: ConflictStatus, msg: string) => {
    setConflictOverrides((p) => ({ ...p, [id]: status }));
    toast({ variant: status === 'Resolved' ? 'success' : 'info', title: msg });
  };

  const handleOpenCellAssign = (date: string, trainerId: string) => {
    setEditingSessionId(null);
    setRepeatMode('none');
    setRepeatDaysCount(3);
    setRepeatSkipSundays(true);
    setRepeatSkipHolidays(true);
    setRepeatSkipSaturdays(false);
    const firstBatch = batches[0];
    const c = firstBatch ? courses.find((item) => item.id === firstBatch.courseId) : undefined;
    const enrolled = firstBatch ? (batchStudentCounts[firstBatch.id] ?? firstBatch.capacity ?? 0) : 0;
    const cleanCode = firstBatch ? (cleanBatchCode(firstBatch.code, firstBatch.batchNo) || firstBatch.code) : '';
    const effTrainer = trainerId || firstBatch?.trainerId || (trainers[0]?.id ?? '') || (user?.id ?? '');
    setRepeatEndDate(firstBatch?.endDate || '');

    setAssignForm({
      date,
      trainerId: effTrainer,
      name: firstBatch?.trainingName || c?.title || cleanCode || 'Training Session',
      batchCode: cleanCode || 'Batch',
      batchId: firstBatch?.id || '',
      college: firstBatch?.college || '—',
      course: c?.title || firstBatch?.trainingName || '—',
      academicYear: firstBatch?.academicYear || '2026-2027',
      coordinator: firstBatch?.coordinator || '—',
      startTime: '09:00',
      endTime: '12:00',
      venue: firstBatch?.venue || 'Campus HQ',
      mode: (firstBatch?.onlineLink ? 'Online' : 'Offline') as 'Online' | 'Offline',
      studentCount: enrolled,
      capacity: firstBatch?.capacity,
      batchStartDate: firstBatch?.startDate,
      batchEndDate: firstBatch?.endDate,
      phase: firstBatch?.phase || 'Scheduled',
    });
    setIsAssignDrawerOpen(true);
  };

  const handleEditSchedule = (s: ScheduleSession) => {
    setEditingSessionId(s.id);
    setRepeatMode('none');
    const matched = batches.find((b) => b.id === (s as any).batchId || b.code === s.batchCode || cleanBatchCode(b.code, b.batchNo) === s.batchCode);
    const c = matched ? courses.find((item) => item.id === matched.courseId) : undefined;
    const enrolled = matched ? (batchStudentCounts[matched.id] ?? s.studentCount ?? 0) : s.studentCount;

    setAssignForm({
      date: s.date,
      trainerId: s.trainerId,
      name: s.name,
      batchCode: s.batchCode,
      batchId: matched?.id || '',
      college: s.college || matched?.college || '—',
      course: s.course || c?.title || matched?.trainingName || '—',
      academicYear: s.academicYear || matched?.academicYear || '2026-2027',
      coordinator: s.coordinator || matched?.coordinator || '—',
      startTime: s.startTime,
      endTime: s.endTime,
      venue: s.venue || matched?.venue || 'Campus HQ',
      mode: s.mode || (matched?.onlineLink ? 'Online' : 'Offline'),
      studentCount: enrolled,
      capacity: matched?.capacity,
      batchStartDate: matched?.startDate,
      batchEndDate: matched?.endDate,
      phase: matched?.phase || 'Scheduled',
    });
    setIsAssignDrawerOpen(true);
  };

  const handleSaveSession = async () => {
    if (submittingSession) return;

    if (!assignForm.batchId) {
      toast({ variant: 'error', title: 'Batch Required', message: 'Please select a batch from the list.' });
      return;
    }

    const assocBatch = batches.find((b) => b.id === assignForm.batchId);
    if (!assocBatch) {
      toast({ variant: 'error', title: 'Batch Not Found', message: 'Selected batch was not found in the database.' });
      return;
    }

    const effectiveTrainerId = assignForm.trainerId || assocBatch.trainerId || trainers[0]?.id || user?.id || '';
    if (!effectiveTrainerId) {
      toast({ variant: 'error', title: 'Trainer Required', message: 'Please select an assigned trainer for the schedule.' });
      return;
    }

    // End time must be after start time
    if (assignForm.startTime && assignForm.endTime && assignForm.endTime <= assignForm.startTime) {
      toast({ variant: 'error', title: 'Invalid Time', message: 'End time must be later than the start time.' });
      return;
    }

    const cleanCode = cleanBatchCode(assocBatch.code, assocBatch.batchNo) || assocBatch.code || 'Training Batch';
    const finalBatchCode = assignForm.batchCode.trim() || cleanCode;
    const finalName = assignForm.name.trim() || assocBatch.trainingName || cleanCode;

    const isEdit = Boolean(editingSessionId && UUID_RE.test(editingSessionId));
    const datesToSchedule = isEdit ? [assignForm.date] : scheduledDates;

    if (datesToSchedule.length === 0) {
      toast({ variant: 'error', title: 'No Valid Dates', message: 'Please select at least one valid date to schedule.' });
      return;
    }

    const validTrainerId = toValidUuid(effectiveTrainerId) || (toValidUuid(user?.id) ?? null);
    const validBatchId = toValidUuid(assocBatch.id);

    if (!validBatchId || !validTrainerId) {
      toast({ variant: 'error', title: 'Invalid Assignment', message: 'Could not resolve valid IDs for batch or trainer.' });
      return;
    }

    setSubmittingSession(true);
    let createdCount = 0;
    let skippedDuplicates = 0;
    const newSessions: ScheduleSession[] = [];

    try {
      for (let idx = 0; idx < datesToSchedule.length; idx++) {
        const targetDate = datesToSchedule[idx];

        // UIUX-REQ-014: Duplicate Prevention Guard (batch_id, date, start_time)
        const isDuplicate = combinedSessions.some((s) => {
          if (isEdit && s.id === editingSessionId) return false;
          const matchDate = s.date === targetDate;
          const matchBatch = s.batchCode === finalBatchCode || (assocBatch && s.name === finalName && s.trainerId === effectiveTrainerId);
          const matchTime = s.startTime === assignForm.startTime;
          return matchDate && matchBatch && matchTime;
        });

        if (isDuplicate) {
          skippedDuplicates++;
          continue;
        }

        const sessId = isEdit && editingSessionId ? editingSessionId : crypto.randomUUID();
        const sessionObj: ScheduleSession = {
          id: sessId,
          trainerId: effectiveTrainerId,
          date: targetDate,
          name: finalName,
          batchCode: finalBatchCode,
          college: assignForm.college || assocBatch.college || '—',
          course: assignForm.course || '—',
          academicYear: assignForm.academicYear || assocBatch.academicYear || '—',
          coordinator: assignForm.coordinator || assocBatch.coordinator || '—',
          startTime: assignForm.startTime,
          endTime: assignForm.endTime,
          venue: assignForm.venue || assocBatch.venue || 'Campus HQ',
          mode: assignForm.mode || (assocBatch.onlineLink ? 'Online' : 'Offline'),
          studentCount: Number(assignForm.studentCount) || assocBatch.capacity || 0,
          status: 'Scheduled',
          color: 'var(--brand)',
        };

        const notes = datesToSchedule.length > 1 ? `Multi-day session (${idx + 1} of ${datesToSchedule.length})` : undefined;

        // Persist to Supabase flwdsk_calendar_sessions table
        const payload: Record<string, any> = {
          id: sessId,
          date: sessionObj.date,
          session_title: sessionObj.name,
          trainer_id: validTrainerId,
          batch_id: validBatchId,
          start_time: sessionObj.startTime,
          end_time: sessionObj.endTime,
          venue: sessionObj.venue,
          mode: sessionObj.mode,
          student_count: sessionObj.studentCount,
          status: sessionObj.status,
          color: sessionObj.color || 'var(--brand)',
          notes,
        };

        const res = await saveCalendarSession(payload);
        if (res.ok) {
          createdCount++;
          newSessions.push(sessionObj);
        } else {
          console.error(`Calendar session save error for ${targetDate}:`, res.error);
        }
      }
    } finally {
      setSubmittingSession(false);
    }

    await loadDbSessions();

    if (isEdit) {
      if (newSessions.length > 0) {
        setCustomSessions((prev) =>
          prev.map((sess) => (sess.id === editingSessionId ? newSessions[0] : sess))
        );
        toast({
          variant: 'success',
          title: 'Schedule Updated',
          message: `Updated schedule for ${finalBatchCode} on ${assignForm.date}`,
        });
      }
    } else {
      if (createdCount > 0) {
        setCustomSessions((prev) => [...prev, ...newSessions]);
        toast({
          variant: 'success',
          title: createdCount > 1 ? 'Repeating Schedule Assigned' : 'Schedule Assigned',
          message:
            createdCount > 1
              ? `Assigned ${createdCount} training sessions for ${finalBatchCode} to ${trainerName(effectiveTrainerId)} (${datesToSchedule[0]} to ${datesToSchedule[datesToSchedule.length - 1]})${skippedDuplicates > 0 ? ` (${skippedDuplicates} skipped as duplicates)` : ''}.`
              : `Assigned ${finalName} (${finalBatchCode}) to ${trainerName(effectiveTrainerId)} on ${datesToSchedule[0]}.`,
        });
      } else if (skippedDuplicates > 0) {
        toast({
          variant: 'error',
          title: 'Duplicate Session Detected',
          message: 'A session is already scheduled for this batch and trainer at this date and time.',
        });
        return;
      } else {
        toast({
          variant: 'error',
          title: 'Save Failed',
          message: 'Could not save session to database.',
        });
        return;
      }
    }

    setIsAssignDrawerOpen(false);
    setEditingSessionId(null);
  };

  const handleCopySession = (session: ScheduleSession) => {
    setRepeatMode('none');
    setRepeatDaysCount(3);
    const matched = batches.find((b) => b.id === (session as any).batchId || b.code === session.batchCode || cleanBatchCode(b.code, b.batchNo) === session.batchCode);
    const c = matched ? courses.find((item) => item.id === matched.courseId) : undefined;
    const enrolled = matched ? (batchStudentCounts[matched.id] ?? session.studentCount ?? 0) : session.studentCount;
    setRepeatEndDate(matched?.endDate || '');

    setAssignForm({
      date: session.date,
      trainerId: session.trainerId,
      batchId: matched?.id || '',
      batchCode: session.batchCode,
      name: session.name,
      college: session.college,
      course: session.course || c?.title || '—',
      academicYear: session.academicYear,
      coordinator: session.coordinator,
      startTime: session.startTime,
      endTime: session.endTime,
      venue: session.venue,
      mode: session.mode,
      studentCount: enrolled,
      capacity: matched?.capacity,
      batchStartDate: matched?.startDate,
      batchEndDate: matched?.endDate,
      phase: matched?.phase || 'Scheduled',
    });
    setEditingSessionId(null); // Fresh copy, new ID on save
    setIsAssignDrawerOpen(true);
    toast({ variant: 'info', title: 'Session Copied', message: 'Adjust target date or time and click Save to duplicate.' });
  };

  const handleDeleteSession = async () => {
    if (!editingSessionId || submittingSession) return;
    const deletedId = editingSessionId;
    setSubmittingSession(true);
    try {
      if (UUID_RE.test(deletedId)) {
        const res = await deleteCalendarSession(deletedId);
        if (!res.ok) {
          console.error('Supabase schedule_sessions delete error:', res.error);
          toast({
            variant: 'error',
            title: 'Delete Failed',
            message: res.error,
          });
          return;
        }
      }

      setCustomSessions((prev) => prev.filter((s) => s.id !== deletedId));
      setIsAssignDrawerOpen(false);
      setEditingSessionId(null);
      toast({ variant: 'info', title: 'Schedule Removed', message: 'Assigned schedule deleted.' });
    } finally {
      setSubmittingSession(false);
    }
  };

  const handleMoveSession = useCallback(async (sessionId: string, newDate: string, newTrainerId: string) => {
    const target = customSessions.find((s) => s.id === sessionId) || combinedSessions.find((s) => s.id === sessionId);
    if (!target) return;
    if (target.date === newDate && target.trainerId === newTrainerId) return;

    const oldDate = target.date;
    const oldTrainerId = target.trainerId;

    // Optimistically update local custom sessions state
    setCustomSessions((prev) => {
      const exists = prev.some((s) => s.id === sessionId);
      if (exists) {
        return prev.map((s) => (s.id === sessionId ? { ...s, date: newDate, trainerId: newTrainerId } : s));
      }
      return [...prev, { ...target, date: newDate, trainerId: newTrainerId }];
    });

    try {
      if (UUID_RE.test(sessionId)) {
        const validTrainerId = toValidUuid(newTrainerId) || (toValidUuid(user?.id) ?? null);
        await Promise.allSettled([
          supabase
            .from('flwdsk_schedule_sessions')
            .update({ date: newDate, trainer_id: validTrainerId })
            .eq('id', sessionId),
          supabase
            .from('flwdsk_calendar_sessions')
            .update({ date: newDate, trainer_id: validTrainerId })
            .eq('id', sessionId),
        ]);
      }

      toast({
        variant: 'success',
        title: 'Schedule Moved',
        message: `Schedule moved to ${formatDisplayDate(newDate)}${newTrainerId !== oldTrainerId ? ` (${trainerName(newTrainerId)})` : ''}.`,
      });
    } catch (err: any) {
      console.warn('Failed to move calendar session date:', err);
      setCustomSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, date: oldDate, trainerId: oldTrainerId } : s))
      );
      toast({ variant: 'error', title: 'Move Failed', message: 'Could not update session date.' });
    }
  }, [customSessions, combinedSessions, user?.id, trainerName, toast]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    toast({ variant: 'info', title: 'Filters Reset', message: 'All filters cleared.' });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.trainer !== 'all') count++;
    if (filters.college !== 'all') count++;
    if (filters.course !== 'all') count++;
    if (filters.batch !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.venue !== 'all') count++;
    if (filters.coordinator !== 'all') count++;
    if (filters.year !== 'all') count++;
    return count;
  }, [filters]);

  const selStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs, 6px)',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <AppShell>
      {/* ── STICKY HEADER TOOLBAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl, 16px)',
        padding: '14px 20px',
        marginBottom: 14,
        boxShadow: 'var(--e1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          
          {/* Title Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-grid', placeItems: 'center',
              width: 38, height: 38, borderRadius: 'var(--radius-md, 10px)',
              background: 'color-mix(in srgb, var(--brand) 12%, var(--bg-sunken))',
              color: 'var(--brand)', fontSize: 18, fontWeight: 800,
            }}>
              📅
            </span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Training Resource Planner
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Resource Allocation &amp; Matrix Scheduling
              </div>
            </div>
          </div>

          {/* Action & Date Range Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            
            {/* Date Range Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-sunken)', padding: '4px 6px', borderRadius: 'var(--radius-md, 10px)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, paddingLeft: 6, color: 'var(--text-muted)' }}>📅</span>
              <select
                aria-label="Date range preset"
                value={preset}
                onChange={(e) => applyPreset(e.target.value as PresetId)}
                style={{
                  height: 32,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  paddingRight: 6,
                }}
              >
                {Object.entries(PRESETS).map(([id, p]) => (
                  <option key={id} value={id}>{p.label}</option>
                ))}
                <option value="custom">Custom Date Range</option>
              </select>

              {preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4, borderLeft: '1px solid var(--border)' }}>
                  <input
                    type="date"
                    value={range.from}
                    style={{
                      height: 28, fontSize: 12, border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs, 6px)', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)', padding: '0 6px', outline: 'none',
                    }}
                    onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={range.to}
                    style={{
                      height: 28, fontSize: 12, border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs, 6px)', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)', padding: '0 6px', outline: 'none',
                    }}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Toggle Conflicts Panel button */}
            {conflicts.length > 0 && (
              <Button
                size="sm"
                variant={showConflictsPanel ? 'secondary' : 'danger'}
                onClick={() => setShowConflictsPanel((v) => !v)}
                style={{ height: 36, padding: '0 12px', fontSize: 12.5, fontWeight: 600 }}
              >
                ⚠️ {showConflictsPanel ? 'Hide Conflicts' : `Show Conflicts (${kpis.openConflicts})`}
              </Button>
            )}

            {/* Assign Schedule Primary Action */}
            <Button
              size="sm"
              onClick={() => handleOpenCellAssign(todayISO(), trainers[0]?.id ?? '')}
              style={{
                height: 36,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--radius-md, 10px)',
              }}
            >
              ➕ Assign Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* ── FULL FILTER BAR ── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Search session, batch, college, course, venue..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              style={{
                width: '100%',
                height: 32,
                fontSize: 12,
                padding: '0 10px',
                borderRadius: 'var(--radius-xs, 6px)',
                border: '1px solid var(--border)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* College Filter */}
          <select style={selStyle} value={filters.college} onChange={(e) => setFilters((f) => ({ ...f, college: e.target.value }))}>
            <option value="all">All Colleges</option>
            {opts.colleges.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Course Filter */}
          <select style={selStyle} value={filters.course} onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value }))}>
            <option value="all">All Courses</option>
            {opts.courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Batch Filter */}
          <select style={selStyle} value={filters.batch} onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}>
            <option value="all">All Batches</option>
            {opts.batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Trainer Filter */}
          <select style={selStyle} value={filters.trainer} onChange={(e) => setFilters((f) => ({ ...f, trainer: e.target.value }))}>
            <option value="all">All Trainers</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>

          {/* Status Filter */}
          <select style={selStyle} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Reset Filters Button */}
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={resetFilters} style={{ height: 32, fontSize: 12, color: '#dc2626' }}>
              ↺ Reset ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* Active Filter Pills Bar */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Filters:</span>
            {filters.search && (
              <FilterPill label={`Search: "${filters.search}"`} onClear={() => setFilters((f) => ({ ...f, search: '' }))} />
            )}
            {filters.college !== 'all' && (
              <FilterPill label={`College: ${filters.college}`} onClear={() => setFilters((f) => ({ ...f, college: 'all' }))} />
            )}
            {filters.course !== 'all' && (
              <FilterPill label={`Course: ${filters.course}`} onClear={() => setFilters((f) => ({ ...f, course: 'all' }))} />
            )}
            {filters.batch !== 'all' && (
              <FilterPill label={`Batch: ${filters.batch}`} onClear={() => setFilters((f) => ({ ...f, batch: 'all' }))} />
            )}
            {filters.trainer !== 'all' && (
              <FilterPill label={`Trainer: ${trainerName(filters.trainer)}`} onClear={() => setFilters((f) => ({ ...f, trainer: 'all' }))} />
            )}
          </div>
        )}
      </div>

      {/* ── CONFLICTS PANEL ── */}
      {showConflictsPanel && conflicts.length > 0 && (
        <section style={{ border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg, 12px)', background: '#fff1f2', padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>⚠️ Schedule Overlap Conflicts</span>
            <span style={{ fontSize: 12, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 8px', fontWeight: 800 }}>{shownConflicts.length}</span>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowConflictsPanel(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#9f1239',
                  padding: '4px 10px',
                }}
              >
                ✕ Close Panel
              </button>
            </div>
          </div>

          {shownConflicts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No conflicts match current filters.</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {shownConflicts.slice(0, 40).map((c) => (
                <ConflictCard
                  key={c.id}
                  c={c}
                  onDetails={() => setDetailConflict(c)}
                  onResolve={() => setConflictStatus(c.id, 'Resolved', 'Conflict resolved')}
                  onReassign={() => setConflictStatus(c.id, 'Resolved', 'Trainer reassigned')}
                  onIgnore={() => setConflictStatus(c.id, 'Ignored', 'Conflict ignored')}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── RESOURCE MATRIX ── */}
      <div
        ref={scrollRef}
        className="kvj-matrix"
        style={{
          position: 'relative', overflow: 'auto',
          height: showConflictsPanel && conflicts.length > 0 ? 'calc(100vh - 340px)' : 'calc(100vh - 250px)',
          minHeight: 480,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--e1)',
        }}
      >
        {/* Sticky Matrix Top Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 16, display: 'flex', width: bodyW, height: 38, background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
          <HeadCell w={FROZEN.date} left={0}>Date</HeadCell>
          <HeadCell w={FROZEN.day} left={FROZEN.date}>Day</HeadCell>
          <HeadCell w={FROZEN.holiday} left={FROZEN.date + FROZEN.day}>Holiday</HeadCell>
          <div style={{ position: 'relative', width: colVirt.getTotalSize(), height: '100%' }}>
            {vCols.map((vc) => {
              const t = visibleTrainers[vc.index];
              const fullName = `${t.firstName} ${t.lastName}`;
              return (
                <div
                  key={t.id}
                  title={fullName}
                  style={{
                    position: 'absolute',
                    left: vc.start,
                    width: vc.size,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    borderRight: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    background: 'var(--bg-sunken)',
                    color: 'var(--text-primary)',
                    padding: '0 8px',
                    boxSizing: 'border-box',
                  }}
                >
                  <Avatar name={fullName} size={20} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtualized Body */}
        <div style={{ height: rowVirt.getTotalSize(), width: bodyW, position: 'relative' }}>
          {vRows.map((vr) => {
            const r = rows[vr.index];
            const tint = r.holiday ? 'var(--bg-holiday-solid)' : r.isToday ? 'var(--bg-today-solid)' : 'transparent';
            const isOpen = !!expanded[r.date];
            return (
              <div
                key={r.date}
                data-index={vr.index}
                ref={rowVirt.measureElement}
                style={{
                  position: 'absolute', top: 0, left: 0, transform: `translateY(${vr.start}px)`,
                  width: bodyW, display: 'flex', background: tint,
                  borderBottom: r.isToday ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border)',
                  height: vr.size,
                  boxSizing: 'border-box',
                }}
              >
                <FrozenCell w={FROZEN.date} left={0} bg={tint}>
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [r.date]: !p[r.date] }))}
                    aria-label={isOpen ? 'Collapse day' : 'Expand day'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginRight: 4 }}
                  >{isOpen ? '▾' : '▸'}</button>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: r.isToday ? 800 : 500, color: r.isToday ? 'var(--text-today)' : 'inherit' }}>
                    {r.date}
                    {r.isToday && (
                      <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, background: 'var(--brand)', color: 'var(--brand-contrast, #ffffff)', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>
                        TODAY
                      </span>
                    )}
                  </span>
                </FrozenCell>
                <FrozenCell w={FROZEN.day} left={FROZEN.date} bg={tint}>{r.dayName}</FrozenCell>
                <FrozenCell w={FROZEN.holiday} left={FROZEN.date + FROZEN.day} bg={tint}>
                  {r.holiday
                    ? <span style={{ fontSize: 12, color: 'var(--text-holiday)', fontWeight: 700 }}>{r.holiday.name}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                </FrozenCell>

                <div style={{ position: 'relative', width: colVirt.getTotalSize(), height: '100%' }}>
                  {vCols.map((vc) => {
                    const t = visibleTrainers[vc.index];
                    const key = `${r.date}|${t.id}`;
                    return (
                      <MatrixCell
                        key={t.id}
                        left={vc.start}
                        width={vc.size}
                        date={r.date}
                        trainerId={t.id}
                        sessions={index.sessions.get(key) ?? []}
                        leave={index.leaves.get(key)}
                        expanded={isOpen}
                        onOpen={handleEditSchedule}
                        onAssignCell={handleOpenCellAssign}
                        onMoveSession={handleMoveSession}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSIGN / EDIT SCHEDULE DRAWER */}
      <Drawer
        open={isAssignDrawerOpen}
        onClose={() => setIsAssignDrawerOpen(false)}
        title={editingSessionId ? '✏️ Edit Assigned Training Schedule' : '➕ Assign Training Schedule Session'}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {editingSessionId ? (
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={submittingSession}
                style={{ color: '#dc2626', background: 'none', border: 'none', cursor: submittingSession ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: submittingSession ? 0.5 : 1 }}
              >
                🗑️ Remove Schedule
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setIsAssignDrawerOpen(false)} disabled={submittingSession}>Cancel</Button>
              <Button onClick={handleSaveSession} loading={submittingSession}>
                {editingSessionId
                  ? '💾 Update Schedule'
                  : scheduledDates.length > 1
                    ? `💾 Assign ${scheduledDates.length} Sessions`
                    : '💾 Save Schedule Allocation'}
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Schedule Date</label>
              <input
                type="date"
                value={assignForm.date}
                onChange={(e) => setAssignForm((f) => ({ ...f, date: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Assign Trainer</label>
              <select
                value={assignForm.trainerId}
                onChange={(e) => setAssignForm((f) => ({ ...f, trainerId: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              >
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Repeating / Multi-Day Training Scheduler */}
          {!editingSessionId && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 14px',
                background: repeatMode !== 'none' ? '#f0f9ff' : 'var(--bg-sunken, #f8fafc)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔁 Repeat Training Schedule</span>
                  {repeatMode !== 'none' && (
                    <span style={{ fontSize: 11, background: '#0284c7', color: '#fff', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>
                      {scheduledDates.length} Sessions
                    </span>
                  )}
                </label>
                <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => setRepeatMode('none')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: repeatMode === 'none' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                      color: repeatMode === 'none' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatMode('consecutive')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: repeatMode === 'consecutive' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                      color: repeatMode === 'consecutive' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    Consecutive Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatMode('range')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: repeatMode === 'range' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                      color: repeatMode === 'range' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {repeatMode === 'consecutive' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Repeat For:</span>
                    {[2, 3, 4, 5, 6, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRepeatDaysCount(num)}
                        style={{
                          padding: '3px 10px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: repeatDaysCount === num ? 'var(--brand-primary, #3b82f6)' : 'var(--bg-surface)',
                          color: repeatDaysCount === num ? '#fff' : 'var(--text-primary)',
                        }}
                      >
                        {num} Days
                      </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={repeatDaysCount}
                        onChange={(e) => setRepeatDaysCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ width: 55, padding: '3px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>days</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipSundays}
                        onChange={(e) => setRepeatSkipSundays(e.target.checked)}
                      />
                      Skip Sundays
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipHolidays}
                        onChange={(e) => setRepeatSkipHolidays(e.target.checked)}
                      />
                      Skip Holidays
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipSaturdays}
                        onChange={(e) => setRepeatSkipSaturdays(e.target.checked)}
                      />
                      Skip Saturdays
                    </label>
                  </div>
                </div>
              )}

              {repeatMode === 'range' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={assignForm.date}
                        disabled
                        style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-muted, #f1f5f9)', color: 'var(--text-muted)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        End Date (Repeat Until)
                      </label>
                      <input
                        type="date"
                        min={assignForm.date}
                        value={repeatEndDate || assignForm.date}
                        onChange={(e) => setRepeatEndDate(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipSundays}
                        onChange={(e) => setRepeatSkipSundays(e.target.checked)}
                      />
                      Skip Sundays
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipHolidays}
                        onChange={(e) => setRepeatSkipHolidays(e.target.checked)}
                      />
                      Skip Holidays
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={repeatSkipSaturdays}
                        onChange={(e) => setRepeatSkipSaturdays(e.target.checked)}
                      />
                      Skip Saturdays
                    </label>
                  </div>
                </div>
              )}

              {repeatMode !== 'none' && scheduledDates.length > 0 && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid #bae6fd',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>
                    📅 {scheduledDates.length} Training Sessions will be scheduled:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 85, overflowY: 'auto' }}>
                    {scheduledDates.map((d) => (
                      <span
                        key={d}
                        style={{
                          fontSize: 11,
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                          border: '1px solid #7dd3fc',
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Select Training Batch</label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {batchFilterText.trim()
                  ? `${filteredScheduleBatches.length} of ${batches.length} batches`
                  : `${batches.length} batches available`}
              </span>
            </div>
            <input
              type="text"
              placeholder="🔍 Search batch by name, college, course..."
              value={batchFilterText}
              onChange={(e) => setBatchFilterText(e.target.value)}
              className="kvj-input"
              style={{ width: '100%', marginBottom: 8, fontSize: 12, padding: '7px 10px' }}
            />
            <select
              value={assignForm.batchId}
              onChange={(e) => applyBatchToForm(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            >
              <option value="">-- Choose a Training Batch --</option>
              {filteredScheduleBatches.map((b) => {
                const crs = courses.find((c) => c.id === b.courseId);
                const label = `${cleanBatchCode(b.code, b.batchNo) || b.code} · ${b.trainingName || crs?.title || 'Training'} (${b.college || 'Campus'})`;
                return (
                  <option key={b.id} value={b.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Auto-filled detailed batch summary card */}
          {assignForm.batchId && (
            <div style={{
              background: 'var(--bg-sunken, #f8fafc)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary, #1e40af)' }}>
                  🎓 {assignForm.batchCode}
                </span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'var(--brand-subtle, #e0e7ff)',
                  color: 'var(--brand-primary, #3730a3)',
                  fontWeight: 600
                }}>
                  {assignForm.phase || 'Scheduled'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Course / Topic:</span>{' '}
                  <strong>{assignForm.course}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>College:</span>{' '}
                  <strong>{assignForm.college}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Academic Year:</span>{' '}
                  <strong>{assignForm.academicYear}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Enrolled Students:</span>{' '}
                  <strong>{assignForm.studentCount} {assignForm.capacity ? `(${assignForm.capacity} Capacity)` : ''}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Coordinator:</span>{' '}
                  <strong>{assignForm.coordinator}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Default Venue:</span>{' '}
                  <strong>{assignForm.venue} ({assignForm.mode})</strong>
                </div>
                {assignForm.batchStartDate && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Batch Duration:</span>{' '}
                    <strong>{assignForm.batchStartDate} to {assignForm.batchEndDate || '—'}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Session Topic / Title</label>
            <input
              type="text"
              value={assignForm.name}
              onChange={(e) => setAssignForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Power BI DAX & Data Models"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Start Time</label>
              <input
                type="time"
                value={assignForm.startTime}
                onChange={(e) => setAssignForm((f) => ({ ...f, startTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>End Time</label>
              <input
                type="time"
                value={assignForm.endTime}
                onChange={(e) => setAssignForm((f) => ({ ...f, endTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Venue / Room</label>
              <input
                type="text"
                value={assignForm.venue}
                onChange={(e) => setAssignForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. Lab 2 / Campus HQ"
                style={{ width: '100%', padding: '8px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Delivery Mode</label>
              <select
                value={assignForm.mode}
                onChange={(e) => setAssignForm((f) => ({ ...f, mode: e.target.value as any }))}
                style={{ width: '100%', padding: '9px 12px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              >
                <option value="Offline">Offline (In-Person)</option>
                <option value="Online">Online (Virtual)</option>
              </select>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Conflict detail Drawer */}
      <Drawer open={!!detailConflict} onClose={() => setDetailConflict(null)} title="Conflict Details">
        {detailConflict && (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row k="Type" v={`${CONFLICT_META[detailConflict.type].icon} ${detailConflict.type}`} />
            <Row k="Severity" v={detailConflict.severity} />
            <Row k="Trainer" v={detailConflict.trainerName} />
            <Row k="Date" v={detailConflict.date} />
            <Row k="Time" v={detailConflict.time} />
            <Row k="Batches" v={detailConflict.batches.join(', ')} />
            <Row k="Status" v={detailConflict.status} />
            <p style={{ color: 'var(--text-secondary)' }}>{detailConflict.detail}</p>
          </div>
        )}
      </Drawer>

      {/* Session detail Drawer */}
      <Drawer open={!!detailSession} onClose={() => setDetailSession(null)} title="Session Details">
        {detailSession && (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row k="Session" v={detailSession.name} />
            <Row k="Batch" v={detailSession.batchCode} />
            <Row k="College" v={detailSession.college} />
            <Row k="Course" v={detailSession.course} />
            <Row k="Coordinator" v={detailSession.coordinator} />
            <Row k="Trainer" v={trainerName(detailSession.trainerId)} />
            <Row k="Date" v={detailSession.date} />
            <Row k="Time" v={`${detailSession.startTime} – ${detailSession.endTime}`} />
            <Row k="Venue" v={`${detailSession.venue} (${detailSession.mode})`} />
            <Row k="Students" v={String(detailSession.studentCount)} />
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}

// ── PRESENTATIONAL COMPONENTS ──

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

function Kpi({ label, value, tone, hint, onClick }: { label: string; value: string; tone: string; hint?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${tone}`,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-surface)',
        padding: 12,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'var(--e1)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: tone, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '2px 8px',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-primary)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    }}>
      {label}
      <button type="button" onClick={onClear} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: 0, color: 'var(--text-muted)' }}>✕</button>
    </span>
  );
}

function HeadCell({ w, left, children }: { w: number; left: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 25,
      background: 'var(--bg-sunken)', borderRight: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 10px',
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--text-secondary)', boxSizing: 'border-box',
    }}>{children}</div>
  );
}

function FrozenCell({ w, left, bg, children }: { w: number; left: number; bg: string; children: React.ReactNode }) {
  const solidBg = bg === 'var(--bg-holiday-solid)'
    ? 'var(--bg-holiday-solid)'
    : bg === 'var(--bg-today-solid)'
      ? 'var(--bg-today-solid)'
      : 'var(--bg-surface)';

  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 15,
      background: solidBg,
      backgroundColor: solidBg,
      borderRight: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>{children}</div>
  );
}

const ConflictCard = memo(function ConflictCard({ c, onDetails, onResolve, onReassign, onIgnore }: {
  c: ScheduleConflict; onDetails: () => void; onResolve: () => void; onReassign: () => void; onIgnore: () => void;
}) {
  const meta = CONFLICT_META[c.type];
  return (
    <div style={{
      minWidth: 300, flex: '0 0 auto', border: '1px solid var(--border)',
      borderLeft: `4px solid ${c.severity === 'High' ? '#dc2626' : c.severity === 'Medium' ? '#d97706' : '#2563eb'}`,
      borderRadius: 'var(--radius-sm, 6px)', padding: 10, background: '#ffffff',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{meta.icon} {c.type}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
        {c.trainerName} · {c.date}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.time}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Batches: {c.batches.join(', ')}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Severity <strong>{c.severity}</strong> · Status <strong>{c.status}</strong>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        <MiniBtn onClick={onDetails}>View Details</MiniBtn>
        <MiniBtn onClick={onResolve}>Resolve</MiniBtn>
        <MiniBtn onClick={onReassign}>Reassign</MiniBtn>
        <MiniBtn onClick={onIgnore}>Ignore</MiniBtn>
      </div>
    </div>
  );
});

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      fontSize: 12, padding: '3px 7px', borderRadius: 'var(--radius-xs, 4px)',
      border: '1px solid var(--border)', background: 'var(--bg-sunken)',
      color: 'var(--text-secondary)', cursor: 'pointer',
    }}>{children}</button>
  );
}

/** One trainer/day cell with strict overflow clipping and drag & drop date move support */
const MatrixCell = memo(function MatrixCell({ left, width, date, trainerId, sessions, leave, expanded, onOpen, onAssignCell, onMoveSession }: {
  left: number; width: number; date: string; trainerId: string;
  sessions: ScheduleSession[];
  leave?: { duration: string; type: string; status: string };
  expanded: boolean;
  onOpen: (s: ScheduleSession) => void;
  onAssignCell: (date: string, trainerId: string) => void;
  onMoveSession: (sessionId: string, newDate: string, newTrainerId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onClick={(e) => {
        // Prevent opening assign if clicking directly on a session button
        if ((e.target as HTMLElement).closest('button')) return;
        if (!leave) onAssignCell(date, trainerId);
      }}
      onDragOver={(e) => {
        if (leave) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        if (leave) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (!raw) return;
          const data = JSON.parse(raw);
          if (data && data.sessionId) {
            onMoveSession(data.sessionId, date, trainerId);
          }
        } catch (err) {
          console.warn('Drop error:', err);
        }
      }}
      style={{
        position: 'absolute', left, width, top: 0, height: '100%',
        borderRight: '1px solid var(--border)', padding: 6,
        display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box',
        cursor: !leave ? 'pointer' : 'default',
        overflow: 'hidden',
        background: isDragOver ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {leave && (
        <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🟧 {leave.duration} {leave.type} ({leave.status})
        </div>
      )}
      {sessions.map((s) => {
        let rawCode = s.batchCode || s.name || s.course || '';
        let batchDisplay = (s.batchCode && s.batchCode !== 'Training Batch' && s.batchCode !== 'Training Session')
          ? s.batchCode
          : cleanBatchCode(rawCode);

        if (!batchDisplay || batchDisplay === 'Training Batch' || batchDisplay === 'Custom') {
          batchDisplay = s.name && s.name !== 'Training Batch' && s.name !== 'Custom'
            ? s.name
            : (s.course && s.course !== '—' ? s.course : 'Training Session');
        }

        const timeDisplay = `${s.startTime}–${s.endTime}`;
        return (
          <button
            key={s.id}
            type="button"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('text/plain', JSON.stringify({ sessionId: s.id, fromDate: s.date, fromTrainerId: s.trainerId }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            title={`Drag to move date or reassign trainer · ${batchDisplay} (${timeDisplay})`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(s);
            }}
            style={{
              textAlign: 'left',
              borderLeft: `4px solid ${s.color || 'var(--brand)'}`,
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'grab',
              fontSize: 12,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              width: '100%',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--brand-primary, #1e40af)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              🎓 {batchDisplay}
            </div>
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              ⏰ {timeDisplay} {s.name && cleanBatchCode(s.name) !== batchDisplay ? `· ${cleanBatchCode(s.name)}` : ''}
            </div>
            {expanded && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                📍 {s.venue} · {s.mode} {s.studentCount ? `· 👥 ${s.studentCount}` : ''}<br />🏛️ {s.college} · 👤 {s.coordinator}
              </div>
            )}
          </button>
        );
      })}
      {!leave && sessions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', opacity: 0.6 }}>
          Office
        </div>
      )}
    </div>
  );
});

export default TrainingCalendar;
