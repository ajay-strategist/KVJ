import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const BatchInfoSection: React.FC<SectionProps> = ({ data }) => {
  const cert = data.certificateStatus[0] || {
    printed: false,
    deliveredToCollege: false,
    printedCount: 0,
    totalCount: data.totalStudents,
    remarks: 'N/A',
  };

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Batch & Institution Profile</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Batch Metadata Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '40%' }}>Organization / College:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.collegeName}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Course Program:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.courseName}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Batch Code / Name:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.batchCode} ({data.batchName})</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Academic Year:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.academicYear}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Lead Trainer:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.trainerName}</td>
            </tr>
          </tbody>
        </table>

        {/* Coordinator & Pass criteria */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '40%' }}>College Coordinator:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.coordinatorName}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Final Exam Pass Mark:</td>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#16a34a' }}>
                {data.finalExamPassMarkPercent}% (from Course Catalog)
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Course Max Marks:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{data.courseMaxMarks} Marks</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Prerequisite Pass Mark:</td>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>84% default (trainer overridable)</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Total Enrolled:</td>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{data.totalStudents} Students</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Batch Certificate Status (One block, not per student) */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#166534', margin: '0 0 8px 0' }}>📜 Batch Certificate Delivery Status</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
          <div><span style={{ color: '#15803d' }}>Printed Status:</span> <strong>{cert.printed ? `Yes (${cert.printedCount}/${cert.totalCount})` : 'Pending'}</strong></div>
          <div><span style={{ color: '#15803d' }}>Delivered to College:</span> <strong>{cert.deliveredToCollege ? 'Delivered' : 'Pending Dispatch'}</strong></div>
          <div><span style={{ color: '#15803d' }}>Target Delivery Date:</span> <strong>{cert.deliveryDate || 'TBD'}</strong></div>
          <div><span style={{ color: '#15803d' }}>Remarks:</span> <strong>{cert.remarks || '—'}</strong></div>
        </div>
      </div>
    </div>
  );
};
