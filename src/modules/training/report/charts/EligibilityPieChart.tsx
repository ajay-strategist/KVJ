import React from 'react';

interface EligibilityPieChartProps {
  eligibleCount: number;
  notEligibleCount: number;
  title?: string;
  caption?: string;
}

export const EligibilityPieChart: React.FC<EligibilityPieChartProps> = ({
  eligibleCount,
  notEligibleCount,
  title = 'V9. Final Exam Eligibility Breakdown',
  caption = 'Based on cleared prerequisite assessments.',
}) => {
  const total = eligibleCount + notEligibleCount;
  if (total === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No data</div>;
  }

  const eligiblePct = Math.round((eligibleCount / total) * 100);
  const notEligiblePct = 100 - eligiblePct;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (eligiblePct / 100) * circumference;

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16 }}>
        <svg viewBox="0 0 100 100" style={{ width: 120, height: 120 }}>
          <title>{`${eligiblePct}% Eligible`}</title>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#ef4444" strokeWidth="18" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth="18"
            strokeDasharray={`${strokeDash} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">
            {eligiblePct}%
          </text>
          <text x="50" y="62" textAnchor="middle" fontSize="9" fontWeight="600" fill="#64748b">
            ELIGIBLE
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 3 }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Eligible: {eligibleCount} ({eligiblePct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3 }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Not Eligible: {notEligibleCount} ({notEligiblePct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
