import React from 'react';
import type { SectionProps } from './CoverPageSection';
import {
  selectFinalExamDetailedAnalytics,
  selectDatewiseFinalExamAnalytics,
  selectCrossDemographicPerformance,
} from '../daily-report.selectors';
import { ScoreHistogramChart } from '../charts/ScoreHistogramChart';
import { AttendanceGaugeChart } from '../charts/AttendanceGaugeChart';

export const FinalExamResultsSection: React.FC<SectionProps> = ({ data }) => {
  const analytics = selectFinalExamDetailedAnalytics(data);
  const dateAnalytics = selectDatewiseFinalExamAnalytics(data);
  const crossDemo = selectCrossDemographicPerformance(data);

  // Helper for rendering 100% Stacked Bar Rows
  const renderStackedBarGroup = (
    title: string,
    rows: Array<{
      category: string;
      total: number;
      passed: number;
      failed: number;
      notAttended: number;
      passedPct: number;
      failedPct: number;
      notAttendedPct: number;
    }>
  ) => (
    <div
      className="card-avoid-break"
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        padding: 12,
        background: '#ffffff',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => (
          <div key={row.category} style={{ fontSize: 10.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontWeight: 700, color: '#334155' }}>
              <span>{row.category} (Total: {row.total})</span>
              <span style={{ color: '#15803d' }}>Pass Rate: {row.passedPct}%</span>
            </div>
            <div style={{ width: '100%', height: 14, background: '#f1f5f9', borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
              {row.passedPct > 0 && (
                <div style={{ width: `${row.passedPct}%`, background: '#22c55e', color: '#ffffff', fontSize: 8.5, fontWeight: 800, textAlign: 'center', lineHeight: '14px' }}>
                  {row.passedPct}%
                </div>
              )}
              {row.failedPct > 0 && (
                <div style={{ width: `${row.failedPct}%`, background: '#ef4444', color: '#ffffff', fontSize: 8.5, fontWeight: 800, textAlign: 'center', lineHeight: '14px' }}>
                  {row.failedPct}%
                </div>
              )}
              {row.notAttendedPct > 0 && (
                <div style={{ width: `${row.notAttendedPct}%`, background: '#f59e0b', color: '#ffffff', fontSize: 8.5, fontWeight: 800, textAlign: 'center', lineHeight: '14px' }}>
                  {row.notAttendedPct}%
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 9, color: '#64748b', marginTop: 2 }}>
              <span>✓ Passed: {row.passed} ({row.passedPct}%)</span>
              <span>✗ Failed: {row.failed} ({row.failedPct}%)</span>
              <span>• Not Attended: {row.notAttended} ({row.notAttendedPct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      {/* SECTION TITLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #cbd5e1', paddingBottom: 6, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            Final Certification Exam &amp; Performance Intelligence
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Comprehensive analysis of certification outcomes, pass percentages, mark distribution, date trends, and demographic correlations.
          </span>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 4 }}>
          Pass Target: &ge;{data.finalExamPassMarkPercent || 70}%
        </div>
      </div>

      {/* TOP KPI CARDS STRIP */}
      <div className="card-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1.5px solid #86efac', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
            Overall Pass Rate
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 4, lineHeight: 1 }}>
            {analytics.passPct}%
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#166534', marginTop: 4 }}>
            {analytics.passedCount} of {analytics.totalStudents} Passed
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
            Maximum Final Mark
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1d4ed8', marginTop: 4, lineHeight: 1 }}>
            {analytics.maxMark} <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>/ {analytics.examMax}</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#1e40af', marginTop: 4 }}>
            Highest Score Achieved
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
            Average Batch Mark
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 4, lineHeight: 1 }}>
            {analytics.avgMark} <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>/ {analytics.examMax}</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#2563eb', marginTop: 4 }}>
            Batch Score Mean
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1.5px solid #fde68a', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
            Total Exam Records
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', marginTop: 4, lineHeight: 1 }}>
            {analytics.totalAttempts}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#92400e', marginTop: 4 }}>
            Exam Attempts Logged
          </div>
        </div>
      </div>

      {/* GAUGE CHART + HISTOGRAM ROW */}
      <div className="chart-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 14, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {/* Overall Pass % Gauge Chart */}
        <div>
          <AttendanceGaugeChart
            percentage={analytics.passPct}
            title="Overall Final Exam Pass %"
            caption="Pass criterion: Raw score >= Pass threshold mark"
          />
        </div>

        {/* Mark Histogram */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff' }}>
          <ScoreHistogramChart
            buckets={analytics.histogramBuckets}
            passMarkPercent={data.finalExamPassMarkPercent || 70}
          />
        </div>
      </div>

      {/* BATCH ANALYSIS SECTION */}
      {analytics.batchBreakdown.length > 0 && (
        <div className="card-avoid-break" style={{ marginBottom: 14, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
            Batch-Wise Performance Analysis
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Batch</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Passed</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Failed</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Not Attended</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Pass %</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Average Mark</th>
              </tr>
            </thead>
            <tbody>
              {analytics.batchBreakdown.map((b, idx) => (
                <tr key={b.batch} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{b.batch}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{b.total}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{b.passed}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{b.failed}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#d97706' }}>{b.notAttended}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{b.passPct}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{b.avgMark} / {analytics.examMax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DATE-WISE EXAM ANALYSIS */}
      {dateAnalytics.resultByDate.length > 0 && (
        <div className="card-avoid-break" style={{ marginBottom: 14, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
            Date-Wise Final Exam Outcomes &amp; Trends
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Exam Date</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Exams</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Passed</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Failed</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Not Attended</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Date Pass %</th>
              </tr>
            </thead>
            <tbody>
              {dateAnalytics.resultByDate.map((d, idx) => (
                <tr key={d.date} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{d.date}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{d.total}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{d.passed}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{d.failed}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#d97706' }}>{d.notAttended}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{d.passPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CROSS-DEMOGRAPHIC 100% STACKED ANALYSIS GRID */}
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
        Cross-Demographic Final Exam Performance (100% Stacked Analysis)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {renderStackedBarGroup('1. Gender vs. Final Exam Result', crossDemo.genderVsResult)}
        {renderStackedBarGroup('2. Laptop Availability vs. Final Exam Result', crossDemo.laptopVsResult)}
        {renderStackedBarGroup('3. Previous Excel Knowledge vs. Final Exam Result', crossDemo.excelVsResult)}
        {renderStackedBarGroup(
          '4. Previous Qualification vs. Final Exam Result',
          crossDemo.qualificationVsResult.map((q) => ({ ...q, category: q.qualification }))
        )}
      </div>
    </div>
  );
};
