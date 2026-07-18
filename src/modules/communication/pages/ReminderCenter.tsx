import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useCommunication } from '../hooks/useCommunication';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card } from '../../../shared/ui/components';
import { Form, CheckboxField } from '../../../shared/forms/form';

export function ReminderCenter() {
  const { preferences, updatePreferences, triggerAutoReminders } = useCommunication();
  const { toast } = useNotifications();

  const handlePreferencesSubmit = async (values: Record<string, unknown>) => {
    const res = await updatePreferences({
      digestMode: !!values.digestMode,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Preferences Saved', message: 'Notification preferences updated.' });
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleTriggerReminders = async () => {
    const res = await triggerAutoReminders();
    if (res.ok) {
      toast({ variant: 'success', title: 'Reminders Fired', message: 'Auto-reminder notification dispatched.' });
    } else {
      toast({ variant: 'error', title: 'Execution Failed', message: res.error });
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Auto Reminders & Channels Preferences"
        subtitle="Manage automatic reminder schedules and mute preferences"
        actions={<Button onClick={handleTriggerReminders}>Trigger Reminders Ticker</Button>}
      />

      <div style={{ maxWidth: 600 }}>
        <Card>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Notification Preferences Settings</h3>
          <Form
            initial={{ digestMode: preferences?.digestMode ?? false }}
            onSubmit={handlePreferencesSubmit}
          >

            <CheckboxField name="digestMode" label="Enable Daily Email Digest summary mode" />

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit">Save Settings</Button>
            </div>
          </Form>
        </Card>
      </div>
    </AppShell>
  );
}
export default ReminderCenter;
