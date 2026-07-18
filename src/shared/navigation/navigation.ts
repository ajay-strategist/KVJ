/**
 * KVJ Analytics — Navigation engine (Prompt 5/9 §3)
 * Layer: Shared. Role/permission-aware nav model + user prefs (favorites,
 * pinned, recent) persisted locally. Feature-flag gated so modules appear as
 * they ship. No business logic — just the menu model.
 */

import { useCallback, useState } from 'react';
import type { Action, Resource } from '../permissions/permissions';
import { featureFlags, type FeatureFlags } from '../../config/feature-flags';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;               // lucide icon name (resolved in the Sidebar)
  permission?: [Resource, Action];
  module?: keyof FeatureFlags['modules'];
  children?: NavItem[];
}

/** The full navigation tree. Items are filtered by permission + feature flag. */
export const NAV_TREE: NavItem[] = [
  { id: 'my-day', label: 'My Day', path: '/app', icon: 'Home' },
  { id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard', permission: ['dashboard', 'view'] },
  { id: 'employees', label: 'Employees', path: '/app/employees', icon: 'Users', permission: ['employee', 'view'], module: 'employee' },
  { id: 'attendance', label: 'Attendance', path: '/app/attendance', icon: 'Clock', permission: ['attendance', 'view'], module: 'attendance' },
  { id: 'leave', label: 'Leave', path: '/app/leave', icon: 'CalendarDays', permission: ['leave', 'view'], module: 'leave' },
  { id: 'approvals', label: 'Approvals Queue', path: '/app/approvals', icon: 'CheckSquare', permission: ['leave', 'approve'] },
  { id: 'training-courses', label: 'Courses Catalog', path: '/app/training/courses', icon: 'BookOpen', permission: ['training', 'view'], module: 'training' },
  { id: 'training-batches', label: 'Batches', path: '/app/training/batches', icon: 'Layers', permission: ['training', 'view'], module: 'training' },
  { id: 'training-students', label: 'Student Lifecycle', path: '/app/training/students', icon: 'GraduationCap', permission: ['training', 'view'], module: 'training' },
  { id: 'training-attendance', label: 'Session Attendance', path: '/app/training/attendance', icon: 'CheckSquare', permission: ['training', 'view'], module: 'training' },
  { id: 'training-assessments', label: 'Assessments & Vouchers', path: '/app/training/assessments', icon: 'Award', permission: ['training', 'view'], module: 'training' },


  { id: 'project-clients', label: 'Clients Master', path: '/app/project/clients', icon: 'Briefcase', permission: ['project', 'view'], module: 'project' },
  { id: 'project-list', label: 'Project Catalog', path: '/app/project/list', icon: 'FolderKanban', permission: ['project', 'view'], module: 'project' },
  { id: 'project-resources', label: 'Resource Scheduler', path: '/app/project/resources', icon: 'CalendarDays', permission: ['project', 'view'], module: 'project' },
  { id: 'project-tasks', label: 'Task Board', path: '/app/project/tasks', icon: 'Trello', permission: ['project', 'view'], module: 'project' },
  { id: 'project-timesheets', label: 'Timesheets Tracker', path: '/app/project/timesheets', icon: 'Clock', permission: ['project', 'view'], module: 'project' },

  { id: 'finance-expenses', label: 'Expenses & Travel', path: '/app/finance/expenses', icon: 'Receipt', permission: ['expense', 'view'], module: 'finance' },
  { id: 'finance-procurement', label: 'Procurement Board', path: '/app/finance/procurement', icon: 'ShoppingCart', permission: ['expense', 'view'], module: 'finance' },
  { id: 'finance-assets', label: 'Asset Inventory', path: '/app/finance/assets', icon: 'Package', permission: ['expense', 'view'], module: 'finance' },
  { id: 'finance-budgets', label: 'Budgets Console', path: '/app/finance/budgets', icon: 'Calculator', permission: ['expense', 'view'], module: 'finance' },
  { id: 'finance-payroll', label: 'Payroll Prep', path: '/app/finance/payroll', icon: 'Coins', permission: ['expense', 'view'], module: 'finance' },

  { id: 'comm-chat', label: 'Chat Rooms', path: '/app/communication/chat', icon: 'MessageSquare', permission: ['chat', 'view'], module: 'communication' },
  { id: 'comm-announcements', label: 'Announcements Board', path: '/app/communication/announcements', icon: 'Megaphone', permission: ['chat', 'view'], module: 'communication' },
  { id: 'comm-emails', label: 'Email Center', path: '/app/communication/emails', icon: 'Mail', permission: ['chat', 'view'], module: 'communication' },
  { id: 'comm-reminders', label: 'Reminders Center', path: '/app/communication/reminders', icon: 'Bell', permission: ['chat', 'view'], module: 'communication' },

  { id: 'analytics-exec', label: 'Executive Console', path: '/app/analytics/executive', icon: 'BarChart3', permission: ['analytics', 'view'], module: 'analytics' },
  { id: 'analytics-builder', label: 'Report Builder', path: '/app/analytics/builder', icon: 'LayoutGrid', permission: ['analytics', 'view'], module: 'analytics' },
  { id: 'analytics-kpis', label: 'KPI Registry', path: '/app/analytics/kpis', icon: 'LineChart', permission: ['analytics', 'view'], module: 'analytics' },
  { id: 'analytics-powerbi', label: 'Power BI Gateway', path: '/app/analytics/powerbi', icon: 'Cpu', permission: ['analytics', 'view'], module: 'analytics' },

  { id: 'settings', label: 'Settings', path: '/app/settings', icon: 'Settings', permission: ['settings', 'view'] },
];

/** Filter the tree by (a) feature flags and (b) a permission predicate. */
export function visibleNav(canFn: (r: Resource, a: Action) => boolean): NavItem[] {
  const keep = (item: NavItem): boolean => {
    if (item.module && !featureFlags.modules[item.module]) return false;
    if (item.permission && !canFn(item.permission[0], item.permission[1])) return false;
    return true;
  };
  return NAV_TREE.filter(keep).map((i) => ({ ...i, children: i.children?.filter(keep) }));
}

// ── User nav preferences (favorites / pinned / recent) ───────────────────────
const PREFS_KEY = 'kvj.nav.prefs';
interface NavPrefs { favorites: string[]; pinned: string[]; recent: string[] }
const load = (): NavPrefs => JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{"favorites":[],"pinned":[],"recent":[]}');

export function useNavPrefs() {
  const [prefs, setPrefs] = useState<NavPrefs>(load);
  const save = useCallback((next: NavPrefs) => { setPrefs(next); localStorage.setItem(PREFS_KEY, JSON.stringify(next)); }, []);

  const toggleFavorite = useCallback((id: string) =>
    save({ ...prefs, favorites: prefs.favorites.includes(id) ? prefs.favorites.filter((x) => x !== id) : [...prefs.favorites, id] }), [prefs, save]);
  const togglePinned = useCallback((id: string) =>
    save({ ...prefs, pinned: prefs.pinned.includes(id) ? prefs.pinned.filter((x) => x !== id) : [...prefs.pinned, id] }), [prefs, save]);
  const pushRecent = useCallback((id: string) =>
    save({ ...prefs, recent: [id, ...prefs.recent.filter((x) => x !== id)].slice(0, 6) }), [prefs, save]);

  return { prefs, toggleFavorite, togglePinned, pushRecent };
}
