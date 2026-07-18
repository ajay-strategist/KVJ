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

/** Route-level loading fallback (Suspense). */
export function RouteLoading() {
  return (
    <div style={{ padding: 32, maxWidth: 1440, margin: '0 auto' }}>
      <Skeleton width={220} height={28} style={{ marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={110} radius={16} />)}
      </div>
      <Skeleton height={320} radius={16} />
    </div>
  );
}
