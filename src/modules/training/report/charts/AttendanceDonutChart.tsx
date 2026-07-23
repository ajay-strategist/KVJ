import React from 'react';

interface AttendanceDonutChartProps {
  present: number;
  absent: number;
  title?: string;
  caption?: string;
}

export const AttendanceDonutChart: React.FC<AttendanceDonutChartProps> = ({
  present,
  absent,
  title = 'V1. Attendance Breakdown',
  caption = 'Source: Daily Session Registry',
}) => {
  const total = present + absent;
  if (total === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No data for this period</div>;
  }

  const presentPct = Math.round((present / total) * 100);
  const absentPct = 100 - presentPct;

  // SVG Donut calculation using strokeDasharray
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const presentStroke = (presentPct / 100) * circumference;
  const absentStroke = circumference - presentStroke;

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 16 }}>
        <svg viewBox="0 0 100 100" style={{ width: 130, height: 130 }} role="img" aria-label={`Attendance donut: ${presentPct}% Present`}>
          <title>{`${presentPct}% Present, ${absentPct}% Absent`}</title>
          {/* Background Ring */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
          
          {/* Present Arc (Green) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth="16"
            strokeDasharray={`${presentStroke} ${circumference}`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />

          {/* Absent Arc (Red) */}
          {absent > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="16"
              strokeDasharray={`${absentStroke} ${circumference}`}
              strokeDashoffset={`-${presentStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          {/* Centre % Text */}
          <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">
            {presentPct}%
          </text>
          <text x="50" y="62" textAnchor="middle" fontSize="9" fontWeight="600" fill="#64748b">
            PRESENT
          </text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 3, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Present: {present} ({presentPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Absent: {absent} ({absentPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
