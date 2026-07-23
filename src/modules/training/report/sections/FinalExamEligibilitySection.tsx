import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectEligibilityKPIs } from '../daily-report.selectors';
import { EligibilityByAssessmentBarChart } from '../charts/EligibilityByAssessmentBarChart';
import { CompletionFunnelChart } from '../charts/CompletionFunnelChart';

export const FinalExamEligibilitySection: React.FC<SectionProps> = ({ data, config }) => {
  const kpis = selectEligibilityKPIs(data, config.selectedAssessmentIds);

  // Compute assessment clearance metrics for bar chart
  const assessmentClearanceData = data.assessments
    .filter((a) => config.selectedAssessmentIds.includes(a.id))
    .map((ass) => {
      let passedCount = 0;
      let failedCount = 0;
      let notAttemptedCount = 0;

      data.students.forEach((st) => {
        const sc = st.assessmentScores[ass.id];
        if (!sc || !sc.attempted) {
          notAttemptedCount++;
        } else if (sc.passed) {
          passedCount++;
        } else {
          failedCount++;
        }
      });

      return {
        id: ass.id,
        title: ass.title,
        passedCount,
        failedCount,
        notAttemptedCount,
        totalStudents: data.students.length,
        passMarkPercent: ass.passMarkPercent,
      };
    });

  // Calculate numbers for Completion Funnel
  const totalEnrolled = data.totalStudents || data.students.length || 0;
  const attemptedCount = data.students.filter((st) =>
    config.selectedAssessmentIds.some((assId) => st.assessmentScores[assId]?.attempted)
  ).length;

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        📋 Final Exam Eligibility Intelligence &amp; Outcomes
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
        Official eligibility determination for the Final Certification Exam, prerequisite clearance rates, and remedial action tracking.
      </div>

      {/* 3 KPI Cards */}
      <div className="card-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {/* Card 1: Eligible Students (Green) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            border: '1.5px solid #a7f3d0',
            borderRadius: 10,
            padding: '14px 16px',
            textAlign: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', letterSpacing: '0.01em' }}>
            Eligible Students
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#065f46', marginTop: 4, lineHeight: 1 }}>
            {kpis.eligibleCount}
          </div>
        </div>

        {/* Card 2: Not Eligible Students (Red) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '1.5px solid #fecaca',
            borderRadius: 10,
            padding: '14px 16px',
            textAlign: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c', letterSpacing: '0.01em' }}>
            Not Eligible Students
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#991b1b', marginTop: 4, lineHeight: 1 }}>
            {kpis.notEligibleCount}
          </div>
        </div>

        {/* Card 3: Batch Eligibility Rate (Blue) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1.5px solid #bfdbfe',
            borderRadius: 10,
            padding: '14px 16px',
            textAlign: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.01em' }}>
            Batch Eligibility Rate
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#1e40af', marginTop: 4, lineHeight: 1 }}>
            {kpis.eligibilityPct}%
          </div>
        </div>
      </div>

      {/* Visual Charts Grid: Bar Chart (Cleared Students) + Funnel Chart (Passed Green / Failed Red) */}
      <div className="chart-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14, marginBottom: 16, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {/* Bar Chart: Students Cleared Each Assessment */}
        <div>
          <EligibilityByAssessmentBarChart
            assessments={assessmentClearanceData}
            title="📊 Cleared Students per Assessment"
            caption="Number of students who cleared each prerequisite assessment"
          />
        </div>

        {/* Funnel Chart: Completed Students (Passed Green / Failed Red) */}
        <div>
          <CompletionFunnelChart
            enrolled={totalEnrolled}
            attended={attemptedCount}
            assessed={attemptedCount}
            passed={kpis.eligibleCount}
            eligible={kpis.eligibleCount}
            title="⏳ Student Completion Funnel"
            caption="Passed (Green) vs Failed (Red) completion pipeline"
          />
        </div>
      </div>

      {/* Ineligible Students Table */}
      {kpis.notEligibleCount > 0 && (
        <div className="card-avoid-break" style={{ marginTop: 12, marginBottom: 14, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#9f1239', marginBottom: 8 }}>
            ⚠️ Ineligible Students Directory &amp; Remedial Action
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, border: '1.5px solid #fca5a5' }}>
            <thead>
              <tr style={{ background: '#fff1f2', borderBottom: '2px solid #fca5a5', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 800 }}>Register No. (Phone)</th>
                <th style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 800 }}>Student Name</th>
                <th style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 800 }}>Ineligibility Reason</th>
                <th style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 800 }}>Remedial Action Required</th>
              </tr>
            </thead>
            <tbody>
              {data.students
                .filter((st) => st.finalExamEligibility === 'Not Eligible')
                .map((st, idx) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid #fecdd3', background: idx % 2 === 0 ? '#ffffff' : '#fff5f5', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2563eb' }}>{st.phone}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#9f1239' }}>{st.name}</td>
                    <td style={{ padding: '8px 10px', color: '#334155' }}>{st.eligibilityReason || 'Failed prerequisite assessment(s)'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#c2410c' }}>Clear failed prerequisite retest</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ELIGIBILITY INTELLIGENCE INSIGHTS & ACTION STEPS */}
      <div
        className="card-avoid-break"
        style={{
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1.5px solid #86efac',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
          <span>🎯</span> Final Certification Eligibility Intelligence
        </div>
        <div style={{ fontSize: 11, color: '#14532d', lineHeight: 1.5 }}>
          <strong>{kpis.eligibleCount} out of {data.students.length} students ({kpis.eligibilityPct}%)</strong> have successfully cleared all required prerequisite assessments and are qualified for the Final Certification Exam.
          {kpis.notEligibleCount > 0 && (
            <span>
              {' '}Remedial retests must be conducted for the <strong>{kpis.notEligibleCount} pending student(s)</strong> prior to official score sheet lock.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
