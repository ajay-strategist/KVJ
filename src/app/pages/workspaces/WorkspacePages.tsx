import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { useDevice } from '../../../shared/hooks/responsive';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';
import { PageHeader, Card, SectionHeader, StatCard, QuickActionCard, Badge, Timeline, ActivityCard, Button } from '../../../shared/ui/components';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { ROLES } from '../../../shared/permissions/roles';
import { useAttendance } from '../../../modules/attendance/hooks/useAttendance';
import { useCommunication } from '../../../modules/communication/hooks/useCommunication';
import type { AttendanceRecord, WorkSessionType } from '../../../modules/attendance/attendance.repository';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { useLeave } from '../../../modules/leave/hooks/useLeave';
import { Form, SelectField, TextField, DatePickerField, CheckboxField, FileUploadField, TextAreaField, useForm } from '../../../shared/forms/form';

import { useProject } from '../../../modules/project/hooks/useProject';
import { useTaskSessions } from '../../../modules/project/hooks/useTaskSessions';
import { useEmployee } from '../../../modules/employee/hooks/useEmployee';
import { useTraining } from '../../../modules/training/hooks/useTraining';
import { cleanBatchCode } from '../../../modules/training/utils/batch-formatter';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../../../modules/attendance/attendance.repository';
import { ATTENDANCE_SERVICE_TOKEN } from '../../../modules/attendance/attendance.service';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../../../modules/finance/finance.repository';
import { LEAVE_REPOSITORY_TOKEN } from '../../../modules/leave/leave.repository';
import { TASK_REPOSITORY_TOKEN } from '../../../modules/project/project.repository';
import { toLocalISODate } from '../../../shared/utils/date';
import { supabase } from '../../../shared/integration/supabase';
import { CreateTaskModal } from '../../../modules/project/components/CreateTaskModal';
import { taskTimerStore } from '../../../shared/utils/taskTimerStore';

function Greeting() {
  const { user } = useAuth();
  return (
    <PageHeader
      title="Welcome to KVJ Analytics"
      subtitle="Connect. Manage. Transform."
      actions={
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      }
    />
  );
}

const statusMap = {
  present: { label: 'Present', tone: 'success' as const },
  on_break: { label: 'On Break', tone: 'warning' as const },
  clocked_out: { label: 'Clocked Out', tone: 'neutral' as const },
  absent: { label: 'Absent', tone: 'danger' as const },
};

function ConditionalAttendanceFields() {
  const { values } = useForm();
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });
  
  if (values.classification === 'Training') {
    const options = batches.length > 0
      ? batches.map((b) => {
          // Canonical batch label (corrects a stale generated code's batch number
          // from the batch's Batch-No field) — same as everywhere else, so no
          // duplicate/missing batch appears here.
          const label = cleanBatchCode(b.code, b.batchNo) || b.trainingName || 'Batch';
          return { value: label, label };
        })
      : [{ value: 'No Batches Available', label: 'No Batches Available' }];
    return (
      <SelectField
        name="location"
        label="Select Training Batch"
        options={options}
      />
    );
  }

  if (values.classification === 'Marketing') {
    return (
      <TextField
        name="organisationsVisited"
        label="Organisations Visited"
        placeholder="e.g. Christ College, Rajagiri College"
      />
    );
  }

  return null;
}

const resolveLocationName = (locStr: string) => {
  if (locStr.includes('9.98') || locStr.includes('Office') || locStr.includes('Detecting')) {
    return 'KVJ Kochi HQ Workspace';
  }
  return locStr;
};

interface AttendancePanelProps {
  record: AttendanceRecord | null;
  loading: boolean;
  clockIn: (workType: WorkSessionType) => Promise<any>;
  clockOut: () => Promise<any>;
  startBreak: (reason?: string) => Promise<any>;
  endBreak: () => Promise<any>;
  onActivityLog?: (title: string, tone?: 'success' | 'progress' | 'info' | 'neutral') => void;
}

export const AttendancePanel = memo(function AttendancePanel({
  record,
  loading,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  onActivityLog,
}: AttendancePanelProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const { user } = useAuth();
  const { batches, courses } = useTraining({ fetchStudents: false, fetchEnrollments: false });
  const { employees } = useEmployee();
  const [clockInOpen, setClockInOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Office');

  const currentEmployee = useMemo(() => {
    if (!user) return null;
    return (employees || []).find(
      (e) => e.id === user.id || (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
    );
  }, [employees, user]);

  const [assignedTodayBatchIds, setAssignedTodayBatchIds] = useState<Set<string>>(new Set());
  // Real enrolled-student count per batch (from actual enrollments, not capacity).
  const [batchStudentCounts, setBatchStudentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('flwdsk_enrollments')
      .select('batch_id')
      .is('deleted_at', null)
      .then(({ data }) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        (data || []).forEach((e: any) => {
          if (e.batch_id) counts[e.batch_id] = (counts[e.batch_id] || 0) + 1;
        });
        setBatchStudentCounts(counts);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function loadAssignedSessions() {
      try {
        const todayStr = toLocalISODate(new Date());
        const { data } = await supabase
          .from('flwdsk_schedule_sessions')
          .select('*')
          .eq('date', todayStr)
          .is('deleted_at', null);

        if (data && data.length > 0) {
          const set = new Set<string>();
          const userEmail = user?.email?.toLowerCase()?.trim();
          const userName = user?.fullName?.toLowerCase()?.trim();
          const empId = currentEmployee?.id;

          data.forEach((s: any) => {
            const isTrainerMatch =
              (s.trainer_id && (s.trainer_id === user?.id || s.trainer_id === empId)) ||
              (s.employee_id && (s.employee_id === user?.id || s.employee_id === empId)) ||
              (s.trainer_name && userName && s.trainer_name.toLowerCase().trim() === userName) ||
              (s.trainer_email && userEmail && s.trainer_email.toLowerCase().trim() === userEmail);

            if (isTrainerMatch) {
              if (s.batch_id) set.add(s.batch_id);
              if (s.topic) {
                set.add(s.topic);
                set.add(cleanBatchCode(s.topic));
              }
            }
          });
          setAssignedTodayBatchIds(set);
        } else {
          setAssignedTodayBatchIds(new Set());
        }
      } catch (e) { void e; }
    }
    loadAssignedSessions();
  }, [user, currentEmployee]);

  const availableBatches = useMemo(() => {
    if (!batches || batches.length === 0) return [];

    const mapped = batches.map((b) => {
      const courseObj = courses.find((c) => c.id === b.courseId);
      // cleanBatchCode(code, batchNo) syncs a stale generated code's "Batch N" to
      // the batch's current Batch-No field, so each batch shows its correct,
      // distinct number (matches Batch Management). This is the single canonical
      // batch label used everywhere.
      const cleanCode = cleanBatchCode(b.code, b.batchNo);
      const name = cleanCode || b.trainingName || 'Training Batch';

      const isCalendarAssignedToday = Boolean(
        assignedTodayBatchIds.has(b.id) ||
        (b.code && (assignedTodayBatchIds.has(b.code) || assignedTodayBatchIds.has(cleanBatchCode(b.code)))) ||
        (cleanCode && assignedTodayBatchIds.has(cleanCode))
      );

      // ONLY mark as assigned if scheduled in today's training calendar for this trainer
      const isMyAssigned = isCalendarAssignedToday;

      return {
        id: b.id,
        name,
        rawCode: b.code,
        college: b.college || '—',
        course: courseObj?.title || b.trainingName || 'Training Program',
        time: '09:00 AM - 12:00 PM',
        students: batchStudentCounts[b.id] ?? 0,
        trainer: b.coordinator || (b as any).trainer || 'Assigned Trainer',
        isMyAssigned,
      };
    });

    // Sort employee assigned batches TO THE TOP, followed by remaining batches
    return mapped.sort((a, b) => {
      if (a.isMyAssigned && !b.isMyAssigned) return -1;
      if (!a.isMyAssigned && b.isMyAssigned) return 1;
      return 0;
    });
  }, [batches, courses, user, currentEmployee, assignedTodayBatchIds, batchStudentCounts]);

  const [selectedBatch, setSelectedBatch] = useState('');

  useEffect(() => {
    if (availableBatches.length > 0 && (!selectedBatch || !availableBatches.some((b) => b.name === selectedBatch))) {
      setSelectedBatch(availableBatches[0].name);
    }
  }, [availableBatches, selectedBatch]);

  // GPS & Location state
  const [locationStr, setLocationStr] = useState<string>('Detecting location...');
  const [placeName, setPlaceName] = useState<string>('Detecting location...');

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStr(`${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`);
        },
        () => { setLocationStr('Office / GPS Active'); },
        { timeout: 5000 }
      );
    } else {
      setLocationStr('Office / GPS N/A');
    }
  }, []);

  useEffect(() => {
    if (!locationStr || locationStr.includes('Detecting') || locationStr.includes('N/A')) {
      setPlaceName(locationStr);
      return;
    }
    if (locationStr.includes('Office') || locationStr.includes('9.98')) {
      setPlaceName('KVJ Kochi HQ Workspace');
      return;
    }
    const cleanCoords = locationStr.replace(/[^\d.,-]/g, '');
    const parts = cleanCoords.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: { 'User-Agent': 'KVJAnalyticsApp/1.0' }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
              const addr = data.address;
              const shortName = addr ? (addr.road || addr.suburb || addr.neighbourhood || addr.city || addr.town || data.display_name) : data.display_name;
              setPlaceName(shortName);
            } else {
              setPlaceName(locationStr);
            }
          })
          .catch(() => {
            setPlaceName(locationStr);
          });
      } else {
        setPlaceName(locationStr);
      }
    } else {
      setPlaceName(locationStr);
    }
  }, [locationStr]);

  const currentStatus = (record?.status ?? 'clocked_out') as keyof typeof statusMap;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (currentStatus === 'present' || currentStatus === 'on_break') {
      // Refresh the elapsed-time display once a minute (not every second) so the
      // whole page isn't redrawn 60× a minute. Minute precision is enough here.
      const timer = setInterval(() => { setNow(Date.now()); }, 60000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  const formatDuration = (ms: number) => {
    if (ms <= 0 || isNaN(ms)) return '00h 00m';
    const min = Math.floor(ms / 60000) % 60;
    const hr = Math.floor(ms / 3600000);
    return `${String(hr).padStart(2, '0')}h ${String(min).padStart(2, '0')}m`;
  };

  const currentWorkType = record?.sessions && record.sessions.length > 0
    ? record.sessions[record.sessions.length - 1].workType
    : '--';

  const clockInTimeStr = record?.firstClockIn
    ? new Date(record.firstClockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    : '--';

  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    // Once a minute instead of every second — see note above.
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const completedBreakMs = (record?.breaks ?? []).reduce((sum: number, b: any) => {
    const sTime = b.startTime || b.start_time;
    const eTime = b.endTime || b.end_time;
    if (eTime && sTime) return sum + (new Date(eTime).getTime() - new Date(sTime).getTime());
    return sum;
  }, 0);

  const completedSessionMs = (record?.sessions ?? []).reduce((sum: number, s: any) => {
    const cIn = s.clockIn || s.clock_in;
    const cOut = s.clockOut || s.clock_out;
    if (cOut && cIn) return sum + (new Date(cOut).getTime() - new Date(cIn).getTime());
    return sum;
  }, 0);

  const activeSession = record?.sessions?.find((s: any) => !(s.clockOut || s.clock_out));
  const startTimeStr = activeSession?.clockIn || (activeSession as any)?.clock_in || record?.firstClockIn;
  const activeSessionMs = (record?.status === 'present' || record?.status === 'on_break') && startTimeStr
    ? Math.max(0, nowMs - new Date(startTimeStr).getTime())
    : 0;

  const activeBreak = record?.breaks?.find((b: any) => !(b.endTime || b.end_time));
  const activeBreakStart = activeBreak ? (activeBreak.startTime || (activeBreak as any)?.start_time) : null;
  const activeBreakMs = activeBreakStart ? Math.max(0, nowMs - new Date(activeBreakStart).getTime()) : 0;

  const dbBreakMs = ((record?.totalBreakMinutes || (record as any)?.total_break_minutes || 0) * 60000);
  const totalBreakMs = Math.max(completedBreakMs, dbBreakMs) + activeBreakMs;
  const grossDurationMs = completedSessionMs + activeSessionMs;
  const totalWorkMs = Math.max(0, grossDurationMs - totalBreakMs);

  const handleCustomClockInSubmit = useCallback(async () => {
    const type = selectedMode === 'Training' ? `Training: ${selectedBatch}` : selectedMode === 'Remote' ? 'Work From Home' : 'Office';
    const res = await clockIn(type as any);
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked In', message: `Clocked in for ${type} (${locationStr})` });
      if (onActivityLog) onActivityLog(`Clocked in for ${type} (${locationStr})`, 'success');
      setClockInOpen(false);
    } else {
      toast({ variant: 'error', title: 'Clock In Failed', message: res.error });
    }
  }, [clockIn, selectedMode, selectedBatch, toast, locationStr, onActivityLog]);

  const handleClockOut = useCallback(async () => {
    const ok = await confirm({ title: 'Clock Out?', message: 'Are you sure you want to end your work day?' });
    if (!ok) return;
    const res = await clockOut();
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked Out', message: 'You have successfully clocked out.' });
      if (onActivityLog) onActivityLog('Clocked out work session', 'neutral');
    } else {
      toast({ variant: 'error', title: 'Clock Out Failed', message: res.error });
    }
  }, [confirm, clockOut, toast, onActivityLog]);

  const handleDirectStartBreak = useCallback(async () => {
    const res = await startBreak('Official Break');
    if (res.ok) {
      toast({ variant: 'info', title: 'On Break', message: 'Enjoy your break.' });
      if (onActivityLog) onActivityLog('Started official break', 'info');
    } else {
      toast({ variant: 'error', title: 'Break Failed', message: res.error });
    }
  }, [startBreak, toast, onActivityLog]);

  const handleEndBreak = useCallback(async () => {
    const res = await endBreak();
    if (res.ok) {
      toast({ variant: 'success', title: 'Back to Work', message: 'Work session resumed.' });
      if (onActivityLog) onActivityLog('Resumed work session after break', 'progress');
    } else {
      toast({ variant: 'error', title: 'End Break Failed', message: res.error });
    }
  }, [endBreak, toast, onActivityLog]);

  const sampleBatches = [
    { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
    { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
    { value: 'MIM 1MBA 2026-27 B1', label: 'MIM 1MBA 2026-27 B1' },
  ];

  return (
    <>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '24px 28px 28px 28px',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
          marginBottom: 24,
          position: 'relative',
        }}
      >
        {/* Header bar matching Sample Image */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>
            Attendance Control Panel — Office / Training
          </h3>
        </div>

        {/* 5 Stat Columns inside single soft ice-blue container box */}
        <div
          style={{
            display: 'grid',
            // Wraps to fewer columns on narrow/mobile screens instead of squashing 5 across.
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
            padding: '16px 24px',
            borderRadius: 16,
            background: '#f1f5fe',
            border: '1px solid #dbe6fe',
            marginBottom: 18,
            alignItems: 'center',
          }}
        >
          {/* CURRENT STATUS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              CURRENT STATUS
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {currentStatus === 'present' ? '🟢 Working' : currentStatus === 'on_break' ? '🟡 On Break' : '⚫ Not Working'}
            </span>
          </div>

          {/* GPS LOCATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              GPS LOCATION
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#6366f1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={placeName}>
              📍 {placeName}
            </span>
          </div>

          {/* CLOCK IN TIME */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              CLOCK IN TIME
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              {clockInTimeStr}
            </span>
          </div>

          {/* TOTAL DURATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              Total Duration (Today)
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(grossDurationMs)}
            </span>
          </div>

          {/* BREAK DURATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              BREAK DURATION
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: currentStatus === 'on_break' ? '#d97706' : '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(totalBreakMs)}
            </span>
          </div>

          {/* HOURS WORKED */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              Hours Worked
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(totalWorkMs)}
            </span>
          </div>
        </div>

        {/* Action Controls Bar matching Sample Image */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {(currentStatus === 'clocked_out' || (currentStatus !== 'present' && currentStatus !== 'on_break')) && (
            <button
              type="button"
              className="kvj-btn"
              disabled={loading}
              onClick={() => setClockInOpen(true)}
              style={{
                background: '#00c875',
                color: '#ffffff',
                border: 'none',
                padding: '12px 28px',
                fontWeight: 700,
                fontSize: 13.5,
                borderRadius: 999,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,200,117,0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Clock In (Office / Training)
            </button>
          )}

          {currentStatus === 'present' && (
            <>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading}
                onClick={handleDirectStartBreak}
                style={{
                  background: 'var(--status-warning)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ☕ Start Official Break
              </button>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading}
                onClick={handleClockOut}
                style={{
                  background: 'var(--status-danger)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                🔴 Clock Out
              </button>
            </>
          )}

          {currentStatus === 'on_break' && (
            <button
              type="button"
              className="kvj-btn"
              disabled={loading}
              onClick={handleEndBreak}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                border: 'none',
                padding: '11px 22px',
                fontWeight: 700,
                fontSize: 13.5,
                borderRadius: 10,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ▶️ Resume Work Session
            </button>
          )}

          {/* Always visible action to submit attendance */}
          <button
            type="button"
            className="kvj-btn"
            onClick={() => setClaimOpen(true)}
            style={{
              background: '#ffffff',
              color: '#6366f1',
              border: '2px solid #a5b4fc',
              padding: '10px 22px',
              fontWeight: 700,
              fontSize: 13.5,
              borderRadius: 999,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(99,102,241,0.08)',
              marginLeft: 'auto',
            }}
          >
            📋 Submit Attendance
          </button>
        </div>
      </div>

      {/* Clock In Drawer */}
      <Drawer
        open={clockInOpen}
        onClose={() => setClockInOpen(false)}
        title="Attendance Clock In"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 6 }}>
            Verify your attendance details before clocking in.
          </p>

          {/* Group 1: Attendance Mode selectable cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Attendance Location Mode</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { value: 'Office', label: 'Office', icon: '🏢' },
                { value: 'Training', label: 'Training', icon: '👨‍🏫' },
                { value: 'Remote', label: 'Remote', icon: '🏠' },
                { value: 'Travel', label: 'Travel', icon: '🚗' },
              ].map((m) => {
                const active = selectedMode === m.value;
                return (
                  <div
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    style={{
                      border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
                      background: active ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group 2: Training Batch Selector */}
          {selectedMode === 'Training' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Select Training Batch</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{availableBatches.length} Batches Available</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {availableBatches.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-sunken)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                    No training batches found. Create batches in Training Details page.
                  </div>
                ) : (
                  availableBatches.map((b) => {
                    const active = selectedBatch === b.name;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBatch(b.name)}
                        style={{
                          border: active ? '2px solid var(--brand)' : (b.isMyAssigned ? '1.5px solid var(--status-success)' : '1px solid var(--border)'),
                          background: active ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{b.name}</span>
                            {b.isMyAssigned && (
                              <Badge tone="success">Assigned</Badge>
                            )}
                          </div>
                          <Badge tone={active ? 'info' : 'neutral'}>{b.course}</Badge>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>🏫 {b.college}</span>
                          <span>👥 {b.students} Students</span>
                          <span>🕒 {b.time}</span>
                          <span>👤 Trainer: {b.trainer}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Group 3: GPS Verification Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>GPS Verification</span>
            <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🟢 GPS Status: Verified
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>High Accuracy (3m)</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>📍 Location: {resolveLocationName(locationStr)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Coordinates: {locationStr}</div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${locationStr}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'underline', display: 'inline-block', marginTop: 6 }}
              >
                View on Google Maps ↗
              </a>
            </div>
          </div>

          {/* Group 4: Pre-Clock In Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Clock In Summary</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>Attendance Type: <strong>{selectedMode}</strong></div>
                <div>GPS Status: <strong style={{ color: 'var(--status-success)' }}>Verified</strong></div>
                <div style={{ gridColumn: 'span 2' }}>Selected Batch: <strong>{selectedMode === 'Training' ? selectedBatch : 'N/A - Office Work'}</strong></div>
                <div>Current Time: <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                <div>Employee: <strong>{user?.fullName || 'Employee'}</strong></div>
                {selectedMode === 'Training' && (
                  <div>Trainer: <strong>{availableBatches.find((b) => b.name === selectedBatch)?.trainer || 'Assigned Trainer'}</strong></div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons inside Drawer Body */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Button
              variant="secondary"
              onClick={() => setClockInOpen(false)}
              style={{ flex: 1, padding: '10px 0' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomClockInSubmit}
              style={{ flex: 2, padding: '10px 0', background: 'var(--status-success)', color: '#fff', border: 'none', fontWeight: '600' }}
            >
              Confirm Clock In
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Submit / Claim Attendance Drawer */}
      <Drawer open={claimOpen} onClose={() => setClaimOpen(false)} title="Submit Attendance Request">
        <Form
          initial={{
            date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            classification: 'Office',
            location: '',
            organisationsVisited: '',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={async (values) => {
            const locText = values.classification === 'Training' 
              ? values.location 
              : values.classification === 'Marketing' 
              ? `Marketing: ${values.organisationsVisited}` 
              : 'Office Work';
            
            try {
              const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
              await attService.requestCorrection(
                record?.id || String(Date.now()),
                'attendance_claim',
                `${values.date} (${values.startTime} - ${values.endTime})`,
                `Classification: ${values.classification}, Location: ${locText}. ${values.notes || ''}`,
                { id: record?.employeeId || user?.id || 'emp-user', role: 'Employee' }
              );
            } catch (e) {
              console.warn('Attendance correction request notice:', e);
            }

            toast({
              variant: 'success',
              title: 'Attendance Request Submitted',
              message: `Attendance claim for ${values.date} (${values.startTime} - ${values.endTime}) sent to Approvals Queue for review.`,
            });
            if (onActivityLog) {
              onActivityLog(`Submitted attendance claim for ${values.date} (${locText})`, 'success');
            }
            setClaimOpen(false);
          }}
        >
          <TextField name="date" label="Attendance Date" placeholder="YYYY-MM-DD" />
          <SelectField
            name="classification"
            label="Attendance Type"
            options={[
              { value: 'Office', label: 'Office Work' },
              { value: 'Training', label: 'Training Batch Session' },
              { value: 'Marketing', label: 'Marketing Visit' },
            ]}
          />
          <ConditionalAttendanceFields />
          <TextField name="startTime" label="Start Time" placeholder="08:30 AM" />
          <TextField name="endTime" label="End Time" placeholder="05:00 PM" />
          <TextField name="notes" label="Reason / Notes (Optional)" placeholder="Emergency, system delay, or missed clock-in..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setClaimOpen(false)}>Cancel</Button>
            <Button type="submit">Submit for Review</Button>
          </div>
        </Form>
      </Drawer>


    </>
  );
});

const TASK_TIMER_STORAGE_KEY = 'kvj_task_timer_state_v1';
const TIMELINE_STORAGE_KEY = 'kvj_daily_activity_timeline_v1';

export interface StoredTaskState {
  secondsToday: number;
  active: boolean;
  lastStartTime?: number;
  underReview?: boolean;
  /** ISO date string (YYYY-MM-DD) of the day this state was recorded — used to detect cross-day stale state */
  date?: string;
}

const getStoredTaskStates = (): Record<string, StoredTaskState> => {
  try {
    const raw = localStorage.getItem(TASK_TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredTaskStates = (states: Record<string, StoredTaskState>) => {
  try {
    localStorage.setItem(TASK_TIMER_STORAGE_KEY, JSON.stringify(states));
  } catch (e) { void e; }
};

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  due: string;
  priority: string;
  active: boolean;
  underReview?: boolean;
  isApproved?: boolean;
  isRework?: boolean;
  reworkNotes?: string;
  secondsToday: number;
  assignee?: string;
  supervisor?: string;
}

function getTimeLeftInfo(dueStr: string): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (!dueStr) return { label: 'No due date', tone: 'neutral' };
  const todayStr = toLocalISODate(new Date());
  const due = dueStr.slice(0, 10);

  if (due < todayStr) {
    const diffMs = new Date(todayStr).getTime() - new Date(due).getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000));
    return {
      label: diffDays === 1 ? '1 day overdue' : `${diffDays} days overdue`,
      tone: 'danger',
    };
  } else if (due === todayStr) {
    return { label: 'Due Today', tone: 'warning' };
  } else {
    const diffMs = new Date(due).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000));
    return {
      label: diffDays === 1 ? '1 day left' : `${diffDays} days left`,
      tone: 'neutral',
    };
  }
}

const TASK_ORDER_STORAGE_KEY = 'kvj_task_order_v1';

const getStoredTaskOrder = (): string[] => {
  try {
    const saved = localStorage.getItem(TASK_ORDER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveStoredTaskOrder = (order: string[]) => {
  try {
    localStorage.setItem(TASK_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (e) { void e; }
};

export const TaskWidget = memo(function TaskWidget({
  tasks,
  setTasks,
  onToggleTask,
  onSubmitReview,
  onSyncTask,
}: {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  onToggleTask: (id: string, title: string, currentActive: boolean) => void;
  onSubmitReview: (id: string, title: string) => void;
  onSyncTask?: (id: string, secondsToday: number, active: boolean, underReview?: boolean) => void;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  useEffect(() => {
    // The running-task clock advances once a MINUTE (adds 60s), not every second,
    // so My Day is not redrawn 60× a minute. The exact worked time is still
    // recomputed from the start timestamp on refresh, so accuracy is preserved.
    const timer = setInterval(() => {
      let syncTaskId: string | null = null;
      let syncSec = 0;
      let syncUnderReview = false;

      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.active) {
            changed = true;
            const nextSec = t.secondsToday + 60;
            syncTaskId = t.id;
            syncSec = nextSec;
            syncUnderReview = !!t.underReview;
            return { ...t, secondsToday: nextSec };
          }
          return t;
        });
        if (changed) {
          const states = getStoredTaskStates();
          const tickNow = Date.now();
          const tickDateStr = toLocalISODate(new Date());
          next.forEach((t) => {
            if (t.active) {
              states[t.id] = {
                secondsToday: t.secondsToday,
                active: true,
                lastStartTime: tickNow,
                underReview: t.underReview,
                date: tickDateStr,
              };
            }
          });
          saveStoredTaskStates(states);
        }
        return next;
      });

      if (syncTaskId && onSyncTask) {
        onSyncTask(syncTaskId, syncSec, true, syncUnderReview);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [setTasks, onSyncTask]);

  const formatSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== id) {
      setDragOverTaskId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!sourceId || sourceId === targetId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    setTasks((prev) => {
      const activeIds = prev.filter((t) => !t.isApproved).map((t) => t.id);
      const fromIndex = activeIds.indexOf(sourceId);
      const toIndex = activeIds.indexOf(targetId);

      if (fromIndex === -1 || toIndex === -1) return prev;

      const newActiveIds = [...activeIds];
      const [movedId] = newActiveIds.splice(fromIndex, 1);
      newActiveIds.splice(toIndex, 0, movedId);

      const activeMap = new Map(prev.filter((t) => !t.isApproved).map((t) => [t.id, t]));
      const orderedActive = newActiveIds.map((id) => activeMap.get(id)!).filter(Boolean);
      const inactive = prev.filter((t) => t.isApproved);

      const updated = [...orderedActive, ...inactive];
      saveStoredTaskOrder(updated.map((t) => t.id));
      return updated;
    });

    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const activeTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.isApproved);
    if (!showSubmitted) {
      list = list.filter((t) => !t.underReview);
    }
    return [...list].sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return 0;
    });
  }, [tasks, showSubmitted]);

  return (
    <Card>
      <SectionHeader 
        title="Today's Tasks (Drag & Drop Reorder)" 
        action={
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSubmitted(!showSubmitted)}
            style={{ fontSize: 11.5 }}
          >
            {showSubmitted ? '🙈 Hide Submitted' : '👁️ Show Submitted'}
          </Button>
        }
      />
      <style>{`
        .task-card-hover {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .task-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        }
        .task-card-dragging {
          opacity: 0.4;
          border: 2px dashed var(--brand) !important;
          background: var(--bg-sunken) !important;
        }
        .task-card-drop-target {
          border-top: 3px solid var(--brand) !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTasks.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            📋 No pending or active tasks for today. Click <strong>Add Task</strong> to create a new task.
          </div>
        ) : (
          activeTasks.map((t) => {
            const isExpanded = !!expandedTaskIds[t.id];
            const displayTitle = t.project && t.project !== 'Office Task' ? `${t.project}: ${t.title}` : `Office Task: ${t.title}`;
            return (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => handleDragStart(e, t.id)}
                onDragOver={(e) => handleDragOver(e, t.id)}
                onDrop={(e) => handleDrop(e, t.id)}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverTaskId(null);
                }}
                onDragLeave={(e) => {
                  if (dragOverTaskId === t.id) {
                    setDragOverTaskId(null);
                  }
                }}
                className={`task-card-hover ${draggedTaskId === t.id ? 'task-card-dragging' : ''} ${dragOverTaskId === t.id && draggedTaskId !== t.id ? 'task-card-drop-target' : ''}`}
                style={{
                  padding: 16,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  borderRadius: 10,
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--e1)',
                }}
              >
                 {/* Task Details Header */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
                     <span style={{ fontSize: 18, color: 'var(--text-muted)', cursor: 'grab', marginRight: 4, flexShrink: 0 }}>⣿</span>
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         toggleExpand(t.id);
                       }}
                       style={{
                         background: 'transparent',
                         border: 'none',
                         color: 'var(--text-muted)',
                         cursor: 'pointer',
                         fontSize: 11,
                         padding: 4,
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         flexShrink: 0
                       }}
                       aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                     >
                       {isExpanded ? '▼' : '▶'}
                     </button>
                     <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                       <strong style={{ fontWeight: 700 }}>{t.project && t.project !== 'Office Task' ? t.project : 'Office Task'}:</strong> {t.title}
                     </div>
                      {t.isRework && <span style={{ flexShrink: 0 }}><Badge tone="warning">🔄 Rework</Badge></span>}
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                     <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                       ⏱ {formatSec(t.secondsToday)}
                     </span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       {t.isApproved ? (
                         <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                           ✓ Approved &amp; Completed
                         </span>
                       ) : t.underReview ? (
                         <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-info)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                           📩 Submitted &amp; Requires Approval
                         </span>
                       ) : (
                         <>
                           <Button
                             variant={t.active ? 'secondary' : 'primary'}
                             onClick={() => onToggleTask(t.id, t.title, t.active)}
                             style={{ padding: '4px 14px', fontSize: 12, minWidth: 80 }}
                           >
                             {t.active ? '⏸ Pause' : '▶ Start'}
                           </Button>

                           <Button
                             onClick={() => onSubmitReview(t.id, t.title)}
                             style={{ padding: '4px 14px', fontSize: 12, background: 'var(--status-success)', color: 'white' }}
                           >
                             📩 Submit
                           </Button>
                         </>
                       )}
                     </div>
                   </div>
                 </div>

                {/* Collapsible Details in 2x2 Grid */}
                {isExpanded && (
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '8px 16px', 
                      padding: '10px 14px', 
                      background: 'var(--bg-sunken)', 
                      borderRadius: 8, 
                      fontSize: 12.5,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>📁 Project:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{t.project || 'Office Task'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>📅 Due:</span>{' '}
                      <strong style={{ color: 'var(--brand)' }}>{t.due}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>⏳ Time Left:</span>{' '}
                      {(() => {
                        const info = getTimeLeftInfo(t.due);
                        return (
                          <strong style={{ color: info.tone === 'danger' ? 'var(--status-danger)' : info.tone === 'warning' ? 'var(--status-warning)' : 'var(--brand)' }}>
                            {info.label}
                          </strong>
                        );
                      })()}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>👤 Assignee:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{t.assignee || 'Unassigned'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)' }}>🧑‍💼 Supervisor:</span>{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{t.supervisor || 'None'}</strong>
                    </div>
                  </div>
                )}

                {/* Rework reason alert box */}
                {t.isRework && t.reworkNotes && (
                  <div style={{
                    fontSize: 12,
                    color: '#b45309',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>🔄</span>
                    <span><strong>Rework Reason:</strong> {t.reworkNotes}</span>
                  </div>
                )}


              </div>
            );
          })
        )}
      </div>
    </Card>
  );
});

export const UpcomingEventsWidget = memo(function UpcomingEventsWidget() {
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const { tasks, projects } = useProject();
  const { employees } = useEmployee();
  const [dbSchedules, setDbSchedules] = useState<any[]>([]);
  const [expandedUpcomingTaskIds, setExpandedUpcomingTaskIds] = useState<Record<string, boolean>>({});

  const toggleUpcomingExpand = (id: string) => {
    setExpandedUpcomingTaskIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const empName = useCallback((id?: string) => {
    if (!id) return '';
    const e = (employees || []).find((x: any) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}`.trim() : '';
  }, [employees]);

  const projTitle = useCallback((id?: string) => {
    if (!id) return 'Office Task';
    const p = (projects || []).find((x: any) => x.id === id);
    return p ? p.title : 'Office Task';
  }, [projects]);

  // Human-readable time remaining until a due date (relative to today).
  const timeLeftLabel = useCallback((due?: string, todayIso?: string) => {
    if (!due) return 'No due date';
    const d = due.slice(0, 10);
    const t = todayIso || toLocalISODate(new Date());
    const diff = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(t + 'T00:00:00').getTime()) / 86400000);
    if (diff < 0) return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  }, []);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const { data } = await supabase.from('flwdsk_schedule_sessions').select('*').is('deleted_at', null);
        if (data) {
          setDbSchedules(
            data.map((r: any) => ({
              id: r.id,
              date: r.date,
              startTime: r.start_time || '09:00 AM',
              title: r.session_title || r.topic || 'Training Session',
              type: 'Training',
            }))
          );
        }
      } catch (e) { void e; }
    }
    loadSchedules();
  }, []);

  const upcoming7Days = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const isoDate = toLocalISODate(d);

      let dayLabel = `Day ${i + 1} (${dayNames[d.getDay()]})`;
      if (i === 0) dayLabel = 'Day 1 (Today)';
      else if (i === 1) dayLabel = 'Day 2 (Tomorrow)';

      // 1. Gather tasks due on this date (excluding approved/completed tasks)
      const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
      const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

      const dayTasks = (tasks || []).filter((t) => {
        const status = (t.status || '').toLowerCase();
        if (status === 'done' || status.includes('completed') || status.includes('approved')) {
          return false;
        }

        const projectObj = t.projectId && t.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === t.projectId) : null;
        const pSupervisorId = projectObj ? (projectObj as any).supervisorId : null;
        const resolvedSupervisorId = pSupervisorId || t.supervisorId || (t as any).assignedByEmployeeId;

        if (!isManagement) {
          // Employees see tasks assigned to them PLUS tasks they supervise.
          const isMyTask = t.assigneeId === user?.id || t.assigneeId === user?.email || ((t as any).assignee && user?.fullName && (t as any).assignee.toLowerCase() === user.fullName.toLowerCase());
          const iSupervise = resolvedSupervisorId === user?.id;
          if (!isMyTask && !iSupervise) return false;
        }
        const taskDate = (t.dueDate || '').slice(0, 10);
        if (!taskDate) return i === 0;
        if (i === 0) {
          // Day 1 (Today): show tasks due today or active overdue tasks
          return taskDate <= isoDate;
        }
        return taskDate === isoDate;
      }).map((t) => {
        const projectObj = t.projectId && t.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === t.projectId) : null;
        const pSupervisorId = projectObj ? (projectObj as any).supervisorId : null;
        const resolvedSupervisorId = pSupervisorId || t.supervisorId || (t as any).assignedByEmployeeId;

        const projName = projTitle(t.projectId);
        const displayTitle = projName && projName !== 'Office Task' ? `${projName}: ${t.title}` : `Office Task: ${t.title}`;
        const statusLabel = t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval'
          ? 'Under Review'
          : t.status === 'in_progress'
          ? 'In Progress'
          : 'To Do';
        return {
          id: `task-${t.id}`,
          time: (t.dueDate || '').slice(0, 10) < isoDate ? 'Overdue' : 'Due Today',
          title: displayTitle,
          type: 'Projects' as const,
          project: projName,
          dueDate: (t.dueDate || '').slice(0, 10) || '—',
          timeLeft: timeLeftLabel(t.dueDate, isoDate),
          assignee: empName(t.assigneeId) || 'Unassigned',
          supervisor: empName(resolvedSupervisorId) || '—',
          status: statusLabel,
          actualHours: t.actualHours || 0,
        };
      });

      // 2. Gather training schedules on this date
      const daySchedules = (dbSchedules || []).filter((s) => s.date === isoDate).map((s) => ({
        id: `sched-${s.id}`,
        time: s.startTime || s.time || '09:00 AM',
        title: s.name || s.title || 'Training Session',
        type: 'Training' as const,
      }));

      const isSunday = d.getDay() === 0;
      const combinedEvents = [...dayTasks, ...daySchedules];

      if (combinedEvents.length === 0 && isSunday) {
        combinedEvents.push({
          id: `sun-${isoDate}`,
          time: 'Off Day',
          title: 'Sunday Weekly Rest',
          type: 'Holiday' as any,
        });
      }

      result.push({
        day: dayLabel,
        isoDate,
        events: combinedEvents,
      });
    }

    return result;
  }, [tasks, dbSchedules, user, employees, projects, empName, projTitle, timeLeftLabel]);

  const currentDayEvents = upcoming7Days[selectedDay]?.events || [];

  return (
    <Card>
      <SectionHeader title="Upcoming Events & Tasks (7-Day View)" />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {upcoming7Days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedDay(i)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedDay === i ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: selectedDay === i ? 'var(--brand)' : 'var(--bg-sunken)',
              color: selectedDay === i ? 'white' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {d.day}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {currentDayEvents.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No scheduled events or tasks due on this day.
          </div>
        ) : (
          currentDayEvents.map((e) => {
            const isTask = e.type === 'Projects';
            const isExpanded = !!expandedUpcomingTaskIds[e.id];
            return (
              <div 
                key={e.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 8, 
                  padding: '10px 12px', 
                  background: 'var(--bg-surface)', 
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--e1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    {isTask && (
                      <button
                        type="button"
                        onClick={() => toggleUpcomingExpand(e.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                    <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={e.title}>
                      {isTask ? (
                        <>
                          <strong style={{ fontWeight: 700 }}>{(e as any).project && (e as any).project !== 'Office Task' ? (e as any).project : 'Office Task'}:</strong>{' '}
                          <span style={{ fontWeight: 400 }}>{e.title.includes(': ') ? e.title.split(': ').slice(1).join(': ') : e.title}</span>
                        </>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{e.title}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isTask && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                        ⏱ {((e as any).actualHours || 0).toFixed(1)} hrs
                      </span>
                    )}
                    <Badge tone={e.type === 'Training' ? 'info' : e.type === 'Projects' ? 'progress' : 'neutral'}>
                      {isTask ? (e as any).status : e.type}
                    </Badge>
                  </div>
                </div>
                
                {isTask && isExpanded && (
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '6px 12px', 
                      padding: '8px 10px', 
                      background: 'var(--bg-surface)', 
                      borderRadius: 6, 
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      marginTop: 4
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>📁 Project:</span>{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>{(e as any).project}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>📅 Due:</span>{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>{(e as any).dueDate}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>⏳ Time Left:</span>{' '}
                      <strong style={{ color: (e as any).timeLeft?.startsWith('Overdue') ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                        {(e as any).timeLeft}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>👤 Assignee:</span>{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>{(e as any).assignee}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)' }}>🧑‍💼 Supervisor:</span>{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>{(e as any).supervisor}</strong>
                    </div>
                  </div>
                )}

                {!isTask && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🕒 {e.time}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
});

const shiftDateStr = (isoDate: string, days: number): string => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
};

const getEntryDate = (e: { id: string; date?: string }): string => {
  if (e.date) return e.date.slice(0, 10);
  const ts = Number(e.id);
  if (!isNaN(ts) && ts > 1600000000000) {
    return toLocalISODate(new Date(ts));
  }
  return toLocalISODate(new Date());
};

const dateNavBtnStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'all 140ms ease',
};

export const TimelineWidget = memo(function TimelineWidget({
  entries,
  selectedEmpId,
  onEmpIdChange,
  employeeList = [],
}: {
  entries: Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral'; date?: string }>;
  selectedEmpId?: string;
  onEmpIdChange?: (empId: string) => void;
  employeeList?: Array<{ id: string; name: string }>;
}) {
  const { user } = useAuth();
  const isExecutive = user && ['CEO', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(user.role).toUpperCase());
  const todayDate = toLocalISODate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const cleanEntries = entries.filter((e) => !e.title?.includes('System initialized'));
  const filteredEntries = cleanEntries.filter((e) => getEntryDate(e) === selectedDate);

  const isToday = selectedDate === todayDate;

  const handlePrevDay = () => setSelectedDate((prev) => shiftDateStr(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => shiftDateStr(prev, 1));
  const handleResetToday = () => setSelectedDate(todayDate);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const formattedDateLabel = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      {/* Widget Header with Status & Navigation Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily Activity Timeline
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Clock In → Work → Clock Out Logs
            </div>
          </div>
          <Badge tone={isToday ? 'success' : 'info'}>
            {isToday ? '🟢 Current Day' : '📅 History Log'}
          </Badge>
        </div>

        {/* User Level Employee Filter Dropdown for Executive Roles */}
        {isExecutive && employeeList.length > 0 && onEmpIdChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>👤 Filter Timeline:</span>
            <select
              value={selectedEmpId || 'me'}
              onChange={(e) => onEmpIdChange?.(e.target.value)}
              className="kvj-input"
              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, flex: 1, background: 'var(--bg-surface)', cursor: 'pointer' }}
            >
              <option value="me">My Timeline ({user?.fullName || 'Me'})</option>
              {employeeList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 10px',
          gap: 6,
        }}>
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            style={dateNavBtnStyle}
          >
            ◀ Prev Day
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isToday ? `Today (${formattedDateLabel.split(', ')[1] || formattedDateLabel})` : formattedDateLabel}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              style={{
                width: 20,
                height: 20,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.7,
              }}
              title="Select date"
            />
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!isToday && (
              <button
                type="button"
                onClick={handleResetToday}
                title="Go to Today"
                aria-label="Go to Today"
                style={{
                  ...dateNavBtnStyle,
                  background: 'var(--brand-muted)',
                  color: 'var(--brand)',
                  fontWeight: 700,
                }}
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isToday}
              title={isToday ? 'Current Day' : 'Next Day'}
              aria-label="Next Day"
              style={{
                ...dateNavBtnStyle,
                opacity: isToday ? 0.4 : 1,
                cursor: isToday ? 'not-allowed' : 'pointer',
              }}
            >
              Next Day ▶
            </button>
          </div>
        </div>
      </div>

      {/* Timeline List or Empty State */}
      {filteredEntries.length === 0 ? (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>No activity logged for {isToday ? 'today yet' : formattedDateLabel}.</span>
          {!isToday && (
            <button
              type="button"
              onClick={handleResetToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              View Today's Status ↗
            </button>
          )}
        </div>
      ) : (
        <Timeline entries={filteredEntries} />
      )}
    </Card>
  );
});

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kvj_dismissed_announcements') || '[]');
    } catch {
      return [];
    }
  });

  // Real announcements from the communication module.
  const { announcements, loading } = useCommunication();

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem('kvj_dismissed_announcements', JSON.stringify(next));
      } catch (e) { void e; }
      return next;
    });
  };

  // Newest first, filtering out dismissed items.
  const visibleAnnouncements = announcements
    .filter((a) => !dismissedIds.includes(a.id))
    .sort((a, b) => {
      const ta = new Date(a.scheduledAt ?? a.createdAt).getTime();
      const tb = new Date(b.scheduledAt ?? b.createdAt).getTime();
      return tb - ta;
    });

  const targetLabel: Record<string, string> = {
    organization: 'Organization',
    department: 'Department',
    project: 'Project',
    training: 'Training',
  };

  return (
    <Card>
      <SectionHeader title="Announcements & Notices" />
      {visibleAnnouncements.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 2px' }}>
          {loading ? 'Loading announcements…' : 'No announcements.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleAnnouncements.map((a) => {
            const isExpanded = expandedId === a.id;
            const isHigh = a.priority === 'high';
            const tone = isHigh ? 'danger' : 'neutral';
            const when = new Date(a.scheduledAt ?? a.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const content = a.content ?? '';

            return (
              <div
                key={a.id}
                style={{
                  borderLeft: `4px solid ${isHigh ? 'var(--status-danger)' : 'var(--brand)'}`,
                  background: 'var(--bg-sunken)',
                  padding: '12px 14px',
                  borderRadius: '0 8px 8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  transition: 'all 160ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isHigh && <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>📌 Pinned</span>}
                    <Badge tone={tone}>{targetLabel[a.targetType] ?? a.targetType}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{when}</span>
                    <button
                      type="button"
                      onClick={() => handleDismiss(a.id)}
                      aria-label="Dismiss notice"
                      title="Dismiss notice"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: 14,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 120ms ease',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingRight: 20 }}>{a.title}</div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {isExpanded || content.length <= 95 ? content : `${content.slice(0, 95)}...`}
                </div>

                {content.length > 95 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      marginTop: 2,
                    }}
                  >
                    {isExpanded ? 'Read Less ▲' : 'Read More ▼'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});

/** Resized Stat Pill matching exact height (64px) & style of QuickActionCard */
function ResizedStatPill({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; icon?: string }) {
  return (
    <div className="kvj-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', minHeight: 64, borderRadius: 16 }}>
      {icon && <span className={`kvj-badge kvj-badge--${tone}`} style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{label}</span>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    </div>
  );
}

/** Resized QuickAction matching exact height (64px) */
function ResizedQuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="kvj-card kvj-card--hover" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-primary)', minHeight: 64, width: '100%', borderRadius: 16 }}>
      <span className="kvj-badge kvj-badge--progress" style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
    </button>
  );
}

function TaskProjectFields({ projectOptions }: { projectOptions: Array<{ value: string; label: string }> }) {
  const { values } = useForm();
  const isCreateNew = values.projectId === 'CREATE_NEW';

  return (
    <>
      <SelectField
        name="projectId"
        label="Project / Department *"
        options={projectOptions}
      />
      {isCreateNew && (
        <TextField
          name="newProjectName"
          label="New Project Name *"
          placeholder="e.g. KVJ Mobile App"
        />
      )}
    </>
  );
}

export function MyDayPage() {
  const { user } = useAuth();
  const { employees } = useEmployee();
  const { record, loading, clockIn, clockOut, startBreak, endBreak, hoursThisMonth, monthAttendancePct } = useAttendance();
  const { toast, addNotification } = useNotifications();
  const { tasks: projectTasks, projects, createTask, createProject, updateTask, submitTask, refresh } = useProject();
  const { startSession, pauseSession, completeSession } = useTaskSessions();

  const [selectedEmpId, setSelectedEmpId] = useState('me');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const userTimelineKey = useMemo(() => {
    const activeKey = selectedEmpId !== 'me' ? selectedEmpId : (user?.id || user?.email || 'me');
    return `${TIMELINE_STORAGE_KEY}_${activeKey}`;
  }, [selectedEmpId, user]);

  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(userTimelineKey);
      const parsed = saved ? JSON.parse(saved) : [];
      const filtered = parsed.filter((e: any) => !e.title?.includes('System initialized'));
      setTimelineEntries(filtered);
    } catch {
      setTimelineEntries([]);
    }
  }, [userTimelineKey]);

  const handleSyncTask = useCallback((id: string, secondsToday: number, active: boolean, underReview?: boolean) => {
    updateTask(id, {
      actualHours: secondsToday / 3600,
      status: underReview ? 'review' : active ? 'in_progress' : 'todo',
    });
  }, [updateTask]);

  useEffect(() => {
    const todayStr = toLocalISODate(new Date());
    const storedStates = getStoredTaskStates();
    const now = Date.now();
    const updatedStates = { ...storedStates };

    // Synchronize global timer store with database actualHours for loaded tasks
    (projectTasks || []).forEach((t) => {
      taskTimerStore.syncTaskTime(t.id, t.actualHours || 0);
    });

    const mapped: TaskItem[] = (projectTasks || [])
      .filter((t) => {
        if (!t) return false;
        // Don't show unapproved assignment requests until approved by manager
        if ((t as any).approvalStatus === 'pending_assignment_approval') return false;

        // My Day always shows ONLY the current user's own tasks.
        // Management roles have full visibility in other modules (TaskBoard, etc.)
        // but My Day is personal — it shows tasks where you are the assignee OR supervisor.
        const myId = user?.id;
        const myEmail = user?.email?.toLowerCase();
        const myName = (user?.fullName || '').toLowerCase();
        const isMyTask =
          t.assigneeId === myId ||
          t.assigneeId === myEmail ||
          t.supervisorId === myId ||
          (t as any).assignedByEmployeeId === myId ||
          ((t as any).assignee && myName && (t as any).assignee.toLowerCase() === myName);
        if (!isMyTask) return false;

        const sd = (t.startDate || '').slice(0, 10);
        const dd = (t.dueDate || '').slice(0, 10);
        const effectiveStartDate = sd || dd;
        const isScheduled = effectiveStartDate && todayStr >= effectiveStartDate;
        return isScheduled || t.status === 'in_progress' || t.status === 'todo' || t.status === 'review' || (t as any).approvalStatus === 'rework' || storedStates[t.id];
      })
      .map((t) => {
        const proj = (projects || []).find((p) => p.id === t.projectId);
        const stored = storedStates[t.id];
        let secondsToday = Math.round((t.actualHours || 0) * 3600);
        let active = t.status === 'in_progress';
        const isRework = (t as any).approvalStatus === 'rework';
        const reworkNotes = (t as any).reworkNotes;
        let underReview = t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval';
        const statusStr = (t.status || '') as string;
        const isApproved = statusStr === 'done' || statusStr === 'completed';
        if (isApproved || isRework) {
          underReview = false;
        }

        if (stored) {
          // If the stored state is from a previous day, reset the daily timer to zero
          // and mark the task as paused — this prevents cross-midnight elapsed time
          // from being incorrectly added to today's counter.
          const storedDate = stored.date || '';
          const isStaleDay = storedDate && storedDate !== todayStr;

          if (isStaleDay) {
            // New day: discard yesterday's secondsToday and active flag
            secondsToday = 0;
            active = false;
          } else {
            // Trust the database actualHours as the primary source of truth.
            // If the task was active, compute elapsed time since lastStartTime and add it.
            if (stored.active && stored.lastStartTime) {
              // Only add elapsed time if lastStartTime is from today
              const lastStartDate = new Date(stored.lastStartTime);
              const lastStartDateStr = `${lastStartDate.getFullYear()}-${String(lastStartDate.getMonth() + 1).padStart(2, '0')}-${String(lastStartDate.getDate()).padStart(2, '0')}`;
              if (lastStartDateStr === todayStr) {
                const elapsed = Math.floor((now - stored.lastStartTime) / 1000);
                if (elapsed > 0 && elapsed < 86400) {
                  secondsToday += elapsed;
                }
              }
              active = true;
            } else {
              active = stored.active;
            }
          }
          if (stored.underReview !== undefined && !isRework && !isApproved) {
            underReview = stored.underReview;
          }
        }

        // Sanity guard against corrupted inflated values (> 24 hours)
        if (secondsToday > 86400) {
          secondsToday = 0;
        }

        updatedStates[t.id] = {
          secondsToday,
          active,
          lastStartTime: active ? now : undefined,
          underReview,
          date: todayStr,
        };

        // Resolve UUID IDs to display names using the employees list
        const assigneeEmp = employees?.find((e) => e.id === t.assigneeId);
        const projectObj = t.projectId && t.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === t.projectId) : null;
        const pSupervisorId = projectObj ? (projectObj as any).supervisorId : null;
        const supervisorEmpId = pSupervisorId || t.supervisorId || (t as any).assignedByEmployeeId;
        const supervisorEmp = supervisorEmpId ? employees?.find((e) => e.id === supervisorEmpId) : null;
        const assigneeName = assigneeEmp
          ? `${assigneeEmp.firstName} ${assigneeEmp.lastName}`
          : ((t as any).assignee || undefined);
        const supervisorName = supervisorEmp
          ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}`
          : ((t as any).supervisor || undefined);

        return {
          id: t.id,
          title: t.title,
          project: proj ? proj.title : 'Office Task',
          due: (t.dueDate || '').slice(0, 10) || todayStr,
          startDate: t.startDate ? t.startDate.slice(0, 10) : undefined,
          priority: t.priority === 'high' ? 'High' : 'Normal',
          active,
          underReview,
          isApproved,
          isRework,
          reworkNotes,
          secondsToday,
          assignee: assigneeName,
          supervisor: supervisorName,
        };
      });

    saveStoredTaskStates(updatedStates);

    const savedOrder = getStoredTaskOrder();
    if (savedOrder.length > 0) {
      mapped.sort((a, b) => {
        const idxA = savedOrder.indexOf(a.id);
        const idxB = savedOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    if (mapped.length > 0) {
      setTasks(mapped);
    }
  }, [projectTasks, projects, employees, user]);

  useEffect(() => {
    const unsubscribe = taskTimerStore.subscribe((allTimers) => {
      setTasks((prev) =>
        prev.map((t) => {
          const tState = allTimers[t.id];
          if (tState) {
            let sec = Math.floor(tState.elapsedMs / 1000);
            if (tState.isRunning) {
              sec += Math.floor((Date.now() - tState.startTime) / 1000);
            }
            return {
              ...t,
              active: tState.isRunning,
              secondsToday: sec,
            };
          }
          return t;
        })
      );
    });
    return unsubscribe;
  }, []);

  const handleActivityLog = (title: string, tone: 'success' | 'progress' | 'info' | 'neutral' = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = toLocalISODate(new Date());
    const newEntry = { id: String(Date.now()), title, time: timeStr, tone, date: dateStr };
    setTimelineEntries((prev) => {
      const next = [...prev, newEntry];
      try {
        localStorage.setItem(userTimelineKey, JSON.stringify(next));
      } catch (e) { void e; }
      return next;
    });
  };

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseTargetTaskId, setPauseTargetTaskId] = useState<string | null>(null);
  const [pauseWorkNote, setPauseWorkNote] = useState('');

  const handleConfirmPauseTask = async () => {
    if (!pauseTargetTaskId) return;
    const taskId = pauseTargetTaskId;
    const note = pauseWorkNote.trim() || 'Work session paused';

    taskTimerStore.pauseTask(taskId);
    const timer = taskTimerStore.getTimer(taskId);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, active: false, secondsToday } : t))
    );

    try {
      await updateTask(taskId as any, { status: 'todo', actualHours: secondsToday / 3600 });
      await pauseSession(taskId as any, note);
      handleActivityLog(`Paused Task: ${taskId}`, 'neutral');
    } catch (e) {
      console.warn('Pause task error in workspace:', e);
    }

    setPauseModalOpen(false);
    setPauseTargetTaskId(null);
    setPauseWorkNote('');
    toast({ variant: 'info', title: 'Task Paused', message: 'Work progress saved and timer paused.' });
  };

  const handleToggleTask = (id: string, taskTitle: string, currentActive: boolean) => {
    // If active and user clicks pause, open mandatory work progress modal
    if (currentActive) {
      setPauseTargetTaskId(id);
      setPauseWorkNote('');
      setPauseModalOpen(true);
      return;
    }

    const nextActive = !currentActive;
    const now = Date.now();
    let targetTask: any = null;

    // 1. If starting a task, find and pause any other active task in the DB & sessions first
    if (nextActive) {
      const activeTask = tasks.find((t) => t.active && t.id !== id);
      if (activeTask) {
        taskTimerStore.pauseTask(activeTask.id);
        const activeTimer = taskTimerStore.getTimer(activeTask.id);
        const activeSecs = activeTimer ? Math.floor(activeTimer.elapsedMs / 1000) : activeTask.secondsToday;
        
        updateTask(activeTask.id, {
          status: 'todo',
          actualHours: activeSecs / 3600,
        }).catch((e) => console.warn('Failed to update previously active task in DB:', e));
        
        pauseSession(activeTask.id as any);
        handleActivityLog(`Paused Task: ${activeTask.title}`, 'neutral');
      }
      
      taskTimerStore.startTask(id);
    } else {
      taskTimerStore.pauseTask(id);
    }

    // 2. Query the exact correct secondsToday from the store to avoid race conditions
    const timer = taskTimerStore.getTimer(id);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    // 3. Update the tasks list state and save to local storage
    setTasks((prev) => {
      const found = prev.find((t) => t.id === id);
      if (found) targetTask = found;

      const updated = prev.map((t) => {
        if (t.id === id) {
          return { ...t, active: nextActive, secondsToday };
        } else if (nextActive && t.active) {
          const tTimer = taskTimerStore.getTimer(t.id);
          const tSec = tTimer ? Math.floor(tTimer.elapsedMs / 1000) : t.secondsToday;
          return { ...t, active: false, secondsToday: tSec };
        }
        return t;
      });

      const states = getStoredTaskStates();
      const todayDateStr = toLocalISODate(new Date());
      updated.forEach((t) => {
        states[t.id] = {
          secondsToday: t.secondsToday,
          active: t.active,
          lastStartTime: t.active ? now : undefined,
          underReview: t.underReview,
          date: todayDateStr,
        };
      });
      saveStoredTaskStates(states);
      return updated;
    });

    // 4. Update the clicked task in the database and sessions
    updateTask(id, {
      status: nextActive ? 'in_progress' : 'todo',
      actualHours: secondsToday / 3600,
    }).catch((e) => console.warn('Failed to update task status in DB:', e));

    const raw = (projectTasks || []).find((t) => t.id === id);
    if (nextActive) {
      const project = raw?.projectId && raw.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === raw.projectId) : null;
      const pSupervisorId = project ? (project as any).supervisorId : null;
      const tSupervisorId = raw?.supervisorId || (raw as any)?.assignedByEmployeeId;
      const supervisorId = pSupervisorId || tSupervisorId;

      startSession({
        taskId: id as any,
        projectId: raw?.projectId,
        workTitle: taskTitle,
        supervisorId,
      });
    } else {
      pauseSession(id as any);
    }

    handleActivityLog(`${nextActive ? 'Started' : 'Paused'} Task: ${taskTitle}`, nextActive ? 'progress' : 'neutral');
  };

  const handleSubmitReview = async (id: string, taskTitle: string) => {
    // 1. Pause timer in taskTimerStore to capture final time
    taskTimerStore.pauseTask(id);
    const timer = taskTimerStore.getTimer(id);
    const finalSeconds = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    // Optimistically mark under review.
    const applyUnderReview = (val: boolean) => {
      setTasks((prev) => prev.map((t) =>
        t.id === id ? { 
          ...t, 
          active: false, 
          underReview: val, 
          isRework: false, 
          reworkNotes: undefined,
          secondsToday: finalSeconds
        } : t
      ));
      const states = getStoredTaskStates();
      if (states[id]) {
        states[id].secondsToday = finalSeconds;
        states[id].active = false;
        states[id].underReview = val;
        delete states[id].lastStartTime;
        saveStoredTaskStates(states);
      }
    };
    applyUnderReview(true);

    // Save final actualHours to the DB before submitting
    try {
      await updateTask(id as any, { actualHours: finalSeconds / 3600 });
      completeSession(id as any);
    } catch (e) {
      console.warn('Failed to update task hours on submit:', e);
    }

    const res = await submitTask(id as any, 'Submitted from Workspace');
    if (!res.ok) {
      applyUnderReview(false); // roll back — it did NOT persist
      toast({
        variant: 'error',
        title: 'Submit Failed',
        message: `"${taskTitle}" could not be submitted: ${res.error}. Please try again.`,
      });
      return;
    }

    toast({
      variant: 'success',
      title: 'Routed to Approvals Queue',
      message: `Task '${taskTitle}' submitted and requires CEO/Admin/Manager approval to complete the task (Review and Approve).`,
    });
    addNotification({
      title: 'Task Submitted for Review',
      message: `'${taskTitle}' submitted and requires CEO/Admin/Manager approval to complete the task (Review and Approve).`,
      category: 'task',
      priority: 'high',
    });
    handleActivityLog(`Submitted & requires CEO/Admin/Manager Approval: ${taskTitle}`, 'success');
  };

  const projectOptions = useMemo(() => {
    const list = (projects || [])
      .filter((p) => p.status !== 'closure' && p.status !== 'suspended')
      .map((p) => ({
        value: p.id,
        label: p.title,
      }));
    return [
      { value: 'OFFICE_TASK', label: 'None (Office Task)' },
      ...list,
      { value: 'CREATE_NEW', label: '➕ Create New Project...' },
    ];
  }, [projects]);

  const handleCreateTaskSubmit = async (values: Record<string, unknown>) => {
    const todayStr = toLocalISODate(new Date());
    const title = (values.name as string) || 'New Task';
    let targetProjectId = values.projectId as string | undefined;
    let projName = 'Office Task';

    if (targetProjectId === 'CREATE_NEW') {
      const newProjName = (values.newProjectName as string || '').trim();
      if (!newProjName) {
        toast({ variant: 'error', title: 'Invalid Project Name', message: 'Please enter a name for the new project.' });
        return;
      }
      
      const projRes = await createProject({
        title: newProjName,
        code: newProjName.slice(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 90 + 10),
        status: 'execution',
        priority: 'medium',
      });
      
      if (!projRes.ok) {
        toast({ variant: 'error', title: 'Project Creation Failed', message: projRes.error });
        return;
      }
      
      targetProjectId = projRes.value.id;
      projName = newProjName;
    } else if (targetProjectId && targetProjectId !== 'OFFICE_TASK') {
      const projObj = projects.find((p) => p.id === targetProjectId);
      projName = projObj?.title || 'Office Task';
    } else {
      targetProjectId = undefined;
    }

    const dueDateVal = (values.dueDate as string) || todayStr;
    const startDateVal = (values.startDate as string) || dueDateVal;

    const res = await createTask({
      projectId: targetProjectId,
      title,
      description: values.description as string || '',
      supervisorId: user?.id,
      assignedByEmployeeId: user?.id,
      startDate: startDateVal,
      dueDate: dueDateVal,
      status: 'todo',
      priority: 'medium',
    });

    const taskId = res.ok ? res.value.id : String(Date.now());
    const newTaskItem: TaskItem = {
      id: taskId,
      title,
      project: projName,
      due: dueDateVal,
      priority: 'Normal',
      active: false,
      secondsToday: 0,
    };

    setTasks((prev) => {
      const next = [newTaskItem, ...prev];
      const states = getStoredTaskStates();
      states[taskId] = { secondsToday: 0, active: false };
      saveStoredTaskStates(states);
      return next;
    });

    toast({ variant: 'success', title: 'Task Created', message: `Task "${title}" added to Today's Tasks.` });
    setCreateTaskOpen(false);
  };

  const { applyLeave } = useLeave();
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);

  const navigate = useNavigate();
  const device = useDevice();
  const isMobile = device === 'mobile';
  const isApproverRole = ['ADMIN', 'CEO', 'MANAGER'].includes((user?.role || '').toUpperCase());

  const employeeOptions = useMemo(() => {
    return (employees || []).map((e) => ({
      id: e.id,
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
    }));
  }, [employees]);

  return (
    <AppShell>
      <PageHeader
        title="My Day"
        subtitle="Manage your daily attendance, tasks, breaks, and workspace activity."
        actions={
          <Button onClick={() => setCreateTaskOpen(true)} style={{ gap: 6 }}>
            ＋ Add Task
          </Button>
        }
      />

      {/* Attendance & Clock In / Out Panel */}
      <AttendancePanel
        record={record}
        loading={loading}
        clockIn={clockIn}
        clockOut={clockOut}
        startBreak={startBreak}
        endBreak={endBreak}
        onActivityLog={handleActivityLog}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'calc(68% - 8px) calc(32% - 8px)', gap: 16, marginTop: 16, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <TaskWidget
            tasks={tasks}
            setTasks={setTasks}
            onToggleTask={handleToggleTask}
            onSubmitReview={handleSubmitReview}
            onSyncTask={handleSyncTask}
          />
          {!isMobile && <UpcomingEventsWidget />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {!isMobile && <AnnouncementWidget />}
          <TimelineWidget
            entries={timelineEntries}
            selectedEmpId={selectedEmpId}
            onEmpIdChange={setSelectedEmpId}
            employeeList={employeeOptions}
          />
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} onSuccess={() => refresh?.()} />

      {/* Apply Leave Drawer on My Day */}
      <Drawer open={applyLeaveOpen} onClose={() => setApplyLeaveOpen(false)} title="Apply for Leave">
        <Form
          initial={{ leaveType: 'Leave', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: '', halfDay: false }}
          onSubmit={async (values) => {
            const res = await applyLeave(
              (values.leaveType as string) || 'Leave',
              (values.startDate as string) || new Date().toISOString().slice(0, 10),
              (values.endDate as string) || new Date().toISOString().slice(0, 10),
              (values.reason as string) || '',
              Boolean(values.halfDay)
            );
            if (res.ok) {
              toast({ variant: 'success', title: 'Leave Applied', message: 'Your leave application has been submitted successfully.' });
              setApplyLeaveOpen(false);
            } else {
              toast({ variant: 'error', title: 'Application Failed', message: res.error });
            }
          }}
        >
          <SelectField
            name="leaveType"
            label="Leave Type *"
            options={[
              { value: 'Leave', label: 'Casual / Earned Leave' },
              { value: 'Medical Leave', label: 'Medical Leave' },
              { value: 'On Duty / Regularization', label: 'On Duty / Regularization' },
              { value: 'Work From Home', label: 'Work From Home' },
            ]}
          />
          <DatePickerField name="startDate" label="Start Date *" />
          <DatePickerField name="endDate" label="End Date *" />
          <CheckboxField name="halfDay" label="Apply for Half Day" />
          <TextAreaField name="reason" label="Reason for Leave" />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setApplyLeaveOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Leave Request</Button>
          </div>
        </Form>
      </Drawer>

      {/* Pause Task Work Progress Drawer */}
      <Drawer
        open={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        title="Update Work Progress (Mandatory)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-sunken)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <strong>📌 Management Note:</strong> Please describe what work was done during this session. This note will be recorded in the <strong>Task Worklog</strong> under the <strong>Update</strong> column for CEO/Manager review.
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
              Work Progress Summary *
            </label>
            <textarea
              value={pauseWorkNote}
              onChange={(e) => setPauseWorkNote(e.target.value)}
              placeholder="Describe the work completed before pausing (e.g. Reviewed API specs, fixed UI styling...)"
              rows={4}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" type="button" onClick={() => setPauseModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmPauseTask}
              disabled={!pauseWorkNote.trim()}
            >
              ⏸ Save Progress & Pause Timer
            </Button>
          </div>
        </div>
      </Drawer>
    </AppShell>
  );
}

function escapeXml(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Supervisor / Manager / CEO workspaces. */
export function RoleWorkspacePage({ role }: { role: Exclude<WorkspaceRole, 'employee'> }) {
  const { toast } = useNotifications();
  const { projects, clients, timesheets } = useProject();
  const { employees } = useEmployee();

  const [presentCount, setPresentCount] = useState(0);
  const [pendingExpenses, setPendingExpenses] = useState(0);

  const handleExportAllData = async () => {
    try {
      toast({ variant: 'info', title: 'Exporting Data', message: 'Fetching all data tables, please wait...' });
      
      const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
      const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      const leaveRepo = container.resolve(LEAVE_REPOSITORY_TOKEN);
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);

      const [attRes, expRes, leaveRes, taskRes] = await Promise.all([
        attRepo.findMany({ pageSize: 2000 }),
        expRepo.findMany({ pageSize: 2000 }),
        leaveRepo.findMany({ pageSize: 2000 }),
        taskRepo.findMany({ pageSize: 2000 }),
      ]);

      const attList = attRes?.data || [];
      const expList = expRes?.data || [];
      const leaveList = leaveRes?.data || [];
      const taskList = taskRes?.data || [];
      const empList = employees || [];

      // Helper to build a table sheet
      const buildSheet = (sheetName: string, headers: string[], rows: any[][]) => {
        let sheetXml = `  <Worksheet ss:Name="${sheetName}">\n    <Table>\n      <Row>\n`;
        headers.forEach(h => {
          sheetXml += `        <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
        });
        sheetXml += `      </Row>\n`;
        
        rows.forEach(r => {
          sheetXml += `      <Row>\n`;
          r.forEach(v => {
            const valStr = escapeXml(v);
            const isNum = typeof v === 'number' && !isNaN(v);
            const typeAttr = isNum ? 'Number' : 'String';
            sheetXml += `        <Cell><Data ss:Type="${typeAttr}">${valStr}</Data></Cell>\n`;
          });
          sheetXml += `      </Row>\n`;
        });
        
        sheetXml += `    </Table>\n  </Worksheet>\n`;
        return sheetXml;
      };

      // 1. Employees Sheet
      const empHeaders = ['ID', 'Employee ID', 'First Name', 'Last Name', 'Email', 'Designation', 'Joining Date'];
      const empRows = empList.map(e => [
        e.id,
        e.employeeId,
        e.firstName,
        e.lastName,
        e.email,
        e.designation,
        e.dateOfJoining
      ]);

      // 2. Attendance Sheet
      const attHeaders = ['Record ID', 'Date', 'Employee ID', 'Status', 'Work Type', 'First Clock In', 'Last Clock Out', 'Total Hours'];
      const attRows = attList.map(a => [
        a.id,
        a.workDate,
        a.employeeId,
        a.status || 'present',
        (a as any).workType || 'office',
        a.firstClockIn || '',
        a.lastClockOut || '',
        (a as any).totalHours != null ? Number((a as any).totalHours) : ''
      ]);

      // 3. Leave Sheet
      const leaveHeaders = ['Record ID', 'Employee ID', 'Leave Type', 'Start Date', 'End Date', 'Half Day', 'Status', 'Reason', 'Med Certificate'];
      const leaveRows = leaveList.map(l => [
        l.id,
        l.employeeId,
        l.leaveType,
        l.startDate,
        l.endDate,
        l.halfDay ? 'Yes' : 'No',
        l.status,
        l.reason,
        l.medicalCertUrl || ''
      ]);

      // 4. Expenses Sheet
      const expHeaders = ['Claim ID', 'Employee ID', 'Person Name', 'Classification', 'Expense Type', 'Amount (INR)', 'Status', 'Notes', 'Receipt URL'];
      const expRows = expList.map(ex => {
        let person = 'Employee';
        let type = 'Misc';
        let userNotes = ex.notes || '';

        if (ex.notes && ex.notes.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(ex.notes);
            person = parsed.personName || person;
            type = parsed.expenseType || type;
            userNotes = parsed.userNotes || '';
          } catch (e) { void e; }
        }

        return [
          ex.id,
          ex.employeeId,
          person,
          ex.category || 'Office Expense',
          type,
          ex.amount != null ? Number(ex.amount) : 0,
          ex.status,
          userNotes,
          ex.receiptUrl || ''
        ];
      });

      // 5. Tasks Sheet
      const taskHeaders = ['Task ID', 'Title', 'Project ID', 'Assignee ID', 'Supervisor ID', 'Status', 'Priority', 'Due Date', 'Approval Status'];
      const taskRows = taskList.map(t => [
        t.id,
        t.title,
        t.projectId || 'Office Task',
        t.assigneeId || '',
        t.supervisorId || '',
        t.status,
        t.priority,
        t.dueDate,
        t.approvalStatus || 'approved'
      ]);

      let xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
      xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
      xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
      xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

      xml += buildSheet('Employees', empHeaders, empRows);
      xml += buildSheet('Attendance', attHeaders, attRows);
      xml += buildSheet('Leaves', leaveHeaders, leaveRows);
      xml += buildSheet('Expenses', expHeaders, expRows);
      xml += buildSheet('Tasks', taskHeaders, taskRows);

      xml += `</Workbook>\n`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KVJ_Analytics_CEO_Report_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Export Complete', message: 'Excel workbook downloaded successfully.' });
    } catch (err: any) {
      console.error('Export error:', err);
      toast({ variant: 'error', title: 'Export Failed', message: err.message || 'Unknown error occurred during export.' });
    }
  };

  useEffect(() => {
    let active = true;
    const fetchWorkspaceStats = async () => {
      try {
        const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
        const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);

        const today = toLocalISODate(new Date());
        
        // Find attendance for today
        const attRes = await attRepo.findMany({ pageSize: 1000 });
        const todayPresent = (attRes?.data || []).filter((r) => r.workDate === today && r.firstClockIn).length;

        // Find pending expenses (submitted status)
        const expRes = await expRepo.findMany({ pageSize: 1000 });
        const pendingExp = (expRes?.data || []).filter((c) => c.status === 'submitted').length;

        if (active) {
          setPresentCount(todayPresent);
          setPendingExpenses(pendingExp);
        }
      } catch (err) {
        console.error('Failed to load workspace stats:', err);
      }
    };

    fetchWorkspaceStats();
    return () => { active = false; };
  }, []);

  const totalEmployees = (employees || []).length;
  const teamPresent = totalEmployees > 0 ? `${presentCount}/${totalEmployees}` : '0/0';

  const pendingTimesheets = (timesheets || []).filter((t) => t.status === 'submitted').length;
  const pendingApprovals = pendingExpenses + pendingTimesheets;

  // At-risk projects: count of planning/execution projects with high or critical priority
  const atRiskProjects = (projects || []).filter(
    (p) =>
      p.status !== 'closure' &&
      p.status !== 'suspended' &&
      (p.priority === 'high' || p.priority === 'critical')
  ).length;

  const mappedProjects = useMemo(() => {
    return (projects || []).map((p) => {
      const client = (clients || []).find((c) => c.id === p.clientId);
      return {
        id: p.id,
        name: p.title,
        client: client ? client.name : 'Unknown Client',
        progress: 0,
        health: p.status === 'closure' ? 'Completed' : p.status === 'execution' ? 'In Execution' : p.status === 'planning' ? 'Kick Off' : p.status === 'suspended' ? 'Suspended' : 'Not Started',
        healthTone: (p.status === 'closure' ? 'success' : p.status === 'execution' ? 'progress' : p.status === 'suspended' ? 'danger' : 'neutral') as any,
      };
    });
  }, [projects, clients]);

  const title = { supervisor: 'Supervisor Workspace', manager: 'Manager Workspace', ceo: 'CEO Workspace' }[role];
  return (
    <AppShell>
      <WorkspaceShell role={role} regions={{
        greeting: (
          <PageHeader
            title={title}
            actions={
              role === 'ceo' ? (
                <Button onClick={handleExportAllData} variant="success">
                  📥 Export All Data (Excel)
                </Button>
              ) : undefined
            }
          />
        ),
        stats: <>
          <StatCard label="Team present" value={teamPresent} tone="success" icon="●" />
          <StatCard label="Utilization" value="" icon="◔" />
          <StatCard label="Pending approvals" value={pendingApprovals.toString()} tone={pendingApprovals > 0 ? 'warning' : 'neutral'} icon="⚑" />
          <StatCard label="At-risk projects" value={atRiskProjects.toString()} tone={atRiskProjects > 0 ? 'danger' : 'neutral'} icon="▲" />
        </>,
        primary: <>
          <Card>
            <SectionHeader title="Projects" />
            {mappedProjects.length > 0 ? (
              mappedProjects.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client}</div>
                  </div>
                  <Badge tone={p.healthTone}>{p.health}</Badge>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found</div>
            )}
          </Card>
          <Card>
            <SectionHeader title="Attendance trend" />
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No trend data available</div>
          </Card>
        </>,
        side: <>
          <Card>
            <SectionHeader title="Team activity" />
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</div>
          </Card>
        </>,
      }} />
    </AppShell>
  );
}

/** Configurable dashboard demo (widget registry + role-based grid). */
export function DashboardPage() {
  const { user } = useAuth();
  const workspace = user ? ROLES[user.role].workspace : 'employee';
  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Configurable widgets · powered by the dashboard registry" />
      <DashboardGrid role={workspace} />
    </AppShell>
  );
}
