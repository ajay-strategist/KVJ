import React from 'react';

interface ScoreHistogramChartProps {
  buckets: Array<{ label: string; count: number }>;
  passMarkPercent: number;
  title?: string;
  caption?: string;
}

export const ScoreHistogramChart: React.FC<ScoreHistogramChartProps> = ({
  buckets,
  passMarkPercent,
  title = 'V5. Score Distribution Histogram',
  caption = `Vertical line shows pass mark threshold (${passMarkPercent}%).`,
}) => {
  if (!buckets || buckets.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No score data for this assessment</div>;
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 5);
  const chartH = 110;

  // Calculate pass mark X position percentage (0 to 100)
  const passMarkX = passMarkPercent;

  return (
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff', position: 'relative' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ position: 'relative', width: '100%', height: chartH + 28, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
        {/* Pass Mark Vertical Reference Line */}
        <div
          style={{
            position: 'absolute',
            left: `${passMarkX}%`,
            top: 0,
            bottom: 24,
            width: 2,
            borderLeft: '2px dashed #ef4444',
            zIndex: 10,
          }}
        >
          <span style={{ position: 'absolute', top: 0, right: 4, fontSize: 9, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>
            Pass Mark: {passMarkPercent}%
          </span>
        </div>

        {/* Histogram Bars */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: '100%', justifyContent: 'space-between' }}>
          {buckets.map((b, idx) => {
            const barH = Math.round((b.count / maxCount) * chartH);
            const bucketMin = idx * 10;
            const isPassedBucket = bucketMin >= passMarkPercent;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div
                  title={`Range ${b.label}: ${b.count} students`}
                  style={{
                    width: '90%',
                    height: `${barH}px`,
                    background: isPassedBucket ? '#10b981' : '#f59e0b',
                    borderRadius: '3px 3px 0 0',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    lineHeight: `${Math.max(barH, 12)}px`,
                    overflow: 'hidden',
                  }}
                >
                  {barH > 12 ? b.count : ''}
                </div>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: '#475569', marginTop: 4 }}>{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Passed Scores (≥{passMarkPercent}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Below Pass Mark</span>
        </div>
      </div>
    </div>
  );
};
