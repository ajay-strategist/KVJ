import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, useForm } from '../../../shared/forms/form';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { ATTENDANCE_REPOSITORY_TOKEN, type AttendanceRecord, type WorkSessionType } from '../attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN, type ExpenseClaim } from '../../finance/finance.repository';
import { LEAVE_REPOSITORY_TOKEN } from '../../leave/leave.repository';
import { TASK_REPOSITORY_TOKEN } from '../../project/project.repository';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { toLocalISODate, todayISO } from '../../../shared/utils/date';
import { useTraining } from '../../training/hooks/useTraining';
import { cleanBatchCode } from '../../training/utils/batch-formatter';
import { supabase } from '../../../shared/integration/supabase';
import { useDialog } from '../../../shared/feedback/DialogProvider';

/**
 * Human-readable name of a training batch, e.g.
 * "Christ Irinjalakkuda - 3 BBA - 2026-2027 - Batch 1".
 */
function batchDisplayName(b?: {
  college?: string; program?: string; academicYear?: string;
  batchNo?: string; trainingName?: string; code?: string;
} | null): string {
  if (!b) return 'Training Batch';
  const cleaned = cleanBatchCode(b.code);
  if (cleaned) return cleaned;
  const parts = [b.college, b.program, b.academicYear, b.batchNo].filter(Boolean);
  if (parts.length) return parts.join(' - ');
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
  isTraining?: boolean;
}

function ConditionalAttendanceFields() {
  const { values } = useForm();
  const { batches } = useTraining();
  
  if (values.classification === 'Training') {
    const options = batches.length > 0
      ? batches.map((b) => ({ value: b.code, label: b.code }))
      : [{ value: 'No Batches Available', label: 'No Batches Available' }];
    return (
      <SelectField
        name="location"
        label="Select Training Batch"
        options={options}
      />
    );
  }

  if (values.classification === 'Marketing') {
    return (
      <TextField
        name="organisationsVisited"
        label="Organisations Visited"
        placeholder="e.g. Christ College, Rajagiri College"
      />
    );
  }

  return null;
}

export function AttendanceLogPage() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { confirm } = useDialog();
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

  const [expenseRows, setExpenseRows] = useState<Array<any>>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
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

        const { data: hData } = await supabase.from('flwdsk_declared_holidays').select('*');
        if (hData) {
          setDeclaredHolidays(hData.map((h: any) => ({ date: h.date || h.holiday_date, name: h.title || h.name || 'Company Holiday' })));
        }

        const { data: lData } = await supabase.from('flwdsk_leave_records').select('*');
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
  }, [startDate, endDate, currentEmployee, selectedEmployee, user, isManagement, refetchTrigger]);

  useEffect(() => {
    const fetchTodayRecords = async () => {
      try {
        const attendanceRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
        const today = todayISO();
        const allRes = await attendanceRepo.findMany();
        const rawRecords = Array.isArray(allRes?.data) ? allRes.data : Array.isArray(allRes) ? allRes : [];
        const filtered = rawRecords.filter((r: any) => r && r.workDate === today);
        setTodayRecords(filtered);
      } catch (e) {
        console.error('Error fetching today records:', e);
      }
    };
    fetchTodayRecords();
  }, [attendanceRecords, refetchTrigger]);

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

  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
    const selectedIds = Object.keys(selectedExpenses).filter((id) => selectedExpenses[id]);
    if (selectedIds.length === 0) return;

    const actionText = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'delete';
    const confirmOk = await confirm({
      title: `Bulk ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}?`,
      message: `Are you sure you want to ${actionText} the ${selectedIds.length} selected expense claim(s)?`,
    });
    if (!confirmOk) return;

    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .delete()
          .in('id', selectedIds);
        if (error) throw error;
        toast({ variant: 'warning', title: 'Claims Deleted', message: `${selectedIds.length} claim(s) successfully deleted.` });
      } else {
        const updates: Record<string, any> = {
          status: action === 'approve' ? 'approved' : 'rejected'
        };
        if (action === 'approve') {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .update(updates)
          .in('id', selectedIds);
        if (error) throw error;
        toast({ variant: 'success', title: `Claims ${action === 'approve' ? 'Approved' : 'Rejected'}`, message: `${selectedIds.length} claim(s) successfully updated.` });
      }
      setSelectedExpenses({});
      setRefetchTrigger(prev => prev + 1);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Bulk Action Failed', message: e.message });
    }
  };

  const handleIndividualAction = async (id: string, action: 'approve' | 'reject' | 'delete') => {
    try {
      if (action === 'delete') {
        const confirmOk = await confirm({
          title: 'Delete Expense Claim?',
          message: 'Are you sure you want to delete this expense claim? This cannot be undone.',
        });
        if (!confirmOk) return;
        const { error } = await supabase.from('flwdsk_expense_claims').delete().eq('id', id);
        if (error) throw error;
        toast({ variant: 'warning', title: 'Claim Deleted', message: 'Expense claim deleted successfully.' });
      } else {
        const updates: Record<string, any> = {
          status: action === 'approve' ? 'approved' : 'rejected'
        };
        if (action === 'approve') {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
        const { error } = await supabase.from('flwdsk_expense_claims').update(updates).eq('id', id);
        if (error) throw error;
        toast({ variant: 'success', title: `Claim ${action === 'approve' ? 'Approved' : 'Rejected'}`, message: `Expense claim successfully updated.` });
      }
      setRefetchTrigger(prev => prev + 1);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Action Failed', message: e.message });
    }
  };

  const escapeXml = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const handleExportAllData = async () => {
    try {
      toast({ variant: 'info', title: 'Exporting Data', message: 'Fetching all data tables, please wait...' });
      
      const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
      const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      const leaveRepo = container.resolve(LEAVE_REPOSITORY_TOKEN);
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);

      const [attRes, expRes, leaveRes, taskRes] = await Promise.all([
        attRepo.findMany({ pageSize: 2000 }),
        expRepo.findMany({ pageSize: 2000 }),
        leaveRepo.findMany({ pageSize: 2000 }),
        taskRepo.findMany({ pageSize: 2000 }),
      ]);

      const attList = attRes?.data || [];
      const expList = expRes?.data || [];
      const leaveList = leaveRes?.data || [];
      const taskList = taskRes?.data || [];
      const empList = employees || [];

      // Helper to build a table sheet
      const buildSheet = (sheetName: string, headers: string[], rows: any[][]) => {
        let sheetXml = `  <Worksheet ss:Name="${sheetName}">\n    <Table>\n      <Row>\n`;
        headers.forEach(h => {
          sheetXml += `        <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
        });
        sheetXml += `      </Row>\n`;
        
        rows.forEach(r => {
          sheetXml += `      <Row>\n`;
          r.forEach(v => {
            const valStr = escapeXml(v);
            const isNum = typeof v === 'number' && !isNaN(v);
            const typeAttr = isNum ? 'Number' : 'String';
            sheetXml += `        <Cell><Data ss:Type="${typeAttr}">${valStr}</Data></Cell>\n`;
          });
          sheetXml += `      </Row>\n`;
        });
        
        sheetXml += `    </Table>\n  </Worksheet>\n`;
        return sheetXml;
      };

      // 1. Employees Sheet
      const empHeaders = ['ID', 'Employee ID', 'First Name', 'Last Name', 'Email', 'Designation', 'Joining Date'];
      const empRows = empList.map(e => [
        e.id,
        e.employeeId,
        e.firstName,
        e.lastName,
        e.email,
        e.designation,
        e.dateOfJoining
      ]);

      // 2. Attendance Sheet
      const attHeaders = ['Record ID', 'Date', 'Employee ID', 'Status', 'Work Type', 'First Clock In', 'Last Clock Out', 'Total Hours'];
      const attRows = attList.map(a => [
        a.id,
        a.workDate,
        a.employeeId,
        a.status || 'present',
        (a as any).workType || 'office',
        a.firstClockIn || '',
        a.lastClockOut || '',
        (a as any).totalHours != null ? Number((a as any).totalHours) : ''
      ]);

      // 3. Leave Sheet
      const leaveHeaders = ['Record ID', 'Employee ID', 'Leave Type', 'Start Date', 'End Date', 'Half Day', 'Status', 'Reason', 'Med Certificate'];
      const leaveRows = leaveList.map(l => [
        l.id,
        l.employeeId,
        l.leaveType,
        l.startDate,
        l.endDate,
        l.halfDay ? 'Yes' : 'No',
        l.status,
        l.reason,
        l.medicalCertUrl || ''
      ]);

      // 4. Expenses Sheet
      const expHeaders = ['Claim ID', 'Employee ID', 'Person Name', 'Classification', 'Expense Type', 'Amount (INR)', 'Status', 'Notes', 'Receipt URL'];
      const expRows = expList.map(ex => {
        let person = 'Employee';
        let type = 'Misc';
        let userNotes = ex.notes || '';

        if (ex.notes && ex.notes.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(ex.notes);
            person = parsed.personName || person;
            type = parsed.expenseType || type;
            userNotes = parsed.userNotes || '';
          } catch (e) {}
        }

        return [
          ex.id,
          ex.employeeId,
          person,
          ex.category || 'Office Expense',
          type,
          ex.amount != null ? Number(ex.amount) : 0,
          ex.status,
          userNotes,
          ex.receiptUrl || ''
        ];
      });

      // 5. Tasks Sheet
      const taskHeaders = ['Task ID', 'Title', 'Project ID', 'Assignee ID', 'Supervisor ID', 'Status', 'Priority', 'Due Date', 'Approval Status'];
      const taskRows = taskList.map(t => [
        t.id,
        t.title,
        t.projectId || 'Office Task',
        t.assigneeId || '',
        t.supervisorId || '',
        t.status,
        t.priority,
        t.dueDate,
        t.approvalStatus || 'approved'
      ]);

      let xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
      xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
      xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
      xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

      xml += buildSheet('Employees', empHeaders, empRows);
      xml += buildSheet('Attendance', attHeaders, attRows);
      xml += buildSheet('Leaves', leaveHeaders, leaveRows);
      xml += buildSheet('Expenses', expHeaders, expRows);
      xml += buildSheet('Tasks', taskHeaders, taskRows);

      xml += `</Workbook>\n`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KVJ_Analytics_CEO_Report_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Export Complete', message: 'Excel workbook downloaded successfully.' });
    } catch (err: any) {
      console.error('Export error:', err);
      toast({ variant: 'error', title: 'Export Failed', message: err.message || 'Unknown error occurred during export.' });
    }
  };

  const resolveBatchHelper = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string) => {
    const wt = workType || 'Office';
    const safeBatches = Array.isArray(batches) ? batches : [];
    const isTraining = wt.startsWith('Training:') || wt === 'Training' || (sessionNotes || '').toLowerCase().includes('training') || (recordNotes || '').toLowerCase().includes('training');

    let foundBatch: any = null;

    // 1. Direct recordBatchId lookup
    if (recordBatchId) {
      foundBatch = safeBatches.find((b) => b && (b.id === recordBatchId || b.code === recordBatchId || b.trainingName === recordBatchId));
    }

    // 2. Extract batch code from "Training: Code" prefix
    if (!foundBatch && wt.startsWith('Training:')) {
      const codePart = wt.substring(9).trim();
      foundBatch = safeBatches.find((b) =>
        b && (
          b.code === codePart ||
          b.id === codePart ||
          b.trainingName === codePart ||
          batchDisplayName(b) === codePart
        )
      );
    }

    // 3. Parse Location from notes
    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
    const locMatch = rawNotes.match(/Location:\s*([^\n,]+)/i);
    if (!foundBatch && locMatch && locMatch[1].trim()) {
      const locStr = locMatch[1].trim().replace(/\.$/, '').trim();
      if (locStr.toLowerCase() !== 'office work' && locStr.toLowerCase() !== 'office') {
        foundBatch = safeBatches.find((b) =>
          b && (
            (b.code && b.code.toLowerCase() === locStr.toLowerCase()) ||
            (b.batchNo && b.batchNo.toLowerCase() === locStr.toLowerCase()) ||
            (b.college && locStr.toLowerCase().includes(b.college.toLowerCase()))
          )
        );
      }
    }

    // 4. Search notes for batch details
    const lower = rawNotes.toLowerCase();
    if (!foundBatch && lower.trim()) {
      foundBatch = safeBatches.find((b) =>
        b && (
          (b.batchNo && lower.includes(b.batchNo.toLowerCase())) ||
          (b.code && lower.includes(b.code.toLowerCase())) ||
          (b.college && lower.includes(b.college.toLowerCase())) ||
          (b.trainingName && lower.includes(b.trainingName.toLowerCase()))
        )
      );
    }

    // 5. Fallback if training but no batch matched
    if (!foundBatch && isTraining && safeBatches.length > 0) {
      foundBatch = safeBatches[0];
    }

    return { foundBatch, isTraining };
  }, [batches]);

  const resolveOrgValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string): string => {
    const { foundBatch, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (foundBatch) {
      return batchDisplayName(foundBatch);
    }
    return isTraining ? 'Training Batch' : (workType === 'Office' ? 'KVJ Analytics' : '—');
  }, [resolveBatchHelper]);

  const resolveLocationValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string): string => {
    const { foundBatch, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (foundBatch) {
      return foundBatch.venue || foundBatch.college || 'Offline';
    }
    return isTraining ? 'Offline' : (workType === 'Office' ? 'Office' : workType || '—');
  }, [resolveBatchHelper]);

  const resolveClassOrWorkValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string) => {
    const { foundBatch, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (isTraining) {
      return { value: 'Class', isTraining: true };
    }
    const wt = workType || 'Office';
    const cleanWt = wt.startsWith('Training:') ? wt.substring(9).trim() : wt;
    return { value: cleanWt, isTraining: false };
  }, [resolveBatchHelper]);

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
        l.status !== 'rejected' &&
        l.status !== 'cancelled'
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
          breakMinutes: record.totalBreakMinutes || 0,
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
        l.status !== 'rejected' &&
        l.status !== 'cancelled'
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
          const locVal = resolveLocationValue(workType, s.notes, (record as any).notes, batchId) || 'Office';
          const classOrWorkInfo = resolveClassOrWorkValue(workType, s.notes, (record as any).notes, batchId);

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
            location: locVal,
            type: isHoliday ? 'Holiday' : isLeave ? 'Leave' : classOrWorkInfo.value,
            isTraining: classOrWorkInfo.isTraining,
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
  }, [startDate, endDate, attendanceRecords, expenseClaims, employees, currentEmployee, user, declaredHolidays, leaveRecords, resolveOrgValue, resolveLocationValue, resolveClassOrWorkValue]);

  const mappedExpenseRows = useMemo(() => {
    return expenseClaims.map((claim) => {
      const emp = employees.find((e) => e.id === claim.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'System Admin';

      let person = empName;
      let type = 'Misc';
      let batch = (claim as any).projectName || (claim as any).batchName || 'Office Operations';
      let route = undefined;
      let vehicle = undefined;
      let km = undefined;
      let userNotes = claim.notes || '';

      if (claim.notes && claim.notes.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(claim.notes);
          person = parsed.personName || person;
          type = parsed.expenseType || type;
          batch = parsed.batchName || batch;
          route = parsed.route || route;
          vehicle = parsed.vehicle || undefined;
          km = parsed.km || undefined;
          userNotes = parsed.userNotes || '';
        } catch (e) {}
      }

      return {
        id: claim.id,
        date: new Date(claim.createdAt).toLocaleDateString('en-GB'),
        employee: person,
        category: claim.category || 'Office Expense',
        type,
        batch,
        notes: userNotes,
        route,
        vehicle,
        km,
        amount: Number(claim.amount || 0),
        receipt: claim.receiptUrl || '',
        status: (claim.status || 'submitted').toLowerCase(),
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

  // ── Office Timeline data (today's snapshot for all employees) ──
  const todayStr = todayISO();
  const timelineRows = useMemo(() => {
    const empList = Array.isArray(employees) ? employees : [];
    const recList = Array.isArray(todayRecords) ? todayRecords : [];
    const leaveList = Array.isArray(leaveRecords) ? leaveRecords : [];
    const holList = Array.isArray(declaredHolidays) ? declaredHolidays : [];
    const today = todayStr;
    const isHolidayToday = holList.some((h: any) => h.date === today) || new Date().getDay() === 0;
    const targetEmps = isManagement ? empList : empList.filter((e) => e.id === user?.id);
    return targetEmps.map((emp) => {
      const empId = emp.id;
      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
      const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
      const onLeave = leaveList.find(
        (l) => l.employeeId === empId && today >= l.startDate && today <= l.endDate && l.status !== 'rejected' && l.status !== 'cancelled'
      );
      const todayRec = recList.find((r) => r.employeeId === empId && r.workDate === today);
      let status: 'present' | 'leave' | 'holiday' | 'absent' = 'absent';
      if (isHolidayToday) status = 'holiday';
      else if (onLeave) status = 'leave';
      else if (todayRec) status = 'present';
      const clockIn = todayRec?.firstClockIn ? safeFormatTime(todayRec.firstClockIn) : null;
      const clockOut = todayRec?.lastClockOut ? safeFormatTime(todayRec.lastClockOut) : null;
      const workMins = todayRec?.totalWorkingMinutes || 0;
      const workType = (todayRec?.sessions?.[0]?.workType || 'Office') as string;
      const barPct = Math.min(100, Math.round((workMins / 540) * 100));
      return { empId, name, initials, status, clockIn, clockOut, workMins, workType, barPct, leaveType: onLeave?.leaveType };
    });
  }, [employees, todayRecords, leaveRecords, declaredHolidays, isManagement, user, todayStr]);

  const STATUS_COLORS: Record<string, string> = {
    present: 'var(--status-success)',
    leave: '#f59e0b',
    holiday: 'var(--status-danger)',
    absent: 'var(--text-muted)',
  };
  const STATUS_LABELS: Record<string, string> = {
    present: '\u2705 Present',
    leave: '\ud83c\udfd6 On Leave',
    holiday: '\ud83c\udf89 Holiday',
    absent: '\u26ab Absent',
  };

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
                            <Badge tone={r.isTraining ? 'info' : r.type === 'Supervision' ? 'progress' : r.type === 'Marketing' ? 'warning' : 'neutral'}>
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    onClick={() => handleBulkAction('approve')}
                    disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                    style={{ background: 'var(--status-success)', color: 'white' }}
                  >
                    ✓ Bulk Approve Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('reject')}
                    disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                    style={{ background: 'var(--status-danger)', color: 'white' }}
                  >
                    ✕ Bulk Reject Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('delete')}
                    disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                    variant="danger"
                  >
                    🗑️ Bulk Delete Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                  </Button>
                </div>
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
                          checked={
                            expenseRows.length > 0 &&
                            expenseRows.every((exp) => selectedExpenses[exp.id])
                          }
                        />
                      </th>
                    )}
                    <th style={{ padding: 10 }}>Date</th>
                    <th style={{ padding: 10 }}>Employee</th>
                    <th style={{ padding: 10 }}>Classification</th>
                    <th style={{ padding: 10 }}>Expense Type</th>
                    <th style={{ padding: 10 }}>Batch / Route</th>
                    <th style={{ padding: 10 }}>Amount (₹)</th>
                    <th style={{ padding: 10 }}>Receipt</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((exp) => {
                    const isLocked = exp.status === 'approved';
                    return (
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
                        <td style={{ padding: 10 }}>
                          <Badge tone={exp.category.includes('Training') ? 'info' : 'neutral'}>
                            {exp.category}
                          </Badge>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 600 }}>{exp.type}</div>
                          {exp.vehicle && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {exp.vehicle} · {exp.km} km
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 500, color: 'var(--brand)' }}>{exp.batch || '—'}</div>
                          {exp.route && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🗺 {exp.route}</div>}
                        </td>
                        <td style={{ padding: 10, fontWeight: 800, color: 'var(--status-success)' }}>
                          ₹ {exp.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: 10 }}>
                          {exp.receipt ? (
                            <a href={exp.receipt} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                              📎 View Receipt
                            </a>
                          ) : exp.type === 'Self Travel' ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>KM Auto-Calc</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--status-danger)' }}>Missing</span>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <Badge tone={exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}>
                            {isLocked ? '🔒 Approved' : exp.status}
                          </Badge>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {!isLocked && exp.status === 'submitted' && isManagement && (
                              <>
                                <Button size="xs" variant="success" onClick={() => handleIndividualAction(exp.id, 'approve')}>Approve</Button>
                                <Button size="xs" variant="danger" onClick={() => handleIndividualAction(exp.id, 'reject')}>Reject</Button>
                              </>
                            )}
                            {!isLocked && (
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => handleIndividualAction(exp.id, 'delete')}
                              >
                                Delete
                              </Button>
                            )}
                            {isLocked && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🔒 Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
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
      id: 'office_timeline',
      label: '🏢 Office Timeline',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📅 Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--brand)', color: 'white', borderRadius: 999, padding: '2px 10px' }}>{timelineRows.filter(r => r.status === 'present').length} Present</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: '#f59e0b', color: 'white', borderRadius: 999, padding: '2px 10px' }}>{timelineRows.filter(r => r.status === 'leave').length} On Leave</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--bg-sunken)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 10px', border: '1px solid var(--border)' }}>{timelineRows.filter(r => r.status === 'absent').length} Absent</span>
          </div>

          {timelineRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No employee data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {timelineRows.map((row) => (
                <div
                  key={row.empId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr auto',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${STATUS_COLORS[row.status]}`,
                    transition: 'box-shadow 150ms',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${STATUS_COLORS[row.status]}22`,
                    border: `2px solid ${STATUS_COLORS[row.status]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 800, color: STATUS_COLORS[row.status],
                    flexShrink: 0,
                  }}>
                    {row.initials}
                  </div>

                  {/* Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{row.name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
                        background: `${STATUS_COLORS[row.status]}22`,
                        color: STATUS_COLORS[row.status],
                        border: `1px solid ${STATUS_COLORS[row.status]}55`,
                      }}>
                        {row.status === 'leave' && row.leaveType ? `🏖 On ${row.leaveType} Leave` : STATUS_LABELS[row.status]}
                      </span>
                      {row.status === 'present' && row.workType !== 'Office' && (
                        <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>📍 {row.workType}</span>
                      )}
                    </div>
                    {row.status === 'present' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          🕐 {row.clockIn || '—'} → {row.clockOut || 'Still Working'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-success)' }}>
                          ⏱ {Math.floor(row.workMins / 60)}h {row.workMins % 60}m worked
                        </span>
                      </div>
                    )}
                    {/* Work progress bar */}
                    {row.status === 'present' && (
                      <div style={{ height: 5, background: 'var(--bg-sunken)', borderRadius: 99, overflow: 'hidden', maxWidth: 320 }}>
                        <div style={{
                          height: '100%',
                          width: `${row.barPct}%`,
                          background: row.barPct >= 80 ? 'var(--status-success)' : row.barPct >= 50 ? 'var(--brand)' : '#f59e0b',
                          borderRadius: 99,
                          transition: 'width 600ms ease',
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Hours badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {row.status === 'present' ? (
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-success)' }}>
                        {Math.floor(row.workMins / 60)}<span style={{ fontSize: 12, fontWeight: 600 }}>h</span>
                        {row.workMins % 60}<span style={{ fontSize: 12, fontWeight: 600 }}>m</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: STATUS_COLORS[row.status], fontWeight: 600 }}>—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={isManagement ? 'Attendance Log & Office Timeline' : 'My Attendance Log & Reports'}
        subtitle={isManagement ? 'Overview of all employee activity, attendance logs, and expense audits' : 'Comprehensive attendance calendar, detailed tabular logs, and expense audits'}
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

              {isManagement && (
                <>
                  <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Employee:</span>
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
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isManagement && (
                <Button variant="secondary" onClick={handleExportAllData} style={{ padding: '6px 16px', fontSize: 12 }}>
                  📥 Export Spreadsheet (Excel)
                </Button>
              )}
              <Button onClick={() => setSubmitDrawerOpen(true)} style={{ padding: '6px 16px', fontSize: 12 }}>
                📋 Submit Attendance
              </Button>
            </div>
          </div>
        </Card>

        <Tabs items={tabs} />
      </div>

      <Drawer open={submitDrawerOpen} onClose={() => setSubmitDrawerOpen(false)} title="Submit Attendance Request">
        <Form
          initial={{
            date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            classification: 'Office',
            location: batches.length > 0 ? batches[0].code : '',
            organisationsVisited: '',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={async (values) => {
            const locText = values.classification === 'Training' 
              ? values.location 
              : values.classification === 'Marketing' 
              ? `Marketing: ${values.organisationsVisited}` 
              : 'Office Work';
            
            try {
              const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
              await attService.requestCorrection(
                String(Date.now()),
                'attendance_claim',
                `${values.date} (${values.startTime} - ${values.endTime})`,
                `Classification: ${values.classification}, Location: ${locText}. ${values.notes || ''}`,
                { id: user?.id || 'emp-user', role: user?.role || 'Employee' }
              );
            } catch (e) {
              console.warn('Attendance correction request notice:', e);
            }

            toast({
              variant: 'success',
              title: 'Attendance Request Submitted',
              message: `Attendance claim for ${values.date} (${values.startTime} - ${values.endTime}) sent to Approvals Queue for review.`,
            });
            setSubmitDrawerOpen(false);
          }}
        >
          <TextField name="date" label="Attendance Date" placeholder="YYYY-MM-DD" />
          <SelectField
            name="classification"
            label="Attendance Type"
            options={[
              { value: 'Office', label: 'Office Work' },
              { value: 'Training', label: 'Training Batch Session' },
              { value: 'Marketing', label: 'Marketing Visit' },
            ]}
          />
          <ConditionalAttendanceFields />
          <TextField name="startTime" label="Start Time" placeholder="08:30 AM" />
          <TextField name="endTime" label="End Time" placeholder="05:00 PM" />
          <TextField name="notes" label="Reason / Notes (Optional)" placeholder="Emergency, system delay, or missed clock-in..." />
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
