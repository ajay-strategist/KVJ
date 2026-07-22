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
  attended,
  assessed,
  passed,
  eligible,
  title = 'V11. Student Completion Funnel',
  caption = 'Enrolled → Attended → Assessed → Passed → Eligible',
}) => {
  const steps = [
    { label: 'Enrolled Students', count: enrolled, color: '#3b82f6' },
    { label: 'Attended Regular Sessions', count: attended, color: '#0284c7' },
    { label: 'Attempted Assessments', count: assessed, color: '#0d9488' },
    { label: 'Cleared Prerequisites', count: passed, color: '#059669' },
    { label: 'Final Exam Eligible', count: eligible, color: '#10b981' },
  ];

  const max = Math.max(enrolled, 1);

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, idx) => {
          const pct = Math.round((step.count / max) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
              <span style={{ width: 140, fontWeight: 600, color: '#334155', textAlign: 'right' }}>{step.label}</span>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    background: step.color,
                    height: '100%',
                    borderRadius: 4,
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '20px',
                    paddingLeft: 8,
                    transition: 'width 0.3s ease',
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
