import { useState, useMemo } from 'react';
import { Card, SectionHeader, Badge } from '../../../shared/ui/components';

export interface SessionEntry {
  location: string;
  type: string;
  startTime: string;
  endTime: string;
  tasks: Array<{ title: string; duration: string }>;
}

export interface CalendarDayDetail {
  dateNum: number;
  dayName: string;
  fullDate: string;
  status: 'present' | 'absent' | 'leave' | 'holiday';
  sessions?: SessionEntry[]; // Grouped multiple training entries for a single day
  location?: string;
  startTime?: string;
  endTime?: string;
  tasks?: Array<{ title: string; duration: string }>;
  hoursWorked: string;
  expenses: string;
}

export interface AttendanceCalendarViewProps {
  days: CalendarDayDetail[];
  selectedEmployeeName: string;
  showTopSummaries?: boolean;
  showBottomSummaries?: boolean;
  showCalendarGrid?: boolean;
}

export function AttendanceCalendarView({
  days,
  selectedEmployeeName,
  showTopSummaries = true,
  showBottomSummaries = true,
  showCalendarGrid = true,
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

  // Helper to parse time strings like "08:30 AM" into minutes from midnight
  const parseTime = (timeStr?: string) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let [_, hrs, mins, amp] = match;
    let h = parseInt(hrs, 10);
    const m = parseInt(mins, 10);
    if (amp.toUpperCase() === 'PM' && h < 12) h += 12;
    if (amp.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const isLate = (timeStr?: string) => {
    const mins = parseTime(timeStr);
    return mins !== null && mins > 9 * 60; // Late if clock-in is after 09:00 AM
  };

  const isEarly = (timeStr?: string) => {
    const mins = parseTime(timeStr);
    return mins !== null && mins < 17 * 60; // Early if clock-out is before 05:00 PM
  };

  // Monthly summary stats calculated dynamically
  const monthlyStats = useMemo(() => {
    const workingDaysInMonth = days.filter((d) => d.dayName !== 'Sun').length;
    const daysToBeWorked = days.filter((d) => d.dayName !== 'Sun' && d.status !== 'holiday').length;
    const noOfLeaves = days.filter((d) => d.status === 'leave').length;
    const holidayWorked = days.filter((d) => d.status === 'present' && d.dayName === 'Sun').length;
    const workingDays = days.filter((d) => d.status === 'present').length;
    const lateReporting = days.filter((d) => d.status === 'present' && isLate(d.startTime)).length;
    const earlyLeaving = days.filter((d) => d.status === 'present' && isEarly(d.endTime)).length;

    const totalBreakHrs = 0; // Not logged daily in detail array

    const totalExpenses = days.reduce((sum, d) => {
      const amt = parseFloat(d.expenses.replace(/[^\d.]/g, '')) || 0;
      return sum + amt;
    }, 0);

    return {
      workingDaysInMonth,
      daysToBeWorked,
      noOfLeaves,
      holidayWorked,
      workingDays,
      lateReporting,
      earlyLeaving,
      totalBreakHrs,
      totalExpenses,
    };
  }, [days]);

  // Financial Year Accumulated Stats matching specs
  const fyStats = useMemo(() => {
    return {
      joinedDate: '—',
      workingDaysInFY: monthlyStats.workingDaysInMonth,
      daysToBeWorkedFY: monthlyStats.daysToBeWorked,
      noOfLeavesFY: monthlyStats.noOfLeaves,
      holidayWorkedFY: monthlyStats.holidayWorked,
      workingDaysFY: monthlyStats.workingDays,
      lateReportingFY: monthlyStats.lateReporting,
      earlyLeavingFY: monthlyStats.earlyLeaving,
      totalBreakHrsFY: monthlyStats.totalBreakHrs,
      totalExpensesFY: monthlyStats.totalExpenses,
    };
  }, [monthlyStats]);

  const orgBreakdown = useMemo(() => {
    const orgMap: Record<string, { totalHrs: number; count: number }> = {};
    days.forEach((d) => {
      if (d.status === 'present') {
        const loc = d.location || 'Office';
        const hrs = parseFloat(d.hoursWorked.replace(/[^\d.]/g, '')) || 0;
        if (!orgMap[loc]) orgMap[loc] = { totalHrs: 0, count: 0 };
        orgMap[loc].totalHrs += hrs;
        orgMap[loc].count += 1;
      }
    });
    return Object.entries(orgMap).map(([organization, data]) => ({
      organization,
      avgDuration: data.count > 0 ? Math.round((data.totalHrs / data.count) * 10) / 10 : 0,
    }));
  }, [days]);

  const classSupervisionSummary = useMemo(() => {
    const instMap: Record<string, { physicalCount: number; onlineCount: number; physicalDur: number; onlineDur: number }> = {};
    days.forEach((d) => {
      if (d.status === 'present') {
        const loc = d.location || 'Office';
        if (loc === 'Office') return;
        const hrs = parseFloat(d.hoursWorked.replace(/[^\d.]/g, '')) || 0;
        if (!instMap[loc]) instMap[loc] = { physicalCount: 0, onlineCount: 0, physicalDur: 0, onlineDur: 0 };

        const isOnline = d.sessions?.some((s) => s.location.toLowerCase().includes('online')) || false;
        if (isOnline) {
          instMap[loc].onlineCount += 1;
          instMap[loc].onlineDur += hrs;
        } else {
          instMap[loc].physicalCount += 1;
          instMap[loc].physicalDur += hrs;
        }
      }
    });
    return Object.entries(instMap).map(([institution, data]) => ({
      institution,
      physicalClasses: data.physicalCount,
      onlineClasses: data.onlineCount,
      physicalClassDuration: data.physicalDur,
      onlineDuration: data.onlineDur,
      totalPhysicalDuration: data.physicalDur + data.onlineDur,
    }));
  }, [days]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Section: Shared Monthly & Financial Year Summaries */}
      {showTopSummaries && (
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
      )}

      {/* Main Core Full-Width Calendar View Grid (Grouped Multiple Sessions) */}
      {showCalendarGrid && days.length > 0 && (
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
              const startColIdx = daysOfWeek.indexOf(d.dayName);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    gridColumnStart: i === 0 && startColIdx !== -1 ? startColIdx + 1 : undefined,
                    background: styles.bg,
                    border: `1.5px solid ${styles.border}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: 8,
                    minHeight: 115,
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

                    {/* Grouped Multiple Sessions or Single Session */}
                    {d.sessions && d.sessions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                        {d.sessions.map((s, sIdx) => (
                          <div key={sIdx} style={{ fontSize: 9.5, lineHeight: 1.25, background: 'var(--bg-surface)', padding: '2px 4px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--brand)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              📍 {s.location}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                              🕒 {s.startTime} - {s.endTime}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {d.location && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', marginBottom: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            📍 {d.location}
                          </div>
                        )}

                        {d.startTime && d.endTime && (
                          <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            🕒 {d.startTime} - {d.endTime}
                          </div>
                        )}
                      </>
                    )}

                    {d.tasks && d.tasks.length > 0 && !d.sessions && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                        {d.tasks.slice(0, 1).map((t, idx) => (
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
      )}

      {/* Selected Day Popout Details */}
      {selectedDay && (
        <Card style={{ borderLeft: `4px solid ${getStatusColor(selectedDay.status).border}` }}>
          <SectionHeader title={`Details: ${selectedDay.fullDate}`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div><strong>Status:</strong> <Badge tone={selectedDay.status === 'present' ? 'success' : selectedDay.status === 'holiday' ? 'danger' : 'warning'}>{selectedDay.status.toUpperCase()}</Badge></div>

            {selectedDay.sessions && selectedDay.sessions.length > 0 ? (
              <div>
                <strong>Grouped Training Sessions ({selectedDay.sessions.length}):</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {selectedDay.sessions.map((s, idx) => (
                    <div key={idx} style={{ padding: '6px 10px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)', fontSize: 12 }}>
                      <div>📍 <strong>{s.location}</strong> ({s.type})</div>
                      <div>🕒 Time: {s.startTime} - {s.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div><strong>Location:</strong> {selectedDay.location || 'N/A'}</div>
                <div><strong>Timeline:</strong> {selectedDay.startTime && selectedDay.endTime ? `${selectedDay.startTime} - ${selectedDay.endTime}` : 'N/A'}</div>
              </>
            )}

            <div><strong>Total Hours Worked:</strong> {selectedDay.hoursWorked || 'N/A'}</div>
          </div>
        </Card>
      )}

      {/* Bottom Section: Organization-wise Average Duration & Class Supervision Summary */}
      {showBottomSummaries && (
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

          {/* Class & Supervision Training Summary */}
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
      )}
    </div>
  );
}
