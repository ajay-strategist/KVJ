import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useAnalytics } from '../hooks/useAnalytics';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { SavedReport } from '../analytics.repository';

export function ReportBuilder() {
  const { savedReports, saveReport, loading } = useAnalytics();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleSaveSubmit = async (values: Record<string, unknown>) => {
    const res = await saveReport({
      title: values.title as string,
      groupingBy: values.groupingBy as string || undefined,
      sortingBy: values.sortingBy as string || undefined,
      filters: {},
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Report Config Saved', message: `Template: ${values.title} added successfully.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<SavedReport>[] = [
    { key: 'title', header: 'Saved Report Title', sortable: true, accessor: (r) => r.title },
    { key: 'grouping', header: 'Grouping Dimension', accessor: (r) => r.groupingBy ?? 'None' },
    { key: 'sorting', header: 'Sorting Dimension', accessor: (r) => r.sortingBy ?? 'None' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Custom Report Designer Builder"
        subtitle="Formulate custom query filters, dimension groupings, and export data schemas to CSV or PDF templates"
        actions={<Button onClick={() => setOpen(true)}>Save Report Config</Button>}
      />

      <DataTable columns={columns} rows={savedReports} rowKey={(r) => r.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Save Custom Report Parameterization">
        <Form initial={{}} onSubmit={handleSaveSubmit}>
          <TextField name="title" label="Saved Report Configuration Title" placeholder="e.g. Monthly Staff Attendance Variance" />
          <SelectField
            name="groupingBy"
            label="Grouping Dimension"
            options={[
              { value: 'department', label: 'By Department' },
              { value: 'role', label: 'By Role Key' },
              { value: 'status', label: 'By Record Status' },
            ]}
          />
          <SelectField
            name="sortingBy"
            label="Sorting Direction"
            options={[
              { value: 'asc', label: 'Ascending chronological' },
              { value: 'desc', label: 'Descending chronological' },
            ]}
          />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Template</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ReportBuilder;
