import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useProject } from '../hooks/useProject';
import Drawer from '../../../shared/ui/Drawer';
import { Form, SelectField, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { ResourceAllocation } from '../project.repository';
import type { Employee } from '../../employee/employee.repository';

export function ResourceScheduler() {
  const { allocations, projects, allocateResource, loading } = useProject();
  const { toast } = useNotifications();

  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) setEmployees(res.value);
    });
  }, []);

  const handleAllocateSubmit = async (values: Record<string, unknown>) => {
    const res = await allocateResource(
      values.projectId as string,
      values.employeeId as string,
      values.role as string,
      Number(values.capacityPercentage)
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Resource Allocated', message: `Employee assigned as ${values.role}` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Allocation Failed', message: res.error });
    }
  };

  const projectName = (projectId: string) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p ? p.title : 'Unknown';
  };

  const employeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
  };

  const columns: Column<ResourceAllocation>[] = [
    { key: 'employee', header: 'Employee', render: (a) => employeeName(a.employeeId) },
    { key: 'project', header: 'Project', render: (a) => projectName(a.projectId) },
    { key: 'role', header: 'Assigned Role', accessor: (a) => a.role },
    { key: 'capacity', header: 'Allocation Capacity', accessor: (a) => `${a.capacityPercentage ?? 100}%` },
    { key: 'status', header: 'Status', render: (a) => (
      <span className="kvj-badge kvj-badge--success">{a.status}</span>
    )},
  ];

  const projectOptions = projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.title}` }));
  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.designation})` }));

  return (
    <AppShell>
      <PageHeader
        title="Resource Capacity Scheduler"
        subtitle="Manage resource allocations, PM/Developer roles assignments, workload balancing, and skill matching"
        actions={<Button onClick={() => setOpen(true)}>Allocate Resource</Button>}
      />

      <DataTable columns={columns} rows={allocations} rowKey={(a) => a.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Allocate Project Resource">
        <Form initial={{ capacityPercentage: 100 }} onSubmit={handleAllocateSubmit}>
          <SelectField name="projectId" label="Select Project" options={projectOptions} />
          <SelectField name="employeeId" label="Select Employee" options={employeeOptions} />
          <TextField name="role" label="Project Assignment Role" placeholder="e.g. Lead Consultant" />
          <TextField name="capacityPercentage" label="Capacity Utilization %" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Approve Allocation</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ResourceScheduler;
