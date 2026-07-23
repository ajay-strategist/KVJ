import React from 'react';

interface PassFailDonutChartProps {
  passed: number;
  failed: number;
  notAttempted?: number;
  title?: string;
  caption?: string;
}

export const PassFailDonutChart: React.FC<PassFailDonutChartProps> = ({
  passed,
  failed,
  notAttempted = 0,
  title = 'V6. Pass vs Fail Distribution',
  caption = 'Assessment Result Summary',
}) => {
  const total = passed + failed + notAttempted;
  if (total === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No data for this period</div>;
  }

  const passPct = Math.round((passed / total) * 100);
  const failPct = Math.round((failed / total) * 100);
  const pendingPct = 100 - passPct - failPct;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const passStroke = (passPct / 100) * circumference;
  const failStroke = (failPct / 100) * circumference;

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16 }}>
        <svg viewBox="0 0 100 100" style={{ width: 120, height: 120 }}>
          <title>{`${passPct}% Passed`}</title>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />

          {/* Passed Arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth="16"
            strokeDasharray={`${passStroke} ${circumference}`}
            transform="rotate(-90 50 50)"
          />

          {/* Failed Arc */}
          {failed > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="16"
              strokeDasharray={`${failStroke} ${circumference}`}
              strokeDashoffset={`-${passStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          {/* Pending Arc */}
          {notAttempted > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="16"
              strokeDasharray={`${circumference - passStroke - failStroke} ${circumference}`}
              strokeDashoffset={`-${passStroke + failStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">
            {passPct}%
          </text>
          <text x="50" y="62" textAnchor="middle" fontSize="9" fontWeight="600" fill="#64748b">
            PASS
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Passed: {passed} ({passPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Failed: {failed} ({failPct}%)</span>
          </div>
          {notAttempted > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: '#cbd5e1', borderRadius: 2 }} />
              <span style={{ fontWeight: 600, color: '#0f172a' }}>Pending: {notAttempted} ({pendingPct}%)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
