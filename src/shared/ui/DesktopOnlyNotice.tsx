import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from './components';

export interface DesktopOnlyNoticeProps {
  featureName: string;
  reason?: string;
  recommendedAction?: string;
}

export const DesktopOnlyNotice: React.FC<DesktopOnlyNoticeProps> = ({
  featureName,
  reason = 'This administrative audit feature involves complex audit logs and multi-session compliance verification.',
  recommendedAction = 'Please open this page from your laptop or desktop browser to access full audit controls.',
}) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 20,
      }}
    >
      <Card
        style={{
          maxWidth: 480,
          textAlign: 'center',
          padding: '36px 28px',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--brand)',
            fontSize: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          💻
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '0 0 10px',
            letterSpacing: '-0.01em',
          }}
        >
          Desktop / Laptop Required
        </h2>

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--brand)',
            margin: '0 0 12px',
          }}
        >
          {featureName} is optimized for desktop viewports.
        </p>

        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 24px',
          }}
        >
          {reason} {recommendedAction}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => navigate('/app')}>
            ← Return to My Day
          </Button>
        </div>
      </Card>
    </div>
  );
};
