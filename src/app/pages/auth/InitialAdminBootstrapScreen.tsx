import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../../shared/ui/components';
import { useAuth } from '../../../modules/auth/AuthProvider';

export function InitialAdminBootstrapScreen({ onBootstrapSuccess }: { onBootstrapSuccess: () => void }) {
  const { bootstrapInitialAdmin, login } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [designation, setDesignation] = useState('Chief Executive Officer');
  const [department, setDepartment] = useState('Executive Management');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phone || !password) {
      setError('Please fill in all required fields (Name, Email, Phone, Password).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await bootstrapInitialAdmin({
        fullName,
        email,
        phone,
        password,
        designation,
        department,
      });

      // Automatically log in the newly created initial Admin
      await login({ email, password });
      onBootstrapSuccess();
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize System Administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--app-canvas, linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%))',
      padding: 20,
      color: 'var(--text-primary)'
    }}>
      <Card style={{
        maxWidth: 520,
        width: '100%',
        padding: 32,
        borderRadius: 24,
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            System Initialization & Admin Setup
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Welcome to KVJ Enterprise OS. No users exist in the production database. Set up your root <strong>System Administrator</strong> account to initialize the platform.
          </p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 18,
            border: '1px solid #fca5a5'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Full Name *
            </label>
            <input
              type="text"
              className="kvj-input"
              placeholder="e.g. Ajay Thomas"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Corporate Email *
              </label>
              <input
                type="email"
                className="kvj-input"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Phone Number *
              </label>
              <input
                type="tel"
                className="kvj-input"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Designation
              </label>
              <input
                type="text"
                className="kvj-input"
                placeholder="e.g. Chief Executive Officer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Department
              </label>
              <input
                type="text"
                className="kvj-input"
                placeholder="e.g. Executive Management"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Admin Password *
              </label>
              <input
                type="password"
                className="kvj-input"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Confirm Password *
              </label>
              <input
                type="password"
                className="kvj-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                color: '#fff',
                borderRadius: 12,
                boxShadow: '0 4px 14px rgba(99,102,241,0.4)'
              }}
            >
              {submitting ? 'Initializing Production System...' : '🚀 Create System Administrator Account'}
            </Button>
          </div>
        </form>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          🔒 This bootstrap setup will automatically self-disable after creation. Public registration is permanently disabled.
        </p>
      </Card>
    </div>
  );
}
