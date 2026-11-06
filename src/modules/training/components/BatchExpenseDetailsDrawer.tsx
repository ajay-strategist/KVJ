/**
 * BatchExpenseDetailsDrawer (Current Screen Popup Modal)
 *
 * Displays financial analytics and workhour intelligence for a training batch:
 *  - 5 KPI Cards:
 *      1. Total Students (sourced directly from batch creation capacity/roster)
 *      2. Batch Workhours (actual training delivery duration with merged overlapping intervals)
 *      3. Total Expense (sum of valid batch expenses)
 *      4. Cost Per Student (Total Expense / Total Students, zero protected)
 *      5. Average Expense / Day (Total Expense / Unique Attendance Training Dates)
 *  - Expense Category Distribution: Single container with 2 side-by-side bar charts (Amounts & Percentages)
 *  - Trainer & Submitter Allocation with expandable detail drilldown
 *  - Daily Expense & Workhours Delivery Timeline (attendance-based, without cost-per-hour)
 *  - Work Hours Tab:
 *      - Overall Batch Man-hours
 *      - Batch Workhours
 *      - Employee-wise Work Hours Summary (Employee, Training Days, Work Hours)
 *      - Detailed Work Hours Log (Employee, Date, Clock-In, Clock-Out, Work Hours)
 *  - Detailed Filterable Expense Log with Search, Submitter Filters, and CSV Export
 */

import { useEffect, useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/integration/supabase';

import type { Batch } from '../training.repository';

// ── Types ──────────────────────────────────────────────────────────────────

interface RawExpenseClaim {
  id: string;
  amount: number;
  category: string;
  status: string;
  receipt_url?: string;
  created_at?: string;
  notes?: string;
  employee_id?: string;
}

export interface ExpenseRow {
  id: string;
  date: string;
  rawDate: string;
  expenseType: string;
  category: string;
  amount: number;
  submittedBy: string;
  status: 'submitted' | 'approved' | 'rejected' | string;
  receipt?: string;
  route?: string;
  vehicle?: string;
  km?: number;
}

export interface BatchWorkSession {
  id: string;
  employeeId?: string;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  clockIn: string;
  clockOut?: string | null;
  durationHours: number;
}

export interface TimeInterval {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

export interface BatchExpenseDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The batch name / code used to match against expense notes.batchName */
  batchName: string;
  /** Human-readable display label for the modal title */
  batchCode: string;
  /** Number of students in the batch (live count or capacity fallback) */
  studentCount: number;
  startDate?: string;
  endDate?: string;
  batch?: Batch | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function parseDateStr(val?: string | null): Date | null {
  if (!val || val === '—') return null;
  const ymd = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(val?: string | null): string {
  if (!val) return '—';
  const d = parseDateStr(val);
  if (!d) return val;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  // If it's an ISO datetime string
  const d = new Date(timeStr);
  if (!isNaN(d.getTime())) {
    return d.getHours() * 60 + d.getMinutes();
  }
  // If 12-hour or 24-hour time string
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

export function formatClockTime(isoOrTimeStr?: string | null): string {
  if (!isoOrTimeStr) return '—';
  const d = new Date(isoOrTimeStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return isoOrTimeStr;
}

/**
 * Normalizes batch identifiers for matching.
 * Handles prefixes (Training:, Class:, Batch:), academic years, and formatting.
 */
export function normalizeBatchKey(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/^batch\s*\(/i, '')
    .replace(/\)$/, '')
    .replace(/^batch\s*-\s*/i, '')
    // Remove prefixes like "Training: ", "Class: ", "Location: ", "Batch: "
    .replace(/^(?:training|class|batch|location)\s*[:\-]?\s*/gi, '')
    // Remove academic years like 2026-2027
    .replace(/20\d\d\s*-\s*20\d\d/g, '')
    // Standardize batch number
    .replace(/batch\s*(\d+)/gi, 'b$1')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function isBatchMatch(
  notes: string | undefined,
  targetBatchName: string,
  targetBatchCode?: string,
  batchObj?: Batch | null
): boolean {
  if (!notes) return false;

  let expBatch = '';
  let expBatchId = '';
  try {
    const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
    expBatch = parsed?.batchName || parsed?.batch || parsed?.batch_name || '';
    expBatchId = parsed?.batchId || parsed?.batch_id || '';
    if (!expBatch && typeof notes === 'string' && !notes.trim().startsWith('{')) {
      expBatch = notes;
    }
  } catch {
    expBatch = notes;
  }

  // 1. Direct Batch ID match if present
  if (batchObj?.id && expBatchId && batchObj.id === expBatchId) {
    return true;
  }

  if (!expBatch) return false;

  const kExp = normalizeBatchKey(expBatch);
  if (!kExp) return false;

  // 2. Candidate target keys from batch identifiers
  const candidateKeys = new Set<string>();
  if (targetBatchName) candidateKeys.add(normalizeBatchKey(targetBatchName));
  if (targetBatchCode) candidateKeys.add(normalizeBatchKey(targetBatchCode));
  if (batchObj?.code) candidateKeys.add(normalizeBatchKey(batchObj.code));
  if (batchObj?.trainingName) candidateKeys.add(normalizeBatchKey(batchObj.trainingName));

  if (batchObj) {
    const col = batchObj.college || '';
    const prog = (batchObj.program && batchObj.program !== 'undefined') ? batchObj.program : '';
    const yr = batchObj.academicYear || (batchObj as any).academic_year || '';
    const bNo = batchObj.batchNo || (batchObj as any).batch_no || '';
    if (col && bNo) {
      candidateKeys.add(normalizeBatchKey(`${col} ${prog} ${bNo}`));
      candidateKeys.add(normalizeBatchKey(`${col} ${prog} ${yr} ${bNo}`));
    }
  }

  // Exact normalized key equality check to prevent cross-batch leakage
  for (const k of candidateKeys) {
    if (k && kExp === k) {
      return true;
    }
  }

  return false;
}

export function isSessionForBatch(
  ws: { work_type?: string; notes?: string },
  targetBatchName: string,
  targetBatchCode?: string,
  batchObj?: Batch | null
): boolean {
  if (!ws) return false;
  const textCandidates = [ws.work_type, ws.notes].filter(Boolean) as string[];
  for (const text of textCandidates) {
    if (isBatchMatch(text, targetBatchName, targetBatchCode, batchObj)) {
      return true;
    }
  }
  return false;
}

/**
 * Merges overlapping or contiguous time intervals.
 * Scenario A: (09:00-15:00) & (09:00-15:00) -> 09:00-15:00 (6h)
 * Scenario B: (09:00-13:00) & (13:00-16:00) -> 09:00-16:00 (7h)
 * Scenario C: (09:00-16:00) & (09:00-12:00) -> 09:00-16:00 (7h)
 */
export function mergeTimeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const valid = intervals.filter((i) => i.end > i.start);
  if (valid.length === 0) return [];

  valid.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: TimeInterval[] = [{ ...valid[0] }];
  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const prev = merged[merged.length - 1];
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function calculateMergedHours(intervals: TimeInterval[]): number {
  const merged = mergeTimeIntervals(intervals);
  const totalMinutes = merged.reduce((sum, int) => sum + (int.end - int.start), 0);
  return totalMinutes / 60;
}

// ── Excel Pivot Table Data Structures & Calculator ──────────────────────────

export interface PivotCategoryRow {
  category: string;
  amount: number;
  claimsCount: number;
  percentOfRowTotal: number;    // Category Amount / Employee Amount * 100
  percentOfGrandTotal: number;  // Category Amount / Grand Total * 100
  claims: ExpenseRow[];
}

export interface PivotEmployeeRow {
  employeeName: string;
  amount: number;
  claimsCount: number;
  percentOfRowTotal: number;    // 100.0%
  percentOfGrandTotal: number;  // Employee Amount / Grand Total * 100
  categories: PivotCategoryRow[];
}

export interface PivotTableData {
  rows: PivotEmployeeRow[];
  grandTotal: number;
  totalClaimsCount: number;
  percentOfGrandTotal: number;  // 100.0%
}

export function calculateExpensePivotTable(
  expenses: ExpenseRow[],
  totalExpenseOverride?: number
): PivotTableData {
  const grandTotal = typeof totalExpenseOverride === 'number' && totalExpenseOverride > 0
    ? totalExpenseOverride
    : expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const empMap = new Map<string, {
    total: number;
    count: number;
    catMap: Map<string, { total: number; count: number; claims: ExpenseRow[] }>;
  }>();

  expenses.forEach((e) => {
    const empName = (e.submittedBy || 'Unknown').trim();
    const amt = Number(e.amount) || 0;
    const catName = (e.expenseType || e.category || 'Other').trim();

    if (!empMap.has(empName)) {
      empMap.set(empName, { total: 0, count: 0, catMap: new Map() });
    }
    const empData = empMap.get(empName)!;
    empData.total += amt;
    empData.count += 1;

    if (!empData.catMap.has(catName)) {
      empData.catMap.set(catName, { total: 0, count: 0, claims: [] });
    }
    const catData = empData.catMap.get(catName)!;
    catData.total += amt;
    catData.count += 1;
    catData.claims.push(e);
  });

  const rows: PivotEmployeeRow[] = Array.from(empMap.entries())
    .map(([employeeName, data]) => {
      const empAmount = data.total;
      const categories: PivotCategoryRow[] = Array.from(data.catMap.entries())
        .map(([category, catData]) => ({
          category,
          amount: catData.total,
          claimsCount: catData.count,
          percentOfRowTotal: empAmount > 0 ? (catData.total / empAmount) * 100 : 0,
          percentOfGrandTotal: grandTotal > 0 ? (catData.total / grandTotal) * 100 : 0,
          claims: catData.claims.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || '')),
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        employeeName,
        amount: empAmount,
        claimsCount: data.count,
        percentOfRowTotal: 100.0,
        percentOfGrandTotal: grandTotal > 0 ? (empAmount / grandTotal) * 100 : 0,
        categories,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    rows,
    grandTotal,
    totalClaimsCount: expenses.length,
    percentOfGrandTotal: 100.0,
  };
}

function parseExpenseRow(raw: RawExpenseClaim): ExpenseRow {
  let expenseType = 'Expense';
  let submittedBy = '—';
  let route: string | undefined;
  let vehicle: string | undefined;
  let km: number | undefined;
  let dateStr = raw.created_at ? formatDate(raw.created_at) : '—';
  let rawDate = raw.created_at ? raw.created_at.slice(0, 10) : '';

  try {
    const parsed = JSON.parse(raw.notes || '{}');
    expenseType = parsed.expenseType || expenseType;
    submittedBy = parsed.personName || submittedBy;
    route = parsed.route;
    vehicle = parsed.vehicle;
    km = parsed.km;
    if (parsed.expenseDate) {
      rawDate = parsed.expenseDate;
      dateStr = formatDate(parsed.expenseDate);
    }
  } catch { /* noop */ }

  return {
    id: raw.id,
    date: dateStr,
    rawDate,
    expenseType,
    category: raw.category || 'Training Expense',
    amount: Number(raw.amount) || 0,
    submittedBy,
    status: (raw.status as ExpenseRow['status']) || 'submitted',
    receipt: raw.receipt_url && raw.receipt_url !== 'No Receipt Attached' ? raw.receipt_url : undefined,
    route,
    vehicle,
    km,
  };
}

// ── Category Classification Helper ─────────────────────────────────────────

type HighLevelCategory = 'Travel' | 'Food' | 'Stay' | 'Materials' | 'Other';

function classifyExpense(exp: ExpenseRow): HighLevelCategory {
  const type = (exp.expenseType || '').toLowerCase();
  const cat = (exp.category || '').toLowerCase();
  const route = (exp.route || '').toLowerCase();

  if (
    type.includes('travel') ||
    type.includes('car') ||
    type.includes('bike') ||
    type.includes('bus') ||
    type.includes('train') ||
    type.includes('metro') ||
    type.includes('auto') ||
    type.includes('uber') ||
    type.includes('ola') ||
    type.includes('cab') ||
    type.includes('taxi') ||
    type.includes('fuel') ||
    type.includes('petrol') ||
    type.includes('diesel') ||
    type.includes('toll') ||
    type.includes('parking') ||
    cat.includes('travel') ||
    route.length > 0
  ) {
    return 'Travel';
  }

  if (
    type.includes('tea') ||
    type.includes('coffee') ||
    type.includes('snack') ||
    type.includes('lunch') ||
    type.includes('dinner') ||
    type.includes('breakfast') ||
    type.includes('meal') ||
    type.includes('food') ||
    type.includes('refreshment') ||
    cat.includes('food')
  ) {
    return 'Food';
  }

  if (type.includes('hotel') || type.includes('stay') || type.includes('lodge') || type.includes('accommodation')) {
    return 'Stay';
  }

  if (type.includes('print') || type.includes('stationery') || type.includes('material') || type.includes('book') || type.includes('certificate')) {
    return 'Materials';
  }

  return 'Other';
}

const CATEGORY_META: Record<HighLevelCategory, { label: string; icon: string; color: string; bg: string }> = {
  Travel: { label: 'Travel & Conveyance', icon: '🚗', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  Food: { label: 'Food & Refreshments', icon: '☕', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' },
  Stay: { label: 'Accommodation & Stay', icon: '🏨', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
  Materials: { label: 'Training Materials', icon: '📦', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
  Other: { label: 'General / Miscellaneous', icon: '🏷️', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
};

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    approved:  { bg: 'var(--status-success-bg, #dcfce7)',  color: 'var(--status-success, #16a34a)',  border: 'var(--status-success-border, #bbf7d0)' },
    rejected:  { bg: 'var(--status-danger-bg, #fee2e2)',   color: 'var(--status-danger, #dc2626)',   border: 'var(--status-danger-border, #fecaca)' },
    submitted: { bg: 'var(--status-info-bg, #dbeafe)',     color: 'var(--status-info, #2563eb)',     border: 'var(--status-info-border, #bfdbfe)' },
  };
  const s = styles[status] || styles['submitted'];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

// ── Redesigned KPI Card: Heading & Value ONLY (No Subtitles) ─────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1.5px solid ${accent || 'var(--border)'}`,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: 'var(--e1)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function BatchExpenseDetailsDrawer({
  open,
  onClose,
  batchName,
  batchCode,
  studentCount,
  batch,
}: BatchExpenseDetailsDrawerProps) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [workSessions, setWorkSessions] = useState<BatchWorkSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'workhours' | 'log'>('overview');
  const [scheduledHoursTotal, setScheduledHoursTotal] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
  // Pivot Table Modal State for Trainer & Submitter Allocation
  const [pivotModalOpen, setPivotModalOpen] = useState(false);
  const [pivotSelectedSubmitter, setPivotSelectedSubmitter] = useState<string>('ALL');
  const [expandedPivotRows, setExpandedPivotRows] = useState<Record<string, boolean>>({});
  const [expandedPivotClaims, setExpandedPivotClaims] = useState<Record<string, boolean>>({});

  // Filters & Sorting for Expense Log Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubmitter, setFilterSubmitter] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Load expense data & workhours ─────────────────────────────────────────
  useEffect(() => {
    if (!open || (!batchName && !batchCode && !batch)) return;

    setLoading(true);
    const fetchedExpenses: ExpenseRow[] = [];

    (async () => {
      // 1. Fetch expenses from Supabase
      try {
        const { data } = await supabase
          .from('flwdsk_expense_claims')
          .select('id, amount, category, status, receipt_url, created_at, notes, employee_id')
          .ilike('category', '%Training%')
          .is('deleted_at', null);

        if (data && data.length > 0) {
          data
            .filter((r: RawExpenseClaim) => isBatchMatch(r.notes, batchName, batchCode, batch))
            .forEach((r: RawExpenseClaim) => fetchedExpenses.push(parseExpenseRow(r)));
        }
      } catch { /* fall through */ }

      // 2. Merge localStorage claims
      try {
        const local = JSON.parse(localStorage.getItem('kvj_local_expense_claims') || '[]');
        if (Array.isArray(local)) {
          local
            .filter((r: any) => {
              const notesField = r.notes || r.batch || '';
              return isBatchMatch(r.batch || notesField, batchName, batchCode, batch);
            })
            .forEach((r: any) => {
              if (!fetchedExpenses.find((f) => f.id === r.id)) {
                fetchedExpenses.push({
                  id: r.id,
                  date: r.date || formatDate(r.createdAt),
                  rawDate: r.date || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
                  expenseType: r.type || 'Expense',
                  category: r.category || 'Training Expense',
                  amount: Number(r.amount) || 0,
                  submittedBy: r.person || '—',
                  status: r.status || 'submitted',
                  receipt: r.receipt && r.receipt !== 'No Receipt Attached' ? r.receipt : undefined,
                  route: r.route,
                  vehicle: r.vehicle,
                  km: r.km,
                });
              }
            });
        }
      } catch { /* noop */ }

      // 3. Fetch attendance work sessions for this batch
      const matchedSessions: BatchWorkSession[] = [];
      try {
        // Query flwdsk_work_sessions with joined attendance records
        const { data: wsData } = await supabase
          .from('flwdsk_work_sessions')
          .select(`
            id,
            clock_in,
            clock_out,
            work_type,
            notes,
            attendance_record_id,
            flwdsk_attendance_records (
              id,
              employee_id,
              work_date
            )
          `)
          .is('deleted_at', null)
          .order('clock_in', { ascending: true });

        // Query employees map
        const { data: empsData } = await supabase
          .from('flwdsk_employees')
          .select('id, first_name, last_name')
          .is('deleted_at', null);

        const empMap = new Map<string, string>();
        empsData?.forEach((emp: any) => {
          const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
          empMap.set(emp.id, fullName || 'Employee');
        });

        if (wsData && wsData.length > 0) {
          wsData.forEach((ws: any) => {
            if (isSessionForBatch(ws, batchName, batchCode, batch)) {
              const att = Array.isArray(ws.flwdsk_attendance_records)
                ? ws.flwdsk_attendance_records[0]
                : ws.flwdsk_attendance_records;
              const empId = att?.employee_id;
              const empName = empId ? (empMap.get(empId) || 'Trainer') : 'Trainer';
              const workDate = att?.work_date || (ws.clock_in ? ws.clock_in.slice(0, 10) : '');

              let dur = 0;
              if (ws.clock_in && ws.clock_out) {
                const tIn = new Date(ws.clock_in).getTime();
                const tOut = new Date(ws.clock_out).getTime();
                if (!isNaN(tIn) && !isNaN(tOut) && tOut > tIn) {
                  dur = (tOut - tIn) / (1000 * 60 * 60);
                }
              } else if (ws.clock_in && !ws.clock_out) {
                // If unclosed session: default to 5:30 PM (17:30) of same day
                const inDate = new Date(ws.clock_in);
                if (!isNaN(inDate.getTime())) {
                  const outDate = new Date(inDate);
                  outDate.setHours(17, 30, 0, 0);
                  if (outDate.getTime() > inDate.getTime()) {
                    dur = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
                  } else {
                    dur = 1.0;
                  }
                }
              }

              matchedSessions.push({
                id: ws.id,
                employeeId: empId,
                employeeName: empName,
                workDate,
                clockIn: ws.clock_in || '',
                clockOut: ws.clock_out,
                durationHours: Math.round(dur * 100) / 100,
              });
            }
          });
        }
      } catch (err) {
        console.warn('Could not load training work sessions:', err);
      }

      // 4. Fetch batch calendar sessions for backup/schedule verification
      try {
        let calHours = 0;
        let count = 0;

        if (batch?.id) {
          const { data: cal } = await supabase
            .from('flwdsk_calendar_sessions')
            .select('*')
            .eq('batch_id', batch.id);

          if (cal && cal.length > 0) {
            count += cal.length;
            cal.forEach((s: any) => {
              if (s.start_time && s.end_time) {
                const parseTime = (t: string) => {
                  const m = t.match(/(\d+):(\d+)\s*(am|pm)?/i);
                  if (!m) return null;
                  let h = Number(m[1]);
                  const min = Number(m[2]);
                  const ampm = m[3]?.toLowerCase();
                  if (ampm === 'pm' && h < 12) h += 12;
                  if (ampm === 'am' && h === 12) h = 0;
                  return h * 60 + min;
                };
                const st = parseTime(s.start_time);
                const et = parseTime(s.end_time);
                if (st !== null && et !== null && et > st) {
                  calHours += (et - st) / 60;
                  return;
                }
              }
              calHours += s.duration_hours || 6.0;
            });
          }
        }

        setScheduledHoursTotal(Math.round(calHours * 10) / 10);
        setSessionCount(count);
      } catch (err) {
        console.warn('Could not load calendar workhours:', err);
      }

      setExpenses(fetchedExpenses);
      setWorkSessions(matchedSessions);
      setLoading(false);
    })();
  }, [open, batchName, batchCode, batch]);

  // ── Core Calculations & Unit Economics ───────────────────────────────────

  // 1. Total Students: directly from batch creation capacity/roster
  const effectiveStudentCount = useMemo(() => {
    const fromBatch = batch?.capacity ?? (batch as any)?.no_of_students ?? (batch as any)?.student_count;
    if (fromBatch !== undefined && fromBatch !== null && !isNaN(Number(fromBatch)) && Number(fromBatch) > 0) {
      return Number(fromBatch);
    }
    return Number(studentCount) || 0;
  }, [batch, studentCount]);

  // 2. Total Expenses
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  // 3. Cost Per Student: protected against division by zero
  const costPerStudent = useMemo(() => {
    return effectiveStudentCount > 0 ? totalExpense / effectiveStudentCount : 0;
  }, [totalExpense, effectiveStudentCount]);

  // 4. Unique Training Dates (strictly from actual attendance sessions)
  const uniqueTrainingDates = useMemo(() => {
    const set = new Set<string>();
    workSessions.forEach((s) => {
      if (s.workDate && s.workDate !== '—') {
        set.add(s.workDate);
      }
    });
    return Array.from(set).sort();
  }, [workSessions]);

  const uniqueTrainingDaysCount = uniqueTrainingDates.length;

  // 5. Batch Workhours Calculation (Merged overlapping intervals per training date)
  // Scenarios A, B, C compliant:
  // - Scenario A: Simultaneous Trainers (9-3 & 9-3 -> 6h)
  // - Scenario B: Sequential Trainers (9-1 & 1-4 -> 7h)
  // - Scenario C: Different Clock-Out (9-4 & 9-12 -> 7h)
  const batchWorkhours = useMemo(() => {
    if (workSessions.length === 0) {
      return scheduledHoursTotal > 0 ? scheduledHoursTotal : (sessionCount * 6.0 || 0);
    }

    const dateIntervalsMap = new Map<string, TimeInterval[]>();
    workSessions.forEach((s) => {
      if (!s.workDate) return;
      const startM = parseTimeToMinutes(s.clockIn);
      let endM = parseTimeToMinutes(s.clockOut);
      if (endM === null && startM !== null) {
        endM = Math.max(startM + 60, 17 * 60 + 30); // 17:30 default
      }
      if (startM !== null && endM !== null && endM > startM) {
        const list = dateIntervalsMap.get(s.workDate) || [];
        list.push({ start: startM, end: endM });
        dateIntervalsMap.set(s.workDate, list);
      }
    });

    let totalDeliveredMinutes = 0;
    dateIntervalsMap.forEach((intervals) => {
      const merged = mergeTimeIntervals(intervals);
      totalDeliveredMinutes += merged.reduce((acc, int) => acc + (int.end - int.start), 0);
    });

    const deliveredHours = totalDeliveredMinutes / 60;
    return Math.round(deliveredHours * 10) / 10;
  }, [workSessions, scheduledHoursTotal, sessionCount]);

  // 6. Overall Batch Man-hours: Sum of all individual employee workhours
  const totalManHours = useMemo(() => {
    const sum = workSessions.reduce((acc, s) => acc + s.durationHours, 0);
    return Math.round(sum * 10) / 10;
  }, [workSessions]);

  // 7. Average Expense Per Day = Total Batch Expenses / Unique Training Dates (attendance-based)
  const avgExpensePerDay = useMemo(() => {
    return uniqueTrainingDaysCount > 0 ? totalExpense / uniqueTrainingDaysCount : 0;
  }, [totalExpense, uniqueTrainingDaysCount]);

  // ── Work Hours Tab Analytics (Sections A & B) ────────────────────────────

  // Section A: Employee-wise Work Hours Summary
  const employeeWorkHoursSummary = useMemo(() => {
    const map = new Map<string, { employeeName: string; dates: Set<string>; totalHours: number }>();
    workSessions.forEach((s) => {
      const name = s.employeeName || 'Trainer';
      const existing = map.get(name) || { employeeName: name, dates: new Set<string>(), totalHours: 0 };
      if (s.workDate) existing.dates.add(s.workDate);
      existing.totalHours += s.durationHours;
      map.set(name, existing);
    });

    return Array.from(map.values())
      .map((item) => ({
        employeeName: item.employeeName,
        trainingDays: item.dates.size,
        totalHours: Math.round(item.totalHours * 10) / 10,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [workSessions]);

  // ── Expense Category Breakdown ───────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map: Record<HighLevelCategory, { count: number; total: number }> = {
      Travel: { count: 0, total: 0 },
      Food: { count: 0, total: 0 },
      Stay: { count: 0, total: 0 },
      Materials: { count: 0, total: 0 },
      Other: { count: 0, total: 0 },
    };

    expenses.forEach((e) => {
      const cat = classifyExpense(e);
      map[cat].count += 1;
      map[cat].total += e.amount;
    });

    return (Object.keys(map) as HighLevelCategory[])
      .map((key) => {
        const item = map[key];
        const pct = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
        return {
          category: key,
          ...CATEGORY_META[key],
          count: item.count,
          amount: item.total,
          percentage: pct,
        };
      })
      .filter((c) => c.count > 0 || c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpense]);

  // ── Submitter Breakdown ──────────────────────────────────────────────────
  const submitterBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number; types: Set<string> }>();

    expenses.forEach((e) => {
      const name = e.submittedBy || 'Unknown';
      const existing = map.get(name) || { count: 0, total: 0, types: new Set<string>() };
      existing.count += 1;
      existing.total += e.amount;
      if (e.expenseType) existing.types.add(e.expenseType);
      map.set(name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        amount: data.total,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
        types: Array.from(data.types).slice(0, 3).join(', '),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpense]);

  // Calculate complete Excel Pivot breakdown
  const pivotData = useMemo(() => {
    return calculateExpensePivotTable(expenses, totalExpense);
  }, [expenses, totalExpense]);

  const handleOpenPivot = (personName: string) => {
    setPivotSelectedSubmitter(personName);
    // Expand rows by default so categories are immediately visible
    const initialExpanded: Record<string, boolean> = {};
    pivotData.rows.forEach((r) => {
      initialExpanded[r.employeeName] = true;
    });
    setExpandedPivotRows(initialExpanded);
    setPivotModalOpen(true);
  };

  const togglePivotRow = (employeeName: string) => {
    setExpandedPivotRows((prev) => ({ ...prev, [employeeName]: !prev[employeeName] }));
  };

  const togglePivotClaims = (key: string) => {
    setExpandedPivotClaims((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Close Pivot Modal on ESC
  useEffect(() => {
    if (!pivotModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPivotModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pivotModalOpen]);

  const displayedPivotRows = useMemo(() => {
    if (pivotSelectedSubmitter === 'ALL') {
      return pivotData.rows;
    }
    return pivotData.rows.filter((r) => r.employeeName === pivotSelectedSubmitter);
  }, [pivotData.rows, pivotSelectedSubmitter]);

  // ── Daily Expense & Workhours Timeline (Attendance-derived) ───────────────
  const dailyTimeline = useMemo(() => {
    const dateMap = new Map<string, {
      displayDate: string;
      totalAmount: number;
      claimsCount: number;
      people: Set<string>;
      types: Set<string>;
      workHours: number;
    }>();

    // 1. Ingest actual training dates from workSessions
    const sessionIntervalsByDate = new Map<string, TimeInterval[]>();
    workSessions.forEach((s) => {
      if (!s.workDate) return;
      const startM = parseTimeToMinutes(s.clockIn);
      let endM = parseTimeToMinutes(s.clockOut);
      if (endM === null && startM !== null) endM = Math.max(startM + 60, 17 * 60 + 30);
      if (startM !== null && endM !== null && endM > startM) {
        const list = sessionIntervalsByDate.get(s.workDate) || [];
        list.push({ start: startM, end: endM });
        sessionIntervalsByDate.set(s.workDate, list);
      }
    });

    sessionIntervalsByDate.forEach((intervals, dKey) => {
      const merged = mergeTimeIntervals(intervals);
      const totalMinutes = merged.reduce((sum, int) => sum + (int.end - int.start), 0);
      dateMap.set(dKey, {
        displayDate: formatDate(dKey),
        totalAmount: 0,
        claimsCount: 0,
        people: new Set<string>(),
        types: new Set<string>(),
        workHours: Math.round((totalMinutes / 60) * 10) / 10,
      });
    });

    // 2. Ingest expense records into matching dates
    expenses.forEach((e) => {
      const dKey = e.rawDate || e.date;
      if (!dKey || dKey === '—') return;
      const existing = dateMap.get(dKey) || {
        displayDate: e.date,
        totalAmount: 0,
        claimsCount: 0,
        people: new Set<string>(),
        types: new Set<string>(),
        workHours: 6.0,
      };
      existing.totalAmount += e.amount;
      existing.claimsCount += 1;
      if (e.submittedBy && e.submittedBy !== '—') existing.people.add(e.submittedBy);
      if (e.expenseType) existing.types.add(e.expenseType);
      dateMap.set(dKey, existing);
    });

    return Array.from(dateMap.entries())
      .map(([rawDate, data]) => ({
        rawDate,
        displayDate: data.displayDate,
        totalAmount: data.totalAmount,
        claimsCount: data.claimsCount,
        workHours: data.workHours,
        people: Array.from(data.people).join(', '),
        types: Array.from(data.types).join(', '),
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [workSessions, expenses]);

  // ── Table Filtering & Sorting for Expense Log ─────────────────────────────
  const submitterOptions = useMemo(() => {
    const set = new Set(expenses.map((e) => e.submittedBy).filter((s) => s && s !== '—'));
    return Array.from(set).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterSubmitter !== 'ALL' && e.submittedBy !== filterSubmitter) return false;
      if (filterCategory !== 'ALL' && classifyExpense(e) !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          e.date.toLowerCase().includes(q) ||
          e.expenseType.toLowerCase().includes(q) ||
          e.submittedBy.toLowerCase().includes(q) ||
          (e.route && e.route.toLowerCase().includes(q)) ||
          String(e.amount).includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [expenses, filterSubmitter, filterCategory, searchQuery]);

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      if (sortKey === 'amount') {
        return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      const da = parseDateStr(a.date)?.getTime() ?? 0;
      const db = parseDateStr(b.date)?.getTime() ?? 0;
      return sortDir === 'desc' ? db - da : da - db;
    });
  }, [filteredExpenses, sortKey, sortDir]);

  const toggleSort = (key: 'date' | 'amount') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ── Export CSV Handler ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (expenses.length === 0) return;
    const header = ['Date', 'Expense Type', 'Category', 'Submitted By', 'Amount (INR)', 'Status', 'Route', 'Vehicle', 'KM', 'Receipt'];
    const rows = expenses.map((e) => [
      `"${e.date}"`,
      `"${e.expenseType}"`,
      `"${e.category}"`,
      `"${e.submittedBy}"`,
      e.amount,
      `"${e.status}"`,
      `"${e.route || ''}"`,
      `"${e.vehicle || ''}"`,
      e.km || '',
      `"${e.receipt || ''}"`,
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(batchCode || batchName).replace(/[^a-z0-9]/gi, '_')}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250,
        background: 'var(--bg-overlay, rgba(15, 23, 42, 0.65))',
        backdropFilter: 'blur(var(--overlay-blur, 6px))',
        WebkitBackdropFilter: 'blur(var(--overlay-blur, 6px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, var(--bg-surface))',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px var(--border)',
          width: '100%',
          maxWidth: 1060,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header: Subtitle Removed ── */}
        <div style={{
          padding: '16px 24px',
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💰 Expense Details</span>
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <span style={{ color: 'var(--brand)' }}>{batchCode || batchName}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {expenses.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                title="Download full expense log as CSV"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 150ms',
                }}
              >
                📥 Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'all 150ms',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Top Metric Strip: 5 KPI Cards Only (No Subtitles) ── */}
        <div style={{
          padding: '16px 24px 12px 24px',
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}>
            <KpiCard
              label="Total Students"
              value={String(effectiveStudentCount)}
              accent="var(--brand)"
            />
            <KpiCard
              label="Batch Workhours"
              value={`${batchWorkhours.toFixed(1)} hrs`}
              accent="#0284c7"
            />
            <KpiCard
              label="Total Expense"
              value={fmt(totalExpense)}
              accent="var(--status-info, #2563eb)"
            />
            <KpiCard
              label="Cost / Student"
              value={effectiveStudentCount > 0 ? fmt(costPerStudent) : '—'}
              accent="var(--purple-600, #9333ea)"
            />
            <KpiCard
              label="Avg / Day"
              value={uniqueTrainingDaysCount > 0 ? fmt(avgExpensePerDay) : '—'}
              accent="var(--status-success, #16a34a)"
            />
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[
              { id: 'overview', label: '📊 Expense & Workhour Analytics' },
              { id: 'workhours', label: `⏱️ Work Hours (${workSessions.length})` },
              { id: 'log', label: `📋 Detailed Expense Log (${expenses.length})` },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    background: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--brand)' : 'var(--text-secondary)',
                    border: active ? '1px solid var(--border)' : '1px solid transparent',
                    cursor: 'pointer',
                    boxShadow: active ? 'var(--e1)' : 'none',
                    transition: 'all 140ms ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content Body ── */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Loading expense and workhours data…
            </div>
          ) : activeTab === 'overview' ? (
            /* ═══════════════════════════════════════════════════════════════
               TAB 1: EXPENSE & WORKHOUR ANALYTICS
               ═══════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 1. Redesigned Category Distribution: 2 Side-by-Side Bar Charts */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '18px 20px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🏷️ Expense Category Distribution</span>
                </div>
                {categoryBreakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No expense claims recorded for this batch.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 20,
                  }}>
                    {/* Left Bar Chart: Category-wise Expense Amount */}
                    <div style={{
                      background: 'var(--bg-sunken)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Category Expense Amount
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>
                          Total: {fmt(totalExpense)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {categoryBreakdown.map((cat) => {
                          const maxAmount = Math.max(...categoryBreakdown.map((c) => c.amount), 1);
                          const barWidth = Math.max((cat.amount / maxAmount) * 100, 2);
                          return (
                            <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{cat.icon}</span>
                                  <span>{cat.label}</span>
                                </span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {fmt(cat.amount)}
                                </span>
                              </div>
                              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 6, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                                <div
                                  style={{
                                    width: `${barWidth}%`,
                                    background: cat.color,
                                    borderRadius: 5,
                                    transition: 'width 250ms ease',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Bar Chart: Expense Percentage Distribution */}
                    <div style={{
                      background: 'var(--bg-sunken)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Percentage Distribution
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--status-info, #2563eb)' }}>
                          Total: 100%
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {categoryBreakdown.map((cat) => {
                          const barWidth = Math.max(cat.percentage, 2);
                          return (
                            <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{cat.icon}</span>
                                  <span>{cat.label}</span>
                                </span>
                                <span style={{ fontWeight: 700, color: cat.color }}>
                                  {cat.percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 6, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                                <div
                                  style={{
                                    width: `${barWidth}%`,
                                    background: cat.color,
                                    borderRadius: 5,
                                    transition: 'width 250ms ease',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Trainer & Submitter Allocation (With Expandable View Details) */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>👤 Trainer & Submitter Allocation</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {submitterBreakdown.length} claimant{submitterBreakdown.length !== 1 ? 's' : ''}
                    </span>
                    {submitterBreakdown.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPivot('ALL')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--brand)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 120ms ease',
                        }}
                        title="Open Pivot Table breakdown for all claimants"
                      >
                        <span>📊 Pivot Breakdown</span>
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {submitterBreakdown.map((person) => {
                    return (
                      <div
                        key={person.name}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-sunken)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                              {person.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {person.count} claim{person.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                            }}>
                              {person.percentage.toFixed(1)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenPivot(person.name)}
                              style={{
                                padding: '4px 6px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-surface)',
                                color: 'var(--brand)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                transition: 'all 120ms ease',
                              }}
                              title={`View Claims Pivot Breakdown for ${person.name}`}
                              aria-label={`View Claims Pivot Breakdown for ${person.name}`}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
                            {fmt(person.amount)}
                          </span>
                        </div>
                        {person.types && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Types: {person.types}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Daily Expense & Workhours Correlation Timeline (Without Cost Per Hour) */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📅 Daily Expense & Workhours Delivery Timeline</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {dailyTimeline.length} active training delivery day{dailyTimeline.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Delivery Hours</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Day Expense</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Claimants</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Expense Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTimeline.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
                            No training days or expenses recorded for this batch.
                          </td>
                        </tr>
                      ) : (
                        dailyTimeline.map((row, idx) => (
                          <tr
                            key={row.rawDate}
                            style={{
                              background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {row.displayDate}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0284c7', fontWeight: 700 }}>
                              ⏱ {row.workHours.toFixed(1)} hrs
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {fmt(row.totalAmount)}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {row.people || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                              {row.types ? `${row.types} (${row.claimsCount} claim${row.claimsCount !== 1 ? 's' : ''})` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {dailyTimeline.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>Total ({dailyTimeline.length} Days)</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0284c7' }}>⏱ {batchWorkhours.toFixed(1)} hrs</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--brand)' }}>{fmt(totalExpense)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

            </div>
          ) : activeTab === 'workhours' ? (
            /* ═══════════════════════════════════════════════════════════════
               TAB 2: WORK HOURS (Replaces Travel & Mileage)
               ═══════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary Metric Badges */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}>
                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Batch Man-hours
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>
                    {totalManHours.toFixed(1)} hrs
                  </span>
                </div>

                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Batch Workhours
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0284c7' }}>
                    {batchWorkhours.toFixed(1)} hrs
                  </span>
                </div>

                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Training Days
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-success, #16a34a)' }}>
                    {uniqueTrainingDaysCount} days
                  </span>
                </div>

                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1.5px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Active Trainers
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#9333ea' }}>
                    {employeeWorkHoursSummary.length}
                  </span>
                </div>
              </div>

              {/* Section A: Employee-wise Work Hours Summary */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  👥 Employee-wise Work Hours Summary
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Employee Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Training Days</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Total Work Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeWorkHoursSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
                            No training attendance punches recorded for this batch.
                          </td>
                        </tr>
                      ) : (
                        employeeWorkHoursSummary.map((emp, idx) => (
                          <tr
                            key={emp.employeeName}
                            style={{
                              background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {emp.employeeName}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              {emp.trainingDays} day{emp.trainingDays !== 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                              ⏱ {emp.totalHours.toFixed(1)} hrs
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {employeeWorkHoursSummary.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>Total ({employeeWorkHoursSummary.length} Employees)</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>—</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--brand)' }}>
                            ⏱ {totalManHours.toFixed(1)} hrs
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Section B: Detailed Work Hours Log (Strictly No Overtime) */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  🕒 Detailed Work Hours Log
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Employee Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Training Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Clock-In Time</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Clock-Out Time</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Work Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workSessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
                            No training attendance punches recorded for this batch.
                          </td>
                        </tr>
                      ) : (
                        workSessions.map((session, idx) => (
                          <tr
                            key={session.id}
                            style={{
                              background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {session.employeeName}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {formatDate(session.workDate)}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {formatClockTime(session.clockIn)}
                            </td>
                            <td style={{ padding: '8px 12px', color: session.clockOut ? 'var(--text-primary)' : 'var(--status-warning, #d97706)', whiteSpace: 'nowrap' }}>
                              {session.clockOut ? formatClockTime(session.clockOut) : '05:30 PM (Default)'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                              ⏱ {session.durationHours.toFixed(1)} hrs
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {workSessions.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                            Total Sessions ({workSessions.length})
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--brand)' }}>
                            ⏱ {totalManHours.toFixed(1)} hrs
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               TAB 3: DETAILED EXPENSE LOG (Interactive Search & Filters)
               ═══════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Filter & Search Bar */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-sunken)',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', flex: 1, minWidth: 200, gap: 8 }}>
                  <input
                    type="text"
                    placeholder="🔍 Search expenses by type, route, submitter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={filterSubmitter}
                    onChange={(e) => setFilterSubmitter(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  >
                    <option value="ALL">All Submitters</option>
                    {submitterOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="Travel">🚗 Travel</option>
                    <option value="Food">☕ Food & Snacks</option>
                    <option value="Stay">🏨 Stay</option>
                    <option value="Materials">📦 Materials</option>
                    <option value="Other">🏷️ Other</option>
                  </select>

                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Showing <strong>{filteredExpenses.length}</strong> of {expenses.length}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)' }}>
                      {[
                        { key: 'date',   label: 'Date' },
                        { key: null,     label: 'Expense Type' },
                        { key: null,     label: 'Category' },
                        { key: null,     label: 'Submitted By' },
                        { key: 'amount', label: 'Amount' },
                        { key: null,     label: 'Status' },
                        { key: null,     label: 'Receipt' },
                      ].map(({ key, label }, i) => (
                        <th
                          key={i}
                          onClick={key ? () => toggleSort(key as 'date' | 'amount') : undefined}
                          style={{
                            padding: '10px 12px',
                            textAlign: i === 4 ? 'right' : 'left',
                            fontWeight: 700,
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: key ? 'pointer' : 'default',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {label}
                          {key && sortKey === key && (
                            <span style={{ marginLeft: 4 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenses.map((exp, idx) => {
                      const cat = classifyExpense(exp);
                      const catMeta = CATEGORY_META[cat];
                      return (
                        <tr
                          key={exp.id}
                          style={{
                            background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--brand) 6%, var(--bg-surface))')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)')}
                        >
                          <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {exp.date}
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {exp.expenseType}
                            {exp.vehicle && exp.km && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                                ({exp.vehicle} · {exp.km} km)
                              </span>
                            )}
                            {exp.route && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {exp.route}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: catMeta.bg,
                              color: catMeta.color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              <span>{catMeta.icon}</span>
                              <span>{cat}</span>
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>
                            {exp.submittedBy}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {fmt(exp.amount)}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <StatusBadge status={exp.status} />
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            {exp.receipt ? (
                              <a
                                href={exp.receipt}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                📎 View
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                        Filtered Total ({sortedExpenses.length} claims)
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(sortedExpenses.reduce((s, e) => s + e.amount, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pivot Table Modal Popup (Excel Pivot Style) ────────────────────────── */}
      {pivotModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setPivotModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: 16,
              border: '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: 880,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: 'var(--bg-sunken, #f8fafc)',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📊 Submitted Claims — Pivot Table Breakdown</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Batch: <strong style={{ color: 'var(--text-primary)' }}>{batchCode || batchName || 'Training Batch'}</strong> • Grand Total Expense: <strong style={{ color: 'var(--brand)' }}>{fmt(pivotData.grandTotal)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPivotModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close Popup (Esc)"
                aria-label="Close Popup"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Submitter Filter Tabs & Controls */}
            <div style={{
              padding: '10px 18px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPivotSelectedSubmitter('ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: pivotSelectedSubmitter === 'ALL' ? 700 : 500,
                    border: pivotSelectedSubmitter === 'ALL' ? '1px solid var(--brand)' : '1px solid var(--border)',
                    background: pivotSelectedSubmitter === 'ALL' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-surface)',
                    color: pivotSelectedSubmitter === 'ALL' ? 'var(--brand)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  All Claimants ({pivotData.rows.length})
                </button>
                {pivotData.rows.map((r) => {
                  const isSelected = pivotSelectedSubmitter === r.employeeName;
                  return (
                    <button
                      key={r.employeeName}
                      type="button"
                      onClick={() => setPivotSelectedSubmitter(r.employeeName)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? '1px solid var(--brand)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-surface)',
                        color: isSelected ? 'var(--brand)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 120ms ease',
                      }}
                    >
                      <span>{r.employeeName}</span>
                      <span style={{ fontSize: 10.5, opacity: 0.85 }}>({r.percentOfGrandTotal.toFixed(1)}%)</span>
                    </button>
                  );
                })}
              </div>

              {pivotData.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allExpanded = pivotData.rows.every((r) => expandedPivotRows[r.employeeName]);
                    const next: Record<string, boolean> = {};
                    pivotData.rows.forEach((r) => {
                      next[r.employeeName] = !allExpanded;
                    });
                    setExpandedPivotRows(next);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  {pivotData.rows.every((r) => expandedPivotRows[r.employeeName]) ? 'Collapse All ▲' : 'Expand All ▼'}
                </button>
              )}
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                <thead>
                  <tr style={{
                    background: 'var(--bg-sunken, #f8fafc)',
                    borderBottom: '2px solid var(--border, #e2e8f0)',
                    color: 'var(--text-secondary, #64748b)',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                  }}>
                    <th style={{ padding: '10px 16px', width: '46%' }}>Employee Name / Expense Category</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', width: '18%' }}>Amount</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', width: '18%' }}>% of Row Total</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', width: '18%' }}>% of Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPivotRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No submitted expense claims found for this batch.
                      </td>
                    </tr>
                  ) : (
                    displayedPivotRows.map((row) => {
                      const isExpanded = !!expandedPivotRows[row.employeeName];
                      return (
                        <Fragment key={row.employeeName}>
                          {/* Employee Main Row */}
                          <tr
                            style={{
                              background: 'var(--bg-sunken, #f8fafc)',
                              borderTop: '1px solid var(--border, #e2e8f0)',
                              borderBottom: '1px solid var(--border, #e2e8f0)',
                              fontWeight: 700,
                            }}
                          >
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => togglePivotRow(row.employeeName)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: 11,
                                    width: 16,
                                  }}
                                  title={isExpanded ? 'Collapse categories' : 'Expand categories'}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                  👤 {row.employeeName}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  background: 'var(--bg-surface)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  border: '1px solid var(--border)',
                                }}>
                                  {row.claimsCount} claim{row.claimsCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              color: 'var(--brand)',
                              fontSize: 13,
                              fontWeight: 800,
                            }}>
                              {fmt(row.amount)}
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: 'var(--text-secondary)',
                            }}>
                              100.0%
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: '#2563eb',
                            }}>
                              {row.percentOfGrandTotal.toFixed(1)}%
                            </td>
                          </tr>

                          {/* Category Child Rows (Under Employee Name) */}
                          {isExpanded && row.categories.map((cat) => {
                            const claimKey = `${row.employeeName}-${cat.category}`;
                            const isClaimsOpen = !!expandedPivotClaims[claimKey];
                            return (
                              <Fragment key={claimKey}>
                                <tr
                                  style={{
                                    borderBottom: '1px dashed var(--border, #e2e8f0)',
                                    background: 'var(--bg-surface)',
                                    transition: 'background 100ms ease',
                                  }}
                                >
                                  <td style={{ padding: '9px 16px 9px 40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>↳</span>
                                        <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>
                                          🏷️ {cat.category}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          ({cat.claimsCount} claim{cat.claimsCount !== 1 ? 's' : ''})
                                        </span>
                                      </div>
                                      {cat.claims.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => togglePivotClaims(claimKey)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 10.5,
                                            fontWeight: 600,
                                            color: 'var(--brand)',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                          }}
                                          title={isClaimsOpen ? 'Hide individual claim records' : 'View individual claim records'}
                                        >
                                          {isClaimsOpen ? 'Hide Claims ▲' : 'View Claims ▼'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{
                                    padding: '9px 16px',
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                  }}>
                                    {fmt(cat.amount)}
                                  </td>
                                  <td style={{
                                    padding: '9px 16px',
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                  }}>
                                    {cat.percentOfRowTotal.toFixed(1)}%
                                  </td>
                                  <td style={{
                                    padding: '9px 16px',
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                  }}>
                                    {cat.percentOfGrandTotal.toFixed(1)}%
                                  </td>
                                </tr>

                                {/* Individual Claims Drilldown under Category */}
                                {isClaimsOpen && (
                                  <tr style={{ background: 'var(--bg-sunken)' }}>
                                    <td colSpan={4} style={{ padding: '8px 16px 12px 48px' }}>
                                      <div style={{
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: '8px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                      }}>
                                        {cat.claims.map((cl) => (
                                          <div
                                            key={cl.id}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              fontSize: 11,
                                              padding: '4px 0',
                                              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cl.date}</span>
                                              {cl.route && (
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                  📍 {cl.route} {cl.km ? `(${cl.km} km)` : ''}
                                                </span>
                                              )}
                                              {cl.receipt && (
                                                <a
                                                  href={cl.receipt}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
                                                >
                                                  📎 Receipt
                                                </a>
                                              )}
                                            </div>
                                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--brand)' }}>
                                              {fmt(cl.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{
                    background: 'var(--bg-sunken)',
                    borderTop: '2px solid var(--border)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      📊 Grand Total ({pivotData.totalClaimsCount} claims across {pivotData.rows.length} claimants)
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--brand)', fontSize: 14 }}>
                      {fmt(pivotData.grandTotal)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      100.0%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#2563eb' }}>
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default BatchExpenseDetailsDrawer;
