import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';

export function AttendanceLogPage() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const userRole = user?.role || 'EMPLOYEE';
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const [activeFilterPreset, setActiveFilterPreset] = useState<'current_month' | 'last_month' | 'last_1_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [selectedEmployee, setSelectedEmployee] = useState<string>(user?.fullName || 'Linto George');
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Expense tab state (bulk approval)
  const [expenseRows, setExpenseRows] = useState([
    { id: '1', date: '01/06/2026', employee: 'Linto George', category: 'Morning & Evening Tea', batch: 'Christ 3BBA Data Analytics B1', amount: 80.0, status: 'Approved' },
    { id: '2', date: '02/06/2026', employee: 'Linto George', category: 'Lunch & Refreshments', batch: 'Christ 3BBA Data Analytics B1', amount: 150.0, status: 'Approved' },
    { id: '3', date: '05/06/2026', employee: 'Linto George', category: 'Self Travel (Bike/Car)', batch: 'Christ 3BBA Data Analytics B1', amount: 120.0, status: 'Approved' },
    { id: '4', date: '24/06/2026', employee: 'Linto George', category: 'Self Travel (Bike/Car)', batch: 'Vimala College Batch 2', amount: 450.0, status: 'Pending Approval' },
    { id: '5', date: '25/06/2026', employee: 'Linto George', category: 'Self Travel (Bike/Car)', batch: 'Nehru College Batch 1', amount: 200.0, status: 'Pending Approval' },
  ]);

  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});

  const employeeList = [
    'Linto George',
    'Ajay Kumar',
    'Anju V',
    'Sankar M',
  ];

  const handleFilterPreset = (preset: 'current_month' | 'last_month' | 'last_1_year' | 'custom') => {
    setActiveFilterPreset(preset);
    if (preset === 'current_month') {
      setStartDate('2026-06-01');
      setEndDate('2026-06-30');
    } else if (preset === 'last_month') {
      setStartDate('2026-05-01');
      setEndDate('2026-05-31');
    } else if (preset === 'last_1_year') {
      setStartDate('2025-06-01');
      setEndDate('2026-05-31');
    }
  };

  const toggleRowExpand = (idx: number) => {
    setExpandedRows((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSelectAllExpenses = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      expenseRows.forEach((r) => { next[r.id] = true; });
    }
    setSelectedExpenses(next);
  };

  const handleSelectExpense = (id: string, checked: boolean) => {
    setSelectedExpenses((prev) => ({ ...prev, [id]: checked }));
  };

  const handleBulkApprove = () => {
    const selectedIds = Object.keys(selectedExpenses).filter((id) => selectedExpenses[id]);
    if (selectedIds.length === 0) return;

    setExpenseRows((prev) =>
      prev.map((r) => (selectedExpenses[r.id] ? { ...r, status: 'Approved' } : r))
    );

    toast({
      variant: 'success',
      title: 'Bulk Approval Complete',
      message: `${selectedIds.length} expense claims approved successfully.`,
    });

    setSelectedExpenses({});
  };

  // Excel-style tabular rows
  const tableRows = [
    { date: '01/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 80.00', note: '', break: '', tasks: ['Power BI Syllabus Unit 1', 'Assessment Setup'] },
    { date: '02/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 150.00', note: '', break: '', tasks: ['DAX Expressions Lab', 'Student Practice Guidance'] },
    { date: '03/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', tasks: ['Power BI Desktop Installation Sync'] },
    { date: '04/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', tasks: ['Data Modeling & Star Schema'] },
    { date: '05/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '₹ 120.00', note: '', break: '', tasks: ['Weekly Batch Test Evaluation'] },
    { date: '06/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', tasks: ['Visualizations & Dashboard Layout'] },
    { date: '07/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', tasks: [] },
    { date: '08/06/26', name: 'Linto George', holiday: '', org: 'Christ Irinjalakkuda', type: 'Training', mode: 'Offline', start: '08:30 AM', end: '05:00 PM', duration: '8:30:00', expenses: '', note: '', break: '', tasks: ['Power BI Gateway Configuration'] },
    { date: '13/06/26', name: 'Linto George', holiday: '', org: '', type: 'Leave', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', tasks: [] },
    { date: '14/06/26', name: 'Linto George', holiday: 'Sunday', org: '', type: 'Holiday', mode: '', start: '', end: '', duration: '', expenses: '', note: '', break: '', tasks: [] },
    { date: '24/06/26', name: 'Linto George', holiday: '', org: 'Vimala College', type: 'Marketing', mode: 'Offline', start: '10:00 AM', end: '03:00 PM', duration: '5:00:00', expenses: '₹ 450.00', note: '', break: '', tasks: ['Principal Meeting & Campus Seminar'] },
    { date: '25/06/26', name: 'Linto George', holiday: '', org: 'Nehru College', type: 'Marketing', mode: 'Offline', start: '09:00 AM', end: '05:00 PM', duration: '8:00:00', expenses: '₹ 200.00', note: '', break: '', tasks: ['Career Guidance Workshop'] },
    { date: '26/06/26', name: 'Linto George', holiday: '', org: 'Office', type: 'Work', mode: '', start: '09:49 AM', end: '05:31 PM', duration: '7:42:12', expenses: '', note: 'Late', break: '0.73', tasks: ['Internal Operations & Voucher Review'] },
  ];

  // Calendar Days mapping
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
      fullDate: `${String(dayNum).padStart(2, '0')}/06/2026`,
      status,
      location,
      startTime,
      endTime,
      tasks,
      hoursWorked,
      expenses,
    };
  });

  const selectedEmployeeDisplay = selectedEmployee === 'All Employees' ? 'All Employees' : selectedEmployee;

  const tabs = [
    {
      id: 'calendar',
      label: '📅 Calendar View',
      content: (
        <AttendanceCalendarView
          days={calendarDays}
          selectedEmployeeName={selectedEmployeeDisplay}
        />
      ),
    },
    {
      id: 'tabular',
      label: '📊 Table View',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Replaced Top Summaries */}
          <AttendanceCalendarView
            days={[]} // Hide grid, renders top & bottom summaries
            selectedEmployeeName={selectedEmployeeDisplay}
          />

          <Card>
            <SectionHeader title={`Attendance Details Log — ${selectedEmployeeDisplay}`} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0F4C81', color: 'white' }}>
                    <th style={{ padding: '8px 10px', width: 40 }}>Tasks</th>
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
                  {tableRows.map((r, i) => {
                    const isHoliday = r.type === 'Holiday';
                    const isLeave = r.type === 'Leave';
                    const bg = isHoliday ? 'rgba(239, 68, 68, 0.12)' : isLeave ? 'rgba(245, 158, 11, 0.12)' : i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)';
                    const isExpanded = !!expandedRows[i];

                    return (
                      <>
                        <tr key={i} style={{ background: bg, borderBottom: '1px solid var(--border)', color: isHoliday || isLeave ? 'var(--status-danger)' : 'inherit' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {r.tasks && r.tasks.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleRowExpand(i)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--brand)' }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
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

                        {/* View Tasks Expanded Sub-row */}
                        {isExpanded && r.tasks && r.tasks.length > 0 && (
                          <tr key={`exp-${i}`} style={{ background: 'var(--bg-sunken)' }}>
                            <td colSpan={13} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>
                                📋 Completed Tasks for {r.date}:
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--text-primary)' }}>
                                {r.tasks.map((taskStr, tIdx) => (
                                  <li key={tIdx}>{taskStr}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: 'expense_summary',
      label: '💰 Expense Summary',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Prominent Total Expense Banner */}
          <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Total Claimed Expenses — {selectedEmployeeDisplay}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
                  ₹ 4,806.00
                </div>
              </div>
              {isManagement && (
                <Button
                  onClick={handleBulkApprove}
                  disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                  style={{ background: 'var(--status-success)', color: 'white' }}
                >
                  ✓ Bulk Approve Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                </Button>
              )}
            </div>
          </Card>

          {/* Detailed Expense Item Log with Bulk Approval Checkboxes */}
          <Card>
            <SectionHeader title="Detailed Expense Items Log" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                    {isManagement && (
                      <th style={{ padding: 10, width: 36 }}>
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAllExpenses(e.target.checked)}
                        />
                      </th>
                    )}
                    <th style={{ padding: 10 }}>Date</th>
                    <th style={{ padding: 10 }}>Employee Name</th>
                    <th style={{ padding: 10 }}>Category</th>
                    <th style={{ padding: 10 }}>Batch (or Office)</th>
                    <th style={{ padding: 10 }}>Amount</th>
                    <th style={{ padding: 10 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {isManagement && (
                        <td style={{ padding: 10 }}>
                          <input
                            type="checkbox"
                            checked={!!selectedExpenses[exp.id]}
                            onChange={(e) => handleSelectExpense(exp.id, e.target.checked)}
                          />
                        </td>
                      )}
                      <td style={{ padding: 10, fontWeight: 600 }}>{exp.date}</td>
                      <td style={{ padding: 10 }}>{exp.employee}</td>
                      <td style={{ padding: 10 }}>{exp.category}</td>
                      <td style={{ padding: 10, fontWeight: 500, color: 'var(--brand)' }}>{exp.batch}</td>
                      <td style={{ padding: 10, fontWeight: 700 }}>₹ {exp.amount.toFixed(2)}</td>
                      <td style={{ padding: 10 }}>
                        <Badge tone={exp.status === 'Approved' ? 'success' : 'warning'}>
                          {exp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="My Attendance Log & Reports"
        subtitle="Comprehensive attendance calendar, detailed tabular logs, and expense audits"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 1. Global Consolidated Filter Panel */}
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Filters:</span>

              <Button
                variant={activeFilterPreset === 'current_month' ? 'primary' : 'secondary'}
                onClick={() => handleFilterPreset('current_month')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Current Month
              </Button>
              <Button
                variant={activeFilterPreset === 'last_month' ? 'primary' : 'secondary'}
                onClick={() => handleFilterPreset('last_month')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Last Month
              </Button>
              <Button
                variant={activeFilterPreset === 'last_1_year' ? 'primary' : 'secondary'}
                onClick={() => handleFilterPreset('last_1_year')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Last 1 Year (Excl. Current)
              </Button>
              <Button
                variant={activeFilterPreset === 'custom' ? 'primary' : 'secondary'}
                onClick={() => handleFilterPreset('custom')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Custom Range
              </Button>

              {/* Custom Date Range Pickers */}
              {activeFilterPreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="date"
                    className="kvj-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    className="kvj-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  />
                </div>
              )}

              {/* Employee Selection Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Employee:</span>
                {isManagement ? (
                  <select
                    className="kvj-select"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
                  >
                    <option value={user?.fullName || 'Linto George'}>Me ({user?.fullName || 'Personal'})</option>
                    <option value="All Employees">All Employees (Manager Access)</option>
                    {employeeList.filter((e) => e !== user?.fullName).map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                    👤 {user?.fullName || 'Linto George'}
                  </span>
                )}
              </div>
            </div>

            {/* Action Button: Far Right Submit Attendance */}
            <Button onClick={() => setSubmitDrawerOpen(true)} style={{ padding: '8px 16px', fontSize: 13 }}>
              📋 Submit Attendance
            </Button>
          </div>
        </Card>

        {/* 2. Middle Section: Sub-Tabs */}
        <Tabs items={tabs} />
      </div>

      {/* Submit Attendance Drawer Modal */}
      <Drawer open={submitDrawerOpen} onClose={() => setSubmitDrawerOpen(false)} title="Submit / Claim Attendance Request">
        <Form
          initial={{
            date: new Date().toISOString().slice(0, 10),
            location: 'Christ 3BBA Data Analytics B1',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={(values) => {
            toast({
              variant: 'success',
              title: 'Attendance Claim Submitted',
              message: `Attendance claim for ${values.date} (${values.startTime} - ${values.endTime}) sent to Manager/Admin review.`,
            });
            setSubmitDrawerOpen(false);
          }}
        >
          <TextField name="date" label="Attendance Date" placeholder="YYYY-MM-DD" />
          <SelectField
            name="location"
            label="Location (Training Batch / Office)"
            options={[
              { value: 'Office Work', label: 'Office Work' },
              { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
              { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
              { value: 'Vimala College Batch 2', label: 'Vimala College Batch 2' },
            ]}
          />
          <TextField name="startTime" label="Start Time" placeholder="08:30 AM" />
          <TextField name="endTime" label="End Time" placeholder="05:00 PM" />
          <TextField name="notes" label="Reason / Description (Optional)" placeholder="Emergency, system delay, or missed clock-in..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setSubmitDrawerOpen(false)}>Cancel</Button>
            <Button type="submit">Submit for Review</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

export default AttendanceLogPage;
