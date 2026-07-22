import { useState } from 'react';
import { todayISO } from '../../../shared/utils/date';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useProject } from '../hooks/useProject';
import Drawer from '../../../shared/ui/Drawer';
import { Form, SelectField, TextField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../../../shared/permissions/react';
import type { TimesheetRecord } from '../project.repository';

export function TimesheetTracker() {
  const { timesheets, projects, logTimesheet, approveTimesheet, loading } = useProject();
  const { toast } = useNotifications();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  const handleLogSubmit = async (values: Record<string, unknown>) => {
    if (!user) return;
    const res = await logTimesheet({
      projectId: values.projectId as string,
      employeeId: user.id,
      hoursLogged: Number(values.hoursLogged),
      billable: values.billable === 'true',
      workDate: values.workDate as string,
      notes: values.notes as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Hours Logged', message: `Submitted ${values.hoursLogged} hours for approval.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleApprove = async (id: string) => {
    const res = await approveTimesheet(id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Timesheet Approved', message: 'Work session status updated to approved.' });
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const projectName = (projectId: string) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p ? p.title : 'Unknown';
  };

  const columns: Column<TimesheetRecord>[] = [
    { key: 'project', header: 'Project Title', render: (t) => projectName(t.projectId) },
    { key: 'date', header: 'Work Date', accessor: (t) => t.workDate },
    { key: 'hours', header: 'Hours Logged', accessor: (t) => `${t.hoursLogged} hrs` },
    { key: 'billable', header: 'Billable', render: (t) => t.billable ? 'Yes' : 'No' },
    { key: 'status', header: 'Approval Status', render: (t) => (
      <span className={`kvj-badge kvj-badge--${t.status === 'approved' ? 'success' : 'neutral'}`}>{t.status}</span>
    )},
    { key: 'action', header: 'Actions', render: (t) => (
      t.status === 'submitted' && can('project', 'approve') ? (
        <Button size="sm" onClick={() => handleApprove(t.id)}>Approve</Button>
      ) : null
    )},

  ];

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));

  return (
    <AppShell>
      <PageHeader
        title="Resource Timesheets"
        subtitle="Submit timesheet logs, track billable/non-billable hours, work sessions, and review allocations"
        actions={<Button onClick={() => setOpen(true)}>Log Work Hours</Button>}
      />


      <DataTable columns={columns} rows={timesheets} rowKey={(t) => t.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Log Work Session Hours">
        <Form initial={{ billable: 'true', workDate: todayISO() }} onSubmit={handleLogSubmit}>
          <SelectField name="projectId" label="Select Project" options={projectOptions} />
          <DatePickerField name="workDate" label="Work Date" />
          <TextField name="hoursLogged" label="Hours Spent" placeholder="e.g. 8" />
          <SelectField
            name="billable"
            label="Billable Status"
            options={[
              { value: 'true', label: 'Billable Hours' },
              { value: 'false', label: 'Non-billable Hours' },
            ]}
          />
          <TextAreaField name="notes" label="Work Description Notes" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Timesheet</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default TimesheetTracker;
