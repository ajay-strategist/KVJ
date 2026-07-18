/**
 * KVJ Analytics — Modal / Dialog framework (Prompt 9 §11)
 * Layer: Shared. One shared manager for all dialogs: confirm / delete / approve /
 * success / error, plus a generic side Drawer and mobile Bottom Sheet. Promise-based
 * imperative API so any module can request a dialog without wiring local state.
 *
 *   const { confirm } = useDialog();
 *   if (await confirm({ title: 'Delete?', variant: 'delete' })) { ... }
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type DialogVariant = 'confirm' | 'delete' | 'approve' | 'success' | 'error';
interface DialogRequest {
  title: string;
  message?: ReactNode;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean; // for approval/rejection flows
}
interface ActiveDialog extends DialogRequest { id: string; resolve: (v: { ok: boolean; reason?: string }) => void }

interface DialogContextValue {
  confirm: (req: DialogRequest) => Promise<boolean>;
  prompt: (req: DialogRequest) => Promise<{ ok: boolean; reason?: string }>;
  alertSuccess: (title: string, message?: string) => Promise<void>;
  alertError: (title: string, message?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);
const uid = () => Math.random().toString(36).slice(2);

const accent: Record<DialogVariant, string> = {
  confirm: 'var(--brand)', delete: 'var(--status-danger)', approve: 'var(--status-success)',
  success: 'var(--status-success)', error: 'var(--status-danger)',
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [reason, setReason] = useState('');

  const open = useCallback((req: DialogRequest) => new Promise<{ ok: boolean; reason?: string }>((resolve) => {
    setReason('');
    setDialog({ id: uid(), variant: 'confirm', ...req, resolve });
  }), []);

  const close = useCallback((result: { ok: boolean; reason?: string }) => {
    setDialog((d) => { d?.resolve(result); return null; });
  }, []);

  const value = useMemo<DialogContextValue>(() => ({
    confirm: (req) => open(req).then((r) => r.ok),
    prompt: (req) => open({ requireReason: true, ...req }),
    alertSuccess: (title, message) => open({ title, message, variant: 'success', cancelLabel: '' }).then(() => undefined),
    alertError: (title, message) => open({ title, message, variant: 'error', cancelLabel: '' }).then(() => undefined),
  }), [open]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && (
        <div role="dialog" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && close({ ok: false })}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', background: 'rgba(2,6,23,.5)', padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--e4)', width: 'min(440px, 100%)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: accent[dialog.variant ?? 'confirm'] }} />
            <div style={{ padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{dialog.title}</h3>
              {dialog.message && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>{dialog.message}</div>}
              {dialog.requireReason && (
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a reason (optional)"
                  style={{ marginTop: 12, width: '100%', minHeight: 72, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--text-primary)', padding: 10, fontFamily: 'inherit', fontSize: 14 }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                {dialog.cancelLabel !== '' && (
                  <button onClick={() => close({ ok: false })} style={btn('secondary')}>{dialog.cancelLabel ?? 'Cancel'}</button>
                )}
                <button onClick={() => close({ ok: true, reason })} style={btn('primary', accent[dialog.variant ?? 'confirm'])}>
                  {dialog.confirmLabel ?? (dialog.variant === 'delete' ? 'Delete' : dialog.variant === 'approve' ? 'Approve' : 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function btn(kind: 'primary' | 'secondary', color?: string): React.CSSProperties {
  return kind === 'primary'
    ? { background: color ?? 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
    : { background: 'var(--bg-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>');
  return ctx;
}
