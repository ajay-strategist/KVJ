import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectToppers } from '../daily-report.selectors';

export const ToppersSection: React.FC<SectionProps> = ({ data }) => {
  const { top3, tableList } = selectToppers(data);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <div style={{ borderBottom: '1.5px solid #cbd5e1', paddingBottom: 6, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
          Top Performing Students &amp; Honor Roll
        </h2>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Ranked by Priority 1: Earliest Exam Date &rarr; Priority 2: Highest Final Mark &rarr; Priority 3: Lowest Exam Time.
        </span>
      </div>

      {/* TOP 3 PROMINENT CARDS */}
      <div
        className="card-avoid-break"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 16,
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        {top3.map((item) => (
          <div
            key={item.student.id}
            style={{
              background:
                item.rank === 1
                  ? 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)'
                  : item.rank === 2
                  ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
                  : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border:
                item.rank === 1
                  ? '2px solid #eab308'
                  : item.rank === 2
                  ? '2px solid #94a3b8'
                  : '2px solid #f97316',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{item.medal}</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: item.rank === 1 ? '#a16207' : item.rank === 2 ? '#475569' : '#c2410c',
                marginBottom: 6,
              }}
            >
              Rank {item.rankLabel}
            </div>

            {item.student.avatarUrl ? (
              <img
                src={item.student.avatarUrl}
                alt={item.student.name}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', marginBottom: 6 }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#1e40af',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                {item.student.name.charAt(0)}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {item.student.name}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{item.student.phone}</div>

            <div
              style={{
                marginTop: 10,
                width: '100%',
                paddingTop: 8,
                borderTop: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: 10.5,
              }}
            >
              <div>
                <div style={{ fontSize: 8.5, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Mark
                </div>
                <div style={{ fontWeight: 900, color: '#15803d' }}>
                  {item.mark} / {item.examMax}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 8.5, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Time
                </div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.timeMins} min</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TOP STUDENTS DETAILED TABLE */}
      <div className="card-avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Top Students Performance Register
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead>
            <tr style={{ background: '#1e40af', color: '#ffffff', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', width: 45, textAlign: 'center' }}>Rank</th>
              <th style={{ padding: '6px 8px' }}>Student</th>
              <th style={{ padding: '6px 8px' }}>Batch</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Mock Mark</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Practice Time</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Final Exam Mark</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Exam Time</th>
            </tr>
          </thead>
          <tbody>
            {tableList.slice(0, 10).map((row, idx) => (
              <tr
                key={row.student.id}
                style={{
                  background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 800, color: row.rank <= 3 ? '#2563eb' : '#64748b' }}>
                  #{row.rank}
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#0f172a' }}>
                  {row.student.name}
                </td>
                <td style={{ padding: '5px 8px', color: '#475569' }}>{row.batch}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>
                  {row.mockMark} / {row.examMax}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#475569' }}>
                  {row.practiceTimeHours} hrs
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>
                  {row.finalExamMark} / {row.examMax}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#0f172a' }}>
                  {row.examTimeMinutes} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
