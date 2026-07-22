/**
 * KVJ Analytics — Settings & Apple 2032 Workspace Customization OS Engine
 * Allows users to personalize their workspace with mesh/aurora gradients,
 * glass opacity/blur, accent colors, custom radii, and shadow softness.
 */

import { AppShell } from '../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Button } from '../../shared/ui/components';
import { useTheme, type ThemeMode } from '../../shared/theme/ThemeProvider';
import { useConfig } from '../../shared/config/ConfigProvider';
import { useAuth } from '../../modules/auth/AuthProvider';
import { useWorkspace, WORKSPACE_PRESETS, WALLPAPER_GALLERY } from '../../shared/theme/WorkspaceProvider';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { config, features } = useConfig();
  const { user } = useAuth();

  const {
    wallpaper,
    glassOpacity,
    glassBlur,
    accentColor,
    cornerRadius,
    shadowSoftness,
    animationSpeed,
    activePreset,
    setWallpaper,
    setGlassOpacity,
    setGlassBlur,
    setAccentColor,
    setCornerRadius,
    setShadowSoftness,
    setAnimationSpeed,
    loadPreset,
  } = useWorkspace();

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Personalize your workspace operating system, themes, organization settings, and permissions" />

      {/* Main Grid: Customizer Left, General Settings Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Customization Control Panel (Left Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Preset Selector */}
          <Card>
            <SectionHeader title="🎛️ Workspace Themes & Presets (Apple 2032 Spec)" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Select a handcrafted theme layout preset optimized for Fortune 100 enterprise workflows.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {Object.keys(WORKSPACE_PRESETS).map((key) => {
                const isActive = activePreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'linear-gradient(135deg, var(--brand), var(--accent))' : 'var(--bg-sunken)',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
                    }}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Engine Parameters */}
          <Card>
            <SectionHeader title="🎨 Customization Parameters" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
              
              {/* Glass Opacity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Glass Opacity</span>
                  <span style={{ color: 'var(--brand)' }}>{Math.round(glassOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.05"
                  value={glassOpacity}
                  onChange={(e) => setGlassOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>

              {/* Glass Blur */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Glass Blur Intensity</span>
                  <span style={{ color: 'var(--brand)' }}>{glassBlur}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={glassBlur}
                  onChange={(e) => setGlassBlur(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>

              {/* Corner Radius */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Corner Radius (VisionOS rounding)</span>
                  <span style={{ color: 'var(--brand)' }}>{cornerRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="2"
                  value={cornerRadius}
                  onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>

              {/* Shadow Softness */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Shadow Softness / Occlusion</span>
                  <span style={{ color: 'var(--brand)' }}>{Math.round(shadowSoftness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.60"
                  step="0.05"
                  value={shadowSoftness}
                  onChange={(e) => setShadowSoftness(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>

              {/* Animation Speed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Animation Duration</span>
                  <span style={{ color: 'var(--brand)' }}>{animationSpeed}s</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.2"
                  step="0.05"
                  value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>

              {/* Accent Color Hex / Picker */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>Brand Accent Color</span>
                  <span style={{ color: 'var(--brand)' }}>{accentColor}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: 44, height: 38, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="kvj-input"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

            </div>
          </Card>

          {/* Wallpaper Gallery */}
          <Card>
            <SectionHeader title="🖼️ Wallpaper Gallery & Engine" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Select a static backdrop, gradient wave, mesh blend, or upload custom imagery to paint the canvas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {WALLPAPER_GALLERY.map((wp) => {
                const isActive = wallpaper === wp.value;
                return (
                  <button
                    key={wp.id}
                    onClick={() => setWallpaper(wp.value)}
                    style={{
                      height: 80,
                      borderRadius: 'var(--radius-md)',
                      background: wp.value,
                      border: isActive ? '3px solid var(--brand)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: 6,
                      textAlign: 'left',
                      boxShadow: isActive ? 'var(--e2)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#fff',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {wp.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

        </div>

        {/* General Settings (Right Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <Card>
            <SectionHeader title="Appearance & Modes" />
            <Row label="Base Design Theme">
              <select className="kvj-select" style={{ width: 160 }} value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
                <option value="light">☀️ Light Theme</option>
                <option value="dark">🌙 Dark Theme</option>
                <option value="hud">🎛️ Cockpit Dark</option>
                <option value="hud-light">⚡ Cockpit Light</option>
                <option value="system">🖥️ System Mode</option>
              </select>
            </Row>
            <Row label="Typography Rendering">SF Pro Display / Inter</Row>
            <Row label="Animation Mode">Spring (GPU Accelerated)</Row>
          </Card>

          <Card>
            <SectionHeader title="Organization Info" />
            <Row label="Application name">{config.app.name}</Row>
            <Row label="Version">{config.app.version}</Row>
            <Row label="Environment">{config.app.environment}</Row>
            <Row label="Timezone">{config.locale.timezone}</Row>
            <Row label="Financial year start">{`Month ${config.organization.financialYearStartMonth}`}</Row>
          </Card>

          <Card>
            <SectionHeader title="Signed-in Profile" />
            <Row label="Name">{user?.fullName ?? '—'}</Row>
            <Row label="Email">{user?.email ?? '—'}</Row>
            <Row label="Role">{user?.role ?? '—'}</Row>
          </Card>

          <Card>
            <SectionHeader title="Active Modules status" />
            {Object.entries(features.modules).map(([key, on]) => (
              <Row key={key} label={key}>
                <span style={{ color: on ? 'var(--status-success)' : 'var(--text-muted)' }}>{on ? 'Enabled' : 'Disabled'}</span>
              </Row>
            ))}
          </Card>

        </div>

      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Lead Design Team Spec · Enterprise OS custom settings are saved and loaded instantly.
      </p>
    </AppShell>
  );
}

export default SettingsPage;
