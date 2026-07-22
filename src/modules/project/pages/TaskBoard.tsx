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

import { useMemo, useState } from 'react';
import { PageHeader, Card, Button, Badge, WorkflowStrip } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import { todayISO, addDaysISO } from '../../../shared/utils/date';

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
  const { can } = usePermissions();
  const isSupervisorRole = can('task', 'approve');

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Office Task' | 'Project Task'>('all');
  const [dateWindowFilter, setDateWindowFilter] = useState<'next_3_days' | 'today' | 'all'>('next_3_days');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const todayStr = useMemo(() => todayISO(), []);

  const [tasksList, setTasksList] = useState<TaskItem[]>([
    {
      id: 't-pending-1',
      name: 'Q3 Curriculum & Lab Material Audit',
      category: 'Office Task',
      projectName: 'Academic Training',
      supervisor: 'Manager (Operations)',
      assignee: 'Linto George',
      dueDate: todayStr,
      status: 'Pending Approval',
      totalHoursWorked: 0,
      dailyTimeEntries: [],
    },
    {
      id: 't1',
      name: 'Supabase Database Schema Migration',
      category: 'Project Task',
      projectName: 'KVJ-PROJ-101 (Multi-Tenant Analytics)',
      supervisor: 'Manager (Operations)',
      assignee: 'Linto George',
      dueDate: todayStr,
      status: 'In Progress',
      totalHoursWorked: 5.5,
      approvedBy: 'Manager (Operations)',
      approvedAt: '2026-07-20 10:00 AM',
      acceptedAt: '2026-07-20 10:15 AM',
      dailyTimeEntries: [
        { id: 'e1', date: todayStr, loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 3.5, description: 'Created initial SQL schemas and table indexes', status: 'Approved' },
        { id: 'e2', date: todayStr, loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 2.0, description: 'Added foreign keys and RLS security rules', status: 'Pending Review' },
      ],
    },
    {
      id: 't2',
      name: 'Monthly GST & Financial Voucher Filing',
      category: 'Office Task',
      projectName: 'Office Operations',
      supervisor: 'CEO',
      assignee: 'Linto George',
      dueDate: addDaysISO(1),
      status: 'To Do',
      totalHoursWorked: 2.0,
      approvedBy: 'CEO',
      approvedAt: '2026-07-20 02:00 PM',
      dailyTimeEntries: [
        { id: 'e3', date: todayStr, loggedByRole: 'Assignee', loggedByName: 'Linto George', durationHrs: 2.0, description: 'Compiled GST invoices and voucher records', status: 'Approved' },
      ],
    },
    {
      id: 't3',
      name: 'Training Batch Syllabus Review & Q3 Updates',
      category: 'Office Task',
      projectName: 'Academic Training',
      supervisor: 'Manager (Operations)',
      assignee: 'Ajay Kumar',
      dueDate: addDaysISO(2),
      status: 'In Progress',
      totalHoursWorked: 4.0,
      approvedBy: 'Manager Ops',
      dailyTimeEntries: [
        { id: 'e4', date: todayStr, loggedByRole: 'Assignee', loggedByName: 'Ajay Kumar', durationHrs: 4.0, description: 'Drafted Q3 Power BI syllabus outline', status: 'Approved' },
      ],
    },
    {
      id: 't4',
      name: 'Server Log Maintenance & Backup Audit',
      category: 'Office Task',
      projectName: 'IT Infrastructure',
      supervisor: 'Manager (Operations)',
      assignee: 'Sankar M',
      dueDate: addDaysISO(3),
      status: 'Under Review',
      totalHoursWorked: 3.0,
      approvedBy: 'Manager Ops',
      dailyTimeEntries: [
        { id: 'e5', date: todayStr, loggedByRole: 'Assignee', loggedByName: 'Sankar M', durationHrs: 3.0, description: 'Executed automated snapshot backup scripts', status: 'Pending Review' },
      ],
    },
  ]);

  const windowEnd = useMemo(() => addDaysISO(3), []);

  const pendingApprovalTasks = useMemo(
    () => tasksList.filter((t) => t.status === 'Pending Approval'),
    [tasksList]
  );

  const sortedTasks = useMemo(() => {
    const filtered = tasksList.filter((t) => {
      if (t.status === 'Pending Approval') return false; // shown in top approval queue
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (dateWindowFilter === 'today') {
        if (t.dueDate !== todayStr) return false;
      } else if (dateWindowFilter === 'next_3_days') {
        if (t.dueDate < todayStr || t.dueDate > windowEnd) return false;
      }
      return true;
    });

    return filtered.sort((a, b) =>
      sortOrder === 'asc' ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate)
    );
  }, [tasksList, categoryFilter, dateWindowFilter, sortOrder, todayStr, windowEnd]);

  const handleCreateTask = (values: Record<string, unknown>) => {
    const isManager = isSupervisorRole;
    const initialStatus: TaskStatus = isManager ? 'To Do' : 'Pending Approval';

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      name: values.name as string,
      category: (values.category as any) || 'Office Task',
      projectName: (values.projectName as string) || 'Office Operations',
      supervisor: (values.supervisor as string) || 'Manager (Operations)',
      assignee: (values.assignee as string) || (user?.fullName || 'Linto George'),
      dueDate: (values.dueDate as string) || todayStr,
      status: initialStatus,
      totalHoursWorked: 0,
      approvedBy: isManager ? (user?.fullName || 'Manager') : undefined,
      approvedAt: isManager ? new Date().toLocaleString() : undefined,
      dailyTimeEntries: [],
    };

    setTasksList((prev) => [newTask, ...prev]);

    toast({
      variant: 'success',
      title: isManager ? 'Task Created' : 'Task Submitted for Approval',
      message: isManager
        ? `Task "${newTask.name}" created.`
        : `Task "${newTask.name}" sent to Manager/CEO approval queue.`,
    });

    setCreateTaskOpen(false);
  };

  const handleApproveTask = (id: string) => {
    setTasksList((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'To Do',
              approvedBy: user?.fullName || 'Manager',
              approvedAt: new Date().toLocaleString(),
            }
          : t
      )
    );
    toast({ variant: 'success', title: 'Task Approved', message: 'Task is now active in assignee "To Do" queue.' });
  };

  const handleRejectTask = (id: string) => {
    setTasksList((prev) => prev.filter((t) => t.id !== id));
    toast({ variant: 'warning', title: 'Task Rejected', message: 'Task creation request rejected.' });
  };

  const handleAcceptTask = (id: string) => {
    setTasksList((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'In Progress',
              acceptedAt: new Date().toLocaleString(),
            }
          : t
      )
    );
    toast({ variant: 'success', title: 'Task Accepted', message: 'Task moved to "In Progress".' });
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

  const dueTodayCount = tasksList.filter((t) => t.dueDate === todayStr && t.status !== 'Pending Approval').length;
  const totalHoursSum = tasksList.reduce((acc, t) => acc + t.totalHoursWorked, 0);

  const getWorkflowStep = (status: TaskStatus) => {
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
      <Card style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="kvj-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 150 }}
            >
              <option value="all">All Categories</option>
              <option value="Office Task">Office Task</option>
              <option value="Project Task">Project Task</option>
            </select>

            <select
              className="kvj-select"
              value={dateWindowFilter}
              onChange={(e) => setDateWindowFilter(e.target.value as any)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 170 }}
            >
              <option value="next_3_days">Next 3 Days Window</option>
              <option value="today">Due Today</option>
              <option value="all">All Tasks</option>
            </select>

            <select
              className="kvj-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 150 }}
            >
              <option value="asc">DueDate: Ascending</option>
              <option value="desc">DueDate: Descending</option>
            </select>
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
                    current={getWorkflowStep(t.status)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</h3>
                      <Badge tone={t.category === 'Project Task' ? 'info' : 'neutral'}>{t.category}</Badge>
                      {t.dueDate === todayStr && <Badge tone="danger">Due Today</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Project: <strong>{t.projectName}</strong> · Assignee: <strong>{t.assignee}</strong> · Supervisor: <strong>{t.supervisor}</strong>
                    </div>
                    {t.approvedBy && (
                      <div style={{ fontSize: 11, color: 'var(--status-success)', marginTop: 3 }}>
                        ✓ Approved by {t.approvedBy} {t.approvedAt && `(${t.approvedAt})`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Action: Accept Task */}
                    {t.status === 'To Do' && isAssignee && (
                      <Button size="sm" variant="success" onClick={() => handleAcceptTask(t.id)}>
                        ✋ Accept Task
                      </Button>
                    )}

                    {/* Action: Log Hours */}
                    {t.status === 'In Progress' && (
                      <Button size="sm" onClick={() => { setSelectedTask(t); setTimeEntryOpen(true); }}>
                        ⏱ Log Time
                      </Button>
                    )}

                    {/* Action: Mark Complete */}
                    {t.status === 'In Progress' && isSupervisorRole && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setTasksList((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'Completed' } : x));
                          toast({ variant: 'success', title: 'Task Completed', message: `Task "${t.name}" marked complete.` });
                        }}
                      >
                        ✓ Mark Complete
                      </Button>
                    )}
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
          <TextField name="assignee" label="Assignee Name" placeholder="e.g. Linto George" />
          <TextField name="supervisor" label="Supervisor Name" placeholder="e.g. Manager (Operations)" />
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
    </div>
  );
}

export default TaskBoard;
