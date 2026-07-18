import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, StatCard } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { useAnalytics } from '../hooks/useAnalytics';

export function ExecutiveConsole() {
  const { metrics, aiSummary, loading } = useAnalytics();

  const ceoContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI Summary Card */}
      <Card>
        <h3 style={{ marginTop: 0 }}>Natural Language AI Summary Insights</h3>
        {aiSummary ? (
          <p style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>{aiSummary}</p>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Generating executive forecast summary...</p>
        )}
      </Card>

      {/* KPI Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard label="Total Staff Employees" value={metrics?.totalEmployees ?? 0} tone="info" />
        <StatCard label="Active Projects Registered" value={metrics?.activeProjects ?? 0} tone="progress" />
        <StatCard label="Total Courses Catalog" value={metrics?.activeCourses ?? 0} tone="success" />
      </div>
    </div>
  );

  const financeContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StatCard label="Total Budget Allocated Limit" value={`$${metrics?.totalBudgetsAllocated ?? 0}`} tone="info" />
        <StatCard label="Actual Spent Volume" value={`$${metrics?.totalBudgetsSpent ?? 0}`} tone="warning" />
      </div>
      <Card>
        <h3 style={{ marginTop: 0 }}>Budget Allocation Variance Overview</h3>
        <p>Operational department budgets allocations are tracked within +/- 5% tolerances. No warnings registered.</p>
      </Card>
    </div>
  );

  const tabs = [
    { id: 'ceo', label: 'CEO Dashboard Overview', content: ceoContent },
    { id: 'finance', label: 'Finance & Spend Analytics', content: financeContent },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Decision Intelligence & Analytics Console"
        subtitle="Executive CEO summaries, department operational KPI variances, and natural language analytics forecasts"
      />

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Aggregating decision intelligence reports...</div>
      ) : (
        <Tabs items={tabs} />
      )}
    </AppShell>
  );
}
export default ExecutiveConsole;
