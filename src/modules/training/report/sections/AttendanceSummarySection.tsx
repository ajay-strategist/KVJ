import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectAttendanceKPIs } from '../daily-report.selectors';

export const AttendanceSummarySection: React.FC<SectionProps> = ({ data }) => {
  const kpis = selectAttendanceKPIs(data);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Attendance Summary</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Present Today</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>{kpis.present}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Absent Today</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>{kpis.absent}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Overall Attendance %</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>{kpis.attendancePct}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Late Entries</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{kpis.lateEntries}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Early Check-outs</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#475569', marginTop: 2 }}>{kpis.earlyCheckouts}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Average Attendance</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{kpis.averageAttendance}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Highest Session %</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>{kpis.highestAttendance}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Lowest Session %</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>{kpis.lowestAttendance}%</div>
        </div>
      </div>
    </div>
  );
};
