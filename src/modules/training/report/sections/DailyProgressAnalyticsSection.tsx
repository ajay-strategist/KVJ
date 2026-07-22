import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectCoverHeroKPIs } from '../daily-report.selectors';
import { CompletionFunnelChart } from '../charts/CompletionFunnelChart';
import { DailyProgressTimelineChart } from '../charts/DailyProgressTimelineChart';

export const DailyProgressAnalyticsSection: React.FC<SectionProps> = ({ data }) => {
  const hero = selectCoverHeroKPIs(data);

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Daily Progress & Curriculum Analytics</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <CompletionFunnelChart
          enrolled={hero.totalStudents}
          attended={data.students.filter((s) => s.attendancePct >= 75).length}
          assessed={data.students.filter((s) => Object.values(s.assessmentScores).some((sc) => sc.attempted)).length}
          passed={data.students.filter((s) => Object.values(s.assessmentScores).every((sc) => sc.passed)).length}
          eligible={hero.eligibleCount}
        />
        <DailyProgressTimelineChart milestones={data.progressMilestones} />
      </div>

      {/* Curriculum Details Table */}
      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Session-by-Session Curriculum Log</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, border: '1px solid #e2e8f0' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
            <th style={{ padding: 6, width: 60, textAlign: 'center' }}>Session #</th>
            <th style={{ padding: 6, width: 90 }}>Date</th>
            <th style={{ padding: 6 }}>Topic & Learning Objective Covered</th>
            <th style={{ padding: 6, width: 110, textAlign: 'center' }}>Practical Lab</th>
            <th style={{ padding: 6, width: 90, textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.progressMilestones.map((m) => (
            <tr key={m.sessionNo} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: 6, textAlign: 'center', fontWeight: 700 }}>Day {m.sessionNo}</td>
              <td style={{ padding: 6, color: '#475569' }}>{m.date}</td>
              <td style={{ padding: 6, fontWeight: 600, color: '#0f172a' }}>{m.topicCovered}</td>
              <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: m.practicalDone ? '#16a34a' : '#64748b' }}>
                {m.practicalDone ? '✓ Completed' : 'Theory Only'}
              </td>
              <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: m.status === 'Completed' ? '#047857' : '#d97706' }}>
                {m.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
