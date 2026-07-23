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
import { Button } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { todayISO } from '../../../shared/utils/date';
import {
  fetchScheduleRange, detectConflicts, eachDate, presetRange, PRESETS, CONFLICT_META,
  type ScheduleRangeResult, type ScheduleSession, type ScheduleConflict,
  type ConflictStatus, type PresetId,
} from '../schedule.data';

const EMPTY: ScheduleRangeResult = { sessions: [], leaves: [], holidays: [], daysLoaded: 0 };

const BATCH_PRESETS = [
  { batchCode: 'MIM-B1-2026', name: 'MIM Power BI & DAX', college: 'MIM Kuttikkanam', course: 'Data Analytics', coordinator: 'Prof. Thomas Kurian', venue: 'Lab 402', mode: 'Offline' as const, studentCount: 45 },
  { batchCode: 'CHRIST-B1-2026', name: 'Christ Data Analytics', college: 'Christ Irinjalakkuda', course: 'Data Analytics', coordinator: 'Dr. Meera Nair', venue: 'Lab 101', mode: 'Online' as const, studentCount: 43 },
  { batchCode: 'RAJAGI-B4-2026', name: 'Rajagiri Advanced Excel', college: 'Rajagiri College', course: 'Advanced Excel 365', coordinator: 'Prof. Vinod Menon', venue: 'Room 205', mode: 'Offline' as const, studentCount: 67 },
  { batchCode: 'SANTHI-B1-2026', name: 'Santhigiri Excel Expert', college: 'Santhigiri College', course: 'Excel 365', coordinator: 'Dr. Susan John', venue: 'Seminar Hall 1', mode: 'Offline' as const, studentCount: 50 },
  { batchCode: 'NEHRU-B3-2026', name: 'Nehru PL-900 Power Platform', college: 'Nehru College', course: 'Power Platform PL-900', coordinator: 'Prof. Anoop Kumar', venue: 'Lab 3', mode: 'Offline' as const, studentCount: 38 },
  { batchCode: 'VIMALA-B4-2026', name: 'Vimala Tally & GST', college: 'Vimala College', course: 'Tally & GST Compliance', coordinator: 'Dr. Radhika V', venue: 'Commerce Lab', mode: 'Offline' as const, studentCount: 42 },
];

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

export function TrainingCalendar() {
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);

  // ── Date range (default: current month) ──
  const [preset, setPreset] = useState<PresetId>('current_month');
  const [range, setRange] = useState(() => presetRange('current_month'));

  const [data, setData] = useState<ScheduleRangeResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  // Additional user-created sessions in state
  const [customSessions, setCustomSessions] = useState<ScheduleSession[]>([]);

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
    college: string;
    course: string;
    academicYear: string;
    coordinator: string;
    startTime: string;
    endTime: string;
    venue: string;
    mode: 'Offline' | 'Online';
    studentCount: number;
  }>({
    date: todayISO(),
    trainerId: '',
    name: 'Power BI & DAX Session',
    batchCode: 'MIM-B1-2026',
    college: 'MIM Kuttikkanam',
    course: 'Data Analytics',
    academicYear: '2025-2026',
    coordinator: 'Prof. Thomas Kurian',
    startTime: '09:00',
    endTime: '12:00',
    venue: 'Lab 402',
    mode: 'Offline',
    studentCount: 20,
  });

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((r) => {
      if (r.ok) setTrainers(r.value);
    });
  }, []);

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
    setAssignForm((prev) => ({
      ...prev,
      date,
      trainerId: trainerId || (trainers[0]?.id ?? ''),
    }));
    setIsAssignDrawerOpen(true);
  };

  const handleEditSchedule = (s: ScheduleSession) => {
    setEditingSessionId(s.id);
    setAssignForm({
      date: s.date,
      trainerId: s.trainerId,
      name: s.name,
      batchCode: s.batchCode,
      college: s.college,
      course: s.course,
      academicYear: s.academicYear,
      coordinator: s.coordinator,
      startTime: s.startTime,
      endTime: s.endTime,
      venue: s.venue,
      mode: s.mode,
      studentCount: s.studentCount,
    });
    setIsAssignDrawerOpen(true);
  };

  const handleSaveSession = () => {
    if (!assignForm.trainerId) {
      toast({ variant: 'error', title: 'Trainer Required', message: 'Please select a trainer for the schedule.' });
      return;
    }

    if (editingSessionId) {
      const updatedSession: ScheduleSession = {
        id: editingSessionId,
        trainerId: assignForm.trainerId,
        date: assignForm.date,
        name: assignForm.name,
        batchCode: assignForm.batchCode,
        college: assignForm.college,
        course: assignForm.course,
        academicYear: assignForm.academicYear,
        coordinator: assignForm.coordinator,
        startTime: assignForm.startTime,
        endTime: assignForm.endTime,
        venue: assignForm.venue,
        mode: assignForm.mode,
        studentCount: Number(assignForm.studentCount) || 20,
        status: 'Scheduled',
        color: '#3b82f6',
      };

      setCustomSessions((prev) =>
        prev.map((sess) => (sess.id === editingSessionId ? updatedSession : sess))
      );
      toast({
        variant: 'success',
        title: 'Schedule Updated',
        message: `Updated schedule for ${updatedSession.batchCode} on ${updatedSession.date}`,
      });
    } else {
      const newSession: ScheduleSession = {
        id: `custom-sess-${Date.now()}`,
        trainerId: assignForm.trainerId,
        date: assignForm.date,
        name: assignForm.name,
        batchCode: assignForm.batchCode,
        college: assignForm.college,
        course: assignForm.course,
        academicYear: assignForm.academicYear,
        coordinator: assignForm.coordinator,
        startTime: assignForm.startTime,
        endTime: assignForm.endTime,
        venue: assignForm.venue,
        mode: assignForm.mode,
        studentCount: Number(assignForm.studentCount) || 20,
        status: 'Scheduled',
        color: '#3b82f6',
      };

      setCustomSessions((prev) => [...prev, newSession]);
      toast({
        variant: 'success',
        title: 'Schedule Assigned',
        message: `Assigned ${newSession.name} (${newSession.batchCode}) to ${trainerName(newSession.trainerId)} on ${newSession.date}`,
      });
    }

    setIsAssignDrawerOpen(false);
    setEditingSessionId(null);
  };

  const handleDeleteSession = () => {
    if (!editingSessionId) return;
    setCustomSessions((prev) => prev.filter((s) => s.id !== editingSessionId));
    setIsAssignDrawerOpen(false);
    setEditingSessionId(null);
    toast({ variant: 'info', title: 'Schedule Removed', message: 'Assigned schedule deleted.' });
  };

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
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
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
            <Button size="sm" variant="ghost" onClick={resetFilters} style={{ height: 32, fontSize: 11.5, color: '#dc2626' }}>
              ↺ Reset ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* Active Filter Pills Bar */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
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
            <span style={{ fontSize: 11, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 8px', fontWeight: 800 }}>{shownConflicts.length}</span>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowConflictsPanel(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11.5,
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
              return (
                <div key={t.id} style={{
                  position: 'absolute', left: vc.start, width: vc.size, height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 700, borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap', overflow: 'hidden', background: 'var(--bg-sunken)',
                }}>
                  👤 {t.firstName} {t.lastName}
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtualized Body */}
        <div style={{ height: rowVirt.getTotalSize(), width: bodyW, position: 'relative' }}>
          {vRows.map((vr) => {
            const r = rows[vr.index];
            const tint = r.holiday ? '#fff1f2' : r.isToday ? '#eff6ff' : 'transparent';
            const isOpen = !!expanded[r.date];
            return (
              <div
                key={r.date}
                data-index={vr.index}
                ref={rowVirt.measureElement}
                style={{
                  position: 'absolute', top: 0, left: 0, transform: `translateY(${vr.start}px)`,
                  width: bodyW, display: 'flex', background: tint,
                  borderBottom: '1px solid var(--border)', height: vr.size,
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
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: r.isToday ? 800 : 500, color: r.isToday ? '#2563eb' : 'inherit' }}>{r.date}</span>
                </FrozenCell>
                <FrozenCell w={FROZEN.day} left={FROZEN.date} bg={tint}>{r.dayName}</FrozenCell>
                <FrozenCell w={FROZEN.holiday} left={FROZEN.date + FROZEN.day} bg={tint}>
                  {r.holiday
                    ? <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>{r.holiday.name}</span>
                    : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
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
                style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                🗑️ Remove Schedule
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setIsAssignDrawerOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSession}>{editingSessionId ? '💾 Update Schedule' : '💾 Save Schedule Allocation'}</Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Select Batch Name</label>
              <select
                value={assignForm.batchCode}
                onChange={(e) => {
                  const bCode = e.target.value;
                  const preset = BATCH_PRESETS.find((b) => b.batchCode === bCode);
                  if (preset) {
                    setAssignForm((f) => ({
                      ...f,
                      batchCode: preset.batchCode,
                      name: preset.name,
                      college: preset.college,
                      course: preset.course,
                      coordinator: preset.coordinator,
                      venue: preset.venue,
                      mode: preset.mode,
                      studentCount: preset.studentCount,
                    }));
                  } else {
                    setAssignForm((f) => ({ ...f, batchCode: bCode }));
                  }
                }}
                style={{ width: '100%', padding: '9px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              >
                {BATCH_PRESETS.map((b) => (
                  <option key={b.batchCode} value={b.batchCode}>
                    {b.batchCode} — {b.name} ({b.college})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-filled batch summary badge */}
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🎓 {assignForm.college} · {assignForm.course}</div>
            <div>Coordinator: <strong>{assignForm.coordinator}</strong> · Students: <strong>{assignForm.studentCount}</strong></div>
            <div>Default Venue: <strong>{assignForm.venue} ({assignForm.mode})</strong></div>
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
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: tone, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
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
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--text-primary)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    }}>
      {label}
      <button type="button" onClick={onClear} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, padding: 0, color: 'var(--text-muted)' }}>✕</button>
    </span>
  );
}

function HeadCell({ w, left, children }: { w: number; left: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 16,
      background: 'var(--bg-sunken)', borderRight: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 10px',
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--text-secondary)', boxSizing: 'border-box',
    }}>{children}</div>
  );
}

function FrozenCell({ w, left, bg, children }: { w: number; left: number; bg: string; children: React.ReactNode }) {
  const solidBg = bg && bg !== 'transparent' ? bg : 'var(--bg-surface)';

  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 10,
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
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
        {c.trainerName} · {c.date}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.time}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Batches: {c.batches.join(', ')}</div>
      <div style={{ fontSize: 10.5, marginTop: 4 }}>
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
      fontSize: 10.5, padding: '3px 7px', borderRadius: 'var(--radius-xs, 4px)',
      border: '1px solid var(--border)', background: 'var(--bg-sunken)',
      color: 'var(--text-secondary)', cursor: 'pointer',
    }}>{children}</button>
  );
}

/** One trainer/day cell with strict overflow clipping */
const MatrixCell = memo(function MatrixCell({ left, width, date, trainerId, sessions, leave, expanded, onOpen, onAssignCell }: {
  left: number; width: number; date: string; trainerId: string;
  sessions: ScheduleSession[];
  leave?: { duration: string; type: string; status: string };
  expanded: boolean;
  onOpen: (s: ScheduleSession) => void;
  onAssignCell: (date: string, trainerId: string) => void;
}) {
  return (
    <div
      onClick={(e) => {
        // Prevent opening assign if clicking directly on a session button
        if ((e.target as HTMLElement).closest('button')) return;
        if (!leave) onAssignCell(date, trainerId);
      }}
      style={{
        position: 'absolute', left, width, top: 0, height: '100%',
        borderRight: '1px solid var(--border)', padding: 6,
        display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box',
        cursor: !leave ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {leave && (
        <div style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🟧 {leave.duration} {leave.type} ({leave.status})
        </div>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(s);
          }}
          style={{
            textAlign: 'left',
            borderLeft: `3.5px solid ${s.color}`,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 7px',
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            width: '100%',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.startTime}–{s.endTime} · {s.batchCode}</div>
          {expanded && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📍 {s.venue} · {s.mode} · 👥 {s.studentCount}<br />🎓 {s.college} · {s.coordinator}
            </div>
          )}
        </button>
      ))}
      {!leave && sessions.length === 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', opacity: 0.6 }}>
          Office
        </div>
      )}
    </div>
  );
});

export default TrainingCalendar;
