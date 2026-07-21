import { useState } from 'react';
import { Card, SectionHeader, Badge } from '../../../shared/ui/components';

export interface CalendarDayDetail {
  dateNum: number;
  dayName: string;
  fullDate: string;
  status: 'present' | 'absent' | 'leave' | 'holiday';
  location: string;
  tasks: Array<{ title: string; duration: string }>;
  hoursWorked: string;
  expenses: string;
}

export interface AttendanceCalendarViewProps {
  days: CalendarDayDetail[];
  summaryStats: {
    daysClockedIn: number;
    numberOfLeaves: number;
    avgHours: number;
    totalExpenses: number;
    expenseBreakdown: Array<{ category: string; amount: number; icon: string }>;
  };
}

export function AttendanceCalendarView({ days, summaryStats }: AttendanceCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDayDetail | null>(null);

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left Column: Color-Coded Calendar Grid */}
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
                  minHeight: 105,
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
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', marginBottom: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      📍 {d.location}
                    </div>
                  )}

                  {d.tasks && d.tasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                      {d.tasks.slice(0, 2).map((t, idx) => (
                        <div key={idx} style={{ fontSize: 9.5, color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          ✓ {t.title}
                        </div>
                      ))}
                      {d.tasks.length > 2 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{d.tasks.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>

                {d.hoursWorked && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', marginTop: 4 }}>
                    ⏱ {d.hoursWorked}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Right Column: Attendance & Expense Summary Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionHeader title="Attendance Summary Panel" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #22C55E' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Days Clocked In</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--status-success)' }}>{summaryStats.daysClockedIn} Days</div>
              </div>
              <span style={{ fontSize: 24 }}>📅</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #F59E0B' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Number of Leaves</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--status-warning)' }}>{summaryStats.numberOfLeaves} Day</div>
              </div>
              <span style={{ fontSize: 24 }}>🌴</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--brand)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average Hours Worked</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>{summaryStats.avgHours} hrs/day</div>
              </div>
              <span style={{ fontSize: 24 }}>⏱️</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(95, 211, 232, 0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Expenses</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>₹ {summaryStats.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <span style={{ fontSize: 24 }}>💰</span>
            </div>
          </div>
        </Card>

        {/* Expense Summary Breakdown */}
        <Card>
          <SectionHeader title="Expense Summary Breakdown" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  );
}
