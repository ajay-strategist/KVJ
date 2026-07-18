import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Card } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

export function PowerBiGateway() {
  const { toast } = useNotifications();

  const handleRefresh = () => {
    toast({ variant: 'success', title: 'Data Warehouse Refreshed', message: 'Incremental delta changes pushed to BI star schemas.' });
  };

  return (
    <AppShell>
      <PageHeader
        title="Power BI & Data Warehouse Gateway"
        subtitle="Configure star schema dimensional model views, map facts/dimension columns, and schedule data warehouse refreshes"
        actions={<Button onClick={handleRefresh}>Incremental Refresh Now</Button>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Fact Tables Definition Mapping</h3>
          <ul style={{ lineHeight: 1.8 }}>
            <li><code>fact_attendance_records</code>: Clock-in/out telemetry, total duration, overtime.</li>
            <li><code>fact_timesheet_hours</code>: Project billable actual hours, task checklists updates.</li>
            <li><code>fact_expense_claims</code>: Spend claim details, category, per-diem levels.</li>
          </ul>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Dimension Tables Mapping</h3>
          <ul style={{ lineHeight: 1.8 }}>
            <li><code>dim_employees</code>: Role keys, departments, supervisor hierarchy.</li>
            <li><code>dim_projects</code>: Budgets limits, milestones, client profiles.</li>
            <li><code>dim_dates</code>: Calendar metrics, fiscal quarters, years.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
export default PowerBiGateway;
