/**
 * KVJ Analytics — Production Login Experience
 * Clean production authentication portal with mandatory first-time password reset workflow.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Button } from '../../../shared/ui/components';
import { AppError } from '../../../core/result';
import { InitialAdminBootstrapScreen } from './InitialAdminBootstrapScreen';

type View = 'login' | 'forgot' | 'first_time_reset';

export function LoginPage() {
  const { login, requestPasswordReset, updateUserPassword, hasUsers } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [bootstrapNeeded, setBootstrapNeeded] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);

  const [view, setView] = useState<View>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    hasUsers().then((exists) => {
      if (!active) return;
      setBootstrapNeeded(!exists);
      setCheckingBootstrap(false);
    });
    return () => { active = false; };
  }, [hasUsers]);

  if (checkingBootstrap) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Initializing system authentication...</div>
      </div>
    );
  }

  if (bootstrapNeeded) {
    return <InitialAdminBootstrapScreen onBootstrapSuccess={() => setBootstrapNeeded(false)} />;
  }

  const doLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username/email and password.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const session = await login({
        email: identifier.trim(),
        password: password.trim(),
        rememberMe: remember,
      });

      if (session.user.mustChangePassword) {
        setPendingUserId(session.user.id);
        setView('first_time_reset');
        setInfo('First-time login detected. Please create a new password to proceed.');
      } else {
        navigate('/app');
      }
    } catch (e) {
      setError(e instanceof AppError ? e.message : 'Invalid username/email or password.');
    } finally {
      setBusy(false);
    }
  };

  const handleFirstTimeReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword === 'password') {
      setError('Please choose a password different from the default "password".');
      return;
    }

    if (!pendingUserId) {
      setError('Session missing. Please log in again.');
      setView('login');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await updateUserPassword(pendingUserId, newPassword);
      setInfo('Password successfully updated! Redirecting to workspace...');
      setTimeout(() => {
        navigate('/app');
      }, 600);
    } catch (e) {
      setError(e instanceof AppError ? e.message : 'Failed to update password.');
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    if (!identifier.trim()) {
      setError('Please enter your email or username.');
      return;
    }
    setBusy(true);
    await requestPasswordReset(identifier);
    setInfo('If that email/username exists, a reset link has been sent.');
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', background: 'var(--app-canvas, var(--bg-app))', color: 'var(--text-primary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', placeItems: 'center', padding: 24 }}>
        <div style={{ width: 'min(420px, 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>📊</span>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>KVJ Analytics</h2>
            </div>
            <button onClick={toggle} aria-label="Toggle theme" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer' }}>{theme === 'dark' ? '☀' : '☾'}</button>
          </div>

          <div className="kvj-card"><div className="kvj-card__body" style={{ padding: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
              {view === 'login'
                ? 'Welcome back'
                : view === 'forgot'
                ? 'Reset your password'
                : '🔑 Reset Default Password'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, margin: '0 0 20px' }}>
              {view === 'login'
                ? 'Sign in to your training analytics workspace.'
                : view === 'forgot'
                ? "We'll email you a reset link."
                : 'Welcome! Your account uses a default password. Please choose a new secure password.'}
            </p>

            {error && <div role="alert" style={banner('var(--status-danger-bg)', 'var(--status-danger)')}>{error}</div>}
            {info && <div style={banner('var(--status-success-bg)', 'var(--status-success)')}>{info}</div>}

            {view === 'login' && (
              <>
                <label style={fieldWrap}>
                  <span style={lbl}>Username or Email</span>
                  <input
                    className="kvj-input"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                  />
                </label>
                <label style={fieldWrap}>
                  <span style={lbl}>Password</span>
                  <input
                    className="kvj-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 18px' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                  </label>
                  <button onClick={() => { setView('forgot'); setError(null); }} style={linkBtn}>Forgot password?</button>
                </div>

                <Button onClick={doLogin} disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14, fontWeight: 700 }}>
                  {busy ? 'Please wait…' : 'Sign in'}
                </Button>
              </>
            )}

            {view === 'first_time_reset' && (
              <>
                <label style={fieldWrap}>
                  <span style={lbl}>New Password</span>
                  <input
                    className="kvj-input"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
                <label style={fieldWrap}>
                  <span style={lbl}>Confirm New Password</span>
                  <input
                    className="kvj-input"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>

                <Button onClick={handleFirstTimeReset} disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14, fontWeight: 700, marginTop: 10 }}>
                  {busy ? 'Updating...' : '🔒 Save New Password & Proceed'}
                </Button>
              </>
            )}

            {view === 'forgot' && (
              <>
                <label style={fieldWrap}>
                  <span style={lbl}>Username or Email</span>
                  <input className="kvj-input" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@kvjanalytics.com" />
                </label>
                <Button onClick={doForgot} disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14 }}>
                  {busy ? 'Sending...' : 'Send reset link'}
                </Button>
                <button onClick={() => { setView('login'); setInfo(null); setError(null); }} style={{ ...linkBtn, display: 'block', margin: '14px auto 0' }}>← Back to sign in</button>
              </>
            )}
          </div></div>
        </div>
      </div>
    </div>
  );
}

const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
function banner(bg: string, fg: string): React.CSSProperties {
  return { padding: '10px 14px', borderRadius: 8, background: bg, color: fg, fontSize: 12.5, fontWeight: 600, marginBottom: 14 };
}

export function SessionExpired() {
  return <LoginPage />;
}

export function LockedAccount() {
  return <LoginPage />;
}
