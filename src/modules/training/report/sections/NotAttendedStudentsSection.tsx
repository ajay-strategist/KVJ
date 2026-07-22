import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectNotAttendedStudents } from '../daily-report.selectors';

export const NotAttendedStudentsSection: React.FC<SectionProps> = ({ data, config }) => {
  const unattemptedList = selectNotAttendedStudents(data, config.selectedAssessmentIds);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Not-Attended Assessment Students Registry</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Students who missed or have not yet attempted selected assessments.
      </div>

      {unattemptedList.length === 0 ? (
        <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontWeight: 700, fontSize: 12 }}>
          ✓ All students have attempted selected assessments!
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
          <thead>
            <tr style={{ background: '#fffbebf', borderBottom: '2px solid #fde68a', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Register No. (Phone)</th>
              <th style={{ padding: 8 }}>Student Name</th>
              <th style={{ padding: 8 }}>Missed / Pending Assessment Title</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Attendance %</th>
              <th style={{ padding: 8 }}>Follow-up Status</th>
            </tr>
          </thead>
          <tbody>
            {unattemptedList.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fffbeb' }}>
                <td style={{ padding: 8, fontWeight: 700, color: '#2563eb' }}>{item.student.phone}</td>
                <td style={{ padding: 8, fontWeight: 700, color: '#0f172a' }}>{item.student.name}</td>
                <td style={{ padding: 8, fontWeight: 600, color: '#b45309' }}>
                  {item.missedAssessments.join(', ')}
                </td>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 700 }}>
                  {item.student.attendancePct}%
                </td>
                <td style={{ padding: 8, fontSize: 11, fontWeight: 600, color: '#d97706' }}>
                  Makeup Session Scheduled
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
