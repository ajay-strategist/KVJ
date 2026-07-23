import React from 'react';

interface AverageScoreGaugeChartProps {
  score: number;
  maxScore?: number;
  passMarkPercent?: number;
  title?: string;
  caption?: string;
}

export const AverageScoreGaugeChart: React.FC<AverageScoreGaugeChartProps> = ({
  score,
  maxScore = 100,
  passMarkPercent = 84,
  title = 'V7. Average Score Gauge',
  caption = 'Batch Mean Performance',
}) => {
  const pct = Math.min(Math.max(Math.round((score / maxScore) * 100), 0), 100);
  const angle = (pct / 100) * 180;
  const isPassed = pct >= passMarkPercent;
  const color = isPassed ? '#10b981' : '#f59e0b';

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{caption}</div>

      <svg viewBox="0 0 160 95" style={{ width: 140, height: 85, margin: '0 auto', display: 'block' }}>
        <title>{`Average Score: ${pct}%`}</title>
        <path d="M 15 80 A 65 65 0 0 1 145 80" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
        <path
          d="M 15 80 A 65 65 0 0 1 145 80"
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray="204"
          strokeDashoffset={204 - (pct / 100) * 204}
        />
        <g transform={`rotate(${angle - 90} 80 80)`}>
          <line x1="80" y1="80" x2="80" y2="25" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="80" r="5" fill="#0f172a" />
        </g>
        <text x="80" y="76" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f172a">
          {score} / {maxScore}
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 2 }}>
        {isPassed ? `Above Pass Target (≥${passMarkPercent}%)` : `Below Pass Target (${passMarkPercent}%)`}
      </div>
    </div>
  );
};
