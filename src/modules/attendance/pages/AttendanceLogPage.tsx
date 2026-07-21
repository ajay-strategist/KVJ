import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge } from '../../../shared/ui/components';
import { AttendanceSummaryPanels } from '../components/AttendanceSummaryPanels';
import { useAuth } from '../../auth/AuthProvider';

export function AttendanceLogPage() {
  const { user } = useAuth();
  const [startDate] = useState('01/06/26');
  const [endDate] = useState('30/06/26');

  // Excel-style rows matching Screenshot 1
  const rows = [
    { date: '01/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '02/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '03/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '04/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '05/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '06/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '07/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '08/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '13/06/26', name: 'Linto George', holiday: '', org: '', type: 'Leave', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '14/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '24/06/26', name: 'Linto George', holiday: '', org: 'Vimala College', type: 'Marketing', mode: 'Offline', start: '10:00 AM', end: '03:00 PM', duration: '5:00:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '25/06/26', name: 'Linto George', holiday: '', org: 'Nehru College', type: 'Marketing', mode: 'Offline', start: '09:00 AM', end: '05:00 PM', duration: '8:00:00', expenses: '', note: '', break: '', holidayWorked: '' },
    { date: '26/06/26', name: 'Linto George', holiday: '', org: 'Office', type: 'Work', mode: '', start: '09:49 AM', end: '05:31 PM', duration: '7:42:12', expenses: '', note: 'Late', break: '0.73', holidayWorked: '' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="My Attendance Log & Excel Reports"
        subtitle="Comprehensive attendance details, monthly summaries, and institutional rollups"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Aggregated Summaries & Filters */}
        <AttendanceSummaryPanels
          startDate={startDate}
          endDate={endDate}
          employeeName={user?.fullName || 'Linto George'}
          userRole={user?.role || 'EMPLOYEE'}
        />

        {/* Detailed Attendance Log Table (Screenshot 1) */}
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
      </div>
    </AppShell>
  );
}

export default AttendanceLogPage;
