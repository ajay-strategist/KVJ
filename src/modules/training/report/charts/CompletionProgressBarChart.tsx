import React from 'react';

interface CompletionProgressBarChartProps {
  completed: number;
  pending: number;
  notAttempted: number;
  total: number;
  title?: string;
  caption?: string;
}

export const CompletionProgressBarChart: React.FC<CompletionProgressBarChartProps> = ({
  completed,
  pending,
  notAttempted,
  total,
  title = 'V8. Completion Progress Bar',
  caption = 'Assessment Submission Status',
}) => {
  const safeTotal = Math.max(total, 1);
  const compPct = Math.round((completed / safeTotal) * 100);
  const pendPct = Math.round((pending / safeTotal) * 100);
  const notAttPct = Math.round((notAttempted / safeTotal) * 100);

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', border: '1px solid #cbd5e1', background: '#f1f5f9' }}>
        {compPct > 0 && (
          <div
            title={`Completed: ${completed} (${compPct}%)`}
            style={{ width: `${compPct}%`, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {compPct >= 10 ? `${completed} (${compPct}%)` : ''}
          </div>
        )}
        {pendPct > 0 && (
          <div
            title={`Pending Review: ${pending} (${pendPct}%)`}
            style={{ width: `${pendPct}%`, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {pendPct >= 10 ? `${pending} (${pendPct}%)` : ''}
          </div>
        )}
        {notAttPct > 0 && (
          <div
            title={`Not Attempted: ${notAttempted} (${notAttPct}%)`}
            style={{ width: `${notAttPct}%`, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {notAttPct >= 10 ? `${notAttempted} (${notAttPct}%)` : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Completed ({completed})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Pending ({pending})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Not Attempted ({notAttempted})</span>
        </div>
      </div>
    </div>
  );
};
