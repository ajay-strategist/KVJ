/**
 * KVJ Analytics — Notification framework (Prompt 5/9, Prompt 4 §13)
 * Layer: Shared. Toasts + in-app notification store (badge, unread, drawer,
 * priority, grouping, actions). Modules PUBLISH; this decides delivery. Phase-1
 * mock service seeds/streams notifications; a real service swaps in later.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory = 'system' | 'approval' | 'task' | 'training' | 'chat' | 'finance' | 'info';

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  createdAt: number;
  action?: { label: string; href?: string };
}

export interface Toast {
  id: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  durationMs?: number;
}

export interface INotificationService {
  list(): Promise<NotificationItem[]>;
}

/** Phase-1 mock: a few seeded items so the drawer/badge are demonstrable. */
export class MockNotificationService implements INotificationService {
  async list(): Promise<NotificationItem[]> {
    const t = Date.now();
    return [
      { id: 'n1', title: 'Nexus Notification: Welcome to Workspace', message: 'Your Nexus enterprise platform is ready.', category: 'system', priority: 'normal', read: false, createdAt: t - 60000 },
      { id: 'n2', title: 'Nexus Notification: Expense Approval Pending', message: 'An expense claim requires your management authorization.', category: 'approval', priority: 'high', read: false, createdAt: t - 3600000, action: { label: 'Review' } },
      { id: 'n3', title: 'Nexus Notification: Task Assigned', message: 'New project deliverable has been assigned to you.', category: 'task', priority: 'normal', read: false, createdAt: t - 7200000 },
    ];
  }
}

interface NotificationContextValue {
  items: NotificationItem[];
  unreadCount: number;
  grouped: Record<NotificationCategory, NotificationItem[]>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: { title: string; message?: string; category: NotificationCategory; priority?: NotificationPriority; recipientUserId?: string }) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const uid = () => Math.random().toString(36).slice(2);

const defaultNotificationService = new MockNotificationService();

export function NotificationProvider({ children, service = defaultNotificationService }: { children: ReactNode; service?: INotificationService }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => { service.list().then(setItems); }, [service]);

  const markRead = useCallback((id: string) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setItems((prev) => prev.map((n) => ({ ...n, read: true }))), []);

  const addNotification = useCallback((n: { title: string; message?: string; category: NotificationCategory; priority?: NotificationPriority; recipientUserId?: string }) => {
    const newItem: NotificationItem = {
      id: uid(),
      title: n.title,
      message: n.message,
      category: n.category,
      priority: n.priority || 'normal',
      read: false,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const item: Toast = { id: uid(), durationMs: 4000, ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs) setTimeout(() => dismissToast(item.id), item.durationMs);
  }, [dismissToast]);

  const value = useMemo<NotificationContextValue>(() => {
    const grouped = items.reduce((acc, n) => {
      (acc[n.category] ||= []).push(n);
      return acc;
    }, {} as Record<NotificationCategory, NotificationItem[]>);
    return {
      items, unreadCount: items.filter((n) => !n.read).length, grouped,
      markRead, markAllRead, addNotification, toasts, toast, dismissToast,
    };
  }, [items, toasts, markRead, markAllRead, addNotification, toast, dismissToast]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within <NotificationProvider>');
  return ctx;
}

/** Toast viewport (top-right, stacked). Styled via design tokens. */
function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const colors: Record<Toast['variant'], string> = {
    info: 'var(--status-info)', success: 'var(--status-success)', warning: 'var(--status-warning)', error: 'var(--status-danger)',
  };
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1300, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {toasts.map((t) => (
        <div key={t.id} role="status" style={{
          background: 'var(--bg-panel)', color: 'var(--text-primary)', border: '1px solid var(--border)',
          borderLeft: `3px solid ${colors[t.variant]}`, borderRadius: 'var(--radius-md)', boxShadow: 'var(--e3)',
          padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
            {t.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{t.message}</div>}
          </div>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  );
}
