import { useState } from 'react';
import { Card, SectionHeader, Badge } from '../../../shared/ui/components';

export interface CalendarDayDetail {
  dateNum: number;
  dayName: string;
  fullDate: string;
  status: 'present' | 'absent' | 'leave' | 'holiday';
  location: string;
  startTime?: string;
  endTime?: string;
  tasks: Array<{ title: string; duration: string }>;
  hoursWorked: string;
  expenses: string;
}

export interface AttendanceCalendarViewProps {
  days: CalendarDayDetail[];
  selectedEmployeeName: string;
}

export function AttendanceCalendarView({
  days,
  selectedEmployeeName,
}: AttendanceCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDayDetail | null>(null);
  const [selectedFY, setSelectedFY] = useState('FY 2026-27');

  const getStatusColor = (status: 'present' | 'absent' | 'leave' | 'holiday') => {
    switch (status) {
      case 'present':
        return { bg: 'rgba(34, 197, 94, 0.12)', border: '#22C55E', text: 'var(--status-success)' };
      case 'absent':
      case 'leave':
        return { bg: 'rgba(245, 158, 11, 0.14)', border: '#F59E0B', text: 'var(--status-warning)' };
      case 'holiday':
        return { bg: 'rgba(239, 68, 68, 0.14)', border: '#EF4444', text: 'var(--status-danger)' };
      default:
        return { bg: 'var(--bg-sunken)', border: 'var(--border)', text: 'inherit' };
    }
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Monthly summary stats matching specs
  const monthlyStats = {
    workingDaysInMonth: 26,
    daysToBeWorked: 26,
    noOfLeaves: 1,
    holidayWorked: 0,
    workingDays: 25,
    lateReporting: 1,
    earlyLeaving: 0,
    totalBreakHrs: 0.73,
    totalExpenses: 4806.0,
  };

  // Financial Year Accumulated Stats matching specs
  const fyStats = {
    joinedDate: '01/12/2024',
    workingDaysInFY: 312,
    daysToBeWorkedFY: 312,
    noOfLeavesFY: 12,
    holidayWorkedFY: 3,
    workingDaysFY: 297,
    lateReportingFY: 8,
    earlyLeavingFY: 1,
    totalBreakHrsFY: 14.5,
    totalExpensesFY: 54200.0,
  };

  const orgBreakdown = [
    { organization: 'Vimala College', avgDuration: 5.0 },
    { organization: 'Office', avgDuration: 7.7 },
    { organization: 'Nehru College', avgDuration: 8.0 },
    { organization: 'Christ Irinjalakkuda', avgDuration: 8.5 },
  ];

  const classSupervisionSummary = [
    { institution: 'Christ Irinjalakkuda', physicalClasses: 22, physicalSupervision: 0, totalPhysical: 22, onlineClasses: 0, physicalClassDuration: 187, physicalSupervisionDuration: 0, totalPhysicalDuration: 187, onlineDuration: 0 },
    { institution: 'Vimala College', physicalClasses: 4, physicalSupervision: 0, totalPhysical: 4, onlineClasses: 0, physicalClassDuration: 20, physicalSupervisionDuration: 0, totalPhysicalDuration: 20, onlineDuration: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Section: Shared Monthly & Financial Year Summaries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Monthly Summary */}
        <Card>
          <SectionHeader title={`Monthly Summary — ${selectedEmployeeName}`} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Days in Month:</span> <strong>{monthlyStats.workingDaysInMonth}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Working Days:</span> <strong>{monthlyStats.workingDays}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--status-warning)' }}>No. of Leaves:</span> <strong style={{ color: 'var(--status-warning)' }}>{monthlyStats.noOfLeaves}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--brand)' }}>Holiday Worked:</span> <strong style={{ color: 'var(--brand)' }}>{monthlyStats.holidayWorked}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Late / Early:</span> <strong>{monthlyStats.lateReporting} / {monthlyStats.earlyLeaving}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Break:</span> <strong>{monthlyStats.totalBreakHrs} hrs</strong>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid #22C55E' }}>
              <span style={{ fontWeight: 600 }}>Total Expenses:</span> <strong style={{ color: 'var(--status-success)', fontSize: 14 }}>₹ {monthlyStats.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </Card>

        {/* Accumulated Expenses & Metrics (Financial Year) */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <SectionHeader title="Accumulated Expenses (Financial Year)" />
            <select
              className="kvj-select"
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              style={{ padding: '2px 8px', fontSize: 12, borderRadius: 'var(--radius-xs)' }}
            >
              <option value="FY 2026-27">FY 2026-27 (Apr 1 - Mar 31)</option>
              <option value="FY 2025-26">FY 2025-26 (Apr 1 - Mar 31)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Employee Joined Date:</span> <strong>📅 {fyStats.joinedDate}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>FY Working Days:</span> <strong>{fyStats.workingDaysFY}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--status-warning)' }}>FY Total Leaves:</span> <strong style={{ color: 'var(--status-warning)' }}>{fyStats.noOfLeavesFY}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>FY Late / Early:</span> <strong>{fyStats.lateReportingFY} / {fyStats.earlyLeavingFY}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
              <span style={{ color: 'var(--text-muted)' }}>FY Total Break:</span> <strong>{fyStats.totalBreakHrsFY} hrs</strong>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(95, 211, 232, 0.12)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent)' }}>
              <span style={{ fontWeight: 600 }}>FY Total Expenses:</span> <strong style={{ color: 'var(--accent)', fontSize: 14 }}>₹ {fyStats.totalExpensesFY.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Core Full-Width Calendar View */}
      <Card>
        <SectionHeader title={`Monthly Attendance Calendar Grid — ${selectedEmployeeName}`} />

        {/* Days of week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8, textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
          {daysOfWeek.map((d) => (
            <div key={d} style={{ padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {days.map((d, i) => {
            const styles = getStatusColor(d.status);
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(d)}
                style={{
                  gridColumnStart: i === 0 ? 2 : undefined, // Monday start for Day 1
                  background: styles.bg,
                  border: `1.5px solid ${styles.border}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 8,
                  minHeight: 110,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: styles.text }}>{d.dateNum}</span>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{d.dayName}</span>
                  </div>

                  {d.location && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', marginBottom: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      📍 {d.location}
                    </div>
                  )}

                  {/* Employee Timeline below each date */}
                  {d.startTime && d.endTime && (
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      🕒 {d.startTime} - {d.endTime}
                    </div>
                  )}

                  {d.tasks && d.tasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {d.tasks.slice(0, 2).map((t, idx) => (
                        <div key={idx} style={{ fontSize: 9, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          ✓ {t.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {d.hoursWorked && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: styles.text, textAlign: 'right', marginTop: 4 }}>
                    ⏱ {d.hoursWorked}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected Day Popout Details */}
      {selectedDay && (
        <Card style={{ borderLeft: `4px solid ${getStatusColor(selectedDay.status).border}` }}>
          <SectionHeader title={`Details: ${selectedDay.fullDate}`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div><strong>Status:</strong> <Badge tone={selectedDay.status === 'present' ? 'success' : selectedDay.status === 'holiday' ? 'danger' : 'warning'}>{selectedDay.status.toUpperCase()}</Badge></div>
            <div><strong>Location:</strong> {selectedDay.location || 'N/A'}</div>
            <div><strong>Timeline:</strong> {selectedDay.startTime && selectedDay.endTime ? `${selectedDay.startTime} - ${selectedDay.endTime}` : 'N/A'}</div>
            <div><strong>Hours Worked:</strong> {selectedDay.hoursWorked || 'N/A'}</div>
            <div>
              <strong>Completed Tasks:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {selectedDay.tasks.length > 0 ? (
                  selectedDay.tasks.map((t, idx) => (
                    <li key={idx}>{t.title} ({t.duration})</li>
                  ))
                ) : (
                  <li style={{ color: 'var(--text-muted)' }}>No tasks recorded</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Bottom Section: Organization-wise Average Duration & Class Supervision Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Organization vs Avg Duration */}
        <Card>
          <SectionHeader title="Organization vs Avg Duration" />
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 0' }}>Organization</th>
                <th style={{ textAlign: 'right' }}>Avg Duration (hr)</th>
              </tr>
            </thead>
            <tbody>
              {orgBreakdown.map((row) => (
                <tr key={row.organization} style={{ borderBottom: '1px dashed var(--border)' }}>
                  <td style={{ padding: '6px 0' }}>{row.organization}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.avgDuration} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Class & Supervision Summary */}
        <Card>
          <SectionHeader title="Class & Supervision Training Summary" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-primary)' }}>
                  <th style={{ padding: 6 }}>Institution</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Physical Classes</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Online Classes</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Total Duration</th>
                </tr>
              </thead>
              <tbody>
                {classSupervisionSummary.map((c) => (
                  <tr key={c.institution} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{c.institution}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{c.physicalClasses}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{c.onlineClasses}</td>
                    <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: 'var(--brand)' }}>{c.totalPhysicalDuration} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
