/**
 * KVJ Analytics — Login experience (Phase-1 §3)
 * Premium, responsive, dark-mode-aware. Mock auth only. Includes forgot/reset
 * views + quick demo-role logins (satisfies the role-switching demonstration).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Button } from '../../../shared/ui/components';
import { AppError } from '../../../core/result';

type View = 'login' | 'forgot' | 'reset';
const DEMO = [
  { label: 'Admin', email: 'admin@kvj.test' },
  { label: 'CEO', email: 'ceo@kvj.test' },
  { label: 'Manager', email: 'manager@kvj.test' },
  { label: 'Employee', email: 'employee@kvj.test' },
];

export function LoginPage() {
  const { login, requestPasswordReset } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo1234');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogin = async (asEmail?: string) => {
    setError(null); setBusy(true);
    try {
      await login({ email: asEmail ?? email, password: asEmail ? 'demo1234' : password, rememberMe: remember });
      navigate('/app');
    } catch (e) {
      setError(e instanceof AppError ? e.message : 'Login failed.');
    } finally { setBusy(false); }
  };

  const doForgot = async () => {
    setBusy(true);
    await requestPasswordReset(email);
    setInfo('If that email exists, a reset link has been sent.');
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', background: 'var(--app-canvas, var(--bg-app))', color: 'var(--text-primary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', placeItems: 'center', padding: 24 }}>
        <div style={{ width: 'min(400px, 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--brand), var(--accent))', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>K</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>KVJ Analytics</span>
            </div>
            <button onClick={toggle} aria-label="Toggle theme" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer' }}>{theme === 'dark' ? '☀' : '☾'}</button>
          </div>

          <div className="kvj-card"><div className="kvj-card__body" style={{ padding: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
              {view === 'login' ? 'Welcome back' : view === 'forgot' ? 'Reset your password' : 'Set a new password'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 20px' }}>
              {view === 'login' ? 'Sign in to your workspace.' : view === 'forgot' ? "We'll email you a reset link." : 'Choose a strong password.'}
            </p>

            {error && <div role="alert" style={banner('var(--status-danger-bg)', 'var(--status-danger)')}>{error}</div>}
            {info && <div style={banner('var(--status-success-bg)', 'var(--status-success)')}>{info}</div>}

            {view !== 'reset' && (
              <label style={fieldWrap}><span style={lbl}>Email</span>
                <input className="kvj-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kvj.test" />
              </label>
            )}
            {view === 'login' && (
              <label style={fieldWrap}><span style={lbl}>Password</span>
                <input className="kvj-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {view === 'reset' && (
              <label style={fieldWrap}><span style={lbl}>New password</span>
                <input className="kvj-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}

            {view === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 18px' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                </label>
                <button onClick={() => { setView('forgot'); setError(null); }} style={linkBtn}>Forgot password?</button>
              </div>
            )}

            <Button onClick={() => (view === 'login' ? doLogin() : view === 'forgot' ? doForgot() : setView('login'))} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Please wait…' : view === 'login' ? 'Sign in' : view === 'forgot' ? 'Send reset link' : 'Update password'}
            </Button>

            {view !== 'login' && <button onClick={() => { setView('login'); setInfo(null); setError(null); }} style={{ ...linkBtn, display: 'block', margin: '14px auto 0' }}>← Back to sign in</button>}

            {view === 'login' && (
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Demo sign-in (mock — role switching):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DEMO.map((d) => (
                    <button key={d.email} onClick={() => doLogin(d.email)} disabled={busy}
                      className="kvj-btn kvj-btn--secondary kvj-btn--sm" style={{ justifyContent: 'center' }}>{d.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div></div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>Phase-1 preview · mock authentication · no backend connected</p>
        </div>
      </div>
    </div>
  );
}

const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--brand)', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 };
const banner = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 });

/** Standalone status screens routed separately. */
export function SessionExpired() {
  return <StatusScreen icon="⏳" title="Session expired" message="For your security, you've been signed out. Please sign in again." cta="Sign in" />;
}
export function LockedAccount() {
  return <StatusScreen icon="🔒" title="Account temporarily locked" message="Too many failed attempts. Try again shortly or contact an administrator." cta="Back to sign in" />;
}
function StatusScreen({ icon, title, message, cta }: { icon: string; title: string; message: string; cta: string }) {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40 }}>{icon}</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '10px 0 6px' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 18 }}>{message}</p>
        <Button onClick={() => navigate('/login')}>{cta}</Button>
      </div>
    </div>
  );
}
