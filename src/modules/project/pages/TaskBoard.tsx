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
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { todayISO, addDaysISO } from '../../../shared/utils/date';

import { useProject } from '../hooks/useProject';
import { useTaskSessions } from '../hooks/useTaskSessions';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';
import { taskTimerStore } from '../../../shared/utils/taskTimerStore';

export type TaskStatus = 'Pending Approval' | 'To Do' | 'In Progress' | 'Under Review' | 'Completed';

export interface TaskItem {
  id: string;
  name: string;
  category: 'Office Task' | 'Project Task';
  projectName?: string;
  supervisor: string;
  supervisorId?: string;
  assignee: string;
  dueDate: string;
  startDate?: string;
  description?: string;
  status: TaskStatus;
  totalHoursWorked: number;
  approvedBy?: string;
  approvedAt?: string;
  acceptedAt?: string;
  approvalStatus?: string | null;
  reworkNotes?: string;
  assigneeId?: string;
  assignedByEmployeeId?: string;
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
  const { prompt } = useDialog();
  const { can } = usePermissions();
  const isSupervisorRole = can('task', 'approve');
  // Assignment/creation approval is the CEO's decision (Admin included as the
  // system superuser). Managers can still review finished work below, but they
  // cannot approve who a task is assigned to.
  const canApproveAssignment = ['CEO', 'ADMIN'].includes((user?.role || '').toUpperCase());

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
  const { startSession, pauseSession, completeSession } = useTaskSessions();
  const actualProjectData = projectData || localProjectData;
  const {
    projects,
    tasks,
    allocations,
    timesheets,
    createTask,
    updateTask,
    deleteTask,
    submitTask,
    requestRework,
    approveTaskSubmission,
    requestTaskAssignment,
    approveTaskAssignment,
    logTimesheet,
    approveTimesheet,
    refresh,
  } = actualProjectData;

  const activeProjects = useMemo(() => {
    return (projects || []).filter((p: any) => 
      p.status !== 'Completed' && 
      p.status !== 'completed' && 
      p.status !== 'Closed' && 
      p.status !== 'closed'
    );
  }, [projects]);

  // Active timers tracking synced with taskTimerStore
  const [timers, setTimers] = useState<Record<string, { startTime: number; elapsedMs: number; isRunning: boolean }>>(() => {
    return taskTimerStore.getTimers();
  });

  useEffect(() => {
    const unsubscribe = taskTimerStore.subscribe((updated) => {
      setTimers(updated);
    });
    return unsubscribe;
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    // Refresh running-task durations once a minute, not every second, so the
    // whole Task Board doesn't redraw 60× a minute. Minute precision is enough.
    const interval = setInterval(() => setTick(t => t + 1), 60000);
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
    return `${hrs}h ${mins}m`;
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
      const tSupervisorId = t.supervisorId || t.assignedByEmployeeId;
      const supervisorId = pSupervisorId || tSupervisorId;
      const supervisorEmp = supervisorId ? employees.find((e) => e.id === supervisorId) : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : (t.supervisorName || '');

      const tTimesheets = timesheets.filter((ts: any) => ts.taskId === t.id);
      const timesheetHours = tTimesheets.reduce((sum: number, ts: any) => sum + ts.hoursLogged, 0);
      const totalHoursWorked = t.actualHours && t.actualHours > timesheetHours ? t.actualHours : timesheetHours;

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
      if ((t as any).approvalStatus === 'pending_assignment_approval') {
        status = 'Pending Approval';
      } else if (t.status === 'done' || t.status === 'completed' || (t as any).approvalStatus === 'approved') {
        status = 'Completed';
      } else if (t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval') {
        status = 'Under Review';
      } else if (t.status === 'in_progress' || timers[t.id]?.isRunning) {
        status = 'In Progress';
      } else if ((t as any).approvalStatus === 'rework') {
        status = 'To Do';
      }

      return {
        id: t.id,
        name: t.title || 'Untitled Task',
        // A task with no linked project is an Office Task; otherwise a Project Task.
        category: (t.projectId && project ? 'Project Task' : 'Office Task') as 'Office Task' | 'Project Task',
        projectName: project ? project.title : 'Office Task',
        supervisor: supervisorName,
        supervisorId,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
        assigneeId: t.assigneeId,
        assignedByEmployeeId: t.assignedByEmployeeId,
        dueDate: t.dueDate || todayStr,
        startDate: t.startDate || t.dueDate || todayStr,
        description: t.description || '',
        status,
        totalHoursWorked,
        dailyTimeEntries,
        approvalStatus: t.approvalStatus,
        reworkNotes: t.reworkNotes,
      };
    });
  }, [tasks, projects, employees, allocations, timesheets, todayStr]);

  useEffect(() => {
    setTasksList(mappedTasks);
    // Synchronize global timer store with database actualHours for loaded tasks
    (tasks || []).forEach((t: any) => {
      taskTimerStore.syncTaskTime(t.id, t.actualHours || 0);
    });
  }, [mappedTasks, tasks]);

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

    const filtered = tasksList.filter((t: any) => {
      if (t.status === 'Pending Approval') return false;

      // User-level filtering: Supervisors and assignees both see tasks
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        const isTarget = t.assigneeId === selectedEmployeeId || t.supervisorId === selectedEmployeeId || t.assignedByEmployeeId === selectedEmployeeId;
        if (!isTarget) return false;
      } else if (!isManagement) {
        const isMyTask =
          t.assigneeId === user?.id ||
          t.assigneeId === user?.email ||
          t.supervisorId === user?.id ||
          t.assignedByEmployeeId === user?.id ||
          (t.assignee && t.assignee.toLowerCase() === myName) ||
          (t.supervisor && t.supervisor.toLowerCase().includes(myName)) ||
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
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
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
  }, [tasksList, isManagement, selectedAssignee, user, categoryFilter, statusFilter, dateWindowFilter, sortOrder, searchQuery, todayStr, windowEnd]);

  const handleCreateTask = async (values: Record<string, unknown>) => {
    const categoryVal = (values.category as string) || 'Office Task';
    const isOfficeTask = categoryVal === 'Office Task';

    const assignee = employees.find((e) => e.id === values.assignee || e.id === values.assigneeId);
    const supervisor = employees.find((e) => e.id === values.supervisor || e.id === values.supervisorId);

    if (isOfficeTask && (!supervisor && !values.supervisor)) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        message: 'Supervisor Name is mandatory for Office Tasks.',
      });
      return;
    }

    const proj = isOfficeTask ? null : projects.find((p: any) => p.id === categoryVal);
    const finalSupervisorId = supervisor ? supervisor.id : user?.id;

    const isSelfAssigned = assignee?.id === user?.id || (!assignee && !values.assignee);
    const approvalStatus = (!isSelfAssigned && user?.role?.toUpperCase() !== 'CEO') ? 'pending_assignment_approval' : null;

    const res = await createTask({
      projectId: proj?.id || null,
      assigneeId: assignee?.id || user?.id,
      supervisorId: finalSupervisorId,
      title: values.name as string,
      status: 'todo',
      dueDate: (values.dueDate as string) || todayStr,
      startDate: (values.startDate as string) || (values.dueDate as string) || todayStr,
      description: (values.description as string) || '',
      priority: 'medium',
      approvalStatus,
      assignedByEmployeeId: user?.id,
    } as any);

    if (res.ok) {
      const statusLabel = approvalStatus ? 'Pending Approval' : 'To Do';
      const newTaskItem: TaskItem = {
        id: res.value.id,
        name: res.value.title,
        category: proj ? 'Project Task' : 'Office Task',
        projectName: proj ? proj.title : 'Office Task',
        supervisor: supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : (user?.fullName || ''),
        supervisorId: finalSupervisorId,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : (values.assignee as string) || user?.fullName || 'Unassigned',
        assigneeId: assignee?.id || user?.id,
        assignedByEmployeeId: user?.id,
        dueDate: res.value.dueDate || todayStr,
        startDate: res.value.startDate || res.value.dueDate || todayStr,
        description: res.value.description || '',
        status: statusLabel as any,
        totalHoursWorked: 0,
        dailyTimeEntries: [],
        approvalStatus,
      };
      setTasksList((prev) => [newTaskItem, ...prev]);
      toast({ 
        variant: approvalStatus ? 'warning' : 'success', 
        title: approvalStatus ? 'Assignment Pending Approval' : 'Task Created', 
        message: approvalStatus
          ? `Assignment sent to the CEO for approval.`
          : `Task "${values.name}" created successfully.`
      });
      setCreateTaskOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const handleApproveTask = async (id: string) => {
    setTasksList((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'To Do', approvalStatus: null } : x))
    );
    try {
      const res = await approveTaskAssignment(id as any);
      if (res.ok) {
        toast({ variant: 'success', title: 'Assignment Approved', message: 'Task is now active in assignee\'s To Do queue.' });
      } else {
        toast({ variant: 'error', title: 'Approval Failed', message: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Approval Failed', message: e.message });
    }
  };

  const handleRejectTask = async (id: string) => {
    setTasksList((prev) => prev.filter((x) => x.id !== id));
    toast({ variant: 'warning', title: 'Task Rejected', message: 'Task creation request rejected.' });
  };

  const handleStartTask = async (task: TaskItem) => {
    const updatedAssignee = (task.assignee && task.assignee !== 'Unassigned') ? task.assignee : (user?.fullName || 'Assigned User');
    
    // 1. Pause previously active task in DB and sessions
    const previouslyActive = tasksList.find((x) => x.status === 'In Progress' && x.id !== task.id);
    if (previouslyActive) {
      taskTimerStore.pauseTask(previouslyActive.id);
      const prevTimer = taskTimerStore.getTimer(previouslyActive.id);
      const prevSecs = prevTimer ? Math.floor(prevTimer.elapsedMs / 1000) : 0;
      try {
        await updateTask(previouslyActive.id as UUID, {
          status: 'todo',
          actualHours: prevSecs / 3600,
        });
        await pauseSession(previouslyActive.id as UUID);
      } catch (e) {
        console.warn('Failed to pause previously active task on start:', e);
      }
    }

    setTasksList((prev) =>
      prev.map((x) => {
        if (x.id === task.id) {
          return { ...x, status: 'In Progress', assignee: updatedAssignee };
        } else if (x.status === 'In Progress') {
          return { ...x, status: 'To Do' };
        }
        return x;
      })
    );

    taskTimerStore.startTask(task.id);
    try {
      await updateTask(task.id as UUID, { status: 'in_progress', approvalStatus: null });
      
      const raw = (tasks || []).find((t: any) => t.id === task.id);
      await startSession({
        taskId: task.id as UUID,
        projectId: raw?.projectId,
        workTitle: task.name,
        supervisorId: (raw as any)?.supervisorId,
      });
    } catch (e) {
      console.warn('Update task error:', e);
    }
    toast({ variant: 'success', title: 'Task Started', message: `Task "${task.name}" is now In Progress.` });
  };

  const handlePauseTask = async (taskId: string) => {
    taskTimerStore.pauseTask(taskId);
    const timer = taskTimerStore.getTimer(taskId);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    setTasksList((prev) =>
      prev.map((x) => (x.id === taskId ? { ...x, status: 'To Do' } : x))
    );

    try {
      await updateTask(taskId as UUID, { status: 'todo', actualHours: secondsToday / 3600 });
      await pauseSession(taskId as UUID);
    } catch (e) {
      console.warn('Pause task error:', e);
    }
    toast({ variant: 'info', title: 'Task Paused', message: 'Work timer has been paused.' });
  };

  const handleSubmitTaskForApproval = async (task: TaskItem) => {
    // Pause timer if running via shared store
    taskTimerStore.pauseTask(task.id);
    const timer = taskTimerStore.getTimer(task.id);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    // Save final actualHours to the DB and complete the work session
    try {
      await updateTask(task.id as UUID, { actualHours: secondsToday / 3600 });
      await completeSession(task.id as UUID);
    } catch (e) {
      console.warn('Failed to update task hours on submission:', e);
    }

    setTasksList((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, status: 'Under Review' } : x))
    );
    const res = await submitTask(task.id as UUID, 'Submitted for review');
    if (res.ok) {
      toast({ variant: 'success', title: 'Task Submitted', message: `Task "${task.name}" submitted and requires CEO/Admin/Manager approval to complete the task (Review and Approve).` });
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
    
    // Pause timer and get final hours
    taskTimerStore.pauseTask(task.id);
    const timer = taskTimerStore.getTimer(task.id);
    const secondsToday = timer ? Math.floor(timer.elapsedMs / 1000) : 0;

    if (isApprover) {
      setTasksList((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, status: 'Completed' } : x))
      );
      try {
        await updateTask(task.id as UUID, { status: 'done', approvalStatus: 'approved', actualHours: secondsToday / 3600 });
        await completeSession(task.id as UUID);
      } catch (e) {
        console.warn('Update task error:', e);
      }
      toast({ variant: 'success', title: 'Task Completed', message: `Task "${task.name}" marked complete.` });
    } else {
      try {
        await updateTask(task.id as UUID, { actualHours: secondsToday / 3600 });
        await completeSession(task.id as UUID);
      } catch (e) {
        console.warn('Failed to update task hours on completion request:', e);
      }

      setTasksList((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, status: 'Under Review' } : x))
      );
      const res = await submitTask(task.id as UUID, 'Submitted for completion approval');
      if (res.ok) {
        toast({
          variant: 'success',
          title: 'Submitted for Review',
          message: `Task "${task.name}" submitted and requires CEO/Admin/Manager approval to complete the task (Review and Approve).`,
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
      // Reset timer via shared store on success
      taskTimerStore.resetTask(selectedTask.id);
      setTimeEntryOpen(false);
    } else {
      toast({ variant: 'error', title: 'Logging Failed', message: res.error });
    }
  };

  const handleUpdateTaskSubmit = async (values: Record<string, unknown>) => {
    if (!editingTask) return;
    const updatedName = (values.name as string) || editingTask.name;
    const categoryVal = (values.category as string) || 'Office Task';
    const isOfficeTask = categoryVal === 'Office Task';

    // Assignee/Supervisor selects carry employee ids as their value.
    const updatedAssigneeId = (values.assignee as string) ?? editingTask.assigneeId ?? '';
    const updatedSupervisorId = (values.supervisor as string) ?? editingTask.supervisorId ?? '';
    const updatedDueDate = (values.dueDate as string) || editingTask.dueDate;
    const updatedStatus = (values.status as TaskStatus) || editingTask.status;

    const assigneeEmp = employees.find((e) => e.id === updatedAssigneeId);
    const supervisorEmp = employees.find((e) => e.id === updatedSupervisorId);

    if (isOfficeTask && (!supervisorEmp && !updatedSupervisorId)) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        message: 'Supervisor Name is mandatory for Office Tasks.',
      });
      return;
    }

    const proj = isOfficeTask ? null : projects.find((p: any) => p.id === categoryVal);
    const updatedCategory = proj ? 'Project Task' : 'Office Task';
    const updatedProjectName = proj ? proj.title : 'Office Task';
    const updatedProjectId = proj ? proj.id : null;

    const updatedAssignee = assigneeEmp ? `${assigneeEmp.firstName} ${assigneeEmp.lastName}` : editingTask.assignee;
    const updatedSupervisor = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : editingTask.supervisor;

    setTasksList((prev) =>
      prev.map((t) =>
        t.id === editingTask.id
          ? {
              ...t,
              name: updatedName,
              category: updatedCategory as any,
              projectName: updatedProjectName,
              assignee: updatedAssignee,
              assigneeId: assigneeEmp ? assigneeEmp.id : t.assigneeId,
              supervisor: updatedSupervisor,
              supervisorId: supervisorEmp ? supervisorEmp.id : t.supervisorId,
              dueDate: updatedDueDate,
              startDate: (values.startDate as string) || (values.dueDate as string) || todayStr,
              description: (values.description as string) || '',
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
      const res = await updateTask(editingTask.id, {
        title: updatedName,
        projectId: updatedProjectId || null,
        dueDate: updatedDueDate,
        startDate: (values.startDate as string) || (values.dueDate as string) || todayStr,
        description: (values.description as string) || '',
        assigneeId: assigneeEmp ? assigneeEmp.id : undefined,
        supervisorId: supervisorEmp ? supervisorEmp.id : undefined,
        status: dbStatusMap[updatedStatus] || 'todo',
      });

      if (res.ok) {
        // Re-fetch from DB to ensure consistent state (prevents tasks disappearing
        // if a DB-side approval recalculation changes the record)
        await refresh();
      }
    } catch (e) {
      console.warn('DB task update warning:', e);
    }

    toast({ variant: 'success', title: 'Task Updated', message: `Task "${updatedName}" updated successfully.` });
    setEditTaskOpen(false);
    setEditingTask(null);
  };

  const dueTodayCount = tasksList.filter((t) => t.dueDate === todayStr && t.status !== 'Pending Approval' && t.status !== 'Completed' && t.status !== 'Under Review').length;
  const totalHoursSum = tasksList.reduce((acc, t) => acc + Math.max(getTaskDurationHours(t.id), t.totalHoursWorked), 0);

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        <Button onClick={() => setCreateTaskOpen(true)}>➕ Create Task</Button>
      </div>

      {/* ── Pending Task Assignment Approvals Banner (CEO/Admin only) ── */}
      {canApproveAssignment && pendingApprovalTasks.length > 0 && (
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <Card padding="compact" style={{ borderLeft: '4px solid var(--brand)', width: 200, flex: '0 0 200px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tasks Active</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{sortedTasks.length} Tasks</div>
        </Card>

        <Card padding="compact" style={{ borderLeft: '4px solid var(--status-danger)', width: 200, flex: '0 0 200px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Due Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-danger)', marginTop: 4 }}>📌 {dueTodayCount} Due Today</div>
        </Card>

        <Card padding="compact" style={{ borderLeft: '4px solid var(--accent)', width: 200, flex: '0 0 200px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Hours Logged</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>⏱ {totalHoursSum.toFixed(1)} hrs</div>
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="all">⚡ All Statuses</option>
              <option value="To Do">📝 To Do</option>
              <option value="In Progress">⚡ In Progress</option>
              <option value="Under Review">⏳ Under Review</option>
              <option value="Completed">✅ Completed</option>
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

      {/* Task List Table View */}
      {(() => {
        const formatTableDate = (isoStr?: string) => {
          if (!isoStr) return '—';
          try {
            const d = new Date(isoStr.slice(0, 10));
            if (isNaN(d.getTime())) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
          } catch {
            return '—';
          }
        };

        return (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Project</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Task Title</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Supervisor</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Assignee</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Start Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Due Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Worked</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No tasks found in the selected filter window.
                      </td>
                    </tr>
                  ) : (
                    sortedTasks.map((t) => {
                      const isAssignee =
                        t.assigneeId === user?.id ||
                        t.assigneeId === user?.email ||
                        (t.assignee && user?.fullName && t.assignee.toLowerCase() === user.fullName.toLowerCase());
                      const isPendingAssignment = t.approvalStatus === 'pending_assignment_approval';

                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.projectName}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
                              {t.approvalStatus === 'rework' && t.reworkNotes && (
                                <div style={{ marginTop: 4, padding: '4px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 11 }}>
                                  <strong>🔄 Rework:</strong> {t.reworkNotes}
                                </div>
                              )}
                              {/* Active Timer Display */}
                              {t.status === 'In Progress' && (
                                <div style={{ marginTop: 4, fontSize: 11, color: timers[t.id]?.isRunning ? 'var(--status-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <span>⏱️ Timer:</span>
                                  <span style={{ fontVariantNumeric: 'tabular-nums', background: 'var(--bg-sunken)', padding: '1px 4px', borderRadius: 3 }}>{getTaskDurationString(t.id)}</span>
                                  {timers[t.id]?.isRunning ? <span>● Running</span> : <span>Paused</span>}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{t.supervisor || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>{t.assignee || 'Unassigned'}</td>
                          <td style={{ padding: '12px 16px' }}>{formatTableDate((t as any).startDate || t.startDate)}</td>
                          <td style={{ padding: '12px 16px' }}>{formatTableDate(t.dueDate)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            ⏱ {Math.max(getTaskDurationHours(t.id), t.totalHoursWorked).toFixed(1)} hrs
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge tone={
                              t.status === 'Completed' ? 'success' :
                              t.status === 'Under Review' ? 'info' :
                              t.status === 'In Progress' ? 'progress' :
                              'neutral'
                            }>
                              {t.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {/* Assignment approval for management */}
                              {t.approvalStatus === 'pending_assignment_approval' && (() => {
                                const creator = employees.find(e => e.id === t.assignedByEmployeeId);
                                const creatorRole = ((creator as any)?.role || '').toUpperCase();
                                const needsCeoOnly = creatorRole === 'ADMIN' || creatorRole === 'MANAGER';
                                if (needsCeoOnly) {
                                  if (user?.role?.toUpperCase() === 'CEO') {
                                    return (
                                      <Button size="xs" variant="success" onClick={() => handleApproveTask(t.id)}>
                                        Approve Assignment
                                      </Button>
                                    );
                                  }
                                } else if (isManagement) {
                                  return (
                                    <Button size="xs" variant="success" onClick={() => handleApproveTask(t.id)}>
                                      Approve Assignment
                                    </Button>
                                  );
                                }
                                return null;
                              })()}

                              {/* Assignee options */}
                              {isAssignee && !isPendingAssignment && (
                                <>
                                  {(t.status === 'To Do' || t.approvalStatus === 'rework') && (
                                    <Button size="xs" variant="success" onClick={() => handleStartTask(t)}>
                                      ▶️ Start
                                    </Button>
                                  )}
                                  {t.status === 'In Progress' && timers[t.id]?.isRunning && (
                                    <Button size="xs" variant="secondary" onClick={() => handlePauseTask(t.id)}>
                                      ⏸️ Pause
                                    </Button>
                                  )}
                                  {t.status === 'In Progress' && !timers[t.id]?.isRunning && (
                                    <Button size="xs" variant="success" onClick={() => handleStartTask(t)}>
                                      ▶️ Resume
                                    </Button>
                                  )}
                                  {t.status === 'In Progress' && (
                                    <Button size="xs" onClick={() => { setSelectedTask(t); setTimeEntryOpen(true); }}>
                                      Log Time
                                    </Button>
                                  )}
                                  {t.status === 'In Progress' && (
                                    <Button size="xs" variant="primary" onClick={() => handleSubmitTaskForApproval(t)}>
                                      Submit
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* Supervisor/Manager actions for review */}
                              {t.status === 'Under Review' && (isManagement || isSupervisorRole) && (
                                <>
                                  <Button size="xs" variant="success" onClick={() => handleApproveTaskSubmission(t)}>
                                    Approve
                                  </Button>
                                  <Button size="xs" variant="danger" onClick={async () => {
                                    const { ok, reason } = await prompt({
                                      title: 'Request rework',
                                      message: 'Enter the reason this task needs rework:',
                                      variant: 'confirm',
                                    });
                                    if (ok && reason && reason.trim()) handleRequestRework(t, reason.trim());
                                  }}>
                                    Rework
                                  </Button>
                                </>
                              )}

                              {/* Reopen action */}
                              {t.status === 'Completed' && (
                                <Button size="xs" variant="secondary" onClick={() => handleReopenTask(t)}>
                                  Reopen
                                </Button>
                              )}

                              {/* Edit task (restricted to Top Management only) */}
                              {isManagement && (
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingTask(t);
                                    setEditTaskOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Create Task Drawer */}
      <Drawer open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Create New Task">
        <Form initial={{ category: 'Office Task', dueDate: todayStr, startDate: todayStr, description: '' }} onSubmit={handleCreateTask}>
          <TextField name="name" label="Task Title *" placeholder="e.g. Q3 Power BI Syllabus Audit" />
          <SelectField
            name="category"
            label="Category (Office Task or Project) *"
            options={[
              { value: 'Office Task', label: 'Office Task' },
              ...activeProjects.map((p: any) => ({ value: p.id, label: `Project: ${p.title}` }))
            ]}
          />
          <SelectField
            name="assignee"
            label="Assignee Name"
            options={[{ value: '', label: 'Unassigned' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]}
          />
          <SelectField
            name="supervisor"
            label="Supervisor Name"
            options={[{ value: '', label: 'None' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]}
          />
          <TextField name="startDate" label="Start Date (YYYY-MM-DD)" placeholder={todayStr} />
          <TextField name="dueDate" label="Due Date (YYYY-MM-DD)" placeholder={todayStr} />
          <TextAreaField name="description" label="Task Description (Optional)" placeholder="Describe the objectives or details of the task..." />
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
        {editingTask && (() => {
          const rawTask = tasks.find((t: any) => t.id === editingTask.id);
          return (
            <Form
              initial={{
                name: editingTask.name,
                category: rawTask?.projectId || 'Office Task',
                assignee: editingTask.assigneeId || '',
                supervisor: editingTask.supervisorId || '',
                dueDate: editingTask.dueDate || todayStr,
                startDate: (editingTask as any).startDate || editingTask.dueDate || todayStr,
                description: editingTask.description || '',
                status: editingTask.status,
              }}
              onSubmit={handleUpdateTaskSubmit}
            >
              <TextField name="name" label="Task Title *" placeholder="Task title..." />
              <SelectField
                name="category"
                label="Category (Office Task or Project) *"
                options={[
                  { value: 'Office Task', label: 'Office Task' },
                  ...activeProjects.map((p: any) => ({ value: p.id, label: `Project: ${p.title}` }))
                ]}
              />
              <SelectField
                name="assignee"
                label="Assignee Name"
                options={[{ value: '', label: 'Unassigned' }, ...(employees.length > 0 ? employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) : (editingTask.assigneeId ? [{ value: editingTask.assigneeId, label: editingTask.assignee }] : []))]}
              />
              <SelectField
                name="supervisor"
                label="Supervisor Name"
                options={[{ value: '', label: 'None' }, ...(employees.length > 0 ? employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) : (editingTask.supervisorId ? [{ value: editingTask.supervisorId, label: editingTask.supervisor }] : []))]}
              />
              <TextField name="startDate" label="Start Date (YYYY-MM-DD)" placeholder={todayStr} />
              <TextField name="dueDate" label="Due Date (YYYY-MM-DD)" placeholder={todayStr} />
              <TextAreaField name="description" label="Task Description (Optional)" placeholder="Describe task details..." />
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
          );
        })()}
      </Drawer>
    </div>
  );
}

export default TaskBoard;
