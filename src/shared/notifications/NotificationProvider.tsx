/**
 * KVJ Analytics — Notification framework (Prompt 5/9, Prompt 4 §13)
 * Layer: Shared. Toasts + in-app notification store (badge, unread, drawer,
 * priority, grouping, actions). Modules PUBLISH; this decides delivery. Phase-1
 * mock service seeds/streams notifications; a real service swaps in later.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eventBus } from '../../core/event-bus';
import { useAuth } from '../../modules/auth/AuthProvider';
import { supabase } from '../integration/supabase';

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

let sharedAudioCtx: AudioContext | null = null;
const playedMessageIds = new Set<string>();

function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Unlock Web Audio context on user gesture anywhere in document
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
}

export function playNotificationSound() {
  playChatNotificationSound();
}

/**
 * High-fidelity, pleasant dual-tone chime (E5 -> B5) with exponential decay
 * Deduplicates per messageId so simultaneous listeners don't echo.
 */
export function playChatNotificationSound(messageId?: string) {
  if (messageId) {
    if (playedMessageIds.has(messageId)) return;
    playedMessageIds.add(messageId);
    setTimeout(() => playedMessageIds.delete(messageId), 10000);
  }

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // First note (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, t);
    gain1.gain.setValueAtTime(0.14, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Second note (B5 - 987.77 Hz, slightly delayed for a bright musical ping)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, t + 0.10);
    gain2.gain.setValueAtTime(0.15, t + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.10);
    osc2.stop(t + 0.32);
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

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const item: Toast = { id: uid(), durationMs: 4000, ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs) setTimeout(() => dismissToast(item.id), item.durationMs);
  }, [dismissToast]);

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

  // ── Global Realtime listener for incoming chat messages across the entire ERP ──
  useEffect(() => {
    if (!user?.id) return;

    const channelSub = supabase
      .channel(`global-chat-listener-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flwdsk_chat_messages' },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg || !newMsg.channel_id || newMsg.sender_id === user.id) return;

          try {
            // Check if user is a member/participant of this channel
            const { data: ch } = await supabase
              .from('flwdsk_chat_channels')
              .select('id, name, type, members')
              .eq('id', newMsg.channel_id)
              .single();

            if (!ch) return;

            const isMember = Array.isArray(ch.members)
              ? ch.members.includes(user.id)
              : ch.type !== 'direct'; // legacy/public channels

            if (!isMember) return;

            // Check if channel is muted by this user
            let isMuted = false;
            try {
              const savedPrefs = localStorage.getItem(`kvj_chat_muted_${user.id}`);
              if (savedPrefs) {
                const mutedList = JSON.parse(savedPrefs);
                if (Array.isArray(mutedList) && mutedList.includes(ch.id)) isMuted = true;
              }
            } catch {}

            // 1. Play incoming message chime!
            if (!isMuted) {
              playChatNotificationSound(newMsg.id);
            }

            // 2. Query sender name for personalized alert
            const { data: sender } = await supabase
              .from('flwdsk_employees')
              .select('first_name, last_name')
              .eq('id', newMsg.sender_id)
              .single();

            const senderName = sender ? `${sender.first_name} ${sender.last_name}` : 'A colleague';
            const chatTitle = ch.type === 'direct' ? senderName : (ch.name ? `#${ch.name}` : 'Team Chat');

            // 3. Trigger visible Toast Alert
            toast({
              variant: 'info',
              title: `💬 ${chatTitle}`,
              message: `${senderName}: ${newMsg.text || 'Sent an attachment'}`,
              durationMs: 4500,
            });

            // 4. Add to Notification Center (bell icon drawer)
            addNotification({
              title: `New message in ${chatTitle}`,
              message: `${senderName}: ${newMsg.text || 'Sent an attachment'}`,
              category: 'chat',
              priority: 'normal',
            });

            // 5. Increment unread count in localStorage
            try {
              const saved = localStorage.getItem('kvj_chat_unread_counts');
              const counts = saved ? JSON.parse(saved) : {};
              counts[newMsg.channel_id] = (counts[newMsg.channel_id] || 0) + 1;
              localStorage.setItem('kvj_chat_unread_counts', JSON.stringify(counts));
            } catch {}

            // 6. Broadcast across tabs so open chat windows update immediately
            if (typeof window !== 'undefined' && (window as any).BroadcastChannel) {
              try {
                const bc = new BroadcastChannel('kvj-chat-sync');
                bc.postMessage({ type: 'message_updated', channelId: newMsg.channel_id });
                bc.close();
              } catch {}
            }
          } catch (e) {
            console.warn('Chat notification error:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [user?.id, toast, addNotification]);

  const markRead = useCallback((id: string) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => setItems((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const dismissNotification = useCallback((id: string) => setItems((prev) => prev.filter((n) => n.id !== id)), []);


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
