/**
 * KVJ Analytics — Application Shell (Prompt 5/9 §2)
 * Layer: Shared. Responsive shell = collapsible sidebar + top bar (search,
 * notifications, theme, profile) + breadcrumbs + content container. Consumes the
 * navigation engine, permission engine, theme, notifications and command palette.
 * Contains NO business logic — modules render into {children}.
 */

import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { visibleNav, useNavPrefs } from '../navigation/navigation';
import { usePermissions } from '../permissions/react';
import { useAuth } from '../../modules/auth/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { useNotifications } from '../notifications/NotificationProvider';
import { useCommandPalette } from '../search/CommandPaletteProvider';
import { useDevice } from '../hooks/responsive';
import { Avatar } from '../ui/components';
import { appConfig } from '../../config/app-config';

// Inline SVG icons — deliberately dependency-free. Importing an icon library
// (e.g. lucide-react) into the always-mounted shell risks the Vite dev server
// serving hundreds of icon modules and blocking the main thread. Keeping the
// shell's icons inline guarantees /login and /app stay fast in dev and prod.
const ICON_PATHS: Record<string, string> = {
  Home: 'M3 11l9-8 9 8M5 10v10h14V10',
  LayoutDashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 14h8v7H3z',
  Users: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  Clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  CalendarDays: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 3v4M16 3v4',
  CheckSquare: 'M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  GraduationCap: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 3 2 6 2s6-1 6-2v-5',
  FolderKanban: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  Receipt: 'M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1zM8 7h8M8 11h8',
  MessageSquare: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  BarChart3: 'M3 3v18h18M8 17v-5M13 17V9M18 17v-8',
  Settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1L9.5 21h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z',
  ChevronLeft: 'M15 18l-6-6 6-6',
  ChevronRight: 'M9 18l6-6-6-6',
  Menu: 'M3 6h18M3 12h18M3 18h18',
  Search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  Bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  Sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  Moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  LogOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  Circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const d = ICON_PATHS[name] ?? ICON_PATHS.Circle;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
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
