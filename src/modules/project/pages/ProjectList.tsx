import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
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

  const columns: Column<Project>[] = [
    { key: 'code', header: 'Code', sortable: true, accessor: (p) => p.code },
    { key: 'title', header: 'Project Title', sortable: true, accessor: (p) => p.title },
    { key: 'client', header: 'Client', render: (p) => clientName(p.clientId) },
    { key: 'status', header: 'Status', render: (p) => (
      <span className={`kvj-badge kvj-badge--${p.status === 'execution' ? 'success' : 'neutral'}`}>{p.status}</span>
    )},
    { key: 'priority', header: 'Priority', render: (p) => (
      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: p.priority === 'critical' ? 'var(--status-danger)' : 'var(--text-primary)' }}>{p.priority}</span>
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
        title="Project Catalog"
        subtitle="Manage master project files, milestones, and deliverables"
        actions={<Button onClick={() => setProjectOpen(true)}>Create Project</Button>}
      />

      <DataTable columns={columns} rows={projects} rowKey={(p) => p.id} loading={loading} />

      <Drawer open={projectOpen} onClose={() => setProjectOpen(false)} title="Create Master Project">
        <Form initial={{ status: 'initiation', priority: 'medium' }} onSubmit={handleCreateSubmit}>
          <TextField name="title" label="Project Title" />
          <TextField name="code" label="Project Code" placeholder="e.g. KVJ-PROJ-ABC" />
          <SelectField name="clientId" label="Assign Client (Optional)" options={[{ value: '', label: 'None (Independent)' }, ...clientOptions]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="category" label="Category" placeholder="e.g. Software development" />
            <TextField name="type" label="Contract Type" placeholder="e.g. Fixed Price" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField
              name="status"
              label="Status"
              options={[
                { value: 'initiation', label: 'Initiation' },
                { value: 'planning', label: 'Planning' },
                { value: 'execution', label: 'Execution' },
                { value: 'closure', label: 'Closure' },
              ]}
            />
            <SelectField
              name="priority"
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
          </div>
          <TextField name="estimatedHours" label="Estimated Hours" placeholder="e.g. 120" />

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
