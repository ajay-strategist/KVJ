import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectAttendanceKPIs } from '../daily-report.selectors';
import { AttendanceDonutChart } from '../charts/AttendanceDonutChart';
import { SessionAttendanceBarChart } from '../charts/SessionAttendanceBarChart';
import { AttendanceTrendLineChart } from '../charts/AttendanceTrendLineChart';
import { AttendanceGaugeChart } from '../charts/AttendanceGaugeChart';

export const AttendanceChartsSection: React.FC<SectionProps> = ({ data }) => {
  const kpis = selectAttendanceKPIs(data);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Attendance Visual Analytics</h2>

      <div className="report-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <AttendanceDonutChart present={kpis.present} absent={kpis.absent} />
        <AttendanceGaugeChart percentage={kpis.attendancePct} />
      </div>

      <div className="report-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SessionAttendanceBarChart sessions={data.sessions} />
        <AttendanceTrendLineChart sessions={data.sessions} />
      </div>
    </div>
  );
};
