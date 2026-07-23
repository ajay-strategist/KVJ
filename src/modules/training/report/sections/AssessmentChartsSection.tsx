import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectAssessmentKPIs, selectScoreHistogramBuckets } from '../daily-report.selectors';
import { ScoreHistogramChart } from '../charts/ScoreHistogramChart';
import { PassFailDonutChart } from '../charts/PassFailDonutChart';
import { AverageScoreGaugeChart } from '../charts/AverageScoreGaugeChart';
import { CompletionProgressBarChart } from '../charts/CompletionProgressBarChart';

export const AssessmentChartsSection: React.FC<SectionProps> = ({ data, config }) => {
  const selectedAssessments = data.assessments.filter((a) => config.selectedAssessmentIds.includes(a.id));

  if (selectedAssessments.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Assessment Visual Analytics</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {selectedAssessments.map((ass) => {
          const kpis = selectAssessmentKPIs(data, ass.id);
          const histogramBuckets = selectScoreHistogramBuckets(data, ass.id);

          return (
            <div key={ass.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                📊 Analytics: {ass.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>(Pass Target: {ass.passMarkPercent}%)</span>
              </h3>

              <div className="report-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <ScoreHistogramChart buckets={histogramBuckets} passMarkPercent={ass.passMarkPercent} />
                <PassFailDonutChart passed={kpis.completed - kpis.failed} failed={kpis.failed} notAttempted={kpis.notAttempted} />
              </div>

              <div className="report-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <AverageScoreGaugeChart score={kpis.averageMark} passMarkPercent={ass.passMarkPercent} />
                <CompletionProgressBarChart completed={kpis.completed} pending={kpis.pending} notAttempted={kpis.notAttempted} total={kpis.totalStudents} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
