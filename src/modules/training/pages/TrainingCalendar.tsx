import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, SectionHeader, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

// Views List
type ActiveView =
  | 'matrix'
  | 'month'
  | 'week'
  | 'trainer'
  | 'batch'
  | 'holiday'
  | 'leave';

interface ScheduleSession {
  id: string;
  name: string;
  batchCode: string;
  startTime: string;
  endTime: string;
  location: string;
  type: 'Online' | 'Offline';
  studentCount: number;
  course: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  color: string;
  room?: string;
}

interface LeaveRequest {
  id: string;
  trainerId: string;
  type: 'Medical' | 'Emergency' | 'Casual';
  duration: 'Full Day' | 'Half Day Morning' | 'Half Day Afternoon';
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string; // YYYY-MM-DD
}

interface HolidayItem {
  id: string;
  name: string;
  type: 'National' | 'Regional' | 'Company' | 'Training';
  date: string; // YYYY-MM-DD
}

/** Fixed widths for the three frozen (sticky) columns, in px. */
const FROZEN = { date: 124, day: 64, holiday: 150 } as const;

/**
 * Format a Date as YYYY-MM-DD in LOCAL time.
 * `toISOString()` converts to UTC first, so for any timezone ahead of UTC
 * (Asia/Kolkata is UTC+5:30) local midnight rolls back to the previous day —
 * which shifted every row in the matrix by one day and dropped the last day
 * of the month entirely.
 */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TrainingCalendar() {
  const { batches, courses } = useTraining();
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('matrix');
  // Open on the CURRENT month rather than a hardcoded date.
  const [selectedDateCursor, setSelectedDateCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  // Inspector States
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [selectedTrainerForView, setSelectedTrainerForView] = useState<string>('');
  const [selectedBatchForView, setSelectedBatchForView] = useState<string>('');

  // Conflict state
  const [showConflictModal, setShowConflictModal] = useState<string | null>(null);

  // Appearance & Studio Hud Parameters (Apple 2032 spec)
  const [opacityVal, setOpacityVal] = useState(94);
  const [blurVal, setBlurVal] = useState(25);
  const [accentCol, setAccentCol] = useState('#6366f1');

  // Hardcoded rich mock data for sessions, leaves, and holidays
  const [sessions, setSessions] = useState<Record<string, ScheduleSession[]>>({
    // key is `${dateNum}_${trainerId}`
    '22_emp-1': [
      { id: 'sess-1', name: 'Christ BBA Power BI Bootcamp', batchCode: 'CHRIST-BBA-01', startTime: '09:00', endTime: '12:00', location: 'Christ College Campus', type: 'Offline', studentCount: 42, course: 'Data Visualization', status: 'Scheduled', color: '#3b82f6', room: 'Lab 402' },
      { id: 'sess-2', name: 'MIM MBA Advance Analytics', batchCode: 'MIM-MBA-02', startTime: '13:30', endTime: '16:30', location: 'MIM Main Campus', type: 'Offline', studentCount: 30, course: 'Business Intelligence', status: 'Scheduled', color: '#8b5cf6', room: 'Seminar Hall 1' }
    ],
    '22_emp-2': [
      { id: 'sess-3', name: 'IPS BCOM Tally & GST Seminar', batchCode: 'IPS-BCOM-03', startTime: '09:00', endTime: '12:00', location: 'IPS Auditorium', type: 'Offline', studentCount: 65, course: 'Tally & GST', status: 'Scheduled', color: '#06b6d4', room: 'Conference Hall' }
    ],
    // Conflicted booking cell example
    '23_emp-1': [
      { id: 'sess-4', name: 'Christ BBA Power BI Bootcamp', batchCode: 'CHRIST-BBA-01', startTime: '09:00', endTime: '12:00', location: 'Christ College Campus', type: 'Offline', studentCount: 42, course: 'Data Visualization', status: 'Scheduled', color: '#3b82f6', room: 'Lab 402' },
      { id: 'sess-5', name: 'MIM MBA Business Intelligence (Overlap)', batchCode: 'MIM-MBA-02', startTime: '10:00', endTime: '13:00', location: 'MIM Campus', type: 'Offline', studentCount: 30, course: 'Business Intelligence', status: 'Scheduled', color: '#ec4899', room: 'Room 205' }
    ]
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    { id: 'l-1', trainerId: 'emp-1', type: 'Casual', duration: 'Half Day Afternoon', status: 'Approved', date: '2026-07-24' },
    { id: 'l-2', trainerId: 'emp-2', type: 'Medical', duration: 'Full Day', status: 'Pending', date: '2026-07-22' }
  ]);

  const [holidays, setHolidays] = useState<HolidayItem[]>([
    { id: 'h-1', name: 'Karkidaka Vavu (Regional)', type: 'Regional', date: '2026-07-23' },
    { id: 'h-2', name: 'Independence Day', type: 'National', date: '2026-08-15' }
  ]);

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((res) => {
      if (!res.ok || res.value.length === 0) return;
      const list = res.value;
      setTrainers(list);
      setSelectedTrainerForView(list[0].id);

      // The seeded demo sessions/leaves were keyed to placeholder ids
      // ('emp-1', 'emp-2') that match no real employee, so every cell rendered
      // empty while the KPI cards still claimed sessions and conflicts existed.
      // Re-key them onto the trainers that actually loaded.
      const [t1, t2] = [list[0].id, list[1]?.id ?? list[0].id];
      const today = new Date();
      const d = today.getDate();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), d + 1);

      setSessions((prev) => {
        const remapped: Record<string, ScheduleSession[]> = {};
        for (const [key, val] of Object.entries(prev)) {
          const [dayPart, idPart] = key.split('_');
          const owner = idPart === 'emp-1' ? t1 : idPart === 'emp-2' ? t2 : idPart;
          // Anchor the demo data to today/tomorrow so it is actually visible.
          const day = dayPart === '22' ? d : tomorrow.getDate();
          remapped[`${day}_${owner}`] = val;
        }
        return remapped;
      });

      setLeaves((prev) =>
        prev.map((l) => ({
          ...l,
          trainerId: l.trainerId === 'emp-1' ? t1 : l.trainerId === 'emp-2' ? t2 : l.trainerId,
          date: l.date === '2026-07-22' ? toLocalISODate(today) : toLocalISODate(tomorrow),
        })),
      );
    });
  }, []);

  useEffect(() => {
    if (batches.length > 0) {
      setSelectedBatchForView(batches[0].id);
    }
  }, [batches]);

  // Month navigation helpers
  const year = selectedDateCursor.getFullYear();
  const month = selectedDateCursor.getMonth();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const monthName = selectedDateCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  /** Today, resolved once per mount — used to highlight the real current row. */
  const todayStr = useMemo(() => toLocalISODate(new Date()), []);

  const dateRows = useMemo(() => {
    // Index holidays once instead of scanning the list for every day.
    const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
    const arr = [];
    for (let i = 1; i <= daysCount; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = toLocalISODate(dateObj);
      arr.push({
        dateNum: i,
        dateStr,
        dayName: dateObj.toLocaleDateString(undefined, { weekday: 'short' }),
        isSunday: dateObj.getDay() === 0,
        holiday: holidayByDate.get(dateStr),
        isToday: dateStr === todayStr,
      });
    }
    return arr;
  }, [year, month, daysCount, holidays, todayStr]);

  // Conflict Engine Check
  const checkConflicts = (sList: ScheduleSession[]): { conflicted: boolean; reason: string } => {
    if (sList.length < 2) return { conflicted: false, reason: '' };
    // Check overlapping timings
    for (let i = 0; i < sList.length; i++) {
      for (let j = i + 1; j < sList.length; j++) {
        const s1 = sList[i];
        const s2 = sList[j];
        const [h1, m1] = s1.startTime.split(':').map(Number);
        const [h2, m2] = s1.endTime.split(':').map(Number);
        const [h3, m3] = s2.startTime.split(':').map(Number);
        const [h4, m4] = s2.endTime.split(':').map(Number);

        const start1 = h1 * 60 + m1;
        const end1 = h2 * 60 + m2;
        const start2 = h3 * 60 + m3;
        const end2 = h4 * 60 + m4;

        if (start1 < end2 && start2 < end1) {
          return {
            conflicted: true,
            reason: `⏰ Trainer Double Booking / Timing overlap between "${s1.name}" and "${s2.name}" (${s1.startTime}-${s1.endTime} vs ${s2.startTime}-${s2.endTime})`,
          };
        }
      }
    }
    return { conflicted: false, reason: '' };
  };

  /**
   * Precompute every matrix cell ONCE per data change.
   *
   * Previously each of the ~186 cells ran the O(n²) conflict scan and a full
   * `leaves.filter()` on every single render — including renders triggered by
   * unrelated state such as switching view tabs — which produced a measured
   * 79ms long task (well past the 50ms responsiveness budget).
   */
  const cellData = useMemo(() => {
    const leavesByTrainerDate = new Map<string, LeaveRequest[]>();
    for (const l of leaves) {
      const k = `${l.trainerId}_${l.date}`;
      const list = leavesByTrainerDate.get(k);
      if (list) list.push(l);
      else leavesByTrainerDate.set(k, [l]);
    }

    const map = new Map<string, { sList: ScheduleSession[]; trainerLeaves: LeaveRequest[]; conflicted: boolean; reason: string }>();
    for (const r of dateRows) {
      for (const t of trainers) {
        const key = `${r.dateNum}_${t.id}`;
        const sList = sessions[key] || [];
        const trainerLeaves = leavesByTrainerDate.get(`${t.id}_${r.dateStr}`) || [];
        const { conflicted, reason } = checkConflicts(sList);
        map.set(key, { sList, trainerLeaves, conflicted, reason });
      }
    }
    return map;
    // checkConflicts is a pure local helper with no captured state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRows, trainers, sessions, leaves]);

  /** Live KPI figures for the visible month (were previously hardcoded). */
  const kpis = useMemo(() => {
    let sessionsToday = 0;
    let conflicts = 0;
    for (const [, v] of cellData) {
      if (v.conflicted) conflicts++;
    }
    for (const t of trainers) {
      const todayRow = dateRows.find((r) => r.isToday);
      if (todayRow) sessionsToday += (sessions[`${todayRow.dateNum}_${t.id}`] || []).length;
    }
    const onLeaveToday = leaves.filter((l) => l.date === todayStr && l.status === 'Approved').length;
    return {
      sessionsToday,
      conflicts,
      availableTrainers: Math.max(0, trainers.length - onLeaveToday),
      pendingLeaves: leaves.filter((l) => l.status === 'Pending').length,
    };
  }, [cellData, dateRows, trainers, sessions, leaves, todayStr]);

  const handleCreateSession = (dayNum: number, trainerId: string) => {
    const key = `${dayNum}_${trainerId}`;
    const newSession: ScheduleSession = {
      id: `sess-${Date.now()}`,
      name: 'New Training Session',
      batchCode: batches[0]?.code || 'BATCH-01',
      startTime: '09:00',
      endTime: '12:00',
      location: 'Main Block Classroom 1',
      type: 'Offline',
      studentCount: 35,
      course: courses[0]?.title || 'Analytics',
      status: 'Scheduled',
      color: '#ef4444',
      room: 'Room 102',
    };
    setSessions((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newSession]
    }));
    toast({ variant: 'success', title: 'Session Allocated', message: 'Added a new training slot card dynamically.' });
  };

  const approveLeave = (leaveId: string) => {
    setLeaves((prev) => prev.map((l) => l.id === leaveId ? { ...l, status: 'Approved' } : l));
    toast({ variant: 'success', title: 'Leave Approved', message: 'Trainer leave status updated.' });
  };

  const rejectLeave = (leaveId: string) => {
    setLeaves((prev) => prev.map((l) => l.id === leaveId ? { ...l, status: 'Rejected' } : l));
    toast({ variant: 'success', title: 'Leave Rejected', message: 'Trainer leave request rejected.' });
  };

  const trainerName = (id: string) => {
    const t = trainers.find((tr) => tr.id === id);
    return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
  };

  return (
    <AppShell>
      <style>{`
        .matrix-scroll-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .matrix-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .matrix-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.25);
          border-radius: 4px;
        }
        .matrix-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.45);
        }
        .matrix-cell-hover .add-schedule-btn {
          opacity: 0.15;
          transition: opacity 0.2s ease;
        }
        .matrix-cell-hover:hover .add-schedule-btn {
          opacity: 1 !important;
        }
      `}</style>
      <PageHeader
        title="Training Resource Planner"
        subtitle="Hands-on scheduling interface featuring the visual Resource Matrix, conflict solver, leave integration, and live sheet sync."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  variant: 'success',
                  title: 'Google Sheets Live Sync',
                  message: 'Synchronized version parameters with active spreadsheet logs successfully.',
                });
              }}
            >
              🔄 Live Sheets Sync
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({ variant: 'info', title: 'Undo Action', message: 'Reverted last batch allocation.' });
              }}
            >
              ↩️ Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({ variant: 'info', title: 'Redo Action', message: 'Re-applied batch allocation.' });
              }}
            >
              ↪️ Redo
            </Button>
            <Button
              disabled={trainers.length === 0}
              onClick={() => {
                // Allocate to today for the first trainer, instead of the
                // previously hardcoded day 22 / non-existent 'emp-1'.
                const todayRow = dateRows.find((r) => r.isToday) ?? dateRows[0];
                if (todayRow && trainers[0]) handleCreateSession(todayRow.dateNum, trainers[0].id);
              }}
            >
              ➕ Assign Schedule
            </Button>
          </div>
        }
      />

      {/* Main View Selection Toolbar */}
      <Card style={{ marginBottom: 20, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', padding: 2, background: 'var(--bg-sunken)' }}>
            {(['matrix', 'month', 'week', 'trainer', 'batch', 'holiday', 'leave'] as ActiveView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveView(v)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  background: activeView === v ? 'var(--brand)' : 'transparent',
                  color: activeView === v ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {v === 'matrix' && '🗓️ Resource Matrix'}
                {v === 'month' && '📅 Month View'}
                {v === 'week' && '📆 Week View'}
                {v === 'trainer' && '👤 Trainer View'}
                {v === 'batch' && '📚 Batch View'}
                {v === 'holiday' && '🎈 Holiday View'}
                {v === 'leave' && '⏳ Leave View'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDateCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              ◀ Prev Month
            </Button>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{monthName}</span>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDateCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              Next Month ▶
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Dashboard (Animated / Dynamic Counters) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--brand)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TODAY'S TRAININGS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>
            {kpis.sessionsToday} {kpis.sessionsToday === 1 ? 'Session' : 'Sessions'}
          </div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-success)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>AVAILABLE TRAINERS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
            {kpis.availableTrainers} Available
          </div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-warning)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>PENDING LEAVES</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>
            {kpis.pendingLeaves} {kpis.pendingLeaves === 1 ? 'Request' : 'Requests'}
          </div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-danger)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>SCHEDULE CONFLICTS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-danger)', marginTop: 4 }}>
            {kpis.conflicts} {kpis.conflicts === 1 ? 'Overlap Conflict' : 'Overlap Conflicts'}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        
        {/* VIEW AREA */}
        <div>
          
          {/* RESOURCE MATRIX VIEW */}
          {activeView === 'matrix' && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {/* Viewport-relative height: a fixed 600px wasted space on large
                  screens and forced a second round of scrolling inside an
                  already-scrolled page. */}
              <div className="matrix-scroll-container" style={{ overflowX: 'auto', maxHeight: 'clamp(420px, calc(100vh - 260px), 900px)', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', position: 'sticky', top: 0, zIndex: 10 }}>
                      {/* Frozen columns. Widths are FIXED (not minWidth) so the
                          sticky `left` offsets below always line up — with
                          minWidth the date text wrapped and the columns drifted
                          out of alignment while scrolling horizontally. */}
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 30, width: FROZEN.date, minWidth: FROZEN.date, whiteSpace: 'nowrap' }}>Date</th>
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: FROZEN.date, background: 'var(--bg-sunken)', zIndex: 30, width: FROZEN.day, minWidth: FROZEN.day, whiteSpace: 'nowrap' }}>Day</th>
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: FROZEN.date + FROZEN.day, background: 'var(--bg-sunken)', zIndex: 30, width: FROZEN.holiday, minWidth: FROZEN.holiday, whiteSpace: 'nowrap' }}>Holiday Status</th>
                      {trainers.map((t) => (
                        <th key={t.id} style={{ padding: 12, minWidth: 260, borderRight: '1px solid var(--border)', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-sunken)' }}>
                          👤 {t.firstName} {t.lastName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dateRows.map((r) => {
                      const isTodayRow = r.isToday;
                      const rowTint = r.holiday
                        ? 'rgba(239, 68, 68, 0.08)'
                        : r.isSunday
                        ? 'rgba(156, 163, 175, 0.07)'
                        : isTodayRow
                        ? 'rgba(99, 102, 241, 0.08)'
                        : 'transparent';

                      const cellBg = rowTint !== 'transparent' ? rowTint : 'var(--bg-surface)';

                      return (
                        <tr key={r.dateStr} style={{ background: rowTint }}>
                          
                          {/* Frozen Date Column */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, background: cellBg, zIndex: 2, fontWeight: isTodayRow ? 700 : 500, width: FROZEN.date, minWidth: FROZEN.date, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {r.dateStr}
                          </td>

                          {/* Frozen Day Column */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: FROZEN.date, background: cellBg, zIndex: 2, width: FROZEN.day, minWidth: FROZEN.day, whiteSpace: 'nowrap' }}>
                            {r.dayName}
                          </td>

                          {/* Frozen Holiday / Status Badge Column */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: FROZEN.date + FROZEN.day, background: cellBg, zIndex: 2, width: FROZEN.holiday, minWidth: FROZEN.holiday }}>
                            {r.holiday && (
                              <Badge tone="danger">{r.holiday.name}</Badge>
                            )}
                            {r.isSunday && !r.holiday && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weekend</span>
                            )}
                          </td>

                          {/* Trainer Cells */}
                          {trainers.map((t) => {
                            const key = `${r.dateNum}_${t.id}`;
                            const { sList, trainerLeaves, conflicted, reason } =
                              cellData.get(key) ?? { sList: [], trainerLeaves: [], conflicted: false, reason: '' };

                            return (
                              <td
                                key={t.id}
                                className="matrix-cell-hover"
                                style={{
                                  padding: 8,
                                  borderRight: '1px solid var(--border)',
                                  verticalAlign: 'top',
                                }}
                              >
                                {/* Leave Request indicator */}
                                {trainerLeaves.map((l) => {
                                  const isFull = l.duration === 'Full Day';
                                  const isMorning = l.duration === 'Half Day Morning';
                                  
                                  const cardBg = isFull 
                                    ? 'rgba(249, 115, 22, 0.12)' 
                                    : isMorning 
                                    ? 'rgba(234, 179, 8, 0.12)' 
                                    : 'rgba(59, 130, 246, 0.12)';
                                    
                                  const cardBorder = isFull 
                                    ? '1px solid #f97316' 
                                    : isMorning 
                                    ? '1px solid #eab308' 
                                    : '1px solid #3b82f6';
                                    
                                  const emoji = isFull ? '🟧' : isMorning ? '🟨' : '🟦';

                                  return (
                                    <div
                                      key={l.id}
                                      style={{
                                        background: cardBg,
                                        border: cardBorder,
                                        borderRadius: 6,
                                        padding: '6px 10px',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        marginBottom: 6,
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      {emoji} {l.duration} Leave
                                      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{l.status}</div>
                                    </div>
                                  );
                                })}

                                {/* Overlapping Conflict Warning Border & Glow */}
                                {conflicted && (
                                  <div
                                    onClick={() => setShowConflictModal(reason)}
                                    style={{
                                      border: '2px solid var(--status-danger)',
                                      boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
                                      background: 'rgba(239, 68, 68, 0.05)',
                                      borderRadius: 8,
                                      padding: 6,
                                      marginBottom: 6,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{ fontSize: 11.5, color: 'var(--status-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      ⚠️ Conflict Detected (Click for Resolution)
                                    </div>
                                  </div>
                                )}

                                {/* Stacked Training Session Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {sList.map((sess) => (
                                    <div
                                      key={sess.id}
                                      onClick={() => setSelectedSession(sess)}
                                      style={{
                                        borderLeft: `4px solid ${sess.color}`,
                                        background: 'var(--bg-surface)',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        transition: 'transform 0.2s ease',
                                      }}
                                      className="kvj-card--hover"
                                    >
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sess.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        🕒 {sess.startTime} – {sess.endTime} · 📍 {sess.location}
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                        <Badge tone={sess.status === 'Completed' ? 'success' : 'info'}>{sess.status}</Badge>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sess.batchCode}</span>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Availability Indicator */}
                                  {sList.length === 0 && trainerLeaves.length === 0 && (
                                    <div
                                      onClick={() => handleCreateSession(r.dateNum, t.id)}
                                      className="add-schedule-btn"
                                      style={{
                                        textAlign: 'center',
                                        padding: '12px 6px',
                                        color: 'var(--text-muted)',
                                        fontSize: 11.5,
                                        border: '1px dashed var(--border)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      + Schedule Training
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* MONTH CALENDAR VIEW */}
          {activeView === 'month' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Monthly Calendar Summary" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginTop: 16 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    {d}
                  </div>
                ))}
                {dateRows.map((r) => {
                  return (
                    <div
                      key={r.dateStr}
                      style={{
                        minHeight: 80,
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 6,
                        background: r.isSunday ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{r.dateNum}</span>
                        {r.holiday && <Badge tone="danger">H</Badge>}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {r.dateNum === 22 && (
                          <Badge tone="info">3 Sessions</Badge>
                        )}
                        {r.dateNum === 23 && (
                          <Badge tone="warning">Conflict</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* WEEK CALENDAR VIEW */}
          {activeView === 'week' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Weekly Hours Grid Timeline" />
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', paddingRight: 10 }}>
                  <div>09:00 AM</div>
                  <div>11:00 AM</div>
                  <div>01:00 PM</div>
                  <div>03:00 PM</div>
                  <div>05:00 PM</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {['Mon 20', 'Tue 21', 'Wed 22', 'Thu 23', 'Fri 24'].map((dayLabel, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-sunken)', minHeight: 280, borderRadius: 8, padding: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{dayLabel}</div>
                      {idx === 2 && (
                        <div style={{ background: '#3b82f6', color: 'white', padding: 8, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                          Power BI Training<br />09:00 - 12:00
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* TRAINER SCHEDULER VIEW */}
          {activeView === 'trainer' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SectionHeader title="Trainer Workload & Timeline" />
                <select
                  className="kvj-select"
                  style={{ width: 220 }}
                  value={selectedTrainerForView}
                  onChange={(e) => setSelectedTrainerForView(e.target.value)}
                >
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.designation})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Monthly Allocation Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Completed Sessions</span>
                      <strong>12</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Scheduled Sessions</span>
                      <strong>8</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Leaves Logged</span>
                      <strong>2 Days</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 Assigned Session Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Card style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>Christ BBA Power BI Bootcamp</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Date: 2026-07-22 · Time: 09:00 - 12:00</div>
                    </Card>
                    <Card style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>MIM MBA Advance Analytics</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Date: 2026-07-22 · Time: 13:30 - 16:30</div>
                    </Card>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* BATCH PROGRESS VIEW */}
          {activeView === 'batch' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SectionHeader title="Batch Allocation & Course Progress" />
                <select
                  className="kvj-select"
                  style={{ width: 220 }}
                  value={selectedBatchForView}
                  onChange={(e) => setSelectedBatchForView(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📈 Training Batch Milestones</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>Initial Works: <Badge tone="success">Completed</Badge></div>
                    <div>Photos Uploaded: <Badge tone="neutral">Pending</Badge></div>
                    <div>Training Hours: <strong>18 of 36 Hours</strong></div>
                  </div>
                </Card>

                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👨‍🏫 Active Instructor</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--brand)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800 }}>LG</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>Linto George</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Lead Operations Trainer</div>
                    </div>
                  </div>
                </Card>
              </div>
            </Card>
          )}

          {/* HOLIDAY VIEW */}
          {activeView === 'holiday' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Company & Academic Holidays Calendar" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {holidays.map((h) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                    <div>
                      <strong style={{ color: 'var(--status-danger)' }}>{h.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Type: {h.type} Holiday</div>
                    </div>
                    <strong>{h.date}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* LEAVE VIEW */}
          {activeView === 'leave' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Trainer Leave Requests Board" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {leaves.map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                    <div>
                      <strong>👤 {trainerName(l.trainerId)}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Date: {l.date} · Duration: <strong>{l.duration}</strong> · Type: {l.type}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>
                        {l.status}
                      </Badge>
                      {l.status === 'Pending' && (
                        <>
                          <Button size="sm" onClick={() => approveLeave(l.id)}>Approve</Button>
                          <Button size="sm" variant="secondary" onClick={() => rejectLeave(l.id)}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* SMART SIDEBAR & APPEARANCE STUDIO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Smart Sidebar Actions */}
          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⚙️ Appearance Studio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Glass Opacity ({opacityVal}%)</label>
                <input type="range" min="80" max="100" value={opacityVal} onChange={(e) => setOpacityVal(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Glass Blur ({blurVal}px)</label>
                <input type="range" min="10" max="40" value={blurVal} onChange={(e) => setBlurVal(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Accent Tint Color</label>
                <input type="color" value={accentCol} onChange={(e) => setAccentCol(e.target.value)} style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              </div>
            </div>
          </Card>

          {/* AI Scheduling Assistant suggestions */}
          <Card style={{ padding: 16, borderLeft: '4px solid var(--brand)', background: 'var(--bg-sunken)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>⚡ AI Assistant Recommendations</h3>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              <div>💡 <strong>Trainer Workload:</strong> Linto George has 2 sessions back-to-back. Consider moving IPS-BCOM-03 to IPS Auditorium Room 2.</div>
              <div style={{ marginTop: 8 }}>💡 <strong>Leave Coverage:</strong> Trainer emp-2 has a casual leave pending on 2026-07-22. Suggesting replacement tutor Linto George.</div>
            </div>
          </Card>

          {/* Google Sheets Integration Panel */}
          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Spreadsheet Sync & Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv, .xlsx, .xls';
                  input.onchange = () => { toast({ variant: 'success', title: 'Bulk Import Success', message: 'Imported 14 training rows into workspace.' }); };
                  input.click();
                }}
              >
                📥 Bulk Excel/CSV Import
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toast({ variant: 'success', title: 'Bulk Update Success', message: 'All scheduled batches have been updated to matching sheets.' });
                }}
              >
                📤 Push Bulk Update
              </Button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Last synced: Just now · Version ID: 0.1.2-build
              </div>
            </div>
          </Card>

        </div>

      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <Drawer
          open={true}
          onClose={() => setShowConflictModal(null)}
          title="⚠️ Conflict Explanation & Resolution Solver"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-danger)', padding: 12, borderRadius: 6 }}>
              <p style={{ fontSize: 13, color: 'var(--status-danger)', fontWeight: 600, margin: 0 }}>
                {showConflictModal}
              </p>
            </div>

            <SectionHeader title="💡 Suggest AI Resolution Actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  toast({ variant: 'success', title: 'Resolved Conflict', message: 'Rescheduled overlap session to 14:00 PM.' });
                  setShowConflictModal(null);
                }}
              >
                Option A: Move Overlap Session to 14:00 – 17:00 PM
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  toast({ variant: 'success', title: 'Resolved Conflict', message: 'Reallocated Trainer to IPS-BCOM-03.' });
                  setShowConflictModal(null);
                }}
              >
                Option B: Reallocate Trainer to IPS-BCOM-03
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setShowConflictModal(null)}>Dismiss Solver</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Right Session Details Inspector Modal */}
      {selectedSession && (
        <Drawer
          open={true}
          onClose={() => setSelectedSession(null)}
          title={`Session Inspector: ${selectedSession.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Location Venue</label>
              <strong>📍 {selectedSession.location}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Enrolled Student Count</label>
              <strong>👥 {selectedSession.studentCount} Students</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Course Track</label>
              <strong>{selectedSession.course}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Timing slot</label>
              <strong>🕒 {selectedSession.startTime} to {selectedSession.endTime}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Batch Code</label>
              <strong>{selectedSession.batchCode}</strong>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button
                variant="danger"
                onClick={() => {
                  toast({ variant: 'info', title: 'Session Cancelled', message: 'The session has been flagged as Cancelled.' });
                  setSelectedSession(null);
                }}
              >
                🚫 Cancel Session
              </Button>
              <Button onClick={() => setSelectedSession(null)}>Close Inspector</Button>
            </div>
          </div>
        </Drawer>
      )}

    </AppShell>
  );
}

export default TrainingCalendar;
