import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useFinance } from '../hooks/useFinance';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { SalaryStructure } from '../finance.repository';
import type { Employee } from '../../employee/employee.repository';

export function PayrollPrep() {
  const { salaryStructures, updateSalaryStructure, loading } = useFinance();
  const { toast } = useNotifications();

  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) setEmployees(res.value);
    });
  }, []);

  const handleUpdateSubmit = async (values: Record<string, unknown>) => {
    const res = await updateSalaryStructure({
      employeeId: values.employeeId as string,
      basicSalary: Number(values.basicSalary),
      allowances: Number(values.allowances) || 0.00,
      deductions: Number(values.deductions) || 0.00,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Salary Structured', message: `Details recorded successfully.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const employeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Staff Member';
  };

  const columns: Column<SalaryStructure>[] = [
    { key: 'employee', header: 'Employee', sortable: true, render: (s) => employeeName(s.employeeId) },
    { key: 'basic', header: 'Basic Salary', accessor: (s) => `$${s.basicSalary}` },
    { key: 'allowances', header: 'Allowances', accessor: (s) => `$${s.allowances ?? 0.00}` },
    { key: 'deductions', header: 'Deductions', accessor: (s) => `$${s.deductions ?? 0.00}` },
    { key: 'net', header: 'Estimated Net Pay', render: (s) => {
      const net = s.basicSalary + (s.allowances ?? 0.00) - (s.deductions ?? 0.00);
      return <span style={{ fontWeight: 600, color: 'var(--brand)' }}>${net}</span>;
    }},
  ];

  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <AppShell>
      <PageHeader
        title="Payroll Roster Preparation"
        subtitle="Manage employee base salaries structures, benefits allowances, tax deductions, and export preparation rosters"
        actions={<Button onClick={() => setOpen(true)}>Update Salary Structure</Button>}
      />

      <DataTable columns={columns} rows={salaryStructures} rowKey={(s) => s.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Update Employee Salary Structure">
        <Form initial={{ allowances: 0, deductions: 0 }} onSubmit={handleUpdateSubmit}>
          <SelectField name="employeeId" label="Select Employee" options={employeeOptions} />
          <TextField name="basicSalary" label="Basic Monthly Base Salary ($)" placeholder="e.g. 5000" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField name="allowances" label="Total Allowances ($)" />
            <TextField name="deductions" label="Total Deductions ($)" />
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Apply Salary Structure</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default PayrollPrep;
