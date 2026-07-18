/**
 * KVJ Analytics — Design System Showcase (Phase-1 §8)
 * The permanent internal reference for every reusable component. Mock-driven.
 */

import { useState } from 'react';
import { AppShell } from '../../shared/layout/AppShell';
import {
  Button, IconButton, Card, Panel, Badge, StatusChip, Avatar, PageHeader, SectionHeader,
  StatCard, EmptyState, Skeleton, SearchInput, QuickActionCard, Timeline, ActivityCard,
} from '../../shared/ui/components';
import { DataTable, type Column } from '../../shared/ui/DataTable';
import { Form, TextField, SelectField, SwitchField, validators } from '../../shared/forms/form';
import { useDialog } from '../../shared/feedback/DialogProvider';
import { useNotifications } from '../../shared/notifications/NotificationProvider';
import { mock, type MockEmployee } from '../../shared/mock/factories';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <SectionHeader title={title} />
      <Card><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div></Card>
    </section>
  );
}

export function ShowcasePage() {
  const { confirm, alertSuccess } = useDialog();
  const { toast } = useNotifications();
  const [q, setQ] = useState('');
  const [employees] = useState(() => mock.employees(6));
  const [activities] = useState(() => mock.activity(3));
  const cols: Column<MockEmployee>[] = [
    { key: 'name', header: 'Name', sortable: true, accessor: (r) => r.name, render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.name} size={26} />{r.name}</span> },
    { key: 'department', header: 'Department', accessor: (r) => r.department },
    { key: 'status', header: 'Status', render: (r) => <StatusChip tone={r.status === 'Present' ? 'success' : r.status === 'Absent' ? 'danger' : 'warning'} label={r.status} /> },
    { key: 'attendancePct', header: 'Attendance', numeric: true, sortable: true, accessor: (r) => r.attendancePct, render: (r) => `${r.attendancePct}%` },
  ];

  return (
    <AppShell>
      <PageHeader title="Design System Showcase" subtitle="The permanent reference for every reusable component" />

      <Block title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <IconButton label="star">★</IconButton>
      </Block>

      <Block title="Badges & status">
        <Badge tone="success">Approved</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="danger">Overdue</Badge>
        <Badge tone="info">In Review</Badge>
        <Badge tone="progress">In Progress</Badge>
        <StatusChip tone="success" label="Present" />
        <StatusChip tone="danger" label="Absent" />
      </Block>

      <Block title="Avatars">
        <Avatar name="Sara Pillai" /><Avatar name="Rahul Menon" size={40} /><Avatar name="Anita Rao" size={48} />
      </Block>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader title="Statistic cards" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16 }}>
          <StatCard label="Hours" value="168.5" delta={{ value: '4.2%', up: true }} icon="◷" />
          <StatCard label="Attendance" value="94%" tone="success" icon="✓" />
          <StatCard label="Open tasks" value="12" tone="warning" icon="◧" />
        </div>
      </section>

      <Block title="Feedback (dialogs & toasts)">
        <Button onClick={async () => { if (await confirm({ title: 'Delete item?', message: 'This cannot be undone.', variant: 'delete' })) toast({ variant: 'success', title: 'Deleted' }); }}>Confirm dialog</Button>
        <Button variant="secondary" onClick={() => alertSuccess('Saved', 'Your changes were saved.')}>Success dialog</Button>
        <Button variant="ghost" onClick={() => toast({ variant: 'info', title: 'Heads up', message: 'This is a toast notification.' })}>Fire toast</Button>
      </Block>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader title="Search & empty / loading states" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
          <Card><SearchInput value={q} onChange={setQ} /></Card>
          <Card><Skeleton height={16} style={{ marginBottom: 8 }} /><Skeleton width="70%" height={16} /></Card>
          <Panel><EmptyState title="No expenses yet" message="Submit your first claim." action={<Button size="sm">+ New</Button>} /></Panel>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader title="Quick actions" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 12 }}>
          <QuickActionCard icon="⏱" label="Clock In" /><QuickActionCard icon="✓" label="Add Task" /><QuickActionCard icon="₹" label="Expense" />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader title="Data table" />
        <DataTable columns={cols} rows={employees} rowKey={(r) => r.id} selectable pageSize={5} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 24, marginBottom: 32 }}>
        <div>
          <SectionHeader title="Form" />
          <Card><Form initial={{ mode: 'Online' }} onSubmit={() => toast({ variant: 'success', title: 'Form submitted' })}>
            <TextField name="name" label="Full name" rules={[validators.required()]} placeholder="Jane Doe" />
            <TextField name="email" label="Email" rules={[validators.required(), validators.email()]} placeholder="jane@kvj.test" />
            <SelectField name="mode" label="Mode" options={[{ value: 'Online', label: 'Online' }, { value: 'Offline', label: 'Offline' }]} />
            <SwitchField name="notify" label="Email me updates" />
            <Button type="submit" style={{ width: '100%', justifyContent: 'center' }}>Submit</Button>
          </Form></Card>
        </div>
        <div>
          <SectionHeader title="Timeline & activity" />
          <Card>
            <Timeline entries={[
              { id: '1', title: 'Project created', time: '2h ago', tone: 'success' },
              { id: '2', title: 'Task assigned', time: '1h ago', tone: 'progress' },
              { id: '3', title: 'Review pending', time: '20m ago', tone: 'warning' },
            ]} />
            <div style={{ marginTop: 12 }}>{activities.map((a) => <ActivityCard key={a.id} actor={a.actor} action={a.action} time={a.time} />)}</div>
          </Card>
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader title="Typography & color tokens" />
        <Card>
          <div style={{ fontSize: 26, fontWeight: 700 }}>Heading 1 · 26/700</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Heading 3 · 18/600</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Body · 14/400 secondary</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {['--brand', '--status-success', '--status-warning', '--status-danger', '--status-info'].map((t) => (
              <div key={t} style={{ width: 40, height: 40, borderRadius: 8, background: `var(${t})` }} title={t} />
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
