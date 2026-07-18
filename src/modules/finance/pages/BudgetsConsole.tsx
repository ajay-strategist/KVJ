import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useFinance } from '../hooks/useFinance';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Budget } from '../finance.repository';

export function BudgetsConsole() {
  const { budgets, createBudget, loading } = useFinance();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createBudget({
      department: values.department as string,
      fiscalYear: values.fiscalYear as string,
      allocatedAmount: Number(values.allocatedAmount),
      spentAmount: 0.00,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Budget Limit Defined', message: `Registered budget limit for ${values.department}` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Budget>[] = [
    { key: 'dept', header: 'Department', sortable: true, accessor: (b) => b.department },
    { key: 'fy', header: 'Fiscal Year', sortable: true, accessor: (b) => b.fiscalYear },
    { key: 'allocated', header: 'Budget Allocated Limit', accessor: (b) => `$${b.allocatedAmount}` },
    { key: 'spent', header: 'Amount Spent', accessor: (b) => `$${b.spentAmount}` },
    { key: 'variance', header: 'Variance Remaining', render: (b) => {
      const remaining = b.allocatedAmount - b.spentAmount;
      const pct = (b.spentAmount / b.allocatedAmount) * 100;
      return (
        <span style={{ fontWeight: 600, color: pct > 90 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
          ${remaining} ({pct.toFixed(0)}% spent)
        </span>
      );
    }},
  ];

  return (
    <AppShell>
      <PageHeader
        title="Departmental Budgets"
        subtitle="Manage fiscal budget definitions, track variance remaining, and approve department spend allocations"
        actions={<Button onClick={() => setOpen(true)}>Create Budget Limit</Button>}
      />

      <DataTable columns={columns} rows={budgets} rowKey={(b) => b.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Define Departmental Budget Limit">
        <Form initial={{ fiscalYear: 'FY2026' }} onSubmit={handleCreateSubmit}>
          <SelectField
            name="department"
            label="Target Department"
            options={[
              { value: 'Engineering', label: 'Engineering' },
              { value: 'Marketing', label: 'Marketing' },
              { value: 'Operations', label: 'Operations' },
              { value: 'Finance', label: 'Finance' },
            ]}
          />
          <TextField name="fiscalYear" label="Fiscal Year" placeholder="e.g. FY2026" />
          <TextField name="allocatedAmount" label="Budget Limit Amount ($)" placeholder="e.g. 50000" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Define Limit</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default BudgetsConsole;
