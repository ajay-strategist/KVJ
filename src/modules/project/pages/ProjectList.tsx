import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

export interface ProjectCardData {
  id: string;
  code: string;
  title: string;
  client: string;
  supervisor: string;
  status: 'Active' | 'In Progress' | 'Completed';
  members: Array<{ name: string; hours: number }>;
  totalHours: number;
  tasksTotal: number;
  tasksCompleted: number;
  milestonesCount: number;
}

export function ProjectList() {
  const { toast } = useNotifications();

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'In Progress' | 'Completed'>('all');
  const [hideCompleted, setHideCompleted] = useState(true);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);

  // Sample Master Projects Data
  const [projectsList, setProjectsList] = useState<ProjectCardData[]>([
    {
      id: 'p1',
      code: 'KVJ-PROJ-101',
      title: 'Supabase Multi-Tenant Analytics Platform',
      client: 'Christ University',
      supervisor: 'Manager (Operations)',
      status: 'In Progress',
      members: [
        { name: 'Linto George', hours: 24.5 },
        { name: 'Ajay Kumar', hours: 12.0 },
        { name: 'Anju V', hours: 8.5 },
      ],
      totalHours: 45.0,
      tasksTotal: 10,
      tasksCompleted: 8,
      milestonesCount: 3,
    },
    {
      id: 'p2',
      code: 'KVJ-PROJ-102',
      title: 'Enterprise ERP Attendance & Payroll Sync',
      client: 'Vimala College',
      supervisor: 'CEO',
      status: 'Active',
      members: [
        { name: 'Linto George', hours: 18.0 },
        { name: 'Sankar M', hours: 14.0 },
      ],
      totalHours: 32.0,
      tasksTotal: 6,
      tasksCompleted: 4,
      milestonesCount: 2,
    },
    {
      id: 'p3',
      code: 'KVJ-PROJ-103',
      title: 'AI Data Processing & OCR Pipeline',
      client: 'Nehru Group',
      supervisor: 'Manager (Operations)',
      status: 'In Progress',
      members: [
        { name: 'Ajay Kumar', hours: 30.0 },
        { name: 'Anju V', hours: 22.0 },
      ],
      totalHours: 52.0,
      tasksTotal: 8,
      tasksCompleted: 5,
      milestonesCount: 4,
    },
    {
      id: 'p4',
      code: 'KVJ-PROJ-099',
      title: 'Legacy Database Migration & Archival',
      client: 'SB College',
      supervisor: 'CEO',
      status: 'Completed',
      members: [
        { name: 'Linto George', hours: 40.0 },
        { name: 'Sankar M', hours: 25.0 },
      ],
      totalHours: 65.0,
      tasksTotal: 12,
      tasksCompleted: 12,
      milestonesCount: 5,
    },
  ]);

  // Filter logic: Completed projects hidden by default or filtered
  const filteredProjects = projectsList.filter((p) => {
    if (hideCompleted && p.status === 'Completed') return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const handleCreateProject = (values: Record<string, unknown>) => {
    const newProj: ProjectCardData = {
      id: `p-${Date.now()}`,
      code: (values.code as string) || `KVJ-PROJ-${Math.floor(100 + Math.random() * 900)}`,
      title: values.title as string,
      client: (values.client as string) || 'Independent',
      supervisor: (values.supervisor as string) || 'Manager (Operations)',
      status: (values.status as any) || 'Active',
      members: [
        { name: 'Linto George', hours: 0 },
        { name: 'Ajay Kumar', hours: 0 },
      ],
      totalHours: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      milestonesCount: 1,
    };
    setProjectsList((prev) => [newProj, ...prev]);
    toast({ variant: 'success', title: 'Project Created', message: `${newProj.title} added successfully.` });
    setCreateProjectOpen(false);
  };

  const handleAddTaskSubmit = (values: Record<string, unknown>) => {
    if (!selectedProject) return;
    setProjectsList((prev) =>
      prev.map((p) =>
        p.id === selectedProject.id
          ? { ...p, tasksTotal: p.tasksTotal + 1 }
          : p
      )
    );
    toast({
      variant: 'success',
      title: 'New Task Created',
      message: `Task "${values.title}" added to project ${selectedProject.code}.`,
    });
    setAddTaskOpen(false);
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

      {/* Top KPI Dashboard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Projects In View</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{filteredProjects.length} Projects</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--accent)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Member Hours</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>⏱ {filteredProjects.reduce((acc, p) => acc + p.totalHours, 0).toFixed(1)} hrs</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Overall Task Completion</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
            {filteredProjects.reduce((acc, p) => acc + p.tasksCompleted, 0)} / {filteredProjects.reduce((acc, p) => acc + p.tasksTotal, 0)} Tasks
          </div>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Status Filter:</span>
            <select
              className="kvj-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-xs)', minWidth: 150 }}
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              🚫 Hide Completed Projects
            </label>
          </div>

          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredProjects.length} of {projectsList.length} Projects
          </span>
        </div>
      </Card>

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

                  {/* Total Hours Worked & Task Completion Ratio */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ padding: '8px 10px', background: 'rgba(95, 211, 232, 0.1)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Total Hours:</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>⏱ {p.totalHours} hrs</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid #22C55E' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Task Ratio:</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--status-success)', marginTop: 2 }}>
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

      {/* Detailed Project Report Modal */}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setReportOpen(false)}>Close Report</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create Project Modal */}
      <Drawer open={createProjectOpen} onClose={() => setCreateProjectOpen(false)} title="Create Master Project">
        <Form initial={{ status: 'Active', supervisor: 'Manager (Operations)' }} onSubmit={handleCreateProject}>
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
              { value: 'Active', label: 'Active' },
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
