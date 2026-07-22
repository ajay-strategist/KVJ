import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectAttendanceKPIs, selectDatewiseAbsentStudents } from '../daily-report.selectors';
import { AttendanceTrendLineChart } from '../charts/AttendanceTrendLineChart';

export const DatewiseAttendanceSection: React.FC<SectionProps> = ({ data }) => {
  const kpis = selectAttendanceKPIs(data);
  const datewiseAbsent = selectDatewiseAbsentStudents(data);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          📅 Date-Wise Batch Attendance & Trend Analysis
        </h2>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 6 }}>
          Overall Batch Attendance: {kpis.attendancePct}%
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        Session-by-session attendance logs with trend chart and date-wise absentees directory.
      </div>

      {/* Grid: Table + Trend Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginBottom: 14 }}>
        
        {/* Table */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: 6 }}>Session Date</th>
                <th style={{ padding: 6, textAlign: 'center' }}>Enrolled</th>
                <th style={{ padding: 6, textAlign: 'center' }}>Present</th>
                <th style={{ padding: 6, textAlign: 'center' }}>Absent</th>
                <th style={{ padding: 6, textAlign: 'center' }}>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((sess, idx) => {
                const isWarning = sess.attendancePct < 75;
                const rowBg = isWarning ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const textColor = isWarning ? '#b91c1c' : '#0f172a';

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: rowBg }}>
                    <td style={{ padding: 6, fontWeight: 700, color: textColor }}>{sess.date}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{sess.totalStudents}</td>
                    <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{sess.presentCount}</td>
                    <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: isWarning ? '#dc2626' : '#64748b' }}>{sess.absentCount}</td>
                    <td style={{ padding: 6, textAlign: 'center', fontWeight: 800, color: textColor }}>
                      {sess.attendancePct}% {isWarning && '⚠️'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Trend Chart */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 }}>
          <AttendanceTrendLineChart sessions={data.sessions} />
        </div>
      </div>

      {/* Date-wise Absentees Registry */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>📋 Date-Wise Absentees List</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {datewiseAbsent.map((item, idx) => (
          <div key={idx} style={{ border: `1px solid ${item.isWarning ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 6, padding: '6px 10px', background: item.isWarning ? '#fef2f2' : '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: item.isWarning ? '#b91c1c' : '#0f172a' }}>
                📅 Date: {item.date} {item.isWarning && '(⚠️ Attendance <75%)'}
              </span>
              <span style={{ fontWeight: 700, color: '#64748b' }}>
                Absentees: {item.absentStudents.length} Students ({item.attendancePct}% Present)
              </span>
            </div>

            {item.absentStudents.length === 0 ? (
              <div style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 600 }}>✓ 100% Full Attendance</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {item.absentStudents.map((st) => (
                  <span key={st.id} style={{ background: item.isWarning ? '#ffe4e6' : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', fontSize: 10.5 }}>
                    <strong style={{ color: '#0f172a' }}>{st.name}</strong> <span style={{ color: '#64748b' }}>({st.phone})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
