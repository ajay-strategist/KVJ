import { useState } from 'react';
import { PageHeader, Card, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export interface TaskItem {
  id: string;
  name: string;
  category: 'Office Task' | 'Project Task';
  projectName?: string;
  supervisor: string;
  assignee: string;
  dueDate: string; // YYYY-MM-DD
  status: 'To Do' | 'In Progress' | 'Under Review' | 'Completed';
  totalHoursWorked: number;
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

export function TaskBoard() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const userRole = user?.role || 'EMPLOYEE';
  const isSupervisorRole = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [dateWindowFilter, setDateWindowFilter] = useState<'next_3_days' | 'today' | 'all'>('next_3_days');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Today is 2026-07-21
  const todayStr = '2026-07-21';

  // Sample Rich Tasks
  const [tasksList, setTasksList] = useState<TaskItem[]>([
    {
      id: 't1',
      name: 'Supabase Database Schema Migration',
      category: 'Project Task',
      projectName: 'KVJ-PROJ-101 (Multi-Tenant Analytics)',
      supervisor: 'Manager (Operations)',
      assignee: 'Linto George',
      dueDate: '2026-07-21', // Today
      status: 'In Progress',
      totalHoursWorked: 5.5,
      dailyTimeEntries: [
        { id: 'e1', date: '2026-07-21', loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 3.5, description: 'Created initial SQL schemas and table indexes', status: 'Approved' },
        { id: 'e2', date: '2026-07-21', loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 2.0, description: 'Added foreign keys and RLS security rules', status: 'Pending Review' },
      ],
    },
    {
      id: 't2',
      name: 'Monthly GST & Financial Voucher Filing',
      category: 'Office Task',
      projectName: 'Office Operations',
      supervisor: 'CEO',
      assignee: 'Linto George',
      dueDate: '2026-07-22', // Next Day
      status: 'To Do',
      totalHoursWorked: 2.0,
      dailyTimeEntries: [
        { id: 'e3', date: '2026-07-21', loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 2.0, description: 'Compiled GST invoices and voucher records', status: 'Approved' },
      ],
    },
    {
      id: 't3',
      name: 'Training Batch Syllabus Review & Q3 Updates',
      category: 'Office Task',
      projectName: 'Academic Training',
      supervisor: 'Manager (Operations)',
      assignee: 'Ajay Kumar',
      dueDate: '2026-07-23', // 2 Days out
      status: 'In Progress',
      totalHoursWorked: 4.0,
      dailyTimeEntries: [
        { id: 'e4', date: '2026-07-21', loggedByRole: 'Assignee', loggedByName: 'Ajay Kumar', durationHrs: 4.0, description: 'Drafted Q3 Power BI syllabus outline', status: 'Approved' },
      ],
    },
    {
      id: 't4',
      name: 'Server Log Maintenance & Backup Audit',
      category: 'Office Task',
      projectName: 'IT Infrastructure',
      supervisor: 'Manager (Operations)',
      assignee: 'Sankar M',
      dueDate: '2026-07-24', // 3 Days out
      status: 'Under Review',
      totalHoursWorked: 3.0,
      dailyTimeEntries: [
        { id: 'e5', date: '2026-07-21', loggedByRole: 'Assignee', loggedByName: 'Sankar M', durationHrs: 3.0, description: 'Executed automated snapshot backup scripts', status: 'Pending Review' },
      ],
    },
    {
      id: 't5',
      name: 'AI OCR Model Validation & Benchmarking',
      category: 'Project Task',
      projectName: 'KVJ-PROJ-103 (AI OCR Pipeline)',
      supervisor: 'CEO',
      assignee: 'Anju V',
      dueDate: '2026-07-28', // Beyond 3 days
      status: 'To Do',
      totalHoursWorked: 6.0,
      dailyTimeEntries: [
        { id: 'e6', date: '2026-07-20', loggedByRole: 'Assignee', loggedByName: 'Anju V', durationHrs: 6.0, description: 'Tested 100 sample document scans', status: 'Approved' },
      ],
    },
  ]);

  // Filtering & Sorting
  const filteredTasks = tasksList.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

    // Date window filter: Current day and next 3 days
    if (dateWindowFilter === 'today') {
      if (t.dueDate !== todayStr) return false;
    } else if (dateWindowFilter === 'next_3_days') {
      const d = new Date(t.dueDate);
      const start = new Date('2026-07-21');
      const end = new Date('2026-07-24');
      if (d < start || d > end) return false;
    }

    return true;
  });

  // Sort tasks by Due Date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const da = new Date(a.dueDate).getTime();
    const db = new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? da - db : db - da;
  });

  const handleCreateTask = (values: Record<string, unknown>) => {
    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      name: values.name as string,
      category: (values.category as any) || 'Office Task',
      projectName: (values.projectName as string) || 'Office Operations',
      supervisor: (values.supervisor as string) || 'Manager (Operations)',
      assignee: (values.assignee as string) || (user?.fullName || 'Linto George'),
      dueDate: (values.dueDate as string) || todayStr,
      status: (values.status as any) || 'To Do',
      totalHoursWorked: 0,
      dailyTimeEntries: [],
    };
    setTasksList((prev) => [newTask, ...prev]);
    toast({ variant: 'success', title: 'Task Created', message: `Task "${newTask.name}" created.` });
    setCreateTaskOpen(false);
  };

  const handleLogDailyTime = (values: Record<string, unknown>) => {
    if (!selectedTask) return;

    const duration = Number(values.durationHrs) || 1.0;
    const entryRole: 'Assignee' | 'Supervisor' = isSupervisorRole ? 'Supervisor' : 'Assignee';

    const newEntry = {
      id: `e-${Date.now()}`,
      date: (values.date as string) || todayStr,
      loggedByRole: entryRole,
      loggedByName: user?.fullName || 'Linto George',
      durationHrs: duration,
      description: (values.description as string) || 'Daily work progress entry',
      status: isSupervisorRole ? ('Approved' as const) : ('Pending Review' as const),
    };

    setTasksList((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id
          ? {
              ...t,
              totalHoursWorked: t.totalHoursWorked + duration,
              dailyTimeEntries: [newEntry, ...t.dailyTimeEntries],
            }
          : t
      )
    );

    toast({
      variant: 'success',
      title: 'Time Entry Logged',
      message: `${duration} hrs logged as ${entryRole} for ${selectedTask.name}.`,
    });
    setTimeEntryOpen(false);
  };

  const handleApproveEntry = (taskId: string, entryId: string) => {
    setTasksList((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              dailyTimeEntries: t.dailyTimeEntries.map((e) =>
                e.id === entryId ? { ...e, status: 'Approved' } : e
              ),
            }
          : t
      )
    );
    toast({ variant: 'success', title: 'Entry Approved', message: 'Work log entry approved.' });
  };

  const dueTodayCount = tasksList.filter((t) => t.dueDate === todayStr).length;
  const totalHoursSum = tasksList.reduce((acc, t) => acc + t.totalHoursWorked, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Tasks Dashboard & Daily Time Entries"
        subtitle="Track office and project tasks, supervisor & assignee time entries, and due date schedules"
        actions={<Button onClick={() => setCreateTaskOpen(true)}>➕ Create Task</Button>}
      />

      {/* Modern Top KPI Dashboard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tasks In View</div>
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

      {/* Filters & Sorting Control Bar */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Category Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🏷 Task Type:</span>
              <select
                className="kvj-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-xs)', minWidth: 140 }}
              >
                <option value="all">All Tasks</option>
                <option value="Office Task">Office Task</option>
                <option value="Project Task">Project Task</option>
              </select>
            </div>

            {/* Date Window Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📅 Date Window:</span>
              <select
                className="kvj-select"
                value={dateWindowFilter}
                onChange={(e) => setDateWindowFilter(e.target.value as any)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-xs)', minWidth: 190 }}
              >
                <option value="next_3_days">Today & Next 3 Days</option>
                <option value="today">Today Only (21/07)</option>
                <option value="all">All Dates</option>
              </select>
            </div>

            {/* Due Date Sort Order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>⏳ Sort by Due Date:</span>
              <button
                type="button"
                className="kvj-button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-xs)', background: 'var(--bg-sunken)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                {sortOrder === 'asc' ? '⬆ Nearest First' : '⬇ Farthest First'}
              </button>
            </div>
          </div>

          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {sortedTasks.length} Tasks
          </span>
        </div>
      </Card>

      {/* Tasks List Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedTasks.map((task) => (
          <Card key={task.id} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Badge tone={task.category === 'Office Task' ? 'warning' : 'info'}>
                    {task.category}
                  </Badge>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
                    {task.projectName}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 6px 0', color: 'var(--text-primary)' }}>
                  {task.name}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Supervisor: <strong>👤 {task.supervisor}</strong></span>
                  <span>Assignee: <strong>👤 {task.assignee}</strong></span>
                  <span>Due Date: <strong style={{ color: task.dueDate === todayStr ? 'var(--status-danger)' : 'inherit' }}>📅 {task.dueDate} {task.dueDate === todayStr ? '(Today)' : ''}</strong></span>
                  <span>Total Worked: <strong style={{ color: 'var(--accent)' }}>⏱ {task.totalHoursWorked} hrs</strong></span>
                </div>
              </div>

              {/* Status Badge & Daily Time Entry Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <Badge tone={task.status === 'Completed' ? 'success' : task.status === 'In Progress' ? 'progress' : task.status === 'Under Review' ? 'warning' : 'neutral'}>
                  {task.status}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => { setSelectedTask(task); setTimeEntryOpen(true); }}
                  style={{ fontSize: 11.5 }}
                >
                  ⏱ Log Daily Time Entry
                </Button>
              </div>
            </div>

            {/* Daily Time Entries Accordion / Dropdown Log */}
            {task.dailyTimeEntries.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Daily Time Entries & Role Logs ({task.dailyTimeEntries.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {task.dailyTimeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        padding: '6px 10px',
                        background: 'var(--bg-sunken)',
                        borderRadius: 'var(--radius-xs)',
                        borderLeft: entry.loggedByRole === 'Supervisor' ? '3px solid var(--accent)' : '3px solid var(--brand)',
                      }}
                    >
                      <div>
                        <span>📅 <strong>{entry.date}</strong></span>
                        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
                        <Badge tone={entry.loggedByRole === 'Supervisor' ? 'info' : 'neutral'}>
                          Role: {entry.loggedByRole} ({entry.loggedByName})
                        </Badge>
                        <span style={{ marginLeft: 8 }}>{entry.description}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ color: 'var(--brand)' }}>⏱ {entry.durationHrs} hrs</strong>
                        <Badge tone={entry.status === 'Approved' ? 'success' : 'warning'}>
                          {entry.status}
                        </Badge>
                        {isSupervisorRole && entry.status === 'Pending Review' && (
                          <button
                            type="button"
                            onClick={() => handleApproveEntry(task.id, entry.id)}
                            style={{ padding: '2px 6px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--status-success)', color: 'white', border: 'none', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Log Daily Time Entry Modal */}
      {selectedTask && (
        <Drawer open={timeEntryOpen} onClose={() => setTimeEntryOpen(false)} title={`Log Daily Time Entry — ${selectedTask.name}`}>
          <Form initial={{ date: todayStr, durationHrs: '2.0' }} onSubmit={handleLogDailyTime}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)', marginBottom: 12, fontSize: 12 }}>
              <div>Logging as Role: <strong style={{ color: 'var(--brand)' }}>{isSupervisorRole ? 'Supervisor' : 'Assignee'} ({user?.fullName || 'Linto George'})</strong></div>
              <div>Assignee: {selectedTask.assignee} · Supervisor: {selectedTask.supervisor}</div>
            </div>

            <TextField name="date" label="Date of Entry" placeholder="YYYY-MM-DD" />
            <TextField name="durationHrs" label="Duration (Hours)" placeholder="e.g. 2.5" />
            <TextAreaField name="description" label="Work Description / Progress Notes" placeholder="Details of work completed..." />

            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setTimeEntryOpen(false)}>Cancel</Button>
              <Button type="submit">Log Time Entry</Button>
            </div>
          </Form>
        </Drawer>
      )}

      {/* Create Task Modal */}
      <Drawer open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Create New Task">
        <Form initial={{ category: 'Office Task', status: 'To Do', supervisor: 'Manager (Operations)', dueDate: todayStr }} onSubmit={handleCreateTask}>
          <TextField name="name" label="Task Name" placeholder="e.g. Server Maintenance" />
          <SelectField
            name="category"
            label="Task Category"
            options={[
              { value: 'Office Task', label: 'Office Task' },
              { value: 'Project Task', label: 'Project Task' },
            ]}
          />
          <TextField name="projectName" label="Project / Department Name" placeholder="e.g. Internal Operations" />
          <SelectField
            name="supervisor"
            label="Supervisor"
            options={[
              { value: 'Manager (Operations)', label: 'Manager (Operations)' },
              { value: 'CEO', label: 'CEO' },
            ]}
          />
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
          <SelectField
            name="status"
            label="Initial Status"
            options={[
              { value: 'To Do', label: 'To Do' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Under Review', label: 'Under Review' },
              { value: 'Completed', label: 'Completed' },
            ]}
          />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button type="submit">Create Task</Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}

export default TaskBoard;
