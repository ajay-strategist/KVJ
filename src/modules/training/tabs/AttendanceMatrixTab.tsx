import React from 'react';
import { Card, Button, Badge } from '../../../shared/ui/components';
import type { StudentRecord } from '../types/batch-management.types';

export interface AttendanceMatrixTabProps {
  students: StudentRecord[];
  selectedBatchId: string;
  batchStudentIds: Set<string>;
  considerAttendance: boolean;
  attendanceThreshold: number;
  attendanceSessions: Array<{ id: string; date: string; hour: number }>;
  attendanceMatrix: Record<string, Record<string, string>>;
  onAddHourSession: () => void;
  onDeleteSession: (colId: string) => void;
  onUpdateSessionDate: (colId: string, date: string) => void;
  onUpdateSessionHour: (colId: string, hour: number) => void;
  onToggleStatus: (studentId: string, colId: string) => void;
}

export const AttendanceMatrixTab: React.FC<AttendanceMatrixTabProps> = ({
  students,
  selectedBatchId,
  batchStudentIds,
  considerAttendance,
  attendanceThreshold,
  attendanceSessions,
  attendanceMatrix,
  onAddHourSession,
  onDeleteSession,
  onUpdateSessionDate,
  onUpdateSessionHour,
  onToggleStatus,
}) => {
  return (
    <Card style={{ padding: 18, overflow: 'hidden' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>📅 Hour-Based Multi-Date Attendance Session Matrix</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Displaying dates and hour sessions (Hour 1, 2, 3...). Click date/hour to edit header, or click ➕ Add Hour Column.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm" onClick={onAddHourSession}>
            ➕ Add Hour Column
          </Button>
        </div>
      </div>

      {/* Multi-Date Matrix Table with Sticky Headers & Freeze Panes */}
      <div style={{ overflow: 'auto', maxHeight: '72vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
          <thead>
            <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              {/* Frozen Heading 1: Phone Number */}
              <th style={{
                padding: 12,
                position: 'sticky',
                top: 0,
                left: 0,
                background: 'var(--bg-sunken)',
                zIndex: 30,
                minWidth: 140,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}>
                Phone Number
              </th>

              {/* Frozen Heading 2: Name */}
              <th style={{
                padding: 12,
                position: 'sticky',
                top: 0,
                left: 140,
                background: 'var(--bg-sunken)',
                zIndex: 30,
                minWidth: 160,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}>
                Name
              </th>

              {/* Frozen Heading 3: Attendance % (Separator shadow) */}
              <th style={{
                padding: 12,
                position: 'sticky',
                top: 0,
                left: 300,
                background: 'var(--bg-sunken)',
                zIndex: 30,
                minWidth: 120,
                textAlign: 'center',
                borderRight: '2px solid var(--border)',
                boxShadow: '3px 2px 6px -2px rgba(0,0,0,0.12)',
              }}>
                Overall Attn %
              </th>

              {/* Dynamic Editable Date & Hour Heading Columns with Top Summary Stats */}
              {attendanceSessions.map((col, idx) => {
                let presentCount = 0;
                let absentCount = 0;
                students.forEach((st) => {
                  const status = attendanceMatrix[st.id]?.[col.id] || 'present';
                  if (status === 'absent') absentCount++;
                  else presentCount++;
                });
                const totalStudents = students.length;
                const sessionPct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

                return (
                  <th key={col.id} style={{
                    padding: '10px 10px',
                    textAlign: 'center',
                    minWidth: 165,
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-sunken)',
                    zIndex: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}>
                    {/* Session Header Top Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Session {idx + 1}
                      </span>
                      <button
                        type="button"
                        title="Delete this session column"
                        onClick={() => onDeleteSession(col.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--status-danger)',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '0 2px',
                          lineHeight: 1,
                        }}
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Date Picker & Bracketed Hour Selector Side by Side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                      <input
                        type="date"
                        className="kvj-input"
                        value={col.date}
                        onChange={(e) => onUpdateSessionDate(col.id, e.target.value)}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 4px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          cursor: 'pointer',
                          flex: 1,
                          minWidth: 105,
                        }}
                      />
                      <select
                        value={col.hour}
                        onChange={(e) => onUpdateSessionHour(col.id, Number(e.target.value))}
                        title="Select Hour Number"
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '2px 4px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--brand)',
                          cursor: 'pointer',
                        }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                          <option key={h} value={h}>
                            ({h})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Session Summary Card */}
                    <div style={{
                      background: 'var(--bg-surface)',
                      borderRadius: 8,
                      padding: '5px 8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      alignItems: 'center',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        width: '100%',
                      }}>
                        <span style={{
                          color: 'var(--status-success)',
                          background: 'rgba(16, 185, 129, 0.12)',
                          padding: '2px 5px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 800,
                        }} title={`${presentCount} Present`}>
                          🟢 {presentCount}
                        </span>
                        <span style={{
                          color: 'var(--status-danger)',
                          background: 'rgba(239, 68, 68, 0.12)',
                          padding: '2px 5px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 800,
                        }} title={`${absentCount} Absent`}>
                          🔴 {absentCount}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: sessionPct >= 80 ? 'var(--status-success)' : 'var(--status-danger)',
                          marginLeft: 2,
                        }}>
                          {sessionPct}%
                        </span>
                      </div>

                      <div style={{
                        width: '100%',
                        height: 5,
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${sessionPct}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: sessionPct >= 80 ? 'linear-gradient(90deg, var(--status-success), #34d399)' : 'linear-gradient(90deg, var(--status-danger), #f87171)',
                          transition: 'width 300ms ease-in-out',
                        }} />
                      </div>
                    </div>
                  </th>
                );
              })}

              <th style={{
                padding: 12,
                textAlign: 'center',
                minWidth: 140,
                position: 'sticky',
                top: 0,
                background: 'var(--bg-sunken)',
                zIndex: 20,
              }}>
                <Button size="sm" variant="secondary" onClick={onAddHourSession} style={{ fontSize: 12, padding: '4px 8px' }}>
                  ➕ Add Hour Column
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id)).map((s) => {
              const studentRecord = attendanceMatrix[s.id] || {};
              const eligible = !considerAttendance || s.attendancePct >= attendanceThreshold;

              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Frozen 1. Phone Number */}
                  <td style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2, color: 'var(--text-muted)' }}>
                    {s.phone}
                  </td>

                  {/* Frozen 2. Name */}
                  <td style={{ padding: 12, position: 'sticky', left: 140, background: 'var(--bg-surface)', zIndex: 2, fontWeight: 700 }}>
                    {s.photo} {s.name}
                  </td>

                  {/* Frozen 3. Attendance % */}
                  <td style={{
                    padding: 12,
                    position: 'sticky',
                    left: 300,
                    background: 'var(--bg-surface)',
                    zIndex: 2,
                    textAlign: 'center',
                    borderRight: '2px solid var(--border)',
                    boxShadow: '3px 0 6px -2px rgba(0,0,0,0.1)',
                  }}>
                    <Badge tone={eligible ? 'success' : 'danger'}>
                      {s.attendancePct}%
                    </Badge>
                  </td>

                  {/* 4. Session Date & Hour Status Buttons */}
                  {attendanceSessions.map((col) => {
                    const status = studentRecord[col.id] || 'present';
                    const badgeBg = status === 'present'
                      ? 'var(--status-success)'
                      : status === 'absent'
                      ? 'var(--status-danger)'
                      : 'var(--status-warning)';

                    const badgeText = status === 'present'
                      ? '🟢 Present'
                      : status === 'absent'
                      ? '🔴 Absent'
                      : '🟡 Late';

                    return (
                      <td key={col.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button
                          type="button"
                          title={`Click to toggle status for ${col.date} Hour ${col.hour}`}
                          onClick={() => onToggleStatus(s.id, col.id)}
                          style={{
                            padding: '5px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 999,
                            border: 'none',
                            background: badgeBg,
                            color: '#fff',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            transition: 'transform 120ms',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                          {badgeText}
                        </button>
                      </td>
                    );
                  })}

                  <td style={{ padding: 12 }}></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
