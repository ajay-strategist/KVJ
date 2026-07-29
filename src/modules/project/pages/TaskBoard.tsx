/**
 * KVJ Analytics — Task Dashboard & Approval Workflow (Phase 2 Enterprise Upgrade)
 *
 * Workflow Pipeline per Spec Section 8:
 *  Pending Approval → Approved (To Do) → Accepted → In Progress → Under Review → Completed
 *
 * Rules:
 *  - When an Employee assigns a task, status defaults to 'Pending Approval'.
 *  - Managers/CEO/Admin see a Pending Approval queue with Approve & Reject actions.
 *  - Assigned employees receive a notification and see an "Accept Task" button.
 *  - Workflow status pipeline strip rendered on every task card.
 */

import { useMemo, useState, useEffect } from 'react';
import { PageHeader, Card, Button, Badge, WorkflowStrip } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { todayISO, addDaysISO } from '../../../shared/utils/date';

import { useProject } from '../hooks/useProject';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';

export type TaskStatus = 'Pending Approval' | 'To Do' | 'In Progress' | 'Under Review' | 'Completed';

export interface TaskItem {
  id: string;
  name: string;
  category: 'Office Task' | 'Project Task';
  projectName?: string;
  supervisor: string;
  assignee: string;
  dueDate: string;
  status: TaskStatus;
  totalHoursWorked: number;
  approvedBy?: string;
  approvedAt?: string;
  acceptedAt?: string;
  approvalStatus?: string | null;
  reworkNotes?: string;
  assigneeId?: string;
  dailyTimeEntries: Array<{
    id: string;
    date: string;
    loggedByRole: 'Assignee' | 'Supervisor';
    loggedByName: string;
    durationHrs: number;
    description: string;
    status: 'Pending Review' | 'Approved';
  }>;
}

export function TaskBoard({
  projectData,
  selectedEmployeeId,
}: {
  projectData?: any;
  selectedEmployeeId?: string;
}) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { can } = usePermissions();
  const isSupervisorRole = can('task', 'approve');

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [dateWindowFilter, setDateWindowFilter] = useState<'next_3_days' | 'today' | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const todayStr = useMemo(() => todayISO(), []);

  const [tasksList, setTasksList] = useState<TaskItem[]>([]);

  const localProjectData = useProject();
  const actualProjectData = projectData || localProjectData;
  const {
    projects,
    tasks,
    allocations,
    timesheets,
    createTask,
    updateTask,
    submitTask,
    requestRework,
    approveTaskSubmission,
    requestTaskAssignment,
    approveTaskAssignment,
    logTimesheet,
    approveTimesheet
  } = actualProjectData;


  // Active timers tracking in localStorage
  const [timers, setTimers] = useState<Record<string, { startTime: number; elapsedMs: number; isRunning: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('kvj_task_timers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kvj_task_timers', JSON.stringify(timers));
    } catch {}
  }, [timers]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getTaskDurationString = (taskId: string) => {
    const timer = timers[taskId];
    if (!timer) return '00:00:00';
    let totalMs = timer.elapsedMs;
    if (timer.isRunning) {
      totalMs += Date.now() - timer.startTime;
    }
    const totalSecs = Math.floor(totalMs / 1000);
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const getTaskDurationHours = (taskId: string) => {
    const timer = timers[taskId];
    if (!timer) return 0;
    let totalMs = timer.elapsedMs;
    if (timer.isRunning) {
      totalMs += Date.now() - timer.startTime;
    }
    return Math.round((totalMs / 3600000) * 10) / 10;
  };
  const { employees } = useEmployee();

  const mappedTasks = useMemo(() => {
    return tasks.map((t: any) => {
      const project = projects.find((p: any) => p.id === t.projectId);
      const assignee = employees.find((e) => e.id === t.assigneeId);
      
      const pSupervisorId = project ? (project as any).supervisorId : null;
      const tSupervisorId = t.supervisorId;
      const supervisorId = pSupervisorId || tSupervisorId;
      const supervisorEmp = supervisorId ? employees.find((e) => e.id === supervisorId) : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName} (Project Supervisor)` : '';

      const tTimesheets = timesheets.filter((ts: any) => ts.taskId === t.id);
      const totalHoursWorked = tTimesheets.reduce((sum: number, ts: any) => sum + ts.hoursLogged, 0);

      const dailyTimeEntries = tTimesheets.map((ts: any) => {
        const emp = employees.find((e) => e.id === ts.employeeId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member';
        const isSuper = emp ? (emp.designation.toLowerCase().includes('manager') || emp.designation.toLowerCase().includes('ceo') || emp.designation.toLowerCase().includes('lead')) : false;
        return {
          id: ts.id,
          date: ts.workDate,
          loggedByRole: isSuper ? ('Supervisor' as const) : ('Assignee' as const),
          loggedByName: name,
          durationHrs: ts.hoursLogged,
          description: ts.notes || 'Daily work progress entry',
          status: ts.status === 'approved' ? ('Approved' as const) : ('Pending Review' as const),
        };
      });

      let status: TaskStatus = 'To Do';
      if (t.approvalStatus === 'pending_assignment_approval') status = 'Pending Approval';
      else if (t.status === 'in_progress') status = 'In Progress';
      else if (t.status === 'review') status = 'Under Review';
      else if (t.status === 'done') status = 'Completed';

      return {
        id: t.id,
        name: t.title,
        category: 'Project Task' as const,
        projectName: project ? project.title : 'General Project',
        supervisor: supervisorName,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
        dueDate: t.dueDate || todayStr,
        status,
        totalHoursWorked,
        dailyTimeEntries,
        approvalStatus: t.approvalStatus,
        reworkNotes: t.reworkNotes,
        assigneeId: t.assigneeId,
      };
    });
  }, [tasks, projects, employees, allocations, timesheets, todayStr]);

  useEffect(() => {
    setTasksList(mappedTasks);
  }, [mappedTasks]);

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const [selectedAssignee, setSelectedAssignee] = useState<string>(isManagement ? 'all' : (user?.fullName || 'me'));

  const windowEnd = useMemo(() => addDaysISO(3), []);

  const pendingApprovalTasks = useMemo(
    () => tasksList.filter((t) => t.status === 'Pending Approval'),
    [tasksList]
  );

  const sortedTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const myName = (user?.fullName || '').toLowerCase();

    const filtered = tasksList.filter((t) => {
      if (t.status === 'Pending Approval') return false;

      // User-level filtering
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        const isTarget = t.assigneeId === selectedEmployeeId;
        if (!isTarget) return false;
      } else if (!isManagement) {
        const isMyTask =
          t.assigneeId === user?.id ||
          t.assignee.toLowerCase() === myName ||
          t.supervisor.toLowerCase() === myName ||
          t.approvedBy?.toLowerCase() === myName;
        if (!isMyTask) return false;
      } else if (selectedAssignee !== 'all') {
        const target = selectedAssignee.toLowerCase();
        const matchesTarget =
          t.assignee.toLowerCase() === target ||
          t.supervisor.toLowerCase() === target;
        if (!matchesTarget) return false;
      }

      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      // Date Window Filtering
      if (dateWindowFilter === 'today') {
        if (t.dueDate !== todayStr) return false;
        if (t.status === 'Completed' || t.status === 'Under Review') return false; // Hide submitted/completed tasks from "Due Today" list
      } else if (dateWindowFilter === 'next_3_days') {
        if (t.dueDate < todayStr || t.dueDate > windowEnd) return false;
      }
      if (query) {
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesAssignee = t.assignee.toLowerCase().includes(query);
        const matchesProj = (t.projectName || '').toLowerCase().includes(query);
        if (!matchesName && !matchesAssignee && !matchesProj) return false;
      }
      return true;
    });

    return filtered.sort((a, b) =>
      sortOrder === 'asc' ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate)
    );
  }, [tasksList, isManagement, selectedAssignee, user, categoryFilter, dateWindowFilter, sortOrder, searchQuery, todayStr, windowEnd]);

  const handleCreateTask = async (values: Record<string, unknown>) => {
    const proj = projects.find((p: any) => p.title === values.projectName || p.id === values.projectId);
    const assignee = employees.find((e) => `${e.firstName} ${e.lastName}` === values.assignee || e.id === values.assigneeId);

    const isOtherAssignee = assignee && assignee.id !== user?.id;
    const approvalStatus = (!isManagement && isOtherAssignee) ? 'pending_assignment_approval' : null;

    const supervisor = employees.find((e) => `${e.firstName} ${e.lastName}` === values.supervisor);

    const res = await createTask({
      projectId: proj?.id,
      assigneeId: assignee?.id,
      supervisorId: supervisor?.id,
      title: values.name as string,
      status: 'todo',
      dueDate: (values.dueDate as string) || todayStr,
      priority: 'medium',
      approvalStatus,
      assignedByEmployeeId: user?.id,
    } as any);

    if (res.ok) {
      const statusLabel = approvalStatus ? 'Pending Approval' : 'To Do';
      const newTaskItem: TaskItem = {
        id: res.value.id,
        name: res.value.title,
        category: (values.category as any) || 'Project Task',
        projectName: proj ? proj.title : (values.projectName as string) || 'General Project',
        supervisor: (values.supervisor as string) || '',
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : (values.assignee as string) || user?.fullName || 'Unassigned',
        dueDate: res.value.dueDate || todayStr,
        status: statusLabel as any,
        totalHoursWorked: 0,
        dailyTimeEntries: [],
      };
      setTasksList((prev) => [newTaskItem, ...prev]);
      toast({ 
        variant: approvalStatus ? 'warning' : 'success', 
        title: approvalStatus ? 'Assignment Pending' : 'Task Created', 
        message: approvalStatus 
          ? `Assignment request for "${values.name}" sent to manager queue.` 
          : `Task "${values.name}" created.` 
      });
      setCreateTaskOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const handleApproveTask = async (id: string) => {
    setTasksList((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'To Do' } : x))
    );
    try {
      await updateTask(id, { status: 'todo' });
    } catch (e) {}
    toast({ variant: 'success', title: 'Task Approved', message: 'Task is now active in To Do queue.' });
  };

  const handleRejectTask = async (id: string) => {
    setTasksList((prev) => prev.filter((x) => x.id !== id));
    toast({ variant: 'warning', title: 'Task Rejected', message: 'Task creation request rejected.' });
  };

  const handleStartTask = async (task: TaskItem) => {
    const updatedAssignee = (task.assignee && task.assignee !== 'Unassigned') ? task.assignee : (user?.fullName || 'Assigned User');
    setTasksList((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, status: 'In Progress', assignee: updatedAssignee } : x))
    );
    setTimers(prev => ({
      ...prev,
      [task.id]: {
        startTime: Date.now(),
        elapsedMs: prev[task.id]?.elapsedMs || 0,
        isRunning: true
      }
    }));
    try {
      await updateTask(task.id, { status: 'in_progress', approvalStatus: null });
    } catch (e) {
      console.warn('Update task error:', e);
    }
    toast({ variant: 'success', title: 'Task Started', message: `Task "${task.name}" is now In Progress.` });
  };

  const handlePauseTask = (taskId: string) => {
    const timer = timers[taskId];
    if (!timer || !timer.isRunning) return;
    setTimers(prev => ({
      ...prev,
      [taskId]: {
        startTime: Date.now(),
        elapsedMs: prev[taskId].elapsedMs + (Date.now() - prev[taskId].startTime),
        isRunning: false
      }
    }));
    toast({ variant: 'info', title: 'Task Paused', message: 'Work timer has been paused.' });
  };

  const handleSubmitTaskForApproval = async (task: TaskItem) => {
    // Pause timer if running
    if (timers[task.id]?.isRunning) {
      setTimers(prev => ({
        ...prev,
        [task.id]: {
          startTime: Date.now(),
          elapsedMs: prev[task.id].elapsedMs + (Date.now() - prev[task.id].startTime),
          isRunning: false
        }
      }));
    }
    setTasksList((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, status: 'Under Review' } : x))
    );
    const res = await submitTask(task.id as UUID, 'Submitted for review');
    if (res.ok) {
      toast({ variant: 'success', title: 'Task Submitted', message: `Task "${task.name}" is now Under Review.` });
    } else {
      toast({ variant: 'error', title: 'Submission Failed', message: res.error });
      setTasksList((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, status: task.status } : x)) // Revert on failure
      );
    }
  };

  const handleApproveTaskSubmission = async (task: TaskItem) => {
    setTasksList((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: 'Completed' } : x)));
    const res = await approveTaskSubmission(task.id as UUID);
    if (res.ok) {
      toast({ variant: 'success', title: 'Task Approved', message: `Task "${task.name}" is now Completed.` });
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleRequestRework = async (task: TaskItem, notes: string) => {
    setTasksList((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: 'In Progress', approvalStatus: 'rework', reworkNotes: notes } : x)));
    const res = await requestRework(task.id as UUID, notes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Rework Requested', message: `Task "${task.name}" sent back for rework.` });
    } else {
      toast({ variant: 'error', title: 'Rework Failed', message: res.error });
    }
  };

  const handleAssignToMe = async (task: TaskItem) => {
    const myName = user?.fullName || 'Admin User';
    setTasksList((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, assignee: myName } : x))
    );
    try {
      await updateTask(task.id, { assigneeId: user?.id });
    } catch (e) {
      console.warn('Update task error:', e);
    }
    toast({ variant: 'success', title: 'Task Assigned', message: `Assigned task "${task.name}" to ${myName}.` });
  };

  const handleMarkComplete = async (task: TaskItem) => {
    const isApprover = ['ADMIN', 'CEO', 'MANAGER'].includes(user?.role || '');
    if (isApprover) {
      setTasksList((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, status: 'Completed' } : x))
      );
      try {
        await updateTask(task.id, { status: 'done', approvalStatus: 'approved' });
      } catch (e) {
        console.warn('Update task error:', e);
      }
      toast({ variant: 'success', title: 'Task Completed', message: `Task "${task.name}" marked complete.` });
    } else {
      setTasksList((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, status: 'Under Review' } : x))
      );
      const res = await submitTask(task.id as UUID, 'Submitted for completion approval');
      if (res.ok) {
        toast({
          variant: 'success',
          title: 'Submitted for Review',
          message: `Task "${task.name}" submitted to Manager/Admin Approval Queue.`,
        });
      } else {
        toast({ variant: 'error', title: 'Submission Failed', message: res.error });
        setTasksList((prev) =>
          prev.map((x) => (x.id === task.id ? { ...x, status: task.status } : x))
        );
      }
    }
  };

  const handleReopenTask = async (task: TaskItem) => {
    setTasksList((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, status: 'In Progress' } : x))
    );
    try {
      await updateTask(task.id, { status: 'in_progress' });
    } catch (e) {
      console.warn('Update task error:', e);
    }
    toast({ variant: 'info', title: 'Task Reopened', message: `Task "${task.name}" moved back to In Progress.` });
  };

  const handleLogDailyTime = async (values: Record<string, unknown>) => {
    if (!selectedTask) return;
    const duration = Number(values.durationHrs) || 1.0;

    const repoTask = tasks.find((t: any) => t.id === selectedTask.id);
    if (!repoTask) return;

    const res = await logTimesheet({
      projectId: repoTask.projectId,
      taskId: repoTask.id,
      employeeId: user?.id,
      workDate: (values.date as string) || todayStr,
      hoursLogged: duration,
      notes: (values.description as string) || 'Daily work progress entry',
      status: 'submitted',
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Time Entry Logged', message: 'Time entry submitted for review.' });
      // Reset timer on success
      setTimers(prev => {
        const next = { ...prev };
        delete next[selectedTask.id];
        return next;
      });
      setTimeEntryOpen(false);
    } else {
      toast({ variant: 'error', title: 'Logging Failed', message: res.error });
    }
  };

  const handleUpdateTaskSubmit = async (values: Record<string, unknown>) => {
    if (!editingTask) return;
    const updatedName = (values.name as string) || editingTask.name;
    const updatedCategory = (values.category as any) || editingTask.category;
    const updatedProjectName = (values.projectName as string) || editingTask.projectName;
    const updatedAssignee = (values.assignee as string) || editingTask.assignee;
    const updatedSupervisor = (values.supervisor as string) || editingTask.supervisor;
    const updatedDueDate = (values.dueDate as string) || editingTask.dueDate;
    const updatedStatus = (values.status as TaskStatus) || editingTask.status;

    setTasksList((prev) =>
      prev.map((t) =>
        t.id === editingTask.id
          ? {
              ...t,
              name: updatedName,
              category: updatedCategory,
              projectName: updatedProjectName,
              assignee: updatedAssignee,
              supervisor: updatedSupervisor,
              dueDate: updatedDueDate,
              status: updatedStatus,
            }
          : t
      )
    );

    const dbStatusMap: Record<string, 'todo' | 'in_progress' | 'review' | 'done'> = {
      'Pending Approval': 'todo',
      'To Do': 'todo',
      'In Progress': 'in_progress',
      'Under Review': 'review',
      'Completed': 'done',
    };

    try {
      const assigneeEmp = employees.find((e) => `${e.firstName} ${e.lastName}` === updatedAssignee);
      const supervisorEmp = employees.find((e) => `${e.firstName} ${e.lastName}` === updatedSupervisor);
      await updateTask(editingTask.id, {
        title: updatedName,
        dueDate: updatedDueDate,
        assigneeId: assigneeEmp ? assigneeEmp.id : undefined,
        supervisorId: supervisorEmp ? supervisorEmp.id : undefined,
        status: dbStatusMap[updatedStatus] || 'todo',
      });
    } catch (e) {
      console.warn('DB task update warning:', e);
    }

    toast({ variant: 'success', title: 'Task Updated', message: `Task "${updatedName}" updated successfully.` });
    setEditTaskOpen(false);
    setEditingTask(null);
  };

  const dueTodayCount = tasksList.filter((t) => t.dueDate === todayStr && t.status !== 'Pending Approval' && t.status !== 'Completed' && t.status !== 'Under Review').length;
  const totalHoursSum = tasksList.reduce((acc, t) => acc + t.totalHoursWorked, 0);

  const getWorkflowStep = (status: TaskStatus, approvalStatus?: string | null) => {
    if (approvalStatus === 'pending_assignment_approval') return 'Pending Approval';
    if (approvalStatus === 'pending_task_approval') return 'Under Review';
    switch (status) {
      case 'Pending Approval': return 'Pending Approval';
      case 'To Do': return 'Approved (To Do)';
      case 'In Progress': return 'In Progress';
      case 'Under Review': return 'Under Review';
      case 'Completed': return 'Completed';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Task Operations & Approval Workflow"
        subtitle="Manage office & project tasks, task creation approval, assignee acceptance, and time entry reviews"
        actions={<Button onClick={() => setCreateTaskOpen(true)}>➕ Create Task</Button>}
      />

      {/* ── Pending Task Approvals Banner (Managers/CEO/Admin) ── */}
      {isSupervisorRole && pendingApprovalTasks.length > 0 && (
        <Card style={{ borderLeft: '4px solid var(--status-warning)', background: 'var(--status-warning-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Pending Task Creation Approvals ({pendingApprovalTasks.length})
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Approval required before work begins</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingApprovalTasks.map((pt) => (
              <div
                key={pt.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  gap: 12, flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{pt.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Assigned to: <strong>{pt.assignee}</strong> · Category: {pt.category} · Due: {pt.dueDate}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="xs" variant="success" onClick={() => handleApproveTask(pt.id)}>Approve Task</Button>
                  <Button size="xs" variant="danger" onClick={() => handleRejectTask(pt.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tasks Active</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{sortedTasks.length} Tasks</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-danger)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Due Today</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-danger)', marginTop: 4 }}>📌 {dueTodayCount} Due Today</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--accent)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Hours Logged</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>⏱ {totalHoursSum.toFixed(1)} hrs</div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card style={{ padding: '14px 18px', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <input
              type="text"
              placeholder="🔍 Search tasks, assignees, or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 14px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isManagement ? (
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">👥 All Employees (Tasks)</option>
                {user?.fullName && <option value={user.fullName}>👤 My Tasks ({user.fullName})</option>}
                {employees.map((e) => {
                  const name = `${e.firstName} ${e.lastName}`;
                  if (name === user?.fullName) return null;
                  return <option key={e.id} value={name}>{name}</option>;
                })}
              </select>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)', border: '1px solid var(--border)', color: 'var(--brand)' }}>
                👤 {user?.fullName || 'My Tasks Only'}
              </span>
            )}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="all">📂 All Categories</option>
              <option value="Office Task">🏢 Office Task</option>
              <option value="Project Task">🚀 Project Task</option>
            </select>

            <select
              value={dateWindowFilter}
              onChange={(e) => setDateWindowFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="all">📅 All Tasks</option>
              <option value="next_3_days">⏳ Next 3 Days Window</option>
              <option value="today">📌 Due Today</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="asc">DueDate: Ascending ⬆</option>
              <option value="desc">DueDate: Descending ⬇</option>
            </select>

            {(searchQuery || categoryFilter !== 'all' || dateWindowFilter !== 'all') && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setDateWindowFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Task Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sortedTasks.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active tasks found in the selected filter window.
          </Card>
        ) : (
          sortedTasks.map((t) => {
            const isAssignee = user?.fullName === t.assignee || !user;
            return (
              <Card key={t.id} style={{ padding: 18, borderLeft: `4px solid ${t.dueDate === todayStr ? 'var(--status-danger)' : 'var(--brand)'}` }}>
                {/* Workflow step pipeline */}
                <div style={{ marginBottom: 12 }}>
                  <WorkflowStrip
                    steps={['Pending Approval', 'Approved (To Do)', 'In Progress', 'Under Review', 'Completed']}
                    current={getWorkflowStep(t.status, t.approvalStatus)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</h3>
                      <Badge tone={t.category === 'Project Task' ? 'info' : 'neutral'}>{t.category}</Badge>
                      {t.dueDate === todayStr && <Badge tone="danger">Due Today</Badge>}
                      {t.approvalStatus === 'rework' && <Badge tone="danger">🔄 Rework</Badge>}
                      {t.approvalStatus === 'pending_assignment_approval' && <Badge tone="warning">⏳ Pending Assignment Approval</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Project: <strong>{t.projectName}</strong> · Assignee: <strong>{t.assignee}</strong>{t.supervisor ? <> · Supervisor: <strong>{t.supervisor}</strong></> : null}
                    </div>
                    {t.approvedBy && (
                      <div style={{ fontSize: 11, color: 'var(--status-success)', marginTop: 3 }}>
                        ✓ Approved by {t.approvedBy} {t.approvedAt && `(${t.approvedAt})`}
                      </div>
                    )}
                    {/* Active Timer Display */}
                    {t.status === 'In Progress' && (
                      <div style={{ marginTop: 6, fontSize: 12, color: timers[t.id]?.isRunning ? 'var(--status-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <span>⏱️ Active Work Timer:</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', background: 'var(--bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>{getTaskDurationString(t.id)}</span>
                        {timers[t.id]?.isRunning ? <span style={{ fontSize: 10 }}>● Running</span> : <span style={{ fontSize: 10 }}>Paused</span>}
                      </div>
                    )}
                    {t.approvalStatus === 'rework' && t.reworkNotes && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 12, fontWeight: 500 }}>
                        <strong>🔄 Rework Reason:</strong> {t.reworkNotes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Action 1: Assign to Me */}
                    {t.assignee === 'Unassigned' && (
                      <Button size="sm" variant="secondary" onClick={() => handleAssignToMe(t)}>
                        👤 Assign to Me
                      </Button>
                    )}

                    {/* Action 2: Start / Resume Task */}
                    {(t.status === 'To Do' || t.status === 'Pending Approval' || t.approvalStatus === 'rework') && (
                      <Button size="sm" variant="success" onClick={() => handleStartTask(t)}>
                        ▶️ {timers[t.id]?.elapsedMs ? 'Resume' : 'Start'} Task
                      </Button>
                    )}

                    {/* Action: Pause Task */}
                    {t.status === 'In Progress' && timers[t.id]?.isRunning && (
                      <Button size="sm" variant="secondary" onClick={() => handlePauseTask(t.id)}>
                        ⏸️ Pause Task
                      </Button>
                    )}

                    {/* Action: Resume Task */}
                    {t.status === 'In Progress' && !timers[t.id]?.isRunning && (
                      <Button size="sm" variant="success" onClick={() => handleStartTask(t)}>
                        ▶️ Resume Task
                      </Button>
                    )}

                    {/* Action 3: Log Hours */}
                    {t.status === 'In Progress' && (
                      <Button size="sm" onClick={() => { setSelectedTask(t); setTimeEntryOpen(true); }}>
                        ⏱ Log Time
                      </Button>
                    )}

                    {/* Action: Submit Task for Review */}
                    {t.status === 'In Progress' && (
                      <Button size="sm" variant="secondary" onClick={() => handleSubmitTaskForApproval(t)}>
                        🚀 Submit Task
                      </Button>
                    )}

                    {/* Action 4: Mark Complete */}
                    {t.status === 'In Progress' && isManagement && (
                      <Button size="sm" variant="secondary" onClick={() => handleMarkComplete(t)}>
                        ✓ Mark Complete
                      </Button>
                    )}

                    {/* Action: Approve Task (Manager) */}
                    {t.status === 'Under Review' && isManagement && (
                      <Button size="sm" variant="success" onClick={() => handleApproveTaskSubmission(t)}>
                        ✅ Approve
                      </Button>
                    )}

                    {/* Action: Rework Task (Manager) */}
                    {t.status === 'Under Review' && isManagement && (
                      <Button size="sm" variant="danger" onClick={() => {
                        const notes = prompt("Enter rework reason:");
                        if (notes) handleRequestRework(t, notes);
                      }}>
                        🔄 Rework
                      </Button>
                    )}

                    {/* Action 5: Reopen Task */}
                    {t.status === 'Completed' && (
                      <Button size="sm" variant="secondary" onClick={() => handleReopenTask(t)}>
                        ↩️ Reopen
                      </Button>
                    )}

                    {/* Action 6: Edit Task */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingTask(t);
                        setEditTaskOpen(true);
                      }}
                    >
                      ✏️ Edit
                    </Button>
                  </div>
                </div>

                {/* Time log entries summary */}
                {t.dailyTimeEntries.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Time Log History ({t.totalHoursWorked.toFixed(1)} hrs total):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {t.dailyTimeEntries.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: 11.5, padding: '4px 8px', background: 'var(--bg-sunken)',
                            borderRadius: 'var(--radius-xs)',
                          }}
                        >
                          <span>{e.date} · <strong>{e.loggedByName}</strong> ({e.loggedByRole}): {e.description}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.durationHrs} hrs</span>
                            <Badge tone={e.status === 'Approved' ? 'success' : 'warning'}>{e.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Create Task Drawer */}
      <Drawer open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Create New Task">
        <Form initial={{ category: 'Office Task', dueDate: todayStr }} onSubmit={handleCreateTask}>
          <TextField name="name" label="Task Title *" placeholder="e.g. Q3 Power BI Syllabus Audit" />
          <SelectField
            name="category"
            label="Category *"
            options={[
              { value: 'Office Task', label: 'Office Task' },
              { value: 'Project Task', label: 'Project Task' },
            ]}
          />
          <TextField name="projectName" label="Project Name / Department" placeholder="e.g. Academic Training" />
          <SelectField
            name="assignee"
            label="Assignee Name"
            options={[{ value: '', label: 'Unassigned' }, ...employees.map((e) => ({ value: `${e.firstName} ${e.lastName}`, label: `${e.firstName} ${e.lastName}` }))]}
          />
          <SelectField
            name="supervisor"
            label="Supervisor Name"
            options={[{ value: '', label: 'None' }, ...employees.map((e) => ({ value: `${e.firstName} ${e.lastName}`, label: `${e.firstName} ${e.lastName}` }))]}
          />
          <TextField name="dueDate" label="Due Date (YYYY-MM-DD)" placeholder={todayStr} />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Task</Button>
          </div>
        </Form>
      </Drawer>

      {/* Log Time Drawer */}
      <Drawer open={timeEntryOpen} onClose={() => setTimeEntryOpen(false)} title={`Log Time: ${selectedTask?.name ?? ''}`}>
        <Form initial={{ date: todayStr, durationHrs: '1.0' }} onSubmit={handleLogDailyTime}>
          <TextField name="date" label="Entry Date" placeholder={todayStr} />
          <TextField name="durationHrs" label="Duration (Hours)" placeholder="e.g. 2.5" />
          <TextField name="description" label="Work Progress Description" placeholder="Described completed work..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setTimeEntryOpen(false)}>Cancel</Button>
            <Button type="submit">Log Time Entry</Button>
          </div>
        </Form>
      </Drawer>

      {/* Edit Task Drawer */}
      <Drawer open={editTaskOpen} onClose={() => { setEditTaskOpen(false); setEditingTask(null); }} title={`Edit Task: ${editingTask?.name ?? ''}`}>
        {editingTask && (
          <Form
            initial={{
              name: editingTask.name,
              category: editingTask.category,
              projectName: editingTask.projectName || '',
              assignee: editingTask.assignee || '',
              supervisor: editingTask.supervisor || '',
              dueDate: editingTask.dueDate || todayStr,
              status: editingTask.status,
            }}
            onSubmit={handleUpdateTaskSubmit}
          >
            <TextField name="name" label="Task Title *" placeholder="Task title..." />
            <SelectField
              name="category"
              label="Category *"
              options={[
                { value: 'Office Task', label: 'Office Task' },
                { value: 'Project Task', label: 'Project Task' },
              ]}
            />
            <TextField name="projectName" label="Project Name / Department" placeholder="Project name..." />
            <SelectField
              name="assignee"
              label="Assignee Name"
              options={employees.length > 0 ? employees.map((e) => ({ value: `${e.firstName} ${e.lastName}`, label: `${e.firstName} ${e.lastName}` })) : [{ value: editingTask.assignee, label: editingTask.assignee }]}
            />
            <SelectField
              name="supervisor"
              label="Supervisor Name"
              options={employees.length > 0 ? employees.map((e) => ({ value: `${e.firstName} ${e.lastName}`, label: `${e.firstName} ${e.lastName}` })) : [{ value: editingTask.supervisor, label: editingTask.supervisor }]}
            />
            <TextField name="dueDate" label="Due Date (YYYY-MM-DD)" placeholder={todayStr} />
            <SelectField
              name="status"
              label="Task Status *"
              options={[
                { value: 'Pending Approval', label: 'Pending Approval' },
                { value: 'To Do', label: 'Approved (To Do)' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Under Review', label: 'Under Review' },
                { value: 'Completed', label: 'Completed' },
              ]}
            />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => { setEditTaskOpen(false); setEditingTask(null); }}>Cancel</Button>
              <Button type="submit">Save Task Changes</Button>
            </div>
          </Form>
        )}
      </Drawer>
    </div>
  );
}

export default TaskBoard;
