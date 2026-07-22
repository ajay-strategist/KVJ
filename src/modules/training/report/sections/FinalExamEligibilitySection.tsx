import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectEligibilityKPIs } from '../daily-report.selectors';

export const FinalExamEligibilitySection: React.FC<SectionProps> = ({ data, config }) => {
  const kpis = selectEligibilityKPIs(data, config.selectedAssessmentIds);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Final Exam Eligibility Status</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Official eligibility determination for the Final Certification Exam.
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Eligible Students</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46', marginTop: 2 }}>{kpis.eligibleCount}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Not Eligible Students</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#991b1b', marginTop: 2 }}>{kpis.notEligibleCount}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>Batch Eligibility Rate</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', marginTop: 2 }}>{kpis.eligibilityPct}%</div>
        </div>
      </div>

      {/* Criteria Breakdown */}
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📋 Prerequisite Assessment Criteria Applied</h4>
        <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}>
          Eligibility requires passing all selected prerequisite assessments at or above their respective pass mark thresholds:
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#0f172a' }}>
          {kpis.requiredAssessments.map((ass, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <strong>{ass.title}:</strong> Pass mark = <strong>{ass.passMarkPercent}%</strong> {ass.isCustomPassMark ? '(custom trainer override)' : '(default)'}
            </li>
          ))}
          <li style={{ marginTop: 6, fontWeight: 700, color: '#16a34a' }}>
            Final Certification Exam Pass Criteria: {data.finalExamPassMarkPercent}% (Course Catalog)
          </li>
        </ul>
        <div style={{ marginTop: 10, fontSize: 11, fontStyle: 'italic', color: '#64748b', background: '#ffffff', padding: 6, borderRadius: 4, border: '1px stroke #e2e8f0' }}>
          ℹ️ Note: Attendance is logged for institutional monitoring but does NOT restrict Final Exam eligibility per KVJ policy.
        </div>
      </div>

      {/* Ineligible Table */}
      {kpis.notEligibleCount > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e2e8f0' }}>
          <thead>
            <tr style={{ background: '#fef2f2', borderBottom: '2px solid #fca5a5', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Register No. (Phone)</th>
              <th style={{ padding: 8 }}>Student Name</th>
              <th style={{ padding: 8 }}>Ineligibility Reason</th>
              <th style={{ padding: 8 }}>Remedial Action Required</th>
            </tr>
          </thead>
          <tbody>
            {data.students
              .filter((st) => st.finalExamEligibility === 'Not Eligible')
              .map((st, idx) => (
                <tr key={st.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fff5f5' }}>
                  <td style={{ padding: 8, fontWeight: 700, color: '#2563eb' }}>{st.phone}</td>
                  <td style={{ padding: 8, fontWeight: 700, color: '#b91c1c' }}>{st.name}</td>
                  <td style={{ padding: 8, color: '#475569' }}>{st.eligibilityReason || 'Failed prerequisite assessment(s)'}</td>
                  <td style={{ padding: 8, fontWeight: 600, color: '#d97706' }}>Clear failed prerequisite retest</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
