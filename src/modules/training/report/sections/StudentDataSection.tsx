import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const StudentDataSection: React.FC<SectionProps> = ({ data, config }) => {
  const selectedCols = config.selectedStudentColumns;
  const selectedAsses = data.assessments.filter((a) => config.selectedAssessmentIds.includes(a.id));

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        👨‍🎓 Master Student Data Directory
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        Comprehensive student performance matrix, demographics, attendance %, and assessment scores.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #cbd5e1' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Register No. (Phone)</th>
            {selectedCols.includes('studentName') && <th style={{ padding: 6 }}>Student Name</th>}
            {selectedCols.includes('gender') && <th style={{ padding: 6, textAlign: 'center' }}>Gender</th>}
            {selectedCols.includes('hasComputer') && <th style={{ padding: 6, textAlign: 'center' }}>Has Laptop</th>}
            {selectedCols.includes('learnedBefore') && <th style={{ padding: 6, textAlign: 'center' }}>Prior Exp.</th>}
            {selectedCols.includes('attendancePct') && <th style={{ padding: 6, textAlign: 'center' }}>Attendance %</th>}

            {/* Selected Assessment Columns */}
            {selectedAsses.map((ass) => {
              if (selectedCols.includes(ass.id)) {
                return (
                  <th key={ass.id} style={{ padding: 6, textAlign: 'center' }}>
                    {ass.title} ({ass.passMarkPercent}%)
                  </th>
                );
              }
              return null;
            })}

            {selectedCols.includes('assessmentStatus') && <th style={{ padding: 6, textAlign: 'center' }}>Assessment Status</th>}
            {selectedCols.includes('finalExamEligibility') && <th style={{ padding: 6, textAlign: 'center' }}>Final Exam Eligibility</th>}
          </tr>
        </thead>
        <tbody>
          {data.students.map((st, idx) => {
            const isAttWarn = st.attendancePct < 75;
            const isEligible = st.finalExamEligibility === 'Eligible';
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            return (
              <tr key={st.id} style={{ borderBottom: '1px solid #cbd5e1', background: rowBg }}>
                <td style={{ padding: 6, fontWeight: 700, color: '#2563eb' }}>{st.phone}</td>
                {selectedCols.includes('studentName') && <td style={{ padding: 6, fontWeight: 700, color: '#0f172a' }}>{st.name}</td>}
                {selectedCols.includes('gender') && <td style={{ padding: 6, textAlign: 'center' }}>{st.gender}</td>}
                {selectedCols.includes('hasComputer') && (
                  <td style={{ padding: 6, textAlign: 'center', fontWeight: 600, color: st.hasComputer === 'Yes' ? '#16a34a' : '#dc2626' }}>
                    {st.hasComputer}
                  </td>
                )}
                {selectedCols.includes('learnedBefore') && (
                  <td style={{ padding: 6, textAlign: 'center', fontWeight: 600, color: st.learnedBefore === 'Yes' ? '#2563eb' : '#64748b' }}>
                    {st.learnedBefore}
                  </td>
                )}
                {selectedCols.includes('attendancePct') && (
                  <td style={{ padding: 6, textAlign: 'center', fontWeight: 800, color: isAttWarn ? '#dc2626' : '#0f172a' }}>
                    {st.attendancePct}%
                  </td>
                )}

                {/* Selected Assessment Marks */}
                {selectedAsses.map((ass) => {
                  if (selectedCols.includes(ass.id)) {
                    const sc = st.assessmentScores[ass.id];
                    const score = sc ? sc.marks : 0;
                    const passed = sc ? sc.passed : false;
                    const attempted = sc ? sc.attempted : false;

                    return (
                      <td key={ass.id} style={{ padding: 6, textAlign: 'center', fontWeight: 700 }}>
                        {!attempted ? (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        ) : (
                          <span style={{ color: passed ? '#16a34a' : '#dc2626' }}>
                            {score}% {passed ? '✓' : '✗'}
                          </span>
                        )}
                      </td>
                    );
                  }
                  return null;
                })}

                {selectedCols.includes('assessmentStatus') && (
                  <td style={{ padding: 6, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: st.assessmentStatus === 'Completed' ? '#ecfdf5' : st.assessmentStatus === 'Failed' ? '#fef2f2' : '#fffbeba',
                        color: st.assessmentStatus === 'Completed' ? '#047857' : st.assessmentStatus === 'Failed' ? '#b91c1c' : '#b45309',
                      }}
                    >
                      {st.assessmentStatus}
                    </span>
                  </td>
                )}

                {selectedCols.includes('finalExamEligibility') && (
                  <td style={{ padding: 6, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: isEligible ? '#ecfdf5' : '#fef2f2',
                        color: isEligible ? '#047857' : '#b91c1c',
                      }}
                    >
                      {st.finalExamEligibility}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
