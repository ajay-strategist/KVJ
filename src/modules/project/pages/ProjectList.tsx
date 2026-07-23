import { useState, useEffect, useMemo } from 'react';
import { PageHeader, Button, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

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

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // Status checkboxes filter state. Default: Not Started & In Progress checked, Completed unchecked
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Not Started', 'In Progress']);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);

  const [projectsList, setProjectsList] = useState<ProjectCardData[]>([]);

  const { projects, clients, tasks, allocations, createProject, createTask } = useProject();
  const { employees } = useEmployee();

  const mappedProjects = useMemo(() => {
    return projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      const supervisorAlloc = allocations.find((a) => a.projectId === p.id && (a.role.toLowerCase().includes('lead') || a.role.toLowerCase().includes('manager')));
      const supervisorEmp = supervisorAlloc ? employees.find((e) => e.id === supervisorAlloc.employeeId) : null;
      const supervisorName = supervisorEmp ? `${supervisorEmp.firstName} ${supervisorEmp.lastName}` : 'Manager (Operations)';

      let status: 'Not Started' | 'In Progress' | 'Completed' = 'Not Started';
      if (p.status === 'execution') status = 'In Progress';
      else if (p.status === 'closure') status = 'Completed';

      const pAllocations = allocations.filter((a) => a.projectId === p.id);
      const members = pAllocations.map((a) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        return {
          name: emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member',
          hours: 0,
        };
      });

      const pTasks = tasks.filter((t) => t.projectId === p.id);
      const tasksTotal = pTasks.length;
      const tasksCompleted = pTasks.filter((t) => t.status === 'done').length;

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        client: client ? client.name : 'Independent',
        supervisor: supervisorName,
        status,
        members,
        totalHours: 0,
        tasksTotal,
        tasksCompleted,
        milestonesCount: 0,
      };
    });
  }, [projects, clients, tasks, allocations, employees]);

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
      const assignee = employees.find((e) => e.id === t.assigneeId);
      return {
        name: t.title,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
        status: t.status === 'done' ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Not Started',
        dueDate: t.dueDate || '—',
      };
    });
  }, [selectedProject, tasks, employees]);

  const handleCreateProject = async (values: Record<string, unknown>) => {
    const res = await createProject({
      title: values.title as string,
      code: (values.code as string) || `KVJ-PROJ-${Math.floor(100 + Math.random() * 900)}`,
      status: 'planning',
      priority: 'medium',
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Project Created', message: `${res.value.title} added successfully.` });
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

  // PDF Export Logic with custom print layout and KVJ logo
  const exportReportToPDF = (p: ProjectCardData) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id);
    const reportTasks: TaskItem[] = pTasks.map((t) => {
      const assignee = employees.find((e) => e.id === t.assigneeId);
      return {
        name: t.title,
        assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
        status: t.status === 'done' ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Not Started',
        dueDate: t.dueDate || '—',
      };
    });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ variant: 'error', title: 'Pop-up Blocked', message: 'Please allow pop-ups to export the PDF.' });
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Detailed Project Report - ${p.code}</title>
          <style>
            body { font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-container { display: flex; align-items: center; gap: 10px; }
            .logo-text { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            .project-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; }
            .project-meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #e0f2fe; color: #0369a1; }
            .badge-completed { background: #dcfce7; color: #15803d; }
            .badge-in-progress { background: #fef9c3; color: #a16207; }
            .badge-not-started { background: #f1f5f9; color: #475569; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #f8fafc; }
            .metric-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
            .metric-value { font-size: 18px; font-weight: 800; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
            th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 10px 12px; font-size: 12px; border-bottom: 2px solid #e2e8f0; }
            td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
            .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/logo.png" alt="Logo" style="height: 32px;" />
            </div>
            <div>
              <span class="badge ${p.status === 'Completed' ? 'badge-completed' : p.status === 'In Progress' ? 'badge-in-progress' : 'badge-not-started'}">${p.status}</span>
            </div>
          </div>

          <h2 class="project-title">${p.title}</h2>
          <div class="project-meta">Project Code: <strong>${p.code}</strong> &middot; Client: <strong>${p.client}</strong> &middot; Lead Supervisor: <strong>${p.supervisor}</strong></div>

          <div class="grid">
            <div class="metric-card">
              <div class="metric-label">Total Logged Work</div>
              <div class="metric-value">${p.totalHours} Hours</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Task Progress</div>
              <div class="metric-value">${p.tasksCompleted} / ${p.tasksTotal} Tasks Completed (${p.tasksTotal > 0 ? Math.round((p.tasksCompleted / p.tasksTotal) * 100) : 0}%)</div>
            </div>
          </div>

          <div class="section-title">Member-Specific Logged Hours</div>
          <table>
            <thead>
              <tr>
                <th>Team Member</th>
                <th style="text-align: right;">Total Logged Hours</th>
              </tr>
            </thead>
            <tbody>
              ${p.members.map(m => `
                <tr>
                  <td>👤 ${m.name}</td>
                  <td style="text-align: right; font-weight: 700;">${m.hours} hrs</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Individual Task List</div>
          <table>
            <thead>
              <tr>
                <th>Task Description</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${reportTasks.length > 0 ? reportTasks.map(t => `
                <tr>
                  <td>${t.name}</td>
                  <td>👤 ${t.assignee}</td>
                  <td>${t.status}</td>
                  <td>${t.dueDate}</td>
                </tr>
              `).join('') : `<tr><td colspan="4" style="text-align: center; color: #64748b;">No individual tasks logged.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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

      {/* Detailed Project Report Modal with Tasks List and PDF Export */}
      {selectedProject && (
        <Drawer open={reportOpen} onClose={() => setReportOpen(false)} title={`Detailed Report — ${selectedProject.code}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedProject.title}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Client: {selectedProject.client} · Supervisor: {selectedProject.supervisor}</div>
            </div>

            <Card style={{ padding: 14, background: 'var(--bg-sunken)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>Status: <Badge tone="info">{selectedProject.status}</Badge></div>
                <div>Milestones: <strong>{selectedProject.milestonesCount} Scheduled</strong></div>
                <div>Total Logged Hours: <strong>{selectedProject.totalHours} hrs</strong></div>
                <div>Task Progress: <strong>{selectedProject.tasksCompleted} / {selectedProject.tasksTotal} Completed</strong></div>
              </div>
            </Card>

            {/* Member Hours Log */}
            <div>
              <SectionHeader title="Member-Specific Hours Log" />
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 6 }}>Team Member</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Logged Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProject.members.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed var(--border)' }}>
                      <td style={{ padding: 6 }}>👤 {m.name}</td>
                      <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{m.hours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Individual Task List (Positioned below Member Hours) */}
            <div>
              <SectionHeader title="Individual Task List" />
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 6 }}>Task Description</th>
                    <th style={{ padding: 6 }}>Assignee</th>
                    <th style={{ padding: 6 }}>Status</th>
                    <th style={{ padding: 6 }}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProjectTasks.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed var(--border)' }}>
                      <td style={{ padding: 6 }}>{t.name}</td>
                      <td style={{ padding: 6 }}>👤 {t.assignee}</td>
                      <td style={{ padding: 6 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: t.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                          color: t.status === 'Completed' ? 'var(--status-success)' : 'var(--brand)',
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: 6, color: 'var(--text-muted)' }}>{t.dueDate}</td>
                    </tr>
                  ))}
                  {selectedProjectTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No tasks logged for this project yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons: Export to PDF & Close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <Button variant="secondary" onClick={() => exportReportToPDF(selectedProject)}>
                📄 Export PDF (with KVJ Logo)
              </Button>
              <Button onClick={() => setReportOpen(false)}>Close Report</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create Project Modal */}
      <Drawer open={createProjectOpen} onClose={() => setCreateProjectOpen(false)} title="Create Master Project">
        <Form initial={{ status: 'Not Started', supervisor: 'Manager (Operations)' }} onSubmit={handleCreateProject}>
          <TextField name="title" label="Project Name / Title" placeholder="e.g. Supabase Multi-Tenant Analytics" />
          <TextField name="code" label="Project Code" placeholder="e.g. KVJ-PROJ-105" />
          <TextField name="client" label="Client Name" placeholder="e.g. Christ University" />
          <SelectField
            name="supervisor"
            label="Supervisor"
            options={[
              { value: 'Manager (Operations)', label: 'Manager (Operations)' },
              { value: 'CEO', label: 'CEO' },
              { value: 'System Admin', label: 'System Admin' },
            ]}
          />
          <SelectField
            name="status"
            label="Initial Status"
            options={[
              { value: 'Not Started', label: 'Not Started' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Completed', label: 'Completed' },
            ]}
          />
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
              options={[
                { value: 'Linto George', label: 'Linto George' },
                { value: 'Ajay Kumar', label: 'Ajay Kumar' },
                { value: 'Anju V', label: 'Anju V' },
                { value: 'Sankar M', label: 'Sankar M' },
              ]}
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
