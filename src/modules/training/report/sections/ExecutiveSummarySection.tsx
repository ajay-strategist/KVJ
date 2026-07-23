import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectExecutiveKPIs } from '../daily-report.selectors';
import { AttendanceGaugeChart } from '../charts/AttendanceGaugeChart';
import {
  GenderDonutChart,
  PriorKnowledgeDonutChart,
  LaptopAvailabilityDonutChart,
} from '../charts/DemographicsDonutCharts';

export const ExecutiveSummarySection: React.FC<SectionProps> = ({ data }) => {
  const kpis = selectExecutiveKPIs(data);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        📊 Executive Summary & Batch Intelligence Overview
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
        Core batch profile, enrolled strength metrics, attendance gauge, and student demographics.
      </div>

      {/* Top Row: Total Students KPI Card + Overall Attendance Gauge Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        
        {/* Total Students KPI Card */}
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
            🎓 Enrolled Batch Strength
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', marginTop: 6, lineHeight: 1 }}>
            {kpis.totalStudents} <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Enrolled Students</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginTop: 10 }}>
            Active strength for batch: {data.batchCode} ({data.collegeName})
          </div>
        </div>

        {/* Gauge Chart for Overall Batch Attendance % */}
        <div>
          <AttendanceGaugeChart
            percentage={kpis.overallAttendancePct}
            title="Overall Batch Attendance %"
            caption="Cumulative rate across all logged sessions"
          />
        </div>
      </div>

      {/* Middle Row: Donut Charts Grid (Gender, Prior Course Knowledge, Laptop Availability) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
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

      {/* EXECUTIVE TRAINING INTELLIGENCE CALLOUT BOX */}
      <div
        style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1.5px solid #bfdbfe',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#1e40af', marginBottom: 4 }}>
          <span>💡</span> Executive Training Intelligence Insights
        </div>
        <div style={{ fontSize: 11, color: '#1e3a8a', lineHeight: 1.5 }}>
          Enrolled batch strength is <strong>{kpis.totalStudents} students</strong> with a cumulative overall attendance rate of <strong>{kpis.overallAttendancePct}%</strong>.
          Demographics reflect <strong>{kpis.femaleCount} Female / {kpis.maleCount} Male</strong> students. Technical readiness indicates <strong>{kpis.hasLaptopCount} students ({Math.round((kpis.hasLaptopCount / Math.max(kpis.totalStudents, 1)) * 100)}%)</strong> possess personal laptops for practical lab assignments.
        </div>
      </div>
    </div>
  );
};
