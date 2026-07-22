import React from 'react';

interface SessionAttendanceBarChartProps {
  sessions: Array<{ date: string; presentCount: number; absentCount: number }>;
  title?: string;
  caption?: string;
}

export const SessionAttendanceBarChart: React.FC<SessionAttendanceBarChartProps> = ({
  sessions,
  title = 'V2. Session-wise Present vs Absent',
  caption = 'Source: Daily Attendance Registry',
}) => {
  if (!sessions || sessions.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No data for this period</div>;
  }

  const maxStudents = Math.max(...sessions.map((s) => s.presentCount + s.absentCount), 10);
  const chartHeight = 110;

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: chartHeight + 28, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
        {sessions.map((s, idx) => {
          const presentH = Math.round((s.presentCount / maxStudents) * chartHeight);
          const absentH = Math.round((s.absentCount / maxStudents) * chartHeight);
          const dateLabel = s.date.slice(5); // MM-DD

          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                {/* Present Bar */}
                <div
                  title={`Present: ${s.presentCount}`}
                  style={{
                    width: '40%',
                    maxWidth: 16,
                    height: `${presentH}px`,
                    background: '#10b981',
                    borderRadius: '3px 3px 0 0',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    lineHeight: `${Math.max(presentH, 12)}px`,
                    overflow: 'hidden',
                  }}
                >
                  {presentH > 14 ? s.presentCount : ''}
                </div>
                {/* Absent Bar */}
                <div
                  title={`Absent: ${s.absentCount}`}
                  style={{
                    width: '40%',
                    maxWidth: 16,
                    height: `${absentH}px`,
                    background: '#ef4444',
                    borderRadius: '3px 3px 0 0',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    lineHeight: `${Math.max(absentH, 12)}px`,
                    overflow: 'hidden',
                  }}
                >
                  {absentH > 14 ? s.absentCount : ''}
                </div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: '#475569', marginTop: 4 }}>{dateLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Present</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Absent</span>
        </div>
      </div>
    </div>
  );
};
