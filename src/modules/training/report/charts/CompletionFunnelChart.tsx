import React from 'react';

interface CompletionFunnelChartProps {
  enrolled: number;
  attended: number;
  assessed: number;
  passed: number;
  eligible: number;
  title?: string;
  caption?: string;
}

export const CompletionFunnelChart: React.FC<CompletionFunnelChartProps> = ({
  enrolled,
  assessed,
  passed,
  title = '⏳ Student Completion Funnel',
  caption = 'Enrolled → Assessed → Passed (Green) vs Failed (Red)',
}) => {
  const failed = enrolled - passed;

  const steps = [
    { label: 'Enrolled Students', count: enrolled, color: '#3b82f6' },
    { label: 'Attempted Assessments', count: assessed, color: '#0284c7' },
    { label: 'Passed Prerequisites', count: passed, color: '#10b981' }, // Passed (Green)
    { label: 'Failed / Pending Retest', count: Math.max(failed, 0), color: '#ef4444' }, // Failed (Red)
  ];

  const max = Math.max(enrolled, 1);

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, idx) => {
          const pct = Math.round((step.count / max) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ width: 130, fontWeight: 700, color: '#334155', textAlign: 'right', fontSize: 10.5 }}>{step.label}</span>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(pct, 8)}%`,
                    background: step.color,
                    height: '100%',
                    borderRadius: 4,
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    lineHeight: '18px',
                    paddingLeft: 6,
                    transition: 'width 0.3s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {step.count} ({pct}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
