import React from 'react';

interface AssessmentEligibilityItem {
  id: string;
  title: string;
  passedCount: number;
  failedCount: number;
  notAttemptedCount: number;
  totalStudents: number;
  passMarkPercent: number;
}

interface EligibilityByAssessmentBarChartProps {
  assessments: AssessmentEligibilityItem[];
  title?: string;
  caption?: string;
}

export const EligibilityByAssessmentBarChart: React.FC<EligibilityByAssessmentBarChartProps> = ({
  assessments,
  title = 'V10. Clearance Status by Assessment',
  caption = 'Passed vs Failed vs Pending per Selected Assessment',
}) => {
  if (!assessments || assessments.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No assessment selected</div>;
  }

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {assessments.map((ass) => {
          const total = Math.max(ass.totalStudents, 1);
          const passedPct = Math.round((ass.passedCount / total) * 100);
          const failedPct = Math.round((ass.failedCount / total) * 100);
          const pendingPct = Math.round((ass.notAttemptedCount / total) * 100);

          return (
            <div key={ass.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                <span>{ass.title} (Pass Mark: {ass.passMarkPercent}%)</span>
                <span>{ass.passedCount}/{total} Passed ({passedPct}%)</span>
              </div>
              <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                {passedPct > 0 && (
                  <div
                    title={`Passed: ${ass.passedCount} (${passedPct}%)`}
                    style={{ width: `${passedPct}%`, background: '#10b981', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}
                  >
                    {passedPct >= 12 ? `${passedPct}%` : ''}
                  </div>
                )}
                {failedPct > 0 && (
                  <div
                    title={`Failed: ${ass.failedCount} (${failedPct}%)`}
                    style={{ width: `${failedPct}%`, background: '#ef4444', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}
                  >
                    {failedPct >= 12 ? `${failedPct}%` : ''}
                  </div>
                )}
                {pendingPct > 0 && (
                  <div
                    title={`Pending: ${ass.notAttemptedCount} (${pendingPct}%)`}
                    style={{ width: `${pendingPct}%`, background: '#cbd5e1', color: '#475569', fontSize: 9.5, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}
                  >
                    {pendingPct >= 12 ? `${pendingPct}%` : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Passed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Failed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#cbd5e1', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Not Attempted</span>
        </div>
      </div>
    </div>
  );
};
