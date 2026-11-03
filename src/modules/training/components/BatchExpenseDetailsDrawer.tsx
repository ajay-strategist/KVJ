/**
 * BatchExpenseDetailsDrawer (Current Screen Popup Modal)
 *
 * Displays financial analytics and workhour intelligence for a training batch:
 *  - 7 KPI Cards:
 *      1. Total Students
 *      2. Batch Workhours (Scheduled & Delivered)
 *      3. Total Expense
 *      4. Cost Per Student
 *      5. Cost Per Workhour (Total Expense / Batch Workhours)
 *      6. Average Expense / Day
 *      7. Average Expense / Claim
 *  - Visual Category Distribution Breakdown (Travel, Food, Stay, Materials)
 *  - Trainer / Submitter Spending Breakdown & % Share
 *  - Daily Expense & Workhours Correlation Timeline
 *  - Mileage & Vehicle Reimbursement Insights
 *  - Detailed Filterable Expense Log with Search, Submitter Filters, and CSV Export
 */

import { useEffect, useState, useMemo } from 'react';
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

interface ExpenseRow {
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

function parseDateStr(val?: string | null): Date | null {
  if (!val || val === '—') return null;
  const ymd = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(val?: string | null): string {
  if (!val) return '—';
  const d = parseDateStr(val);
  if (!d) return val;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function normalizeBatchKey(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/^batch\s*\(/i, '')
    .replace(/\)$/, '')
    .replace(/^batch\s*-\s*/i, '')
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

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1.5px solid ${accent || 'var(--border)'}`,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      boxShadow: 'var(--e1)',
    }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.25 }}>{sub}</span>
      )}
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
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'mileage'>('overview');
  const [scheduledHoursTotal, setScheduledHoursTotal] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);

  // Filters & Sorting for Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubmitter, setFilterSubmitter] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Load expense data & workhours ─────────────────────────────────────────
  useEffect(() => {
    if (!open || (!batchName && !batchCode && !batch)) return;

    setLoading(true);
    const fetched: ExpenseRow[] = [];

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
            .forEach((r: RawExpenseClaim) => fetched.push(parseExpenseRow(r)));
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
              if (!fetched.find((f) => f.id === r.id)) {
                fetched.push({
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

      // 3. Fetch batch workhours & sessions from Calendar and Schedule tables
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

      setExpenses(fetched);
      setLoading(false);
    })();
  }, [open, batchName, batchCode, batch]);

  // ── Core Calculations & Unit Economics ───────────────────────────────────
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const avgExpense   = useMemo(() => expenses.length > 0 ? totalExpense / expenses.length : 0, [totalExpense, expenses]);
  const costPerStudent = useMemo(() => studentCount > 0 ? totalExpense / studentCount : 0, [totalExpense, studentCount]);

  // Unique training entry dates
  const uniqueEntryDates = useMemo(() => {
    const datesSet = new Set(expenses.map((e) => e.date).filter((d) => d && d !== '—'));
    return datesSet.size;
  }, [expenses]);

  const activeDaysCount = useMemo(() => Math.max(uniqueEntryDates, 1), [uniqueEntryDates]);
  const avgExpensePerDay = useMemo(() => totalExpense / activeDaysCount, [totalExpense, activeDaysCount]);

  // Workhours calculation:
  // Each conducted training day delivered by trainers represents standard 6.0h curriculum delivery.
  // We take the max of calendar scheduled hours vs active delivered training hours.
  const batchWorkhours = useMemo(() => {
    const deliveredHours = uniqueEntryDates * 6.0;
    if (scheduledHoursTotal > 0) {
      return Math.max(scheduledHoursTotal, deliveredHours);
    }
    return deliveredHours > 0 ? deliveredHours : (sessionCount * 6.0 || 6.0);
  }, [uniqueEntryDates, scheduledHoursTotal, sessionCount]);

  // Financial Efficiency Metrics
  const costPerWorkhour = useMemo(() => {
    return batchWorkhours > 0 ? totalExpense / batchWorkhours : 0;
  }, [totalExpense, batchWorkhours]);

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

  // ── Mileage & Vehicle Analytics ──────────────────────────────────────────
  const mileageAnalysis = useMemo(() => {
    let totalKm = 0;
    let travelExpenseTotal = 0;
    const routesList: Array<{ date: string; person: string; route: string; vehicle?: string; km: number; amount: number }> = [];

    expenses.forEach((e) => {
      if (e.km && e.km > 0) {
        totalKm += e.km;
        routesList.push({
          date: e.date,
          person: e.submittedBy,
          route: e.route || 'Travel Route',
          vehicle: e.vehicle || 'Car',
          km: e.km,
          amount: e.amount,
        });
      }
      if (classifyExpense(e) === 'Travel') {
        travelExpenseTotal += e.amount;
      }
    });

    const costPerKm = totalKm > 0 ? travelExpenseTotal / totalKm : 0;

    return {
      totalKm,
      travelExpenseTotal,
      costPerKm,
      routesList: routesList.sort((a, b) => b.km - a.km),
    };
  }, [expenses]);

  // ── Daily Expense & Workhours Timeline ────────────────────────────────────
  const dailyTimeline = useMemo(() => {
    const dateMap = new Map<string, { displayDate: string; totalAmount: number; claimsCount: number; people: Set<string>; types: Set<string> }>();

    expenses.forEach((e) => {
      const dKey = e.rawDate || e.date;
      if (!dKey || dKey === '—') return;
      const existing = dateMap.get(dKey) || {
        displayDate: e.date,
        totalAmount: 0,
        claimsCount: 0,
        people: new Set<string>(),
        types: new Set<string>(),
      };
      existing.totalAmount += e.amount;
      existing.claimsCount += 1;
      if (e.submittedBy) existing.people.add(e.submittedBy);
      if (e.expenseType) existing.types.add(e.expenseType);
      dateMap.set(dKey, existing);
    });

    return Array.from(dateMap.entries())
      .map(([rawDate, data]) => {
        const workHoursOnDay = 6.0; // standard delivery day
        return {
          rawDate,
          displayDate: data.displayDate,
          totalAmount: data.totalAmount,
          claimsCount: data.claimsCount,
          workHours: workHoursOnDay,
          costPerHour: workHoursOnDay > 0 ? data.totalAmount / workHoursOnDay : 0,
          people: Array.from(data.people).join(', '),
          types: Array.from(data.types).join(', '),
        };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [expenses]);

  // ── Table Filtering & Sorting ─────────────────────────────────────────────
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
          maxWidth: 1040,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Batch Financial Intelligence, Delivery Workhours & Resource Analysis
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

        {/* ── Top Multi-Card Metric Strip (7 KPI Cards) ── */}
        <div style={{
          padding: '16px 24px 12px 24px',
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
          }}>
            <KpiCard
              label="Total Students"
              value={String(studentCount || 0)}
              sub="enrolled students"
              accent="var(--brand)"
            />
            <KpiCard
              label="Batch Workhours"
              value={`${batchWorkhours.toFixed(1)} hrs`}
              sub={`${activeDaysCount} training day${activeDaysCount !== 1 ? 's' : ''}`}
              accent="#0284c7"
            />
            <KpiCard
              label="Total Expense"
              value={fmt(totalExpense)}
              sub={`${expenses.length} total claim${expenses.length !== 1 ? 's' : ''}`}
              accent="var(--status-info, #2563eb)"
            />
            <KpiCard
              label="Cost / Student"
              value={studentCount > 0 ? fmt(costPerStudent) : '—'}
              sub={studentCount > 0 ? `Expense / ${studentCount} students` : 'No students'}
              accent="var(--purple-600, #9333ea)"
            />
            <KpiCard
              label="Cost / Workhour"
              value={batchWorkhours > 0 ? `${fmt(costPerWorkhour)}/hr` : '—'}
              sub="hourly batch cost"
              accent="#059669"
            />
            <KpiCard
              label="Avg / Day"
              value={fmt(avgExpensePerDay)}
              sub={`over ${uniqueEntryDates} dates`}
              accent="var(--status-success, #16a34a)"
            />
            <KpiCard
              label="Avg / Claim"
              value={fmt(avgExpense)}
              sub="per submission"
              accent="var(--status-warning, #d97706)"
            />
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[
              { id: 'overview', label: '📊 Expense & Workhour Analytics' },
              { id: 'log', label: `📋 Detailed Expense Log (${expenses.length})` },
              ...(mileageAnalysis.totalKm > 0 ? [{ id: 'mileage', label: `🚗 Travel & Mileage (${mileageAnalysis.totalKm} km)` }] : []),
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
          ) : expenses.length === 0 ? (
            <div style={{
              padding: '60px 24px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 40 }}>📭</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                No expense claims found for <strong>{batchCode || batchName}</strong>.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Expenses tagged to this batch will automatically appear here once submitted.
              </p>
            </div>
          ) : activeTab === 'overview' ? (
            /* ═══════════════════════════════════════════════════════════════
               TAB 1: EXPENSE & WORKHOUR ANALYTICS
               ═══════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 1. Category Distribution Progress Bar & Cards */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏷️ Expense Category Distribution</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Total: <strong>{fmt(totalExpense)}</strong> across {categoryBreakdown.length} categories
                  </span>
                </div>

                {/* Multi-segmented Progress Bar */}
                <div style={{
                  height: 10,
                  borderRadius: 6,
                  overflow: 'hidden',
                  display: 'flex',
                  background: 'var(--bg-sunken)',
                  marginBottom: 14,
                }}>
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.category}
                      style={{
                        width: `${Math.max(cat.percentage, 1.5)}%`,
                        background: cat.color,
                        transition: 'width 200ms ease',
                      }}
                      title={`${cat.label}: ${fmt(cat.amount)} (${cat.percentage.toFixed(1)}%)`}
                    />
                  ))}
                </div>

                {/* Category Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.category}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-sunken)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>
                          {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {fmt(cat.amount)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {cat.count} claim{cat.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Submitter (Trainer / Staff) Spending Share */}
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {submitterBreakdown.length} claimant{submitterBreakdown.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {submitterBreakdown.map((person) => (
                    <div
                      key={person.name}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-sunken)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {person.name}
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 6,
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                        }}>
                          {person.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
                          {fmt(person.amount)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {person.count} claim{person.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {person.types && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Types: {person.types}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Daily Expense & Workhours Correlation Timeline */}
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
                    {dailyTimeline.length} active training delivery days
                  </span>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Delivery Hours</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Day Expense</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Cost / Hour</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Claimants</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Expense Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTimeline.map((row, idx) => (
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
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--status-success, #16a34a)', fontWeight: 600 }}>
                            {fmt(row.costPerHour)}/hr
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                            {row.people}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                            {row.types} ({row.claimsCount} claim{row.claimsCount !== 1 ? 's' : ''})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>Total ({dailyTimeline.length} Days)</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0284c7' }}>⏱ {batchWorkhours.toFixed(1)} hrs</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--brand)' }}>{fmt(totalExpense)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--status-success)' }}>{fmt(costPerWorkhour)}/hr</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          ) : activeTab === 'mileage' ? (
            /* ═══════════════════════════════════════════════════════════════
               TAB 3: MILEAGE & TRAVEL ANALYSIS
               ═══════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard
                  label="Total Travelled"
                  value={`${mileageAnalysis.totalKm} km`}
                  sub="claimed distance"
                  accent="#2563eb"
                />
                <KpiCard
                  label="Travel Expense"
                  value={fmt(mileageAnalysis.travelExpenseTotal)}
                  sub="conveyance & fuel"
                  accent="#9333ea"
                />
                <KpiCard
                  label="Effective Cost / KM"
                  value={mileageAnalysis.costPerKm > 0 ? `${fmt(mileageAnalysis.costPerKm)}/km` : '—'}
                  sub="rate efficiency"
                  accent="#059669"
                />
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '16px 18px',
                boxShadow: 'var(--e1)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  🚗 Route & Distance Drilldown
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Trainer</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Route Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Vehicle</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Distance</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mileageAnalysis.routesList.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.date}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.person}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.route}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{r.vehicle || 'Car'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{r.km} km</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               TAB 2: DETAILED EXPENSE LOG (Interactive Search & Filters)
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
    </div>,
    document.body
  );
}

export default BatchExpenseDetailsDrawer;
