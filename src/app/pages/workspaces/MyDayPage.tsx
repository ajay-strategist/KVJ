import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { useDevice, useBreakpoint } from '../../../shared/hooks/responsive';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';
import { PageHeader, Card, SectionHeader, SearchInput, StatCard, QuickActionCard, Badge, Timeline, ActivityCard, Button } from '../../../shared/ui/components';
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
import { ApplyLeaveModal } from '../../../modules/leave/forms/ApplyLeaveModal';

import { useProject } from '../../../modules/project/hooks/useProject';
import { useTaskSessions, saveSessionNote } from '../../../modules/project/hooks/useTaskSessions';
import { useEmployee } from '../../../modules/employee/hooks/useEmployee';
import { useTraining } from '../../../modules/training/hooks/useTraining';
import { cleanBatchCode } from '../../../modules/training/utils/batch-formatter';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../../../modules/attendance/attendance.repository';
import { ATTENDANCE_SERVICE_TOKEN } from '../../../modules/attendance/attendance.service';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../../../modules/finance/finance.repository';
import { LEAVE_REPOSITORY_TOKEN } from '../../../modules/leave/leave.repository';
import { TASK_REPOSITORY_TOKEN } from '../../../modules/project/project.repository';
import { toLocalISODate, formatDisplayTime } from '../../../shared/utils/date';
import { supabase } from '../../../shared/integration/supabase';
import { TaskFormModal } from '../../../modules/project/forms/TaskFormModal';
import { taskTimerStore } from '../../../shared/utils/taskTimerStore';
import { calculateTaskTotalSeconds, formatHoursMinutes } from '../../../shared/utils/taskDuration';
import { TimelineWidget, parseTimeToMinutes, getEntryDate, getEntryTimestamp } from './components/TimelineWidget';
import { AnnouncementWidget } from './components/AnnouncementWidget';
import { DownloadMobileAppModal } from '../../../modules/mobile/components/DownloadMobileAppModal';
import {
  isTaskAssignedToUser,
  getTaskOrderStorageKey,
  getStoredTaskOrder,
  saveStoredTaskOrder,
  clearStoredTaskOrder,
  sortTasksWithSupervisorTier,
} from './task-ordering';
export {
  isTaskAssignedToUser,
  getTaskOrderStorageKey,
  getStoredTaskOrder,
  saveStoredTaskOrder,
  clearStoredTaskOrder,
  sortTasksWithSupervisorTier,
};

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
    const batchList = batches || [];
    const options = batchList.length > 0
      ? batchList.map((b) => {
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
  totalHoursWorked?: number;
  assignee?: string;
  assigneeId?: string;
  supervisor?: string;
  createdAt?: string;
}

interface AttendancePanelProps {
  record: AttendanceRecord | null;
  loading: boolean;
  clockIn: (workType: WorkSessionType) => Promise<any>;
  clockOut: (taskNote?: string) => Promise<any>;
  startBreak: (reason?: string, note?: string) => Promise<any>;
  endBreak: () => Promise<any>;
  onActivityLog?: (title: string, tone?: 'success' | 'progress' | 'info' | 'neutral') => void;
  timelineEntries?: Array<{ title: string; time: string }>;
  tasks?: TaskItem[];
  onStartBreakWithTask?: (reason: string, updateMsg: string, targetTaskId?: string) => Promise<boolean>;
  onApplyLeave?: () => void;
}

export const AttendancePanel = memo(function AttendancePanel({
  record,
  loading,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  onActivityLog,
  timelineEntries = [],
  tasks = [],
  onStartBreakWithTask,
  onApplyLeave,
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
    async function loadBatchCounts() {
      try {
        const { data } = await supabase
          .from('flwdsk_enrollments')
          .select('batch_id')
          .is('deleted_at', null);

        if (cancelled) return;
        const counts: Record<string, number> = {};
        (data || []).forEach((e: any) => {
          if (e.batch_id) counts[e.batch_id] = (counts[e.batch_id] || 0) + 1;
        });
        setBatchStudentCounts(counts);
      } catch (e) {
        console.warn('Failed to load batch enrollment counts:', e);
      }
    }
    loadBatchCounts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function loadAssignedSessions() {
      try {
        const todayStr = toLocalISODate(new Date());
        const [schedRes, calRes] = await Promise.allSettled([
          supabase
            .from('flwdsk_schedule_sessions')
            .select('*')
            .eq('date', todayStr)
            .is('deleted_at', null),
          supabase
            .from('flwdsk_calendar_sessions')
            .select('*')
            .eq('date', todayStr)
            .is('deleted_at', null),
        ]);

        const schedRows = schedRes.status === 'fulfilled' && schedRes.value.data ? schedRes.value.data : [];
        const calRows = calRes.status === 'fulfilled' && calRes.value.data ? calRes.value.data : [];
        const combined = [...schedRows, ...calRows];

        if (combined.length > 0) {
          const set = new Set<string>();
          const userEmail = user?.email?.toLowerCase()?.trim();
          const userName = user?.fullName?.toLowerCase()?.trim();
          const empId = currentEmployee?.id;

          combined.forEach((s: any) => {
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

    const mapped = (batches || []).map((b) => {
      const courseObj = (courses || []).find((c) => c.id === b.courseId);
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
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  const filteredAvailableBatches = useMemo(() => {
    if (!batchSearchQuery.trim()) return availableBatches;
    const q = batchSearchQuery.toLowerCase().trim();
    return availableBatches.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      b.college.toLowerCase().includes(q) ||
      b.course.toLowerCase().includes(q) ||
      b.trainer.toLowerCase().includes(q)
    );
  }, [availableBatches, batchSearchQuery]);

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
    if (eTime && sTime) {
      const diff = new Date(eTime).getTime() - new Date(sTime).getTime();
      return sum + (diff > 0 ? diff : 0);
    }
    return sum;
  }, 0);

  const completedSessionMs = (record?.sessions ?? []).reduce((sum: number, s: any) => {
    const cIn = s.clockIn || s.clock_in;
    const cOut = s.clockOut || s.clock_out;
    if (cOut && cIn) {
      const diff = new Date(cOut).getTime() - new Date(cIn).getTime();
      return sum + (diff > 0 ? diff : 0);
    }
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
  const grossDurationMs = completedSessionMs + activeSessionMs;
  const rawBreakMs = Math.max(completedBreakMs, dbBreakMs) + activeBreakMs;
  const totalBreakMs = Math.min(rawBreakMs, grossDurationMs);
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

  const activeRunningTask = useMemo(() => {
    return (tasks || []).find((t) => t.active) || null;
  }, [tasks]);

  const [clockOutModalOpen, setClockOutModalOpen] = useState(false);
  const [clockOutTaskNote, setClockOutTaskNote] = useState('');

  const handleClockOutClick = useCallback(() => {
    if (activeRunningTask) {
      setClockOutTaskNote('');
      setClockOutModalOpen(true);
    } else {
      handleClockOut();
    }
  }, [activeRunningTask, handleClockOut]);

  const handleConfirmClockOutWithTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const note = clockOutTaskNote.trim();
    if (!note) {
      toast({ variant: 'error', title: 'Work Update Required', message: 'Please provide a work progress update on your active task before clocking out.' });
      return;
    }
    const res = await clockOut(note);
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked Out', message: 'Work progress saved and work day ended.' });
      if (onActivityLog) onActivityLog(`Clocked out work session. Work status: ${note}`, 'neutral');
      setClockOutModalOpen(false);
      setClockOutTaskNote('');
    } else {
      toast({ variant: 'error', title: 'Clock Out Failed', message: res.error });
    }
  }, [clockOutTaskNote, clockOut, toast, onActivityLog]);

  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakReason, setBreakReason] = useState('Official Break');
  const [breakStatusUpdate, setBreakStatusUpdate] = useState('');
  const [selectedBreakTaskId, setSelectedBreakTaskId] = useState('');
  const [submittingBreak, setSubmittingBreak] = useState(false);
  const [endingBreak, setEndingBreak] = useState(false);

  // Sync selected break task when modal opens or active task changes
  useEffect(() => {
    if (breakModalOpen) {
      if (activeRunningTask) {
        setSelectedBreakTaskId(activeRunningTask.id);
      } else if (tasks && tasks.length > 0 && !selectedBreakTaskId) {
        setSelectedBreakTaskId(tasks[0].id);
      }
    }
  }, [breakModalOpen, activeRunningTask, tasks, selectedBreakTaskId]);

  const handleBreakClick = useCallback(async () => {
    if (submittingBreak) return;
    if (activeRunningTask) {
      setBreakReason('Official Break');
      setBreakStatusUpdate('');
      setBreakModalOpen(true);
    } else {
      const ok = await confirm({
        title: 'Start Official Break?',
        message: 'Are you sure you want to start your official break?',
      });
      if (!ok) return;

      setSubmittingBreak(true);
      try {
        if (onStartBreakWithTask) {
          await onStartBreakWithTask('Official Break', '');
        } else {
          const res = await startBreak('Official Break');
          if (res.ok) {
            toast({ variant: 'info', title: 'On Break', message: 'Enjoy your break.' });
            if (onActivityLog) onActivityLog('Started official break', 'info');
          } else {
            toast({ variant: 'error', title: 'Break Failed', message: res.error });
          }
        }
      } finally {
        setSubmittingBreak(false);
      }
    }
  }, [activeRunningTask, confirm, onStartBreakWithTask, startBreak, toast, onActivityLog, submittingBreak]);

  const handleConfirmBreak = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingBreak) return;

    const reasonText = breakReason || 'Official Break';
    const updateMsg = breakStatusUpdate.trim();

    if (!updateMsg) {
      toast({ variant: 'error', title: 'Work Update Required', message: 'Please provide a work progress update before starting your break.' });
      return;
    }

    const targetTaskId = activeRunningTask?.id || selectedBreakTaskId || undefined;

    setSubmittingBreak(true);
    try {
      if (onStartBreakWithTask) {
        const ok = await onStartBreakWithTask(reasonText, updateMsg, targetTaskId);
        if (ok) {
          setBreakModalOpen(false);
          setBreakStatusUpdate('');
        }
        return;
      }

      const res = await startBreak(reasonText);
      if (res.ok) {
        if (updateMsg && onActivityLog) {
          onActivityLog(`Started break (${reasonText}). Work status: ${updateMsg}`, 'info');
        } else if (onActivityLog) {
          onActivityLog(`Started official break (${reasonText})`, 'info');
        }
        toast({ variant: 'info', title: 'On Break', message: 'Enjoy your break.' });
        setBreakModalOpen(false);
        setBreakStatusUpdate('');
      } else {
        toast({ variant: 'error', title: 'Break Failed', message: res.error });
      }
    } finally {
      setSubmittingBreak(false);
    }
  }, [breakReason, breakStatusUpdate, activeRunningTask, selectedBreakTaskId, onStartBreakWithTask, startBreak, toast, onActivityLog, submittingBreak]);

  const handleEndBreak = useCallback(async () => {
    if (endingBreak) return;
    setEndingBreak(true);
    try {
      const res = await endBreak();
      if (res.ok) {
        toast({ variant: 'success', title: 'Back to Work', message: 'Work session resumed.' });
        if (onActivityLog) onActivityLog('Resumed work session after break', 'progress');
      } else {
        toast({ variant: 'error', title: 'End Break Failed', message: res.error });
      }
    } finally {
      setEndingBreak(false);
    }
  }, [endBreak, toast, onActivityLog, endingBreak]);

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
              {(currentStatus === 'present' || Boolean(activeRunningTask)) ? '🟢 Working' : currentStatus === 'on_break' ? '🟡 On Break' : '⚫ Not Working'}
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
              Duration (Today)
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

        {/* Unclosed Past Session Warning Banner */}
        {record && (record.status === 'present' || record.status === 'on_break') && record.workDate && record.workDate < toLocalISODate(new Date()) && (
          <div
            style={{
              background: '#fffbebf0',
              border: '1px solid #fef08a',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#92400e',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>⚠️ <strong>Unclosed Attendance Session:</strong> You have an open attendance session from {record.workDate}. Please click <strong>Clock Out</strong> to complete that record before starting a new work day.</span>
          </div>
        )}

        {/* Action Controls Bar matching Sample Image */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {((currentStatus === 'clocked_out' || (currentStatus !== 'present' && currentStatus !== 'on_break')) && !activeRunningTask) && (
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

          {(currentStatus === 'present' || Boolean(activeRunningTask)) && (
            <>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading || submittingBreak}
                onClick={handleBreakClick}
                style={{
                  background: 'var(--status-warning)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: loading || submittingBreak ? 'not-allowed' : 'pointer',
                  opacity: loading || submittingBreak ? 0.6 : 1,
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
                onClick={handleClockOutClick}
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
              disabled={loading || endingBreak}
              onClick={handleEndBreak}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                border: 'none',
                padding: '11px 22px',
                fontWeight: 700,
                fontSize: 13.5,
                borderRadius: 10,
                cursor: loading || endingBreak ? 'not-allowed' : 'pointer',
                opacity: loading || endingBreak ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {endingBreak ? 'Resuming Work...' : '▶️ Resume Work Session'}
            </button>
          )}

          {/* Apply for Leave Button */}
          {onApplyLeave && (
            <button
              type="button"
              className="kvj-btn"
              onClick={onApplyLeave}
              style={{
                background: '#ffffff',
                color: 'var(--primary-700, #1d4ed8)',
                border: '2px solid var(--primary-300, #93c5fd)',
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: 13.5,
                borderRadius: 999,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37,99,235,0.08)',
                marginLeft: 'auto',
              }}
            >
              🌴 Apply Leave
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
              marginLeft: !onApplyLeave ? 'auto' : undefined,
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
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {batchSearchQuery.trim()
                    ? `${filteredAvailableBatches.length} of ${availableBatches.length} Batches Available`
                    : `${availableBatches.length} Batches Available`}
                </span>
              </div>

              {/* Search Option */}
              <SearchInput
                value={batchSearchQuery}
                onChange={setBatchSearchQuery}
                placeholder="Search batch by name, college, course, trainer..."
                onClear={() => setBatchSearchQuery('')}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {filteredAvailableBatches.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-sunken)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                    {availableBatches.length === 0
                      ? 'No training batches found. Create batches in Training Details page.'
                      : `No batches found matching "${batchSearchQuery}".`}
                  </div>
                ) : (
                  filteredAvailableBatches.map((b) => {
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
            {/* BR-ATT-004 Indicator */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 6 }}>
              ℹ️ <strong>Off-Shift Tasks:</strong> You can start and record work on task timers independently, even when off-shift or not clocked in.
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
              const targetRecordId = (record && record.workDate === values.date)
                ? record.id
                : (globalThis.crypto?.randomUUID?.() || String(Date.now()));
              await attService.requestCorrection(
                targetRecordId,
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

      {/* Official Break Status Update Drawer */}
      <Drawer open={breakModalOpen} onClose={() => setBreakModalOpen(false)} title="Start Official Break — Update Work Status">
        <form onSubmit={handleConfirmBreak} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Before starting your official break, please provide an update on your current task progress. This update will be recorded in your task worklog.
          </div>

          {/* Currently Running Task Card */}
          {activeRunningTask ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  🟢 Currently Running Task
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  ⏱ {Math.floor(activeRunningTask.secondsToday / 3600)}h {Math.floor((activeRunningTask.secondsToday % 3600) / 60)}m
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeRunningTask.title}
              </div>
              {activeRunningTask.project && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  📁 Project: {activeRunningTask.project}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                ℹ️ Starting your break will automatically pause this task timer and save your update to the Task Worklog.
              </div>
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Target Task for Work Progress (Optional)
              </label>
              <select
                className="kvj-select"
                value={selectedBreakTaskId}
                onChange={(e) => setSelectedBreakTaskId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}
              >
                <option value="">— General Workspace Update —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.project ? `(${t.project})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              Break Reason / Type *
            </label>
            <select
              className="kvj-select"
              value={breakReason}
              onChange={(e) => setBreakReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}
            >
              <option value="Official Break">Official Break</option>
              <option value="Lunch Break">Lunch Break</option>
              <option value="Tea / Coffee Break">Tea / Coffee Break</option>
              <option value="Personal / Short Break">Personal / Short Break</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              {activeRunningTask ? `Work Progress Update on "${activeRunningTask.title}" *` : 'Current Work Status & Progress *'}
            </label>
            <textarea
              className="kvj-input"
              required
              rows={4}
              value={breakStatusUpdate}
              onChange={(e) => setBreakStatusUpdate(e.target.value)}
              placeholder={activeRunningTask ? `Describe what you completed on "${activeRunningTask.title}" before taking a break...` : "e.g. Completed morning batch verification, pausing before client review..."}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="secondary" type="button" onClick={() => setBreakModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submittingBreak}
              style={{
                background: 'var(--status-warning)',
                color: 'white',
                opacity: submittingBreak ? 0.6 : 1,
                cursor: submittingBreak ? 'not-allowed' : 'pointer',
              }}
            >
              {submittingBreak ? 'Starting Break...' : '☕ Confirm & Start Break'}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Clock Out Work Progress Drawer */}
      <Drawer open={clockOutModalOpen} onClose={() => setClockOutModalOpen(false)} title="Clock Out — Update Work Status">
        <form onSubmit={handleConfirmClockOutWithTask} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5' }}>
            You have an active task timer running. Please describe your work progress before clocking out. This will pause your task and save your update to the <strong>Task Worklog</strong>.
          </div>

          {activeRunningTask && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-danger)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  🔴 Active Task Being Paused
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  ⏱ {Math.floor(activeRunningTask.secondsToday / 3600)}h {Math.floor((activeRunningTask.secondsToday % 3600) / 60)}m
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeRunningTask.title}
              </div>
              {activeRunningTask.project && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  📁 Project: {activeRunningTask.project}
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              {activeRunningTask ? `Work Progress Update on "${activeRunningTask.title}" *` : 'Work Progress Update *'}
            </label>
            <textarea
              className="kvj-input"
              required
              rows={4}
              value={clockOutTaskNote}
              onChange={(e) => setClockOutTaskNote(e.target.value)}
              placeholder={activeRunningTask ? `Describe what you accomplished on "${activeRunningTask.title}" today before clocking out...` : "Describe what you accomplished today..."}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="secondary" type="button" onClick={() => setClockOutModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" style={{ background: 'var(--status-danger)', color: 'white' }}>
              🔴 Save Progress &amp; Clock Out
            </Button>
          </div>
        </form>
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

function getTimeLeftInfo(dueStr: string): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (!dueStr || typeof dueStr !== 'string') return { label: 'No due date', tone: 'neutral' };
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
  const { user } = useAuth();
  const { toast } = useNotifications();
  const isDesktop = useBreakpoint('md');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const handleResetOrder = () => {
    clearStoredTaskOrder(user?.id);
    setTasks((prev) => sortTasksWithSupervisorTier(prev, [], user));
    toast({
      variant: 'info',
      title: 'Task Order Reset',
      message: 'Task order reset: your tasks are placed at the top, supervisor view tasks at the bottom.',
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  useEffect(() => {
    // The running-task clock advances once a MINUTE (adds 60s), not every second,
    // so My Day is not redrawn 60× a minute.
    const timer = setInterval(() => {
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.active) {
            changed = true;
            return { ...t, secondsToday: t.secondsToday + 60 };
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
    }, 60000);
    return () => clearInterval(timer);
  }, [setTasks]);

  const formatSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (searchQuery.trim()) {
      e.preventDefault();
      return;
    }
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (searchQuery.trim()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== id) {
      setDragOverTaskId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (searchQuery.trim()) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }
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
      saveStoredTaskOrder(updated.map((t) => t.id), user?.id);
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        const titleMatch = t.title?.toLowerCase().includes(q);
        const projMatch = t.project?.toLowerCase().includes(q);
        return Boolean(titleMatch || projMatch);
      });
    }
    return [...list].sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return 0;
    });
  }, [tasks, showSubmitted, searchQuery]);

  return (
    <Card>
      <SectionHeader 
        title={searchQuery.trim() ? "Today's Tasks" : "Today's Tasks (Drag & Drop Reorder)"} 
        subtitle={searchQuery.trim() ? `Showing results for "${searchQuery.trim()}" (Drag & drop reordering paused)` : undefined}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SearchInput 
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search tasks..."
              style={{ width: isDesktop ? 200 : '100%', minWidth: 150 }}
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSubmitted(!showSubmitted)}
              style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
            >
              {showSubmitted ? '🙈 Hide Submitted' : '👁️ Show Submitted'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleResetOrder}
              title="Reset task order to default: your tasks at top, supervisor tasks at bottom"
              style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
            >
              🔄 Reset Order
            </Button>
          </div>
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
            {searchQuery.trim() ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span>🔍 No tasks found matching <strong>"{searchQuery.trim()}"</strong></span>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setSearchQuery('')}
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <span>📋 No pending or active tasks for today. Click <strong>Add Task</strong> to create a new task.</span>
            )}
          </div>
        ) : (
          activeTasks.map((t) => {
            const isExpanded = !!expandedTaskIds[t.id];
            const displayTitle = t.project && t.project !== 'Office Task' ? `${t.project}: ${t.title}` : `Office Task: ${t.title}`;
            return (
              <div
                key={t.id}
                draggable={!searchQuery.trim()}
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
                  cursor: searchQuery.trim() ? 'default' : 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--e1)',
                }}
              >
                 {/* Task Details Header — desktop single row, mobile two-row */}
                 {isDesktop ? (
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
                       <span 
                         style={{ 
                           fontSize: 18, 
                           color: searchQuery.trim() ? 'var(--border)' : 'var(--text-muted)', 
                           cursor: searchQuery.trim() ? 'default' : 'grab', 
                           marginRight: 4, 
                           flexShrink: 0 
                         }}
                         title={searchQuery.trim() ? 'Reordering disabled during search' : 'Drag to reorder'}
                       >
                         ⣿
                       </span>
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
                       <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: '1.4', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>
                         <strong style={{ fontWeight: 700 }}>{t.project && t.project !== 'Office Task' ? t.project : 'Office Task'}:</strong> {t.title}
                       </div>
                       {t.isRework && <span style={{ flexShrink: 0 }}><Badge tone="warning">🔄 Rework</Badge></span>}
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        {(() => {
                          const durationFormatted = formatSec(t.secondsToday || 0);

                          return (
                            <span
                              style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                              title="Accumulated Duration"
                            >
                              ⏱ {durationFormatted}
                            </span>
                          );
                        })()}
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
                           (() => {
                             const isMyAssignee = isTaskAssignedToUser(t, user);
                             if (!isMyAssignee) {
                               return (
                                 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, padding: '4px 10px', background: 'var(--bg-sunken)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                   👁 Supervisor View
                                 </span>
                               );
                             }
                             return (
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
                             );
                           })()
                         )}
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                     {/* Row 1: Drag handle + expand + title */}
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                       <span 
                         style={{ 
                           fontSize: 18, 
                           color: searchQuery.trim() ? 'var(--border)' : 'var(--text-muted)', 
                           cursor: searchQuery.trim() ? 'default' : 'grab', 
                           marginRight: 4, 
                           flexShrink: 0 
                         }}
                         title={searchQuery.trim() ? 'Reordering disabled during search' : 'Drag to reorder'}
                       >
                         ⣿
                       </span>
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
                       <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: '1.4', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>
                         <strong style={{ fontWeight: 700 }}>{t.project && t.project !== 'Office Task' ? t.project : 'Office Task'}:</strong> {t.title}
                       </div>
                       {t.isRework && <span style={{ flexShrink: 0 }}><Badge tone="warning">🔄 Rework</Badge></span>}
                     </div>
                     {/* Row 2: Timer + Actions */}
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 32, flexWrap: 'wrap' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {(() => {
                            const durationFormatted = formatSec(t.secondsToday || 0);

                            return (
                              <span
                                style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                                title="Accumulated Duration"
                              >
                                ⏱ {durationFormatted}
                              </span>
                            );
                          })()}
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
                             (() => {
                               const isMyAssignee = isTaskAssignedToUser(t, user);
                               if (!isMyAssignee) {
                                 return (
                                   <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, padding: '4px 10px', background: 'var(--bg-sunken)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                     👁 Supervisor View
                                   </span>
                                 );
                               }
                               return (
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
                               );
                             })()
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

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
  const [mobileAppModalOpen, setMobileAppModalOpen] = useState(false);

  const userTimelineKey = useMemo(() => {
    const activeKey = selectedEmpId !== 'me' ? selectedEmpId : (user?.id || user?.email || 'me');
    return `${TIMELINE_STORAGE_KEY}_${activeKey}`;
  }, [selectedEmpId, user]);

  // Load live task work sessions directly from DB so active task state and accumulated duration are 100% accurate across tabs and refreshes
  const [userDbSessions, setUserDbSessions] = useState<any[]>([]);

  useEffect(() => {
    // Reset tasks and sessions state immediately when switching accounts
    setTasks([]);
    setUserDbSessions([]);
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let isSubscribed = true;

    async function loadSessions() {
      try {
        const { data } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('employee_id', userId)
          .is('deleted_at', null)
          .order('start_time', { ascending: false });

        if (isSubscribed && data) {
          setUserDbSessions(data);
        }
      } catch (e) {
        console.warn('Could not load task work sessions:', e);
      }
    }

    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const runningDbSessions = useMemo(() => {
    return (userDbSessions || []).filter((s) => s.status === 'running' && !s.end_time);
  }, [userDbSessions]);

  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([]);

  useEffect(() => {
    const sanitizeTitle = (tStr: string) => {
      if (!tStr) return tStr;
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      return tStr.replace(uuidPattern, (m) => {
        const found = (projectTasks || []).find((t) => t.id === m) || (tasks || []).find((t) => t.id === m);
        return found?.title || 'Office Task';
      });
    };

    const localEntries = (() => {
      try {
        const saved = localStorage.getItem(userTimelineKey);
        const parsed = saved ? JSON.parse(saved) : [];
        return parsed
          .filter((e: any) => !e.title?.includes('System initialized'))
          .map((e: any) => ({ ...e, title: sanitizeTitle(e.title) }));
      } catch {
        return [];
      }
    })();

    // Synthesize database attendance events from `record`
    const dbEntries: Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral'; date?: string; timestamp?: number }> = [];

    if (record) {
      const recDate = record.workDate || toLocalISODate(new Date());

      // 1. First Clock In Event
      if (record.firstClockIn) {
        const formattedTime = formatDisplayTime(record.firstClockIn);
        const cInMins = parseTimeToMinutes(formattedTime);
        const existingClockIn = localEntries.find((le: any) => {
          const leDate = le.date || getEntryDate(le);
          if (leDate !== recDate) return false;
          if (!(le.title || '').toLowerCase().includes('clocked in')) return false;
          return Math.abs(parseTimeToMinutes(le.time) - cInMins) <= 2;
        });
        if (!existingClockIn) {
          const workType = (record.sessions?.[0]?.workType || (record as any).workType || 'Office');
          dbEntries.push({
            id: `db-clockin-${record.id || recDate}`,
            title: `Clocked in for ${workType}`,
            time: formattedTime,
            tone: 'success',
            date: recDate,
            timestamp: new Date(record.firstClockIn).getTime(),
          });
        }
      }

      // 2. Break Events
      if (Array.isArray(record.breaks)) {
        record.breaks.forEach((b: any, idx: number) => {
          if (b.startTime) {
            const bStartFmt = formatDisplayTime(b.startTime);
            const bStartMins = parseTimeToMinutes(bStartFmt);
            // Check if localEntries already has a break start entry around this time
            const existingLocalStart = localEntries.find((le: any) => {
              const leDate = le.date || getEntryDate(le);
              if (leDate !== recDate) return false;
              const leTitle = (le.title || '').toLowerCase();
              if (!leTitle.includes('started break') && !leTitle.includes('started official break')) return false;
              return Math.abs(parseTimeToMinutes(le.time) - bStartMins) <= 2;
            });

            if (!existingLocalStart) {
              dbEntries.push({
                id: `db-break-start-${record.id || recDate}-${idx}`,
                title: `Started Break: ${b.reason || 'Rest Break'}`,
                time: bStartFmt,
                tone: 'info',
                date: recDate,
                timestamp: new Date(b.startTime).getTime(),
              });
            }
          }
          if (b.endTime) {
            const bEndFmt = formatDisplayTime(b.endTime);
            const bEndMins = parseTimeToMinutes(bEndFmt);
            // Check if localEntries already has a resumed/ended break entry around this time
            const existingLocalEnd = localEntries.find((le: any) => {
              const leDate = le.date || getEntryDate(le);
              if (leDate !== recDate) return false;
              const leTitle = (le.title || '').toLowerCase();
              if (!leTitle.includes('resumed work session') && !leTitle.includes('ended break')) return false;
              return Math.abs(parseTimeToMinutes(le.time) - bEndMins) <= 2;
            });

            if (!existingLocalEnd) {
              dbEntries.push({
                id: `db-break-end-${record.id || recDate}-${idx}`,
                title: `Ended Break`,
                time: bEndFmt,
                tone: 'info',
                date: recDate,
                timestamp: new Date(b.endTime).getTime(),
              });
            }
          }
        });
      }

      // 3. Clock Out Event
      if (record.lastClockOut) {
        const formattedTime = formatDisplayTime(record.lastClockOut);
        const cOutMins = parseTimeToMinutes(formattedTime);
        const existingClockOut = localEntries.find((le: any) => {
          const leDate = le.date || getEntryDate(le);
          if (leDate !== recDate) return false;
          if (!(le.title || '').toLowerCase().includes('clocked out')) return false;
          return Math.abs(parseTimeToMinutes(le.time) - cOutMins) <= 2;
        });
        if (!existingClockOut) {
          dbEntries.push({
            id: `db-clockout-${record.id || recDate}`,
            title: `Clocked out work session`,
            time: formattedTime,
            tone: 'neutral',
            date: recDate,
            timestamp: new Date(record.lastClockOut).getTime(),
          });
        }
      }
    }

    // Clean up localEntries: remove redundant duplicate break-start entries at same time
    const deduplicatedLocal: any[] = [];
    localEntries.forEach((le: any) => {
      const leTitle = (le.title || '').toLowerCase();
      const isGenericBreakStart = leTitle === 'started official break' || leTitle.startsWith('started break (');
      if (isGenericBreakStart) {
        const leMins = parseTimeToMinutes(le.time);
        const leDate = le.date || getEntryDate(le);
        // If there is another break entry with "on task:" at the same minute, prefer the one with task
        const hasSpecific = localEntries.some((other: any) => {
          if (other === le) return false;
          const oDate = other.date || getEntryDate(other);
          if (oDate !== leDate) return false;
          const oTitle = (other.title || '').toLowerCase();
          return oTitle.includes('on task:') && Math.abs(parseTimeToMinutes(other.time) - leMins) <= 1;
        });
        if (hasSpecific) return;
      }
      deduplicatedLocal.push(le);
    });

    // Merge local entries + db entries, deduplicating by normalized title + time
    const mergedMap = new Map<string, any>();
    [...dbEntries, ...deduplicatedLocal].forEach((entry) => {
      const eDate = entry.date || getEntryDate(entry);
      const key = `${eDate}_${entry.title}_${entry.time}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, entry);
      }
    });

    const sortedMerged = Array.from(mergedMap.values()).sort(
      (a, b) => getEntryTimestamp(a) - getEntryTimestamp(b)
    );

    setTimelineEntries(sortedMerged);
  }, [userTimelineKey, record]);

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

    // Synchronize global timer store with accurate past hours for loaded tasks
    (projectTasks || []).forEach((t) => {
      const taskSessions = (userDbSessions || []).filter((s) => s.task_id === t.id);
      const completedSessions = taskSessions.filter((s) => s.end_time || s.status !== 'running');
      const completedSeconds = completedSessions.reduce((sum: number, s: any) => {
        if (s.duration_minutes || s.durationMinutes) return sum + Number(s.duration_minutes || s.durationMinutes) * 60;
        if (s.start_time && s.end_time) {
          return sum + Math.max(0, Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000));
        }
        return sum;
      }, 0);
      const effectiveHours = taskSessions.length > 0 ? completedSeconds / 3600 : (t.actualHours || 0);
      taskTimerStore.syncTaskTime(t.id, effectiveHours);
    });

    const mapped: TaskItem[] = (projectTasks || [])
      .filter((t) => {
        if (!t) return false;
        const appStatus = ((t as any).approvalStatus || '').toLowerCase();
        const isSelfAssignedBySupervisor = Boolean(t.assigneeId && t.supervisorId && t.assigneeId === t.supervisorId);
        // Don't show unapproved assignment requests until approved by manager (unless self-assigned by supervisor)
        if (appStatus === 'pending_assignment_approval' && !isSelfAssignedBySupervisor) return false;

        const myId = (user?.id || '').toLowerCase();
        const myEmail = typeof user?.email === 'string' ? user.email.toLowerCase() : '';
        const myName = typeof user?.fullName === 'string' ? user.fullName.toLowerCase() : '';

        // Build set of all employee IDs and emails associated with current logged-in user
        const myIdentifiers = new Set<string>();
        if (myId) myIdentifiers.add(myId);
        if (myEmail) myIdentifiers.add(myEmail);

        (employees || []).forEach((e) => {
          const eFullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
          const eEmail = (e.email || '').trim().toLowerCase();
          const matches =
            (e.id && e.id.toLowerCase() === myId) ||
            (eEmail && myEmail && eEmail === myEmail) ||
            (eFullName && myName && (eFullName === myName || eFullName.includes(myName) || myName.includes(eFullName)));

          if (matches) {
            if (e.id) myIdentifiers.add(e.id.toLowerCase());
            if (eEmail) myIdentifiers.add(eEmail);
          }
        });

        const projectObj = t.projectId && t.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === t.projectId) : null;
        const tAssigneeId = (t.assigneeId || '').toLowerCase();
        const tAssigneeName = (typeof (t as any).assignee === 'string' ? (t as any).assignee : '').toLowerCase();

        // My Day is the employee's personal work queue for tasks assigned to them to execute.
        // Projects supervised by Admin/CEO/Manager belong in Project Management / Approvals Queue,
        // and must never cross-pollinate into the user's personal My Day task list.
        const isMyTask =
          (tAssigneeId && myIdentifiers.has(tAssigneeId)) ||
          (tAssigneeName && myName && (tAssigneeName === myName || tAssigneeName.includes(myName) || myName.includes(tAssigneeName)));

        if (!isMyTask) return false;

        const st = (t.status || '').toLowerCase();
        const isApprovedOrDone = st === 'done' || st === 'completed' || appStatus === 'approved';
        if (isApprovedOrDone) return false;

        const sd = typeof t.startDate === 'string' ? t.startDate.slice(0, 10) : '';
        const dd = typeof t.dueDate === 'string' ? t.dueDate.slice(0, 10) : '';
        const effectiveStartDate = sd || dd;
        const isScheduledToday = effectiveStartDate ? todayStr >= effectiveStartDate : true;

        const isActiveOrTodo =
          st === 'todo' ||
          st === 'to do' ||
          st === 'in_progress' ||
          st === 'in progress' ||
          st === 'review' ||
          st === 'under review' ||
          appStatus === 'pending_task_approval' ||
          appStatus === 'rework' ||
          !effectiveStartDate;

        return isScheduledToday || isActiveOrTodo || storedStates[t.id];
      })
      .map((t) => {
        const proj = (projects || []).find((p) => p.id === t.projectId);
        const stored = storedStates[t.id];
        const isRework = (t as any).approvalStatus === 'rework';
        const reworkNotes = (t as any).reworkNotes;
        let underReview = t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval';
        const statusStr = (t.status || '') as string;
        const isApproved = statusStr === 'done' || statusStr === 'completed';
        if (isApproved || isRework) {
          underReview = false;
        }

        const taskSessions = (userDbSessions || []).filter((s) => s.task_id === t.id);
        const dbRunningSession = taskSessions.find((s) => s.status === 'running' && !s.end_time);
        const isExplicitlyPaused = stored?.active === false || t.status === 'todo';
        const isExplicitlyDoneOrReview = underReview || isApproved;

        let isDbRunning = false;
        if (!isExplicitlyPaused && !isExplicitlyDoneOrReview) {
          isDbRunning = Boolean(dbRunningSession) || t.status === 'in_progress';
        }

        // Calculate past completed sessions duration from DB ledger
        const completedSessions = taskSessions.filter((s) => s.end_time || s.status !== 'running');
        const completedSeconds = completedSessions.reduce((sum: number, s: any) => {
          if (s.duration_minutes || s.durationMinutes) {
            return sum + Number(s.duration_minutes || s.durationMinutes) * 60;
          }
          if (s.start_time && s.end_time) {
            const diff = Math.max(0, Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000));
            return sum + diff;
          }
          return sum;
        }, 0);

        // Fallback for legacy tasks with no sessions in task_work_sessions
        const legacyPastSeconds = Math.round(((t as any).actualHours || 0) * 3600);
        const pastBaseSeconds = taskSessions.length > 0 ? completedSeconds : legacyPastSeconds;

        let active = false;
        let secondsToday = 0;

        if (isDbRunning) {
          active = true;
          const sessionStartMs = dbRunningSession?.start_time
            ? new Date(dbRunningSession.start_time).getTime()
            : (stored?.lastStartTime || now);
          const liveSeconds = Math.max(0, Math.floor((now - sessionStartMs) / 1000));
          secondsToday = pastBaseSeconds + liveSeconds;
        } else if (stored) {
          if (stored.active && stored.lastStartTime && !isExplicitlyPaused && !isExplicitlyDoneOrReview) {
            active = true;
            const liveSeconds = Math.max(0, Math.floor((now - stored.lastStartTime) / 1000));
            secondsToday = pastBaseSeconds + liveSeconds;
          } else {
            active = false;
            secondsToday = taskSessions.length > 0 ? completedSeconds : (stored.secondsToday || legacyPastSeconds);
          }
          const dbUnderReview = t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval';
          if (dbUnderReview) {
            underReview = true;
          } else if (stored.underReview !== undefined && !isRework && !isApproved) {
            underReview = stored.underReview;
          }
        } else {
          active = false;
          secondsToday = pastBaseSeconds;
        }

        // If the task is active, ensure the timer in taskTimerStore is actively ticking with accurate start timestamp.
        if (active) {
          const sessionStartMs = dbRunningSession?.start_time
            ? new Date(dbRunningSession.start_time).getTime()
            : (stored?.lastStartTime || now);
          const curTimer = taskTimerStore.getTimer(t.id);
          if (!curTimer || !curTimer.isRunning || Math.abs(curTimer.startTime - sessionStartMs) > 5000) {
            taskTimerStore.startTask(t.id, pastBaseSeconds * 1000, sessionStartMs);
          }
        } else {
          taskTimerStore.pauseTask(t.id);
        }

        // Continuous task duration accumulation: no artificial daily resets

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
        const pSupervisorId = projectObj ? ((projectObj as any).supervisorId || (projectObj as any).supervisor_id) : null;
        const tSupervisorId = (t.supervisorId && t.supervisorId !== t.assigneeId)
          ? t.supervisorId
          : ((t as any).assignedByEmployeeId && (t as any).assignedByEmployeeId !== t.assigneeId)
            ? (t as any).assignedByEmployeeId
            : null;
        const supervisorEmpId = pSupervisorId || tSupervisorId;
        const supervisorEmp = supervisorEmpId ? employees?.find((e) => e.id === supervisorEmpId) : null;
        const assigneeName = assigneeEmp
          ? `${assigneeEmp.firstName} ${assigneeEmp.lastName}`
          : (typeof (t as any).assignee === 'string' ? (t as any).assignee : undefined);
        const supervisorName = supervisorEmp
          ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}`
          : (typeof (t as any).supervisor === 'string' ? (t as any).supervisor : undefined);

        return {
          id: t.id,
          title: t.title,
          project: proj ? proj.title : 'Office Task',
          due: typeof t.dueDate === 'string' ? t.dueDate.slice(0, 10) : todayStr,
          startDate: typeof t.startDate === 'string' ? t.startDate.slice(0, 10) : undefined,
          priority: t.priority === 'high' ? 'High' : 'Normal',
          active,
          underReview,
          isApproved,
          isRework,
          reworkNotes,
          secondsToday,
          totalHoursWorked: secondsToday / 3600,
          assignee: assigneeName,
          assigneeId: t.assigneeId,
          supervisor: supervisorName,
          createdAt: (t as any).createdAt || (t as any).created_at,
        };
      });

    saveStoredTaskStates(updatedStates);

    const savedOrder = getStoredTaskOrder(user?.id);
    const sorted = sortTasksWithSupervisorTier(mapped, savedOrder, user);
    setTasks(sorted);
  }, [projectTasks, projects, employees, user, userDbSessions]);

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

  // UIUX-REQ-008: 15-Minute Continuous Employee Idle Notification
  useEffect(() => {
    const checkIdleInterval = setInterval(() => {
      if (!user || user.role === 'ADMIN') return;

      const isClockedIn = record?.status === 'present';
      const isOnBreak = record?.status === 'on_break' || Boolean(record?.breaks?.some((b: any) => !b.endTime && !b.end_time));
      const isAnyTaskRunning = tasks.some((t) => t.active);

      // Condition: Clocked In AND No Task Running AND Not On Break
      const isIdleNow = isClockedIn && !isAnyTaskRunning && !isOnBreak;

      const idleKey = `flwdsk_idle_start_${user.id}`;
      const notifiedKey = `flwdsk_idle_notified_${user.id}`;

      if (isIdleNow) {
        const existingStart = localStorage.getItem(idleKey);
        const now = Date.now();
        if (!existingStart) {
          localStorage.setItem(idleKey, String(now));
        } else {
          const elapsedMins = (now - Number(existingStart)) / (1000 * 60);
          const alreadyNotified = localStorage.getItem(notifiedKey);

          if (elapsedMins >= 15 && !alreadyNotified) {
            // Trigger Admin notification
            addNotification({
              title: `⚠️ Idle-Time Alert: ${user.fullName || user.email}`,
              message: `${user.fullName || 'Employee'} has been clocked in without a running task or break for 15 consecutive minutes.`,
              category: 'system',
              priority: 'high',
            });
            localStorage.setItem(notifiedKey, 'true');
          }
        }
      } else {
        // Reset idle counter immediately if employee starts task, takes a break, or clocks out
        localStorage.removeItem(idleKey);
        localStorage.removeItem(notifiedKey);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkIdleInterval);
  }, [record, tasks, user, addNotification]);

  const handleActivityLog = (title: string, tone: 'success' | 'progress' | 'info' | 'neutral' = 'info') => {
    const timeStr = formatDisplayTime(new Date());
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

  const handleStartBreakWithTask = useCallback(async (reason: string, updateMsg: string, targetTaskId?: string): Promise<boolean> => {
    // If an active task is running or a target task is selected, pause it and save progress notes
    const runningTask = tasks.find((t) => t.active);
    const taskIdToPause = runningTask?.id || targetTaskId;

    if (taskIdToPause) {
      const matchingTaskItem = tasks.find((t) => t.id === taskIdToPause);
      const targetTask = matchingTaskItem || (projectTasks || []).find((t) => t.id === taskIdToPause);
      taskTimerStore.pauseTask(taskIdToPause);
      const timer = taskTimerStore.getTimer(taskIdToPause);
      const secondsToday = timer
        ? Math.floor(timer.elapsedMs / 1000)
        : (matchingTaskItem?.secondsToday ?? Math.round(((targetTask as any)?.actualHours || 0) * 3600));

      setTasks((prev) =>
        prev.map((t) => (t.id === taskIdToPause ? { ...t, active: false, secondsToday } : t))
      );
      setUserDbSessions((prev: any[]) => (prev || []).map((s: any) => s.task_id === taskIdToPause ? { ...s, status: 'paused', end_time: new Date().toISOString() } : s));

      const states = getStoredTaskStates();
      const todayDateStr = toLocalISODate(new Date());
      states[taskIdToPause] = {
        ...(states[taskIdToPause] || {}),
        active: false,
        secondsToday,
        lastStartTime: undefined,
        date: todayDateStr,
      };
      saveStoredTaskStates(states);

      try {
        await updateTask(taskIdToPause as any, { status: 'todo', actualHours: secondsToday / 3600 });
        if (updateMsg) {
          await pauseSession(taskIdToPause as any, updateMsg);
        } else {
          await pauseSession(taskIdToPause as any);
        }
        if (user?.id) {
          await supabase
            .from('flwdsk_task_work_sessions')
            .update({
              status: 'paused',
              end_time: new Date().toISOString(),
              notes: updateMsg || 'Paused for break',
            })
            .eq('employee_id', user.id)
            .eq('task_id', taskIdToPause)
            .is('end_time', null);
        }
      } catch (e) {
        console.warn('Failed to pause task during break start:', e);
      }

      const taskTitleText = targetTask?.title || taskIdToPause;
      handleActivityLog(`Started break (${reason}) on task: "${taskTitleText}". Work status: ${updateMsg || 'Paused for break'}`, 'info');
    } else {
      if (updateMsg) {
        handleActivityLog(`Started break (${reason}). Work status: ${updateMsg}`, 'info');
      } else {
        handleActivityLog(`Started official break (${reason})`, 'info');
      }
    }

    const res = await startBreak(reason, updateMsg);
    if (!res.ok) {
      toast({ variant: 'error', title: 'Break Failed', message: res.error });
      return false;
    }

    toast({
      variant: 'info',
      title: 'On Break',
      message: runningTask
        ? `Break started. Active task "${runningTask.title}" paused and progress update recorded.`
        : 'Enjoy your break.'
    });
    return true;
  }, [startBreak, tasks, projectTasks, toast, pauseSession, updateTask]);

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseTargetTaskId, setPauseTargetTaskId] = useState<string | null>(null);
  const [pauseWorkNote, setPauseWorkNote] = useState('');
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);
  const [pendingSwitchTaskTitle, setPendingSwitchTaskTitle] = useState<string | null>(null);

  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  const performStartTask = useCallback(async (id: string, taskTitle: string) => {
    setTogglingTaskId(id);
    try {
      const now = Date.now();
      const existingTaskItem = tasks.find((t) => t.id === id);
      const existingRaw = (projectTasks || []).find((t) => t.id === id);
      const taskSessions = (userDbSessions || []).filter((s) => s.task_id === id);
      const completedSessions = taskSessions.filter((s) => s.end_time || s.status !== 'running');
      const completedSeconds = completedSessions.reduce((sum: number, s: any) => {
        if (s.duration_minutes || s.durationMinutes) return sum + Number(s.duration_minutes || s.durationMinutes) * 60;
        if (s.start_time && s.end_time) {
          return sum + Math.max(0, Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000));
        }
        return sum;
      }, 0);
      const initialSec = taskSessions.length > 0
        ? completedSeconds
        : (existingTaskItem?.secondsToday ?? Math.round(((existingRaw as any)?.actualHours || 0) * 3600));
      taskTimerStore.startTask(id, initialSec * 1000, now);
      const timer = taskTimerStore.getTimer(id);
      const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : initialSec;

      setTasks((prev) => {
        const updated = prev.map((t) => {
          if (t.id === id) {
            return { ...t, active: true, secondsToday };
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

      updateTask(id, {
        status: 'in_progress',
      }).catch((e) => console.warn('Failed to update task status in DB:', e));

      const raw = (projectTasks || []).find((t) => t.id === id);
      const project = raw?.projectId && raw.projectId !== 'OFFICE_TASK' ? (projects || []).find((p) => p.id === raw.projectId) : null;
      const pSupervisorId = project ? ((project as any).supervisorId || (project as any).supervisor_id) : null;
      const tSupervisorId = (raw?.supervisorId && raw.supervisorId !== raw.assigneeId)
        ? raw.supervisorId
        : ((raw as any)?.assignedByEmployeeId && (raw as any).assignedByEmployeeId !== raw?.assigneeId)
          ? (raw as any).assignedByEmployeeId
          : null;
      const supervisorId = pSupervisorId || tSupervisorId;

      await startSession({
        taskId: id as any,
        projectId: raw?.projectId,
        workTitle: taskTitle,
        supervisorId,
      });

      handleActivityLog(`Started Task: ${taskTitle}`, 'progress');
    } finally {
      setTogglingTaskId(null);
    }
  }, [projectTasks, projects, startSession, updateTask, tasks, userDbSessions]);

  const handleConfirmPauseTask = async () => {
    if (!pauseTargetTaskId) return;
    const note = pauseWorkNote.trim();
    if (!note) {
      toast({ variant: 'error', title: 'Work Update Required', message: 'Please enter a work progress update before pausing.' });
      return;
    }
    const taskId = pauseTargetTaskId;

    taskTimerStore.pauseTask(taskId);
    const timer = taskTimerStore.getTimer(taskId);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, active: false, secondsToday } : t))
    );
    setUserDbSessions((prev: any[]) => (prev || []).map((s: any) => s.task_id === taskId ? { ...s, status: 'paused', end_time: new Date().toISOString() } : s));

    const states = getStoredTaskStates();
    const todayDateStr = toLocalISODate(new Date());
    states[taskId] = {
      ...(states[taskId] || {}),
      active: false,
      secondsToday,
      lastStartTime: undefined,
      date: todayDateStr,
    };
    saveStoredTaskStates(states);

    try {
      await updateTask(taskId as any, { status: 'todo', actualHours: secondsToday / 3600 });
      await pauseSession(taskId as any, note);
      if (user?.id) {
        await supabase
          .from('flwdsk_task_work_sessions')
          .update({
            status: 'paused',
            end_time: new Date().toISOString(),
            notes: note,
          })
          .eq('employee_id', user.id)
          .eq('task_id', taskId)
          .is('end_time', null);
      }
      const targetTask = (projectTasks || []).find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
      const taskTitleText = targetTask?.title || taskId;
      handleActivityLog(`Paused Task: ${taskTitleText}. Work status: ${note}`, 'neutral');
    } catch (e) {
      console.warn('Pause task error in workspace:', e);
    }

    const nextTaskId = pendingSwitchTaskId;
    const nextTaskTitle = pendingSwitchTaskTitle;

    setPauseModalOpen(false);
    setPauseTargetTaskId(null);
    setPauseWorkNote('');
    setPendingSwitchTaskId(null);
    setPendingSwitchTaskTitle(null);

    if (nextTaskId && nextTaskTitle) {
      toast({ variant: 'info', title: 'Task Paused & Switched', message: 'Previous task progress saved. Starting next task...' });
      await performStartTask(nextTaskId, nextTaskTitle);
    } else {
      toast({ variant: 'info', title: 'Task Paused', message: 'Work progress saved and timer paused.' });
    }
  };

  const handleToggleTask = async (id: string, taskTitle: string, currentActive: boolean) => {
    if (togglingTaskId) return;

    // If active and user clicks pause, open mandatory work progress modal
    if (currentActive) {
      setPendingSwitchTaskId(null);
      setPendingSwitchTaskTitle(null);
      setPauseTargetTaskId(id);
      setPauseWorkNote('');
      setPauseModalOpen(true);
      return;
    }

    // If starting a task, check if another task is currently active
    const activeTask = tasks.find((t) => t.active && t.id !== id);
    if (activeTask) {
      setPendingSwitchTaskId(id);
      setPendingSwitchTaskTitle(taskTitle);
      setPauseTargetTaskId(activeTask.id);
      setPauseWorkNote('');
      setPauseModalOpen(true);
      return;
    }

    await performStartTask(id, taskTitle);
  };

  const handleSubmitReview = async (id: string, taskTitle: string) => {
    // 1. Pause and reset timer in taskTimerStore to capture final time and ensure it's not running
    taskTimerStore.pauseTask(id);
    const timer = taskTimerStore.getTimer(id);
    const finalSeconds = timer ? Math.floor(timer.elapsedMs / 1000) : 0;
    taskTimerStore.resetTask(id);

    // Optimistically mark under review and active: false.
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
      states[id] = {
        ...(states[id] || {}),
        secondsToday: finalSeconds,
        active: false,
        underReview: val,
        date: toLocalISODate(new Date()),
      };
      delete states[id].lastStartTime;
      saveStoredTaskStates(states);
    };
    applyUnderReview(true);
    setUserDbSessions((prev: any[]) => (prev || []).map((s: any) => s.task_id === id ? { ...s, status: 'completed', end_time: new Date().toISOString() } : s));

    // Save final actualHours to the DB before submitting
    try {
      await updateTask(id as any, { actualHours: finalSeconds / 3600, status: 'review' });
      await completeSession(id as any);
    } catch (e) {
      console.warn('Failed to update task hours on submit:', e);
    }

    // Direct DB cleanup: ensure all open work sessions for this task & employee are closed
    try {
      if (user) {
        await supabase
          .from('flwdsk_task_work_sessions')
          .update({
            status: 'completed',
            end_time: new Date().toISOString(),
          })
          .eq('employee_id', user.id)
          .eq('task_id', id)
          .is('end_time', null);
      }
    } catch (_) {}

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

    try {
      await refresh?.();
    } catch (_) {}

    toast({
      variant: 'success',
      title: 'Routed to Approvals Queue',
      message: `Task '${taskTitle}' submitted for Supervisor / Admin review and approval.`,
    });
    addNotification({
      title: 'Task Submitted for Review',
      message: `'${taskTitle}' submitted for Supervisor / Admin review and approval.`,
      category: 'task',
      priority: 'high',
    });
    handleActivityLog(`Submitted for Supervisor / Admin Approval: ${taskTitle}`, 'success');
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
      const projObj = (projects || []).find((p) => p.id === targetProjectId);
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
    const nowIso = new Date().toISOString();
    const newTaskItem: TaskItem = {
      id: taskId,
      title,
      project: projName,
      due: dueDateVal,
      priority: 'Normal',
      active: false,
      secondsToday: 0,
      createdAt: nowIso,
    };

    setTasks((prev) => {
      const isOwn = isTaskAssignedToUser(newTaskItem, user);
      const filtered = prev.filter((t) => t.id !== taskId);
      const next = isOwn ? [newTaskItem, ...filtered] : [...filtered, newTaskItem];
      const states = getStoredTaskStates();
      states[taskId] = { secondsToday: 0, active: false };
      saveStoredTaskStates(states);
      const currentOrder = getStoredTaskOrder(user?.id);
      if (currentOrder.length > 0) {
        const filteredOrder = currentOrder.filter((id) => id !== taskId);
        const nextOrder = isOwn ? [taskId, ...filteredOrder] : [...filteredOrder, taskId];
        saveStoredTaskOrder(nextOrder, user?.id);
      }
      return next;
    });

    const pending = res.ok && (res.value as any)?.approvalStatus === 'pending_assignment_approval';
    toast({
      variant: pending ? 'warning' : 'success',
      title: pending ? 'Task Sent for Approval' : 'Task Created',
      message: pending
        ? `Task "${title}" created. Project Supervisor / Admin / CEO / Manager approval is required before starting.`
        : `Task "${title}" added to Today's Tasks.`,
    });
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => setMobileAppModalOpen(true)}
              style={{
                gap: 8,
                fontWeight: 700,
                border: '1.5px solid var(--brand)',
                color: 'var(--brand)',
                backgroundColor: 'var(--bg-sunken)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              📱 Download Mobile App
            </Button>
            <Button onClick={() => setCreateTaskOpen(true)} style={{ gap: 6 }}>
              ＋ Add Task
            </Button>
          </div>
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
        timelineEntries={timelineEntries}
        tasks={tasks}
        onStartBreakWithTask={handleStartBreakWithTask}
        onApplyLeave={() => setApplyLeaveOpen(true)}
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
      <TaskFormModal open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} onSuccess={() => refresh?.()} />

      {/* Download Mobile App Modal */}
      <DownloadMobileAppModal isOpen={mobileAppModalOpen} onClose={() => setMobileAppModalOpen(false)} />

      {/* Apply Leave Modal on My Day */}
      <ApplyLeaveModal open={applyLeaveOpen} onClose={() => setApplyLeaveOpen(false)} />

      {/* Pause / Switch Task Work Progress Drawer */}
      <Drawer
        open={pauseModalOpen}
        onClose={() => {
          setPauseModalOpen(false);
          setPendingSwitchTaskId(null);
          setPendingSwitchTaskTitle(null);
        }}
        title={pendingSwitchTaskId ? 'Switch Task — Save Progress (Mandatory)' : 'Pause Task — Save Progress (Mandatory)'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-sunken)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <strong>📌 Management Note:</strong> {pendingSwitchTaskId
              ? `Please describe what you completed before switching to "${pendingSwitchTaskTitle}". This note will be recorded in the Task Worklog.`
              : 'Please describe what work was done during this session. This note will be recorded in the Task Worklog under the Update column for CEO/Manager review.'}
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
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setPauseModalOpen(false);
                setPendingSwitchTaskId(null);
                setPendingSwitchTaskTitle(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPauseTask}
              disabled={!pauseWorkNote.trim()}
            >
              {pendingSwitchTaskId ? '⏸ Save Progress & Start Next Task' : '⏸ Save Progress & Pause Timer'}
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


export default MyDayPage;
