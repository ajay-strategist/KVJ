/**
 * Teamz — Production Login Experience
 * Clean production authentication portal matching Teamz design system
 * with mandatory first-time password reset workflow.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Users, Settings, TrendingUp, Layers, Sun, Moon, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { AppError } from '../../../core/result';
import { InitialAdminBootstrapScreen } from './InitialAdminBootstrapScreen';
import { appConfig } from '../../../config/app-config';

type View = 'login' | 'forgot' | 'first_time_reset';

export function LoginPage() {
  const { login, requestPasswordReset, updateUserPassword, hasUsers, status } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/app', { replace: true });
    }
  }, [status, navigate]);

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

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      hasUsers()
        .then((exists) => {
          if (!active) return;
          setBootstrapNeeded(!exists);
          setCheckingBootstrap(false);
        })
        .catch((err) => {
          console.warn('hasUsers check warning:', err);
          if (!active) return;
          setBootstrapNeeded(false);
          setCheckingBootstrap(false);
        });
    } catch (err) {
      console.warn('hasUsers check catch warning:', err);
      if (active) {
        setBootstrapNeeded(false);
        setCheckingBootstrap(false);
      }
    }
    return () => { active = false; };
  }, [hasUsers]);

  if (checkingBootstrap) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img src="/teamz-icon.png" alt="Teamz" style={{ height: 48, width: 48, objectFit: 'contain' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Initializing Teamz workspace...</div>
        </div>
      </div>
    );
  }

  if (bootstrapNeeded) {
    return <InitialAdminBootstrapScreen onBootstrapSuccess={() => setBootstrapNeeded(false)} />;
  }

  const doLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email and password.');
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
      setError(e instanceof AppError ? e.message : 'Invalid email or password.');
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
    if (newPassword === 'password' || newPassword === 'password123') {
      setError('Please choose a password different from the default password.');
      return;
    }

    const targetUserId = pendingUserId || identifier.trim() || 'user';

    setBusy(true);
    setError(null);

    try {
      await updateUserPassword(targetUserId, newPassword);
      setInfo('Password successfully updated! Redirecting to workspace...');
      setTimeout(() => {
        navigate('/app');
      }, 500);
    } catch (e) {
      setError(e instanceof AppError ? e.message : 'Failed to update password.');
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    if (!identifier.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setBusy(true);
    await requestPasswordReset(identifier);
    setInfo('If that email exists, a password reset link has been sent.');
    setBusy(false);
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'row',
      color: 'var(--text-primary)',
      background: theme === 'dark'
        ? 'linear-gradient(135deg, #090e18 0%, #0d1527 50%, #152037 100%)'
        : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #ecf4fd 100%)',
      overflowX: 'hidden',
    }}>
      {/* Background ambient lighting */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: theme === 'dark'
            ? 'radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.12) 0%, transparent 45%), radial-gradient(circle at 82% 78%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)'
            : 'radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.08) 0%, transparent 45%), radial-gradient(circle at 82% 78%, rgba(37, 99, 235, 0.06) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Floating Theme Toggle (top right) */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          zIndex: 20,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          borderRadius: 12,
          width: 40,
          height: 40,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'all 0.15s ease',
        }}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Main Responsive Layout */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        minHeight: '100vh',
      }}>
        {/* LEFT COLUMN: Branding & Hero Artwork (Desktop / Tablet) */}
        <div className="login-hero-pane" style={{
          flex: '1 1 54%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(28px, 4vw, 56px)',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          <div>
            {/* Top Left: KVJ Analytics Logo Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ffffff',
              padding: '6px 16px',
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              marginBottom: 36,
            }}>
              <img
                src="/kvj-analytics-logo.png"
                alt="KVJ Analytics"
                style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(32px, 3.6vw, 46px)',
              fontWeight: 900,
              lineHeight: 1.15,
              color: theme === 'dark' ? '#ffffff' : '#0e2b5c',
              margin: '0 0 16px',
              letterSpacing: '-0.03em',
            }}>
              A Smarter<br />Way to Work Together
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 'clamp(15px, 1.15vw, 17px)',
              color: theme === 'dark' ? '#94a3b8' : '#475569',
              lineHeight: 1.6,
              margin: '0 0 32px',
              maxWidth: 480,
            }}>
              Bring your people, processes and information together in one connected workspace.
            </p>

            {/* 4 Feature Badges: People, Process, Progress, Together */}
            <div style={{
              display: 'flex',
              gap: 'clamp(16px, 2.2vw, 28px)',
              marginBottom: 28,
              flexWrap: 'wrap',
            }}>
              {/* People */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                  boxShadow: '0 6px 14px rgba(37, 99, 235, 0.3)',
                }}>
                  <Users size={22} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#cbd5e1' : '#1e293b' }}>
                  People
                </span>
              </div>

              {/* Process */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                  boxShadow: '0 6px 14px rgba(16, 185, 129, 0.3)',
                }}>
                  <Settings size={22} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#cbd5e1' : '#1e293b' }}>
                  Process
                </span>
              </div>

              {/* Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                  boxShadow: '0 6px 14px rgba(245, 158, 11, 0.3)',
                }}>
                  <TrendingUp size={22} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#cbd5e1' : '#1e293b' }}>
                  Progress
                </span>
              </div>

              {/* Together */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                  boxShadow: '0 6px 14px rgba(139, 92, 246, 0.3)',
                }}>
                  <Layers size={22} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#cbd5e1' : '#1e293b' }}>
                  Together
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Seamless Vector Illustration (No Box, Grounded Naturally) */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 520,
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <img
              src="/login-team-vector.png"
              alt="Team collaborating at work"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: 340,
                objectFit: 'contain',
                display: 'block',
                position: 'relative',
                zIndex: 2,
                filter: theme === 'dark'
                  ? 'drop-shadow(0 12px 28px rgba(0, 0, 0, 0.5))'
                  : 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.1))',
              }}
            />
            {/* Ambient floor shadow */}
            <div
              aria-hidden
              style={{
                width: '85%',
                height: 16,
                marginTop: -8,
                background: theme === 'dark'
                  ? 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.65) 0%, transparent 75%)'
                  : 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.15) 0%, transparent 75%)',
                borderRadius: '50%',
                filter: 'blur(4px)',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Login Card */}
        <div style={{
          flex: '1 1 46%',
          display: 'grid',
          placeItems: 'center',
          padding: 'clamp(20px, 4vw, 48px)',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 440,
            background: theme === 'dark' ? '#141c2e' : '#ffffff',
            borderRadius: 22,
            boxShadow: theme === 'dark'
              ? '0 20px 50px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)'
              : '0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.06)',
            padding: 'clamp(28px, 4vw, 38px)',
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 3,
          }}>
            {/* Teamz Logo Lockup: theme-aware (white text in dark mode, dark text in light mode) */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img
                src={theme === 'dark' ? '/teamz-logo-dark.png' : '/teamz-logo.png'}
                alt="Teamz - People Work Together"
                style={{
                  height: 46,
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            {/* Header Titles */}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
              }}>
                {view === 'login'
                  ? 'Welcome back'
                  : view === 'forgot'
                  ? 'Reset your password'
                  : 'Set New Password'}
              </h2>
              <p style={{
                fontSize: 13.5,
                color: 'var(--text-secondary)',
                margin: 0,
              }}>
                {view === 'login'
                  ? 'Sign in to your Teamz workspace.'
                  : view === 'forgot'
                  ? "We'll send you instructions to reset your password."
                  : 'Your account uses a temporary password. Please set a secure new password.'}
              </p>
            </div>

            {/* Status / Error Banners */}
            {error && (
              <div role="alert" style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: 'var(--status-danger-bg, #fee2e2)',
                color: 'var(--status-danger, #b91c1c)',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 18,
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: 'var(--status-success-bg, #dcfce7)',
                color: 'var(--status-success, #15803d)',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 18,
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}>
                {info}
              </div>
            )}

            {/* LOGIN VIEW */}
            {view === 'login' && (
              <div>
                {/* Email Field */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={18}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted, #94a3b8)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="mail@thestrategist.co.in"
                      autoComplete="email"
                      onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                      style={{
                        width: '100%',
                        height: 46,
                        paddingLeft: 42,
                        paddingRight: 14,
                        borderRadius: 12,
                        border: '1px solid var(--border, #e2e8f0)',
                        background: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={18}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted, #94a3b8)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                      style={{
                        width: '100%',
                        height: 46,
                        paddingLeft: 42,
                        paddingRight: 42,
                        borderRadius: 12,
                        border: '1px solid var(--border, #e2e8f0)',
                        background: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted, #94a3b8)',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 22,
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13.5,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      style={{
                        accentColor: '#2563eb',
                        width: 16,
                        height: 16,
                        cursor: 'pointer',
                      }}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(null); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Sign In Button */}
                <button
                  type="button"
                  onClick={doLogin}
                  disabled={busy}
                  style={{
                    width: '100%',
                    height: 46,
                    background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.75 : 1,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            )}

            {/* FIRST TIME RESET VIEW */}
            {view === 'first_time_reset' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        width: '100%',
                        height: 46,
                        paddingLeft: 42,
                        paddingRight: 42,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{
                        width: '100%',
                        height: 46,
                        paddingLeft: 42,
                        paddingRight: 42,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFirstTimeReset}
                  disabled={busy}
                  style={{
                    width: '100%',
                    height: 46,
                    background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.75 : 1,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  {busy ? 'Updating…' : 'Save New Password & Proceed'}
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'forgot' && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Work Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="mail@thestrategist.co.in"
                      autoComplete="email"
                      style={{
                        width: '100%',
                        height: 46,
                        paddingLeft: 42,
                        paddingRight: 14,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={doForgot}
                  disabled={busy}
                  style={{
                    width: '100%',
                    height: 46,
                    background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.75 : 1,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    marginBottom: 16,
                  }}
                >
                  {busy ? 'Sending…' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => { setView('login'); setInfo(null); setError(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 600,
                    width: '100%',
                  }}
                >
                  <ArrowLeft size={16} /> Back to sign in
                </button>
              </div>
            )}

            {/* Copyright Footer inside card */}
            <div style={{
              textAlign: 'center',
              marginTop: 26,
              fontSize: 12,
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 500,
            }}>
              {appConfig.app.copyright || '© 2026 KVJ Analytics. All rights reserved.'}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 960px) {
          .login-hero-pane {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export function SessionExpired() {
  return <LoginPage />;
}

export function LockedAccount() {
  return <LoginPage />;
}
