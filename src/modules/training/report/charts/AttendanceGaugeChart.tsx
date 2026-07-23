import React from 'react';

interface AttendanceGaugeChartProps {
  percentage: number;
  title?: string;
  caption?: string;
}

export const AttendanceGaugeChart: React.FC<AttendanceGaugeChartProps> = ({
  percentage,
  title = 'V4. Attendance % Gauge',
  caption = 'Overall Batch Attendance Rate',
}) => {
  const pct = Math.min(Math.max(percentage, 0), 100);
  const angle = (pct / 100) * 180; // 0 to 180 deg

  const color = pct >= 85 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{caption}</div>

      <svg viewBox="0 0 160 95" style={{ width: 140, height: 85, margin: '0 auto', display: 'block' }}>
        <title>{`Attendance Gauge: ${pct}%`}</title>
        {/* Background Arc */}
        <path d="M 15 80 A 65 65 0 0 1 145 80" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
        
        {/* Color Arc */}
        <path
          d="M 15 80 A 65 65 0 0 1 145 80"
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray="204"
          strokeDashoffset={204 - (pct / 100) * 204}
        />

        {/* Needle Line */}
        <g transform={`rotate(${angle - 90} 80 80)`}>
          <line x1="80" y1="80" x2="80" y2="25" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="80" r="5" fill="#0f172a" />
        </g>

        {/* Value Text */}
        <text x="80" y="76" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f172a">
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 2 }}>
        {pct >= 85 ? 'Excellent' : pct >= 75 ? 'Satisfactory' : 'Needs Attention (<75%)'}
      </div>
    </div>
  );
};
