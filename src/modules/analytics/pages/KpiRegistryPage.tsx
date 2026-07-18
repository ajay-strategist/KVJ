import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useAnalytics } from '../hooks/useAnalytics';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { KpiDefinition } from '../analytics.repository';

export function KpiRegistryPage() {
  const { kpis, registerKpi, loading } = useAnalytics();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleRegisterSubmit = async (values: Record<string, unknown>) => {
    const res = await registerKpi({
      code: values.code as string,
      name: values.name as string,
      category: values.category as string,
      formula: values.formula as string,
      currentValue: 0.00,
      targetValue: Number(values.targetValue),
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'KPI Registered', message: `Metric ${values.code} saved under ${values.category}` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<KpiDefinition>[] = [
    { key: 'code', header: 'KPI Code', sortable: true, accessor: (k) => k.code },
    { key: 'name', header: 'Metric Title', sortable: true, accessor: (k) => k.name },
    { key: 'category', header: 'Department Domain', accessor: (k) => k.category },
    { key: 'formula', header: 'Calculation Formula', accessor: (k) => k.formula },
    { key: 'current', header: 'Current Actual', accessor: (k) => String(k.currentValue) },
    { key: 'target', header: 'Target Goal', accessor: (k) => String(k.targetValue) },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Central KPI Registry Console"
        subtitle="Manage calculations formulas, trigger thresholds, and historical metrics aggregations"
        actions={<Button onClick={() => setOpen(true)}>Register KPI Metric</Button>}
      />

      <DataTable columns={columns} rows={kpis} rowKey={(k) => k.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Register KPI Definition metric">
        <Form initial={{ category: 'Finance' }} onSubmit={handleRegisterSubmit}>
          <TextField name="code" label="KPI Code identifier" placeholder="e.g. UTIL_RATE" />
          <TextField name="name" label="Metric Description Name" placeholder="e.g. Employee Utilization Rate" />
          <SelectField
            name="category"
            label="Domain Category"
            options={[
              { value: 'Finance', label: 'Finance Operations' },
              { value: 'Projects', label: 'Projects Delivery' },
              { value: 'HR', label: 'People & HR' },
            ]}
          />
          <TextField name="formula" label="Metric Calculation Formula" placeholder="e.g. BillableHours / AvailableHours" />
          <TextField name="targetValue" label="Target Benchmark Goal" placeholder="e.g. 80" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Register Metric</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default KpiRegistryPage;
