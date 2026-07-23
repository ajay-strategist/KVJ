import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const FinalExamResultsSection: React.FC<SectionProps> = ({ data }) => {
  const students = data.students;
  const total = students.length || 1;
  const passThreshold = data.finalExamPassMarkPercent || 70;

  // Calculate overall pass / fail
  const passedStudents = students.filter((s) => (s.finalExamMark ?? 0) >= passThreshold || s.finalExamResult === 'Passed');
  const failedStudents = students.filter((s) => (s.finalExamMark ?? 0) < passThreshold && s.finalExamResult !== 'Passed');

  const passedCount = passedStudents.length;
  const failedCount = failedStudents.length;
  const passPct = Math.round((passedCount / total) * 100);

  const avgMark = Math.round(
    students.reduce((acc, s) => acc + (s.finalExamMark ?? 0), 0) / total
  );

  // 1. By Gender
  const femaleStudents = students.filter((s) => s.gender === 'Female');
  const femalePassed = femaleStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const femaleFailed = femaleStudents.length - femalePassed;

  const maleStudents = students.filter((s) => s.gender === 'Male');
  const malePassed = maleStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const maleFailed = maleStudents.length - malePassed;

  // 2. By Laptop Availability
  const hasLaptopStudents = students.filter((s) => s.hasComputer === 'Yes');
  const hasLaptopPassed = hasLaptopStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const hasLaptopFailed = hasLaptopStudents.length - hasLaptopPassed;

  const noLaptopStudents = students.filter((s) => s.hasComputer !== 'Yes');
  const noLaptopPassed = noLaptopStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const noLaptopFailed = noLaptopStudents.length - noLaptopPassed;

  // 3. By Prior Knowledge
  const expStudents = students.filter((s) => s.learnedBefore === 'Yes');
  const expPassed = expStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const expFailed = expStudents.length - expPassed;

  const newStudents = students.filter((s) => s.learnedBefore !== 'Yes');
  const newPassed = newStudents.filter((s) => (s.finalExamMark ?? 0) >= passThreshold).length;
  const newFailed = newStudents.length - newPassed;

  // 4. By Previous Qualification
  const qualMap: Record<string, { total: number; passed: number; failed: number }> = {};
  students.forEach((s) => {
    const q = s.qualification || 'Other Degree';
    if (!qualMap[q]) qualMap[q] = { total: 0, passed: 0, failed: 0 };
    qualMap[q].total += 1;
    if ((s.finalExamMark ?? 0) >= passThreshold) {
      qualMap[q].passed += 1;
    } else {
      qualMap[q].failed += 1;
    }
  });

  const qualList = Object.entries(qualMap).map(([qual, stats]) => ({
    qual,
    ...stats,
    passPct: Math.round((stats.passed / (stats.total || 1)) * 100),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* SECTION TITLE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            🎓 Final Exam Performance &amp; Cross-Demographic Intelligence
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Final certification exam outcomes, pass percentages, and cross-demographic correlation analysis.
          </span>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 4 }}>
          Final Pass Rate: {passPct}% ({passedCount}/{total})
        </div>
      </div>

      {/* TOP KPI CARDS STRIP */}
      <div className="card-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        
        {/* Pass % Card */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1.5px solid #86efac', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
            Final Exam Pass %
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 4, lineHeight: 1 }}>
            {passPct}%
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#166534', marginTop: 4 }}>
            Pass Criterion: &gt;={passThreshold}% Marks
          </div>
        </div>

        {/* Passed Students Card */}
        <div style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)', border: '1.5px solid #6ee7b7', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
            Passed Students
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#047857', marginTop: 4, lineHeight: 1 }}>
            {passedCount} <span style={{ fontSize: 12, fontWeight: 700 }}>/ {total}</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#065f46', marginTop: 4 }}>
            Certified &amp; Eligible for Award
          </div>
        </div>

        {/* Failed Students Card */}
        <div style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9f1239', textTransform: 'uppercase' }}>
            Failed Students
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 4, lineHeight: 1 }}>
            {failedCount} <span style={{ fontSize: 12, fontWeight: 700 }}>/ {total}</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#9f1239', marginTop: 4 }}>
            Remedial Retest Required
          </div>
        </div>

        {/* Average Score Card */}
        <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
            Average Batch Score
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 4, lineHeight: 1 }}>
            {avgMark} <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>/ 100</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#2563eb', marginTop: 4 }}>
            Batch Mean Marks
          </div>
        </div>
      </div>

      {/* 5 CROSS-DEMOGRAPHIC BREAKDOWN CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        
        {/* 1. NO. OF STUDENTS BY FINAL EXAM RESULT */}
        <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
            📊 1. No. of Students by Final Exam Result
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Visual Bar Indicator */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>✓ Passed ({passedCount})</span>
                  <span style={{ fontWeight: 800, color: '#15803d' }}>{passPct}%</span>
                </div>
                <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${passPct}%`, height: '100%', background: '#22c55e', borderRadius: 5 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>✗ Failed ({failedCount})</span>
                  <span style={{ fontWeight: 800, color: '#dc2626' }}>{100 - passPct}%</span>
                </div>
                <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${100 - passPct}%`, height: '100%', background: '#ef4444', borderRadius: 5 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. NO. OF STUDENTS BY FINAL EXAM RESULT AND GENDER */}
        <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
            👫 2. Final Exam Result by Gender
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Gender</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Passed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Failed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Pass %</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#ec4899' }}>👩 Female</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{femalePassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: femaleFailed > 0 ? '#dc2626' : '#64748b' }}>{femaleFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((femalePassed / (femaleStudents.length || 1)) * 100)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#3b82f6' }}>👨 Male</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{malePassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: maleFailed > 0 ? '#dc2626' : '#64748b' }}>{maleFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((malePassed / (maleStudents.length || 1)) * 100)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. NO. OF STUDENTS BY FINAL EXAM RESULT AND HAVE LAPTOP */}
        <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
            💻 3. Final Exam Result by Laptop Access
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Laptop Status</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Passed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Failed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Pass %</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#0284c7' }}>💻 Own Laptop</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{hasLaptopPassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: hasLaptopFailed > 0 ? '#dc2626' : '#64748b' }}>{hasLaptopFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((hasLaptopPassed / (hasLaptopStudents.length || 1)) * 100)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#e11d48' }}>🖥️ Lab Required</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{noLaptopPassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: noLaptopFailed > 0 ? '#dc2626' : '#64748b' }}>{noLaptopFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((noLaptopPassed / (noLaptopStudents.length || 1)) * 100)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. NO. OF STUDENTS BY FINAL EXAM RESULT AND PRIOR KNOWLEDGE */}
        <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
            🧠 4. Final Exam Result by Prior Knowledge
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Prior Knowledge</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Passed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Failed</th>
                <th style={{ textAlign: 'center', padding: '4px 6px' }}>Pass %</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#d97706' }}>📚 Experienced</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{expPassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: expFailed > 0 ? '#dc2626' : '#64748b' }}>{expFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((expPassed / (expStudents.length || 1)) * 100)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 6px', fontWeight: 700, color: '#16a34a' }}>🌱 New Learner</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{newPassed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: newFailed > 0 ? '#dc2626' : '#64748b' }}>{newFailed}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {Math.round((newPassed / (newStudents.length || 1)) * 100)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. NO. OF STUDENTS BY FINAL EXAM RESULT AND PREVIOUS QUALIFICATION */}
      <div className="card-avoid-break" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
          🎓 5. Final Exam Result by Academic Qualification
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700 }}>Academic Degree / Qualification</th>
              <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>Total Students</th>
              <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>Passed</th>
              <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>Failed</th>
              <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>Qualification Pass %</th>
            </tr>
          </thead>
          <tbody>
            {qualList.map((item) => (
              <tr key={item.qual} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a' }}>{item.qual}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>{item.total}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{item.passed}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: item.failed > 0 ? '#dc2626' : '#64748b' }}>{item.failed}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                  {item.passPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FINAL EXAM INTELLIGENCE CALLOUT BOX */}
      <div
        className="card-avoid-break"
        style={{
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
          border: '1.5px solid #bfdbfe',
          borderRadius: 8,
          padding: 12,
          fontSize: 11,
          color: '#1e3a8a',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 11.5, color: '#1e40af', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡 Final Certification Intelligence &amp; Key Insights</span>
        </div>
        <div>
          The final certification exam overall pass rate is <strong>{passPct}%</strong> ({passedCount} of {total} students passed).{' '}
          Laptop ownership demonstrated a high correlation with success: students with personal laptops achieved a{' '}
          <strong>{Math.round((hasLaptopPassed / (hasLaptopStudents.length || 1)) * 100)}% pass rate</strong> compared to{' '}
          <strong>{Math.round((noLaptopPassed / (noLaptopStudents.length || 1)) * 100)}%</strong> for lab-dependent students. Prior course familiarity yielded a{' '}
          <strong>{Math.round((expPassed / (expStudents.length || 1)) * 100)}% pass rate</strong>.
        </div>
      </div>
    </div>
  );
};
