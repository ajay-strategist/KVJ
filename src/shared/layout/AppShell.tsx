/**
 * KVJ Analytics — Application Shell v2 (Phase 2 Enterprise Upgrade)
 * Improvements:
 *  - Notification panel with category tabs, per-category badges, grouped view
 *  - Chat icon in TopBar with unread badge
 *  - User dropdown (role pill, settings, logout)
 *  - Improved breadcrumbs (clickable links)
 *  - Refined sidebar (sub-group labels, smooth collapse, better active state)
 *  - Mobile overlay improved
 */

import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, NavLink as RRNavLink, useLocation, useNavigate } from 'react-router-dom';
import { visibleNav, useNavPrefs } from '../navigation/navigation';
import { usePermissions } from '../permissions/react';
import { useAuth } from '../../modules/auth/AuthProvider';
import { useTheme, THEME_LABELS } from '../theme/ThemeProvider';
import { useNotifications } from '../notifications/NotificationProvider';
import { useCommandPalette } from '../search/CommandPaletteProvider';
import { useDevice } from '../hooks/responsive';
import { Avatar, Badge } from '../ui/components';
import { appConfig } from '../../config/app-config';

// ── Inline icons (no icon library import in shell for bundle performance) ──
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
  Settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14',
  BookOpen: 'M12 7v14M3 5h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H3zM21 5h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H21z',
  Layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  Award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  Briefcase: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  Trello: 'M3 3h18v18H3zM7 7h4v10H7zM13 7h6v6h-6z',
  Megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l7 4V6l-7 4H4a1 1 0 0 0-1 1zM18 9a3 3 0 0 1 0 6',
  Gauge: 'M12 21a9 9 0 1 0-9-9M3 12h2M12 21a9 9 0 0 0 9-9h-2M12 12l4.5-4.5',
  ChevronLeft: 'M15 18l-6-6 6-6',
  ChevronRight: 'M9 18l6-6-6-6',
  ChevronDown: 'M6 9l6 6 6-6',
  Menu: 'M3 6h18M3 12h18M3 18h18',
  Search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  Bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  Sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  Moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  LogOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  Circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  X: 'M18 6 6 18M6 6l12 12',
  Check: 'M20 6 9 17l-5-5',
  CheckCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  AlertCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
  Info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  User: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  Star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const d = ICON_PATHS[name] ?? ICON_PATHS.Circle;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** Prevents double shell when pages nest inside each other */
const InsideShellContext = createContext(false);

export function AppShell({ children }: { children: ReactNode }) {
  const alreadyInsideShell = useContext(InsideShellContext);
  if (alreadyInsideShell) return <>{children}</>;
  return <AppShellFrame>{children}</AppShellFrame>;
}

// ── NOTIFICATION CATEGORIES ──────────────────────────────────────────────────
const NOTIF_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'training', label: 'Training' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'leave', label: 'Leave' },
  { key: 'chats', label: 'Chats' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── FRAME ────────────────────────────────────────────────────────────────────
function AppShellFrame({ children }: { children: ReactNode }) {
  const device = useDevice();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCategory, setNotifCategory] = useState('all');

  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { can } = usePermissions();
  const { pushRecent } = useNavPrefs();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { items: notifItems, unreadCount, markRead, markAllRead } = useNotifications();
  const { setOpen: setCmdOpen } = useCommandPalette();
  const navigate = useNavigate();

  const items = visibleNav(can);
  const isMobile = device === 'mobile';
  const width = collapsed && !isMobile ? 68 : 256;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredNotifs = notifCategory === 'all'
    ? notifItems
    : notifItems.filter((n) => (n as any).category?.toLowerCase() === notifCategory);

  return (
    <InsideShellContext.Provider value={true}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-canvas, var(--bg-app))', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>

        {/* ── Sidebar ── */}
        {(!isMobile || mobileOpen) && (
          <aside style={{
            width,
            flexShrink: 0,
            background: 'var(--bg-surface)',
            border: 'var(--glass-border, 1px solid var(--border))',
            borderRadius: isMobile ? 0 : 'var(--radius-xl)',
            backdropFilter: 'blur(var(--glass-blur, 24px))',
            WebkitBackdropFilter: 'blur(var(--glass-blur, 24px))',
            boxShadow: 'var(--e2)',
            display: 'flex',
            flexDirection: 'column',
            position: isMobile ? 'fixed' : 'sticky',
            top: isMobile ? 0 : 16,
            left: isMobile ? 0 : undefined,
            height: isMobile ? '100vh' : 'calc(100vh - 32px)',
            margin: isMobile ? 0 : '16px 0 16px 16px',
            zIndex: 1100,
            transition: 'width 280ms cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}>

            {/* Logo & Product Branding */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              padding: collapsed && !isMobile ? '14px 8px' : '14px 16px',
              borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 10, overflow: 'hidden'
            }}>
              <img
                src="/logo.png"
                alt="Nexus by KVJ Logo"
                style={{
                  height: collapsed && !isMobile ? 28 : 34,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  flexShrink: 0
                }}
              />
              {(!collapsed || isMobile) && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                      Nexus
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                      by KVJ
                    </span>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--brand)', letterSpacing: '0.03em', marginTop: 2 }}>
                    Connect. Manage. Transform.
                  </span>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
              {items.map((item) => (
                <SideNavLink
                  key={item.id}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed && !isMobile}
                  onNavigate={() => { pushRecent(item.id); setMobileOpen(false); }}
                />
              ))}
            </nav>

            {/* ── Left Sidebar Bottom Toolbar & User Profile ── */}
            <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              
              {/* Toolbar Actions Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: collapsed && !isMobile ? '1fr' : 'repeat(4, 1fr)',
                gap: 6,
                alignItems: 'center'
              }}>
                {/* Theme Toggle */}
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={`Theme: ${THEME_LABELS[theme]}`}
                  title={`Theme: ${THEME_LABELS[theme]}`}
                  style={sidebarIconBtnStyle}
                >
                  <Icon name={theme === 'dark' || theme === 'hud' ? 'Moon' : 'Sun'} size={15} />
                </button>

                {/* Notifications Bell */}
                <div ref={notifRef} style={{ flex: 1, position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setNotifOpen((o) => !o)}
                    aria-label={`Notifications (${unreadCount} unread)`}
                    title={`Notifications (${unreadCount} unread)`}
                    style={{ ...sidebarIconBtnStyle, width: '100%', position: 'relative' }}
                  >
                    <Icon name="Bell" size={15} />
                    {unreadCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        minWidth: 14, height: 14, padding: '0 3px',
                        borderRadius: 999, background: 'var(--status-danger)',
                        color: '#fff', fontSize: 8.5, fontWeight: 800,
                        display: 'grid', placeItems: 'center', lineHeight: 1,
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover */}
                  {notifOpen && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                      width: 320, maxHeight: 460,
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: 'var(--e3)',
                      zIndex: 1250, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      animation: 'kvjSlideInUp 180ms cubic-bezier(0.16,1,0.3,1)',
                    }}>
                      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={markAllRead}
                              style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                          {NOTIF_CATEGORIES.map((cat) => {
                            const cnt = cat.key === 'all'
                              ? notifItems.filter((n) => !n.read).length
                              : notifItems.filter((n) => !n.read && (n as any).category?.toLowerCase() === cat.key).length;
                            return (
                              <button
                                key={cat.key}
                                type="button"
                                onClick={() => setNotifCategory(cat.key)}
                                style={{
                                  flexShrink: 0, padding: '3px 8px', borderRadius: 999,
                                  fontSize: 10.5, fontWeight: 600,
                                  border: notifCategory === cat.key ? '1px solid rgba(59,130,246,0.40)' : '1px solid var(--border)',
                                  background: notifCategory === cat.key ? 'var(--brand-muted)' : 'transparent',
                                  color: notifCategory === cat.key ? 'var(--brand)' : 'var(--text-muted)',
                                  cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center',
                                }}
                              >
                                {cat.label}
                                {cnt > 0 && (
                                  <span style={{ background: 'var(--status-danger)', color: '#fff', borderRadius: 999, fontSize: 8.5, padding: '0 4px', fontWeight: 800 }}>
                                    {cnt}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '6px' }}>
                        {filteredNotifs.length === 0 ? (
                          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            No notifications
                          </div>
                        ) : (
                          filteredNotifs.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => markRead(item.id)}
                              style={{
                                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                                background: item.read ? 'transparent' : 'var(--bg-hover)',
                                borderLeft: item.read ? '3px solid transparent' : '3px solid var(--brand)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: item.read ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                  {item.title}
                                </span>
                                <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {(item as any).createdAt ? timeAgo((item as any).createdAt) : ''}
                                </span>
                              </div>
                              {item.message && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  {item.message}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Button */}
                <button
                  type="button"
                  onClick={() => navigate('/app/communication/chat')}
                  aria-label="Chat"
                  title="Chat"
                  style={sidebarIconBtnStyle}
                >
                  <Icon name="MessageSquare" size={15} />
                </button>

                {/* Search Button */}
                <button
                  type="button"
                  onClick={() => setCmdOpen(true)}
                  aria-label="Search (⌘K)"
                  title="Search (⌘K)"
                  style={sidebarIconBtnStyle}
                >
                  <Icon name="Search" size={15} />
                </button>
              </div>

              {/* User Profile Pill Button */}
              <div ref={userRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 9px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-sunken)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 160ms, border-color 160ms',
                  }}
                >
                  {user && <Avatar name={user.fullName} src={user.avatarUrl} size={30} />}
                  {(!collapsed || isMobile) && user && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.fullName}
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{user.role}</div>
                    </div>
                  )}
                  {(!collapsed || isMobile) && <Icon name="ChevronUp" size={13} />}
                </button>

                {/* Profile Dropdown Menu */}
                {userOpen && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                    width: 220,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--e3)',
                    zIndex: 1250, overflow: 'hidden',
                    animation: 'kvjSlideInUp 180ms cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {user && <Avatar name={user.fullName} src={user.avatarUrl} size={34} />}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.fullName}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            <span style={{ background: 'var(--brand-muted)', color: 'var(--brand)', padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>
                              {user?.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 6 }}>
                      {[
                        { icon: 'User', label: 'My Profile', action: () => { navigate('/app/employees'); setUserOpen(false); } },
                        { icon: 'Settings', label: 'Settings', action: () => { navigate('/app/settings'); setUserOpen(false); } },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.action}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', border: 'none', background: 'transparent',
                            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-ui)',
                          }}
                        >
                          <Icon name={item.icon} size={14} />
                          {item.label}
                        </button>
                      ))}
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <button
                        type="button"
                        onClick={() => { logout(); setUserOpen(false); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', border: 'none', background: 'transparent',
                          borderRadius: 'var(--radius-sm)', color: 'var(--status-danger)',
                          cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-ui)',
                        }}
                      >
                        <Icon name="LogOut" size={14} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Collapse toggle (desktop only) */}
            {!isMobile && (
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label="Toggle sidebar"
                style={{
                  margin: '0 10px 10px', padding: 7,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 180ms',
                  flexShrink: 0,
                }}
              >
                <Icon name={collapsed ? 'ChevronRight' : 'ChevronLeft'} size={14} />
              </button>
            )}
          </aside>
        )}

        {/* Mobile overlay */}
        {isMobile && mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(2,6,23,0.55)',
              backdropFilter: 'blur(8px)',
              zIndex: 1050,
            }}
          />
        )}

        {/* ── Main content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
          {isMobile && !mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              style={{
                position: 'fixed', top: 12, left: 12, zIndex: 1000,
                width: 38, height: 38, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-surface)',
                color: 'var(--text-primary)', boxShadow: 'var(--e2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="Menu" size={18} />
            </button>
          )}
          <main style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: isMobile ? '12px' : '16px 20px 36px 20px',
            maxWidth: '100%',
            width: '100%',
            margin: 0,
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}>
            {children}
            <footer style={{
              marginTop: 'auto',
              paddingTop: 24,
              paddingBottom: 8,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--text-secondary)',
              gap: 12
            }}>
              <div>
                <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>Nexus</span>{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>by KVJ</span>{' '}
                <span style={{ color: 'var(--border)', margin: '0 6px' }}>|</span>{' '}
                <span>Enterprise Operations Platform</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 11 }}>Connect. Manage. Transform.</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>© 2026 KVJ Analytics. All Rights Reserved.</span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </InsideShellContext.Provider>
  );
}

// ── Sidebar Nav Link ─────────────────────────────────────────────────────────
function SideNavLink({
  to, icon, label, collapsed, onNavigate,
}: {
  to: string; icon: string; label: string; collapsed: boolean; onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/app' && pathname.startsWith(to));
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '10px 0' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius-md)',
        color: active ? 'var(--brand)' : 'var(--text-secondary)',
        background: active
          ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.10))'
          : 'transparent',
        border: active ? '1px solid rgba(59,130,246,0.22)' : '1px solid transparent',
        boxShadow: active ? '0 2px 10px rgba(59,130,246,0.10)' : 'none',
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        marginBottom: 2,
        transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ flexShrink: 0, display: 'inline-flex' }}>
        <Icon name={icon} size={17} />
      </span>
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </Link>
  );
}

const sidebarIconBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-sunken)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 160ms',
};
