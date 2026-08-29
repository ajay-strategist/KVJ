/**
 * KVJ Analytics — Notification framework (Prompt 5/9, Prompt 4 §13)
 * Layer: Shared. Toasts + in-app notification store (badge, unread, drawer,
 * priority, grouping, actions). Modules PUBLISH; this decides delivery. Phase-1
 * mock service seeds/streams notifications; a real service swaps in later.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eventBus } from '../../core/event-bus';
import { useAuth } from '../../modules/auth/AuthProvider';

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
    return [];
  }
}

interface NotificationContextValue {
  items: NotificationItem[];
  unreadCount: number;
  grouped: Record<NotificationCategory, NotificationItem[]>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  addNotification: (n: { title: string; message?: string; category: NotificationCategory; priority?: NotificationPriority; recipientUserId?: string }) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const uid = () => Math.random().toString(36).slice(2);

const defaultNotificationService = new MockNotificationService();

export function playNotificationSound() {
  playChatNotificationSound();
}

export function playChatNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First note (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Second note (B5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function NotificationProvider({ children, service = defaultNotificationService }: { children: ReactNode; service?: INotificationService }) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => { service.list().then(setItems); }, [service]);

  // Bridge: notifications sent through the NotificationEngine (e.g. task
  // approved / returned for rework) arrive here via the event bus. Show them in
  // the bell/panel only for the recipient who is currently signed in.
  useEffect(() => {
    const off = eventBus.on('notification.created', (n) => {
      if (!user || n.recipientId !== user.id) return;
      setItems((prev) => [
        {
          id: Math.random().toString(36).slice(2),
          title: n.title,
          message: n.body,
          category: n.category ?? 'info',
          priority: n.priority ?? 'normal',
          read: false,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      playChatNotificationSound();
    });
    return off;
  }, [user]);

  const markRead = useCallback((id: string) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setItems((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const dismissNotification = useCallback((id: string) => setItems((prev) => prev.filter((n) => n.id !== id)), []);

  const addNotification = useCallback((n: { title: string; message?: string; category: NotificationCategory; priority?: NotificationPriority; recipientUserId?: string }) => {
    // Skip if targeted recipient is not current user
    if (n.recipientUserId && user?.id && n.recipientUserId !== user.id) return;

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
    if (n.category === 'chat' || n.priority === 'urgent') {
      playChatNotificationSound();
    }
  }, [user]);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const item: Toast = { id: uid(), durationMs: 4000, ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs) setTimeout(() => dismissToast(item.id), item.durationMs);
    // Button click / toast feedback does NOT play sound
  }, [dismissToast]);

  const value = useMemo<NotificationContextValue>(() => {
    const grouped = items.reduce((acc, n) => {
      (acc[n.category] ||= []).push(n);
      return acc;
    }, {} as Record<NotificationCategory, NotificationItem[]>);
    return {
      items, unreadCount: items.filter((n) => !n.read).length, grouped,
      markRead, markAllRead, dismissNotification, addNotification, toasts, toast, dismissToast,
    };
  }, [items, toasts, markRead, markAllRead, dismissNotification, addNotification, toast, dismissToast]);

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
