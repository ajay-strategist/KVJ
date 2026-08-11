import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectExecutiveKPIs, selectDemographicBreakdowns } from '../daily-report.selectors';
import { AttendanceGaugeChart } from '../charts/AttendanceGaugeChart';
import {
  GenderDonutChart,
  PriorKnowledgeDonutChart,
  LaptopAvailabilityDonutChart,
} from '../charts/DemographicsDonutCharts';

export const ExecutiveSummarySection: React.FC<SectionProps> = ({ data, config }) => {
  const kpis = selectExecutiveKPIs(data);
  const demographics = selectDemographicBreakdowns(data);
  const showAttendance =
    config?.selectedStudentColumns?.includes('attendancePct') ||
    config?.selectedSections?.includes('datewise-attendance');

  const maxQualCount = Math.max(...demographics.qualifications.map((q) => q.count), 1);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        Executive Summary &amp; Batch Intelligence Overview
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
        Core batch profile, enrolled strength metrics, {showAttendance ? 'attendance gauge, ' : ''}and student demographics.
      </div>

      {/* Top Row: Enrolled Batch Strength Card + Overall Batch Attendance Gauge */}
      <div
        className="card-avoid-break"
        style={{
          display: 'grid',
          gridTemplateColumns: showAttendance ? '1fr 1fr' : '1fr',
          gap: 14,
          marginBottom: 14,
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        {/* Enrolled Batch Strength Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
            border: '1.5px solid #cbd5e1',
            borderRadius: 10,
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Enrolled Batch Strength
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', marginTop: 6, lineHeight: 1 }}>
            {kpis.totalStudents} <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Enrolled Students</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginTop: 10 }}>
            Active strength for batch: {data.batchCode || data.batchName} ({data.collegeName})
          </div>
        </div>

        {/* Gauge Chart for Overall Batch Attendance % */}
        {showAttendance && (
          <div>
            <AttendanceGaugeChart
              percentage={kpis.overallAttendancePct}
              title="Overall Batch Attendance %"
              caption="Cumulative rate across all logged sessions"
            />
          </div>
        )}
      </div>

      {/* Middle Row: Donut Charts Grid (Gender Distribution, Prior Knowledge, Laptop Availability) */}
      <div
        className="chart-avoid-break"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 14,
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        <GenderDonutChart
          femaleCount={kpis.femaleCount}
          maleCount={kpis.maleCount}
          totalStudents={kpis.totalStudents}
        />
        <PriorKnowledgeDonutChart
          learnedBeforeCount={kpis.learnedBeforeCount}
          newLearnerCount={kpis.newLearnerCount}
          totalStudents={kpis.totalStudents}
        />
        <LaptopAvailabilityDonutChart
          hasLaptopCount={kpis.hasLaptopCount}
          noLaptopCount={kpis.noLaptopCount}
          totalStudents={kpis.totalStudents}
        />
      </div>

      {/* Bottom Row: Qualification Breakdown Bar Chart */}
      <div
        className="card-avoid-break"
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 14,
          background: '#ffffff',
          marginBottom: 14,
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
          Students by Previous Qualification
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10.5 }}>
          {demographics.qualifications.map((q) => (
            <div key={q.qual} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 90, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {q.qual}
              </span>
              <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(q.count / maxQualCount) * 100}%`,
                    height: '100%',
                    background: '#3b82f6',
                    borderRadius: 6,
                  }}
                />
              </div>
              <span style={{ width: 60, textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {q.count} ({q.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* EXECUTIVE CALLOUT BOX */}
      <div
        className="card-avoid-break"
        style={{
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1.5px solid #bfdbfe',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1e40af', marginBottom: 4 }}>
          Executive Training Intelligence Insights
        </div>
        <div style={{ fontSize: 11, color: '#1e3a8a', lineHeight: 1.5 }}>
          Enrolled batch strength is <strong>{kpis.totalStudents} students</strong>{showAttendance ? <> with a cumulative overall attendance rate of <strong>{kpis.overallAttendancePct}%</strong></> : null}.
          Demographics reflect <strong>{kpis.femaleCount} Female / {kpis.maleCount} Male</strong> students. Technical readiness indicates <strong>{kpis.hasLaptopCount} students ({Math.round((kpis.hasLaptopCount / Math.max(kpis.totalStudents, 1)) * 100)}%)</strong> possess personal laptops for practical lab assignments.
        </div>
      </div>
    </div>
  );
};

