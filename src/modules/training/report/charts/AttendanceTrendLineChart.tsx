import React from 'react';

interface AttendanceTrendLineChartProps {
  sessions: Array<{ date: string; attendancePct: number }>;
  title?: string;
  caption?: string;
}

export const AttendanceTrendLineChart: React.FC<AttendanceTrendLineChartProps> = ({
  sessions,
  title = 'V3. Date-wise Attendance Trend',
  caption = 'Dashed line marks 75% warning threshold. Dates below 75% highlighted in red.',
}) => {
  if (!sessions || sessions.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No data for this period</div>;
  }

  const width = 500;
  const height = 150;
  const padding = { top: 20, right: 30, bottom: 30, left: 35 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = sessions.map((s, i) => {
    const x = padding.left + (i / Math.max(sessions.length - 1, 1)) * innerW;
    const y = padding.top + innerH - (s.attendancePct / 100) * innerH;
    return { x, y, pct: s.attendancePct, date: s.date };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const refY75 = padding.top + innerH - (75 / 100) * innerH;

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{caption}</div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Attendance trend line chart">
        <title>Date-wise attendance trend line chart</title>

        {/* Y Axis Grid lines (0, 50, 75, 100) */}
        {[0, 50, 75, 100].map((val) => {
          const y = padding.top + innerH - (val / 100) * innerH;
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={val === 75 ? '#ef4444' : '#e2e8f0'} strokeDasharray={val === 75 ? '4 4' : 'none'} strokeWidth={val === 75 ? 1.5 : 1} />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="9" fontWeight={val === 75 ? '700' : '500'} fill={val === 75 ? '#ef4444' : '#64748b'}>
                {val}%
              </text>
            </g>
          );
        })}

        {/* 75% Warning Ref Line Label */}
        <text x={width - padding.right} y={refY75 - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="#ef4444">
          75% Warning Threshold
        </text>

        {/* Trend Polyline */}
        <polyline points={polylinePoints} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Points */}
        {points.map((p, idx) => {
          const isWarning = p.pct < 75;
          return (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r={isWarning ? 5 : 4} fill={isWarning ? '#ef4444' : '#2563eb'} stroke="#ffffff" strokeWidth="1.5" />
              {/* Visible Data Label */}
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={isWarning ? '#dc2626' : '#1e293b'}>
                {p.pct}%
              </text>
              {/* Date Label */}
              <text x={p.x} y={height - 8} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#475569">
                {p.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
