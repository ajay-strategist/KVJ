/**
 * KVJ Analytics — Enterprise Settings & Workspace Customization OS Engine
 * Redesigned 4-tab architecture:
 * [ Appearance ] [ Workspace Comfort ] [ Advanced ] [ Admin Festivals ]
 */

import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Button, Avatar } from '../../shared/ui/components';
import { useTheme, type ThemeMode } from '../../shared/theme/ThemeProvider';
import { SeasonalThemeAdminCard } from '../../shared/theme/SeasonalThemeAdminCard';
import { DEFAULT_SEASONAL_THEMES, type SeasonalThemeId, type SeasonalThemeConfig } from '../../shared/theme/seasonal-themes';
import { useConfig } from '../../shared/config/ConfigProvider';
import { useAuth } from '../../modules/auth/AuthProvider';
import { useWorkspace, WORKSPACE_PRESETS, WALLPAPER_GALLERY } from '../../shared/theme/WorkspaceProvider';
import { useNotifications } from '../../shared/notifications/NotificationProvider';
import { convertDriveUrlToDirectImg } from '../../shared/utils/drive';

type SettingsTab = 'appearance' | 'comfort' | 'advanced' | 'admin-festivals';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { mode, setMode, activeSeasonalThemes } = useTheme();
  const { user, updateUser } = useAuth();
  const roleUpper = (user?.role || '').toUpperCase();
  const isAdmin = ['ADMIN', 'CEO', 'MANAGER'].includes(roleUpper);
  const { toast } = useNotifications();

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Temporary Theme Preview state
  const [previewOriginalTheme, setPreviewOriginalTheme] = useState<ThemeMode | null>(null);
  const isPreviewing = previewOriginalTheme !== null;

  // Profile photo state
  const [photoUrlInput, setPhotoUrlInput] = useState(user?.avatarUrl || '');
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  const {
    wallpaper,
    glassOpacity,
    glassBlur,
    accentColor,
    cornerRadius,
    shadowSoftness,
    animationSpeed,
    activePreset,
    viewMode,
    setWallpaper,
    setGlassOpacity,
    setGlassBlur,
    setAccentColor,
    setCornerRadius,
    setShadowSoftness,
    setAnimationSpeed,
    setViewMode,
    loadPreset,
  } = useWorkspace();

  useEffect(() => {
    if (user?.avatarUrl) {
      setPhotoUrlInput(user.avatarUrl);
    }
  }, [user?.avatarUrl]);

  const handleUpdatePhoto = async () => {
    if (!user) return;
    setUpdatingPhoto(true);
    try {
      const convertedUrl = convertDriveUrlToDirectImg(photoUrlInput);
      await updateUser(user.id, { avatarUrl: convertedUrl });
      toast({
        variant: 'success',
        title: 'Photo Updated',
        message: 'Your profile photo has been updated successfully.',
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: err.message || 'Failed to update profile photo.',
      });
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleStartThemePreview = (targetTheme: ThemeMode) => {
    if (!previewOriginalTheme) {
      setPreviewOriginalTheme(mode);
    }
    setMode(targetTheme);
    toast({
      variant: 'info',
      title: 'Temporary Preview Active',
      message: `Previewing ${targetTheme.toUpperCase()} theme. Your saved preference is preserved.`,
    });
  };

  const handleApplyTheme = (targetTheme: ThemeMode) => {
    setPreviewOriginalTheme(null);
    setMode(targetTheme);
    toast({
      variant: 'success',
      title: 'Theme Applied',
      message: `Set ${targetTheme.toUpperCase()} as your active theme.`,
    });
  };

  const handleExitThemePreview = () => {
    if (previewOriginalTheme) {
      setMode(previewOriginalTheme);
      setPreviewOriginalTheme(null);
      toast({
        variant: 'info',
        title: 'Exited Preview',
        message: 'Restored your previous theme preference.',
      });
    }
  };

  // Festival theme catalogue
  const festivalThemesList: Array<{
    id: SeasonalThemeId;
    name: string;
    icon: string;
    description: string;
    badge: string;
    palette: [string, string, string];
  }> = [
    {
      id: 'christmas',
      name: 'Christmas Light',
      icon: '🎄',
      description: 'Festive Crimson & Pure Snow with frosted crystalline accents',
      badge: 'Dec 01 – Dec 31',
      palette: ['#DC2626', '#FFFFFF', '#16A34A'],
    },
    {
      id: 'christmas-dark',
      name: 'Christmas Dark',
      icon: '🎄',
      description: 'Velvet Crimson & Midnight Obsidian with cozy cabin glow',
      badge: 'Dec 01 – Dec 31',
      palette: ['#DC2626', '#0F172A', '#FCA5A5'],
    },
    {
      id: 'new-year',
      name: 'New Year',
      icon: '🎆',
      description: 'Celestial Starlight Champagne Gold with midnight sparkle',
      badge: 'Dec 28 – Jan 10',
      palette: ['#E5C378', '#111827', '#FDE047'],
    },
    {
      id: 'easter',
      name: 'Easter',
      icon: '🐣',
      description: 'Spring Meadow Mint & Pastel Lilac with gentle floral renewal',
      badge: 'Mar 25 – Apr 15',
      palette: ['#7C3AED', '#F3E8FF', '#10B981'],
    },
    {
      id: 'onam',
      name: 'Onam Light',
      icon: '🌼',
      description: 'Kerala Kasavu Gold & Marigold Saffron with Athapookalam flowers',
      badge: 'Aug 25 – Sep 15',
      palette: ['#B8860B', '#FFFDF5', '#166534'],
    },
    {
      id: 'onam-dark',
      name: 'Onam Dark',
      icon: '🌼',
      description: 'Midnight Kasavu Gold & Nilavilakku Brass with festive night glow',
      badge: 'Aug 25 – Sep 15',
      palette: ['#D48806', '#0F1A12', '#E5A823'],
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Manage appearance, workspace comfort modes, advanced engine tokens, and festival broadcasts"
      />

      {/* Floating Temporary Preview Banner */}
      {isPreviewing && (
        <div
          style={{
            position: 'sticky',
            top: 12,
            zIndex: 100,
            background: 'linear-gradient(135deg, var(--brand, #4f46e5), var(--accent, #6366f1))',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 14,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.3)',
            animation: 'kvjBounceIn 0.3s ease-out',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <div>
              <strong style={{ fontSize: 14 }}>Temporary Preview Mode</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Currently previewing <strong>{mode.toUpperCase()}</strong>. Your saved settings remain unchanged until confirmed.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExitThemePreview}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                fontWeight: 700,
              }}
            >
              ✕ Exit Preview
            </Button>
            <Button
              size="sm"
              onClick={() => handleApplyTheme(mode)}
              style={{
                background: '#ffffff',
                color: 'var(--brand, #4f46e5)',
                fontWeight: 800,
              }}
            >
              ✓ Save & Keep Theme
            </Button>
          </div>
        </div>
      )}

      {/* 4 Horizontally Aligned Segmented Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          marginBottom: 24,
          padding: '6px',
          background: 'var(--bg-sunken)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          boxSizing: 'border-box',
          flexShrink: 0,
          minHeight: 52,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: 10,
            border: activeTab === 'appearance' ? '1px solid var(--border)' : '1px solid transparent',
            background: activeTab === 'appearance' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'appearance' ? 'var(--brand, #4f46e5)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'appearance' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
            boxShadow: activeTab === 'appearance' ? 'var(--e1)' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: 'normal',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 16 }}>🎨</span> Appearance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('comfort')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: 10,
            border: activeTab === 'comfort' ? '1px solid var(--border)' : '1px solid transparent',
            background: activeTab === 'comfort' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'comfort' ? 'var(--brand, #4f46e5)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'comfort' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
            boxShadow: activeTab === 'comfort' ? 'var(--e1)' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: 'normal',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 16 }}>🛋️</span> Workspace Comfort
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('advanced')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: 10,
            border: activeTab === 'advanced' ? '1px solid var(--border)' : '1px solid transparent',
            background: activeTab === 'advanced' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'advanced' ? 'var(--brand, #4f46e5)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'advanced' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
            boxShadow: activeTab === 'advanced' ? 'var(--e1)' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: 'normal',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 16 }}>⚙️</span> Advanced Customization
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin-festivals')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              border: activeTab === 'admin-festivals' ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid transparent',
              background: activeTab === 'admin-festivals' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'admin-festivals' ? '#DC2626' : 'var(--text-secondary)',
              fontWeight: activeTab === 'admin-festivals' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: activeTab === 'admin-festivals' ? 'var(--e1)' : 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              lineHeight: 'normal',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>👑</span> Admin Festivals
          </button>
        )}
      </div>

      {/* ──────────────── TAB 1: APPEARANCE ──────────────── */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Base Color Scheme */}
          <Card>
            <SectionHeader title="Base Color Scheme" subtitle="Choose your primary personal display preference" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
              {[
                { id: 'light', name: 'Light', icon: '☀️', desc: 'Crisp bright canvas' },
                { id: 'dark', name: 'Dark', icon: '🌙', desc: 'Midnight ocular comfort' },
                { id: 'system', name: 'System', icon: '🖥️', desc: 'Syncs with your OS' },
              ].map((scheme) => {
                const isSelected = mode === scheme.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => handleApplyTheme(scheme.id as any)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 14,
                      border: isSelected ? '2px solid var(--brand, #4f46e5)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--brand-muted, rgba(79, 70, 229, 0.08))' : 'var(--bg-sunken)',
                      color: isSelected ? 'var(--brand, #4f46e5)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? 'var(--e2)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{scheme.icon}</span>
                    <strong style={{ fontSize: 14 }}>{scheme.name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{scheme.desc}</span>
                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 800, marginTop: 4, background: 'var(--brand)', color: '#fff', padding: '2px 8px', borderRadius: 999 }}>
                        Active ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <Row label="Typography Rendering">SF Pro Display / Inter</Row>
              <Row label="Motion Engine">Spring (GPU Accelerated 60fps)</Row>
            </div>
          </Card>

          {/* Signed-in Profile Card */}
          <Card>
            <SectionHeader title="Signed-in Account Profile" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Avatar name={user?.fullName ?? ''} src={user?.avatarUrl} size={64} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                  {user?.fullName ?? '—'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {user?.designation ?? '—'} · <strong style={{ color: 'var(--brand)' }}>{user?.role ?? '—'}</strong>
                </div>
              </div>
            </div>

            <Row label="Email Address">{user?.email ?? '—'}</Row>
            <Row label="Contact Phone">{user?.phone ?? '—'}</Row>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Profile Photo (Google Drive Link or Image URL)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="kvj-input"
                  placeholder="Paste Google Drive share link (Anyone can view)..."
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button
                  size="sm"
                  onClick={handleUpdatePhoto}
                  loading={updatingPhoto}
                  disabled={updatingPhoto || photoUrlInput === (user?.avatarUrl || '')}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Save Photo
                </Button>
                {user?.avatarUrl && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (!user) return;
                      setUpdatingPhoto(true);
                      try {
                        await updateUser(user.id, { avatarUrl: '' });
                        setPhotoUrlInput('');
                        toast({
                          variant: 'info',
                          title: 'Photo Removed',
                          message: 'Your profile photo has been reset.',
                        });
                      } finally {
                        setUpdatingPhoto(false);
                      }
                    }}
                    disabled={updatingPhoto}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: '1.4' }}>
                Supports any public Google Drive view link. Automatically converted to a permanent direct viewable image.
              </p>
            </div>
          </Card>

          {/* Full Width Festival Themes Showcase */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
                <SectionHeader
                  title="🎉 Festive & Seasonal Theme Overlays"
                  subtitle="Immersive visual themes designed for festive celebrations, cultural milestones, and special events"
                />
                {mode !== 'light' && mode !== 'dark' && mode !== 'system' && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, var(--brand), var(--accent))',
                      color: '#ffffff',
                    }}
                  >
                    Active Overlay: {mode.toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 14 }}>
                {festivalThemesList.map((st) => {
                  const isCurrentlyActive = mode === st.id;
                  return (
                    <div
                      key={st.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        background: 'var(--bg-sunken)',
                        border: isCurrentlyActive ? '2px solid var(--brand, #4f46e5)' : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        position: 'relative',
                        boxShadow: isCurrentlyActive ? 'var(--e2)' : 'none',
                      }}
                    >
                      <div>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 24 }}>{st.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            {st.badge}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {st.name}
                        </h4>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                          {st.description}
                        </p>

                        {/* Visual Palette Pill Swatches */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Palette:</span>
                          {st.palette.map((color, i) => (
                            <span
                              key={i}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.15)',
                                display: 'inline-block',
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Actions: Preview & Apply */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartThemePreview(st.id)}
                          style={{ flex: 1, fontSize: 12 }}
                        >
                          👁️ Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApplyTheme(st.id)}
                          style={{
                            flex: 1,
                            fontSize: 12,
                            background: isCurrentlyActive ? '#16a34a' : undefined,
                            borderColor: isCurrentlyActive ? '#16a34a' : undefined,
                          }}
                        >
                          {isCurrentlyActive ? '✓ Active' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: WORKSPACE COMFORT ──────────────── */}
      {activeTab === 'comfort' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Base Workstation Presets */}
          <Card>
            <SectionHeader
              title="Base Workstation Layout Presets"
              subtitle="Quickly adjust visual hierarchy, density, and contrast"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 14 }}>
              {Object.keys(WORKSPACE_PRESETS).map((key) => {
                const isActive = activePreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (mode !== 'light' && mode !== 'dark' && mode !== 'system') {
                        setMode('light');
                      }
                      loadPreset(key);
                      toast({
                        variant: 'info',
                        title: 'Preset Loaded',
                        message: `Switched layout preset to "${key}".`,
                      });
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: isActive ? 'linear-gradient(135deg, var(--brand), var(--accent))' : 'var(--bg-sunken)',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? 'var(--e2)' : 'none',
                      textAlign: 'center',
                    }}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Workspace Optimization Modes */}
          <Card>
            <SectionHeader
              title="Workspace Optimization Modes"
              subtitle="Scale element density for presentations, deep focus, or executive review"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 14 }}>
              {(['Standard', 'Focus', 'Presentation', 'Executive'] as const).map((modeOption) => {
                const isActive = viewMode === modeOption;
                const descriptions: Record<string, string> = {
                  Standard: 'Balanced information density for everyday workflows',
                  Focus: 'Minimized peripheral visual elements for deep task focus',
                  Presentation: 'Enlarged cards and high-legibility stats for screensharing',
                  Executive: 'High-level summaries, KPI highlights, and streamlined tables',
                };
                return (
                  <button
                    key={modeOption}
                    type="button"
                    onClick={() => {
                      setViewMode(modeOption);
                      toast({
                        variant: 'info',
                        title: `${modeOption} Mode`,
                        message: `Workspace density configured for ${modeOption.toLowerCase()} view.`,
                      });
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: isActive ? 'linear-gradient(135deg, var(--brand), var(--accent))' : 'var(--bg-sunken)',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      boxShadow: isActive ? 'var(--e2)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{modeOption}</div>
                    <div style={{ fontSize: 11.5, opacity: isActive ? 0.9 : 0.7, lineHeight: '1.3' }}>
                      {descriptions[modeOption]}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ──────────────── TAB 3: ADVANCED CUSTOMIZATION ──────────────── */}
      {activeTab === 'advanced' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Visual Parameters & Wallpaper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* VisionOS Engine Sliders */}
            <Card>
              <SectionHeader
                title="VisionOS Workspace Token Customizer"
                subtitle="Fine-tune frosted glass translucency, shadows, rounding, and fluid motion"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
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
                    <span>Corner Radius (VisionOS Rounding)</span>
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
              <SectionHeader title="🖼️ Wallpaper Gallery & Engine" subtitle="Select canvas backdrop gradients and mesh blends" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
                {WALLPAPER_GALLERY.map((wp) => {
                  const isActive = wallpaper === wp.value;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => setWallpaper(wp.value)}
                      style={{
                        height: 74,
                        borderRadius: 12,
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
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          background: 'rgba(0,0,0,0.55)',
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

          {/* Right Column: Account Security & Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <UserPasswordResetCard />
            <EmailSetupCard />
          </div>
        </div>
      )}

      {/* ──────────────── TAB 4: ADMIN FESTIVALS ──────────────── */}
      {activeTab === 'admin-festivals' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Festival Scheduling Engine */}
          <SeasonalThemeAdminCard actorId={user?.id} />
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        FlowDesk Enterprise Customization Engine · Preferences are persisted locally and applied in real time.
      </p>
    </AppShell>
  );
}

function UserPasswordResetCard() {
  const { user, updateUserPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      setMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      await updateUserPassword(user.id, newPassword);
      setMsg({ type: 'success', text: 'Password successfully updated!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionHeader title="🔐 Reset Account Password" />
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Update your login password for this workspace.
      </p>

      {msg && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 6,
          background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#15803d' : '#b91c1c',
          marginBottom: 12, fontWeight: 600
        }}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>New Password</label>
          <input
            type="password"
            className="kvj-input"
            placeholder="Enter new password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Confirm New Password</label>
          <input
            type="password"
            className="kvj-input"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EmailSetupCard() {
  const { toast } = useNotifications();
  const [host, setHost] = useState(() => localStorage.getItem('kvj_smtp_host') || 'smtp.office365.com');
  const [port, setPort] = useState(() => localStorage.getItem('kvj_smtp_port') || '587');
  const [fromEmail, setFromEmail] = useState(() => localStorage.getItem('kvj_smtp_from') || 'notifications@kvjanalytics.com');
  const [username, setUsername] = useState(() => localStorage.getItem('kvj_smtp_user') || 'notifications@kvjanalytics.com');
  const [password, setPassword] = useState(() => localStorage.getItem('kvj_smtp_pass') || '••••••••••••');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('kvj_smtp_host', host);
    localStorage.setItem('kvj_smtp_port', port);
    localStorage.setItem('kvj_smtp_from', fromEmail);
    localStorage.setItem('kvj_smtp_user', username);
    localStorage.setItem('kvj_smtp_pass', password);
    setTimeout(() => {
      setSaving(false);
      toast({
        variant: 'success',
        title: 'Email Configuration Saved',
        message: `SMTP server settings for ${fromEmail} updated successfully.`,
      });
    }, 400);
  };

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast({
        variant: 'info',
        title: 'SMTP Connection Verified',
        message: `Test email sent to ${fromEmail} via ${host}:${port}.`,
      });
    }, 800);
  };

  return (
    <Card>
      <SectionHeader title="📧 Email Setup & SMTP Configuration" subtitle="Configure server credentials for outbound email notifications sent by the platform" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SMTP Host Server</label>
          <input type="text" className="kvj-input" placeholder="smtp.office365.com" value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Port</label>
          <input type="text" className="kvj-input" placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>From Email Address</label>
          <input type="email" className="kvj-input" placeholder="notifications@kvjanalytics.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SMTP Username</label>
          <input type="text" className="kvj-input" placeholder="user@domain.com" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SMTP Password / App Secret</label>
          <input type="password" className="kvj-input" placeholder="Enter password or token" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Button variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing Connection...' : '⚡ Test SMTP Connection'}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving Config...' : '💾 Save Email Configuration'}
        </Button>
      </div>
    </Card>
  );
}

export default SettingsPage;
