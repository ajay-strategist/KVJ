import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectExecutiveKPIs } from '../daily-report.selectors';

export const ExecutiveSummarySection: React.FC<SectionProps> = ({ data }) => {
  const kpis = selectExecutiveKPIs(data);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        📊 Executive Summary & Student Demographics
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        High-level key performance metrics, demographic distribution, technical readiness, and eligibility status.
      </div>

      {/* 6 Executive KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        
        {/* 1. Total Students */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Total Enrolled Students</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {kpis.totalStudents} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Students</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Active batch strength</div>
        </div>

        {/* 2. Gender Wise Distribution */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Gender Distribution</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            👩 {kpis.femaleCount} ({kpis.femalePct}%) · 👨 {kpis.maleCount} ({kpis.malePct}%)
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Female to Male ratio</div>
        </div>

        {/* 3. Computer / Laptop Ownership */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Laptop / Computer Availability</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
            💻 {kpis.hasLaptopCount} Has Laptop ({kpis.hasLaptopPct}%)
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{kpis.noLaptopCount} Students require lab machine</div>
        </div>

        {/* 4. Previous Knowledge */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Prior Course Experience</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
            📚 {kpis.learnedBeforeCount} Experienced ({kpis.learnedBeforePct}%)
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{kpis.newLearnerCount} New learners to course</div>
        </div>

        {/* 5. Overall Batch Attendance */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Overall Batch Attendance</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: kpis.overallAttendancePct >= 84 ? '#16a34a' : '#d97706', marginTop: 2 }}>
            {kpis.overallAttendancePct}%
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Across all logged sessions</div>
        </div>

        {/* 6. Final Exam Eligibility Status */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Final Exam Eligibility Rate</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#059669', marginTop: 2 }}>
            {kpis.eligibleCount} / {kpis.totalStudents} ({kpis.finalExamEligibilityRatePct}%)
          </div>
          <div style={{ fontSize: 10, color: '#dc2626', marginTop: 4 }}>{kpis.notEligibleCount} Ineligible students</div>
        </div>

      </div>
    </div>
  );
};
