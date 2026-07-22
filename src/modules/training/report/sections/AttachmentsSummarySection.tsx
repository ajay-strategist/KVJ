import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const AttachmentsSummarySection: React.FC<SectionProps> = ({ data }) => {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Report Attachments Directory</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Supporting documentation and exported evidence attached to this daily report.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>File Name</th>
            <th style={{ padding: 8 }}>Document Type</th>
            <th style={{ padding: 8, textAlign: 'center' }}>File Size</th>
            <th style={{ padding: 8 }}>Uploaded By</th>
            <th style={{ padding: 8, textAlign: 'center' }}>Uploaded Date</th>
          </tr>
        </thead>
        <tbody>
          {data.attachments.map((att) => (
            <tr key={att.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: 8, fontWeight: 700, color: '#2563eb' }}>📁 {att.fileName}</td>
              <td style={{ padding: 8, color: '#475569' }}>{att.fileType}</td>
              <td style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>{att.fileSize}</td>
              <td style={{ padding: 8, color: '#0f172a' }}>{att.uploadedBy}</td>
              <td style={{ padding: 8, textAlign: 'center', color: '#64748b' }}>{att.uploadedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
