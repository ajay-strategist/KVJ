import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useCommunication } from '../hooks/useCommunication';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { EmailLog } from '../communication.repository';

export function EmailCenter() {
  const { emailLogs, queueEmail, processEmailQueue, loading } = useCommunication();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleQueueSubmit = async (values: Record<string, unknown>) => {
    const res = await queueEmail({
      recipient: values.recipient as string,
      subject: values.subject as string,
      body: values.body as string,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Email Queued', message: `Delivery scheduled to: ${values.recipient}` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleProcessQueue = async () => {
    const res = await processEmailQueue();
    if (res.ok) {
      toast({ variant: 'success', title: 'Queue Processed', message: `Dispatched ${res.value.length} pending emails.` });
    } else {
      toast({ variant: 'error', title: 'Queue Process Failed', message: res.error });
    }
  };

  const columns: Column<EmailLog>[] = [
    { key: 'recipient', header: 'Recipient Email', sortable: true, accessor: (e) => e.recipient },
    { key: 'subject', header: 'Subject Line', accessor: (e) => e.subject },
    { key: 'status', header: 'Delivery Status', render: (e) => (
      <span className={`kvj-badge kvj-badge--${e.status === 'sent' ? 'success' : 'neutral'}`}>{e.status}</span>
    )},
    { key: 'retry', header: 'Retries', accessor: (e) => String(e.retryCount ?? 0) },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Outbound Email & Queue Center"
        subtitle="Manage transactional communications queues, monitor email delivery status, and configure templates"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={handleProcessQueue}>Process Pending Queue</Button>
            <Button onClick={() => setOpen(true)}>Queue Email</Button>
          </div>
        }
      />

      <DataTable columns={columns} rows={emailLogs} rowKey={(e) => e.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Queue Outbound Email Delivery">
        <Form initial={{}} onSubmit={handleQueueSubmit}>
          <TextField name="recipient" label="Recipient Email Address" placeholder="e.g. employee@company.com" type="email" />
          <TextField name="subject" label="Subject Line" placeholder="e.g. Timesheet Reminder Notice" />
          <TextAreaField name="body" label="Email Body (HTML/Text)" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Queue Outbound</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default EmailCenter;
