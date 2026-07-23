import React from 'react';

interface Milestone {
  date: string;
  sessionNo: number;
  topicCovered: string;
  practicalDone: boolean;
  status: 'Completed' | 'In Progress' | 'Upcoming';
}

interface DailyProgressTimelineChartProps {
  milestones: Milestone[];
  title?: string;
  caption?: string;
}

export const DailyProgressTimelineChart: React.FC<DailyProgressTimelineChartProps> = ({
  milestones,
  title = 'V12. Daily Curriculum Progress Milestone Strip',
  caption = 'Session-by-Session Curriculum Coverage',
}) => {
  if (!milestones || milestones.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No milestone data</div>;
  }

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {milestones.map((m) => {
          const isComp = m.status === 'Completed';
          const isInProg = m.status === 'In Progress';
          const bg = isComp ? '#ecfdf5' : isInProg ? '#fffbebf' : '#f8fafc';
          const border = isComp ? '#10b981' : isInProg ? '#f59e0b' : '#cbd5e1';
          const textColor = isComp ? '#065f46' : isInProg ? '#92400e' : '#475569';

          return (
            <div
              key={m.sessionNo}
              style={{
                border: `1px solid ${border}`,
                background: bg,
                borderRadius: 6,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, fontWeight: 700, color: textColor }}>
                <span>Day {m.sessionNo}</span>
                <span>{m.date.slice(5)}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', lineHeight: 1.2, height: 32, overflow: 'hidden' }}>
                {m.topicCovered}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 9.5, fontWeight: 700 }}>
                <span style={{ color: m.practicalDone ? '#059669' : '#64748b' }}>
                  {m.practicalDone ? '⚡ Practical Done' : '📖 Theory'}
                </span>
                <span style={{ color: textColor }}>{m.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
