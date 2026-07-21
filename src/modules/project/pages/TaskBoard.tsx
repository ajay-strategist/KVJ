import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button } from '../../../shared/ui/components';
import { useProject } from '../hooks/useProject';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Task } from '../project.repository';
import type { Employee } from '../../employee/employee.repository';

export function TaskBoard() {
  const { tasks, projects, createTask, loading } = useProject();
  const { toast } = useNotifications();

  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) setEmployees(res.value);
    });
  }, []);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createTask({
      projectId: values.projectId as string,
      title: values.title as string,
      description: values.description as string || undefined,
      priority: values.priority as any,
      status: values.status as any,
      assigneeId: (values.assigneeId as string) || undefined,
      estimatedHours: Number(values.estimatedHours) || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Task Created', message: `${values.title} added successfully.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.projectId === selectedProjectId)
    : tasks;

  const columns = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'review', label: 'In Review' },
    { id: 'done', label: 'Completed' },
  ];

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));
  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  const [workLogOpen, setWorkLogOpen] = useState(false);

  const sampleTaskLogs = [
    { date: '21/07/26', task: 'Monthly GST Filing', description: 'Office Task (Recurring 21st)', project: 'Internal Admin', supervisor: 'CEO', reviewStatus: 'Approved', currentStatus: 'Completed', duration: '2h 00m' },
    { date: '21/07/26', task: 'Server Log Maintenance', description: 'Office Task (Single Day)', project: 'IT Infrastructure', supervisor: 'Manager (Operations)', reviewStatus: 'Approved', currentStatus: 'Completed', duration: '1h 30m' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Project & Office Task Board"
        subtitle="Manage sprint tasks, single-day / recurring office tasks, and work logs"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setWorkLogOpen(true)}>📋 View Work Log</Button>
            <Button onClick={() => setOpen(true)}>Create Task</Button>
          </div>
        }
      />

      <Drawer open={workLogOpen} onClose={() => setWorkLogOpen(false)} title="Task Work Log (Tabular View)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 8 }}>Date</th>
                <th style={{ padding: 8 }}>Task</th>
                <th style={{ padding: 8 }}>Description</th>
                <th style={{ padding: 8 }}>Project</th>
                <th style={{ padding: 8 }}>Supervisor</th>
                <th style={{ padding: 8 }}>Review Status</th>
                <th style={{ padding: 8 }}>Current Status</th>
                <th style={{ padding: 8 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sampleTaskLogs.map((tl, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{tl.date}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{tl.task}</td>
                  <td style={{ padding: 8 }}>{tl.description}</td>
                  <td style={{ padding: 8 }}>{tl.project}</td>
                  <td style={{ padding: 8 }}>{tl.supervisor}</td>
                  <td style={{ padding: 8 }}><span className="kvj-badge kvj-badge--success">{tl.reviewStatus}</span></td>
                  <td style={{ padding: 8 }}>{tl.currentStatus}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{tl.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Drawer>

      <div style={{ maxWidth: 320, marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Filter by Project</label>
        <select
          className="kvj-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} style={{ background: 'var(--bg-sunken)', borderRadius: 10, padding: 12, minHeight: 400 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>{col.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{colTasks.length}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.map((task) => (
                  <Card key={task.id} style={{ padding: 12, cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{task.description}</div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`kvj-badge kvj-badge--${task.priority === 'high' ? 'danger' : 'neutral'}`}>
                        {task.priority}
                      </span>
                      {task.assigneeId && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--brand)' }}>
                          👤 {employees.find((e) => e.id === task.assigneeId)?.lastName}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Create New Task">
        <Form initial={{ priority: 'medium', status: 'todo' }} onSubmit={handleCreateSubmit}>
          <SelectField name="projectId" label="Select Project" options={projectOptions} />
          <TextField name="title" label="Task Title" />
          <TextAreaField name="description" label="Task Description" />
          <SelectField name="assigneeId" label="Assignee" options={[{ value: '', label: 'Unassigned' }, ...employeeOptions]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField
              name="priority"
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
            <SelectField
              name="status"
              label="Initial Status"
              options={[
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'review', label: 'In Review' },
                { value: 'done', label: 'Completed' },
              ]}
            />
          </div>
          <TextField name="estimatedHours" label="Estimated Effort Hours" placeholder="e.g. 8" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Task</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default TaskBoard;
