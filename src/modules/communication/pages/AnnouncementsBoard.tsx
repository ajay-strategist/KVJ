import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Button, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useCommunication } from '../hooks/useCommunication';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Announcement } from '../communication.repository';

export interface DeclaredHoliday {
  id: string;
  date: string;
  name: string;
  type: string;
  status: 'active' | 'cancelled';
}

export function AnnouncementsBoard() {
  const { announcements, postAnnouncement, loading } = useCommunication();
  const { toast, addNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);

  const [holidays, setHolidays] = useState<DeclaredHoliday[]>([
    { id: 'h1', date: '2026-08-15', name: 'Independence Day', type: 'Public Holiday', status: 'active' },
    { id: 'h2', date: '2026-09-05', name: 'Onam / Teacher Day Celebration', type: 'Company Holiday', status: 'active' },
  ]);

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

  const handleDeclareHoliday = (values: Record<string, unknown>) => {
    const date = values.date as string;
    const name = values.name as string;
    const type = (values.type as string) || 'Company Holiday';

    const newH: DeclaredHoliday = {
      id: String(Date.now()),
      date,
      name,
      type,
      status: 'active',
    };

    setHolidays((prev) => [newH, ...prev]);
    toast({ variant: 'success', title: 'Holiday Declared', message: `Holiday '${name}' on ${date} has been declared.` });

    // Broadcast announcement & notification
    postAnnouncement({
      title: `🎉 Company Holiday Notice: ${name}`,
      content: `Please note that ${date} has been officially declared as a holiday (${name}). Attendance registers have been updated accordingly.`,
      targetType: 'organization',
      priority: 'high',
    });

    addNotification({
      title: `Holiday Declared: ${name}`,
      message: `${date} is marked as a holiday. Enjoy your time off!`,
      category: 'system',
      priority: 'high',
    });

    setHolidayOpen(false);
  };

  const handleToggleHolidayStatus = (id: string, currentStatus: 'active' | 'cancelled', name: string) => {
    const nextStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    setHolidays((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: nextStatus } : h))
    );
    toast({
      variant: nextStatus === 'cancelled' ? 'warning' : 'success',
      title: `Holiday ${nextStatus === 'cancelled' ? 'Cancelled' : 'Reactivated'}`,
      message: `Holiday '${name}' is now ${nextStatus}.`,
    });
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
        title="Corporate Announcements & Holiday Board"
        subtitle="Publish announcements, manage company holidays, and broadcast company bulletins"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => setHolidayOpen(true)}>
              🎉 Declare Holiday
            </Button>
            <Button onClick={() => setOpen(true)}>Post Announcement</Button>
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Declared Holidays Section */}
        <Card>
          <SectionHeader title="Company & Declared Public Holidays (Affects Attendance Log)" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: 8 }}>Date</th>
                  <th style={{ padding: 8 }}>Holiday Name</th>
                  <th style={{ padding: 8 }}>Type</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{h.date}</td>
                    <td style={{ padding: 8 }}>{h.name}</td>
                    <td style={{ padding: 8 }}>{h.type}</td>
                    <td style={{ padding: 8 }}>
                      <Badge tone={h.status === 'active' ? 'danger' : 'neutral'}>
                        {h.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <Button
                        variant="secondary"
                        onClick={() => handleToggleHolidayStatus(h.id, h.status, h.name)}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        {h.status === 'active' ? '❌ Cancel Holiday' : '✓ Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Announcements Table */}
        <DataTable columns={columns} rows={announcements} rowKey={(a) => a.id} loading={loading} />
      </div>

      {/* Post Notice Drawer */}
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

      {/* Declare Holiday Drawer */}
      <Drawer open={holidayOpen} onClose={() => setHolidayOpen(false)} title="Declare Company / Public Holiday">
        <Form initial={{ date: '', name: '', type: 'Company Holiday' }} onSubmit={handleDeclareHoliday}>
          <TextField name="date" label="Holiday Date (YYYY-MM-DD)" placeholder="2026-08-15" />
          <TextField name="name" label="Holiday Name / Occasion" placeholder="Independence Day, Onam, Bakrid..." />
          <SelectField
            name="type"
            label="Holiday Type"
            options={[
              { value: 'Company Holiday', label: 'Company Holiday' },
              { value: 'Public Holiday', label: 'Public Holiday' },
              { value: 'Regional Festival', label: 'Regional Festival' },
            ]}
          />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setHolidayOpen(false)}>Cancel</Button>
            <Button type="submit">Declare & Broadcast Holiday</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default AnnouncementsBoard;
