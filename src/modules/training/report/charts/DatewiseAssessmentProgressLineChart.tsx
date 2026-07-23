import React from 'react';
import type { DatewiseAssessmentProgressRow } from '../daily-report.selectors';

interface DatewiseAssessmentProgressLineChartProps {
  rows: DatewiseAssessmentProgressRow[];
  title?: string;
  caption?: string;
  targetPassPct?: number;
}

export const DatewiseAssessmentProgressLineChart: React.FC<DatewiseAssessmentProgressLineChartProps> = ({
  rows,
  title = '📈 Date-Wise Pass Rate Progress Trend',
  caption = 'Tracks cumulative overall pass % progress across exam dates.',
  targetPassPct = 84,
}) => {
  if (!rows || rows.length === 0) {
    return <div style={{ textAlign: 'center', padding: 14, color: '#64748b', fontSize: 11 }}>No date-wise data available</div>;
  }

  const width = 480;
  const height = 135;
  const padding = { top: 20, right: 30, bottom: 25, left: 35 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = rows.map((r, i) => {
    const x = padding.left + (i / Math.max(rows.length - 1, 1)) * innerW;
    const y = padding.top + innerH - (r.cumulativePassPct / 100) * innerH;
    return { x, y, pct: r.cumulativePassPct, date: r.date, cleared: r.cumulativePassed, total: r.enrolledTotal };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const targetY = padding.top + innerH - (targetPassPct / 100) * innerH;

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6 }}>{caption}</div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Date-wise assessment progress line chart">
        <title>Date-wise assessment pass rate trend</title>

        {/* Y Axis Grid lines (0, 50, 100) */}
        {[0, 50, 100].map((val) => {
          const y = padding.top + innerH - (val / 100) * innerH;
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill="#64748b">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Target Line */}
        <line x1={padding.left} y1={targetY} x2={width - padding.right} y2={targetY} stroke="#16a34a" strokeDasharray="3 3" strokeWidth="1.5" />
        <text x={width - padding.right} y={targetY - 3} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#16a34a">
          Target ({targetPassPct}%)
        </text>

        {/* Trend Polyline */}
        {points.length > 1 && (
          <polyline points={polylinePoints} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data Points */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
            <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fontWeight="800" fill="#1e293b">
              {p.pct}% ({p.cleared})
            </text>
            <text x={p.x} y={height - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill="#475569">
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
