import { useState, useEffect } from 'react';
import { Card, SectionHeader, Button } from '../ui/components';
import { useTheme } from './ThemeProvider';
import { useNotifications } from '../notifications/NotificationProvider';
import {
  type SeasonalThemeId,
  type SeasonalThemeConfig,
  isSeasonalThemeActive,
} from './seasonal-themes';

interface SeasonalThemeAdminCardProps {
  actorId?: string;
}

export function SeasonalThemeAdminCard({ actorId }: SeasonalThemeAdminCardProps) {
  const { seasonalSettings, updateSeasonalSettings, broadcastSeasonalTheme, setMode } = useTheme();
  const { toast } = useNotifications();
  const [localSettings, setLocalSettings] = useState<Record<SeasonalThemeId, SeasonalThemeConfig>>({
    ...seasonalSettings,
  });
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(seasonalSettings);
  }, [seasonalSettings]);

  const handleToggle = async (id: SeasonalThemeId) => {
    const nextEnabled = !localSettings[id].enabled;
    const updated = {
      ...localSettings,
      [id]: {
        ...localSettings[id],
        enabled: nextEnabled,
      },
    };
    setLocalSettings(updated);
    const ok = await updateSeasonalSettings(updated, actorId);
    if (ok) {
      toast({
        variant: 'info',
        title: `${updated[id].name} Theme ${nextEnabled ? 'Enabled' : 'Disabled'}`,
        message: nextEnabled
          ? `${updated[id].name} theme is now visible in Theme Settings.`
          : `${updated[id].name} theme is now turned off and hidden from Theme Settings.`,
      });
    }
  };

  const handlePreview = async (id: SeasonalThemeId) => {
    const cfg = localSettings[id];
    if (!cfg.enabled) {
      const updated = {
        ...localSettings,
        [id]: { ...cfg, enabled: true },
      };
      setLocalSettings(updated);
      await updateSeasonalSettings(updated, actorId);
    }
    setMode(id);
    toast({
      variant: 'info',
      title: `Previewing ${cfg.name} Theme ${cfg.icon}`,
      message: `Now previewing the ${cfg.name} theme. You can switch back or choose another theme anytime from Theme Settings.`,
    });
  };

  const handleDateChange = (id: SeasonalThemeId, field: 'startDate' | 'endDate', val: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const ok = await updateSeasonalSettings(localSettings, actorId);
      if (ok) {
        toast({
          variant: 'success',
          title: 'Seasonal Theme Schedules Saved',
          message: 'Theme schedules and status updated across the platform.',
        });
      } else {
        toast({
          variant: 'error',
          title: 'Save Failed',
          message: 'Could not update system settings in database.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcast = async (id: SeasonalThemeId) => {
    const config = localSettings[id];
    setBroadcasting(id);
    try {
      // 1. Ensure it's enabled and active today
      const todayStr = new Date().toISOString().slice(0, 10);
      const updatedConfig = {
        ...config,
        enabled: true,
        startDate: config.startDate > todayStr ? todayStr : config.startDate,
        broadcastId: `${id}-${Date.now()}`,
      };
      const updated = {
        ...localSettings,
        [id]: updatedConfig,
      };
      setLocalSettings(updated);
      const ok = await updateSeasonalSettings(updated, actorId);
      if (ok) {
        // Also apply immediately for the admin testing it
        setMode(id);
        toast({
          variant: 'success',
          title: `🎉 ${config.name} Theme Broadcasted!`,
          message: `All users will automatically receive the ${config.name} theme. They can switch back from Theme Settings anytime.`,
        });
      }
    } finally {
      setBroadcasting(null);
    }
  };

  const themeKeys: SeasonalThemeId[] = ['christmas', 'christmas-dark', 'new-year', 'easter', 'onam', 'onam-dark'];
  const today = new Date();

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <SectionHeader title="🗓️ Seasonal Theme Scheduler & Orchestrator" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0 }}>
            Schedule festive themes with automatic rollouts and expiration. When released, everyone&apos;s theme is auto-updated once while allowing users to switch back.
          </p>
        </div>
        <Button size="sm" onClick={handleSaveAll} loading={saving}>
          Save Schedules
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {themeKeys.map((key) => {
          const cfg = localSettings[key];
          if (!cfg) return null;
          const isActive = isSeasonalThemeActive(cfg, today);

          return (
            <div
              key={key}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: cfg.enabled
                  ? (isActive ? '1.5px solid var(--brand, #4f46e5)' : '1px solid var(--border)')
                  : '1px solid var(--border)',
                background: cfg.enabled
                  ? (isActive ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-sunken)')
                  : 'rgba(0, 0, 0, 0.02)',
                opacity: cfg.enabled ? 1 : 0.7,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                {/* Left: Theme Info & Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {cfg.name} Theme
                      </span>
                      {/* Status Badge */}
                      {cfg.enabled ? (
                        isActive ? (
                          <span style={{ fontSize: 10.5, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 12 }}>
                            🟢 ACTIVE NOW
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 12 }}>
                            ⏳ SCHEDULED
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 12 }}>
                          ⚪ TURNED OFF (HIDDEN)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {cfg.description}
                    </div>
                  </div>
                </div>

                {/* Right: Toggle Switch & Preview / Broadcast */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePreview(key)}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    title="Preview this theme right now on your screen"
                  >
                    👁️ Preview
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleBroadcast(key)}
                    loading={broadcasting === key}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                    }}
                    title="Immediately release this theme to all users across the platform"
                  >
                    🚀 Release to Everyone
                  </Button>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 6 }}>
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={() => handleToggle(key)}
                      style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cfg.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Schedule Date Inputs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Release Date (Start):
                  </label>
                  <input
                    type="date"
                    value={cfg.startDate}
                    onChange={(e) => handleDateChange(key, 'startDate', e.target.value)}
                    disabled={!cfg.enabled}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Auto-Expire Date (End):
                  </label>
                  <input
                    type="date"
                    value={cfg.endDate}
                    onChange={(e) => handleDateChange(key, 'endDate', e.target.value)}
                    disabled={!cfg.enabled}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {cfg.enabled
                    ? (isActive ? '✨ Live across app' : `Will activate automatically on ${cfg.startDate}`)
                    : 'Hidden from user theme settings'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
export default SeasonalThemeAdminCard;
