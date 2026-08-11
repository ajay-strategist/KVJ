import React, { useState } from 'react';
import type { SectionProps } from './CoverPageSection';

export const StudentProgressSection: React.FC<SectionProps> = ({ data, config }) => {
  const availableAssessments = [
    ...data.assessments,
    { id: 'final-exam', title: 'Final Certification Exam', maxMarks: data.courseMaxMarks || 100, passMarkPercent: data.finalExamPassMarkPercent || 70 },
  ];

  const defaultId = config.selectedAssessmentIds[0] || availableAssessments[0]?.id || 'final-exam';
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(defaultId);

  const activeAssessment = availableAssessments.find((a) => a.id === selectedAssessmentId) || availableAssessments[0];
  const examMax = activeAssessment?.maxMarks || 100;
  const passPct = activeAssessment?.passMarkPercent || 70;
  const passMarks = Math.round((passPct / 100) * examMax);

  // Compute dynamic grade/progress distribution for selected assessment
  const gradeCounts = {
    'Grade A (90-100%)': 0,
    'Grade B (75-89%)': 0,
    'Grade C (Pass: PassMark-74%)': 0,
    'Remedial (Below PassMark)': 0,
    'Not Attended': 0,
  };

  data.students.forEach((s) => {
    let mark: number | undefined;
    if (selectedAssessmentId === 'final-exam') {
      mark = s.finalExamMark;
    } else {
      const sc = s.assessmentScores[selectedAssessmentId];
      if (sc && sc.attempted) mark = sc.marks;
    }

    if (mark === undefined) {
      gradeCounts['Not Attended']++;
    } else {
      const pct = Math.round((mark / examMax) * 100);
      if (pct >= 90) {
        gradeCounts['Grade A (90-100%)']++;
      } else if (pct >= 75) {
        gradeCounts['Grade B (75-89%)']++;
      } else if (pct >= passPct) {
        gradeCounts['Grade C (Pass: PassMark-74%)']++;
      } else {
        gradeCounts['Remedial (Below PassMark)']++;
      }
    }
  });

  const total = data.students.length || 1;
  const maxCategoryCount = Math.max(...Object.values(gradeCounts), 1);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #cbd5e1', paddingBottom: 6, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            Dynamic Student Progress Analytics
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Select an assessment or final exam to analyze progress grade distribution.
          </span>
        </div>

        {/* Dynamic Assessment Slicer / Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>Assessment Slicer:</label>
          <select
            value={selectedAssessmentId}
            onChange={(e) => setSelectedAssessmentId(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              border: '1.5px solid #2563eb',
              background: '#eff6ff',
              color: '#1e40af',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {availableAssessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DYNAMIC PROGRESS VISUAL */}
      <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
            Performance Distribution &mdash; {activeAssessment.title}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d' }}>
            Pass Threshold: {passPct}% ({passMarks} / {examMax} Marks)
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          {Object.entries(gradeCounts).map(([cat, count]) => {
            const pct = Math.round((count / total) * 100);
            const color =
              cat.startsWith('Grade A')
                ? '#16a34a'
                : cat.startsWith('Grade B')
                ? '#2563eb'
                : cat.startsWith('Grade C')
                ? '#0284c7'
                : cat.startsWith('Remedial')
                ? '#dc2626'
                : '#d97706';

            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 170, fontWeight: 700, color: '#334155', fontSize: 10.5 }}>{cat}</span>
                <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(count / maxCategoryCount) * 100}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 6,
                    }}
                  />
                </div>
                <span style={{ width: 60, textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
