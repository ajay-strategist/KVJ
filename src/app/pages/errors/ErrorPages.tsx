/**
 * KVJ Analytics — Error & status pages (Phase-1 §11)
 * Branded 404 / 403 / 500 / Offline / loading — never blank screens.
 */

import { Link } from 'react-router-dom';
import { Button, Skeleton } from '../../../shared/ui/components';

function Shell({ code, title, message, children }: { code?: string; title: string; message: string; children?: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {code && <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, var(--brand), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{code}</div>}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>{message}</p>
        {children ?? <Link to="/app"><Button>Back to workspace</Button></Link>}
      </div>
    </div>
  );
}

export function NotFound() {
  return <Shell code="404" title="Page not found" message="The page you're looking for doesn't exist or has moved." />;
}
export function Forbidden() {
  return <Shell code="403" title="Access denied" message="You don't have permission to view this page. Contact an administrator if you believe this is a mistake." />;
}
export function ServerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Shell code="500" title="Something went wrong" message="An unexpected error occurred. You can retry, or head back to your workspace.">
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
        <Link to="/app"><Button variant="secondary">Go home</Button></Link>
      </div>
    </Shell>
  );
}
export function Offline() {
  return <Shell title="You're offline" message="Check your connection. The app will reconnect automatically when you're back online." />;
}

/** Route-level loading fallback (Suspense / Splash Screen). */
export function RouteLoading() {
  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-app)',
      color: 'var(--text-primary)',
      animation: 'kvjFadeIn 350ms cubic-bezier(0.16, 1, 0.3, 1)',
      padding: 32,
    }}>
      <style>{`
        @keyframes kvjFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <img src="/logo.png" alt="Nexus Logo" style={{ height: 48, width: 'auto', marginBottom: 16 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>Nexus</h2>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>by KVJ</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)', marginTop: 4, letterSpacing: '0.05em' }}>
        Connect. Manage. Transform.
      </div>
      <div style={{ marginTop: 24, width: 180 }}>
        <Skeleton height={4} radius={999} />
      </div>
    </div>
  );
}
