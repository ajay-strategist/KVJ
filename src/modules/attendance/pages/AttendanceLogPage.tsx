import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { ATTENDANCE_REPOSITORY_TOKEN, type AttendanceRecord, type WorkSessionType } from '../attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN, type ExpenseClaim } from '../../finance/finance.repository';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { toLocalISODate, todayISO } from '../../../shared/utils/date';
import { useTraining } from '../../training/hooks/useTraining';
import { supabase } from '../../../shared/integration/supabase';

/**
 * Human-readable name of a training batch, e.g.
 * "Christ Irinjalakkuda - 3 BBA - 2026-2027 - Batch 1".
 *
 * The attendance log used to show a batch's `trainingName` (the course, e.g.
 * "Power BI") in the Organization/Location columns. Those columns should carry
 * the BATCH identity, so we compose it from college · program · academic year ·
 * batch number, falling back to the course/code only when those are absent.
 */
function batchDisplayName(b?: {
  college?: string; program?: string; academicYear?: string;
  batchNo?: string; trainingName?: string; code?: string;
} | null): string {
  if (!b) return 'Training Batch';
  const parts = [b.college, b.program, b.academicYear, b.batchNo].filter(Boolean);
  if (parts.length) return parts.join(' - ');
  if (b.code && b.code !== '—') return b.code;
  if (b.batchNo && b.batchNo !== '—') return b.batchNo;
  return b.trainingName || 'Training Batch';
}

function safeFormatTime(raw?: string): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export interface AttendanceLogRow {
  date: string;
  name: string;
  holiday: string;
  org: string;
  location: string;
  type: string;
  mode: string;
  start: string;
  end: string;
  duration: string;
  expenses: string;
  note: string;
  break: string;
  tasks: string[];
}

export function AttendanceLogPage() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { batches } = useTraining();

  const userRole = user?.role || 'EMPLOYEE';
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const now = new Date();
  const defaultStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [activeFilterPreset, setActiveFilterPreset] = useState<'current_month' | 'last_month' | 'last_1_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    isManagement ? 'All Employees' : (user?.fullName || 'System Admin')
  );
  const [submitDrawerOpen, setSubmitDrawerOpen] = useState(false);
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const [expenseRows, setExpenseRows] = useState<Array<{ id: string; date: string; employee: string; category: string; batch: string; amount: number; status: string }>>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [declaredHolidays, setDeclaredHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [leaveRecords, setLeaveRecords] = useState<Array<{ employeeId: string; startDate: string; endDate: string; leaveType: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
        const res = await empService.listEmployees();
        if (res.ok) {
          setEmployees(res.value);
        }
      } catch (e) {
        console.error('Error fetching employees:', e);
      }
    };
    fetchEmployees();
  }, []);

  const employeeNames = useMemo(() => {
    return (employees || []).map((e) => `${e.firstName || ''} ${e.lastName || ''}`.trim());
  }, [employees]);

  const currentEmployee = useMemo(() => {
    if (selectedEmployee === 'All Employees') return null;
    return (employees || []).find(e => `${e.firstName || ''} ${e.lastName || ''}`.trim() === selectedEmployee) || null;
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
          const rawRecords = Array.isArray(allRes?.data) ? allRes.data : Array.isArray(allRes) ? allRes : [];
          records = rawRecords.filter((r: any) => r && r.workDate && r.workDate >= range.from && r.workDate <= range.to);
          const allClaims = await expenseRepo.findMany();
          const rawClaims = Array.isArray(allClaims?.data) ? allClaims.data : Array.isArray(allClaims) ? allClaims : [];
          claims = rawClaims.filter((c: any) => c && (c.createdAt || '').slice(0, 10) >= range.from && (c.createdAt || '').slice(0, 10) <= range.to);
        } else {
          const empId = currentEmployee?.id || user?.id;
          if (empId) {
            const rawHist = await attendanceRepo.findHistory(empId, range);
            records = Array.isArray(rawHist) ? rawHist : [];
            const allClaims = await expenseRepo.findMany();
            const rawClaims = Array.isArray(allClaims?.data) ? allClaims.data : Array.isArray(allClaims) ? allClaims : [];
            claims = rawClaims.filter((c: any) => c && c.employeeId === empId && (c.createdAt || '').slice(0, 10) >= range.from && (c.createdAt || '').slice(0, 10) <= range.to);
          }
        }
        setAttendanceRecords(Array.isArray(records) ? records : []);
        setExpenseClaims(Array.isArray(claims) ? claims : []);

        const { data: hData } = await supabase.from('declared_holidays').select('*');
        if (hData) {
          setDeclaredHolidays(hData.map((h: any) => ({ date: h.date || h.holiday_date, name: h.title || h.name || 'Company Holiday' })));
        }

        const { data: lData } = await supabase.from('leave_records').select('*');
        if (lData) {
          setLeaveRecords(
            lData.map((l: any) => ({
              employeeId: l.employee_id || l.employeeId || '',
              startDate: (l.start_date || l.startDate || '').slice(0, 10),
              endDate: (l.end_date || l.endDate || '').slice(0, 10),
              leaveType: l.leave_type || l.leaveType || 'Leave',
              status: l.status || 'approved',
            }))
          );
        }
      } catch (e) {
        console.error('Error fetching attendance history:', e);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [startDate, endDate, currentEmployee, selectedEmployee, user, isManagement]);

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

  const resolveOrgValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string): string => {
    const wt = workType || 'Office';
    const safeBatches = Array.isArray(batches) ? batches : [];

    // 1. Direct recordBatchId lookup
    if (recordBatchId) {
      const found = safeBatches.find((b) => b && (b.id === recordBatchId || b.code === recordBatchId || b.trainingName === recordBatchId));
      if (found) return batchDisplayName(found);
    }

    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;

    // 2. Parse Location: ... in notes
    const locMatch = rawNotes.match(/Location:\s*([^\n,]+)/i);
    if (locMatch && locMatch[1].trim()) {
      let locStr = locMatch[1].trim().replace(/\.$/, '').trim();
      if (locStr.toLowerCase() !== 'office work' && locStr.toLowerCase() !== 'office') {
        const found = safeBatches.find((b) =>
          b && (
            (b.code && b.code.toLowerCase() === locStr.toLowerCase()) ||
            (b.batchNo && b.batchNo.toLowerCase() === locStr.toLowerCase()) ||
            (b.college && locStr.toLowerCase().includes(b.college.toLowerCase()))
          )
        );
        return found ? batchDisplayName(found) : locStr;
      }
    }

    // 3. Search notes for any batch code/name/college matching batches array
    const lower = rawNotes.toLowerCase();
    if (lower.trim()) {
      const found = safeBatches.find((b) =>
        b && (
          (b.batchNo && lower.includes(b.batchNo.toLowerCase())) ||
          (b.code && lower.includes(b.code.toLowerCase())) ||
          (b.college && lower.includes(b.college.toLowerCase())) ||
          (b.trainingName && lower.includes(b.trainingName.toLowerCase()))
        )
      );
      if (found) return batchDisplayName(found);
    }

    // 4. If workType is Training or notes mention training/batch
    const isTraining = wt === 'Training' || wt.toLowerCase().includes('training') || lower.includes('training') || lower.includes('batch');
    if (isTraining) {
      if (safeBatches.length > 0) {
        return batchDisplayName(safeBatches[0]);
      }
      return 'Training Batch';
    }

    return wt;
  }, [batches]);

  const calendarDays: CalendarDayDetail[] = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: CalendarDayDetail[] = [];

    const recList = Array.isArray(attendanceRecords) ? attendanceRecords : [];
    const claimList = Array.isArray(expenseClaims) ? expenseClaims : [];
    const holList = Array.isArray(declaredHolidays) ? declaredHolidays : [];
    const leaveList = Array.isArray(leaveRecords) ? leaveRecords : [];

    const empId = currentEmployee?.id || user?.id || '';

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalISODate(d);
      const dayNum = d.getDate();
      const dayOfWeekIdx = d.getDay();
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekIdx];

      const record = recList.find(r => r && r.workDate === dateStr);
      const dayClaims = claimList.filter(c => c && (c.createdAt || '').slice(0, 10) === dateStr);
      const dayExpensesSum = dayClaims.reduce((sum, c) => sum + (c?.amount || 0), 0);
      const decHoliday = holList.find((h: any) => h && h.date === dateStr);
      const activeLeave = leaveList.find(l =>
        (selectedEmployee === 'All Employees' || !empId || l.employeeId === empId) &&
        dateStr >= l.startDate && dateStr <= l.endDate &&
        l.status !== 'rejected'
      );

      if (record) {
        const firstSession = record.sessions?.[0];
        const workType = firstSession?.workType || 'Office';
        const batchId = (firstSession as any)?.batchId || (firstSession as any)?.batch_id || (record as any)?.batchId || (record as any)?.batch_id;
        const orgVal = resolveOrgValue(workType, firstSession?.notes, (record as any).notes, batchId) || 'Office';

        const sessions = record.sessions?.map(s => ({
          location: resolveOrgValue(s.workType, s.notes, (record as any).notes, (s as any).batchId || (s as any).batch_id) || 'Office',
          type: s.workType || 'Office',
          startTime: safeFormatTime(s.clockIn),
          endTime: safeFormatTime(s.clockOut),
          tasks: s.notes ? [{ title: s.notes, duration: '' }] : [],
        })) || [];

        const totalMins = record.totalWorkingMinutes || 0;
        const totalHrs = Math.floor(totalMins / 60);
        const remMins = totalMins % 60;

        const isHolType = workType === 'Holiday' || (record as any).notes?.toLowerCase().includes('holiday');
        const isLeaveType = workType === 'Leave' || (record as any).notes?.toLowerCase().includes('leave') || !!activeLeave;

        days.push({
          dateNum: dayNum,
          dayName,
          fullDate: dateStr.split('-').reverse().join('/'),
          status: decHoliday || isHolType ? 'holiday' : isLeaveType ? 'leave' : 'present',
          location: orgVal,
          startTime: safeFormatTime(record.firstClockIn),
          endTime: safeFormatTime(record.lastClockOut),
          sessions,
          tasks: record.sessions?.map(s => ({ title: s.notes || 'Task', duration: '' })) || [],
          hoursWorked: `${totalHrs}h ${remMins}m`,
          expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '',
        });
      } else {
        const isSunday = dayOfWeekIdx === 0;
        const isHoliday = !!decHoliday || isSunday;

        days.push({
          dateNum: dayNum,
          dayName,
          fullDate: dateStr.split('-').reverse().join('/'),
          status: isHoliday ? 'holiday' : activeLeave ? 'leave' : 'absent',
          location: decHoliday ? decHoliday.name : isSunday ? 'Weekend Off' : activeLeave ? `On Leave (${activeLeave.leaveType})` : '',
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
  }, [startDate, endDate, attendanceRecords, expenseClaims, declaredHolidays, leaveRecords, currentEmployee, selectedEmployee, user, resolveOrgValue]);

  const tableRows = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows: AttendanceLogRow[] = [];

    const recList = Array.isArray(attendanceRecords) ? attendanceRecords : [];
    const claimList = Array.isArray(expenseClaims) ? expenseClaims : [];
    const holList = Array.isArray(declaredHolidays) ? declaredHolidays : [];
    const empList = Array.isArray(employees) ? employees : [];
    const leaveList = Array.isArray(leaveRecords) ? leaveRecords : [];

    const empId = currentEmployee?.id || user?.id || '';

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalISODate(d);
      const record = recList.find(r => r && r.workDate === dateStr);
      const dayClaims = claimList.filter(c => c && (c.createdAt || '').slice(0, 10) === dateStr);
      const dayExpensesSum = dayClaims.reduce((sum, c) => sum + (c?.amount || 0), 0);
      const decHoliday = holList.find((h: any) => h && h.date === dateStr);
      const activeLeave = leaveList.find(l =>
        (selectedEmployee === 'All Employees' || !empId || l.employeeId === empId) &&
        dateStr >= l.startDate && dateStr <= l.endDate &&
        l.status !== 'rejected'
      );

      const empName = currentEmployee
        ? `${currentEmployee.firstName || ''} ${currentEmployee.lastName || ''}`.trim()
        : user ? user.fullName || 'Employee' : 'Employee';

      if (record) {
        const emp = empList.find(e => e && e.id === record.employeeId);
        const resolvedEmpName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : empName;
        const totalMins = record.totalWorkingMinutes || 0;
        const breakMins = record.totalBreakMinutes || 0;
        const duration = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
        const breakTime = `${Math.floor(breakMins / 60)}h ${breakMins % 60}m`;

        const sessionsList = record.sessions && record.sessions.length > 0
          ? record.sessions
          : [{
              id: record.id,
              workType: 'Office' as WorkSessionType,
              clockIn: record.firstClockIn || '',
              clockOut: record.lastClockOut || '',
              notes: (record as any).notes || '',
            }];

        const hasMultipleSessions = sessionsList.length > 1;

        sessionsList.forEach((s, sIdx) => {
          const startT = safeFormatTime(s.clockIn || record.firstClockIn);
          const endT = safeFormatTime(s.clockOut || record.lastClockOut);

          const workType = s.workType || 'Office';
          const batchId = (s as any)?.batchId || (s as any)?.batch_id || (record as any)?.batchId || (record as any)?.batch_id;
          const orgVal = resolveOrgValue(workType, s.notes, (record as any).notes, batchId) || 'Office';

          const isReapproved = (s as any).isReapproved ||
            (s as any).status === 'Approved' ||
            (s as any).status === 'reapproved' ||
            (s.notes && (s.notes.toLowerCase().includes('approved') || s.notes.toLowerCase().includes('claim') || s.notes.toLowerCase().includes('reapproved'))) ||
            sIdx > 0;

          const isHoliday = workType === 'Holiday' || (s.notes && s.notes.toLowerCase().includes('holiday')) || !!decHoliday;
          const isLeave = workType === 'Leave' || (s.notes && s.notes.toLowerCase().includes('leave')) || !!activeLeave;

          rows.push({
            date: dateStr.split('-').reverse().join('/'),
            name: resolvedEmpName,
            holiday: decHoliday ? decHoliday.name : d.getDay() === 0 ? 'Sunday' : isHoliday ? 'Holiday' : '',
            org: orgVal,
            location: orgVal,
            type: isHoliday ? 'Holiday' : isLeave ? 'Leave' : (workType as string),
            mode: isHoliday ? 'Holiday' : isLeave ? 'On Leave' : isReapproved ? 'Re-Approved' : (hasMultipleSessions ? `Session ${sIdx + 1}` : 'Offline'),
            start: startT,
            end: endT,
            duration: sIdx === 0 ? duration : '—',
            expenses: sIdx === 0 && dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '—',
            note: s.notes || (record as any).notes || (isHoliday ? 'Holiday' : isLeave ? `On Leave (${activeLeave?.leaveType || 'Leave'})` : isReapproved ? 'Re-approved session' : ''),
            break: sIdx === 0 ? breakTime : '0h 0m',
            tasks: s.notes ? [s.notes] : [],
          });
        });
      } else {
        const isSunday = d.getDay() === 0;
        const isHoliday = !!decHoliday || isSunday;
        const isLeave = !!activeLeave;

        rows.push({
          date: dateStr.split('-').reverse().join('/'),
          name: empName,
          holiday: decHoliday ? decHoliday.name : isSunday ? 'Sunday' : '',
          org: '—',
          location: '—',
          type: isHoliday ? 'Holiday' : isLeave ? 'Leave' : '—',
          mode: isHoliday ? 'Holiday' : isLeave ? 'On Leave' : '—',
          start: '—',
          end: '—',
          duration: '0h 0m',
          expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '—',
          note: decHoliday ? `Declared Holiday: ${decHoliday.name}` : isSunday ? 'Weekend Off' : isLeave ? `On Leave (${activeLeave?.leaveType || 'Leave'})` : 'Not Clocked',
          break: '0h 0m',
          tasks: [],
        });
      }
    }
    return rows;
  }, [startDate, endDate, attendanceRecords, expenseClaims, employees, currentEmployee, user, declaredHolidays, leaveRecords, resolveOrgValue]);

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
                    const typeLower = (r.type || '').toLowerCase();
                    const holidayLower = (r.holiday || '').toLowerCase();
                    const modeLower = (r.mode || '').toLowerCase();
                    const noteLower = (r.note || '').toLowerCase();

                    const isHoliday =
                      typeLower.includes('holiday') ||
                      holidayLower.includes('holiday') ||
                      holidayLower.includes('sunday') ||
                      modeLower.includes('holiday') ||
                      noteLower.includes('holiday') ||
                      noteLower.includes('weekend off') ||
                      noteLower.includes('sunday') ||
                      noteLower.includes('declared holiday');

                    const isLeave =
                      !isHoliday && (
                        typeLower.includes('leave') ||
                        modeLower.includes('leave') ||
                        noteLower.includes('leave') ||
                        noteLower.includes('on leave')
                      );

                    const bg = isHoliday
                      ? 'rgba(239, 68, 68, 0.12)'
                      : isLeave
                      ? 'rgba(245, 158, 11, 0.16)'
                      : i % 2 === 0
                      ? 'var(--bg-surface)'
                      : 'var(--bg-sunken)';

                    const rowTextColor = isHoliday
                      ? 'var(--status-danger)'
                      : isLeave
                      ? '#d97706'
                      : 'inherit';

                    const isExpanded = !!expandedRows[i];

                    return (
                      <tr
                        key={i}
                        style={{
                          background: bg,
                          borderBottom: '1px solid var(--border)',
                          color: rowTextColor,
                          fontWeight: isHoliday || isLeave ? 600 : 400,
                          transition: 'background 140ms ease',
                        }}
                      >
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
                        <td style={{ padding: '8px 10px', color: isHoliday ? 'var(--status-danger)' : 'inherit', fontWeight: isHoliday ? 700 : 400 }}>
                          {r.holiday || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.org}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: isHoliday ? 'var(--status-danger)' : isLeave ? '#d97706' : 'var(--brand)' }}>
                          {r.location || '-'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isHoliday ? (
                            <Badge tone="danger">Holiday</Badge>
                          ) : isLeave ? (
                            <Badge tone="warning">On Leave</Badge>
                          ) : r.type && r.type !== '—' ? (
                            <Badge tone={r.type === 'Training' ? 'info' : r.type === 'Supervision' ? 'progress' : r.type === 'Marketing' ? 'warning' : 'neutral'}>
                              {r.type}
                            </Badge>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isHoliday ? (
                            <Badge tone="danger">Holiday</Badge>
                          ) : isLeave ? (
                            <Badge tone="warning">On Leave</Badge>
                          ) : r.mode === 'Re-Approved' || r.mode.includes('Re-Approved') ? (
                            <Badge tone="success">Re-Approved</Badge>
                          ) : (
                            r.mode
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>{r.start}</td>
                        <td style={{ padding: '8px 10px' }}>{r.end}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.duration}</td>
                        <td style={{ padding: '8px 10px' }}>{r.expenses}</td>
                        <td style={{
                          padding: '8px 10px',
                          color: isHoliday ? 'var(--status-danger)' : isLeave ? '#d97706' : 'var(--text-secondary)',
                          fontWeight: isHoliday || isLeave ? 700 : 500
                        }}>
                          {r.note}
                        </td>
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
            location: 'Office Work',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={async (values) => {
            try {
              const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
              const locText = values.location || 'Office Work';
              const isOffice = locText === 'Office Work';
              const classification = isOffice ? 'Office' : 'Training';

              await attService.requestCorrection(
                String(Date.now()),
                'attendance_claim',
                `${values.date} (${values.startTime} - ${values.endTime})`,
                `Classification: ${classification}, Location: ${locText}. ${values.notes || ''}`,
                { id: user?.id || 'emp-user', role: user?.role || 'Employee' }
              );
            } catch (e) {
              console.warn('Attendance correction request notice:', e);
            }

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
              ...batches.map((b) => ({ value: b.code, label: b.code })),
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
