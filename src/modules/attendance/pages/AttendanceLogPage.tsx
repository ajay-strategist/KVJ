import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';
import { Tabs } from '../../../shared/ui/Tabs';
import { AttendanceCalendarView, type CalendarDayDetail } from '../components/AttendanceCalendarView';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TimePickerField, useForm } from '../../../shared/forms/form';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { ATTENDANCE_REPOSITORY_TOKEN, type AttendanceRecord, type WorkSessionType } from '../attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN, type ExpenseClaim } from '../../finance/finance.repository';
import { LEAVE_REPOSITORY_TOKEN } from '../../leave/leave.repository';
import { TASK_REPOSITORY_TOKEN, PROJECT_REPOSITORY_TOKEN } from '../../project/project.repository';
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
  const cleaned = cleanBatchCode(b.code, b.batchNo);
  if (cleaned) return cleaned;
  const parts = [b.college, b.program, b.academicYear, b.batchNo].filter(Boolean);
  if (parts.length) return parts.join(' - ');
  return b.trainingName || 'Training Batch';
}

function safeFormatTime(raw?: string): string {
  if (!raw) return '—';
  const str = String(raw).trim();
  if (!str || str === '—') return '—';

  if (str.includes('T')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    } catch (e) { void e; }
  }

  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm) {
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  } catch (e) { void e; }

  return '—';
}

function formatCleanNote(rawNote?: string, workType?: string): string {
  if (!rawNote) return '—';
  const str = rawNote.trim();
  if (!str) return '—';

  const lower = str.toLowerCase();

  if (
    lower.includes('classification: office') ||
    lower.includes('location: office work') ||
    lower.startsWith('on leave') ||
    lower.startsWith('weekend') ||
    lower.startsWith('declared holiday') ||
    lower === 'holiday' ||
    lower === 're-approved session' ||
    lower === 'not clocked'
  ) {
    return '—';
  }

  const isMarketing = (workType || '').toLowerCase().includes('marketing') || lower.includes('marketing');

  if (isMarketing) {
    let clean = str;
    const locMatch = str.match(/Location:\s*(?:Marketing:\s*)?([^\n]+)/i);
    if (locMatch && locMatch[1].trim()) {
      clean = locMatch[1].trim();
    } else {
      clean = clean
        .replace(/^Classification:\s*Marketing,?\s*/i, '')
        .replace(/^Location:\s*/i, '')
        .replace(/^Marketing:\s*/i, '')
        .trim();
    }
    return clean || '—';
  }

  return '—';
}

export interface AttendanceSessionItem {
  id?: string;
  start: string;
  end: string;
  duration: string;
  org: string;
  location: string;
  type: string;
  mode: string;
  isTraining?: boolean;
  notes?: string;
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
  sessions?: AttendanceSessionItem[];
}

function ConditionalAttendanceFields() {
  const { values } = useForm();
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedBatchIds, setAssignedBatchIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    async function fetchAssigned() {
      if (!values.date || !user?.id) return;
      try {
        const { data } = await supabase
          .from('schedule_sessions')
          .select('batch_id')
          .eq('date', values.date);
        if (data) {
          setAssignedBatchIds(new Set(data.map((s: any) => s.batch_id).filter(Boolean)));
        }
      } catch (e) { void e; }
    }
    fetchAssigned();
  }, [values.date, user?.id]);

  if (values.classification === 'Training') {
    // 1. Exclude completed batches
    let filtered = batches.filter((b) => b.phase !== 'Completed');

    // 2. Sort: Position assigned training batches at the top
    filtered = [...filtered].sort((a, b) => {
      const aAssigned = assignedBatchIds.has(a.id) || assignedBatchIds.has(a.code);
      const bAssigned = assignedBatchIds.has(b.id) || assignedBatchIds.has(b.code);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return 0;
    });

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        (b.code || '').toLowerCase().includes(q) || 
        batchDisplayName(b).toLowerCase().includes(q)
      );
    }

    const options = filtered.length > 0
      ? filtered.map((b) => ({ value: b.code, label: batchDisplayName(b) }))
      : [{ value: '', label: 'No matches found' }];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Search Training Batch</label>
          <input
            type="text"
            className="kvj-input"
            placeholder="Type batch name or code to filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
          />
        </div>
        <SelectField
          name="location"
          label="Select Training Batch"
          options={options}
        />
      </div>
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

interface SplitSessionInput {
  id: string;
  classification: string;
  location: string;
  organisationsVisited: string;
  startTime: string;
  endTime: string;
  notes: string;
}

function SubmitAttendanceDrawerForm({ onClose, currentEmployee, user, toast }: {
  onClose: () => void;
  currentEmployee: any;
  user: any;
  toast: any;
}) {
  const [date, setDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });
  const [sessions, setSessions] = useState<SplitSessionInput[]>([
    {
      id: 'sess-1',
      classification: 'Training',
      location: '',
      organisationsVisited: '',
      startTime: '08:35 AM',
      endTime: '10:35 AM',
      notes: '',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        id: `sess-${Date.now()}-${prev.length + 1}`,
        classification: 'Office',
        location: '',
        organisationsVisited: '',
        startTime: '11:00 AM',
        endTime: '02:30 PM',
        notes: '',
      },
    ]);
  };

  const removeSession = (id: string) => {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSession = (id: string, patch: Partial<SplitSessionInput>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const targetEmpId = currentEmployee?.id || user?.id || '';
      let recordId = String(Date.now());

      try {
        const { data } = await supabase
          .from('flwdsk_attendance')
          .select('id')
          .eq('employee_id', targetEmpId)
          .eq('work_date', date)
          .limit(1);
        if (data && data[0]) {
          recordId = data[0].id;
        }
      } catch (err) {
        console.warn('Could not find existing attendance record id:', err);
      }

      // Format multi-session payload for the approval parser
      const sessionParts = sessions.map((s) => {
        let locText = 'Office Work';
        if (s.classification === 'Training') {
          const bObj = batches.find((b) => b.code === s.location || b.id === s.location);
          locText = bObj ? batchDisplayName(bObj) : s.location || 'Training Session';
        } else if (s.classification === 'Marketing') {
          locText = s.organisationsVisited || 'Marketing Visit';
        } else if (s.classification === 'Work From Home') {
          locText = 'Remote / WFH';
        }

        const tag = `[${s.classification}: ${locText}${s.notes ? ` - ${s.notes}` : ''}]`;
        return `${s.startTime} - ${s.endTime} ${tag}`;
      });

      const proposedVal = `${date} (${sessionParts.join(', ')})`;
      const reasonVal = `Split Session Claim (${sessions.length} sessions). Date: ${date}`;

      const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
      await attService.requestCorrection(
        recordId,
        'attendance_claim',
        proposedVal,
        reasonVal,
        { id: targetEmpId, role: 'Employee' }
      );

      toast({
        variant: 'success',
        title: 'Attendance Claim Submitted',
        message: `Split-session claim (${sessions.length} session(s)) for ${date} sent to Approvals Queue for review.`,
      });
      onClose();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Submission Failed', message: err.message || 'Could not submit claim.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
          Attendance Date <span style={{ color: 'var(--status-danger)' }}>*</span>
        </label>
        <input
          type="date"
          required
          className="kvj-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
            Work Sessions ({sessions.length})
          </span>
          <button
            type="button"
            onClick={addSession}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--brand)',
              background: 'var(--brand-muted)',
              color: 'var(--brand)',
              cursor: 'pointer',
            }}
          >
            + Add Split Session
          </button>
        </div>

        {sessions.map((sess, idx) => (
          <div
            key={sess.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              background: 'var(--bg-sunken)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>
                Session #{idx + 1}
              </span>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSession(sess.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-danger)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕ Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Start Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08:35 AM"
                  className="kvj-input"
                  value={sess.startTime}
                  onChange={(e) => updateSession(sess.id, { startTime: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>End Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10:35 AM"
                  className="kvj-input"
                  value={sess.endTime}
                  onChange={(e) => updateSession(sess.id, { endTime: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Session Type</label>
              <select
                className="kvj-select"
                value={sess.classification}
                onChange={(e) => updateSession(sess.id, { classification: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="Training">Training Batch Session</option>
                <option value="Office">Office Work</option>
                <option value="Work From Home">Work From Home / Remote</option>
                <option value="Marketing">Marketing Visit</option>
              </select>
            </div>

            {sess.classification === 'Training' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Training Batch</label>
                <select
                  className="kvj-select"
                  value={sess.location}
                  onChange={(e) => updateSession(sess.id, { location: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">Select Training Batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.code}>
                      {batchDisplayName(b)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sess.classification === 'Marketing' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Organisations Visited</label>
                <input
                  type="text"
                  placeholder="e.g. Christ College"
                  className="kvj-input"
                  value={sess.organisationsVisited}
                  onChange={(e) => updateSession(sess.id, { organisationsVisited: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes / Reason</label>
              <input
                type="text"
                placeholder="Optional notes..."
                className="kvj-input"
                value={sess.notes}
                onChange={(e) => updateSession(sess.id, { notes: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--brand)',
            color: '#fff',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Submitting...' : 'Submit Claim'}
        </button>
      </div>
    </form>
  );
}

export function AttendanceLogPage() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });

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
  const [leaveRecords, setLeaveRecords] = useState<Array<{ employeeId: string; startDate: string; endDate: string; leaveType: string; status: string; halfDay?: boolean; halfDayShift?: string }>>([]);
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
          const allRes = await attendanceRepo.findMany({ pageSize: 1000 });
          const rawRecords = Array.isArray(allRes?.data) ? allRes.data : Array.isArray(allRes) ? allRes : [];
          records = rawRecords.filter((r: any) => r && r.workDate && r.workDate >= range.from && r.workDate <= range.to);
          const allClaims = await expenseRepo.findMany({ pageSize: 1000 });
          const rawClaims = Array.isArray(allClaims?.data) ? allClaims.data : Array.isArray(allClaims) ? allClaims : [];
          claims = rawClaims.filter((c: any) => c && !c.deletedAt && (c.createdAt || '').slice(0, 10) >= range.from && (c.createdAt || '').slice(0, 10) <= range.to);
        } else {
          const empId = currentEmployee?.id || user?.id;
          if (empId) {
            const rawHist = await attendanceRepo.findHistory(empId, range);
            records = Array.isArray(rawHist) ? rawHist : [];
            const allClaims = await expenseRepo.findMany({ pageSize: 1000 });
            const rawClaims = Array.isArray(allClaims?.data) ? allClaims.data : Array.isArray(allClaims) ? allClaims : [];
            claims = rawClaims.filter((c: any) => c && !c.deletedAt && c.employeeId === empId && (c.createdAt || '').slice(0, 10) >= range.from && (c.createdAt || '').slice(0, 10) <= range.to);
          }
        }
        setAttendanceRecords(Array.isArray(records) ? records : []);
        setExpenseClaims(Array.isArray(claims) ? claims : []);

        const { data: hData } = await supabase
          .from('flwdsk_declared_holidays')
          .select('*')
          .is('deleted_at', null);
        if (hData) {
          setDeclaredHolidays(hData.map((h: any) => ({ date: h.date || h.holiday_date, name: h.title || h.name || 'Company Holiday' })));
        }

        const { data: lData } = await supabase
          .from('flwdsk_leave_records')
          .select('*')
          .is('deleted_at', null);
        if (lData) {
          setLeaveRecords(
            lData.map((l: any) => ({
              employeeId: l.employee_id || l.employeeId || '',
              startDate: (l.start_date || l.startDate || '').slice(0, 10),
              endDate: (l.end_date || l.endDate || '').slice(0, 10),
              leaveType: l.leave_type || l.leaveType || 'Leave',
              status: l.status || 'approved',
              halfDay: !!(l.half_day || l.halfDay),
              halfDayShift: l.half_day_shift || l.halfDayShift,
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
        const allRes = await attendanceRepo.findMany({ pageSize: 1000 });
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
        // Soft-delete (keep the financial audit trail), matching the Expense
        // Claims screen. Hard DELETE would erase the record permanently.
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
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
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
          .eq('id', id);
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
      toast({ variant: 'info', title: 'Exporting Data', message: 'Generating Excel workbook with all 5 sheets, please wait...' });

      const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
      const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      const leaveRepo = container.resolve(LEAVE_REPOSITORY_TOKEN);
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);
      const projRepo = container.resolve(PROJECT_REPOSITORY_TOKEN);

      const [attRes, expRes, leaveRes, taskRes, projRes] = await Promise.all([
        attRepo.findMany({ pageSize: 2000 }),
        expRepo.findMany({ pageSize: 2000 }),
        leaveRepo.findMany({ pageSize: 2000 }),
        taskRepo.findMany({ pageSize: 2000 }),
        projRepo.findMany({ pageSize: 2000 }),
      ]);

      const attList = attRes?.data || [];
      const expList = expRes?.data || [];
      const leaveList = leaveRes?.data || [];
      const taskList = taskRes?.data || [];
      const projects = projRes?.data || [];
      const empList = employees || [];

      const buildSheet = (sheetName: string, headers: string[], rows: any[][]) => {
        let sheetXml = `  <Worksheet ss:Name="${escapeXml(sheetName)}">\n    <Table>\n      <Row>\n`;
        headers.forEach((h) => {
          sheetXml += `        <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
        });
        sheetXml += `      </Row>\n`;

        rows.forEach((r) => {
          sheetXml += `      <Row>\n`;
          r.forEach((v) => {
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

      const parseExpNote = (rawNotes?: string) => {
        let person = '';
        let type = 'Misc';
        let batchRoute = 'General / Office';
        let uNotes = rawNotes || '';

        if (rawNotes && rawNotes.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(rawNotes);
            person = parsed.personName || '';
            type = parsed.expenseType || 'Misc';
            batchRoute = parsed.batchRoute || parsed.location || 'General / Office';
            uNotes = parsed.userNotes || '';
          } catch (e) { void e; }
        }
        return { person, type, batchRoute, uNotes };
      };

      // ==========================================
      // SHEET 1: Summary Sheet (with Horizontal Accumulated Columns)
      // ==========================================
      const summaryHeaders = [
        'Employee Name',
        'Days in the Month',
        'No. of Leaves',
        'Working Days',
        'Holiday Worked',
        'Late',
        'Early',
        'Total Hours Worked',
        'Total Break',
        'Expenses',
        'Accumulated Days',
        'Accumulated Hours',
        'Accumulated Leaves',
        'Accumulated Expenses',
      ];

      const sumDaysCount = 23;
      let totalSumLeaves = 0;
      let totalSumWorkDays = 0;
      let totalSumHolWorked = 0;
      let totalSumLate = 0;
      let totalSumEarly = 0;
      let totalSumWorkMins = 0;
      let totalSumBreakMins = 0;
      let totalSumExpenses = 0;

      const summaryRows: any[][] = empList.map((emp) => {
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
        const empId = emp.id;

        const empRecords = attList.filter((a: any) => a && a.employeeId === empId);
        const empLeaves = leaveList.filter(
          (l: any) => l && l.employeeId === empId && l.status === 'approved'
        );
        const empExpenses = expList.filter(
          (e: any) => e && e.employeeId === empId && e.status !== 'rejected'
        );

        const leavesCount = empLeaves.reduce((acc: number, l: any) => {
          if (!l.startDate || !l.endDate) return acc + 1;
          const s = new Date(l.startDate).getTime();
          const e = new Date(l.endDate).getTime();
          const diff = Math.max(1, Math.round((e - s) / 86400000) + 1);
          return acc + diff;
        }, 0);

        let workDays = 0;
        let holWorked = 0;
        let lateCount = 0;
        let earlyCount = 0;
        let workMins = 0;
        let breakMins = 0;

        empRecords.forEach((r: any) => {
          if (r.firstClockIn) {
            workDays++;
            const dayOfWeek = new Date(r.workDate).getDay();
            if (dayOfWeek === 0 || r.workType === 'Holiday') {
              holWorked++;
            }

            const cInT = safeFormatTime(r.firstClockIn);
            if (cInT !== '—' && cInT >= '09:31' && (r.workType === 'Office' || !r.workType)) {
              lateCount++;
            }

            if (r.lastClockOut) {
              const cOutT = safeFormatTime(r.lastClockOut);
              if (cOutT !== '—' && cOutT < '17:30' && (r.workType === 'Office' || !r.workType)) {
                earlyCount++;
              }
            }

            workMins += r.totalWorkingMinutes || 0;
            breakMins += r.totalBreakMinutes || 0;
          }
        });

        const expSum = empExpenses.reduce((acc: number, ex: any) => acc + (ex.amount || 0), 0);

        totalSumLeaves += leavesCount;
        totalSumWorkDays += workDays;
        totalSumHolWorked += holWorked;
        totalSumLate += lateCount;
        totalSumEarly += earlyCount;
        totalSumWorkMins += workMins;
        totalSumBreakMins += breakMins;
        totalSumExpenses += expSum;

        // Accumulated totals for this employee
        const accumDays = workDays;
        const accumHoursStr = `${Math.floor(workMins / 60)}h ${workMins % 60}m`;
        const accumLeaves = leavesCount;
        const accumExpStr = `₹ ${expSum.toFixed(2)}`;

        return [
          empName,
          sumDaysCount,
          leavesCount,
          workDays,
          holWorked,
          lateCount,
          earlyCount,
          `${Math.floor(workMins / 60)}h ${workMins % 60}m`,
          `${Math.floor(breakMins / 60)}h ${breakMins % 60}m`,
          `₹ ${expSum.toFixed(2)}`,
          accumDays,
          accumHoursStr,
          accumLeaves,
          accumExpStr,
        ];
      });

      summaryRows.push([
        'Accumulated Total',
        '—',
        totalSumLeaves,
        totalSumWorkDays,
        totalSumHolWorked,
        totalSumLate,
        totalSumEarly,
        `${Math.floor(totalSumWorkMins / 60)}h ${totalSumWorkMins % 60}m`,
        `${Math.floor(totalSumBreakMins / 60)}h ${totalSumBreakMins % 60}m`,
        `₹ ${totalSumExpenses.toFixed(2)}`,
        totalSumWorkDays,
        `${Math.floor(totalSumWorkMins / 60)}h ${totalSumWorkMins % 60}m`,
        totalSumLeaves,
        `₹ ${totalSumExpenses.toFixed(2)}`,
      ]);

      // ==========================================
      // SHEET 2: Attendance Details Log Sheet
      // ==========================================
      const attDetailsHeaders = [
        'Date',
        'Name',
        'Holiday',
        'Organisation',
        'Location',
        'Class/Work',
        'Mode',
        'Start Time',
        'End Time',
        'Duration',
        'Note',
        'Break',
        'Expenses',
      ];

      const sortedLogRows = [...tableRows].sort((a, b) => {
        const dA = a.date.split('-').reverse().join('-');
        const dB = b.date.split('-').reverse().join('-');
        if (dA !== dB) return dA.localeCompare(dB);
        return a.name.localeCompare(b.name);
      });

      const attDetailsRows = sortedLogRows.map((r) => [
        r.date,
        r.name,
        r.holiday || '—',
        r.org,
        r.location,
        r.type,
        r.mode,
        r.start,
        r.end,
        r.duration,
        r.note,
        r.break,
        r.expenses,
      ]);

      // Helper to resolve expense batch name dynamically from attendance date
      const resolveExpenseBatch = (ex: any) => {
        const { batchRoute } = parseExpNote(ex.notes);
        if (batchRoute && batchRoute !== 'General / Office') return batchRoute;

        const dateStr = (ex.createdAt || '').slice(0, 10);
        const attRec = attList.find((a: any) => a && a.employeeId === ex.employeeId && a.workDate === dateStr);
        if (attRec) {
          const firstSess = attRec.sessions?.[0] as any;
          const workType = firstSess?.workType || 'Office';
          const batchId = firstSess?.batchId || firstSess?.batch_id || (attRec as any).batchId || (attRec as any).batch_id;
          const resolvedBatch = resolveOrgValue(workType, firstSess?.notes, (attRec as any).notes, batchId);
          if (resolvedBatch && resolvedBatch !== 'Office' && resolvedBatch !== 'KVJ Analytics') {
            return resolvedBatch;
          }
        }
        return 'General / Office';
      };

      // Collect unique batch names for Expense Summary matrix
      const allBatchNamesSet = new Set<string>();
      expList.forEach((ex: any) => {
        const bName = resolveExpenseBatch(ex);
        if (bName) allBatchNamesSet.add(bName);
      });
      const batchNameList = Array.from(allBatchNamesSet);
      if (batchNameList.length === 0) batchNameList.push('General / Office');

      // ==========================================
      // SHEET 3: Expense Summary Sheet (Matrix Pivot Layout)
      // ==========================================
      const expSummaryHeaders = ['Employee Name', 'Total Amount', ...batchNameList];
      const expEmpMap: Record<string, { empName: string; total: number; batchTotals: Record<string, number> }> = {};

      empList.forEach((emp) => {
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
        expEmpMap[emp.id] = { empName, total: 0, batchTotals: {} };
      });

      expList.forEach((ex: any) => {
        const empId = ex.employeeId;
        const bName = resolveExpenseBatch(ex);
        const amt = ex.amount || 0;

        if (expEmpMap[empId]) {
          expEmpMap[empId].total += amt;
          expEmpMap[empId].batchTotals[bName] = (expEmpMap[empId].batchTotals[bName] || 0) + amt;
        }
      });

      const expSummaryRows = Object.values(expEmpMap).map((item) => {
        const row: any[] = [item.empName, Number(item.total.toFixed(2))];
        batchNameList.forEach((bName) => {
          const bAmt = item.batchTotals[bName] || 0;
          row.push(bAmt > 0 ? Number(bAmt.toFixed(2)) : '₹ -');
        });
        return row;
      });

      // ==========================================
      // SHEET 4: Expense Details Sheet
      // ==========================================
      const expDetailsHeaders = ['Date', 'Employee', 'Classification', 'Expense Type', 'Batch Name', 'Amount'];
      const expDetailsRows = expList.map((ex: any) => {
        const emp = empList.find((e) => e.id === ex.employeeId);
        const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Employee';
        const { type } = parseExpNote(ex.notes);
        const bName = resolveExpenseBatch(ex);
        const dateFormatted = (ex.createdAt || '').slice(0, 10).split('-').reverse().join('-');

        return [
          dateFormatted || '—',
          empName,
          ex.category || 'Office Expense',
          type,
          bName,
          Number((ex.amount || 0).toFixed(2)),
        ];
      });

      // ==========================================
      // SHEET 5: Batch Wise Expense Sheet
      // ==========================================
      const allExpenseTypesSet = new Set<string>();
      expList.forEach((ex: any) => {
        const { type } = parseExpNote(ex.notes);
        if (type) allExpenseTypesSet.add(type);
      });
      const expenseTypeList = Array.from(allExpenseTypesSet);
      if (expenseTypeList.length === 0) expenseTypeList.push('Misc');

      const batchWiseHeaders = ['Batch Name', 'Total Amount', ...expenseTypeList];
      const batchWiseMap: Record<string, { total: number; typeTotals: Record<string, number> }> = {};

      expList.forEach((ex: any) => {
        const { type } = parseExpNote(ex.notes);
        const batchName = resolveExpenseBatch(ex);

        if (!batchWiseMap[batchName]) {
          batchWiseMap[batchName] = { total: 0, typeTotals: {} };
        }
        batchWiseMap[batchName].total += ex.amount || 0;
        batchWiseMap[batchName].typeTotals[type] = (batchWiseMap[batchName].typeTotals[type] || 0) + (ex.amount || 0);
      });

      let grandBatchTotal = 0;
      const grandTypeTotals: Record<string, number> = {};

      const batchWiseRows = Object.entries(batchWiseMap).map(([batchName, info]) => {
        grandBatchTotal += info.total;
        const row: any[] = [batchName, Number(info.total.toFixed(2))];
        expenseTypeList.forEach((t) => {
          const amt = info.typeTotals[t] || 0;
          grandTypeTotals[t] = (grandTypeTotals[t] || 0) + amt;
          row.push(Number(amt.toFixed(2)));
        });
        return row;
      });

      const batchWiseTotalRow: any[] = [
        'Total Summary',
        Number(grandBatchTotal.toFixed(2)),
        ...expenseTypeList.map((t) => Number((grandTypeTotals[t] || 0).toFixed(2))),
      ];
      batchWiseRows.push(batchWiseTotalRow);

      // ==========================================
      // SHEET 6: Task Summary Sheet (No UUID Hashes)
      // ==========================================
      const taskSummaryHeaders = [
        'Task Title',
        'Project Name',
        'Assigned Person',
        'Supervisor',
        'Due Date',
        'Total Hours Worked',
        'Office/Remote',
        'Status',
        'Priority',
      ];

      const taskSummaryRows = taskList.map((t: any) => {
        const proj = (projects || []).find((p: any) => p.id === t.projectId);
        const assignee = empList.find((e) => e.id === t.assigneeId);
        const supervisor = empList.find((e) => e.id === t.supervisorId || e.id === t.assignedByEmployeeId);

        const projName = proj ? proj.title : 'Office Task';
        const assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
        const supervisorName = supervisor ? `${supervisor.firstName || ''} ${supervisor.lastName || ''}`.trim() : 'Admin';
        const dueDateFmt = t.dueDate ? t.dueDate.split('-').reverse().join('-') : '—';
        const hrsWorkedStr = `${(t.actualHours || t.proposedHours || 0).toFixed(1)} hrs`;

        return [
          t.title || 'Untitled Task',
          projName,
          assigneeName,
          supervisorName,
          dueDateFmt,
          hrsWorkedStr,
          t.projectId ? 'Project Task' : 'Office Task',
          t.status || 'todo',
          t.priority || 'medium',
        ];
      });

      // ==========================================
      // SHEET 7: Task Worklog Sheet
      // ==========================================
      const taskWorklogHeaders = [
        'Date',
        'Task Title',
        'Project Name',
        'Assigned Person',
        'Supervisor',
        'Work Progress / Update',
        'Start Time',
        'End Time',
        'Duration',
        'Office/Remote',
      ];

      const taskWorklogRows: any[][] = [];
      taskList.forEach((t: any) => {
        const proj = (projects || []).find((p: any) => p.id === t.projectId);
        const assignee = empList.find((e) => e.id === t.assigneeId);
        const supervisor = empList.find((e) => e.id === t.supervisorId || e.id === t.assignedByEmployeeId);

        const projName = proj ? proj.title : 'Office Task';
        const assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
        const supervisorName = supervisor ? `${supervisor.firstName || ''} ${supervisor.lastName || ''}`.trim() : 'Admin';
        const workNote = t.description || t.notes || 'Work progress entry';
        const dateFmt = t.startDate ? t.startDate.split('-').reverse().join('-') : '—';

        taskWorklogRows.push([
          dateFmt,
          t.title || 'Untitled Task',
          projName,
          assigneeName,
          supervisorName,
          workNote,
          '09:30 AM',
          '05:30 PM',
          `${(t.actualHours || t.proposedHours || 1).toFixed(1)} hrs`,
          t.projectId ? 'Project Task' : 'Office Task',
        ]);
      });

      // Reference sheets
      const empHeaders = ['ID', 'Employee ID', 'First Name', 'Last Name', 'Email', 'Designation', 'Joining Date'];
      const empRows = empList.map((e) => [
        e.id,
        e.employeeId,
        e.firstName,
        e.lastName,
        e.email,
        e.designation,
        e.dateOfJoining,
      ]);

      const leaveHeaders = ['Record ID', 'Employee ID', 'Leave Type', 'Start Date', 'End Date', 'Half Day', 'Status', 'Reason'];
      const leaveRows = leaveList.map((l: any) => [
        l.id,
        l.employeeId,
        l.leaveType,
        l.startDate,
        l.endDate,
        l.halfDay ? 'Yes' : 'No',
        l.status,
        l.reason,
      ]);

      let xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
      xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
      xml += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
      xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      xml += ` xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

      xml += buildSheet('Summary', summaryHeaders, summaryRows);
      xml += buildSheet('Attendance Details Log', attDetailsHeaders, attDetailsRows);
      xml += buildSheet('Expense Summary', expSummaryHeaders, expSummaryRows);
      xml += buildSheet('Expense Details', expDetailsHeaders, expDetailsRows);
      xml += buildSheet('Batch Wise Expense', batchWiseHeaders, batchWiseRows);
      xml += buildSheet('Task Summary', taskSummaryHeaders, taskSummaryRows);
      xml += buildSheet('Task Worklog', taskWorklogHeaders, taskWorklogRows);
      xml += buildSheet('Employees', empHeaders, empRows);
      xml += buildSheet('Leaves', leaveHeaders, leaveRows);

      xml += `</Workbook>\n`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KVJ_Analytics_Master_Report_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Export Complete', message: 'Master Excel workbook downloaded with all custom sheets.' });
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
    let extractedLoc: string | null = null;

    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
    const locMatch = rawNotes.match(/Location:\s*([^\n,]+)/i);
    if (locMatch && locMatch[1].trim()) {
      const parsedLoc = locMatch[1].trim().replace(/\.$/, '').trim();
      if (parsedLoc.toLowerCase() !== 'office work' && parsedLoc.toLowerCase() !== 'office') {
        extractedLoc = parsedLoc;
      }
    }

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

    // 3. Match extracted Location string ONLY IF IT IS AN EXACT MATCH for batch code or full display name
    if (!foundBatch && extractedLoc) {
      const lowerLoc = extractedLoc.toLowerCase();
      foundBatch = safeBatches.find((b) => {
        if (!b) return false;
        const disp = batchDisplayName(b).toLowerCase();
        if (disp === lowerLoc) return true;
        if (b.code && b.code.toLowerCase() === lowerLoc) return true;
        return false;
      });
    }

    return { foundBatch, extractedLoc, isTraining };
  }, [batches]);

  const resolveOrgValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string): string => {
    const wt = (workType || '').toLowerCase().trim();
    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
    const lowerNotes = rawNotes.toLowerCase();

    if (wt.includes('marketing') || lowerNotes.includes('classification: marketing')) {
      return 'Marketing';
    }
    if (wt === 'work from home' || wt === 'remote' || wt === 'wfh' || wt.includes('remote') || wt.includes('wfh') || wt.includes('work from home') || lowerNotes.includes('remote') || lowerNotes.includes('wfh') || lowerNotes.includes('work from home')) {
      return 'Remote';
    }

    const { foundBatch, extractedLoc, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (foundBatch) {
      return batchDisplayName(foundBatch);
    }
    if (extractedLoc) {
      return extractedLoc;
    }
    return isTraining ? 'Training Batch' : (wt === 'office' || !wt ? 'KVJ Analytics' : (workType || '—'));
  }, [resolveBatchHelper]);

  const resolveLocationValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string): string => {
    const wt = (workType || '').toLowerCase().trim();
    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
    const lowerNotes = rawNotes.toLowerCase();

    if (wt === 'work from home' || wt === 'remote' || wt === 'wfh' || wt.includes('remote') || wt.includes('wfh') || wt.includes('work from home') || lowerNotes.includes('remote') || lowerNotes.includes('wfh') || lowerNotes.includes('work from home')) {
      return 'Remote';
    }

    const { foundBatch, extractedLoc, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (foundBatch) {
      return foundBatch.venue || foundBatch.college || 'Offline';
    }
    if (extractedLoc) {
      return 'Offline';
    }
    return isTraining ? 'Offline' : (wt === 'office' || !wt ? 'Office' : workType || '—');
  }, [resolveBatchHelper]);

  const resolveClassOrWorkValue = useCallback((workType?: string, sessionNotes?: string, recordNotes?: string, recordBatchId?: string) => {
    const wt = (workType || '').toLowerCase().trim();
    const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
    const lowerNotes = rawNotes.toLowerCase();

    const { foundBatch, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId);
    if (isTraining) {
      return { value: 'Class', isTraining: true };
    }
    if (wt === 'work from home' || wt === 'remote' || wt === 'wfh' || wt.includes('remote') || wt.includes('wfh') || wt.includes('work from home') || lowerNotes.includes('remote') || lowerNotes.includes('wfh') || lowerNotes.includes('work from home')) {
      return { value: 'Work From Home', isTraining: false };
    }
    const origWt = workType || 'Office';
    const cleanWt = origWt.startsWith('Training:') ? origWt.substring(9).trim() : origWt;
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
        l.status === 'approved'
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

        let totalMins = record.totalWorkingMinutes || 0;
        if (record.firstClockIn && record.lastClockOut) {
          const endTs = new Date(record.lastClockOut).getTime();
          const startTs = new Date(record.firstClockIn).getTime();
          if (!isNaN(endTs) && !isNaN(startTs) && endTs > startTs) {
            totalMins = Math.round((endTs - startTs) / 60000);
          }
        }
        const totalHrs = Math.floor(totalMins / 60);
        const remMins = totalMins % 60;

        const isHolType = workType === 'Holiday' || (record as any).notes?.toLowerCase().includes('holiday');
        const isLeaveType = (workType === 'Leave' || (record as any).notes?.toLowerCase().includes('leave') || !!activeLeave);

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
        l && l.employeeId === (record ? record.employeeId : empId) &&
        dateStr >= l.startDate && dateStr <= l.endDate &&
        l.status === 'approved'
      );

      const empName = currentEmployee
        ? `${currentEmployee.firstName || ''} ${currentEmployee.lastName || ''}`.trim()
        : user ? user.fullName || 'Employee' : 'Employee';

      if (record) {
        const emp = empList.find(e => e && e.id === record.employeeId);
        const resolvedEmpName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : empName;
        
        let breakMins = 0;
        if (record.breaks && record.breaks.length > 0) {
          breakMins = record.breaks.reduce((sum, b) => {
            if (b.startTime && b.endTime) {
              const diff = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
              return sum + (diff > 0 ? Math.round(diff / 60000) : 0);
            }
            return sum;
          }, 0);
        } else {
          breakMins = record.totalBreakMinutes || 0;
        }

        if (record.firstClockIn) {
          const endTs = record.lastClockOut ? new Date(record.lastClockOut).getTime() : Date.now();
          const grossMins = Math.max(0, Math.round((endTs - new Date(record.firstClockIn).getTime()) / 60000));
          breakMins = Math.min(breakMins, grossMins);
        }

        const breakTime = `${Math.floor(breakMins / 60)}h ${breakMins % 60}m`;

        const rawSessionsList = record.sessions && record.sessions.length > 0
          ? record.sessions
          : [{
              id: record.id,
              workType: 'Office' as WorkSessionType,
              clockIn: record.firstClockIn || '',
              clockOut: record.lastClockOut || '',
              notes: (record as any).notes || '',
            }];

        // Filter out any session with no valid clockIn time ('—' or empty)
        const validSessions = rawSessionsList.filter(s => {
          const st = safeFormatTime(s.clockIn);
          return !!st && st !== '—';
        });

        // Deduplicate sessions with identical clockIn, clockOut, workType, and notes
        const uniqueSessions: any[] = [];
        const seenKeys = new Set<string>();
        for (const s of validSessions) {
          const key = `${safeFormatTime(s.clockIn)}_${safeFormatTime(s.clockOut)}_${s.workType || 'Office'}_${s.notes || ''}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueSessions.push(s);
          }
        }

        const isHoliday = (record as any).notes?.toLowerCase().includes('holiday') || !!decHoliday;
        const isLeave = !!activeLeave;
        const leaveModeLabel = activeLeave?.halfDay
          ? `On Leave (${activeLeave.halfDayShift || 'Half Day'})`
          : 'On Leave';

        if ((isLeave && uniqueSessions.length === 0) || isHoliday || uniqueSessions.length === 0) {
          const primarySession = rawSessionsList[0];
          const workType = primarySession?.workType || 'Office';
          const batchId = (primarySession as any)?.batchId || (primarySession as any)?.batch_id || (record as any)?.batchId || (record as any)?.batch_id;
          const orgVal = resolveOrgValue(workType, primarySession?.notes, (record as any).notes, batchId) || 'Office';
          const locVal = resolveLocationValue(workType, primarySession?.notes, (record as any).notes, batchId) || 'Office';
          const classOrWorkInfo = resolveClassOrWorkValue(workType, primarySession?.notes, (record as any).notes, batchId);

          let fallbackMins = 0;
          const cInTime = record.firstClockIn || primarySession?.clockIn;
          const cOutTime = record.lastClockOut || primarySession?.clockOut;
          if (cInTime) {
            const endMs = cOutTime ? new Date(cOutTime).getTime() : Date.now();
            const grossMs = Math.max(0, endMs - new Date(cInTime).getTime());
            fallbackMins = Math.max(0, Math.round(grossMs / 60000));
          }
          const fallbackDur = `${Math.floor(fallbackMins / 60)}h ${fallbackMins % 60}m`;

            const isPrimaryRemote = locVal === 'Remote' || orgVal === 'Remote';
            rows.push({
              date: dateStr.split('-').reverse().join('-'),
              name: resolvedEmpName,
              holiday: decHoliday ? (decHoliday as any).name : d.getDay() === 0 ? 'Sunday' : isHoliday ? 'Holiday' : '',
              org: isLeave ? '—' : orgVal,
              location: isLeave ? '—' : locVal,
              type: isHoliday ? 'Holiday' : isLeave ? 'Leave' : classOrWorkInfo.value,
              isTraining: isLeave ? false : classOrWorkInfo.isTraining,
              mode: isHoliday ? 'Holiday' : isLeave ? leaveModeLabel : (workType === 'Training' ? 'Training' : isPrimaryRemote ? 'Remote' : 'Offline'),
              start: isLeave ? '—' : safeFormatTime(record.firstClockIn || primarySession?.clockIn),
              end: isLeave ? '—' : safeFormatTime(record.lastClockOut || primarySession?.clockOut),
              duration: isLeave ? '0h 0m' : fallbackDur,
              expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '—',
              note: isLeave ? formatCleanNote((activeLeave as any)?.reason || 'On Leave', 'Leave') : formatCleanNote(primarySession?.notes || (record as any).notes, workType),
              break: isLeave ? '0h 0m' : breakTime,
              tasks: primarySession?.notes ? [primarySession.notes] : [],
            });
          } else {
            // EMIT SEPARATE ROW FOR EACH VALID SESSION
            uniqueSessions.forEach((s, idx) => {
              let sMins = 0;
              if (s.clockIn) {
                const t1 = new Date(s.clockIn).getTime();
                const t2 = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
                if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
                  const grossS = Math.round((t2 - t1) / (1000 * 60));
                  sMins = Math.max(0, grossS);
                }
              }
              const sDuration = `${Math.floor(sMins / 60)}h ${sMins % 60}m`;

              const sWorkType = s.workType || 'Office';
              const sBatchId = (s as any)?.batchId || (s as any)?.batch_id || (record as any)?.batchId || (record as any)?.batch_id;
              const sOrg = resolveOrgValue(sWorkType, s.notes, (record as any).notes, sBatchId) || 'Office';
              const sLoc = resolveLocationValue(sWorkType, s.notes, (record as any).notes, sBatchId) || 'Office';
              const sClass = resolveClassOrWorkValue(sWorkType, s.notes, (record as any).notes, sBatchId);
              const isSessionRemote = sLoc === 'Remote' || sOrg === 'Remote';

              rows.push({
                date: dateStr.split('-').reverse().join('-'),
                name: resolvedEmpName,
                holiday: decHoliday ? (decHoliday as any).name : d.getDay() === 0 ? 'Sunday' : '',
                org: sOrg,
                location: sLoc,
                type: sClass.value,
                isTraining: sClass.isTraining,
                mode: sWorkType === 'Training' ? 'Training' : (isSessionRemote ? 'Remote' : 'Offline'),
              start: safeFormatTime(s.clockIn),
              end: safeFormatTime(s.clockOut),
              duration: sDuration,
              expenses: idx === 0 && dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '—',
              note: formatCleanNote(s.notes || (record as any).notes, sWorkType),
              break: idx === 0 ? breakTime : '0h 0m',
              tasks: s.notes ? [s.notes] : [],
            });
          });
        }
      } else {
        const isSunday = d.getDay() === 0;
        const isHoliday = !!decHoliday || isSunday;
        const isLeave = !!activeLeave;

        rows.push({
          date: dateStr.split('-').reverse().join('-'),
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
          note: '—',
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
        } catch (e) { void e; }
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
        (l) => l.employeeId === empId && today >= l.startDate && today <= l.endDate && l.status === 'approved'
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
    leave: 'var(--status-warning)',
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
                        <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.name}</td>
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
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.start}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.end}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.duration}</td>
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
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {exp.vehicle} · {exp.km} km
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 500, color: 'var(--brand)' }}>{exp.batch || '—'}</div>
                          {exp.route && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🗺 {exp.route}</div>}
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
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>KM Auto-Calc</span>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--status-danger)', fontWeight: 600 }}>No Receipt</span>
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
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
            <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--brand)', color: 'white', borderRadius: 999, padding: '2px 10px' }}>{timelineRows.filter(r => r.status === 'present').length} Present</span>
            <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--status-warning)', color: 'white', borderRadius: 999, padding: '2px 10px' }}>{timelineRows.filter(r => r.status === 'leave').length} On Leave</span>
            <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--bg-sunken)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 10px', border: '1px solid var(--border)' }}>{timelineRows.filter(r => r.status === 'absent').length} Absent</span>
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
                        fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
                        background: `${STATUS_COLORS[row.status]}22`,
                        color: STATUS_COLORS[row.status],
                        border: `1px solid ${STATUS_COLORS[row.status]}55`,
                      }}>
                        {row.status === 'leave' && row.leaveType ? `🏖 On ${row.leaveType} Leave` : STATUS_LABELS[row.status]}
                      </span>
                      {row.status === 'present' && row.workType !== 'Office' && (
                        <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>📍 {row.workType}</span>
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
                          background: row.barPct >= 80 ? 'var(--status-success)' : row.barPct >= 50 ? 'var(--brand)' : 'var(--status-warning)',
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
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
        <SubmitAttendanceDrawerForm
          onClose={() => setSubmitDrawerOpen(false)}
          currentEmployee={currentEmployee}
          user={user}
          toast={toast}
        />
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
