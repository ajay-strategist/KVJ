import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, StatCard, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useLeave } from '../hooks/useLeave';
import { Form, SelectField, DatePickerField, TextAreaField, CheckboxField, FileUploadField } from '../../../shared/forms/form';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { businessRules } from '../../../config/business-rules';
import Drawer from '../../../shared/ui/Drawer';
import type { LeaveRecord } from '../leave.repository';

export function LeaveBoard() {
  const { leaves, applyLeave, loading } = useLeave();
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const [applyOpen, setApplyOpen] = useState(false);

  const handleApplySubmit = async (values: Record<string, unknown>) => {
    const ok = await confirm({
      title: 'Submit Leave Application?',
      message: 'Are you sure you want to submit this leave request?',
    });
    if (!ok) return;

    const res = await applyLeave(
      values.leaveType as string,
      values.startDate as string,
      values.endDate as string,
      values.reason as string,
      !!values.halfDay,
      values.medCert ? (values.medCert as any).name : undefined
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Leave Applied', message: 'Your application has been submitted.' });
      setApplyOpen(false);
    } else {
      toast({ variant: 'error', title: 'Application Failed', message: res.error });
    }
  };

  const columns: Column<LeaveRecord>[] = [
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      accessor: (r) => r.leaveType,
    },
    {
      key: 'dates',
      header: 'Duration',
      render: (r) => `${r.startDate} to ${r.endDate}${r.halfDay ? ' (Half Day)' : ''}`,
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => r.reason,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`kvj-badge kvj-badge--${
            r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'approver',
      header: 'Details',
      render: (r) => r.approverNotes ? `Notes: ${r.approverNotes}` : 'No notes.',
    },
  ];

  const leaveTypes = Object.keys(businessRules.leave.entitlements).map((k) => ({
    value: k,
    label: `${k} (Entitlement: ${businessRules.leave.entitlements[k]} days)`,
  }));

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;

  return (
    <AppShell>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, check balances, and view records"
        actions={<Button onClick={() => setApplyOpen(true)}>Request Leave</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Pending Applications" value={pendingCount} tone="warning" icon="⚑" />
        <StatCard label="Approved Leaves" value={approvedCount} tone="success" icon="✓" />
        <StatCard label="Casual Leave Balance" value={businessRules.leave.entitlements.Casual} icon="🗓" />
      </div>

      <SectionHeader title="My Leave History" />
      <DataTable columns={columns} rows={leaves} rowKey={(r) => r.id} loading={loading} />

      {/* Apply Leave Drawer */}
      <Drawer open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave">
        <Form initial={{ leaveType: 'Casual', startDate: '', endDate: '', reason: '', halfDay: false }} onSubmit={handleApplySubmit}>
          <SelectField name="leaveType" label="Leave Type" options={leaveTypes} />
          <DatePickerField name="startDate" label="Start Date" />
          <DatePickerField name="endDate" label="End Date" />
          <CheckboxField name="halfDay" label="Apply for Half Day" />
          <FileUploadField name="medCert" label="Medical Certificate (Required for Sick Leave >= 2 days)" accept=".pdf,.png,.jpg" />
          <TextAreaField name="reason" label="Reason for Leave" />
          
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default LeaveBoard;
