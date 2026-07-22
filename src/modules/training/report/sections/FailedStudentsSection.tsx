import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectFailedStudents } from '../daily-report.selectors';

export const FailedStudentsSection: React.FC<SectionProps> = ({ data, config }) => {
  const failedList = selectFailedStudents(data, config.selectedAssessmentIds);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Failed Assessment Students Registry</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Students who scored below the required pass mark threshold for selected assessments.
      </div>

      {failedList.length === 0 ? (
        <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontWeight: 700, fontSize: 12 }}>
          ✓ All students have successfully passed selected assessments!
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
          <thead>
            <tr style={{ background: '#fef2f2', borderBottom: '2px solid #fca5a5', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Register No. (Phone)</th>
              <th style={{ padding: 8 }}>Student Name</th>
              <th style={{ padding: 8 }}>Failed Assessment Title</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Score Obtained</th>
              <th style={{ padding: 8, textAlign: 'center' }}>Required Pass Mark</th>
              <th style={{ padding: 8 }}>Remedial Action Needed</th>
            </tr>
          </thead>
          <tbody>
            {failedList.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fff5f5' }}>
                <td style={{ padding: 8, fontWeight: 700, color: '#2563eb' }}>{item.student.phone}</td>
                <td style={{ padding: 8, fontWeight: 700, color: '#0f172a' }}>{item.student.name}</td>
                <td style={{ padding: 8 }}>
                  {item.failedAssessments.map((fa, i) => (
                    <div key={i} style={{ fontWeight: 600, color: '#b91c1c' }}>{fa.title}</div>
                  ))}
                </td>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 800, color: '#dc2626' }}>
                  {item.failedAssessments.map((fa) => fa.score).join(', ')}%
                </td>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>
                  {item.failedAssessments.map((fa) => fa.passMark).join('%, ')}%
                </td>
                <td style={{ padding: 8, fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                  Remedial Retest Required
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
