import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Avatar, SearchInput, Button, Badge, SectionHeader } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useEmployee } from '../hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';
import Drawer from '../../../shared/ui/Drawer';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Employee } from '../employee.repository';
import { isRelievedEmployee, sortEmployeesByCode } from '../employee.repository';
import { EmployeeFormModal } from '../forms/EmployeeFormModal';
import { useProject } from '../../project/hooks/useProject';
import { supabase } from '../../../shared/integration/supabase';
import { Authorize } from '../../../shared/permissions/react';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { formatDisplayDate, todayISO } from '../../../shared/utils/date';

export function EmployeeDirectory({ defaultTabId = 'directory' }: { defaultTabId?: string }) {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { employees, createEmployee, updateProfile, deleteEmployee, loading, refresh } = useEmployee();
  const { createUser, resetToDefaultPassword, updateUser, deleteUser, getUsers, user } = useAuth();
  const { tasks } = useProject();
  const { toast, addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<'active' | 'all' | 'relieved'>('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  // Blocks duplicate create/edit records from a rapid double-click (raw forms,
  // so the shared Form guard does not apply here).
  const savingRef = useRef(false);

  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    getUsers().then((res) => {
      if (Array.isArray(res)) {
        setUsersList(res);
      }
    });
  }, [getUsers]);

  const getEmployeeUser = (email: string) => {
    return usersList.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
  };

  const getEmployeeRole = (email: string): string => {
    return getEmployeeUser(email)?.role || 'EMPLOYEE';
  };

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [openWorkSessions, setOpenWorkSessions] = useState<any[]>([]);
  const [todayCalendarSessions, setTodayCalendarSessions] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [activeWorkSessions, setActiveWorkSessions] = useState<any[]>([]);
  const [todayTaskSessions, setTodayTaskSessions] = useState<any[]>([]);
  const [todayBreakRecords, setTodayBreakRecords] = useState<any[]>([]);
  const [leaveToday, setLeaveToday] = useState<any[]>([]);

  useEffect(() => {
    async function loadStatusInfo() {
      try {
        const todayStr = todayISO();
        const { data: attData } = await supabase
          .from('flwdsk_attendance_records')
          .select('*')
          .eq('work_date', todayStr)
          .is('deleted_at', null);

        let finalAttData = attData || [];
        if (!finalAttData.length) {
          const { data: altAttData } = await supabase
            .from('flwdsk_attendance')
            .select('*')
            .eq('work_date', todayStr)
            .is('deleted_at', null);
          if (altAttData) finalAttData = altAttData;
        }

        if (finalAttData) {
          setAttendanceRecords(finalAttData);
        }

        // Fetch work sessions & break records to detect active training batch sessions & breaks
        const attIds = (finalAttData || []).map((r: any) => r.id).filter(Boolean);
        if (attIds.length > 0) {
          const { data: wsData } = await supabase
            .from('flwdsk_work_sessions')
            .select('id, attendance_record_id, clock_in, clock_out, work_type')
            .in('attendance_record_id', attIds)
            .is('deleted_at', null);
          if (wsData) {
            setOpenWorkSessions(wsData.filter((ws: any) => !ws.clock_out));
            const wsIds = wsData.map((ws: any) => ws.id);
            const wsToAttMap = new Map(wsData.map((w: any) => [w.id, w.attendance_record_id]));
            const attToEmpMap = new Map((finalAttData || []).map((a: any) => [a.id, a.employee_id]));

            const collectedBreaks: any[] = [];
            if (wsIds.length > 0) {
              const { data: bData } = await supabase
                .from('flwdsk_break_records')
                .select('*')
                .in('work_session_id', wsIds)
                .is('deleted_at', null);
              if (bData) {
                bData.forEach((b: any) => {
                  const attId = wsToAttMap.get(b.work_session_id);
                  const empId = attId ? attToEmpMap.get(attId) : undefined;
                  collectedBreaks.push({ ...b, employee_id: empId });
                });
              }
            }

            // Also collect embedded breaks from attendance records
            (finalAttData || []).forEach((r: any) => {
              if (Array.isArray(r.breaks) && r.breaks.length > 0) {
                r.breaks.forEach((b: any) => {
                  collectedBreaks.push({
                    ...b,
                    employee_id: r.employee_id,
                    start_time: b.startTime || b.start_time,
                    end_time: b.endTime || b.end_time,
                  });
                });
              }
            });

            setTodayBreakRecords(collectedBreaks);
          }
        } else {
          setOpenWorkSessions([]);
          setTodayBreakRecords([]);
        }

        // Fetch today's scheduled training sessions from calendar
        const { data: calSessions } = await supabase
          .from('flwdsk_calendar_sessions')
          .select('*')
          .eq('date', todayStr)
          .is('deleted_at', null);
        if (calSessions) {
          setTodayCalendarSessions(calSessions);
        }

        // Fetch batches to resolve training titles/codes
        const { data: batchesData } = await supabase
          .from('flwdsk_batches')
          .select('id, code, training_name, college')
          .is('deleted_at', null);
        if (batchesData) {
          setBatchesList(batchesData);
        }

        const { data: taskData } = await supabase
          .from('flwdsk_tasks')
          .select('*')
          .in('status', ['in_progress', 'In Progress'])
          .is('deleted_at', null);
        if (taskData) {
          setActiveTasks(taskData);
        }

        // Fetch active running task work sessions from DB so live status reflects across all machines
        const { data: sessData } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('status', 'running')
          .is('end_time', null)
          .is('deleted_at', null);
        if (sessData) {
          setActiveWorkSessions(sessData);
        }

        // Fetch task sessions logged today (used for idle duration measurement after task pauses/completion)
        const { data: todaySess } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('id, employee_id, task_id, start_time, end_time, status')
          .gte('created_at', `${todayStr}T00:00:00.000Z`)
          .is('deleted_at', null);
        if (todaySess) {
          setTodayTaskSessions(todaySess);
        }

        // Approved leaves that cover today (start <= today <= end).
        const { data: leaveData } = await supabase
          .from('flwdsk_leave_records')
          .select('employee_id, start_date, end_date, status')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .is('deleted_at', null);
        if (leaveData) {
          setLeaveToday(leaveData.filter((l: any) => String(l.status || '').toLowerCase() === 'approved'));
        }
      } catch (e) {
        console.warn('Could not load status info:', e);
      }
    }
    loadStatusInfo();
    const interval = setInterval(loadStatusInfo, 5000);
    return () => clearInterval(interval);
  }, [employees]);

  const isEmployeeInTraining = (emp: Employee): string | null => {
    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();
    const isCurrentUser = Boolean(user && (user.id === empId || user.email?.toLowerCase() === empEmail));

    const matchingAttendance = attendanceRecords.filter(
      (r) =>
        r.employee_id === empId ||
        (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail) ||
        (isCurrentUser && user && (r.employee_id === user.id || r.employee_email?.toLowerCase() === user.email?.toLowerCase()))
    );

    // 1. Check open work sessions in flwdsk_work_sessions
    const attIds = new Set(matchingAttendance.map((r) => r.id));
    const activeWs = openWorkSessions.find((ws: any) => attIds.has(ws.attendance_record_id));
    if (activeWs && activeWs.work_type) {
      const wt = String(activeWs.work_type).trim();
      if (wt.toLowerCase().includes('training')) {
        return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
      }
    }

    // 2. Check embedded sessions in matching attendance records
    for (const att of matchingAttendance) {
      if (Array.isArray(att.sessions)) {
        const activeSess = att.sessions.find((s: any) => !s.clockOut && !s.clock_out);
        const sessionToCheck = activeSess || att.sessions[att.sessions.length - 1];
        if (sessionToCheck?.workType && String(sessionToCheck.workType).toLowerCase().includes('training')) {
          const wt = String(sessionToCheck.workType).trim();
          return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
        }
      }
      if (att.work_type && String(att.work_type).toLowerCase().includes('training')) {
        const wt = String(att.work_type).trim();
        return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
      }
      if (att.workType && String(att.workType).toLowerCase().includes('training')) {
        const wt = String(att.workType).trim();
        return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
      }
    }

    // 3. If employee is clocked in today, check if they have a scheduled training session today on Training Calendar
    const isClockedIn = matchingAttendance.some((r) => r.status === 'present');
    if (isClockedIn) {
      const todayCal = todayCalendarSessions.find((cs: any) => {
        return (
          cs.trainer_id === empId ||
          (isCurrentUser && user && cs.trainer_id === user.id) ||
          (emp.firstName && cs.trainer_name && cs.trainer_name.toLowerCase().includes(emp.firstName.toLowerCase()))
        );
      });
      if (todayCal) {
        const matchedBatch = batchesList.find((b: any) => b.id === todayCal.batch_id);
        const batchTitle = matchedBatch?.code || matchedBatch?.training_name || todayCal.session_title || 'Training Batch';
        return `🎓 Training: ${batchTitle}`;
      }
    }

    return null;
  };

  const isTaskTrulyInProgress = (task: any): boolean => {
    if (!task) return false;
    const s = String(task.status || '').toLowerCase().trim();
    if (
      s === 'review' ||
      s === 'under review' ||
      s === 'under_review' ||
      s === 'done' ||
      s === 'completed' ||
      s === 'closed' ||
      s === 'cancelled'
    ) {
      return false;
    }
    const app = String(task.approvalStatus || (task as any).approval_status || '').toLowerCase().trim();
    if (app === 'pending_task_approval' || app === 'submitted') {
      return false;
    }
    if (task.underReview || (task as any).under_review) {
      return false;
    }
    return true;
  };

  const getEmployeeActiveTask = (emp: Employee) => {
    // Check if the employee clocked in for a training batch or has an active training session
    const trainingTitle = isEmployeeInTraining(emp);
    if (trainingTitle) {
      return trainingTitle;
    }

    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();
    const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();
    const isCurrentUser = Boolean(user && (user.id === empId || user.email?.toLowerCase() === empEmail));

    // 1. Check real-time database work sessions (status = 'running' & end_time is null)
    const dbSession = activeWorkSessions.find((s: any) => {
      if (s.status !== 'running' || s.end_time) return false;
      const isForThisEmp =
        s.employee_id === empId ||
        (s.employee_id && empEmail && s.employee_id.toLowerCase() === empEmail) ||
        (s.employee_name && empFullName && s.employee_name.toLowerCase() === empFullName) ||
        (isCurrentUser && user && (s.employee_id === user.id || s.employee_id?.toLowerCase() === user.email?.toLowerCase()));
      if (!isForThisEmp) return false;

      // If dbSession links to a task, verify that task is NOT submitted, under review, or completed
      if (s.task_id) {
        const linkedTask = (tasks || []).find((t: any) => t.id === s.task_id);
        if (linkedTask && !isTaskTrulyInProgress(linkedTask)) {
          return false;
        }
      }
      return true;
    });

    if (dbSession) {
      return `📝 ${dbSession.work_title || dbSession.workTitle}`;
    }

    // 2. Read actively RUNNING timers from taskTimerStore (kvj_task_timers) - strictly scoped to current user
    if (isCurrentUser) {
      const runningTaskIds = new Set<string>();
      try {
        const rawTimers = localStorage.getItem('kvj_task_timers');
        if (rawTimers) {
          const parsed: Record<string, { isRunning: boolean }> = JSON.parse(rawTimers);
          for (const [tId, s] of Object.entries(parsed)) {
            if (s?.isRunning === true) runningTaskIds.add(tId);
          }
        }
        const rawMyDay = localStorage.getItem('kvj_task_timer_state_v1');
        if (rawMyDay) {
          const parsed: Record<string, { active: boolean; underReview?: boolean }> = JSON.parse(rawMyDay);
          for (const [tId, s] of Object.entries(parsed)) {
            if (s?.underReview) {
              runningTaskIds.delete(tId);
            } else if (s?.active === true) {
              runningTaskIds.add(tId);
            } else {
              runningTaskIds.delete(tId);
            }
          }
        }
      } catch {}

      const runningTask = (tasks || []).find((t: any) => {
        if (!runningTaskIds.has(t.id)) return false;
        // Must genuinely be in progress — submitted, under review, or completed tasks can never be running
        if (!isTaskTrulyInProgress(t)) return false;

        const isForThisEmp =
          t.assigneeId === empId ||
          (t.assigneeId && empEmail && t.assigneeId.toLowerCase() === empEmail) ||
          (t.assignee && empFullName && t.assignee.toLowerCase() === empFullName) ||
          (user && (t.assigneeId === user.id || (t.assignee && t.assignee.toLowerCase() === user.fullName?.toLowerCase())));

        return isForThisEmp;
      });

      if (runningTask) {
        return `📝 ${runningTask.title || (runningTask as any).name}`;
      }
    }

    // If no timer is actively running, display 'No active task in progress'
    return 'No active task in progress';
  };

  const getEmployeeStatus = (emp: Employee) => {
    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();

    // Highest priority: an approved leave covering today. Only rows whose date
    // range still includes today are loaded, so a finished leave never matches.
    if (leaveToday.some((l) => l.employee_id === empId)) {
      return { label: '🌴 On Leave', tone: 'warning' as const };
    }

    // Check DB attendance records
    const record = attendanceRecords.find(
      (r) =>
        r.employee_id === empId ||
        (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail) ||
        (user && user.email?.toLowerCase() === empEmail && r.employee_id === user.id)
    );

    // Cross-check break records: If employee has an open break, mark as On Break
    const empBreaks = (todayBreakRecords || []).filter(
      (b: any) => b.employee_id === empId || (user && user.email?.toLowerCase() === empEmail && b.employee_id === user.id)
    );
    const hasOpenBreak = empBreaks.some((b: any) => !b.end_time && !b.endTime);

    if (record?.status === 'on_break' || hasOpenBreak) {
      return { label: '☕ On Break', tone: 'warning' as const };
    }

    if (record) {
      const status = record.status;
      if (status === 'present') return { label: '🟢 Clocked In', tone: 'success' as const };
      if (status === 'clocked_out') return { label: '🔴 Clocked Out', tone: 'danger' as const };
    }

    // If an active task is running for this employee, mark as Clocked In
    const activeTaskStr = getEmployeeActiveTask(emp);
    if (activeTaskStr !== 'No active task in progress') {
      return { label: '🟢 Clocked In', tone: 'success' as const };
    }

    return { label: 'Offline', tone: 'neutral' as const };
  };

  const getEmployeeIdleInfo = (emp: Employee) => {
    // Admin and CEO conduct organizational administration, approvals, and meetings — exempt from task-idle tracking
    const roleUpper = (emp.role || '').toUpperCase();
    const desigUpper = (emp.designation || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'CEO' || desigUpper.includes('ADMIN') || desigUpper.includes('CEO')) {
      return { isIdle: false, idleMinutes: 0 };
    }

    // If the employee is clocked in for a training batch, they are conducting training and are never idle
    if (isEmployeeInTraining(emp)) {
      return { isIdle: false, idleMinutes: 0 };
    }

    const status = getEmployeeStatus(emp);
    if (status.label.includes('On Break') || status.label.includes('On Leave')) {
      return { isIdle: false, idleMinutes: 0 };
    }

    const isClockedIn = status.label.includes('Clocked In');
    if (!isClockedIn) {
      return { isIdle: false, idleMinutes: 0 };
    }

    const activeTask = getEmployeeActiveTask(emp);
    if (activeTask !== 'No active task in progress') {
      return { isIdle: false, idleMinutes: 0 };
    }

    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();
    const isCurrentUser = Boolean(user && (user.id === empId || user.email?.toLowerCase() === empEmail));

    const matchingAttendance = attendanceRecords.filter(
      (r) =>
        r.employee_id === empId ||
        (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail) ||
        (isCurrentUser && user && (r.employee_id === user.id || r.employee_email?.toLowerCase() === user.email?.toLowerCase()))
    );

    const record = matchingAttendance[0];

    // Cross-check break records: If employee is on an open break or record is on_break, they are NOT idle
    const empBreaks = (todayBreakRecords || []).filter(
      (b: any) => b.employee_id === empId || (user && user.email?.toLowerCase() === empEmail && b.employee_id === user.id)
    );
    const hasOpenBreak = empBreaks.some((b: any) => !b.end_time && !b.endTime);
    if (hasOpenBreak || record?.status === 'on_break') {
      return { isIdle: false, idleMinutes: 0 };
    }

    // Determine the active work session's clock-in time (crucial for multi-session days or re-clock-ins)
    const matchingAttIds = new Set(matchingAttendance.map((r) => r.id));
    const activeWs = openWorkSessions.find((ws: any) => matchingAttIds.has(ws.attendance_record_id));
    const activeEmbeddedSession = record && Array.isArray(record.sessions)
      ? record.sessions.find((s: any) => !s.clockOut && !s.clock_out)
      : null;

    // Use current active session's clock_in, then active embedded session, then fallback to first_clock_in
    const clockInIso =
      activeWs?.clock_in ||
      activeWs?.clockIn ||
      activeEmbeddedSession?.clockIn ||
      activeEmbeddedSession?.clock_in ||
      record?.first_clock_in ||
      (record as any)?.firstClockIn;

    if (!clockInIso) {
      return { isIdle: false, idleMinutes: 0 };
    }

    let idleStartMs = new Date(clockInIso).getTime();

    // If there was a previous session clocked out today and no activeWs, prevent idle time before re-clocking in
    if (record?.last_clock_out || (record as any)?.lastClockOut) {
      const lastOutMs = new Date(record.last_clock_out || (record as any).lastClockOut).getTime();
      if (!isNaN(lastOutMs) && lastOutMs > idleStartMs) {
        idleStartMs = lastOutMs;
      }
    }

    // Check if employee completed/paused a task session today after clocking in
    const empFinishedSessions = (todayTaskSessions || []).filter(
      (s: any) => s.employee_id === empId && s.end_time
    );

    if (empFinishedSessions.length > 0) {
      empFinishedSessions.forEach((s: any) => {
        const endMs = new Date(s.end_time).getTime();
        if (!isNaN(endMs) && endMs > idleStartMs) {
          idleStartMs = endMs;
        }
      });
    }

    // Cross-check finished breaks today: If employee was on break, idle time begins AFTER the break ended!
    empBreaks.forEach((b: any) => {
      const endVal = b.end_time || b.endTime;
      if (endVal) {
        const breakEndMs = new Date(endVal).getTime();
        if (!isNaN(breakEndMs) && breakEndMs > idleStartMs) {
          idleStartMs = breakEndMs;
        }
      }
    });

    // Also check if attendance record itself was updated after taking a break
    if (record && (record.total_break_minutes > 0 || record.totalBreakMinutes > 0)) {
      const attUpdatedMs = new Date(record.updated_at || (record as any).updatedAt || '').getTime();
      if (!isNaN(attUpdatedMs) && attUpdatedMs > idleStartMs) {
        idleStartMs = attUpdatedMs;
      }
    }

    const now = Date.now();
    const idleMinutes = Math.max(0, Math.floor((now - idleStartMs) / (1000 * 60)));

    return {
      isIdle: idleMinutes >= 15,
      idleMinutes,
    };
  };

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    designation: 'Senior Technical Trainer',
    dateOfJoining: new Date().toISOString().split('T')[0],
    role: 'EMPLOYEE',
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast({ variant: 'error', title: 'Required Fields', message: 'First name, last name, and email are required.' });
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    try {
    const res = await createEmployee({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      employeeId: form.employeeId.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      designation: form.designation.trim() || 'Employee',
      dateOfJoining: form.dateOfJoining || new Date().toISOString().split('T')[0],
      status: 'active',
    });

    if (res.ok) {
      try {
        await createUser({
          username: form.email.trim(),
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: form.email.trim(),
          role: form.role as any,
        });
      } catch (err) {
        console.warn('Auth user creation note:', err);
      }

      getUsers().then((res) => {
        if (Array.isArray(res)) setUsersList(res);
      });

      toast({
        variant: 'success',
        title: 'Employee Created',
        message: `${form.firstName} ${form.lastName} added. Default password is "password" (reset required on 1st login).`,
      });
      setAddModalOpen(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        designation: 'Senior Technical Trainer',
        dateOfJoining: new Date().toISOString().split('T')[0],
        role: 'EMPLOYEE',
      });
    } else {
      toast({ variant: 'error', title: 'Employee Creation Failed', message: res.error || 'Could not save employee. Check email format and network connection.' });
    }
    } finally {
      savingRef.current = false;
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (savingRef.current) return;
    savingRef.current = true;
    try {
    const res = await updateProfile(editingEmployee.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      employeeId: editForm.employeeId,
      designation: editForm.designation,
      dateOfJoining: editForm.dateOfJoining,
      phone: editForm.phone,
      role: editForm.role,
      status: editForm.status as any,
    });

    if (res.ok) {
      try {
        const u = getEmployeeUser(editingEmployee.email);
        if (u && editForm.role && u.role !== editForm.role) {
          await updateUser(u.id, { role: editForm.role as any });
        }
      } catch (err) {
        console.warn('Auth user role update note:', err);
      }

      getUsers().then((res) => {
        if (Array.isArray(res)) setUsersList(res);
      });

      toast({
        variant: 'success',
        title: 'Employee Updated',
        message: `Updated details for ${editForm.firstName} ${editForm.lastName}.`,
      });
      setEditModalOpen(false);
      setEditingEmployee(null);
    } else {
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: res.error || 'Could not update employee details.',
      });
    }
    } finally {
      savingRef.current = false;
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const names = employees
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => `${e.firstName} ${e.lastName}`)
      .join(', ');
    
    const ok = await confirm({
      title: 'Delete Employees?',
      message: `Are you sure you want to permanently delete ${selectedIds.length} employee(s)?\n\n${names}\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'delete',
    });
    if (!ok) return;

    setBatchDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const emp = employees.find((e) => e.id === id);
      const res = await deleteEmployee(id);
      if (res.ok) {
        successCount++;
        if (emp) {
          try {
            const u = getEmployeeUser(emp.email);
            if (u) await deleteUser(u.id);
          } catch (err) {
            console.warn('Auth user deletion note (batch):', err);
          }
        }
      } else {
        failCount++;
      }
    }

    setBatchDeleting(false);
    setSelectedIds([]);

    if (successCount > 0) {
      toast({
        variant: 'success',
        title: 'Batch Delete Complete',
        message: `${successCount} employee(s) deleted successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      });
    } else {
      toast({ variant: 'error', title: 'Batch Delete Failed', message: 'Could not delete any of the selected employees.' });
    }
  };

  const isStatusView = defaultTabId === 'status';

  const activeCount = useMemo(() => employees.filter((e) => !isRelievedEmployee(e.status)).length, [employees]);
  const relievedCount = useMemo(() => employees.filter((e) => isRelievedEmployee(e.status)).length, [employees]);

  const filtered = useMemo(() => {
    const list = employees.filter((e) => {
      // In Employee Status view, never show relieved / terminated employees
      if (isStatusView) {
        if (isRelievedEmployee(e.status)) return false;
      } else {
        // In Employee Directory view, respect directoryStatusFilter (default: 'active')
        if (directoryStatusFilter === 'active' && isRelievedEmployee(e.status)) return false;
        if (directoryStatusFilter === 'relieved' && !isRelievedEmployee(e.status)) return false;
      }
      return `${e.firstName} ${e.lastName} ${e.employeeId} ${e.designation}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    });
    return sortEmployeesByCode(list);
  }, [employees, isStatusView, directoryStatusFilter, searchTerm]);

  interface IdleItem {
    emp: Employee;
    isIdle: boolean;
    idleMinutes: number;
  }

  const idleEmployees = useMemo<IdleItem[]>(() => {
    if (!isStatusView) return [];
    return filtered
      .map((e) => ({ emp: e, ...getEmployeeIdleInfo(e) }))
      .filter((x): x is IdleItem => x.isIdle);
  }, [filtered, isStatusView, attendanceRecords, activeWorkSessions, todayTaskSessions, todayBreakRecords, openWorkSessions, todayCalendarSessions, batchesList]);

  useEffect(() => {
    if (!user || !isStatusView) return;
    const isAdminOrManager = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';
    if (!isAdminOrManager) return;

    idleEmployees.forEach(({ emp, idleMinutes }: IdleItem) => {
      const notifyKey = `flwdsk_admin_idle_notified_${emp.id}_${todayISO()}`;
      const lastNotified = localStorage.getItem(notifyKey);
      const now = Date.now();
      // Throttle: notify admin once per 15 mins per idle employee
      if (!lastNotified || (now - Number(lastNotified) > 15 * 60 * 1000)) {
        addNotification({
          title: `⚠️ Idle-Time Alert: ${emp.firstName} ${emp.lastName}`,
          message: `${emp.firstName} ${emp.lastName} has been clocked in for ${idleMinutes >= 60 ? `${Math.floor(idleMinutes / 60)}h ${idleMinutes % 60}m` : `${idleMinutes}m`} with no active task in progress.`,
          category: 'system',
          priority: 'high',
        });
        localStorage.setItem(notifyKey, String(now));
      }
    });
  }, [idleEmployees, isStatusView, user, addNotification]);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      render: (r) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={`${r.firstName} ${r.lastName}`} src={r.avatarUrl} size={28} />
          <span style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</span>
        </span>
      ),
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      sortable: true,
      accessor: (r) => r.employeeId,
    },
    {
      key: 'designation',
      header: 'Designation',
      sortable: true,
      accessor: (r) => r.designation,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      accessor: (r) => getEmployeeRole(r.email),
      render: (r) => {
        const role = getEmployeeRole(r.email);
        const tone = role === 'ADMIN' ? 'danger' : role === 'CEO' ? 'success' : role === 'MANAGER' ? 'warning' : 'neutral';
        return (
          <span className={`kvj-badge kvj-badge--${tone}`}>
            {role}
          </span>
        );
      },
    },
    {
      key: 'dateOfJoining',
      header: 'Joining Date',
      sortable: true,
      accessor: (r) => r.dateOfJoining,
      render: (r) => formatDisplayDate(r.dateOfJoining),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const isRelieved = r.status === 'relieved' || r.status === 'terminated';
        const isSuspended = r.status === 'suspended';
        const isOnNotice = r.status === 'on_notice';
        return (
          <span
            className={`kvj-badge kvj-badge--${r.status === 'active' ? 'success' : isRelieved ? 'danger' : 'neutral'}`}
            style={
              isRelieved
                ? { background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.25)', fontWeight: 600 }
                : isSuspended
                  ? { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)', fontWeight: 600 }
                  : isOnNotice
                    ? { background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04', border: '1px solid rgba(234, 179, 8, 0.25)', fontWeight: 600 }
                    : undefined
            }
          >
            {isRelieved ? 'relieved' : r.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setEditingEmployee(r);
              setEditForm({
                firstName: r.firstName,
                lastName: r.lastName,
                email: r.email,
                employeeId: r.employeeId,
                designation: r.designation,
                dateOfJoining: r.dateOfJoining,
                phone: r.phone || '',
                status: r.status,
                role: getEmployeeRole(r.email),
              });
              setEditModalOpen(true);
            }}
          >
            ✏️ Edit
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await resetToDefaultPassword(r.email, `${r.firstName} ${r.lastName}`);
                toast({
                  variant: 'success',
                  title: 'Password Reset',
                  message: `Password for ${r.firstName} reset to default ("password"). Employee will be prompted to set new password on next login.`,
                });
              } catch (err) {
                toast({ variant: 'error', title: 'Reset Failed', message: 'Could not reset password for this employee.' });
              }
            }}
          >
            🔑 Reset Password
          </Button>
          <Button
            size="xs"
            variant="danger"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: 'Delete Employee?',
                message: `Are you sure you want to delete ${r.firstName} ${r.lastName}?`,
                confirmLabel: 'Delete',
                variant: 'delete',
              });
              if (ok) {
                const res = await deleteEmployee(r.id);
                if (res.ok) {
                  try {
                    const u = getEmployeeUser(r.email);
                    if (u) {
                      await deleteUser(u.id);
                    }
                  } catch (err) {
                    console.warn('Auth user deletion note:', err);
                  }
                  toast({ variant: 'success', title: 'Employee Deleted', message: `${r.firstName} ${r.lastName} has been deleted.` });
                } else {
                  toast({ variant: 'error', title: 'Delete Failed', message: res.error || 'Could not delete employee.' });
                }
              }
            }}
          >
            🗑️ Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={defaultTabId === 'status' ? 'Employee Status' : 'Employee Directory'}
        subtitle={
          defaultTabId === 'status'
            ? 'Real-time employee clock-in status, active work tracking, and idle monitoring'
            : 'Manage and view all employee files and profiles'
        }
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Batch Delete — visible only to Admin / CEO / Manager, and only in directory view when rows are selected */}
            {defaultTabId !== 'status' && (
              <Authorize roles={['ADMIN', 'CEO', 'MANAGER']}>
                {selectedIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleBatchDelete}
                    disabled={batchDeleting}
                  >
                    {batchDeleting
                      ? `⏳ Deleting ${selectedIds.length}…`
                      : `🗑️ Delete Selected (${selectedIds.length})`}
                  </Button>
                )}
              </Authorize>
            )}
            {defaultTabId !== 'status' && (
              <Button size="sm" onClick={() => setAddModalOpen(true)}>
                ➕ Add New Employee
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => navigate('/app')}>
              Back to Day
            </Button>
          </div>
        }
      />

      {defaultTabId === 'directory' ? (
        <div>
          <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search directory..." />
            </div>
            <div style={{ display: 'inline-flex', background: 'var(--bg-sunken)', padding: 3, borderRadius: 8, border: '1px solid var(--border)', gap: 2 }}>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('active')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: directoryStatusFilter === 'active' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                  color: directoryStatusFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('relieved')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: directoryStatusFilter === 'relieved' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                  color: directoryStatusFilter === 'relieved' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Relieved ({relievedCount})
              </button>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: directoryStatusFilter === 'all' ? 'var(--brand-primary, #3b82f6)' : 'transparent',
                  color: directoryStatusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                All ({employees.length})
              </button>
            </div>
            {searchTerm && (
              <Button size="sm" variant="secondary" onClick={() => setSearchTerm('')}>
                Clear Filters
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
            selectable
            onSelectionChange={setSelectedIds}
            onRowClick={(r) => navigate(`/app/employees/${r.id}`)}
          />
        </div>
      ) : (
        <div>
          {idleEmployees.length > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 14,
                padding: '12px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                color: '#92400e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#b45309' }}>
                    Idle Alert ({idleEmployees.length} Employee{idleEmployees.length > 1 ? 's' : ''} Clocked In with No Active Task &gt; 15 Mins)
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>
                    {idleEmployees.map((x) => `${x.emp.firstName} ${x.emp.lastName} (${x.idleMinutes >= 60 ? `${Math.floor(x.idleMinutes / 60)}h ${x.idleMinutes % 60}m` : `${x.idleMinutes}m`} idle)`).join(' • ')}
                  </div>
                </div>
              </div>
              <Badge tone="warning">⚠️ 15m+ Idle</Badge>
            </div>
          )}

          <SectionHeader title="Today's Employee Status & Current Work" />
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Employee',
                render: (r: Employee) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={`${r.firstName} ${r.lastName}`} size={28} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{`${r.firstName} ${r.lastName}`}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.designation}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Current Status',
                render: (r: Employee) => {
                  const stat = getEmployeeStatus(r);
                  const idleInfo = getEmployeeIdleInfo(r);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge tone={idleInfo.isIdle ? 'warning' : stat.tone}>
                        {stat.label}
                      </Badge>
                    </div>
                  );
                },
              },
              {
                key: 'activeTask',
                header: 'Current Task In Progress',
                render: (r: Employee) => {
                  const taskName = getEmployeeActiveTask(r);
                  const idleInfo = getEmployeeIdleInfo(r);
                  const isTraining = taskName.includes('🎓') || taskName.toLowerCase().includes('training');
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: isTraining ? 'var(--brand-primary, #6366f1)' : 'var(--text-secondary)',
                          background: isTraining ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          padding: isTraining ? '3px 10px' : '0',
                          borderRadius: isTraining ? 8 : 0,
                          border: isTraining ? '1px solid rgba(99, 102, 241, 0.2)' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {taskName}
                      </span>
                      {idleInfo.isIdle && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#fef3c7',
                            color: '#b45309',
                            fontSize: 11,
                            fontWeight: 700,
                            border: '1px solid #fde68a',
                          }}
                          title={`Clocked in without starting a task for ${idleInfo.idleMinutes} minutes`}
                        >
                          ⚠️ Idle ({idleInfo.idleMinutes >= 60 ? `${Math.floor(idleInfo.idleMinutes / 60)}h ${idleInfo.idleMinutes % 60}m` : `${idleInfo.idleMinutes}m`})
                        </span>
                      )}
                    </div>
                  );
                },
              },
            ]}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
          />
        </div>
      )}

      {/* ADD EMPLOYEE MODAL */}
      <EmployeeFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        employeesList={employees}
        onSave={async (data) => {
          const res = await createEmployee({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            employeeId: data.employeeId,
            designation: data.designation,
            dateOfJoining: data.dateOfJoining,
            phone: data.phone,
            role: data.role,
          } as any);

          if (res.ok) {
            try {
              await createUser({
                username: data.email.trim(),
                fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
                email: data.email.trim(),
                role: data.role as any,
              });
            } catch (err) {
              console.warn('Auth user creation note:', err);
            }

            getUsers().then((uRes) => {
              if (Array.isArray(uRes)) setUsersList(uRes);
            });

            toast({
              variant: 'success',
              title: 'Employee Created',
              message: `${data.firstName} ${data.lastName} added. Default password is "password".`,
            });
            return true;
          } else {
            toast({
              variant: 'error',
              title: 'Employee Creation Failed',
              message: res.error || 'Could not save employee. Check email format and network connection.',
            });
            return false;
          }
        }}
      />

      {/* EDIT EMPLOYEE MODAL */}
      <EmployeeFormModal
        open={editModalOpen && !!editingEmployee}
        onClose={() => {
          setEditModalOpen(false);
          setEditingEmployee(null);
        }}
        employee={editingEmployee}
        employeesList={employees}
        onSave={async (data) => {
          if (!editingEmployee) return false;
          const res = await updateProfile(editingEmployee.id, {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            employeeId: data.employeeId,
            designation: data.designation,
            dateOfJoining: data.dateOfJoining,
            phone: data.phone,
            role: data.role,
            reportingManagerId: data.supervisorId || undefined,
            status: data.status as any,
          });

          if (res.ok) {
            try {
              const u = getEmployeeUser(editingEmployee.email);
              if (u && data.role && u.role !== data.role) {
                await updateUser(u.id, { role: data.role as any });
              }
            } catch (err) {
              console.warn('Auth user role update note:', err);
            }

            getUsers().then((uRes) => {
              if (Array.isArray(uRes)) setUsersList(uRes);
            });

            // Re-fetch directory to reflect status immediately in table
            refresh();

            toast({
              variant: 'success',
              title: 'Employee Updated',
              message: `Updated details for ${data.firstName} ${data.lastName}.`,
            });
            return true;
          } else {
            toast({
              variant: 'error',
              title: 'Update Failed',
              message: res.error || 'Could not update employee details.',
            });
            return false;
          }
        }}
      />
    </AppShell>
  );
}
export default EmployeeDirectory;
