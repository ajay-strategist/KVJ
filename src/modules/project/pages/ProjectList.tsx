import { useState, useEffect, useMemo } from 'react';
import { PageHeader, Button, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useAuth } from '../../auth/AuthProvider';

import { useProject } from '../hooks/useProject';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';

export interface ProjectCardData {
  id: string;
  code: string;
  title: string;
  client: string;
  supervisor: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  members: Array<{ name: string; hours: number }>;
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

export function ProjectList() {
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // Status checkboxes filter state. Default: Not Started & In Progress checked, Completed unchecked
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Not Started', 'In Progress']);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);
  const [clientNameInput, setClientNameInput] = useState('');

  const [projectsList, setProjectsList] = useState<ProjectCardData[]>([]);

  const { projects, clients, tasks, allocations, timesheets, createProject, createTask, updateTask, deleteTask } = useProject();
  const { employees } = useEmployee();

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
    return projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      const supervisorAlloc = allocations.find((a) => a.projectId === p.id && (a.role.toLowerCase().includes('lead') || a.role.toLowerCase().includes('manager')));
      const supervisorEmp = (p as any).supervisorId
        ? employees.find((e) => e.id === (p as any).supervisorId)
        : supervisorAlloc
        ? employees.find((e) => e.id === supervisorAlloc.employeeId)
        : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : 'Manager (Operations)';

      let status: 'Not Started' | 'In Progress' | 'Completed' = 'Not Started';
      if (p.status === 'execution') status = 'In Progress';
      else if (p.status === 'closure') status = 'Completed';

      const pTasks = tasks.filter((t) => t.projectId === p.id);
      const pTaskIds = new Set(pTasks.map((t) => t.id));
      const pTimesheets = timesheets.filter((ts) => ts.taskId && pTaskIds.has(ts.taskId));

      const totalProjectHours = pTimesheets.reduce((sum, ts) => sum + Number(ts.hoursLogged || 0), 0) ||
        pTasks.reduce((sum, t) => sum + Number(t.actualHours || 0), 0);

      const pAllocations = allocations.filter((a) => a.projectId === p.id);
      const membersMap = new Map<string, { name: string; hours: number }>();

      // Add allocated employees
      pAllocations.forEach((a) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member';
        const empHours = pTimesheets
          .filter((ts) => ts.employeeId === a.employeeId)
          .reduce((sum, ts) => sum + Number(ts.hoursLogged || 0), 0);
        membersMap.set(name, { name, hours: empHours });
      });

      // Add task assignees and timesheet loggers
      pTasks.forEach((t) => {
        const emp = employees.find((e) => e.id === t.assigneeId || e.firstName === t.assigneeId || `${e.firstName} ${e.lastName}` === t.assigneeId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : (t.assigneeId || 'Team Member');
        const taskHours = Number(t.actualHours || 0);
        const existing = membersMap.get(name) || { name, hours: 0 };
        membersMap.set(name, { name, hours: Math.round((existing.hours + taskHours) * 10) / 10 });
      });

      const members = Array.from(membersMap.values());
      const tasksTotal = pTasks.length;
      const tasksCompleted = pTasks.filter((t) => t.status === 'done' || (t.status as any) === 'Completed').length;

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        client: client ? client.name : 'Independent',
        supervisor: supervisorName,
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

  // Filter based on selected checkboxes
  const filteredProjects = projectsList.filter((p) => selectedStatuses.includes(p.status));

  // Count active projects (Not Started + In Progress)
  const activeProjectsCount = projectsList.filter(
    (p) => p.status === 'Not Started' || p.status === 'In Progress'
  ).length;

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [];
    const pTasks = tasks.filter((t) => t.projectId === selectedProject.id);
    return pTasks.map((t) => {
      const assignee = employees.find((e) => e.id === t.assigneeId || e.firstName === t.assigneeId || `${e.firstName} ${e.lastName}` === t.assigneeId);
      const tTimesheets = timesheets.filter((ts) => ts.taskId === t.id);
      const hoursLogged = tTimesheets.reduce((sum, ts) => sum + Number(ts.hoursLogged || 0), 0) || Number(t.actualHours || 0);

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
    const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
    const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
    const initialStatus = isMgmt ? ((values.status as any) || 'execution') : 'planning';

    // Resolve client: match typed name to existing client, or pass name for new client creation
    const typedName = (clientNameInput || '').trim();
    const matchedClient = clients.find((c) => c.name.toLowerCase() === typedName.toLowerCase());
    const resolvedClientId = matchedClient ? matchedClient.id : undefined;

    const res = await createProject({
      title: values.title as string,
      code: (values.code as string) || `KVJ-PRJ-${Math.floor(100 + Math.random() * 900)}`,
      clientId: resolvedClientId,
      clientName: !matchedClient ? typedName : undefined,
      status: initialStatus as any,
      priority: 'medium',
      supervisorId: values.supervisorId as string,
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

  const handleAddTaskSubmit = async (values: Record<string, unknown>) => {
    if (!selectedProject) return;

    const res = await createTask({
      projectId: selectedProject.id as UUID,
      title: values.title as string,
      status: 'todo',
      priority: 'medium',
    });

    if (res.ok) {
      toast({
        variant: 'success',
        title: 'New Task Created',
        message: `Task "${values.title}" added to project ${selectedProject.code}.`,
      });
      setAddTaskOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // PDF Export Logic — full content: KPIs, member hours, all tasks with hours/status
  const exportReportToPDF = (p: ProjectCardData) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id && !t.deletedAt);
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
            .avatar { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#7c3aed); color: white; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-right: 6px; }
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
                  <td><span class="avatar">${m.name.charAt(0)}</span>${m.name}</td>
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
              ${pTasks.length > 0 ? pTasks.map((t, i) => {
                const assignee = employees.find((e) => e.id === t.assigneeId);
                const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned';
                const pTs = timesheets.filter((ts) => ts.taskId === t.id);
                const hrs = pTs.reduce((sum, ts) => sum + (ts.hoursLogged || 0), 0);
                return `
                  <tr>
                    <td style="color:#94a3b8;">${i + 1}</td>
                    <td style="font-weight:600;">${t.title}</td>
                    <td>${assigneeName}</td>
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
    { key: 'code', header: 'Project Code', sortable: true, render: (p) => <strong>{p.code}</strong> },
    { key: 'title', header: 'Project Name & Client', sortable: true, render: (p) => <div><div style={{ fontWeight: 600 }}>{p.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Client: {p.client}</div></div> },
    { key: 'supervisor', header: 'Supervisor', render: (p) => <span>👤 {p.supervisor}</span> },
    { key: 'members', header: 'Assigned Members & Hours', render: (p) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {p.members.map((m, idx) => (
          <span key={idx} style={{ fontSize: 11, background: 'var(--bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>
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
      <Badge tone={p.status === 'Completed' ? 'success' : p.status === 'In Progress' ? 'progress' : 'info'}>
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

  return (
    <div>
      <PageHeader
        title="Project Catalog & Work Logs"
        subtitle="Manage client projects, supervisors, assigned member hours, completion ratios, and reports"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* View Mode Toggle: Card View vs Table View */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
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
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  background: viewMode === 'table' ? 'var(--brand)' : 'var(--bg-surface)',
                  color: viewMode === 'table' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                📊 Table View
              </button>
            </div>

            <Button onClick={() => setCreateProjectOpen(true)}>Create Master Project</Button>
          </div>
        }
      />

      {/* Top Row: KPI Cards Left & Status Filter Right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        
        {/* Left Side: KPI Cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16, minWidth: 200, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active Projects</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{activeProjectsCount} Projects</div>
          </Card>

          <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 16, minWidth: 200, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Overall Task Completion</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
              {filteredProjects.reduce((acc, p) => acc + p.tasksCompleted, 0)} / {filteredProjects.reduce((acc, p) => acc + p.tasksTotal, 0)} Tasks
            </div>
          </Card>
        </div>

        {/* Right Side: Status Filter (Right of Overall Task Completion) */}
        <Card style={{ padding: 16, minWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Status Filter:</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {(['Not Started', 'In Progress', 'Completed'] as const).map((status) => (
                <label
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
            Showing {filteredProjects.length}/{projectsList.length}
          </span>
        </Card>
      </div>

      {/* Main View Display: Card View OR Table View */}
      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filteredProjects.map((p) => {
            const pct = p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0;
            return (
              <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 18 }}>
                <div>
                  {/* Top Bar: Code & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.05em' }}>
                        {p.code}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                        {p.title}
                      </h3>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Client: {p.client}</div>
                    </div>
                    <Badge tone={p.status === 'Completed' ? 'success' : p.status === 'In Progress' ? 'progress' : 'info'}>
                      {p.status}
                    </Badge>
                  </div>

                  {/* Supervisor */}
                  <div style={{ fontSize: 12, marginBottom: 12, padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Supervisor:</span> <strong>👤 {p.supervisor}</strong>
                  </div>

                  {/* Member-specific Hours Breakdown */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                      Assigned Members & Hours Worked:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.members.map((m, idx) => (
                        <div key={idx} style={{ fontSize: 11, background: 'var(--bg-sunken)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4 }}>
                          👤 {m.name}: <strong style={{ color: 'var(--brand)' }}>{m.hours} hrs</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Hours Worked & Task Completion Ratio (Clearly Presented) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--e1)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Total Hours Worked:</span>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>⏱ {p.totalHours} hrs</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--e1)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Task Ratio:</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
                        {p.tasksCompleted} / {p.tasksTotal} ({pct}%)
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
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
      {selectedProject && reportOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
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
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, letterSpacing: 2, marginBottom: 4 }}>📊 Detailed Project Report</div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{selectedProject.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedProject.code}</span>
                  <span>Client: <strong>{selectedProject.client}</strong></span>
                  <span>Supervisor: <strong>{selectedProject.supervisor}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
              >×</button>
            </div>

            {/* ── Scrollable Body ── */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {[
                  { label: 'Status', value: selectedProject.status, icon: '🏷️', bg: '#ede9fe', border: '#6366f1', color: '#4f46e5' },
                  { label: 'Total Hours', value: `${selectedProject.totalHours} hrs`, icon: '⏱️', bg: '#e0f2fe', border: '#0891b2', color: '#0284c7' },
                  { label: 'Tasks Done', value: `${selectedProject.tasksCompleted} / ${selectedProject.tasksTotal}`, icon: '✅', bg: '#dcfce7', border: '#16a34a', color: '#15803d' },
                  { label: 'Milestones', value: `${selectedProject.milestonesCount} Planned`, icon: '🏁', bg: '#fef9c3', border: '#ca8a04', color: '#a16207' },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ background: kpi.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${kpi.border}`, transition: 'transform 0.15s' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: kpi.color, letterSpacing: 0.8, marginBottom: 6 }}>{kpi.icon} {kpi.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  <span>Overall Task Completion</span>
                  <span style={{ color: '#4f46e5' }}>{selectedProject.tasksTotal > 0 ? Math.round((selectedProject.tasksCompleted / selectedProject.tasksTotal) * 100) : 0}%</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-sunken)', borderRadius: 5, overflow: 'hidden' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>

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
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: `hsl(${(idx * 67 + 240) % 360},60%,55%)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {m.name.charAt(0)}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5', background: '#ede9fe', padding: '2px 8px', borderRadius: 6 }}>{m.hours}h</span>
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
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Task</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assignee</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Hrs</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Due</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11 }}>Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProjectTasks.map((t, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-sunken)', transition: 'background 0.15s' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={t.assigneeId || ''}
                                onChange={async (e) => {
                                  await updateTask(t.id, { assigneeId: e.target.value });
                                  toast({ variant: 'success', title: 'Assignee Updated' });
                                }}
                                style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', maxWidth: 110 }}
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
                                  await updateTask(t.id, { status: e.target.value as any });
                                  toast({ variant: 'success', title: 'Status Updated' });
                                }}
                                style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer' }}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="review">Under Review</option>
                                <option value="done">Completed</option>
                              </select>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>{t.hoursLogged} hrs</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{t.dueDate}</td>
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
                                style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'all 0.15s' }}
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
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
        </div>
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
              {clients.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
            {clientNameInput && !clients.find((c) => c.name.toLowerCase() === clientNameInput.toLowerCase()) && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚡ New client will be registered: "{clientNameInput}"</div>
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
          <SelectField
            name="status"
            label="Initial Phase *"
            options={[
              { value: 'not_started', label: 'Not Started' },
              { value: 'planning', label: 'Planning / Kickoff' },
              { value: 'execution', label: 'In Execution' },
              { value: 'closure', label: 'Closure' },
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
            <DatePickerField name="dueDate" label="Due Date" />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Add Task to Project</Button>
            </div>
          </Form>
        </Drawer>
      )}
    </div>
  );
}

export default ProjectList;
