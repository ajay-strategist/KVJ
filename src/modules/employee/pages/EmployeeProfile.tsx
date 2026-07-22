import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Avatar, Button, Timeline, type TimelineEntry } from '../../../shared/ui/components';
import { useEmployeeProfile, useEmployee } from '../hooks/useEmployee';
import { Form, TextField } from '../../../shared/forms/form';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useState } from 'react';
import Drawer from '../../../shared/ui/Drawer';

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, manager, reports, loading, refresh } = useEmployeeProfile(id);
  const { updateProfile } = useEmployee();
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const [editOpen, setEditOpen] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Loading Profile..." />
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <PageHeader title="Profile Not Found" />
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p>The requested employee does not exist or has been deleted.</p>
            <Button onClick={() => navigate('/app/employees')}>Back to Directory</Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  const name = `${profile.firstName} ${profile.lastName}`;

  const mockTimeline: TimelineEntry[] = [
    { id: '1', title: 'Joined Organization', time: profile.dateOfJoining, tone: 'success', description: `Started as a ${profile.designation}` },
    { id: '2', title: 'Onboarded to Training Workspace', time: '1 month ago', tone: 'info' },
    { id: '3', title: 'Clocked In', time: 'Today, 09:30 AM', tone: 'progress' },
  ];

  const handleUpdate = async (values: Record<string, unknown>) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Update Profile?',
      message: 'Are you sure you want to save these changes?',
    });
    if (!ok) return;

    const res = await updateProfile(id, {
      firstName: values.firstName as string,
      lastName: values.lastName as string,
      phone: values.phone as string,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Profile Updated', message: 'The employee profile details have been saved.' });
      setEditOpen(false);
      refresh();
    } else {
      toast({ variant: 'error', title: 'Update Failed', message: res.error });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={name}
        subtitle={`${profile.designation} · ${profile.employeeId}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit Profile
            </Button>
            <Button variant="ghost" onClick={() => navigate('/app/employees')}>
              Directory
            </Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }} className="kvj-workspace-grid">
        {/* Main Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <Avatar name={name} src={profile.avatarUrl} size={64} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{profile.designation}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{profile.email}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phone</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{profile.phone || 'N/A'}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Joined</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{profile.dateOfJoining}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</span>
                <div style={{ marginTop: 2 }}>
                  <span className={`kvj-badge kvj-badge--${profile.status === 'active' ? 'success' : 'neutral'}`}>{profile.status}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Org Hierarchy */}
          <Card>
            <SectionHeader title="Organization Hierarchy" />
            
            {/* Manager */}
            {manager && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reporting Manager</span>
                <div
                  onClick={() => navigate(`/app/employees/${manager.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, cursor: 'pointer', padding: 8, borderRadius: 8, background: 'var(--bg-sunken)' }}
                >
                  <Avatar name={`${manager.firstName} ${manager.lastName}`} src={manager.avatarUrl} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{manager.firstName} {manager.lastName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{manager.designation}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Reports */}
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Direct Reports ({reports.length})</span>
              {reports.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => navigate(`/app/employees/${rep.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }}
                    >
                      <Avatar name={`${rep.firstName} ${rep.lastName}`} src={rep.avatarUrl} size={28} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{rep.firstName} {rep.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{rep.designation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>No direct reports.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Side Timeline */}
        <div>
          <Card>
            <SectionHeader title="Timeline & Activities" />
            <Timeline entries={mockTimeline} />
          </Card>
        </div>
      </div>

      {/* Edit Profile Drawer */}
      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title="Edit Employee Profile">
        <Form initial={{ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? '' }} onSubmit={handleUpdate}>
          <TextField name="firstName" label="First Name" />
          <TextField name="lastName" label="Last Name" />
          <TextField name="phone" label="Phone Number" />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </Form>
      </Drawer>

      <style>{`@media (max-width: 1024px){ .kvj-workspace-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </AppShell>
  );
}
export default EmployeeProfile;
