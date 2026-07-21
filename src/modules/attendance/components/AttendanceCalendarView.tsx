import { useState } from 'react';
import { Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';

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
  summaryStats: {
    startDate: string;
    endDate: string;
    workingDaysInMonth: number;
    daysToBeWorked: number;
    daysClockedIn: number;
    numberOfLeaves: number;
    totalHours: number;
    avgHours: number;
    lateReporting: number;
    earlyLeaving: number;
    financialYear: string;
    totalExpenses: number;
    expenseBreakdown: Array<{ category: string; amount: number; icon: string }>;
  };
  userRole?: string;
  employeeName?: string;
  onEmployeeChange?: (name: string) => void;
  currentMonthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export function AttendanceCalendarView({
  days,
  summaryStats,
  userRole = 'EMPLOYEE',
  employeeName = 'Linto George',
  onEmployeeChange,
  currentMonthLabel = 'June 2026',
  onPrevMonth,
  onNextMonth,
}: AttendanceCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDayDetail | null>(null);
  const [selectedEmp, setSelectedEmp] = useState(employeeName);

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
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const employeeList = ['Linto George', 'Ajay Kumar', 'Anju V', 'Sankar M'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Month Navigation & Employee Filter Header */}
      <Card style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="secondary" onClick={onPrevMonth} style={{ padding: '4px 10px', fontSize: 12 }}>
              ⏮ Prev Month
            </Button>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              🗓 {currentMonthLabel}
            </span>
            <Button variant="secondary" onClick={onNextMonth} style={{ padding: '4px 10px', fontSize: 12 }}>
              Next Month ⏭
            </Button>
          </div>

          {isManagement && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Filter Employee:</span>
              <select
                className="kvj-select"
                value={selectedEmp}
                onChange={(e) => {
                  setSelectedEmp(e.target.value);
                  if (onEmployeeChange) onEmployeeChange(e.target.value);
                }}
                style={{ padding: '6px 12px', fontSize: 13, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
              >
                <option value="All Employees">All Team Members</option>
                {employeeList.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left Column: Color-Coded Calendar Grid with Employee Timelines */}
        <Card>
          <SectionHeader title="Monthly Attendance Calendar View" />

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

        {/* Right Column: Comprehensive Attendance & Financial Year Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <SectionHeader title="Attendance Summary Panel" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Start & End Dates:</span>
                <strong>{summaryStats.startDate} → {summaryStats.endDate}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Financial Year:</span>
                <strong style={{ color: 'var(--brand)' }}>{summaryStats.financialYear}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid #22C55E' }}>
                <span>Days Clocked In:</span>
                <strong style={{ color: 'var(--status-success)' }}>{summaryStats.daysClockedIn} / {summaryStats.daysToBeWorked} Days</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid #F59E0B' }}>
                <span>Total Leaves:</span>
                <strong style={{ color: 'var(--status-warning)' }}>{summaryStats.numberOfLeaves} Day</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
                <span>Total & Avg Hours:</span>
                <strong>{summaryStats.totalHours} hrs ({summaryStats.avgHours} h/d)</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)' }}>
                <span>Late / Early Marks:</span>
                <strong style={{ color: summaryStats.lateReporting > 0 ? 'var(--status-warning)' : 'inherit' }}>
                  Late: {summaryStats.lateReporting} | Early: {summaryStats.earlyLeaving}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(95, 211, 232, 0.12)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent)' }}>
                <span>Total Expenses:</span>
                <strong style={{ color: 'var(--accent)', fontSize: 15 }}>₹ {summaryStats.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </Card>

          {/* Expense Summary Breakdown */}
          <Card>
            <SectionHeader title="Expense Summary Breakdown" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summaryStats.expenseBreakdown.map((exp, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{exp.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{exp.category}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>₹ {exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected Day Popout Detail */}
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
        </div>
      </div>
    </div>
  );
}
