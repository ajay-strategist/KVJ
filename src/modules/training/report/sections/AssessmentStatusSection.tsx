import React from 'react';
import type { SectionProps } from './CoverPageSection';
import {
  selectAssessmentKPIs,
  selectScoreHistogramBuckets,
  selectDatewiseAssessmentStatus,
} from '../daily-report.selectors';
import { ScoreHistogramChart } from '../charts/ScoreHistogramChart';
import { DatewiseAssessmentProgressLineChart } from '../charts/DatewiseAssessmentProgressLineChart';

export const AssessmentStatusSection: React.FC<SectionProps> = ({ data, config }) => {
  const selectedAssessments = data.assessments.filter((a) => config.selectedAssessmentIds.includes(a.id));

  if (selectedAssessments.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        📝 Assessment Performance &amp; Outcomes Intelligence
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
        Detailed performance metrics, score bucket distribution, date-wise progress tracking, and student outcomes.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedAssessments.map((ass) => {
          const kpis = selectAssessmentKPIs(data, ass.id);
          const histogramBuckets = selectScoreHistogramBuckets(data, ass.id);
          const datewiseProgress = selectDatewiseAssessmentStatus(data, ass.id);

          const passedCount = kpis.completed - kpis.failed;

          // Categorize students
          const passedStudents = data.students.filter((st) => st.assessmentScores[ass.id]?.passed && st.assessmentScores[ass.id]?.attempted);
          const failedStudents = data.students.filter((st) => !st.assessmentScores[ass.id]?.passed && st.assessmentScores[ass.id]?.attempted);
          const notAttendedStudents = data.students.filter((st) => !st.assessmentScores[ass.id]?.attempted);

          return (
            <div
              key={ass.id}
              className="card-avoid-break"
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                border: '1.5px solid #cbd5e1',
                borderRadius: 10,
                padding: 14,
                background: '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  {ass.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>({ass.type})</span>
                </h3>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: 4 }}>
                  Pass Mark Target: {ass.passMarkPercent}% {ass.isCustomPassMark ? '(custom)' : '(default 84%)'}
                </span>
              </div>

              {/* KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ background: '#f8fafc', padding: 6, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontWeight: 600 }}>Completed</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{kpis.completed} / {kpis.totalStudents}</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: 6, borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <div style={{ color: '#166534', fontWeight: 600 }}>Passed Count (%)</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>{passedCount} ({kpis.passPct}%)</div>
                </div>
                <div style={{ background: '#fef2f2', padding: 6, borderRadius: 6, border: '1px solid #fecaca' }}>
                  <div style={{ color: '#991b1b', fontWeight: 600 }}>Failed Count</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{kpis.failed}</div>
                </div>
                <div style={{ background: '#fffbeb', padding: 6, borderRadius: 6, border: '1px solid #fde68a' }}>
                  <div style={{ color: '#92400e', fontWeight: 600 }}>Not Attended</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#d97706' }}>{kpis.notAttempted}</div>
                </div>
                <div style={{ background: '#eff6ff', padding: 6, borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <div style={{ color: '#1e40af', fontWeight: 600 }}>Average Score</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#2563eb' }}>{kpis.averageMark}%</div>
                </div>
              </div>

              {/* Grid: Histogram + Student Outcome Lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                
                {/* Score Histogram */}
                <div>
                  <ScoreHistogramChart buckets={histogramBuckets} passMarkPercent={ass.passMarkPercent} />
                </div>

                {/* Outcome Lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                  
                  {/* Failed Students */}
                  {failedStudents.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 8 }}>
                      <strong style={{ color: '#b91c1c' }}>❌ Failed Students ({failedStudents.length}):</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {failedStudents.map((st) => (
                          <span key={st.id} style={{ background: '#ffffff', border: '1px solid #f87171', borderRadius: 4, padding: '2px 6px', fontSize: 10.5 }}>
                            <strong>{st.name}</strong> ({st.phone}) — {st.assessmentScores[ass.id]?.marks}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not Attended Students */}
                  {notAttendedStudents.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: 8 }}>
                      <strong style={{ color: '#b45309' }}>⚠️ Not Attended Students ({notAttendedStudents.length}):</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {notAttendedStudents.map((st) => (
                          <span key={st.id} style={{ background: '#ffffff', border: '1px solid #fbbf24', borderRadius: 4, padding: '2px 6px', fontSize: 10.5 }}>
                            <strong>{st.name}</strong> ({st.phone})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Passed Summary */}
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: 8, color: '#166534' }}>
                    <strong>✓ Passed ({passedStudents.length} Students):</strong> Highest mark achieved ≥ {ass.passMarkPercent}%
                  </div>

                </div>

              </div>

              {/* DATE-WISE ASSESSMENT STATUS, LINE CHART & PROGRESS TABLE */}
              {datewiseProgress.length > 0 && (
                <div style={{ borderTop: '1.5px solid #e2e8f0', paddingTop: 12, marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      📅 Date-Wise Assessment Progress &amp; Trend Analysis
                    </div>
                    <span style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>
                      Evaluates highest mark per student across all attempts
                    </span>
                  </div>

                  {/* Date-Wise Progress Line Chart */}
                  <div className="chart-avoid-break" style={{ marginBottom: 12, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <DatewiseAssessmentProgressLineChart
                      rows={datewiseProgress}
                      title={`${ass.title} — Pass Rate Progress Trend`}
                      caption={`Cumulative overall pass % progress across exam dates (Target: ${ass.passMarkPercent}%).`}
                      targetPassPct={ass.passMarkPercent}
                    />
                  </div>

                  {/* Date-Wise Progress Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Exam Date</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Attended Students</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Passed Count (Day)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Day Pass %</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Cumulative Cleared</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Current Overall Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datewiseProgress.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0', background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{row.date}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{row.attemptedToday} Students</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{row.passedToday}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: row.dayPassPct >= 80 ? '#16a34a' : '#d97706' }}>
                            {row.dayPassPct}%
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                            {row.cumulativePassed} / {row.enrolledTotal} Enrolled
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 900, color: row.cumulativePassPct >= 70 ? '#15803d' : '#dc2626' }}>
                            {row.cumulativePassPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};
