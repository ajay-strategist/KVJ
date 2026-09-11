import { useAuth } from '../../../modules/auth/AuthProvider';
import { ROLES } from '../../../shared/permissions/roles';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader } from '../../../shared/ui/components';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';

/** Configurable dashboard demo (widget registry + role-based grid). */
export function DashboardPage() {
  const { user } = useAuth();
  const workspace = user ? ROLES[user.role].workspace : 'employee';
  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Configurable widgets · powered by the dashboard registry" />
      <DashboardGrid role={workspace} />
    </AppShell>
  );
}

export default DashboardPage;
