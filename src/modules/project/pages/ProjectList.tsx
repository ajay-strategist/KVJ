import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card, SectionHeader } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useProject } from '../hooks/useProject';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Project } from '../project.repository';

export function ProjectList() {
  const { projects, clients, createProject, addMilestone, loading } = useProject();
  const { toast } = useNotifications();

  const [projectOpen, setProjectOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createProject({
      title: values.title as string,
      code: values.code as string,
      category: values.category as string,
      type: values.type as string,
      status: values.status as any,
      priority: values.priority as any,
      clientId: (values.clientId as string) || undefined,
      estimatedHours: Number(values.estimatedHours) || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Project Created', message: `Project ${values.title} added successfully.` });
      setProjectOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleMilestoneSubmit = async (values: Record<string, unknown>) => {
    if (!selectedProjectId) return;
    const res = await addMilestone(
      selectedProjectId,
      values.title as string,
      values.dueDate as string
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Milestone Added', message: `Milestone ${values.title} scheduled.` });
      setMilestoneOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const clientName = (clientId?: string) => {
    const c = clients.find((cl) => cl.id === clientId);
    return c ? c.name : 'Independent';
  };

  const sampleWorkLogs = [
    { date: '21/07/26', task: 'Supabase Database Schema Setup', description: 'Wired migrations for roles and feature updates', supervisor: 'Manager (Operations)', reviewStatus: 'Under Review', currentStatus: 'In Progress', duration: '3h 30m' },
    { date: '20/07/26', task: 'AppShell Icon Performance Fix', description: 'Replaced font icons with inline SVGs', supervisor: 'CEO', reviewStatus: 'Approved', currentStatus: 'Completed', duration: '2h 15m' },
    { date: '19/07/26', task: 'ERP Module Refactoring', description: 'Updated state management and router definitions', supervisor: 'Manager (Operations)', reviewStatus: 'Approved', currentStatus: 'Completed', duration: '5h 00m' },
  ];

  const columns: Column<Project>[] = [
    { key: 'code', header: 'Code & Client', sortable: true, render: (p) => <div><strong>{p.code}</strong><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Client: {clientName(p.clientId)}</div></div> },
    { key: 'title', header: 'Project Title', sortable: true, accessor: (p) => p.title },
    { key: 'supervisor', header: 'Supervisor', render: () => <span>Manager (Operations)</span> },
    { key: 'hours', header: 'Hours (Total / Logged)', render: (p) => <strong>{p.estimatedHours || 120}h / 42h</strong> },
    { key: 'status', header: 'Status', render: (p) => (
      <span className={`kvj-badge kvj-badge--${p.status === 'execution' ? 'success' : 'neutral'}`}>{p.status}</span>
    )},
    { key: 'action', header: 'Actions', render: (p) => (
      <Button size="sm" variant="secondary" onClick={() => { setSelectedProjectId(p.id); setMilestoneOpen(true); }}>
        Add Milestone
      </Button>
    )},
  ];

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));

  return (
    <AppShell>
      <PageHeader
        title="Project Catalog & Work Logs"
        subtitle="Manage client projects, supervisor assignments, total hours, and review status"
        actions={<Button onClick={() => setProjectOpen(true)}>Create Master Project</Button>}
      />

      <DataTable columns={columns} rows={projects} rowKey={(p) => p.id} loading={loading} />

      {/* Tabular Work Log section (Newest to Oldest) */}
      <Card style={{ marginTop: 24 }}>
        <SectionHeader title="Project Work Log (Newest to Oldest)" />
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 8 }}>Date</th>
                <th style={{ padding: 8 }}>Task</th>
                <th style={{ padding: 8 }}>Description</th>
                <th style={{ padding: 8 }}>Supervisor</th>
                <th style={{ padding: 8 }}>Review Status</th>
                <th style={{ padding: 8 }}>Current Status</th>
                <th style={{ padding: 8 }}>Duration</th>
                <th style={{ padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sampleWorkLogs.map((wl, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{wl.date}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{wl.task}</td>
                  <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{wl.description}</td>
                  <td style={{ padding: 8 }}>{wl.supervisor}</td>
                  <td style={{ padding: 8 }}>
                    <span className={`kvj-badge kvj-badge--${wl.reviewStatus === 'Approved' ? 'success' : 'warning'}`}>
                      {wl.reviewStatus}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>{wl.currentStatus}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{wl.duration}</td>
                  <td style={{ padding: 8 }}>
                    {wl.reviewStatus === 'Under Review' && (
                      <Button size="sm" onClick={() => alert('Marked task officially completed by Manager/CEO!')}>
                        Approve Completion
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={projectOpen} onClose={() => setProjectOpen(false)} title="Create Master Project">
        <Form initial={{ status: 'initiation', priority: 'medium' }} onSubmit={handleCreateSubmit}>
          <TextField name="title" label="Project Title" />
          <TextField name="code" label="Project Code" placeholder="e.g. KVJ-PROJ-ABC" />
          <SelectField name="clientId" label="Assign Client" options={[{ value: '', label: 'None (Independent)' }, ...clientOptions]} />
          <TextField name="estimatedHours" label="Total Estimated Project Hours" placeholder="e.g. 120" />
          <TextField name="supervisor" label="Assign Project Supervisor" placeholder="Manager (Operations)" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setProjectOpen(false)}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </div>
        </Form>
      </Drawer>

      <Drawer open={milestoneOpen} onClose={() => setMilestoneOpen(false)} title="Schedule Project Milestone">
        <Form initial={{}} onSubmit={handleMilestoneSubmit}>
          <TextField name="title" label="Milestone Title" placeholder="e.g. Database Design Approved" />
          <DatePickerField name="dueDate" label="Target Due Date" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setMilestoneOpen(false)}>Cancel</Button>
            <Button type="submit">Schedule Milestone</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ProjectList;
