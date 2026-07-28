import { useState, useEffect } from 'react';
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
import { supabase } from '../../../shared/integration/supabase';

export function EmployeeDirectory({ defaultTabId = 'directory' }: { defaultTabId?: string }) {
  const navigate = useNavigate();
  const { employees, createEmployee, updateProfile, loading } = useEmployee();
  const { createUser, resetToDefaultPassword } = useAuth();
  const { toast } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);

  useEffect(() => {
    async function loadStatusInfo() {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('work_date', todayStr)
          .is('deleted_at', null);
        if (attData) {
          setAttendanceRecords(attData);
        }

        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'in_progress')
          .is('deleted_at', null);
        if (taskData) {
          setActiveTasks(taskData);
        }
      } catch (e) {
        console.warn('Could not load status info:', e);
      }
    }
    loadStatusInfo();
  }, [employees]);

  const getEmployeeStatus = (empId: string) => {
    const record = attendanceRecords.find((r) => r.employee_id === empId);
    if (!record) return { label: 'Offline', tone: 'neutral' as const };
    const status = record.status;
    if (status === 'present') return { label: '🟢 Clocked In', tone: 'success' as const };
    if (status === 'on_break') return { label: '☕ On Break', tone: 'warning' as const };
    if (status === 'clocked_out') return { label: '🔴 Clocked Out', tone: 'danger' as const };
    return { label: 'Offline', tone: 'neutral' as const };
  };

  const getEmployeeActiveTask = (empId: string) => {
    const task = activeTasks.find((t) => t.assignee_id === empId || t.assignee === empId);
    return task ? `📝 ${task.title}` : 'No active task in progress';
  };

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    designation: 'Senior Technical Trainer',
    dateOfJoining: new Date().toISOString().split('T')[0],
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast({ variant: 'error', title: 'Required Fields', message: 'First name, last name, and email are required.' });
      return;
    }

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
          role: 'EMPLOYEE',
        });
      } catch (err) {
        console.warn('Auth user creation note:', err);
      }

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
      });
    } else {
      toast({ variant: 'error', title: 'Employee Creation Failed', message: res.error || 'Could not save employee. Check email format and network connection.' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

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
      key: 'dateOfJoining',
      header: 'Joining Date',
      sortable: true,
      accessor: (r) => r.dateOfJoining,
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
          <div style={{ marginBottom: 20, maxWidth: 360 }}>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search directory..." />
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Current Status',
                render: (r: Employee) => {
                  const stat = getEmployeeStatus(r.id);
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
                    {getEmployeeActiveTask(r.id)}
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
