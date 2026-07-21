/**
 * KVJ Analytics — Settings (Phase-1)
 * Organization info (from config), theme preference, and user preferences.
 * Mock-driven; writes persist to localStorage via the preferences store.
 */

import { AppShell } from '../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader } from '../../shared/ui/components';
import { useTheme, type ThemeMode } from '../../shared/theme/ThemeProvider';
import { useConfig } from '../../shared/config/ConfigProvider';
import { useAuth } from '../../modules/auth/AuthProvider';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { config, features } = useConfig();
  const { user } = useAuth();

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Organization, appearance and preferences" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <Card>
          <SectionHeader title="Organization" />
          <Row label="Application name">{config.app.name}</Row>
          <Row label="Version">{config.app.version}</Row>
          <Row label="Environment">{config.app.environment}</Row>
          <Row label="Timezone">{config.locale.timezone}</Row>
          <Row label="Financial year start">{`Month ${config.organization.financialYearStartMonth}`}</Row>
        </Card>

        <Card>
          <SectionHeader title="Appearance" />
          <Row label="Theme">
            <select className="kvj-select" style={{ width: 160 }} value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="hud">Cockpit</option>
              <option value="system">System</option>
            </select>
          </Row>
          <Row label="Primary brand color">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--brand)' }} /> {config.branding.primary}
            </span>
          </Row>
          <Row label="Date format">{config.locale.dateFormat}</Row>
          <Row label="Time format">{config.locale.timeFormat}</Row>
        </Card>

        <Card>
          <SectionHeader title="Signed-in user" />
          <Row label="Name">{user?.fullName ?? '—'}</Row>
          <Row label="Email">{user?.email ?? '—'}</Row>
          <Row label="Role">{user?.role ?? '—'}</Row>
        </Card>

        <Card>
          <SectionHeader title="Enabled modules" />
          {Object.entries(features.modules).map(([key, on]) => (
            <Row key={key} label={key}>
              <span style={{ color: on ? 'var(--status-success)' : 'var(--text-muted)' }}>{on ? 'Enabled' : 'Disabled'}</span>
            </Row>
          ))}
        </Card>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        Phase-1 preview · these settings become editable and Supabase-backed in Phase 2.
      </p>
    </AppShell>
  );
}
