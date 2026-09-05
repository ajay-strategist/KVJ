import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Avatar, SearchInput, Button, Badge, SectionHeader } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useEmployee } from '../hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';
import Drawer from '../../../shared/ui/Drawer';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Employee } from '../employee.repository';
import { useProject } from '../../project/hooks/useProject';
import { supabase } from '../../../shared/integration/supabase';
import { Authorize } from '../../../shared/permissions/react';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { formatDisplayDate, todayISO } from '../../../shared/utils/date';

export function EmployeeDirectory({ defaultTabId = 'directory' }: { defaultTabId?: string }) {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { employees, createEmployee, updateProfile, deleteEmployee, loading } = useEmployee();
  const { createUser, resetToDefaultPassword, updateUser, deleteUser, getUsers, user } = useAuth();
  const { tasks } = useProject();
  const { toast } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  // Blocks duplicate create/edit records from a rapid double-click (raw forms,
  // so the shared Form guard does not apply here).
  const savingRef = useRef(false);

  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    getUsers().then((res) => {
      if (Array.isArray(res)) {
        setUsersList(res);
      }
    });
  }, [getUsers]);

  const getEmployeeUser = (email: string) => {
    return usersList.find((u) => u.email?.toLowerCase() === email?.toLowerCase());
  };

  const getEmployeeRole = (email: string): string => {
    return getEmployeeUser(email)?.role || 'EMPLOYEE';
  };

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [activeWorkSessions, setActiveWorkSessions] = useState<any[]>([]);
  const [leaveToday, setLeaveToday] = useState<any[]>([]);

  useEffect(() => {
    async function loadStatusInfo() {
      try {
        const todayStr = todayISO();
        const { data: attData } = await supabase
          .from('flwdsk_attendance')
          .select('*')
          .eq('work_date', todayStr)
          .is('deleted_at', null);

        let finalAttData = attData || [];
        if (!finalAttData.length) {
          const { data: altAttData } = await supabase
            .from('flwdsk_attendance_records')
            .select('*')
            .eq('work_date', todayStr)
            .is('deleted_at', null);
          if (altAttData) finalAttData = altAttData;
        }

        if (finalAttData) {
          setAttendanceRecords(finalAttData);
        }

        const { data: taskData } = await supabase
          .from('flwdsk_tasks')
          .select('*')
          .in('status', ['in_progress', 'In Progress'])
          .is('deleted_at', null);
        if (taskData) {
          setActiveTasks(taskData);
        }

        // Fetch active running task work sessions from DB so live status reflects across all machines
        const { data: sessData } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('status', 'running')
          .is('end_time', null)
          .is('deleted_at', null);
        if (sessData) {
          setActiveWorkSessions(sessData);
        }

        // Approved leaves that cover today (start <= today <= end).
        const { data: leaveData } = await supabase
          .from('flwdsk_leave_records')
          .select('employee_id, start_date, end_date, status')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .is('deleted_at', null);
        if (leaveData) {
          setLeaveToday(leaveData.filter((l: any) => String(l.status || '').toLowerCase() === 'approved'));
        }
      } catch (e) {
        console.warn('Could not load status info:', e);
      }
    }
    loadStatusInfo();
    const interval = setInterval(loadStatusInfo, 5000);
    return () => clearInterval(interval);
  }, [employees]);

  const getEmployeeActiveTask = (emp: Employee) => {
    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();
    const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();
    const isCurrentUser = Boolean(user && (user.id === empId || user.email?.toLowerCase() === empEmail));

    // 1. Check real-time database work sessions (status = 'running' & end_time is null)
    const dbSession = activeWorkSessions.find((s: any) => {
      const isForThisEmp =
        s.employee_id === empId ||
        (s.employee_id && empEmail && s.employee_id.toLowerCase() === empEmail) ||
        (s.employee_name && empFullName && s.employee_name.toLowerCase() === empFullName) ||
        (isCurrentUser && user && (s.employee_id === user.id || s.employee_id?.toLowerCase() === user.email?.toLowerCase()));
      return isForThisEmp;
    });

    if (dbSession) {
      return `📝 ${dbSession.work_title || dbSession.workTitle}`;
    }

    // 2. Read actively RUNNING timers from taskTimerStore (kvj_task_timers)
    const runningTaskIds = new Set<string>();
    try {
      const rawTimers = localStorage.getItem('kvj_task_timers');
      if (rawTimers) {
        const parsed: Record<string, { isRunning: boolean }> = JSON.parse(rawTimers);
        for (const [tId, s] of Object.entries(parsed)) {
          if (s?.isRunning === true) runningTaskIds.add(tId);
        }
      }
      const rawMyDay = localStorage.getItem('kvj_task_timer_state_v1');
      if (rawMyDay) {
        const parsed: Record<string, { active: boolean }> = JSON.parse(rawMyDay);
        for (const [tId, s] of Object.entries(parsed)) {
          if (s?.active === true) runningTaskIds.add(tId);
        }
      }
    } catch {}

    const runningTask = (tasks || []).find((t: any) => {
      if (!runningTaskIds.has(t.id)) return false;

      const isForThisEmp =
        t.assigneeId === empId ||
        (t.assigneeId && empEmail && t.assigneeId.toLowerCase() === empEmail) ||
        (t.assignee && empFullName && t.assignee.toLowerCase() === empFullName) ||
        (isCurrentUser && (t.assigneeId === user?.id || (t.assignee && t.assignee.toLowerCase() === user?.fullName?.toLowerCase())));

      return isForThisEmp;
    });

    if (runningTask) {
      return `📝 ${runningTask.title || (runningTask as any).name}`;
    }

    // If no timer is actively running, display 'No active task in progress'
    return 'No active task in progress';
  };

  const getEmployeeStatus = (emp: Employee) => {
    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();

    // Highest priority: an approved leave covering today. Only rows whose date
    // range still includes today are loaded, so a finished leave never matches.
    if (leaveToday.some((l) => l.employee_id === empId)) {
      return { label: '🌴 On Leave', tone: 'warning' as const };
    }

    // Check local clock-in state if this employee is the logged-in user
    if (user && user.email?.toLowerCase() === empEmail) {
      try {
        const rawClock = localStorage.getItem('kvj_clock_in_state');
        if (rawClock) {
          const parsed = JSON.parse(rawClock);
          if (parsed.isClockedIn) {
            return { label: '🟢 Clocked In', tone: 'success' as const };
          }
        }
      } catch {}
    }

    // Check DB attendance records
    const record = attendanceRecords.find(
      (r) =>
        r.employee_id === empId ||
        (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail) ||
        (user && user.email?.toLowerCase() === empEmail && r.employee_id === user.id)
    );

    if (record) {
      const status = record.status;
      if (status === 'present') return { label: '🟢 Clocked In', tone: 'success' as const };
      if (status === 'on_break') return { label: '☕ On Break', tone: 'warning' as const };
      if (status === 'clocked_out') return { label: '🔴 Clocked Out', tone: 'danger' as const };
    }

    // If an active task is running for this employee, mark as active!
    const activeTaskStr = getEmployeeActiveTask(emp);
    if (activeTaskStr !== 'No active task in progress') {
      return { label: '🟢 Clocked In (Active Work)', tone: 'success' as const };
    }

    return { label: 'Offline', tone: 'neutral' as const };
  };

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    designation: 'Senior Technical Trainer',
    dateOfJoining: new Date().toISOString().split('T')[0],
    role: 'EMPLOYEE',
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast({ variant: 'error', title: 'Required Fields', message: 'First name, last name, and email are required.' });
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    try {
    const res = await createEmployee({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      employeeId: form.employeeId.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      designation: form.designation.trim() || 'Employee',
      dateOfJoining: form.dateOfJoining || new Date().toISOString().split('T')[0],
      status: 'active',
    });

    if (res.ok) {
      try {
        await createUser({
          username: form.email.trim(),
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: form.email.trim(),
          role: form.role as any,
        });
      } catch (err) {
        console.warn('Auth user creation note:', err);
      }

      getUsers().then((res) => {
        if (Array.isArray(res)) setUsersList(res);
      });

      toast({
        variant: 'success',
        title: 'Employee Created',
        message: `${form.firstName} ${form.lastName} added. Default password is "password" (reset required on 1st login).`,
      });
      setAddModalOpen(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        designation: 'Senior Technical Trainer',
        dateOfJoining: new Date().toISOString().split('T')[0],
        role: 'EMPLOYEE',
      });
    } else {
      toast({ variant: 'error', title: 'Employee Creation Failed', message: res.error || 'Could not save employee. Check email format and network connection.' });
    }
    } finally {
      savingRef.current = false;
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (savingRef.current) return;
    savingRef.current = true;
    try {
    const res = await updateProfile(editingEmployee.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      employeeId: editForm.employeeId,
      designation: editForm.designation,
      dateOfJoining: editForm.dateOfJoining,
      phone: editForm.phone,
      status: editForm.status as any,
    });

    if (res.ok) {
      try {
        const u = getEmployeeUser(editingEmployee.email);
        if (u && editForm.role && u.role !== editForm.role) {
          await updateUser(u.id, { role: editForm.role as any });
        }
      } catch (err) {
        console.warn('Auth user role update note:', err);
      }

      getUsers().then((res) => {
        if (Array.isArray(res)) setUsersList(res);
      });

      toast({
        variant: 'success',
        title: 'Employee Updated',
        message: `Updated details for ${editForm.firstName} ${editForm.lastName}.`,
      });
      setEditModalOpen(false);
      setEditingEmployee(null);
    } else {
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: res.error || 'Could not update employee details.',
      });
    }
    } finally {
      savingRef.current = false;
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const names = employees
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => `${e.firstName} ${e.lastName}`)
      .join(', ');
    
    const ok = await confirm({
      title: 'Delete Employees?',
      message: `Are you sure you want to permanently delete ${selectedIds.length} employee(s)?\n\n${names}\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'delete',
    });
    if (!ok) return;

    setBatchDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const emp = employees.find((e) => e.id === id);
      const res = await deleteEmployee(id);
      if (res.ok) {
        successCount++;
        if (emp) {
          try {
            const u = getEmployeeUser(emp.email);
            if (u) await deleteUser(u.id);
          } catch (err) {
            console.warn('Auth user deletion note (batch):', err);
          }
        }
      } else {
        failCount++;
      }
    }

    setBatchDeleting(false);
    setSelectedIds([]);

    if (successCount > 0) {
      toast({
        variant: 'success',
        title: 'Batch Delete Complete',
        message: `${successCount} employee(s) deleted successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      });
    } else {
      toast({ variant: 'error', title: 'Batch Delete Failed', message: 'Could not delete any of the selected employees.' });
    }
  };

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.employeeId} ${e.designation}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      render: (r) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={`${r.firstName} ${r.lastName}`} src={r.avatarUrl} size={28} />
          <span style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</span>
        </span>
      ),
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      sortable: true,
      accessor: (r) => r.employeeId,
    },
    {
      key: 'designation',
      header: 'Designation',
      sortable: true,
      accessor: (r) => r.designation,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      accessor: (r) => getEmployeeRole(r.email),
      render: (r) => {
        const role = getEmployeeRole(r.email);
        const tone = role === 'ADMIN' ? 'danger' : role === 'CEO' ? 'success' : role === 'MANAGER' ? 'warning' : 'neutral';
        return (
          <span className={`kvj-badge kvj-badge--${tone}`}>
            {role}
          </span>
        );
      },
    },
    {
      key: 'dateOfJoining',
      header: 'Joining Date',
      sortable: true,
      accessor: (r) => r.dateOfJoining,
      render: (r) => formatDisplayDate(r.dateOfJoining),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`kvj-badge kvj-badge--${r.status === 'active' ? 'success' : 'neutral'}`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setEditingEmployee(r);
              setEditForm({
                firstName: r.firstName,
                lastName: r.lastName,
                email: r.email,
                employeeId: r.employeeId,
                designation: r.designation,
                dateOfJoining: r.dateOfJoining,
                phone: r.phone || '',
                status: r.status,
                role: getEmployeeRole(r.email),
              });
              setEditModalOpen(true);
            }}
          >
            ✏️ Edit
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await resetToDefaultPassword(r.email, `${r.firstName} ${r.lastName}`);
                toast({
                  variant: 'success',
                  title: 'Password Reset',
                  message: `Password for ${r.firstName} reset to default ("password"). Employee will be prompted to set new password on next login.`,
                });
              } catch (err) {
                toast({ variant: 'error', title: 'Reset Failed', message: 'Could not reset password for this employee.' });
              }
            }}
          >
            🔑 Reset Password
          </Button>
          <Button
            size="xs"
            variant="danger"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: 'Delete Employee?',
                message: `Are you sure you want to delete ${r.firstName} ${r.lastName}?`,
                confirmLabel: 'Delete',
                variant: 'delete',
              });
              if (ok) {
                const res = await deleteEmployee(r.id);
                if (res.ok) {
                  try {
                    const u = getEmployeeUser(r.email);
                    if (u) {
                      await deleteUser(u.id);
                    }
                  } catch (err) {
                    console.warn('Auth user deletion note:', err);
                  }
                  toast({ variant: 'success', title: 'Employee Deleted', message: `${r.firstName} ${r.lastName} has been deleted.` });
                } else {
                  toast({ variant: 'error', title: 'Delete Failed', message: res.error || 'Could not delete employee.' });
                }
              }
            }}
          >
            🗑️ Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Employee Directory"
        subtitle="Manage and view all employee files and profiles"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Batch Delete — visible only to Admin / CEO / Manager, and only when rows are selected */}
            <Authorize roles={['ADMIN', 'CEO', 'MANAGER']}>
              {selectedIds.length > 0 && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleBatchDelete}
                  disabled={batchDeleting}
                >
                  {batchDeleting
                    ? `⏳ Deleting ${selectedIds.length}…`
                    : `🗑️ Delete Selected (${selectedIds.length})`}
                </Button>
              )}
            </Authorize>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              ➕ Add New Employee
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/app')}>
              Back to Day
            </Button>
          </div>
        }
      />

      {defaultTabId === 'directory' ? (
        <div>
          <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search directory..." />
            </div>
            {searchTerm && (
              <Button size="sm" variant="secondary" onClick={() => setSearchTerm('')}>
                Clear Filters
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
            selectable
            onSelectionChange={setSelectedIds}
            onRowClick={(r) => navigate(`/app/employees/${r.id}`)}
          />
        </div>
      ) : (
        <div>
          <SectionHeader title="Today's Employee Status & Current Work" />
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Employee',
                render: (r: Employee) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={`${r.firstName} ${r.lastName}`} size={28} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{`${r.firstName} ${r.lastName}`}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.designation}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Current Status',
                render: (r: Employee) => {
                  const stat = getEmployeeStatus(r);
                  return (
                    <Badge tone={stat.tone}>
                      {stat.label}
                    </Badge>
                  );
                },
              },
              {
                key: 'activeTask',
                header: 'Current Task In Progress',
                render: (r: Employee) => (
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {getEmployeeActiveTask(r)}
                  </span>
                ),
              },
            ]}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
          />
        </div>
      )}

      {/* CREATE EMPLOYEE MODAL */}
      {addModalOpen && (
        <Drawer
          open={true}
          onClose={() => setAddModalOpen(false)}
          title="➕ Add New Employee"
        >
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  First Name *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Rahul"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Menon"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Email Address *
              </label>
              <input
                type="email"
                className="kvj-input"
                required
                placeholder="e.g. rahul.menon@kvjanalytics.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Employee ID
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. EMP-102"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Joining Date
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  required
                  value={form.dateOfJoining}
                  onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Designation
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  placeholder="e.g. Senior Technical Trainer"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  className="kvj-input"
                  placeholder="e.g. +91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                System Role *
              </label>
              <select
                className="kvj-select"
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-input, var(--bg-surface))', color: 'var(--text-primary)', fontSize: 14 }}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="CEO">CEO</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Button type="button" variant="secondary" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                ➕ Save Employee
              </Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {editModalOpen && editingEmployee && (
        <Drawer
          open={true}
          onClose={() => { setEditModalOpen(false); setEditingEmployee(null); }}
          title={`✏️ Edit Employee: ${editingEmployee.firstName} ${editingEmployee.lastName}`}
        >
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  First Name *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.firstName || ''}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.lastName || ''}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Email Address *
              </label>
              <input
                type="email"
                className="kvj-input"
                required
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Employee ID
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.employeeId || ''}
                  onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Joining Date
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  required
                  value={editForm.dateOfJoining || ''}
                  onChange={(e) => setEditForm({ ...editForm, dateOfJoining: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Designation
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  required
                  value={editForm.designation || ''}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="kvj-input"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                System Role *
              </label>
              <select
                className="kvj-select"
                required
                value={editForm.role || 'EMPLOYEE'}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-input, var(--bg-surface))', color: 'var(--text-primary)', fontSize: 14 }}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="CEO">CEO</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Button type="button" variant="secondary" onClick={() => { setEditModalOpen(false); setEditingEmployee(null); }}>
                Cancel
              </Button>
              <Button type="submit">
                💾 Save Changes
              </Button>
            </div>
          </form>
        </Drawer>
      )}
    </AppShell>
  );
}
export default EmployeeDirectory;
