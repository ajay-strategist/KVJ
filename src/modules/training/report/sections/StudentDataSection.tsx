import React from 'react';
import type { SectionProps } from './CoverPageSection';

/** A rendered column in the Student Performance Register. */
interface RegisterColumn {
  id: string;
  header: string;
  short: string;                 // used in the sub-table caption
  align: 'left' | 'center';
  render: (st: SectionProps['data']['students'][number]) => React.ReactNode;
}

/**
 * How many DATA columns (attendance + assessments) fit beside the identity
 * columns on one A4 page before the table runs off the edge. Beyond this the
 * register is split into stacked sub-tables, each repeating the identity
 * columns and carrying its own header — instead of one table that overflows.
 */
const MAX_DATA_COLS_PER_TABLE = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const StudentDataSection: React.FC<SectionProps> = ({ data, config }) => {
  const selectedCols = config.selectedStudentColumns;
  const selectedAsses = data.assessments.filter((a) => config.selectedAssessmentIds.includes(a.id));

  // ── Identity columns: repeated in EVERY sub-table so a student is always
  //    identifiable regardless of which slice of data is shown. ──
  const identityCols: RegisterColumn[] = [
    {
      id: 'photo', header: 'Photo', short: 'Photo', align: 'center',
      render: (st) => {
        const initials = st.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid #cbd5e1', background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#1e293b', margin: '0 auto' }}>
            {st.avatarUrl ? <img src={st.avatarUrl} alt={st.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
        );
      },
    },
    {
      id: 'phone', header: 'Register No. (Phone)', short: 'Reg No.', align: 'left',
      render: (st) => <span style={{ fontWeight: 700, color: '#2563eb' }}>{st.phone}</span>,
    },
  ];
  if (selectedCols.includes('studentName')) {
    identityCols.push({
      id: 'name', header: 'Student Name', short: 'Name', align: 'left',
      render: (st) => <span style={{ fontWeight: 700, color: '#0f172a' }}>{st.name}</span>,
    });
  }

  // ── Data columns: attendance + each selected assessment. These get chunked. ──
  const dataCols: RegisterColumn[] = [];
  if (selectedCols.includes('attendancePct')) {
    dataCols.push({
      id: 'attendancePct', header: 'Attendance %', short: 'Attendance', align: 'center',
      render: (st) => {
        const warn = st.attendancePct < 75;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, color: warn ? '#dc2626' : '#0f172a' }}>{st.attendancePct}%</span>
            <div style={{ width: 34, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${st.attendancePct}%`, height: '100%', background: warn ? '#ef4444' : '#10b981', borderRadius: 3 }} />
            </div>
          </div>
        );
      },
    });
  }
  for (const ass of selectedAsses) {
    if (!selectedCols.includes(ass.id)) continue;
    dataCols.push({
      id: ass.id, header: `${ass.title} (${ass.passMarkPercent}%)`, short: ass.title, align: 'center',
      render: (st) => {
        const sc = st.assessmentScores[ass.id];
        if (!sc || !sc.attempted) return <span style={{ color: '#94a3b8' }}>—</span>;
        return <span style={{ fontWeight: 700, color: sc.passed ? '#16a34a' : '#dc2626' }}>{sc.marks}% {sc.passed ? '✓' : '✗'}</span>;
      },
    });
  }

  const groups = dataCols.length > 0 ? chunk(dataCols, MAX_DATA_COLS_PER_TABLE) : [[]];
  const multi = groups.length > 1;

  const thStyle: React.CSSProperties = { padding: '8px 6px', fontSize: 10.5, fontWeight: 700, color: '#334155' };

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        👨‍🎓 Student Performance Register
      </h2>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        Complete academic performance, attendance, and assessment records for every enrolled student.
        {multi && ` The register is split into ${groups.length} parts so every column stays readable on the page.`}
      </div>

      {groups.map((group, gi) => {
        const cols = [...identityCols, ...group];
        return (
          <div key={gi} className="report-student-table" style={{ marginBottom: multi ? 16 : 0 }}>
            {multi && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Register — Part {gi + 1} of {groups.length}
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                  {' · '}{group.map((c) => c.short).join(' · ')}
                </span>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #cbd5e1' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  {cols.map((c) => (
                    <th key={c.id} style={{ ...thStyle, textAlign: c.align, width: c.id === 'photo' ? 40 : undefined }}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map((st, idx) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    {cols.map((c) => (
                      <td key={c.id} style={{ padding: '4px 6px', textAlign: c.align }}>
                        {c.render(st)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};
