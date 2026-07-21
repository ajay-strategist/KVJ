import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceSummaryPanels } from '../components/AttendanceSummaryPanels';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';

export function AttendanceLogPage() {
  const { user } = useAuth();
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0);

  const months = ['June 2026', 'July 2026', 'August 2026'];
  const currentMonthLabel = months[currentMonthIdx];

  const startDate = currentMonthIdx === 0 ? '01/06/2026' : currentMonthIdx === 1 ? '01/07/2026' : '01/08/2026';
  const endDate = currentMonthIdx === 0 ? '30/06/2026' : currentMonthIdx === 1 ? '31/07/2026' : '31/08/2026';

  // Excel-style rows matching Screenshot 1
  const rows = [
    { date: '01/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 80.00', note: '', break: '', holidayWorked: '' },
    { date: '02/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 150.00', note: '', break: '', holidayWorked: '' },
    { date: '03/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '04/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '05/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 120.00', note: '', break: '', holidayWorked: '' },
    { date: '06/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '07/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '08/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '13/06/26', name: 'Linto George', holiday: '', org: '', type: 'Leave', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '14/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '24/06/26', name: 'Linto George', holiday: '', org: 'Vimala College', type: 'Marketing', mode: 'Offline', start: '10:00 AM', end: '03:00 PM', duration: '5:00:00', expenses: '₹ 450.00', note: '', break: '', holidayWorked: '' },
    { date: '25/06/26', name: 'Linto George', holiday: '', org: 'Nehru College', type: 'Marketing', mode: 'Offline', start: '09:00 AM', end: '05:00 PM', duration: '8:00:00', expenses: '₹ 200.00', note: '', break: '', holidayWorked: '' },
    { date: '26/06/26', name: 'Linto George', holiday: '', org: 'Office', type: 'Work', mode: '', start: '09:49 AM', end: '05:31 PM', duration: '7:42:12', expenses: '', note: 'Late', break: '0.73', holidayWorked: '' },
  ];

  // Map days for Calendar View
  const calendarDays: CalendarDayDetail[] = Array.from({ length: 30 }, (_, i) => {
    const dayNum = i + 1;
    const dayOfWeekIdx = (i + 1) % 7;
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekIdx];

    let status: 'present' | 'absent' | 'leave' | 'holiday' = 'present';
    let location = 'Office';
    let startTime: string | undefined = '08:30 AM';
    let endTime: string | undefined = '05:00 PM';
    let tasks: Array<{ title: string; duration: string }> = [
      { title: 'Power BI Session', duration: '3.0h' },
      { title: 'Data Analytics Review', duration: '2.5h' },
    ];
    let hoursWorked = '8h 30m';
    let expenses = '₹ 150.00';

    if (dayOfWeekIdx === 0) {
      status = 'holiday';
      location = '';
      startTime = undefined;
      endTime = undefined;
      tasks = [];
      hoursWorked = '';
      expenses = '';
    } else if (dayNum === 13) {
      status = 'leave';
      location = '';
      startTime = undefined;
      endTime = undefined;
      tasks = [];
      hoursWorked = '';
      expenses = '';
    } else if (dayNum === 24 || dayNum === 25) {
      location = dayNum === 24 ? 'Vimala College' : 'Nehru College';
      startTime = dayNum === 24 ? '10:00 AM' : '09:00 AM';
      endTime = dayNum === 24 ? '03:00 PM' : '05:00 PM';
      tasks = [{ title: 'College Marketing Presentation', duration: '5.0h' }];
    } else if (dayNum <= 10) {
      location = 'Christ Irinjalakkuda';
      tasks = [{ title: 'Batch Training Session', duration: '6.0h' }];
    }

    return {
      dateNum: dayNum,
      dayName,
      fullDate: `${String(dayNum).padStart(2, '0')}/${currentMonthIdx === 0 ? '06' : currentMonthIdx === 1 ? '07' : '08'}/2026`,
      status,
      location,
      startTime,
      endTime,
      tasks,
      hoursWorked,
      expenses,
    };
  });

  const summaryStats = {
    startDate,
    endDate,
    workingDaysInMonth: 26,
    daysToBeWorked: 26,
    daysClockedIn: 25,
    numberOfLeaves: 1,
    totalHours: 195,
    avgHours: 7.8,
    lateReporting: 1,
    earlyLeaving: 0,
    financialYear: 'FY 2026-2027',
    totalExpenses: 4806.0,
    expenseBreakdown: [
      { category: 'Self Travel (Bike/Car)', amount: 2400.0, icon: '🏍️' },
      { category: 'Morning & Evening Tea', amount: 850.0, icon: '🍵' },
      { category: 'Lunch & Refreshments', amount: 1556.0, icon: '🍲' },
    ],
  };

  const tabs = [
    {
      id: 'calendar',
      label: '📅 Calendar View',
      content: (
        <AttendanceCalendarView
          days={calendarDays}
          summaryStats={summaryStats}
          userRole={user?.role || 'EMPLOYEE'}
          employeeName={user?.fullName || 'Linto George'}
          currentMonthLabel={currentMonthLabel}
          onPrevMonth={() => setCurrentMonthIdx((i) => Math.max(0, i - 1))}
          onNextMonth={() => setCurrentMonthIdx((i) => Math.min(months.length - 1, i + 1))}
        />
      ),
    },
    {
      id: 'tabular',
      label: '📊 Table View',
      content: (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionHeader title={`Attendance Details Log (${currentMonthLabel})`} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setCurrentMonthIdx((i) => Math.max(0, i - 1))} style={{ padding: '4px 10px', fontSize: 12 }}>
                ⏮ Prev Month
              </Button>
              <Button variant="secondary" onClick={() => setCurrentMonthIdx((i) => Math.min(months.length - 1, i + 1))} style={{ padding: '4px 10px', fontSize: 12 }}>
                Next Month ⏭
              </Button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0F4C81', color: 'white' }}>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Name</th>
                  <th style={{ padding: '8px 10px' }}>Holiday</th>
                  <th style={{ padding: '8px 10px' }}>Organization</th>
                  <th style={{ padding: '8px 10px' }}>Class / Work</th>
                  <th style={{ padding: '8px 10px' }}>Mode</th>
                  <th style={{ padding: '8px 10px' }}>Start Time</th>
                  <th style={{ padding: '8px 10px' }}>End Time</th>
                  <th style={{ padding: '8px 10px' }}>Duration</th>
                  <th style={{ padding: '8px 10px' }}>Other Expenses</th>
                  <th style={{ padding: '8px 10px' }}>Note</th>
                  <th style={{ padding: '8px 10px' }}>Break</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isHoliday = r.type === 'Holiday';
                  const isLeave = r.type === 'Leave';
                  const bg = isHoliday ? 'rgba(239, 68, 68, 0.12)' : isLeave ? 'rgba(245, 158, 11, 0.12)' : i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)';

                  return (
                    <tr key={i} style={{ background: bg, borderBottom: '1px solid var(--border)', color: isHoliday || isLeave ? 'var(--status-danger)' : 'inherit' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.date}</td>
                      <td style={{ padding: '8px 10px' }}>{r.name}</td>
                      <td style={{ padding: '8px 10px' }}>{r.holiday}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.org}</td>
                      <td style={{ padding: '8px 10px' }}>
                        {r.type && (
                          <Badge tone={r.type === 'Training' ? 'info' : r.type === 'Marketing' ? 'warning' : r.type === 'Leave' ? 'danger' : 'neutral'}>
                            {r.type}
                          </Badge>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{r.mode}</td>
                      <td style={{ padding: '8px 10px' }}>{r.start}</td>
                      <td style={{ padding: '8px 10px' }}>{r.end}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.duration}</td>
                      <td style={{ padding: '8px 10px' }}>{r.expenses}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--status-warning)', fontWeight: 600 }}>{r.note}</td>
                      <td style={{ padding: '8px 10px' }}>{r.break}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ),
    },
    {
      id: 'expense_summary',
      label: '💰 Expense Summary',
      content: (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionHeader title={`Monthly Expense Claims & Audit (${currentMonthLabel})`} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setCurrentMonthIdx((i) => Math.max(0, i - 1))} style={{ padding: '4px 10px', fontSize: 12 }}>
                ⏮ Prev Month
              </Button>
              <Button variant="secondary" onClick={() => setCurrentMonthIdx((i) => Math.min(months.length - 1, i + 1))} style={{ padding: '4px 10px', fontSize: 12 }}>
                Next Month ⏭
              </Button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {summaryStats.expenseBreakdown.map((b, idx) => (
              <div key={idx} style={{ padding: 16, background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{b.icon}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{b.category}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>₹ {b.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <SectionHeader title="Detailed Expense Items Log" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 8 }}>Date</th>
                  <th style={{ padding: 8 }}>Category</th>
                  <th style={{ padding: 8 }}>Location / Organization</th>
                  <th style={{ padding: 8 }}>Amount</th>
                  <th style={{ padding: 8 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>01/06/26</td>
                  <td style={{ padding: 8 }}>Morning & Evening Tea</td>
                  <td style={{ padding: 8 }}>Christ Irinjalakkuda</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>₹ 80.00</td>
                  <td style={{ padding: 8 }}><Badge tone="success">Approved</Badge></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>02/06/26</td>
                  <td style={{ padding: 8 }}>Lunch & Refreshments</td>
                  <td style={{ padding: 8 }}>Christ Irinjalakkuda</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>₹ 150.00</td>
                  <td style={{ padding: 8 }}><Badge tone="success">Approved</Badge></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>05/06/26</td>
                  <td style={{ padding: 8 }}>Self Travel (Bike/Car)</td>
                  <td style={{ padding: 8 }}>Christ Irinjalakkuda</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>₹ 120.00</td>
                  <td style={{ padding: 8 }}><Badge tone="success">Approved</Badge></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>24/06/26</td>
                  <td style={{ padding: 8 }}>Self Travel (Bike/Car)</td>
                  <td style={{ padding: 8 }}>Vimala College</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>₹ 450.00</td>
                  <td style={{ padding: 8 }}><Badge tone="warning">Pending Approval</Badge></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>25/06/26</td>
                  <td style={{ padding: 8 }}>Self Travel (Bike/Car)</td>
                  <td style={{ padding: 8 }}>Nehru College</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>₹ 200.00</td>
                  <td style={{ padding: 8 }}><Badge tone="warning">Pending Approval</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="My Attendance Log & Excel Reports"
        subtitle="Calendar view, table view, and expense summary breakdown with month navigation"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Aggregated Summaries & Filters */}
        <AttendanceSummaryPanels
          startDate={startDate}
          endDate={endDate}
          employeeName={user?.fullName || 'Linto George'}
          userRole={user?.role || 'EMPLOYEE'}
        />

        {/* 3 Sub-Tabs (Calendar View, Table View, Expense Summary) */}
        <Tabs items={tabs} />
      </div>
    </AppShell>
  );
}

export default AttendanceLogPage;
