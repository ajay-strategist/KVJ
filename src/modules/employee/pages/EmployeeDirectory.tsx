import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Avatar, SearchInput, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useEmployee } from '../hooks/useEmployee';
import type { Employee } from '../employee.repository';

export function EmployeeDirectory() {
  const navigate = useNavigate();
  const { employees, loading } = useEmployee();
  const [searchTerm, setSearchTerm] = useState('');

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
          <Button size="sm" onClick={() => navigate('/app')}>
            Back to Day
          </Button>
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
    </AppShell>
  );
}
export default EmployeeDirectory;
