import React from 'react';
import type { DailyReportData, DailyReportConfig } from '../daily-report.types';
import { selectCoverHeroKPIs } from '../daily-report.selectors';

export interface SectionProps {
  data: DailyReportData;
  config: DailyReportConfig;
}

export const CoverPageSection: React.FC<SectionProps> = ({ data }) => {
  const hero = selectCoverHeroKPIs(data);

  return (
    <div style={{ padding: '24px 0', borderBottom: '2px solid #e2e8f0', marginBottom: 24, pageBreakAfter: 'always' }}>
      {/* Cover Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <img src="/logo.png" alt="KVJ Logo" style={{ height: 48, width: 'auto', marginBottom: 8 }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Daily Training Report
          </h1>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginTop: 2 }}>
            {data.collegeName} — {data.courseName}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
          <div><strong>Report Date:</strong> {data.reportDate}</div>
          <div><strong>Batch Code:</strong> {data.batchCode}</div>
          <div><strong>Academic Year:</strong> {data.academicYear}</div>
        </div>
      </div>

      {/* Identity Banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 12 }}>
          <div><span style={{ color: '#64748b' }}>Batch Name:</span> <strong style={{ color: '#0f172a' }}>{data.batchName}</strong></div>
          <div><span style={{ color: '#64748b' }}>Trainer:</span> <strong style={{ color: '#0f172a' }}>{data.trainerName}</strong></div>
          <div><span style={{ color: '#64748b' }}>Coordinator:</span> <strong style={{ color: '#0f172a' }}>{data.coordinatorName}</strong></div>
        </div>
      </div>

      {/* 7 Cover Hero Tiles */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Daily Executive Key Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Overall Attendance %</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46', marginTop: 4 }}>{hero.overallAttendancePct}%</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>Assessment Progress %</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginTop: 4 }}>{hero.assessmentProgressPct}%</div>
        </div>
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9' }}>Training Completion %</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#5b21b6', marginTop: 4 }}>{hero.trainingCompletionPct}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Total Enrolled Students</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{hero.totalStudents}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>Present Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#166534', marginTop: 4 }}>{hero.presentToday}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Absent Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#991b1b', marginTop: 4 }}>{hero.absentToday}</div>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #34d399', borderRadius: 8, padding: 12, textAlign: 'center', gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Eligible for Final Exam</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46', marginTop: 4 }}>{hero.eligibleCount} / {hero.totalStudents} Students</div>
        </div>
      </div>
    </div>
  );
};
