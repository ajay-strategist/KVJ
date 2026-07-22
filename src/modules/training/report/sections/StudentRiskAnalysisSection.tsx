import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectRiskDistribution } from '../daily-report.selectors';
import { RiskDistributionChart } from '../charts/RiskDistributionChart';

export const StudentRiskAnalysisSection: React.FC<SectionProps> = ({ data }) => {
  const riskCategories = selectRiskDistribution(data);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Student Risk Analysis & Early Intervention</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Identified students requiring academic or attendance intervention prior to final certification.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <RiskDistributionChart items={riskCategories} />

        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 800, color: '#9f1239' }}>⚠️ Intervention Protocol</h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#881337', lineHeight: 1.5 }}>
            <li><strong>High Severity:</strong> Mandatory 1-on-1 counseling + immediate retest assignment.</li>
            <li><strong>Low Attendance (&lt;75%):</strong> Notification sent to College Coordinator for attendance tracking.</li>
            <li><strong>Failed Assessments:</strong> Dedicated remedial workshop before final exam retest.</li>
          </ul>
        </div>
      </div>

      {/* Risk Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, border: '1px solid #e2e8f0' }}>
        <thead>
          <tr style={{ background: '#fff1f2', borderBottom: '2px solid #fecdd3', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Register No. (Phone)</th>
            <th style={{ padding: 6 }}>Student Name</th>
            <th style={{ padding: 6 }}>Risk Reason</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Attendance %</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Failed Exams</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Severity</th>
          </tr>
        </thead>
        <tbody>
          {data.riskItems.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fff5f5' }}>
              <td style={{ padding: 6, fontWeight: 700, color: '#2563eb' }}>{item.registerNo}</td>
              <td style={{ padding: 6, fontWeight: 700, color: '#9f1239' }}>{item.studentName}</td>
              <td style={{ padding: 6, fontWeight: 600, color: '#be123c' }}>{item.riskReason}</td>
              <td style={{ padding: 6, textAlign: 'center', fontWeight: 800, color: item.attendancePct < 75 ? '#dc2626' : '#0f172a' }}>
                {item.attendancePct}%
              </td>
              <td style={{ padding: 6, textAlign: 'center', fontWeight: 700 }}>{item.failedCount}</td>
              <td style={{ padding: 6, textAlign: 'center' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: item.severity === 'High' ? '#ef4444' : '#f59e0b',
                    color: '#ffffff',
                  }}
                >
                  {item.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
