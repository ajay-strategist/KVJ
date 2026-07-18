import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useCommunication } from '../hooks/useCommunication';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Announcement } from '../communication.repository';

export function AnnouncementsBoard() {
  const { announcements, postAnnouncement, loading } = useCommunication();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handlePostSubmit = async (values: Record<string, unknown>) => {
    const res = await postAnnouncement({
      title: values.title as string,
      content: values.content as string,
      targetType: values.targetType as any,
      priority: values.priority as any,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Announcement Published', message: `Targeted to: ${values.targetType}` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Announcement>[] = [
    { key: 'title', header: 'Headline', sortable: true, accessor: (a) => a.title },
    { key: 'content', header: 'Details Summary', accessor: (a) => a.content },
    { key: 'target', header: 'Audience Scope', accessor: (a) => a.targetType },
    { key: 'priority', header: 'Urgency Priority', render: (a) => (
      <span className={`kvj-badge kvj-badge--${a.priority === 'high' ? 'danger' : 'neutral'}`}>{a.priority}</span>
    )},
  ];

  return (
    <AppShell>
      <PageHeader
        title="Corporate Announcements Board"
        subtitle="Publish bulletins announcements, project changes, departmental notices, and target audience segments"
        actions={<Button onClick={() => setOpen(true)}>Post Announcement</Button>}
      />

      <DataTable columns={columns} rows={announcements} rowKey={(a) => a.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Publish Broad Announcement Notice">
        <Form initial={{ targetType: 'organization', priority: 'normal' }} onSubmit={handlePostSubmit}>
          <TextField name="title" label="Announcement Headline" placeholder="e.g. FY2026 Kickoff Meeting" />
          <TextAreaField name="content" label="Bulletin Content Notice" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField
              name="targetType"
              label="Audience Scope"
              options={[
                { value: 'organization', label: 'Entire Organization' },
                { value: 'department', label: 'Department Segment' },
                { value: 'project', label: 'Project Team' },
              ]}
            />
            <SelectField
              name="priority"
              label="Urgency Priority"
              options={[
                { value: 'normal', label: 'Normal Priority' },
                { value: 'high', label: 'Urgent Priority' },
              ]}
            />
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Post Notice</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default AnnouncementsBoard;
