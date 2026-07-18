import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { useCommunication } from '../hooks/useCommunication';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';

export function ChatChannels() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const { channels, messages, createChannel, sendMessage, refreshMessages } = useCommunication(activeChannelId ?? undefined);
  const { toast } = useNotifications();

  const [channelOpen, setChannelOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) setEmployees(res.value);
    });
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      const interval = setInterval(() => {
        refreshMessages();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeChannelId, refreshMessages]);

  const handleChannelCreate = async (values: Record<string, unknown>) => {
    const res = await createChannel({
      name: values.name as string,
      type: values.type as any,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Channel Created', message: `#${values.name} is ready for messaging` });
      setChannelOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await sendMessage(text.trim());
    if (res.ok) {
      setText('');
    } else {
      toast({ variant: 'error', title: 'Send Failed', message: res.error });
    }
  };

  const employeeName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'System User';
  };

  return (
    <AppShell>
      <PageHeader
        title="Collaboration Chat Room"
        subtitle="Access organization, project, department, and team channels or direct message staff members"
        actions={<Button onClick={() => setChannelOpen(true)}>Create Channel</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, height: 'calc(100vh - 220px)' }}>
        {/* Left Side Channels */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: 16, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Channels</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeChannelId === c.id ? 'var(--brand-muted)' : 'transparent',
                  color: activeChannelId === c.id ? 'var(--brand)' : 'var(--text-primary)',
                  fontWeight: activeChannelId === c.id ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                # {c.name ?? 'Direct Message'}
              </button>
            ))}
            {channels.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No channels created.</span>}
          </div>
        </div>

        {/* Right Side Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', height: '100%' }}>
          {activeChannelId ? (
            <>
              {/* Message log */}
              <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{employeeName(m.senderId)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(m.createdAt!).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: 8, width: 'max-content', maxWidth: '70%' }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40 }}>No messages yet. Say hello!</div>}
              </div>

              {/* Message Input box */}
              <form onSubmit={handleSend} style={{ borderTop: '1px solid var(--border-color)', padding: 16, display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)'
                  }}
                />
                <Button type="submit">Send</Button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              Select a collaboration channel to start chatting
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Drawer */}
      <Drawer open={channelOpen} onClose={() => setChannelOpen(false)} title="Create New Channel">
        <Form initial={{ type: 'team' }} onSubmit={handleChannelCreate}>
          <TextField name="name" label="Channel Name" placeholder="e.g. engineering-sync" />
          <SelectField
            name="type"
            label="Channel Type Scope"
            options={[
              { value: 'team', label: 'Team Channel' },
              { value: 'project', label: 'Project Channel' },
              { value: 'department', label: 'Department Channel' },
            ]}
          />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setChannelOpen(false)}>Cancel</Button>
            <Button type="submit">Create Channel</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ChatChannels;
