import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN, type AttendanceRecord } from '../attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN, type ExpenseClaim } from '../../finance/finance.repository';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { toLocalISODate, todayISO } from '../../../shared/utils/date';

export function AttendanceLogPage() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const userRole = user?.role || 'EMPLOYEE';
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const now = new Date();
  const defaultStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [activeFilterPreset, setActiveFilterPreset] = useState<'current_month' | 'last_month' | 'last_1_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(user?.fullName || 'System Admin');
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false);
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((r) => {
      if (r.ok) setEmployees(r.value);
    });
  }, []);

  const employeeNames = useMemo(() => {
    return employees.map((e) => `${e.firstName} ${e.lastName}`);
  }, [employees]);

  const currentEmployee = useMemo(() => {
    if (selectedEmployee === 'All Employees') return null;
    return employees.find(e => `${e.firstName} ${e.lastName}` === selectedEmployee) || null;
  }, [employees, selectedEmployee]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const attendanceRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
        const expenseRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
        const range = { from: startDate, to: endDate };

        let records: AttendanceRecord[] = [];
        let claims: ExpenseClaim[] = [];

        if (isManagement && selectedEmployee === 'All Employees') {
          const allRes = await attendanceRepo.findMany();
          records = allRes.data.filter(r => r.workDate >= range.from && r.workDate <= range.to);
          const allClaims = await expenseRepo.findMany();
          claims = allClaims.data.filter(c => c.createdAt >= range.from && c.createdAt <= range.to);
        } else {
          const empId = currentEmployee?.id || user?.id;
          if (empId) {
            records = await attendanceRepo.findHistory(empId, range);
            const allClaims = await expenseRepo.findMany();
            claims = allClaims.data.filter(c => c.employeeId === empId && c.createdAt >= range.from && c.createdAt <= range.to);
          }
        }
        setAttendanceRecords(records);
        setExpenseClaims(claims);
      } catch (e) {
        console.error('Error fetching attendance history:', e);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [startDate, endDate, currentEmployee, selectedEmployee, user]);

  const handleFilterPreset = (preset: 'current_month' | 'last_month' | 'last_1_year' | 'custom') => {
    setActiveFilterPreset(preset);
    const today = new Date();
    if (preset === 'current_month') {
      setStartDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    } else if (preset === 'last_month') {
      setStartDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
      setEndDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else if (preset === 'last_1_year') {
      setStartDate(toLocalISODate(new Date(today.getFullYear() - 1, today.getMonth(), 1)));
      setEndDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 0)));
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

  const calendarDays: CalendarDayDetail[] = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: CalendarDayDetail[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalISODate(d);
      const dayNum = d.getDate();
      const dayOfWeekIdx = d.getDay();
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekIdx];

      const record = attendanceRecords.find(r => r.workDate === dateStr);
      const dayClaims = expenseClaims.filter(c => c.createdAt.slice(0, 10) === dateStr);
      const dayExpensesSum = dayClaims.reduce((sum, c) => sum + (c.amount || 0), 0);

      if (record) {
        const sessions = record.sessions?.map(s => ({
          location: s.workType,
          type: s.workType,
          startTime: s.clockIn ? new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          endTime: s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          tasks: s.notes ? [{ title: s.notes, duration: '' }] : [],
        })) || [];

        const totalHrs = Math.floor(record.totalWorkingMinutes / 60);
        const totalMins = record.totalWorkingMinutes % 60;

        days.push({
          dateNum: dayNum,
          dayName,
          fullDate: dateStr.split('-').reverse().join('/'),
          status: 'present',
          location: record.sessions?.[0]?.workType || 'Office',
          startTime: record.firstClockIn ? new Date(record.firstClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          endTime: record.lastClockOut ? new Date(record.lastClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          sessions,
          tasks: record.sessions?.map(s => ({ title: s.notes || 'Task', duration: '' })) || [],
          hoursWorked: `${totalHrs}h ${totalMins}m`,
          expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '',
        });
      } else {
        const isSunday = dayOfWeekIdx === 0;
        days.push({
          dateNum: dayNum,
          dayName,
          fullDate: dateStr.split('-').reverse().join('/'),
          status: isSunday ? 'holiday' : 'absent',
          location: '',
          startTime: undefined,
          endTime: undefined,
          sessions: [],
          tasks: [],
          hoursWorked: '',
          expenses: '',
        });
      }
    }
    return days;
  }, [startDate, endDate, attendanceRecords, expenseClaims]);

  const tableRows = useMemo(() => {
    return attendanceRecords.map((record) => {
      const start = record.firstClockIn ? new Date(record.firstClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const end = record.lastClockOut ? new Date(record.lastClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const duration = `${Math.floor(record.totalWorkingMinutes / 60)}h ${record.totalWorkingMinutes % 60}m`;
      const breakTime = `${Math.floor(record.totalBreakMinutes / 60)}h ${record.totalBreakMinutes % 60}m`;

      const dayClaims = expenseClaims.filter(c => c.createdAt.slice(0, 10) === record.workDate);
      const dayExpensesSum = dayClaims.reduce((sum, c) => sum + (c.amount || 0), 0);

      const emp = employees.find(e => e.id === record.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'System Admin';

      return {
        date: record.workDate.split('-').reverse().join('/'),
        name: empName,
        holiday: new Date(record.workDate).getDay() === 0 ? 'Sunday' : '',
        org: record.sessions?.[0]?.workType || 'Office',
        location: record.sessions?.[0]?.workType || 'Office',
        type: (record.sessions?.[0]?.workType || 'Office') as string,
        mode: 'Offline',
        start,
        end,
        duration,
        expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '—',
        note: record.sessions?.[0]?.notes || '',
        break: breakTime,
        tasks: record.sessions?.map(s => s.notes).filter(Boolean) as string[] || [],
      };
    });
  }, [attendanceRecords, expenseClaims, employees]);

  const mappedExpenseRows = useMemo(() => {
    return expenseClaims.map((claim) => {
      const emp = employees.find((e) => e.id === claim.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'System Admin';
      return {
        id: claim.id,
        date: claim.createdAt.slice(0, 10),
        employee: empName,
        category: claim.category,
        batch: (claim as any).projectName || (claim as any).batchName || 'Office Operations',
        amount: claim.amount,
        status: claim.status === 'approved' ? 'Approved' : 'Pending Approval',
      };
    });
  }, [expenseClaims, employees]);

  useEffect(() => {
    setExpenseRows(mappedExpenseRows);
  }, [mappedExpenseRows]);

  const totalExpenseSum = useMemo(() => {
    return expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [expenseRows]);

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
          <AttendanceCalendarView
            days={calendarDays}
            showTopSummaries={true}
            showBottomSummaries={false}
            showCalendarGrid={false}
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
                    <th style={{ padding: '8px 10px' }}>Location</th>
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
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--brand)' }}>{r.location || '-'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {r.type && (
                            <Badge tone={r.type === 'Training' ? 'info' : r.type === 'Supervision' ? 'progress' : r.type === 'Marketing' ? 'warning' : r.type === 'Leave' ? 'danger' : 'neutral'}>
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

          <AttendanceCalendarView
            days={calendarDays}
            showTopSummaries={false}
            showBottomSummaries={true}
            showCalendarGrid={false}
            selectedEmployeeName={selectedEmployeeDisplay}
          />
        </div>
      ),
    },
    {
      id: 'expense_summary',
      label: '💰 Expense Summary',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Total Claimed Expenses — {selectedEmployeeDisplay}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
                  ₹ {totalExpenseSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <Card style={{ padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>📅 Date Filter:</span>
                <select
                  className="kvj-select"
                  value={activeFilterPreset}
                  onChange={(e) => handleFilterPreset(e.target.value as any)}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
                >
                  <option value="current_month">Current Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_1_year">Last One Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {activeFilterPreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-sunken)', padding: '4px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <input
                    type="date"
                    className="kvj-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: '2px 6px', fontSize: 12 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    className="kvj-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ padding: '2px 6px', fontSize: 12 }}
                  />
                </div>
              )}

              <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Employee:</span>
                {isManagement ? (
                  <select
                    className="kvj-select"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 180 }}
                  >
                    <option value={user?.fullName || 'System Admin'}>Me ({user?.fullName || 'Personal'})</option>
                    <option value="All Employees">All Employees (Manager Access)</option>
                    {employeeNames.filter((name) => name !== user?.fullName).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                    👤 {user?.fullName || 'System Admin'}
                  </span>
                )}
              </div>
            </div>

            <Button onClick={() => setSubmitDrawerOpen(true)} style={{ padding: '6px 16px', fontSize: 12 }}>
              📋 Submit Attendance
            </Button>
          </div>
        </Card>

        <Tabs items={tabs} />
      </div>

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

      {/* Receipt Preview Modal / Drawer */}
      <Drawer open={!!receiptModalUrl} onClose={() => setReceiptModalUrl(null)} title="Expense Receipt Preview">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16 }}>
          <img src={receiptModalUrl || '/logo.png'} alt="Receipt Preview" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--border)' }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Signed Voucher & Verified Official Receipt</div>
          <Button variant="secondary" onClick={() => setReceiptModalUrl(null)}>Close Preview</Button>
        </div>
      </Drawer>
    </AppShell>
  );
}

export default AttendanceLogPage;
