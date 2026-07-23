import React from 'react';
import type { DailyReportData, DailyReportConfig } from '../daily-report.types';
import { AttendanceTrendLineChart } from '../charts/AttendanceTrendLineChart';

interface DatewiseAttendanceSectionProps {
  data: DailyReportData;
  config: DailyReportConfig;
}

export const DatewiseAttendanceSection: React.FC<DatewiseAttendanceSectionProps> = ({ data }) => {
  // Sort sessions date wise
  const sortedSessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));

  // Calculate overall batch attendance %
  const overallAttendancePct = Math.round(
    data.students.reduce((acc, st) => acc + (st.attendancePct || 0), 0) / (data.students.length || 1)
  );

  // Identify absentees by date
  const datewiseAbsent = sortedSessions.map((sess) => {
    const absentSet = new Set(sess.absentStudentIds || []);
    const absentStudents = data.students.filter((st) => absentSet.has(st.id));
    const total = data.students.length || 1;
    const presentCount = sess.presentCount ?? (total - absentStudents.length);
    const attendancePct = sess.attendancePct ?? Math.round((presentCount / total) * 100);

    return {
      date: sess.date,
      presentCount,
      absentStudents,
      attendancePct,
    };
  });

  // Calculate overall student low attendance (<75%)
  const lowAttendanceStudents = data.students
    .map((st) => {
      let absentDays = 0;
      const totalDays = sortedSessions.length;
      sortedSessions.forEach((sess) => {
        if (sess.absentStudentIds?.includes(st.id)) {
          absentDays++;
        }
      });
      const presentDays = Math.max(0, totalDays - absentDays);
      const pct = st.attendancePct ?? (totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100);
      return { student: st, pct, presentDays, absentDays };
    })
    .filter((s) => s.pct < 75);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* SECTION TITLE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            📅 Attendance Intelligence &amp; Trend Analysis
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Session-by-session attendance trend line chart, date-wise attendance log table, absentees directory, and low attendance warning list.
          </span>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 4 }}>
          Overall Attendance: {overallAttendancePct}%
        </div>
      </div>

      {/* 1ST: LINE CHART FOR DATE-WISE PROGRESS TREND */}
      <div className="chart-avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <AttendanceTrendLineChart sessions={sortedSessions} />
      </div>

      {/* 2ND: DATE-WISE SESSION ATTENDANCE LOG TABLE (Natural Flow Across Pages) */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #cbd5e1', fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
          📊 Date-Wise Session Attendance Log
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Session Date</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Enrolled Students</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Present</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Absent</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Attendance %</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {datewiseAbsent.map((sess) => {
              const isWarning = sess.attendancePct < 75;
              const totalEnrolled = data.students.length;
              const absentCount = sess.absentStudents.length;

              return (
                <tr key={sess.date} style={{ borderBottom: '1px solid #e2e8f0', background: isWarning ? '#fff1f2' : '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: isWarning ? '#dc2626' : '#0f172a' }}>
                    {sess.date}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>{totalEnrolled}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{sess.presentCount}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: absentCount > 0 ? '#dc2626' : '#64748b' }}>{absentCount}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: isWarning ? '#dc2626' : '#0f172a' }}>
                    {sess.attendancePct}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: isWarning ? '#dc2626' : '#16a34a' }}>
                    {isWarning ? '⚠️ Low (<75%)' : '✓ Satisfactory'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3RD: DATE-WISE ABSENTEES REGISTRY */}
      <div style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>📋 Date-Wise Absentees List</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {datewiseAbsent.map((item, idx) => {
            const isLowAttendance = item.attendancePct < 75;

            return (
              <div
                key={idx}
                className="card-avoid-break"
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  border: `1.5px solid ${isLowAttendance ? '#fca5a5' : '#cbd5e1'}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  background: isLowAttendance ? '#fff1f2' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: isLowAttendance ? '#9f1239' : '#0f172a' }}>
                    📅 Date: {item.date} {isLowAttendance && <span style={{ color: '#dc2626', fontWeight: 800 }}> (⚠️ Attendance &lt; 75%)</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: isLowAttendance ? '#b91c1c' : '#64748b' }}>
                    Absentees: {item.absentStudents.length} Students ({item.attendancePct}% Present)
                  </span>
                </div>

                {item.absentStudents.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 600 }}>✓ 100% Full Attendance</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {item.absentStudents.map((st) => (
                      <span
                        key={st.id}
                        style={{
                          background: isLowAttendance ? '#fee2e2' : '#f1f5f9',
                          border: `1px solid ${isLowAttendance ? '#fca5a5' : '#cbd5e1'}`,
                          color: isLowAttendance ? '#dc2626' : '#1e293b',
                          fontWeight: isLowAttendance ? 800 : 600,
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                        }}
                      >
                        {st.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4TH: STUDENTS WITH LESS THAN 75% ATTENDANCE */}
      <div style={{ border: '1.5px solid #fca5a5', borderRadius: 8, overflow: 'hidden', background: '#fff1f2' }}>
        <div style={{ padding: '8px 12px', background: '#ffe4e6', borderBottom: '1px solid #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 12, color: '#9f1239' }}>
            🚨 Students with Less Than 75% Attendance ({lowAttendanceStudents.length} Students)
          </span>
          <span style={{ fontSize: 10, background: '#fecdd3', color: '#881337', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
            Mandatory Attendance Warning (&lt;75%)
          </span>
        </div>

        {lowAttendanceStudents.length === 0 ? (
          <div style={{ padding: 12, fontSize: 11, color: '#16a34a', fontWeight: 600, textAlign: 'center' }}>
            ✓ All students maintain satisfactory overall attendance (&gt;=75%).
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#fff1f2', borderBottom: '1px solid #fca5a5', color: '#881337' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Student Name</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Attendance %</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Present Days</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Absent Days</th>
              </tr>
            </thead>
            <tbody>
              {lowAttendanceStudents.map(({ student, pct, presentDays, absentDays }) => (
                <tr key={student.id} style={{ borderBottom: '1px solid #fecdd3', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#9f1239' }}>{student.name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#dc2626' }}>
                    {pct}% ⚠️
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>
                    {presentDays} Days
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>
                    {absentDays} Days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 5TH: ATTENDANCE INTELLIGENCE CALLOUT BOX */}
      <div
        className="card-avoid-break"
        style={{
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          background: 'linear-gradient(135deg, #fefce8 0%, #fffde7 100%)',
          border: '1px solid #fef08a',
          borderRadius: 8,
          padding: 12,
          fontSize: 11,
          color: '#713f12',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 11.5, color: '#854d0e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡 Attendance Intelligence &amp; Strategic Recommendations</span>
        </div>
        <div>
          Batch attendance averages <strong>{overallAttendancePct}%</strong>.{' '}
          {lowAttendanceStudents.length > 0 ? (
            <span>
              <strong>{lowAttendanceStudents.length} student(s)</strong> require immediate coordinator follow-up due to falling below the mandatory 75% threshold. Dedicated intervention is recommended to prevent gaps in prerequisite assessment preparation.
            </span>
          ) : (
            <span>
              All students meet or exceed the mandatory attendance benchmark of 75%, demonstrating high engagement.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
