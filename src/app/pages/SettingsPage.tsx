/**
 * KVJ Analytics — Settings & Apple 2032 Workspace Customization OS Engine
 * Allows users to personalize their workspace with mesh/aurora gradients,
 * glass opacity/blur, accent colors, custom radii, and shadow softness.
 */

import { useState, useEffect } from 'react';
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

          {/* Workspace View Modes */}
          <Card>
            <SectionHeader title="🔍 Workspace Optimization Modes" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Switch workspace optimization mode to protect eyes, enhance readability, or scale elements for presentations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(['Standard', 'Focus', 'Presentation', 'Executive'] as const).map((modeOption) => {
                const isActive = viewMode === modeOption;
                return (
                  <button
                    key={modeOption}
                    onClick={() => setViewMode(modeOption)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'linear-gradient(135deg, var(--brand), var(--accent))' : 'var(--bg-sunken)',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {modeOption}
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

          {/* User Password Reset Card (Task 11) */}
          <UserPasswordResetCard />

          {/* Admin User Management Panel */}
          {user?.role === 'ADMIN' && (
            <AdminUserManagementCard />
          )}

        </div>

      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Lead Design Team Spec · Enterprise OS custom settings are saved and loaded instantly.
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

function AdminUserManagementCard() {
  const { createUser, updateUser, deleteUser, getUsers, resetToDefaultPassword } = useAuth();
  const [usersList, setUsersList] = useState<import('../../modules/auth/auth.service').AuthUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<import('../../modules/auth/auth.service').AuthUser | null>(null);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<import('../../shared/permissions/roles').RoleKey>('TRAINER');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const reloadUsers = () => {
    getUsers().then(setUsersList);
  };

  useEffect(() => {
    reloadUsers();
  }, []);

  const handleResetToDefault = async (u: import('../../modules/auth/auth.service').AuthUser) => {
    if (confirm(`Reset password for "${u.fullName}" to default password ("password")? They will be required to change password on next login.`)) {
      try {
        await resetToDefaultPassword(u.id);
        alert(`Password for ${u.fullName} reset to "password". User must change password on next login.`);
        reloadUsers();
      } catch (e: any) {
        alert(e?.message || 'Failed to reset password.');
      }
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setEmail('');
    setRole('TRAINER');
    setPassword('');
    setMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (u: import('../../modules/auth/auth.service').AuthUser) => {
    setEditingUser(u);
    setUsername(u.username || '');
    setFullName(u.fullName || '');
    setEmail(u.email || '');
    setRole(u.role || 'TRAINER');
    setPassword('');
    setMsg(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!username || !fullName || !email) {
      setMsg('❌ All fields (Username, Full Name, Email) are required.');
      return;
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          username,
          fullName,
          email,
          role,
          ...(password ? { password } : {}),
        });
        setMsg(`✅ User "${fullName}" updated successfully!`);
      } else {
        await createUser({ username, fullName, email, role });
        setMsg(`✅ User "${username}" created successfully! Default password: "password" (Must reset password on first login).`);
      }
      reloadUsers();
      setTimeout(() => {
        setModalOpen(false);
        setMsg(null);
      }, 1500);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Operation failed.'}`);
    }
  };

  const handleDelete = async (u: import('../../modules/auth/auth.service').AuthUser) => {
    if (u.username === 'Admin' || u.id === 'u-admin') {
      alert('Cannot delete root System Admin user.');
      return;
    }
    if (confirm(`Are you sure you want to delete user "${u.fullName}" (${u.username || u.email})?`)) {
      await deleteUser(u.id);
      reloadUsers();
      setModalOpen(false);
    }
  };

  return (
    <Card style={{ border: '2px solid var(--brand)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <SectionHeader title="👑 Admin User Management & Access Control" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Manage platform users, roles, default passwords, and access privileges.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal}>
          ➕ Add New User
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {usersList.map((u) => (
          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
            <div>
              <strong style={{ fontSize: 13 }}>{u.fullName} ({u.username || u.email})</strong>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email} · Role: <strong>{u.role}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {u.mustChangePassword ? (
                <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                  ⚠️ Password Reset Pending
                </span>
              ) : (
                <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                  ✓ Active
                </span>
              )}
              <Button size="sm" variant="secondary" onClick={() => handleResetToDefault(u)} style={{ padding: '4px 10px', fontSize: 11 }}>
                🔑 Reset Password
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEditModal(u)} style={{ padding: '4px 10px', fontSize: 11 }}>
                ✏️ Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', padding: 24, borderRadius: 16, width: 440, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>
              {editingUser ? `✏️ Edit User: ${editingUser.fullName}` : '➕ Add New User'}
            </h3>

            {msg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#15803d' : '#b91c1c', marginBottom: 12, fontWeight: 600 }}>{msg}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Username</label>
                <input type="text" className="kvj-input" placeholder="e.g. AnilKumar" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Full Name</label>
                <input type="text" className="kvj-input" placeholder="e.g. Prof. Anil Kumar" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
                <input type="email" className="kvj-input" placeholder="anil.kumar@kvjanalytics.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Role</label>
                <select className="kvj-select" style={{ width: '100%' }} value={role} onChange={(e) => setRole(e.target.value as any)}>
                  <option value="TRAINER">TRAINER</option>
                  <option value="MANAGER">COORDINATOR / MANAGER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Reset / Change Password (Optional)</label>
                  <input type="password" className="kvj-input" placeholder="Leave empty to keep current password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}

              {!editingUser && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-sunken)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                  ℹ️ Default password will be set to <strong>password</strong>. User must change password upon first login.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                {editingUser && editingUser.id !== 'u-admin' ? (
                  <button type="button" onClick={() => handleDelete(editingUser)} style={{ color: 'var(--status-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    🗑️ Delete User
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave}>{editingUser ? 'Save Changes' : 'Create User'}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default SettingsPage;
