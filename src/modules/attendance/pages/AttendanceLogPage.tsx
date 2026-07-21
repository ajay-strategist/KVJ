import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceSummaryPanels } from '../components/AttendanceSummaryPanels';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';

export function AttendanceLogPage() {
  const { user } = useAuth();
  const [startDate] = useState('01/06/26');
  const [endDate] = useState('30/06/26');

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
    let tasks: Array<{ title: string; duration: string }> = [
      { title: 'Power BI Session', duration: '3.0h' },
      { title: 'Data Analytics Review', duration: '2.5h' },
    ];
    let hoursWorked = '8h 30m';
    let expenses = '₹ 150.00';

    if (dayOfWeekIdx === 0) {
      status = 'holiday';
      location = '';
      tasks = [];
      hoursWorked = '';
      expenses = '';
    } else if (dayNum === 13) {
      status = 'leave';
      location = '';
      tasks = [];
      hoursWorked = '';
      expenses = '';
    } else if (dayNum === 24 || dayNum === 25) {
      location = dayNum === 24 ? 'Vimala College' : 'Nehru College';
      tasks = [{ title: 'College Marketing Presentation', duration: '5.0h' }];
    } else if (dayNum <= 10) {
      location = 'Christ Irinjalakkuda';
      tasks = [{ title: 'Batch Training Session', duration: '6.0h' }];
    }

    return {
      dateNum: dayNum,
      dayName,
      fullDate: `${String(dayNum).padStart(2, '0')}/06/2026`,
      status,
      location,
      tasks,
      hoursWorked,
      expenses,
    };
  });

  const summaryStats = {
    daysClockedIn: 25,
    numberOfLeaves: 1,
    avgHours: 7.8,
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
      content: <AttendanceCalendarView days={calendarDays} summaryStats={summaryStats} />,
    },
    {
      id: 'tabular',
      label: '📊 Tabular View (Full Attendance Log)',
      content: (
        <Card>
          <SectionHeader title="Attendance Details Log (Monthly Grid)" />
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
  ];

  return (
    <AppShell>
      <PageHeader
        title="My Attendance Log & Excel Reports"
        subtitle="Calendar view, full tabular attendance log, and role-based employee filtering"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Aggregated Summaries & Filters */}
        <AttendanceSummaryPanels
          startDate={startDate}
          endDate={endDate}
          employeeName={user?.fullName || 'Linto George'}
          userRole={user?.role || 'EMPLOYEE'}
        />

        {/* Dual View Tabs (Calendar + Tabular) */}
        <Tabs items={tabs} />
      </div>
    </AppShell>
  );
}

export default AttendanceLogPage;
