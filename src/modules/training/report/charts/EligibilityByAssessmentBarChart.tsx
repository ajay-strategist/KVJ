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
  title = '📊 Cleared Students per Assessment',
  caption = 'Number of students who cleared each prerequisite assessment',
}) => {
  if (!assessments || assessments.length === 0) {
    return <div style={{ textAlign: 'center', padding: 16, color: '#64748b', fontSize: 11 }}>No assessment selected</div>;
  }

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {assessments.map((ass) => {
          const total = Math.max(ass.totalStudents, 1);
          const passedPct = Math.round((ass.passedCount / total) * 100);

          return (
            <div key={ass.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                <span>{ass.title}</span>
                <span style={{ color: '#15803d' }}>{ass.passedCount} / {total} Cleared ({passedPct}%)</span>
              </div>

              <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                <div
                  title={`Cleared: ${ass.passedCount} (${passedPct}%)`}
                  style={{
                    width: `${Math.max(passedPct, 5)}%`,
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 800,
                    lineHeight: '18px',
                    paddingLeft: 6,
                    transition: 'width 0.3s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {ass.passedCount} Students ({passedPct}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
