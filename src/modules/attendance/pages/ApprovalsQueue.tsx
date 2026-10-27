import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, SectionHeader, Button, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useLeave } from '../../leave/hooks/useLeave';
import { useProject } from '../../project/hooks/useProject';
import { useMemo } from 'react';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { LeaveRecord } from '../../leave/leave.repository';
import type { Employee } from '../../employee/employee.repository';
import Drawer from '../../../shared/ui/Drawer';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { formatDateTime, formatDisplayDate, localDateTimeToUtcIso } from '../../../shared/utils/date';
import { supabase } from '../../../shared/integration/supabase';
import { ForceClockOutModal } from '../forms/ForceClockOutModal';
import { useBreakpoint } from '../../../shared/hooks/responsive';
import { useTaskSessions, getSessionNotesMap } from '../../project/hooks/useTaskSessions';
import { TaskWorklogUpdatesDrawer } from '../../project/components/TaskWorklogUpdatesDrawer';

export function ApprovalsQueue() {
  const { user } = useAuth();
  const { pendingApprovals, allLeaves, approveLeave, rejectLeave, refreshPending } = useLeave();
  const { tasks, projects, approveTaskSubmission, requestRework, approveTaskAssignment, deleteTask, refresh: refreshProjects } = useProject();
  const [reworkTask, setReworkTask] = useState<any | null>(null);
  const [reworkNotes, setReworkNotes] = useState('');
  const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
  const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
  const { confirm } = useDialog();
  const { toast } = useNotifications();

  const [corrections, setCorrections] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [unclosedSessions, setUnclosedSessions] = useState<any[]>([]);
  const [selectedUnclosedRecord, setSelectedUnclosedRecord] = useState<any | null>(null);
  const [forceClockOutTime, setForceClockOutTime] = useState('17:30');
  const [forceClockOutNotes, setForceClockOutNotes] = useState('');
  
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [selectedReviewTask, setSelectedReviewTask] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  
  // Worklog updates from task sessions
  const { listSessions } = useTaskSessions();
  const [taskSessions, setTaskSessions] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    listSessions().then((sessions) => {
      if (active && Array.isArray(sessions)) setTaskSessions(sessions);
    }).catch(() => {});
    return () => { active = false; };
  }, [listSessions]);

  const getTaskUpdates = useCallback((taskId?: string) => {
    if (!taskId) return [];
    const sessionNotesMap = getSessionNotesMap();
    const sessions = (taskSessions || []).filter(
      (s: any) => s.taskId === taskId || s.task_id === taskId
    );
    sessions.sort((a: any, b: any) => {
      const tA = new Date(a.startTime || a.start_time || 0).getTime();
      const tB = new Date(b.startTime || b.start_time || 0).getTime();
      return tB - tA;
    });
    return sessions.map((s: any) => {
      const note = (s.notes && s.notes.trim()) || sessionNotesMap[s.id] || (s as any).description || '';
      return {
        ...s,
        resolvedNote: note,
      };
    });
  }, [taskSessions]);

  const getLatestTaskUpdate = useCallback((taskId?: string) => {
    if (!taskId) return '';
    const updates = getTaskUpdates(taskId);
    const withNote = updates.find((u) => Boolean(u.resolvedNote));
    return withNote ? withNote.resolvedNote : '';
  }, [getTaskUpdates]);
  
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isExecutive = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const canApprove = isExecutive;
  const isDesktop = useBreakpoint('md');

  const canApproveTaskItem = useCallback((t: any) => {
    if (!t) return false;
    const roleUpper = (user?.role || '').toUpperCase();
    const isAdminCeoOrManager = roleUpper === 'ADMIN' || roleUpper === 'CEO' || roleUpper === 'MANAGER';
    if (!user?.id) return false;

    // 1. Assignment approval
    if (t.approvalStatus === 'pending_assignment_approval') {
      const isPeerAssignment = Boolean(
        t.assignedByEmployeeId &&
        t.assigneeId &&
        t.assignedByEmployeeId !== t.assigneeId
      );

      // Rule: If an employee assigned a task to another employee, ONLY Admin / CEO / Manager can approve.
      // (Project Supervisor cannot approve peer assignments).
      if (isPeerAssignment) {
        return isAdminCeoOrManager;
      }

      // Self-assigned Project Task: Project Supervisor OR Admin / CEO / Manager can approve
      if (isAdminCeoOrManager) return true;

      const safeProjects = Array.isArray(projects) ? projects : [];
      const proj = safeProjects.find((p: any) => p.id === t.projectId);
      const projSupId = (proj as any)?.supervisorId || (proj as any)?.supervisor_id;
      const isProjSupervisor = Boolean(
        projSupId && (projSupId === user.id || String(projSupId).toLowerCase() === String(user.id).toLowerCase()) &&
        user.id !== t.assigneeId
      );

      return isProjSupervisor;
    }

    // 2. Task completion / review approval
    if (isAdminCeoOrManager) return true;

    const safeProjects = Array.isArray(projects) ? projects : [];
    const proj = safeProjects.find((p: any) => p.id === t.projectId);
    const projSupId = (proj as any)?.supervisorId || (proj as any)?.supervisor_id;
    const isProjSupervisor = Boolean(
      projSupId && (projSupId === user.id || String(projSupId).toLowerCase() === String(user.id).toLowerCase())
    );

    const isTaskSupervisor = Boolean(
      (t.supervisorId && (t.supervisorId === user.id || String(t.supervisorId).toLowerCase() === String(user.id).toLowerCase()) && t.supervisorId !== t.assigneeId)
    );

    let isNameMatchSupervisor = false;
    if (!isProjSupervisor && !isTaskSupervisor && typeof t.supervisor === 'string' && t.supervisor && t.supervisor !== '—' && t.supervisor !== 'None') {
      const myName = (user.fullName || '').trim().toLowerCase();
      if (myName && t.supervisor.trim().toLowerCase() === myName && t.assigneeId !== user.id) {
        isNameMatchSupervisor = true;
      }
    }

    return isProjSupervisor || isTaskSupervisor || isNameMatchSupervisor;
  }, [user?.id, user?.role, user?.fullName, projects]);

  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending_task_approval' | 'pending_assignment_approval' | 'over_7_days'>('all');
  const [taskBatchProcessing, setTaskBatchProcessing] = useState(false);

  const pendingAssignmentTasks = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    return safeTasks.filter((t) => {
      if (t.deletedAt || t.approvalStatus !== 'pending_assignment_approval') return false;
      // Row Level Security: Only tasks under the supervisor's purview
      return canApproveTaskItem(t);
    });
  }, [tasks, canApproveTaskItem]);

  const filteredTaskApprovals = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return safeTasks.filter((t) => {
      if (!t || t.deletedAt) return false;
      // Row Level Security: Non-supervisors cannot see tasks they do not supervise
      if (!canApproveTaskItem(t)) return false;

      const isPendingTask = t.approvalStatus === 'pending_task_approval' || t.status === 'review';
      const isPendingAssign = t.approvalStatus === 'pending_assignment_approval';
      if (!isPendingTask && !isPendingAssign) return false;

      if (taskStatusFilter === 'pending_task_approval') {
        return isPendingTask;
      }
      if (taskStatusFilter === 'pending_assignment_approval') {
        return isPendingAssign;
      }
      if (taskStatusFilter === 'over_7_days') {
        if (!isPendingTask) return false;
        const submitted = t.submittedAt || t.createdAt || t.updatedAt;
        if (!submitted) return false;
        return now - new Date(submitted).getTime() >= sevenDaysMs;
      }
      return true;
    });
  }, [tasks, taskStatusFilter, canApproveTaskItem]);

  /** Task Completion items that have been waiting in the queue for >= 7 days (used for banner). */
  const over7DaysTasks = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return safeTasks.filter((t) => {
      if (!t || t.deletedAt) return false;
      if (!canApproveTaskItem(t)) return false;
      const isPendingTask = t.approvalStatus === 'pending_task_approval' || t.status === 'review';
      if (!isPendingTask) return false;
      const submitted = t.submittedAt || t.createdAt || t.updatedAt;
      if (!submitted) return false;
      return now - new Date(submitted).getTime() >= sevenDaysMs;
    });
  }, [tasks, canApproveTaskItem]);

  const fetchUnclosedSessions = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('flwdsk_attendance_records')
        .select('*')
        .neq('status', 'clocked_out')
        .lte('work_date', today)
        .is('deleted_at', null)
        .order('work_date', { ascending: false });

      if (data) setUnclosedSessions(data);
    } catch (e) {
      console.warn('Error fetching unclosed sessions:', e);
    }
  }, []);

  const fetchCorrectionsAndEmployees = useCallback(async () => {
    try {
      if (isExecutive) {
        const cRes = await attService.listPendingCorrections();
        if (cRes.ok && Array.isArray(cRes.value)) setCorrections(cRes.value);
      }

      const eRes = await empService.listEmployees();
      if (eRes.ok && Array.isArray(eRes.value)) {
        const map: Record<string, Employee> = {};
        eRes.value.forEach((e) => { if (e && e.id) map[e.id] = e; });
        setEmployees(map);
      }
      if (isExecutive) {
        fetchUnclosedSessions();
      }
    } catch (e) {
      console.warn('ApprovalsQueue fetch error:', e);
    }
  }, [attService, empService, fetchUnclosedSessions, isExecutive]);

  useEffect(() => {
    fetchCorrectionsAndEmployees();
  }, [fetchCorrectionsAndEmployees, pendingApprovals]);

  const empName = (empId?: string) => {
    if (!empId) return 'Unknown Employee';
    const emp = employees[empId];
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
  };

  const getSupervisorName = (t: any) => {
    if (!t) return '—';
    const safeProjects = Array.isArray(projects) ? projects : [];
    const proj = safeProjects.find((p) => p.id === t.projectId);
    const projSupId = (proj as any)?.supervisorId || (proj as any)?.supervisor_id;

    // 1. Project Supervisor takes primary precedence for project tasks
    if (projSupId && employees[projSupId]) {
      const emp = employees[projSupId];
      return `${emp.firstName} ${emp.lastName}`;
    }

    // 2. Task-level supervisor ID (if assigned and NOT the assignee themselves)
    const taskSupId = t.supervisorId || t.supervisor_id;
    if (taskSupId && taskSupId !== t.assigneeId && employees[taskSupId]) {
      const emp = employees[taskSupId];
      return `${emp.firstName} ${emp.lastName}`;
    }

    // 3. String supervisor on task (if valid and NOT the assignee's name)
    const assigneeEmp = employees[t.assigneeId];
    const assigneeName = assigneeEmp ? `${assigneeEmp.firstName} ${assigneeEmp.lastName}`.trim().toLowerCase() : '';
    if (typeof t.supervisor === 'string' && t.supervisor && t.supervisor !== '—' && t.supervisor !== 'None') {
      if (!assigneeName || t.supervisor.trim().toLowerCase() !== assigneeName) {
        return t.supervisor;
      }
    }

    // 4. Assigned by employee (only if assignor is NOT the assignee)
    const assignorId = t.assignedByEmployeeId || t.assigned_by_employee_id;
    if (assignorId && assignorId !== t.assigneeId && employees[assignorId]) {
      const emp = employees[assignorId];
      return `${emp.firstName} ${emp.lastName}`;
    }
    if (typeof t.assignedBy === 'string' && t.assignedBy) {
      if (!assigneeName || t.assignedBy.trim().toLowerCase() !== assigneeName) {
        return t.assignedBy;
      }
    }

    // 5. Fallback project supervisor if empName resolves
    if (projSupId) {
      const fallback = empName(projSupId);
      if (fallback !== 'Unknown Employee') return fallback;
    }

    return '—';
  };

  const [selectedLeaveIds, setSelectedLeaveIds] = useState<string[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const handleBatchApproveLeave = async () => {
    if (selectedLeaveIds.length === 0) return;
    const ok = await confirm({
      title: 'Batch Approve Leave Requests?',
      message: `Are you sure you want to approve ${selectedLeaveIds.length} selected leave requests?`,
    });
    if (!ok) return;

    setBatchProcessing(true);
    let successCount = 0;
    for (const id of selectedLeaveIds) {
      const res = await approveLeave(id, 'Batch approved');
      if (res.ok) successCount++;
    }
    setBatchProcessing(false);
    setSelectedLeaveIds([]);
    toast({
      variant: 'success',
      title: 'Batch Approval Complete',
      message: `${successCount} leave request(s) approved successfully.`,
    });
    refreshPending();
  };

  const handleApproveLeave = async () => {
    if (!selectedLeave) return;
    const ok = await confirm({ title: 'Approve Request?', message: 'Are you sure you want to approve this leave?' });
    if (!ok) return;

    const res = await approveLeave(selectedLeave.id, notes);
    if (res.ok) {
      toast({ variant: 'success', title: 'Leave Approved' });
      setSelectedLeave(null);
      setNotes('');
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeave) return;
    const ok = await confirm({ title: 'Reject Request?', message: 'Are you sure you want to reject this leave?' });
    if (!ok) return;

    const res = await rejectLeave(selectedLeave.id, notes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Leave Rejected' });
      setSelectedLeave(null);
      setNotes('');
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error });
    }
  };

  const handleApproveCorrection = async () => {
    if (!selectedCorrection) return;
    const ok = await confirm({ title: 'Approve Correction?', message: 'This will modify the employee\'s attendance record.' });
    if (!ok) return;

    const res = await attService.approveCorrection(selectedCorrection.id, { id: user!.id, role: user!.role }, notes);
    if (res.ok) {
      toast({ variant: 'success', title: 'Correction Approved' });
      setSelectedCorrection(null);
      setNotes('');
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error.message });
    }
  };

  const handleRejectCorrection = async () => {
    if (!selectedCorrection) return;
    const ok = await confirm({ title: 'Reject Correction?', message: 'Are you sure you want to reject this correction request?' });
    if (!ok) return;

    const res = await attService.rejectCorrection(selectedCorrection.id, { id: user!.id, role: user!.role }, notes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Correction Rejected' });
      setSelectedCorrection(null);
      setNotes('');
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error.message });
    }
  };

  /** Inline Accept/Reject straight from the queue row (no drawer needed). */
  const handleDecideLeave = async (rec: LeaveRecord, decision: 'accept' | 'reject') => {
    const accept = decision === 'accept';
    const ok = await confirm({
      title: accept ? 'Accept Request?' : 'Reject Request?',
      message: `Are you sure you want to ${accept ? 'accept' : 'reject'} this leave request?`,
    });
    if (!ok) return;

    const res = accept ? await approveLeave(rec.id) : await rejectLeave(rec.id);
    if (res.ok) {
      toast({
        variant: accept ? 'success' : 'warning',
        title: accept ? 'Leave Accepted' : 'Leave Rejected',
      });
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Action Failed', message: res.error });
    }
  };

  /** Inline Accept/Reject for a missed-clock-in (attendance correction) request. */
  const handleDecideCorrection = async (rec: any, decision: 'accept' | 'reject') => {
    const accept = decision === 'accept';
    const ok = await confirm({
      title: accept ? 'Accept Correction?' : 'Reject Correction?',
      message: accept
        ? "This will back-fill the employee's attendance record."
        : 'Are you sure you want to reject this correction request?',
    });
    if (!ok) return;

    const actor = { id: user?.id || 'emp-admin', role: user?.role || 'ADMIN' };
    const res = accept
      ? await attService.approveCorrection(rec.id, actor)
      : await attService.rejectCorrection(rec.id, actor);

    if (res.ok) {
      toast({
        variant: accept ? 'success' : 'warning',
        title: accept ? 'Correction Accepted' : 'Correction Rejected',
      });
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Action Failed', message: res.error.message });
    }
  };

  
  const handleApproveAssignmentInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const ok = await confirm({
      title: 'Approve Assignment?',
      message: `Confirm assigning task "${projTitle}: ${task.title}"?`,
    });
    if (!ok) return;

    const res = await approveTaskAssignment(task.id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Assignment Approved' });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleRejectAssignmentInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const ok = await confirm({
      title: 'Reject Assignment?',
      message: `Confirm rejecting task "${projTitle}: ${task.title}"?`,
    });
    if (!ok) return;

    const res = await deleteTask(task.id);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Assignment Rejected', message: `Task "${task.title}" was rejected and removed.` });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error });
    }
  };

  const handleApproveTaskInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const latestNote = getLatestTaskUpdate(task.id);
    const ok = await confirm({
      title: 'Evaluate Task Completion?',
      message: `Evaluate and approve completed work for task "${projTitle}: ${task.title}"?${latestNote ? `\n\n📝 Assignee Update: "${latestNote}"` : ''}`,
    });
    if (!ok) return;

    const res = await approveTaskSubmission(task.id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Task Evaluated & Approved' });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Evaluation Failed', message: res.error });
    }
  };

  const handleReworkTaskInline = (task: any) => {
    setReworkTask(task);
    setReworkNotes('');
  };

  const submitRework = async () => {
    if (!reworkTask || !reworkNotes.trim()) return;
    const res = await requestRework(reworkTask.id, reworkNotes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Rework Requested', message: 'Task sent back for rework.' });
      setReworkTask(null);
      setReworkNotes('');
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Rework Failed', message: res.error });
    }
  };

  const handleApproveAllOver7Days = async () => {
    if (over7DaysTasks.length === 0) return;
    const ok = await confirm({
      title: `Approve All Tasks Waiting > 7 Days?`,
      message: `This will approve ${over7DaysTasks.length} Task Completion request(s) that have been pending for more than 7 days. Continue?`,
    });
    if (!ok) return;

    setTaskBatchProcessing(true);
    let successCount = 0;
    for (const task of over7DaysTasks) {
      const res = await approveTaskSubmission(task.id);
      if (res.ok) successCount++;
    }
    setTaskBatchProcessing(false);
    toast({
      variant: 'success',
      title: 'Bulk Approval Complete',
      message: `${successCount} task(s) approved successfully.`,
    });
    refreshProjects();
  };

  const handleApproveAllPendingTasks = async () => {
    if (filteredTaskApprovals.length === 0) return;
    const ok = await confirm({
      title: `Bulk Approve All ${filteredTaskApprovals.length} Pending Tasks?`,
      message: `Are you sure you want to approve all ${filteredTaskApprovals.length} pending task(s) in this list?`,
    });
    if (!ok) return;

    setTaskBatchProcessing(true);
    let successCount = 0;
    for (const task of filteredTaskApprovals) {
      if (task.approvalStatus === 'pending_assignment_approval') {
        const res = await approveTaskAssignment(task.id);
        if (res.ok) successCount++;
      } else {
        const res = await approveTaskSubmission(task.id);
        if (res.ok) successCount++;
      }
    }
    setTaskBatchProcessing(false);
    toast({
      variant: 'success',
      title: 'Bulk Task Approval Complete',
      message: `${successCount} task approval(s) processed successfully.`,
    });
    refreshProjects();
  };

  const taskApprovalColumns: Column<any>[] = [
    {
      key: 'task',
      header: 'Project: Task',
      accessor: (r) => r.title,
      render: (r) => {
        const proj = projects.find((p) => p.id === r.projectId);
        const projTitle = proj ? proj.title : 'Office Task';
        return (
          <span>
            <strong>{projTitle}</strong>: {r.title}
          </span>
        );
      },
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (r) => {
        const emp = Object.values(employees).find(e => e.id === r.assigneeId);
        return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
      }
    },
    {
      key: 'supervisor',
      header: 'Supervisor',
      render: (r) => getSupervisorName(r),
    },
    {
      key: 'type',
      header: 'Approval Type',
      render: (r) => {
        const isAssignment = r.approvalStatus === 'pending_assignment_approval';
        return (
          <span
            style={{
              color: isAssignment ? 'var(--status-warning)' : 'var(--status-success)',
              fontWeight: 600,
              display: 'inline-block',
              maxWidth: 100,
              whiteSpace: 'normal',
              lineHeight: 1.3,
            }}
          >
            {isAssignment ? 'Assignment Approval' : 'Task Completion'}
          </span>
        );
      }
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (r) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {formatDisplayDate(r.startDate || r.createdAt)}
        </span>
      ),
    },
    {
      key: 'endDate',
      header: 'End Date',
      render: (r) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {formatDisplayDate(r.dueDate || r.endDate)}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => {
        const hrs = r.actualHours || r.totalHoursWorked || r.proposedHours || 0;
        return (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
            {Number(hrs).toFixed(1)}
          </span>
        );
      },
    },
    {
      key: 'update',
      header: 'Assignee Update',
      render: (r) => {
        if (!r || !r.id) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>;
        const latest = getLatestTaskUpdate(r.id);
        const updates = getTaskUpdates(r.id);
        const hasNote = Boolean(latest && latest.trim());
        return (
          <div style={{ maxWidth: 220 }}>
            {hasNote ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReviewTask(r);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  maxWidth: 200,
                  textAlign: 'left',
                }}
                title={`Click to view all worklog updates (${updates.length} session${updates.length > 1 ? 's' : ''}): ${latest}`}
              >
                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 500 }}>
                  📝 {latest}
                </span>
                {updates.length > 1 && (
                  <span style={{ fontSize: 10, background: 'var(--brand)', color: '#fff', borderRadius: 10, padding: '1px 5px', fontWeight: 700 }}>
                    {updates.length}
                  </span>
                )}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (r) => {
        if (r.approvalStatus === 'pending_assignment_approval') {
          const emp = Object.values(employees).find(e => e.id === r.assignedByEmployeeId);
          return emp ? `${emp.firstName} ${emp.lastName}` : 'System / Employee';
        }
        const emp = Object.values(employees).find(e => e.id === r.submittedBy || e.id === r.assigneeId);
        return emp ? `${emp.firstName} ${emp.lastName}` : 'Assignee';
      }
    },
    {
      key: 'submittedAt',
      header: 'Submitted Time',
      render: (r) => {
        const dtStr = formatDateTime(r.submittedAt || r.createdAt || r.updatedAt);
        if (!dtStr || dtStr === '—') return '—';
        const parts = dtStr.split(' ');
        if (parts.length >= 2) {
          const datePart = parts[0];
          const timePart = parts.slice(1).join(' ');
          return (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{datePart}</span>
              <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>{timePart}</span>
            </div>
          );
        }
        return <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{dtStr}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!r) return null;
        const canApproveThis = canApproveTaskItem(r);

        if (!canApproveThis) {
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setSelectedReviewTask(r)}>
                View Updates
              </Button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Supervisor / Admin Rights Required</span>
            </div>
          );
        }
        if (r.approvalStatus === 'pending_assignment_approval') {
          return (
            <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => handleApproveAssignmentInline(r)}>Approve Assignment</Button>
              <Button size="sm" variant="danger" onClick={() => handleRejectAssignmentInline(r)}>Reject</Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setSelectedReviewTask(r)}>
              📋 Updates
            </Button>
            <Button size="sm" variant="evaluate" onClick={() => handleApproveTaskInline(r)}>Evaluate</Button>
            <Button size="sm" variant="danger" onClick={() => handleReworkTaskInline(r)}>Rework</Button>
          </div>
        );
      }
    }
  ];

  const leaveColumns: Column<LeaveRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => empName(r.employeeId),
    },
    {
      key: 'type',
      header: 'Leave Type',
      accessor: (r) => r.leaveType,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => `${r.startDate} to ${r.endDate}`,
    },
    {
      key: 'balance',
      header: 'Leave Balance',
      render: (r: LeaveRecord) => {
        const empLeaves = (allLeaves || pendingApprovals || []).filter((l: LeaveRecord) => l.employeeId === r.employeeId && l.status === 'approved');
        const count = empLeaves.reduce((acc: number, l: LeaveRecord) => acc + (l.halfDay ? 0.5 : 1), 0);
        const empObj = Object.values(employees || {}).find((e: Employee) => e.id === r.employeeId);
        const alloc = empObj?.leaveAllocationPerMonth ?? 1;
        const now = new Date();
        const monthsElapsed = now.getMonth() >= 3 ? (now.getMonth() - 3 + 1) : (12 - 3 + now.getMonth() + 1);
        const totalAlloc = alloc * monthsElapsed;
        const rem = Math.max(0, totalAlloc - count);
        return (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: rem > 0 ? '#166534' : '#dc2626' }}>
            {rem} days left ({totalAlloc} alloc)
          </span>
        );
      }
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => r.reason,
    },
    {
      key: 'submittedAt',
      header: 'Submitted Time',
      render: (r) => {
        const dtStr = formatDateTime(r.createdAt || r.updatedAt);
        if (!dtStr || dtStr === '—') return '—';
        const parts = dtStr.split(' ');
        if (parts.length >= 2) {
          const datePart = parts[0];
          const timePart = parts.slice(1).join(' ');
          return (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{datePart}</span>
              <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>{timePart}</span>
            </div>
          );
        }
        return <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{dtStr}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!canApprove) {
          return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleDecideLeave(r, 'accept')}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleDecideLeave(r, 'reject')}>Reject</Button>
          </div>
        );
      },
    },
  ];

  const correctionColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => empName(r.requestedBy),
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (r) => r.requestedDate,
    },
    {
      key: 'field',
      header: 'Field',
      accessor: (r) => {
        if (r.fieldToCorrect === 'firstClockIn') return 'First Clock In';
        if (r.fieldToCorrect === 'lastClockOut') return 'Last Clock Out';
        if (r.fieldToCorrect === 'attendance_claim') return 'Attendance Claim';
        return r.fieldToCorrect;
      },
    },
    {
      key: 'proposed',
      header: 'Proposed Time',
      accessor: (r) => r.proposedValue,
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => r.reason,
    },
    {
      key: 'submittedAt',
      header: 'Submitted Time',
      render: (r) => {
        const dtStr = formatDateTime(r.createdAt || r.created_at || r.updatedAt || r.requestedDate);
        if (!dtStr || dtStr === '—') return '—';
        const parts = dtStr.split(' ');
        if (parts.length >= 2) {
          const datePart = parts[0];
          const timePart = parts.slice(1).join(' ');
          return (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{datePart}</span>
              <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>{timePart}</span>
            </div>
          );
        }
        return <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{dtStr}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!canApprove) {
          return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleDecideCorrection(r, 'accept')}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleDecideCorrection(r, 'reject')}>Reject</Button>
          </div>
        );
      },
    },
  ];

  const handleConfirmForceClockOut = async () => {
    if (!selectedUnclosedRecord) return;
    const ok = await confirm({
      title: 'Force Clock Out Session?',
      message: 'This will close the open attendance session for past date and set status to clocked out.',
    });
    if (!ok) return;

    const workDate = selectedUnclosedRecord.work_date || selectedUnclosedRecord.workDate;
    const outTimeIso = localDateTimeToUtcIso(workDate, forceClockOutTime || '17:30');
    const res = await attService.forceClockOutSession(
      selectedUnclosedRecord.id,
      outTimeIso,
      forceClockOutNotes,
      { id: user!.id, role: user!.role }
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Session Closed', message: 'Attendance session force clocked out.' });
      setSelectedUnclosedRecord(null);
      setForceClockOutNotes('');
      fetchUnclosedSessions();
    } else {
      toast({ variant: 'error', title: 'Force Clock Out Failed', message: res.error.message });
    }
  };

  const unclosedColumns: Column<any>[] = [
    {
      key: 'workDate',
      header: 'Date',
      render: (r) => formatDisplayDate(r.work_date || r.workDate),
    },
    {
      key: 'employee',
      header: 'Employee Name',
      render: (r) => empName(r.employee_id || r.employeeId),
    },
    {
      key: 'clockIn',
      header: 'Clock In Time',
      render: (r) => formatDateTime(r.first_clock_in || r.firstClockIn),
    },
    {
      key: 'workType',
      header: 'Work Mode',
      render: (r) => (r.sessions?.[0]?.workType || r.work_type || 'Office'),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!canApprove) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read Only</span>;
        return (
          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setSelectedUnclosedRecord(r); }}>
            🔴 Force Clock Out
          </Button>
        );
      },
    },
  ];

  const tabs = [
    {
      id: 'tasks',
      label: `Task Approvals (${filteredTaskApprovals.length})`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* TASK-014 Banner Card for Pending Task Assignment Approvals */}
          {pendingAssignmentTasks.length > 0 && (
            <div style={{ background: 'var(--brand-muted)', border: '1px solid var(--brand)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚡ Pending Task Creation / Assignment Approvals ({pendingAssignmentTasks.length})</span>
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>Requires Supervisor Approval before starting timer</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingAssignmentTasks.map((t) => {
                  const canApproveThis = canApproveTaskItem(t);
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>{projects.find((p) => p.id === t.projectId)?.title || 'Office Task'}:</strong> {t.title}{' '}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(Supervisor: {getSupervisorName(t)} · Assigned to: {empName(t.assigneeId)})</span>
                      </div>
                      {canApproveThis && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="sm" onClick={() => handleApproveAssignmentInline(t)}>
                            Approve Task
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRejectAssignmentInline(t)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bulk-approve banner for tasks waiting > 7 days */}
          {taskStatusFilter === 'over_7_days' && over7DaysTasks.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'rgba(234, 88, 12, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234, 88, 12, 0.35)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', flex: 1 }}>
                ⏰ {over7DaysTasks.length} Task Completion request(s) have been pending for more than 7 days
              </span>
              <Button
                size="sm"
                onClick={handleApproveAllOver7Days}
                disabled={taskBatchProcessing}
              >
                {taskBatchProcessing ? '⏳ Approving...' : `✓ Approve All (${over7DaysTasks.length})`}
              </Button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
            {filteredTaskApprovals.length > 0 && (
              <Button
                size="sm"
                style={{ background: 'var(--status-success)', color: 'white', fontWeight: 700 }}
                onClick={handleApproveAllPendingTasks}
                disabled={taskBatchProcessing}
              >
                {taskBatchProcessing ? '⏳ Approving...' : `⚡ Bulk Approve All Pending Tasks (${filteredTaskApprovals.length})`}
              </Button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>🔍 Filter Status:</span>
              <select
                className="kvj-select"
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 200 }}
              >
                <option value="all">👥 All Approvals</option>
                <option value="pending_task_approval">📝 Task Completion Approvals</option>
                <option value="pending_assignment_approval">📌 Assignment Approvals</option>
                <option value="over_7_days">⏰ Waiting &gt; 7 Days</option>
              </select>
            </div>
          </div>
          {filteredTaskApprovals.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                No Pending Task Approvals
              </div>
              <div style={{ fontSize: 13 }}>
                {isExecutive 
                  ? 'There are currently no tasks awaiting assignment approval or evaluation across the company.'
                  : 'You do not have any tasks currently pending under your supervision.'}
              </div>
            </div>
          ) : (
            <DataTable
              columns={taskApprovalColumns}
              rows={filteredTaskApprovals}
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelectedReviewTask(r)}
            />
          )}
        </div>
      ),
    },
    ...(isExecutive ? [
      {
        id: 'leaves',
        label: `Leave Applications (${pendingApprovals.length})`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedLeaveIds.length > 0 && canApprove && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--brand-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                {selectedLeaveIds.length} leave request(s) selected
              </span>
              <Button size="sm" onClick={handleBatchApproveLeave} disabled={batchProcessing}>
                {batchProcessing ? '⏳ Approving...' : `✓ Batch Approve Selected (${selectedLeaveIds.length})`}
              </Button>
            </div>
          )}
          <DataTable
            columns={leaveColumns}
            rows={pendingApprovals}
            rowKey={(r) => r.id}
            selectable={canApprove}
            onSelectionChange={setSelectedLeaveIds}
            onRowClick={(r) => setSelectedLeave(r)}
          />
        </div>
      ),
    },
    {
      id: 'corrections',
      label: `Attendance Corrections (${corrections.length})`,
      content: !isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {corrections.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No pending attendance corrections found.
            </div>
          ) : (
            corrections.map((r) => {
              const fieldLabel =
                r.fieldToCorrect === 'firstClockIn' ? 'First Clock In' :
                r.fieldToCorrect === 'lastClockOut' ? 'Last Clock Out' :
                r.fieldToCorrect === 'attendance_claim' ? 'Attendance Claim' :
                r.fieldToCorrect;

              return (
                <div key={r.id} className="kvj-mobile-card" onClick={() => setSelectedCorrection(r)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {empName(r.requestedBy)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Date: <strong>{r.requestedDate}</strong>
                      </div>
                    </div>
                    <Badge tone="warning">Pending Review</Badge>
                  </div>

                  <div style={{ background: 'var(--bg-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                    <div><strong>Field:</strong> {fieldLabel}</div>
                    <div style={{ marginTop: 2 }}><strong>Proposed Time:</strong> {r.proposedValue}</div>
                    {r.reason && <div style={{ marginTop: 2, color: 'var(--text-muted)' }}><strong>Reason:</strong> {r.reason}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                    {canApprove ? (
                      <>
                        <Button size="sm" onClick={() => handleDecideCorrection(r, 'accept')}>
                          Accept
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDecideCorrection(r, 'reject')}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <DataTable
          columns={correctionColumns}
          rows={corrections}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedCorrection(r)}
        />
      ),
    },
    {
      id: 'unclosed',
      label: `Unclosed Sessions (${unclosedSessions.length})`,
      content: !isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {unclosedSessions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No unclosed attendance sessions found.
            </div>
          ) : (
            unclosedSessions.map((r) => (
              <div key={r.id} className="kvj-mobile-card" onClick={() => setSelectedUnclosedRecord(r)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {empName(r.employee_id || r.employeeId)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Work Date: <strong>{formatDisplayDate(r.work_date || r.workDate)}</strong>
                    </div>
                  </div>
                  <Badge tone="danger">Open Session</Badge>
                </div>

                <div style={{ background: 'var(--bg-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                  <div><strong>Clock In:</strong> {formatDateTime(r.first_clock_in || r.firstClockIn)}</div>
                  <div style={{ marginTop: 2 }}><strong>Mode:</strong> {r.sessions?.[0]?.workType || r.work_type || 'Office'}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                  {canApprove ? (
                    <Button size="sm" variant="danger" onClick={() => setSelectedUnclosedRecord(r)}>
                      🔴 Force Clock Out
                    </Button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read Only</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <DataTable
          columns={unclosedColumns}
          rows={unclosedSessions}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedUnclosedRecord(r)}
        />
      ),
    },
  ] : []),
];

  return (
    <AppShell>
      <PageHeader 
        title={isExecutive ? "Pending Approvals Queue" : "Task Approvals Queue"} 
        subtitle={isExecutive ? "Approve or reject leaves, attendance logs, and project tasks" : "Review and approve task assignments and completions under your supervision"} 
      />
      {!isExecutive && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🛡️</span>
          <span><strong>Supervisor Queue:</strong> Displaying task approvals under your direct supervision. You have full authorization to evaluate completions, request rework, and approve new assignments.</span>
        </div>
      )}
      <Tabs items={tabs} />

      {/* Leave Details Drawer */}
      <Drawer open={!!selectedLeave} onClose={() => setSelectedLeave(null)} title="Leave Details Review">
        {selectedLeave && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applicant</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{empName(selectedLeave.employeeId)}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Leave Type</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLeave.leaveType}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duration</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLeave.startDate} to {selectedLeave.endDate}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reason</span>
                <div style={{ fontSize: 13, background: 'var(--bg-sunken)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  {selectedLeave.reason}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Submitted for Approval</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {formatDateTime(selectedLeave.createdAt || selectedLeave.updatedAt)}
                </div>
              </div>
              {selectedLeave.medicalCertUrl && (
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Medical Certificate</span>
                  <div style={{ marginTop: 4 }}>
                    {selectedLeave.medicalCertUrl.includes('http') ? (
                      <a
                        href={selectedLeave.medicalCertUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        📎 View Attached Certificate
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        📎 {selectedLeave.medicalCertUrl}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="kvj-label">Approver Comments</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes to candidate..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 72 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={handleRejectLeave}>Reject Request</Button>
              <Button onClick={handleApproveLeave}>Approve Request</Button>
            </div>
          </div>
        )}
      </Drawer>


      {/* Task Rework Notes Drawer */}
      <Drawer open={!!reworkTask} onClose={() => setReworkTask(null)} title="Request Task Rework">
        {reworkTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                <strong>{projects.find((p) => p.id === reworkTask.projectId)?.title || 'Office Task'}</strong>: {reworkTask.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Submitted for Approval: {formatDateTime(reworkTask.submittedAt || reworkTask.createdAt || reworkTask.updatedAt)}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enter notes and instructions for rework:</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={reworkNotes}
                onChange={(e) => setReworkNotes(e.target.value)}
                placeholder="Type instructions here (e.g., please verify column values)..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 100 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setReworkTask(null)}>Cancel</Button>
              <Button variant="danger" onClick={submitRework} disabled={!reworkNotes.trim()}>Send back for Rework</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Correction Details Drawer */}
      <Drawer open={!!selectedCorrection} onClose={() => setSelectedCorrection(null)} title="Correction Request Review">
        {selectedCorrection && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Employee</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{empName(selectedCorrection.requestedBy)}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Work Date</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedCorrection.requestedDate}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Field to Correct</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {selectedCorrection.fieldToCorrect === 'firstClockIn'
                    ? 'First Clock In'
                    : selectedCorrection.fieldToCorrect === 'lastClockOut'
                    ? 'Last Clock Out'
                    : selectedCorrection.fieldToCorrect === 'attendance_claim'
                    ? 'Attendance Claim'
                    : selectedCorrection.fieldToCorrect}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proposed Time</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>{selectedCorrection.proposedValue}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reason for claim</span>
                <div style={{ fontSize: 13, background: 'var(--bg-sunken)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  {selectedCorrection.reason}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Submitted for Approval</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {formatDateTime(selectedCorrection.createdAt || selectedCorrection.created_at || selectedCorrection.updatedAt || selectedCorrection.requestedDate)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="kvj-label">Approver Comments</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes to employee..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 72 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={handleRejectCorrection}>Reject</Button>
              <Button onClick={handleApproveCorrection}>Approve & Update</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Force Clock Out Modal */}
      <ForceClockOutModal
        open={!!selectedUnclosedRecord}
        onClose={() => setSelectedUnclosedRecord(null)}
        record={selectedUnclosedRecord}
        onSuccess={() => {
          setSelectedUnclosedRecord(null);
          fetchUnclosedSessions();
        }}
      />

      {/* Task Worklog Updates & Review Drawer */}
      {selectedReviewTask && (
        <TaskWorklogUpdatesDrawer
          open={!!selectedReviewTask}
          onClose={() => setSelectedReviewTask(null)}
          task={selectedReviewTask}
          projectName={Array.isArray(projects) ? projects.find((p) => p.id === selectedReviewTask.projectId)?.title : undefined}
          assigneeName={empName(selectedReviewTask.assigneeId)}
          supervisorName={getSupervisorName(selectedReviewTask)}
          workSessions={taskSessions}
          canApprove={canApproveTaskItem(selectedReviewTask)}
          onApprove={async (t) => {
            const res = await approveTaskSubmission(t.id);
            if (res.ok) {
              toast({ variant: 'success', title: 'Task Evaluated & Approved' });
              setSelectedReviewTask(null);
              refreshProjects();
            } else {
              toast({ variant: 'error', title: 'Evaluation Failed', message: res.error });
            }
          }}
          onRequestRework={async (t, notes) => {
            const res = await requestRework(t.id, notes);
            if (res.ok) {
              toast({ variant: 'warning', title: 'Rework Requested', message: 'Task sent back for rework.' });
              setSelectedReviewTask(null);
              refreshProjects();
            } else {
              toast({ variant: 'error', title: 'Rework Failed', message: res.error });
            }
          }}
        />
      )}
    </AppShell>
  );
}
export default ApprovalsQueue;
