import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Avatar, SearchInput, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useEmployee } from '../hooks/useEmployee';
import Drawer from '../../../shared/ui/Drawer';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Employee } from '../employee.repository';

export function EmployeeDirectory() {
  const navigate = useNavigate();
  const { employees, createEmployee, loading } = useEmployee();
  const { toast } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

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
      toast({ variant: 'success', title: 'Employee Created', message: `${form.firstName} ${form.lastName} has been added to the directory.` });
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
    </AppShell>
  );
}
export default EmployeeDirectory;
