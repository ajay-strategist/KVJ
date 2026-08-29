import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader, Button, Card, SectionHeader, Badge, Avatar } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField, useForm } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useAuth } from '../../auth/AuthProvider';

import { useProject } from '../hooks/useProject';
import { useTaskSessions } from '../hooks/useTaskSessions';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';
import { exportToExcel } from '../../../shared/utils/exportToExcel';
import { todayISO, formatDisplayDate } from '../../../shared/utils/date';
import { ChecklistMultiSelect } from '../../../shared/ui/ChecklistMultiSelect';

/**
 * Multi-select of project members, bound to the shared Form's `memberIds` value.
 * A member is any employee assigned to the project alongside the supervisor.
 */
function ProjectMembersField({ employees }: { employees: Array<{ id: string; firstName?: string; lastName?: string; designation?: string }> }) {
  const { values, setValue } = useForm();
  const selected: string[] = Array.isArray((values as any).memberIds) ? (values as any).memberIds : [];
  const [q, setQ] = useState('');

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setValue('memberIds', next);
  };

  const list = employees.filter((e) => {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return !q.trim() || name.includes(q.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Project Members {selected.length > 0 ? `(${selected.length} selected)` : ''}
      </label>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search employees to add as members…"
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No matching employees.</div>
        ) : (
          list.map((e) => {
            const on = selected.includes(e.id);
            return (
              <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', background: on ? 'var(--bg-sunken)' : 'transparent' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(e.id)} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {e.firstName} {e.lastName}
                  {e.designation ? <span style={{ color: 'var(--text-muted)' }}> · {e.designation}</span> : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export type ProjectStatusLabel = 'Not Started' | 'In Progress' | 'Completed';

/** The three project statuses (stored value ⇄ display label). */
export const PROJECT_STATUS_OPTIONS: { value: string; label: ProjectStatusLabel }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'planning', label: 'In Progress' },
  { value: 'execution', label: 'In Progress' },
  { value: 'closure', label: 'Completed' },
];

export const projectStatusToLabel = (s?: string): ProjectStatusLabel =>
  s === 'closure' ? 'Completed'
  : s === 'execution' ? 'In Progress'
  : s === 'planning' ? 'In Progress'
  : 'Not Started';

export const projectStatusLabelToValue = (l?: string): string =>
  l === 'Completed' ? 'closure'
  : l === 'In Progress' ? 'execution'
  : 'not_started';

export interface ProjectCardData {
  id: string;
  code: string;
  title: string;
  client: string;
  supervisor: string;
  supervisorAvatarUrl?: string;
  status: ProjectStatusLabel;
  members: Array<{ name: string; hours: number; avatarUrl?: string }>;
  totalHours: number;
  tasksTotal: number;
  tasksCompleted: number;
  milestonesCount: number;
}

interface TaskItem {
  name: string;
  assignee: string;
  status: string;
  dueDate: string;
}

export function ProjectList({
  projectData,
  selectedEmployeeId,
}: {
  projectData?: any;
  selectedEmployeeId?: string;
}) {
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { user } = useAuth();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  // Deleting a project is restricted to Admin and CEO (soft-delete, recoverable).
  const canDeleteProject = ['ADMIN', 'CEO'].includes(userRole);

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // Status checklist filter state. Default: [] (All Statuses)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);
  const [clientNameInput, setClientNameInput] = useState('');

  const [projectsList, setProjectsList] = useState<ProjectCardData[]>([]);

  const { listSessions } = useTaskSessions();
  const [allSessions, setAllSessions] = useState<any[]>([]);

  useEffect(() => {
    if (reportOpen && selectedProject) {
      listSessions().then((data) => {
        setAllSessions(data || []);
      });
    }
  }, [reportOpen, selectedProject, listSessions]);

  const projectSessions = useMemo(() => {
    if (!selectedProject) return [];
    return allSessions.filter((s: any) => s.projectId === selectedProject.id);
  }, [allSessions, selectedProject]);

  const formatSessionDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '—';
    }
  };

  const formatSessionTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '—';
    }
  };

  const formatSessionDuration = (m?: number) => {
    if (m == null) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  const localProjectData = useProject();
  const actualProjectData = projectData || localProjectData;
  const projects = actualProjectData?.projects || [];
  const clients = actualProjectData?.clients || [];
  const tasks = actualProjectData?.tasks || [];
  const allocations = actualProjectData?.allocations || [];
  const timesheets = actualProjectData?.timesheets || [];
  const { createProject, updateProject, createTask, updateTask, submitTask, deleteTask, deleteProject } = actualProjectData || {};
  const { employees = [] } = useEmployee() || {};

  const assigneeOptions = useMemo(() => {
    if (employees.length > 0) {
      return employees.map((e) => {
        const name = `${e.firstName} ${e.lastName}`.trim();
        return { value: e.id, label: e.designation ? `${name} (${e.designation})` : name };
      });
    }
    return [{ value: 'Unassigned', label: 'Unassigned' }];
  }, [employees]);

  const mappedProjects = useMemo(() => {
    return projects.map((p: any) => {
      const client = clients.find((c: any) => c.id === p.clientId);
      // Only an EXPLICITLY assigned supervisor is shown. Previously, when a
      // project had none, the first manager/lead allocated to it was displayed
      // as the supervisor — which is why projects with no supervisor still
      // showed one. If there is no supervisor, show nothing.
      const supervisorEmp = (p as any).supervisorId
        ? employees.find((e) => e.id === (p as any).supervisorId)
        : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : '';

      const status: ProjectStatusLabel = projectStatusToLabel(p.status);

      const pTasks = tasks.filter((t: any) => t.projectId === p.id);
      const pTaskIds = new Set(pTasks.map((t: any) => t.id));
      const pTimesheets = timesheets.filter((ts: any) => ts.taskId && pTaskIds.has(ts.taskId));

      const totalProjectHours = pTimesheets.reduce((sum: number, ts: any) => sum + Number(ts.hoursLogged || 0), 0) ||
        pTasks.reduce((sum: number, t: any) => sum + Number(t.actualHours || 0), 0);

      const pAllocations = allocations.filter((a: any) => a.projectId === p.id);
      const membersMap = new Map<string, { name: string; hours: number; avatarUrl?: string }>();

      // 1. Add Project Supervisor
      const superId = p.supervisorId;
      if (superId) {
        const emp = employees.find((e) => e.id === superId);
        if (emp) {
          const name = `${emp.firstName} ${emp.lastName}`;
          const empHours = pTimesheets
            .filter((ts: any) => ts.employeeId === superId)
            .reduce((sum: number, ts: any) => sum + Number(ts.hoursLogged || 0), 0);
          membersMap.set(name, { name, hours: empHours, avatarUrl: emp.avatarUrl });
        }
      }

      // 2. Add allocated employees
      pAllocations.forEach((a: any) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        if (emp) {
          const name = `${emp.firstName} ${emp.lastName}`;
          const empHours = pTimesheets
            .filter((ts: any) => ts.employeeId === a.employeeId)
            .reduce((sum: number, ts: any) => sum + Number(ts.hoursLogged || 0), 0);
          const existing = membersMap.get(name);
          if (!existing) {
            membersMap.set(name, { name, hours: empHours, avatarUrl: emp.avatarUrl });
          }
        }
      });

      // 3. Add task assignees and timesheet loggers
      pTasks.forEach((t: any) => {
        if (t.assigneeId) {
          const emp = employees.find((e) => e.id === t.assigneeId || e.firstName === t.assigneeId || `${e.firstName} ${e.lastName}` === t.assigneeId);
          const name = emp ? `${emp.firstName} ${emp.lastName}` : t.assigneeId;
          const avatarUrl = emp?.avatarUrl;
          const taskHours = Number(t.actualHours || 0);
          const existing = membersMap.get(name) || { name, hours: 0, avatarUrl };
          membersMap.set(name, { name, hours: Math.round((existing.hours + taskHours) * 10) / 10, avatarUrl: existing.avatarUrl || avatarUrl });
        }
      });

      // 4. Add timesheet loggers
      pTimesheets.forEach((ts: any) => {
        if (ts.employeeId) {
          const emp = employees.find((e) => e.id === ts.employeeId);
          if (emp) {
            const name = `${emp.firstName} ${emp.lastName}`;
            if (!membersMap.has(name)) {
              const empHours = pTimesheets
                .filter((item: any) => item.employeeId === ts.employeeId)
                .reduce((sum: number, item: any) => sum + Number(item.hoursLogged || 0), 0);
              membersMap.set(name, { name, hours: empHours, avatarUrl: emp.avatarUrl });
            }
          }
        }
      });

      const members = Array.from(membersMap.values());
      const tasksTotal = pTasks.length;
      const tasksCompleted = pTasks.filter((t: any) => t.status === 'done' || (t.status as any) === 'Completed').length;

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        client: client ? client.name : 'Independent',
        supervisor: supervisorName,
        supervisorAvatarUrl: supervisorEmp?.avatarUrl,
        status,
        members,
        totalHours: Math.round(totalProjectHours * 10) / 10,
        tasksTotal,
        tasksCompleted,
        milestonesCount: pTasks.length > 0 ? Math.ceil(pTasks.length / 2) : 1,
      };
    });
  }, [projects, clients, tasks, allocations, timesheets, employees]);

  useEffect(() => {
    setProjectsList(mappedProjects);
  }, [mappedProjects]);

  useEffect(() => {
    if (selectedProject) {
      const found = mappedProjects.find((p: any) => p.id === selectedProject.id);
      if (found) {
        if (JSON.stringify(found) !== JSON.stringify(selectedProject)) {
          setSelectedProject(found);
        }
      }
    }
  }, [mappedProjects, selectedProject]);

  // Filter based on selected checkboxes and selectedEmployeeId
  const filteredProjects = useMemo(() => {
    let list = projectsList;
    if (selectedEmployeeId && selectedEmployeeId !== 'all') {
      list = list.filter((p: any) => {
        const dbProj = projects.find((dp: any) => dp.id === p.id);
        if (dbProj && (dbProj as any).supervisorId === selectedEmployeeId) {
          return true;
        }
        const isAllocated = allocations.some(
          (a: any) => a.projectId === p.id && a.employeeId === selectedEmployeeId
        );
        if (isAllocated) return true;
        const hasTask = tasks.some(
          (t: any) => t.projectId === p.id && t.assigneeId === selectedEmployeeId
        );
        if (hasTask) return true;
        return false;
      });
    }

    if (selectedProjectFilter !== 'all') {
      list = list.filter((p) => p.id === selectedProjectFilter);
    }
    if (selectedSupervisor !== 'all') {
      const supEmp = employees.find((e) => e.id === selectedSupervisor);
      const supName = supEmp ? `${supEmp.firstName} ${supEmp.lastName}` : '';
      list = list.filter((p: any) => p.supervisorId === selectedSupervisor || (supName && p.supervisor === supName));
    }
    if (selectedClient !== 'all') {
      list = list.filter((p) => p.client === selectedClient);
    }
    if (selectedStatuses.length > 0) {
      if (selectedStatuses.includes('__none__')) {
        list = [];
      } else {
        list = list.filter((p) => selectedStatuses.includes(p.status));
      }
    }
    return list;
  }, [projectsList, selectedEmployeeId, projects, allocations, tasks, selectedStatuses, selectedProjectFilter, selectedSupervisor, selectedClient, employees]);

  const totalTasksCount = useMemo(() => filteredProjects.reduce((acc, p) => acc + p.tasksTotal, 0), [filteredProjects]);
  const completedTasksCount = useMemo(() => filteredProjects.reduce((acc, p) => acc + p.tasksCompleted, 0), [filteredProjects]);
  const inProgressTasksCount = useMemo(() => Math.max(0, totalTasksCount - completedTasksCount), [totalTasksCount, completedTasksCount]);
  const pctCompleted = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const pctInProgress = totalTasksCount > 0 ? Math.round((inProgressTasksCount / totalTasksCount) * 100) : 0;

  // Count active projects (Not Started + In Progress)
  const activeProjectsCount = useMemo(() => {
    let list = projectsList;
    if (selectedEmployeeId && selectedEmployeeId !== 'all') {
      list = list.filter((p: any) => {
        const dbProj = projects.find((dp: any) => dp.id === p.id);
        if (dbProj && (dbProj as any).supervisorId === selectedEmployeeId) {
          return true;
        }
        const isAllocated = allocations.some(
          (a: any) => a.projectId === p.id && a.employeeId === selectedEmployeeId
        );
        if (isAllocated) return true;
        const hasTask = tasks.some(
          (t: any) => t.projectId === p.id && t.assigneeId === selectedEmployeeId
        );
        if (hasTask) return true;
        return false;
      });
    }
    return list.filter(
      (p) => p.status !== 'Completed'
    ).length;
  }, [projectsList, selectedEmployeeId, projects, allocations, tasks]);

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [];
    const pTasks = tasks.filter((t: any) => t.projectId === selectedProject.id);
    return pTasks.map((t: any) => {
      const assignee = employees.find((e) => e.id === t.assigneeId || e.firstName === t.assigneeId || `${e.firstName} ${e.lastName}` === t.assigneeId);
      const tTimesheets = timesheets.filter((ts: any) => ts.taskId === t.id);
      const hoursLogged = tTimesheets.reduce((sum: number, ts: any) => sum + Number(ts.hoursLogged || 0), 0) || Number(t.actualHours || 0);

      let status = 'To Do';
      if (t.status === 'done' || (t.status as any) === 'Completed') status = 'Completed';
      else if (t.status === 'in_progress' || (t.status as any) === 'In Progress') status = 'In Progress';
      else if (t.status === 'review' || (t.status as any) === 'Under Review') status = 'Under Review';

      return {
        id: t.id,
        name: t.title,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : (t.assigneeId as string || 'Unassigned'),
        assigneeId: t.assigneeId || '',
        status,
        rawStatus: t.status || 'todo',
        hoursLogged: Math.round(hoursLogged * 10) / 10,
        dueDate: t.dueDate || '—',
      };
    });
  }, [selectedProject, tasks, timesheets, employees]);

  const handleCreateProject = async (values: Record<string, unknown>) => {
    const initialStatus = isMgmt ? ((values.status as any) || 'execution') : 'planning';

    // Resolve client: match typed name to existing client, or pass name for new client creation
    const typedName = (clientNameInput || '').trim();
    const matchedClient = clients.find((c: any) => c.name.toLowerCase() === typedName.toLowerCase());
    const resolvedClientId = matchedClient ? matchedClient.id : undefined;

    if (!values.supervisorId) {
      toast({ variant: 'error', title: 'Supervisor Required', message: 'Please select a Project Supervisor.' });
      return;
    }

    const res = await createProject({
      title: values.title as string,
      code: (values.code as string) || `KVJ-PRJ-${Math.floor(100 + Math.random() * 900)}`,
      clientId: resolvedClientId,
      clientName: !matchedClient ? typedName : undefined,
      status: initialStatus as any,
      priority: 'medium',
      supervisorId: values.supervisorId as string,
      memberIds: Array.isArray(values.memberIds) ? (values.memberIds as string[]) : [],
    } as any);

    if (res.ok) {
      if (!isMgmt) {
        toast({
          variant: 'info',
          title: 'Project Submission Sent for Approval',
          message: `Project "${values.title}" created and submitted for Admin/CEO/Manager approval.`,
        });
      } else {
        toast({ variant: 'success', title: 'Project Created', message: `${res.value.title} created successfully.` });
      }
      setClientNameInput('');
      setCreateProjectOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const handleEditProject = async (values: Record<string, unknown>) => {
    if (!selectedProject) return;

    const typedName = (clientNameInput || '').trim();
    const matchedClient = clients.find((c: any) => c.name.toLowerCase() === typedName.toLowerCase());
    const resolvedClientId = matchedClient ? matchedClient.id : undefined;

    if (!values.supervisorId) {
      toast({ variant: 'error', title: 'Supervisor Required', message: 'Please select a Project Supervisor.' });
      return;
    }

    const res = await updateProject(selectedProject.id as UUID, {
      title: values.title as string,
      code: values.code as string,
      clientId: resolvedClientId,
      clientName: !matchedClient ? typedName : undefined,
      status: values.status as any,
      supervisorId: values.supervisorId as string,
      memberIds: Array.isArray(values.memberIds) ? (values.memberIds as string[]) : [],
    } as any);

    if (res.ok) {
      toast({ variant: 'success', title: 'Project Updated', message: `${res.value.title} updated successfully.` });
      setClientNameInput('');
      setEditProjectOpen(false);
    } else {
      toast({ variant: 'error', title: 'Update Failed', message: res.error });
    }
  };

  const handleAddTaskSubmit = async (values: Record<string, unknown>) => {
    if (!selectedProject) return;

    // The Assignee select carries the employee id. Passing it through means the
    // task is assigned to the chosen person — not silently to the creator.
    const assigneeRaw = (values.assignee as string) || '';
    const assigneeId = assigneeRaw && assigneeRaw !== 'Unassigned' ? assigneeRaw : undefined;
    const dbProj = projects.find((p: any) => p.id === selectedProject.id);
    const supervisorId = (dbProj as any)?.supervisorId || user?.id;

    const res = await createTask({
      projectId: selectedProject.id as UUID,
      title: values.title as string,
      description: (values.description as string) || undefined,
      assigneeId,
      supervisorId,
      dueDate: (values.dueDate as string) || undefined,
      startDate: (values.startDate as string) || (values.dueDate as string) || undefined,
      status: 'todo',
      priority: 'medium',
    } as any);

    if (res.ok) {
      const pending = (res.value as any)?.approvalStatus === 'pending_assignment_approval';
      toast({
        variant: pending ? 'warning' : 'success',
        title: pending ? 'Task Sent for Approval' : 'New Task Created',
        message: pending
          ? `Assigning "${values.title}" to another member needs CEO approval — request sent.`
          : `Task "${values.title}" added to project ${selectedProject.code}.`,
      });
      setAddTaskOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  // PDF Export Logic — full content: KPIs, member hours, all tasks with hours/status
  const exportReportToPDF = (p: ProjectCardData) => {
    const pTasks = tasks.filter((t: any) => t.projectId === p.id && !t.deletedAt);
    const completionPct = p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0;
    const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

    const statusBadge = (status: string) => {
      const map: Record<string, [string, string]> = {
        done: ['#dcfce7', '#15803d'],
        in_progress: ['#fef9c3', '#a16207'],
        review: ['#ede9fe', '#6d28d9'],
        todo: ['#f1f5f9', '#475569'],
      };
      const [bg, fg] = map[status] ?? ['#f1f5f9', '#475569'];
      const label = status === 'done' ? 'Completed' : status === 'in_progress' ? 'In Progress' : status === 'review' ? 'Under Review' : 'To Do';
      return `<span style="background:${bg};color:${fg};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">${label}</span>`;
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ variant: 'error', title: 'Pop-up Blocked', message: 'Please allow pop-ups to export the PDF.' });
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Project Report — ${p.code}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; background: #fff; padding: 40px; line-height: 1.6; font-size: 13px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 28px; border-bottom: 3px solid #6366f1; }
            .logo { font-size: 22px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
            .logo span { color: #0f172a; }
            .report-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6366f1; letter-spacing: 1.5px; }
            .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
            h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin: 24px 0; }
            .kpi { border-radius: 10px; padding: 14px 16px; }
            .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
            .kpi-value { font-size: 20px; font-weight: 800; }
            .progress-wrap { margin: 8px 0 28px; }
            .progress-bar-bg { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
            .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #7c3aed); border-radius: 5px; }
            .progress-label { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
            .section-title { font-size: 14px; font-weight: 800; color: #0f172a; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            thead tr { background: #6366f1; color: white; }
            th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
            tr:nth-child(even) td { background: #f8fafc; }
            .avatar-img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 6px; }
            .avatar-initial { display: inline-flex; width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#7c3aed); color: white; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-right: 6px; vertical-align: middle; }
            .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 11px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div>
              <div class="report-label">📊 Detailed Project Report</div>
              <h1>${p.title}</h1>
              <div class="meta">
                Code: <strong>${p.code}</strong> &nbsp;·&nbsp;
                Client: <strong>${p.client}</strong> &nbsp;·&nbsp;
                Supervisor: <strong>${p.supervisor}</strong>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="logo">KVJ <span>Analytics</span></div>
              <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Generated: ${generatedAt}</div>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi" style="background:#ede9fe;border-left:4px solid #6366f1;">
              <div class="kpi-label" style="color:#6d28d9;">🏷️ Status</div>
              <div class="kpi-value" style="color:#6366f1;font-size:16px;">${p.status}</div>
            </div>
            <div class="kpi" style="background:#e0f2fe;border-left:4px solid #0891b2;">
              <div class="kpi-label" style="color:#0891b2;">⏱️ Total Hours</div>
              <div class="kpi-value" style="color:#0284c7;">${p.totalHours} hrs</div>
            </div>
            <div class="kpi" style="background:#dcfce7;border-left:4px solid #16a34a;">
              <div class="kpi-label" style="color:#15803d;">✅ Tasks Done</div>
              <div class="kpi-value" style="color:#16a34a;">${p.tasksCompleted} / ${p.tasksTotal}</div>
            </div>
            <div class="kpi" style="background:#fef9c3;border-left:4px solid #ca8a04;">
              <div class="kpi-label" style="color:#a16207;">🏁 Milestones</div>
              <div class="kpi-value" style="color:#ca8a04;">${p.milestonesCount} Planned</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-wrap">
            <div class="progress-label">
              <span>Overall Task Completion</span>
              <span style="color:#6366f1;">${completionPct}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${completionPct}%;"></div>
            </div>
          </div>

          <!-- Member Hours -->
          <div class="section-title">👥 Team Member Logged Hours</div>
          <table>
            <thead>
              <tr>
                <th>Team Member</th>
                <th style="text-align:right;">Logged Hours</th>
              </tr>
            </thead>
            <tbody>
              ${p.members.length > 0 ? p.members.map(m => `
                <tr>
                  <td>
                    ${m.avatarUrl ? `<img src="${m.avatarUrl}" class="avatar-img" />` : `<span class="avatar-initial">${(m.name || '?').charAt(0)}</span>`}
                    <strong>${m.name || '—'}</strong>
                  </td>
                  <td style="text-align:right;font-weight:700;color:#6366f1;">${m.hours} hrs</td>
                </tr>
              `).join('') : '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">No members assigned.</td></tr>'}
            </tbody>
          </table>

          <!-- Task List -->
          <div class="section-title">📋 Individual Task List</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Task Description</th>
                <th>Assignee</th>
                <th>Status</th>
                <th style="text-align:right;">Hours Logged</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${pTasks.length > 0 ? pTasks.map((t: any, i: number) => {
                const assignee = employees.find((e) => e.id === t.assigneeId);
                const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned';
                const assigneeAvatar = assignee?.avatarUrl;
                const pTs = timesheets.filter((ts: any) => ts.taskId === t.id);
                const hrs = pTs.reduce((sum: number, ts: any) => sum + (ts.hoursLogged || 0), 0);
                return `
                  <tr>
                    <td style="color:#94a3b8;">${i + 1}</td>
                    <td style="font-weight:600;">${t.title}</td>
                    <td>
                      ${assigneeAvatar ? `<img src="${assigneeAvatar}" class="avatar-img" />` : `<span class="avatar-initial" style="width:20px;height:20px;font-size:10px;">${(assigneeName || '?').charAt(0)}</span>`}
                      ${assigneeName}
                    </td>
                    <td>${statusBadge(t.status || 'todo')}</td>
                    <td style="text-align:right;font-weight:700;color:#6366f1;">${Math.round(hrs * 10) / 10} hrs</td>
                    <td style="color:#64748b;">${t.dueDate || '—'}</td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No tasks found for this project.</td></tr>'}
            </tbody>
          </table>

          <!-- Footer -->
          <div class="footer">
            <span>KVJ Analytics — Enterprise Operations Platform</span>
            <span>Confidential · ${p.code} · ${generatedAt}</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const tableColumns: Column<ProjectCardData>[] = [
    { key: 'title', header: 'Project Name & Client', sortable: true, render: (p) => <div><div style={{ fontWeight: 600 }}>{p.title}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Client: {p.client}</div></div> },
    { key: 'supervisor', header: 'Supervisor', render: (p) => p.supervisor ? <span>👤 {p.supervisor}</span> : <span>—</span> },
    { key: 'members', header: 'Assigned Members & Hours', render: (p) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {p.members.map((m, idx) => (
          <span key={idx} style={{ fontSize: 12, background: 'var(--bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>
            {m.name}: <strong>{m.hours}h</strong>
          </span>
        ))}
      </div>
    )},
    { key: 'totalHours', header: 'Total Hours', sortable: true, render: (p) => <strong>⏱ {p.totalHours} hrs</strong> },
    { key: 'completion', header: 'Completion Ratio', render: (p) => {
      const pct = p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0;
      return (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{p.tasksCompleted} / {p.tasksTotal} ({pct}%)</div>
          <div style={{ width: 100, height: 6, background: 'var(--bg-sunken)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--status-success)' : 'var(--brand)' }} />
          </div>
        </div>
      );
    }},
    { key: 'status', header: 'Status', render: (p) => (
      <Badge tone={p.status === 'Completed' ? 'success' : p.status === 'In Progress' ? 'progress' : 'neutral'}>
        {p.status}
      </Badge>
    )},
    { key: 'actions', header: 'Actions', render: (p) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant="secondary" onClick={() => { setSelectedProject(p); setReportOpen(true); }}>
          📊 Report
        </Button>
        <Button size="sm" onClick={() => { setSelectedProject(p); setAddTaskOpen(true); }}>
          ➕ Task
        </Button>
      </div>
    )},
  ];

  const handleExportProjectsToExcel = () => {
    const headers = [
      'Project Code',
      'Project Name',
      'Client',
      'Supervisor',
      'Status',
      'Total Hours Worked',
      'Tasks Completed',
      'Total Tasks',
      'Completion %',
      'Assigned Members',
    ];

    const rows = filteredProjects.map((p) => {
      const pct = p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0;
      const memberStr = p.members.map((m) => `${m.name} (${m.hours} hrs)`).join('; ');
      return [
        p.code,
        p.title,
        p.client,
        p.supervisor || '—',
        p.status,
        p.totalHours,
        p.tasksCompleted,
        p.tasksTotal,
        `${pct}%`,
        memberStr || 'None',
      ];
    });

    exportToExcel(`Projects_Report_${todayISO()}`, headers, rows);
    toast({ variant: 'success', title: 'Export Complete', message: 'Projects report exported to Excel successfully.' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Actions (Right Aligned) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={handleExportProjectsToExcel}>
          📥 Export Projects to Excel
        </Button>
        <Button onClick={() => setCreateProjectOpen(true)}>+ Create Master Project</Button>
      </div>

      {/* Full Horizontal Filter Bar (5 Slicers + Clear Action) */}
      <Card style={{ padding: '14px 18px', overflow: 'visible', position: 'relative', zIndex: 40 }} bodyStyle={{ overflow: 'visible' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Project Name Slicer */}
          <div style={{ flex: '1 1 180px', minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Project Name</label>
            <select
              className="kvj-select"
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}
            >
              <option value="all">All Projects</option>
              {projectsList.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.title}</option>)}
            </select>
          </div>

          {/* Supervisor Slicer */}
          <div style={{ flex: '1 1 180px', minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Supervisor</label>
            <select
              className="kvj-select"
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}
            >
              <option value="all">All Supervisors</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>

          {/* Status Checklist Slicer */}
          <div style={{ flex: '1 1 180px', minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Status</label>
            <ChecklistMultiSelect
              options={[
                { value: 'Not Started', label: 'Not Started' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
              ]}
              selectedValues={selectedStatuses}
              onChange={setSelectedStatuses}
            />
          </div>

          {/* Client Slicer */}
          <div style={{ flex: '1 1 180px', minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Client</label>
            <select
              className="kvj-select"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}
            >
              <option value="all">All Clients</option>
              {clients.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* Clear Filters Action */}
          {(selectedSupervisor !== 'all' || selectedStatuses.length > 0 || selectedClient !== 'all' || selectedProjectFilter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSelectedSupervisor('all'); setSelectedStatuses([]); setSelectedClient('all'); setSelectedProjectFilter('all'); }} style={{ alignSelf: 'flex-end', marginBottom: 2 }}>
              ✕ Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* 4 KPI Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 4 }}>
        <Card padding="compact" style={{ borderLeft: '4px solid var(--brand)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>ACTIVE PROJECTS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{activeProjectsCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total Projects</div>
        </Card>

        <Card padding="compact" style={{ borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>TOTAL TASKS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{totalTasksCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>All Tasks</div>
        </Card>

        <Card padding="compact" style={{ borderLeft: '4px solid var(--status-success)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>COMPLETED TASKS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>{completedTasksCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pctCompleted}% of Total</div>
        </Card>

        <Card padding="compact" style={{ borderLeft: '4px solid var(--status-warning)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>IN PROGRESS TASKS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>{inProgressTasksCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pctInProgress}% of Total</div>
        </Card>
      </div>

      {/* Grid Toolbar / View Toggle Line (Directly above Cards Grid) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
          Showing {filteredProjects.length} Projects
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              style={{
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                background: viewMode === 'card' ? 'var(--brand)' : 'var(--bg-surface)',
                color: viewMode === 'card' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              🎴 Card View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                background: viewMode === 'table' ? 'var(--brand)' : 'var(--bg-surface)',
                color: viewMode === 'table' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              📊 Table View
            </button>
          </div>
        </div>
      </div>

      {/* Main View Display: Card View OR Table View */}
      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filteredProjects.map((p) => {
            const pct = p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0;
            return (
              <Card
                key={p.id}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', flex: 1 }}
              >
                <div>
                  {/* Top Bar: Code & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.05em' }}>
                        {p.code}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                        {p.title}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Client: {p.client}</div>
                    </div>
                    <Badge tone={p.status === 'Completed' ? 'success' : p.status === 'In Progress' ? 'progress' : 'neutral'}>
                      {p.status}
                    </Badge>
                  </div>

                  {/* Supervisor */}
                  {p.supervisor ? (
                    <div style={{ fontSize: 12, marginBottom: 12, padding: '4px 10px', background: 'var(--bg-sunken)', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Supervisor:</span>
                      <Avatar name={p.supervisor} src={p.supervisorAvatarUrl} size={20} />
                      <strong>{p.supervisor}</strong>
                    </div>
                  ) : null}

                  {/* Member-specific Hours Breakdown */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                      Assigned Members & Hours Worked:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.members.map((m, idx) => (
                        <div key={idx} style={{ fontSize: 12, background: 'var(--bg-sunken)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={m.name} src={m.avatarUrl} size={20} />
                          <span>{m.name}: <strong style={{ color: 'var(--brand)' }}>{m.hours} hrs</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Hours Worked & Task Completion Ratio (Clearly Presented) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--e1)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 700 }}>Total Hours Worked:</span>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>⏱ {p.totalHours} hrs</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--e1)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 700 }}>Task Ratio:</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
                        {p.tasksCompleted} / {p.tasksTotal} ({pct}%)
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--status-success)' : 'var(--brand)', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                </div>

                {/* Card Actions: View Detailed Report & Add New Task inside Card */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ flex: 1, fontSize: 12 }}
                    onClick={() => { setSelectedProject(p); setReportOpen(true); }}
                  >
                    📊 Detailed Report
                  </Button>
                  <Button
                    size="sm"
                    style={{ flex: 1, fontSize: 12 }}
                    onClick={() => { setSelectedProject(p); setAddTaskOpen(true); }}
                  >
                    ➕ Add New Task
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable columns={tableColumns} rows={filteredProjects} rowKey={(p) => p.id} />
      )}

      {/* Detailed Project Report — Premium Full-Screen Modal */}
      {selectedProject && reportOpen && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1250,
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(var(--overlay-blur, 3px))',
            WebkitBackdropFilter: 'blur(var(--overlay-blur, 3px))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false); }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 20,
              boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.15)',
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: '20px 28px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, letterSpacing: 2, marginBottom: 4 }}>📊 Detailed Project Report</div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{selectedProject.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedProject.code}</span>
                  <span>Client: <strong>{selectedProject.client}</strong></span>
                  {selectedProject.supervisor && <span>Supervisor: <strong>{selectedProject.supervisor}</strong></span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  size="sm"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => {
                    setClientNameInput(selectedProject.client);
                    setEditProjectOpen(true);
                  }}
                >
                  ✏️ Edit Details
                </Button>
                <Button
                  size="sm"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setAddTaskOpen(true)}
                >
                  ➕ Add Task
                </Button>
                {canDeleteProject && (
                  <Button
                    size="sm"
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#fee2e2',
                      fontWeight: 600,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete Project?',
                        message: `Delete project "${selectedProject.title}"? The project and its tasks will be hidden from the app. Nothing is permanently erased — this can be recovered.`
                      });
                      if (ok) {
                        const res = await deleteProject(selectedProject.id as UUID);
                        if (res.ok) {
                          toast({ variant: 'warning', title: 'Project Deleted', message: `"${selectedProject.title}" and its tasks have been hidden (recoverable).` });
                          setReportOpen(false);
                        } else {
                          toast({ variant: 'error', title: 'Delete Failed', message: res.error });
                        }
                      }
                    }}
                  >
                    🗑️ Delete Project
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
                >×</button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Status', value: selectedProject.status, icon: '🏷️', bg: '#ede9fe', border: '#6366f1', color: '#4f46e5' },
                  { label: 'Total Hours', value: `${selectedProject.totalHours} hrs`, icon: '⏱️', bg: '#e0f2fe', border: '#0891b2', color: '#0284c7' },
                  { label: 'Tasks Done', value: `${selectedProject.tasksCompleted} / ${selectedProject.tasksTotal}`, icon: '✅', bg: '#dcfce7', border: '#16a34a', color: '#15803d' },
                  { label: 'Milestones', value: `${selectedProject.milestonesCount} Planned`, icon: '🏁', bg: '#fef9c3', border: '#ca8a04', color: '#a16207' },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ background: kpi.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${kpi.border}`, transition: 'transform 0.15s' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: kpi.color, letterSpacing: 0.8, marginBottom: 6 }}>{kpi.icon} {kpi.label}</div>
                    {kpi.label === 'Status' ? (
                      <select
                        value={projectStatusLabelToValue(selectedProject.status)}
                        onChange={async (e) => {
                          const res = await updateProject(selectedProject.id as UUID, { status: e.target.value as any });
                          if (res.ok) {
                            toast({ variant: 'success', title: 'Status Updated', message: `Project status set to "${projectStatusToLabel(e.target.value)}".` });
                          } else {
                            toast({ variant: 'error', title: 'Update Failed', message: res.error });
                          }
                        }}
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: kpi.color,
                          background: 'transparent',
                          border: '1px solid ' + kpi.border,
                          borderRadius: 8,
                          padding: '4px 24px 4px 8px',
                          cursor: 'pointer',
                          width: '100%',
                          outline: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                          backgroundSize: '12px',
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${kpi.border.replace('#', '%23')}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        }}
                      >
                        {PROJECT_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} style={{ color: '#0f172a' }}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  <span>Overall Task Completion</span>
                  <span style={{ color: '#4f46e5' }}>{selectedProject.tasksTotal > 0 ? Math.round((selectedProject.tasksCompleted / selectedProject.tasksTotal) * 100) : 0}%</span>
                </div>
                <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${selectedProject.tasksTotal > 0 ? Math.round((selectedProject.tasksCompleted / selectedProject.tasksTotal) * 100) : 0}%`,
                    background: 'linear-gradient(90deg, #4f46e5, #a855f7)',
                    borderRadius: 5,
                    transition: 'width 0.6s ease',
                    boxShadow: '0 0 8px rgba(99,102,241,0.4)',
                  }} />
                </div>
              </div>

              {/* Two-column: Member panel left, Task table right */}
              <div className="project-report-grid">

                {/* Member Hours Panel */}
                <div style={{ background: 'var(--bg-sunken)', borderRadius: 14, padding: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#4f46e5', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    👥 Team Hours
                  </div>
                  {selectedProject.members.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No members assigned yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedProject.members.map((m, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={m.name} src={m.avatarUrl} size={30} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name || '—'}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5', background: '#ede9fe', padding: '2px 8px', borderRadius: 6 }}>{m.hours === 0 ? '0 hr' : `${m.hours}h`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Task Management Table */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#4f46e5', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📋 Task Management
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 550 }}>
                      <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Task</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assignee</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Hrs</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Due</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12 }}>Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProjectTasks.map((t: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-sunken)', transition: 'background 0.15s' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={t.assigneeId || ''}
                                onChange={async (e) => {
                                  await updateTask(t.id, { assigneeId: e.target.value });
                                  toast({ variant: 'success', title: 'Assignee Updated' });
                                }}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '4px 22px 4px 8px',
                                  borderRadius: 8,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  maxWidth: 120,
                                  outline: 'none',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  appearance: 'none',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 6px center',
                                  backgroundSize: '10px',
                                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                }}
                              >
                                <option value="">Unassigned</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={t.rawStatus || 'todo'}
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  if (val === 'review') {
                                    await submitTask(t.id, 'Status changed to Under Review');
                                  } else {
                                    await updateTask(t.id, { status: val as any });
                                  }
                                  toast({ variant: 'success', title: 'Status Updated' });
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 22px 4px 8px',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  border: '1px solid transparent',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  appearance: 'none',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 6px center',
                                  backgroundSize: '10px',
                                  ...(() => {
                                    const statusVal = t.rawStatus === 'done' || t.rawStatus === 'Completed' ? 'done'
                                      : t.rawStatus === 'in_progress' || t.rawStatus === 'In Progress' ? 'in_progress'
                                      : t.rawStatus === 'review' || t.rawStatus === 'Under Review' ? 'review'
                                      : 'todo';
                                    const colorMap = {
                                      done: { bg: 'var(--status-success-bg)', text: 'var(--status-success)', border: 'var(--status-success-border)', stroke: '%2310B981' },
                                      in_progress: { bg: 'var(--status-progress-bg)', text: 'var(--status-progress)', border: 'var(--status-progress-border)', stroke: '%233B82F6' },
                                      review: { bg: 'var(--status-purple-bg)', text: 'var(--status-purple)', border: 'var(--status-purple-border)', stroke: '%238B5CF6' },
                                      todo: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral)', border: 'var(--status-neutral-border)', stroke: '%2364748B' },
                                    };
                                    const s = colorMap[statusVal];
                                    return {
                                      backgroundColor: s.bg,
                                      color: s.text,
                                      borderColor: s.border,
                                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${s.stroke}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                    };
                                  })()
                                }}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="review">Under Review</option>
                                <option value="done">Completed</option>
                              </select>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>{t.hoursLogged} hrs</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{t.dueDate}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                title="Delete Task"
                                onClick={async () => {
                                  const ok = await confirm({ title: 'Delete Task?', message: `Delete "${t.name}"? This cannot be undone.` });
                                  if (ok) {
                                    const res = await deleteTask(t.id as any);
                                    if (res.ok) {
                                      toast({ variant: 'warning', title: 'Task Deleted', message: `"${t.name}" has been removed.` });
                                    } else {
                                      toast({ variant: 'error', title: 'Delete Failed', message: res.error });
                                    }
                                  }
                                }}
                                style={{
                                  background: 'var(--status-danger-bg)',
                                  border: '1px solid var(--status-danger-border)',
                                  color: 'var(--status-danger)',
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 13,
                                  transition: 'all 0.15s ease',
                                }}
                              >🗑️</button>
                            </td>
                          </tr>
                        ))}
                        {selectedProjectTasks.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                              No tasks for this project yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Task Work Log Section */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#4f46e5', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⏰ Task Work Log
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 650 }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700 }}>Task</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700 }}>Start Time</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700 }}>End Time</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectSessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No work sessions logged for this project's tasks yet.
                          </td>
                        </tr>
                      ) : (
                        projectSessions.map((s, idx) => {
                          const task = tasks.find((t: any) => t.id === s.taskId);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-sunken)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{formatSessionDate(s.startTime)}</td>
                              <td style={{ padding: '10px 12px' }}>{task ? task.title : s.workTitle}</td>
                              <td style={{ padding: '10px 12px' }}>{formatSessionTime(s.startTime)}</td>
                              <td style={{ padding: '10px 12px' }}>{s.endTime ? formatSessionTime(s.endTime) : 'Running…'}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                                {s.status === 'running' ? 'Running…' : formatSessionDuration(s.durationMinutes)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedProjectTasks.length} task{selectedProjectTasks.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {selectedProject.members.length} team member{selectedProject.members.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" onClick={() => exportReportToPDF(selectedProject)}>
                  📄 Export PDF
                </Button>
                <Button onClick={() => setReportOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Create Project Modal */}
      <Drawer open={createProjectOpen} onClose={() => setCreateProjectOpen(false)} title="Create New Project">
        <Form initial={{ code: 'KVJ-PRJ-00', status: 'not_started' }} onSubmit={handleCreateProject}>
          <TextField name="code" label="Project Code *" placeholder="e.g. KVJ-PRJ-05" />
          <TextField name="title" label="Project Name *" placeholder="e.g. Q3 ERP Migration & Analytics" />

          {/* Client: combobox — type a new name or select from existing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Organization *</label>
            <input
              list="client-datalist"
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              placeholder="Type or select client name…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid var(--border)',
                background: 'var(--bg-input, var(--bg-surface))',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <datalist id="client-datalist">
              {clients.map((c: any) => <option key={c.id} value={c.name} />)}
            </datalist>
            {clientNameInput && !clients.find((c: any) => c.name.toLowerCase() === clientNameInput.toLowerCase()) && (
              <div style={{ fontSize: 12, color: 'var(--status-warning)', marginTop: 2 }}>⚡ New client will be registered: "{clientNameInput}"</div>
            )}
          </div>

          <SelectField
            name="supervisorId"
            label="Project Supervisor *"
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName}${e.designation ? ` (${e.designation})` : ''}`,
            }))}
          />
          <ProjectMembersField employees={employees} />
          <SelectField
            name="status"
            label="Initial Phase *"
            options={[
              { value: 'not_started', label: 'Not Started' },
              { value: 'planning', label: 'Kick Off' },
              { value: 'execution', label: 'In Execution' },
              { value: 'closure', label: 'Completed' },
            ]}
          />
          <DatePickerField name="targetCompletion" label="Target Completion Date" />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateProjectOpen(false)}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </div>
        </Form>
      </Drawer>

      {/* Add New Task inside Card Modal */}
      {selectedProject && (
        <Drawer open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title={`Add New Task — ${selectedProject.code}`}>
          <Form initial={{ priority: 'Medium', status: 'To Do' }} onSubmit={handleAddTaskSubmit}>
            <TextField name="title" label="Task Title" placeholder="e.g. Implement API Endpoint" />
            <TextAreaField name="description" label="Task Description" placeholder="Detailed requirements..." />
            <SelectField
              name="assignee"
              label="Assignee"
              options={assigneeOptions}
            />
            <DatePickerField name="startDate" label="Start Date" />
            <DatePickerField name="dueDate" label="Due Date" />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Add Task to Project</Button>
            </div>
          </Form>
        </Drawer>
      )}

      {/* Edit Project Modal */}
      {selectedProject && (
        <Drawer open={editProjectOpen} onClose={() => setEditProjectOpen(false)} title={`Edit Project: ${selectedProject.title}`}>
          <Form
            initial={{
              code: selectedProject.code,
              title: selectedProject.title,
              status: projectStatusLabelToValue(selectedProject.status),
              supervisorId: projects.find((p: any) => p.id === selectedProject.id)?.supervisorId || '',
              memberIds: allocations.filter((a: any) => a.projectId === selectedProject.id).map((a: any) => a.employeeId),
            }}
            onSubmit={handleEditProject}
          >
            <TextField name="code" label="Project Code *" placeholder="e.g. KVJ-PRJ-05" />
            <TextField name="title" label="Project Name *" placeholder="e.g. Q3 ERP Migration & Analytics" />

            {/* Client: combobox */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Organization *</label>
              <input
                list="client-datalist"
                value={clientNameInput}
                onChange={(e) => setClientNameInput(e.target.value)}
                placeholder="Type or select client name…"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-input, var(--bg-surface))',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <datalist id="client-datalist">
                {clients.map((c: any) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>

            <SelectField
              name="supervisorId"
              label="Project Supervisor *"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}${e.designation ? ` (${e.designation})` : ''}`,
              }))}
            />
            <ProjectMembersField employees={employees} />
            <SelectField
              name="status"
              label="Phase *"
              options={[
                { value: 'not_started', label: 'Not Started' },
                { value: 'planning', label: 'Kick Off' },
                { value: 'execution', label: 'In Execution' },
                { value: 'closure', label: 'Completed' },
              ]}
            />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setEditProjectOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </Form>
        </Drawer>
      )}
    </div>
  );
}

export default ProjectList;
