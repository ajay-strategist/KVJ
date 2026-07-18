/**
 * KVJ Analytics — Application Shell (Prompt 5/9 §2)
 * Layer: Shared. Responsive shell = collapsible sidebar + top bar (search,
 * notifications, theme, profile) + breadcrumbs + content container. Consumes the
 * navigation engine, permission engine, theme, notifications and command palette.
 * Contains NO business logic — modules render into {children}.
 */

import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { visibleNav, useNavPrefs } from '../navigation/navigation';
import { usePermissions } from '../permissions/react';
import { useAuth } from '../../modules/auth/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useNotifications } from '../notifications/NotificationProvider';
import { useCommandPalette } from '../search/CommandPaletteProvider';
import { useDevice } from '../hooks/responsive';
import { Avatar } from '../ui/components';
import { appConfig } from '../../config/app-config';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[name] ?? Icons.Circle;
  return <Cmp size={size} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const device = useDevice();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { can } = usePermissions();
  const { pushRecent } = useNavPrefs();
  const items = visibleNav(can);
  const isMobile = device === 'mobile';
  const showSidebar = isMobile ? mobileOpen : true;
  const width = collapsed && !isMobile ? 72 : 260;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
      {showSidebar && (
        <aside style={{
          width, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', position: isMobile ? 'fixed' : 'sticky', top: 0, height: '100vh', zIndex: 1100,
          transition: 'width var(--dur-base) var(--ease-emphasized)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, var(--brand), var(--accent))', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>K</span>
            {(!collapsed || isMobile) && <span style={{ fontWeight: 700, fontSize: 15 }}>{appConfig.app.name}</span>}
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {items.map((item) => (
              <NavLink key={item.id} to={item.path} icon={item.icon} label={item.label} collapsed={collapsed && !isMobile} onNavigate={() => { pushRecent(item.id); setMobileOpen(false); }} />
            ))}
          </nav>
          {!isMobile && (
            <button onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar"
              style={{ margin: 10, padding: 8, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Icon name={collapsed ? 'ChevronRight' : 'ChevronLeft'} size={16} />
            </button>
          )}
        </aside>
      )}

      {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.5)', zIndex: 1050 }} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onMenu={() => setMobileOpen(true)} isMobile={isMobile} />
        <main style={{ flex: 1, padding: isMobile ? 16 : 32, maxWidth: 1440, width: '100%', margin: '0 auto' }}>
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ to, icon, label, collapsed, onNavigate }: { to: string; icon: string; label: string; collapsed: boolean; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/app' && pathname.startsWith(to));
  return (
    <Link to={to} onClick={onNavigate} title={collapsed ? label : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)',
      color: active ? 'var(--brand)' : 'var(--text-secondary)', background: active ? 'var(--status-progress-bg)' : 'transparent',
      textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 500, marginBottom: 2,
    }}>
      <Icon name={icon} /> {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function TopBar({ onMenu, isMobile }: { onMenu: () => void; isMobile: boolean }) {
  const { theme, toggle } = useTheme();
  const { unreadCount } = useNotifications();
  const { setOpen } = useCommandPalette();
  const { user, logout } = useAuth();
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      {isMobile && <button onClick={onMenu} aria-label="Menu" style={iconBtn}><Icon name="Menu" /></button>}
      <button onClick={() => setOpen(true)} style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
        <Icon name="Search" size={16} /> <span>Search or ⌘K…</span>
      </button>
      <div style={{ flex: 1 }} />
      <button onClick={toggle} aria-label="Toggle theme" style={iconBtn}><Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={18} /></button>
      <button aria-label="Notifications" style={{ ...iconBtn, position: 'relative' }}>
        <Icon name="Bell" size={18} />
        {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--status-danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unreadCount}</span>}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user && <Avatar name={user.fullName} src={user.avatarUrl} size={32} />}
        {!isMobile && user && <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{user.fullName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.role}</div></div>}
        <button onClick={logout} aria-label="Log out" style={iconBtn}><Icon name="LogOut" size={16} /></button>
      </div>
    </header>
  );
}

const iconBtn: React.CSSProperties = { width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' };

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span style={{ margin: '0 6px' }}>/</span>}<span style={{ textTransform: 'capitalize' }}>{p}</span></span>
      ))}
    </nav>
  );
}
