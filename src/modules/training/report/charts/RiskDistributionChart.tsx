import React from 'react';

interface RiskCategoryItem {
  reason: string;
  count: number;
  color: string;
}

interface RiskDistributionChartProps {
  items: RiskCategoryItem[];
  title?: string;
  caption?: string;
}

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({
  items,
  title = 'V13. Student Risk Distribution by Reason',
  caption = 'Categorized risk breakdown for targeted intervention',
}) => {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="report-block" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, idx) => {
          const pct = Math.round((item.count / max) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
              <span style={{ width: 140, fontWeight: 600, color: '#334155', textAlign: 'right' }}>{item.reason}</span>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    background: item.color,
                    height: '100%',
                    borderRadius: 4,
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '20px',
                    paddingLeft: 8,
                    minWidth: item.count > 0 ? 24 : 0,
                  }}
                >
                  {item.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
