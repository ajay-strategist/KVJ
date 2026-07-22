import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const StudentAttendanceDetailsSection: React.FC<SectionProps> = ({ data }) => {
  const sortedStudents = [...data.students].sort((a, b) => b.attendancePct - a.attendancePct);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Student Attendance Breakdown</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Individual attendance stats across all sessions. Students below 75% are highlighted in red.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Register No. (Phone)</th>
            <th style={{ padding: 8 }}>Student Name</th>
            <th style={{ padding: 8 }}>Email Address</th>
            <th style={{ padding: 8, textAlign: 'center' }}>Sessions Attended</th>
            <th style={{ padding: 8, textAlign: 'center' }}>Total Sessions</th>
            <th style={{ padding: 8, textAlign: 'center' }}>Attendance %</th>
            <th style={{ padding: 8 }}>Status Warning</th>
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((st, idx) => {
            const isWarning = st.attendancePct < 75;
            const rowBg = isWarning ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            const textColor = isWarning ? '#b91c1c' : '#0f172a';

            return (
              <tr key={st.id} style={{ borderBottom: '1px solid #e2e8f0', background: rowBg }}>
                <td style={{ padding: 8, fontWeight: 700, color: '#2563eb' }}>{st.phone}</td>
                <td style={{ padding: 8, fontWeight: 700, color: textColor }}>{st.name}</td>
                <td style={{ padding: 8, color: '#475569' }}>{st.email}</td>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{st.totalPresent}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{st.totalSessions}</td>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 800, color: textColor }}>
                  {st.attendancePct}%
                </td>
                <td style={{ padding: 8, fontWeight: 700, fontSize: 11, color: isWarning ? '#b91c1c' : '#16a34a' }}>
                  {isWarning ? '⚠️ Low (<75%)' : '✓ Normal'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
