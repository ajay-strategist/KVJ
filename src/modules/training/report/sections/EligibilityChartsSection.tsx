import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectEligibilityKPIs, selectAssessmentKPIs } from '../daily-report.selectors';
import { EligibilityPieChart } from '../charts/EligibilityPieChart';
import { EligibilityByAssessmentBarChart } from '../charts/EligibilityByAssessmentBarChart';

export const EligibilityChartsSection: React.FC<SectionProps> = ({ data, config }) => {
  const kpis = selectEligibilityKPIs(data, config.selectedAssessmentIds);

  const assessmentItems = data.assessments
    .filter((a) => config.selectedAssessmentIds.includes(a.id))
    .map((a) => {
      const assKpi = selectAssessmentKPIs(data, a.id);
      return {
        id: a.id,
        title: a.title,
        passedCount: assKpi.completed - assKpi.failed,
        failedCount: assKpi.failed,
        notAttemptedCount: assKpi.notAttempted,
        totalStudents: assKpi.totalStudents,
        passMarkPercent: a.passMarkPercent,
      };
    });

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Eligibility Visual Analytics</h2>

      <div className="report-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <EligibilityPieChart eligibleCount={kpis.eligibleCount} notEligibleCount={kpis.notEligibleCount} />
        <EligibilityByAssessmentBarChart assessments={assessmentItems} />
      </div>
    </div>
  );
};
