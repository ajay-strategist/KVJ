import { useState, useEffect, useMemo } from 'react';
import { Card, SectionHeader, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../../finance/finance.repository';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import type { AttendanceRecord } from '../attendance.repository';
import type { ExpenseClaim } from '../../finance/finance.repository';

export interface AttendanceSummaryPanelsProps {
  startDate: string;
  endDate: string;
  employeeName: string;
  userRole?: string;
  onFilterChange?: (filters: { startDate: string; endDate: string; filterPreset: string; employeeId?: string }) => void;
  onDeclareHoliday?: (holiday: { date: string; name: string }) => void;
  onRequestEmergencyApproval?: (req: { date: string; batch: string; reason: string }) => void;
}

export function AttendanceSummaryPanels({
  startDate,
  endDate,
  employeeName,
  userRole = 'EMPLOYEE',
  onFilterChange,
  onDeclareHoliday,
  onRequestEmergencyApproval,
}: AttendanceSummaryPanelsProps) {
  const { toast } = useNotifications();

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [activeFilterPreset, setActiveFilterPreset] = useState('current_month');
  const [selectedEmployee, setSelectedEmployee] = useState(employeeName);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((r) => {
      if (r.ok) setEmployees(r.value);
    });
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const attendanceRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
        const expenseRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
        const range = { from: startDate, to: endDate };

        let records: AttendanceRecord[] = [];
        let claims: ExpenseClaim[] = [];

        if (selectedEmployee === 'All Employees') {
          const allRes = await attendanceRepo.findMany();
          records = allRes.data.filter(r => r.workDate >= range.from && r.workDate <= range.to);
          const allClaims = await expenseRepo.findMany();
          claims = allClaims.data.filter(c => c.createdAt >= range.from && c.createdAt <= range.to);
        } else {
          const emp = employees.find(e => `${e.firstName} ${e.lastName}` === selectedEmployee);
          const empId = emp?.id;
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
    };
    fetchHistory();
  }, [startDate, endDate, selectedEmployee, employees]);

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
    return mins !== null && mins > 9 * 60;
  };

  const isEarly = (timeStr?: string) => {
    const mins = parseTime(timeStr);
    return mins !== null && mins < 17 * 60;
  };

  const dateList = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const list: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [startDate, endDate]);

  const stats = useMemo(() => {
    const workingDaysInMonth = dateList.filter(d => new Date(d).getDay() !== 0).length;
    const daysToBeWorked = workingDaysInMonth;
    
    const presentDates = new Set(attendanceRecords.map(r => r.workDate));
    const noOfLeaves = dateList.filter(d => new Date(d).getDay() !== 0 && !presentDates.has(d)).length;

    const workingDays = attendanceRecords.filter(r => r.status === 'present' || r.status === 'clocked_out').length;
    const holidayWorked = attendanceRecords.filter(r => new Date(r.workDate).getDay() === 0).length;
    
    const lateReporting = attendanceRecords.filter(r => r.firstClockIn && isLate(new Date(r.firstClockIn).toLocaleTimeString())).length;
    const earlyLeaving = attendanceRecords.filter(r => r.lastClockOut && isEarly(new Date(r.lastClockOut).toLocaleTimeString())).length;

    const totalBreakHrs = attendanceRecords.reduce((sum, r) => sum + (r.totalBreakMinutes || 0), 0) / 60;

    const totalExpenses = expenseClaims.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      workingDaysInMonth,
      daysToBeWorked,
      noOfLeaves,
      holidayWorked,
      workingDays,
      lateReporting,
      earlyLeaving,
      breakHrs: Math.round(totalBreakHrs * 100) / 100,
      avgBreakTime: workingDays > 0 ? Math.round((totalBreakHrs / workingDays) * 100) / 100 : 0,
      overBreakTime: '0 hr',
      joinedDate: '—',
      accumulatedLeave: noOfLeaves,
      accumulatedHolidayWorked: holidayWorked,
      overallAvgDuration: workingDays > 0 ? Math.round((attendanceRecords.reduce((sum, r) => sum + (r.totalWorkingMinutes || 0), 0) / 60 / workingDays) * 100) / 100 : 0,
      totalExpenses,
    };
  }, [dateList, attendanceRecords, expenseClaims]);

  const orgBreakdown = useMemo(() => {
    const orgMap: Record<string, { totalHrs: number; count: number }> = {};
    attendanceRecords.forEach((r) => {
      const loc = r.sessions?.[0]?.workType || 'Office';
      const hrs = (r.totalWorkingMinutes || 0) / 60;
      if (!orgMap[loc]) orgMap[loc] = { totalHrs: 0, count: 0 };
      orgMap[loc].totalHrs += hrs;
      orgMap[loc].count += 1;
    });
    return Object.entries(orgMap).map(([organization, data]) => ({
      organization,
      avgDuration: data.count > 0 ? Math.round((data.totalHrs / data.count) * 10) / 10 : 0,
    }));
  }, [attendanceRecords]);

  const classSupervisionSummary = useMemo(() => {
    const instMap: Record<string, { physicalCount: number; onlineCount: number; physicalDur: number; onlineDur: number }> = {};
    attendanceRecords.forEach((r) => {
      const loc = r.sessions?.[0]?.workType || 'Office';
      if (loc === 'Office') return;
      const hrs = (r.totalWorkingMinutes || 0) / 60;
      if (!instMap[loc]) instMap[loc] = { physicalCount: 0, onlineCount: 0, physicalDur: 0, onlineDur: 0 };

      const isOnline = r.sessions?.some((s) => s.notes?.toLowerCase().includes('online')) || false;
      if (isOnline) {
        instMap[loc].onlineCount += 1;
        instMap[loc].onlineDur += hrs;
      } else {
        instMap[loc].physicalCount += 1;
        instMap[loc].physicalDur += hrs;
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
  }, [attendanceRecords]);

  const handlePresetClick = (preset: string) => {
    setActiveFilterPreset(preset);
    let start = '2026-06-01';
    let end = '2026-06-30';
    if (preset === 'last_month') { start = '2026-05-01'; end = '2026-05-31'; }
    else if (preset === 'last_1_year') { start = '2025-06-01'; end = '2026-05-31'; }
    if (onFilterChange) onFilterChange({ startDate: start, endDate: end, filterPreset: preset, employeeId: selectedEmployee });
  };

  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const employeeList = [
    { id: 'u-admin', name: 'Ajaythomas' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtering Toolbar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Date Range:</span>
            {[
              { id: 'current_month', label: 'Current Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_1_year', label: 'Last 1 Year (Excl. Current)' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <Button
                key={p.id}
                variant={activeFilterPreset === p.id ? 'primary' : 'secondary'}
                onClick={() => handlePresetClick(p.id)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {p.label}
              </Button>
            ))}

            {isManagement ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Employee:</span>
                <select
                  className="kvj-select"
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    if (onFilterChange) onFilterChange({ startDate, endDate, filterPreset: activeFilterPreset, employeeId: e.target.value });
                  }}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 150 }}
                >
                  <option value="All Employees">All Employees</option>
                  {employeeList.map((e) => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginLeft: 12 }}>
                👤 Employee: {employeeName}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setHolidayOpen(true)} style={{ fontSize: 12 }}>
                🎉 Declare Holiday
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEmergencyOpen(true)} style={{ fontSize: 12 }}>
              🚨 Request Emergency Attendance
            </Button>
          </div>
        </div>
      </Card>

      {/* Grid of Summary Blocks matching Screenshot 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Input Summary */}
        <Card>
          <SectionHeader title="Input Specs" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Start Date:</span> <strong>{startDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>End Date:</span> <strong>{endDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Employee Name:</span> <strong>{employeeName}</strong></div>
          </div>
        </Card>

        {/* Monthly Summary */}
        <Card>
          <SectionHeader title="Monthly Summary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Working Days in Month:</span> <strong>{stats.workingDaysInMonth}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Days to be Worked:</span> <strong>{stats.daysToBeWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-danger)' }}><span>No. of Leaves:</span> <strong>{stats.noOfLeaves}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand)' }}><span>Holiday Worked:</span> <strong>{stats.holidayWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Working Days:</span> <strong>{stats.workingDays}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Late Reporting:</span> <strong>{stats.lateReporting}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Break Total:</span> <strong>{stats.breakHrs} hrs</strong></div>
          </div>
        </Card>

        {/* Accumulated Stats */}
        <Card>
          <SectionHeader title="Accumulated & Expenses" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Joined Date:</span> <strong>{stats.joinedDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-danger)' }}><span>Accumulated Leave:</span> <strong>{stats.accumulatedLeave}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand)' }}><span>Holiday Worked Total:</span> <strong>{stats.accumulatedHolidayWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Overall Avg Duration:</span> <strong>{stats.overallAvgDuration} hrs/day</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              <span>Total Expenses:</span> <strong style={{ color: 'var(--status-success)' }}>₹ {stats.totalExpenses.toLocaleString()}</strong>
            </div>
          </div>
        </Card>

        {/* Organization vs Avg Duration */}
        <Card>
          <SectionHeader title="Organization vs Avg Duration" />
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '4px 0' }}>Organization</th>
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
      </div>

      {/* Class / Supervision Summary (Screenshot 3) */}
      <Card>
        <SectionHeader title="Class & Supervision Training Summary" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-primary)' }}>
                <th style={{ padding: 8 }}>Institution</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Physical Classes</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Online Classes</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Physical Duration (hr)</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Online Duration (hr)</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {classSupervisionSummary.map((c) => (
                <tr key={c.institution} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{c.institution}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.physicalClasses}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.onlineClasses}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.physicalClassDuration}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.onlineDuration}</td>
                  <td style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: 'var(--brand)' }}>{c.totalPhysicalDuration} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Declare Holiday Modal */}
      <Drawer open={holidayOpen} onClose={() => setHolidayOpen(false)} title="Declare Company / Public Holiday">
        <Form
          initial={{ date: '', name: '' }}
          onSubmit={(values) => {
            if (onDeclareHoliday) onDeclareHoliday(values as any);
            toast({ variant: 'success', title: 'Holiday Declared', message: `Holiday '${values.name}' declared for ${values.date}` });
            setHolidayOpen(false);
          }}
        >
          <TextField name="date" label="Holiday Date (YYYY-MM-DD)" placeholder="2026-08-15" />
          <TextField name="name" label="Holiday Occasion / Name" placeholder="Independence Day, Onam, Bakrid..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setHolidayOpen(false)}>Cancel</Button>
            <Button type="submit">Declare Holiday</Button>
          </div>
        </Form>
      </Drawer>

      {/* Emergency Attendance Approval Request Modal */}
      <Drawer open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Emergency Attendance Request (Training Sessions)">
        <Form
          initial={{ date: '', batch: '', reason: '' }}
          onSubmit={(values) => {
            if (onRequestEmergencyApproval) onRequestEmergencyApproval(values as any);
            toast({ variant: 'info', title: 'Emergency Request Sent', message: 'Submitted for CEO & Manager approval.' });
            setEmergencyOpen(false);
          }}
        >
          <TextField name="date" label="Missed Clock-In Date" placeholder="2026-06-25" />
          <TextField name="batch" label="Training Batch Name" placeholder="Christ 3BBA Data Analytics B1" />
          <TextField name="reason" label="Emergency Reason" placeholder="Network issue, travel delay, urgent college entry..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setEmergencyOpen(false)}>Cancel</Button>
            <Button type="submit">Send for Approval</Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
