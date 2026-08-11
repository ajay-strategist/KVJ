import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectDatewiseAbsentStudents } from '../daily-report.selectors';

export const AbsentStudentsSection: React.FC<SectionProps> = ({ data }) => {
  const datewiseAbsent = selectDatewiseAbsentStudents(data);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Date-wise Absent Students Registry</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Detailed log of absent students per session date for coordinator attendance follow-up.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {datewiseAbsent.map((item, idx) => (
          <div key={idx} style={{ border: `1px solid ${item.isWarning ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 6, padding: 10, background: item.isWarning ? '#fef2f2' : '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: item.isWarning ? '#b91c1c' : '#0f172a' }}>
                 Session Date: {item.date} {item.isWarning && '(Attendance <75%)'}
              </span>
              <span style={{ fontWeight: 700, color: '#64748b' }}>
                Absent Count: {item.absentStudents.length} Students ({item.attendancePct}% Present)
              </span>
            </div>

            {item.absentStudents.length === 0 ? (
              <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>✓ Full Attendance — 100% Present</div>
            ) : (
              // Dense multi-column list: one bordered chip per absentee used to
              // consume whole pages on large batches.
              <div style={{ columnCount: 3, columnGap: 14, fontSize: 10 }}>
                {item.absentStudents.map((st) => (
                  <div key={st.id} style={{ breakInside: 'avoid', lineHeight: 1.5 }}>
                    <span style={{ color: '#0f172a' }}>{st.name}</span>{' '}
                    <span style={{ color: '#94a3b8' }}>{st.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
