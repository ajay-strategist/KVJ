/**
 * BatchExpenseDetailsDrawer
 *
 * Shows financial analytics for a single training batch:
 *  - KPI Cards: Total Expense | Average Expense | Cost / Student | Avg Expense / Day
 *  - Detailed sortable expense log filtered by batch name
 *
 * Data sourcing priority:
 *  1. Supabase — flwdsk_expense_claims (category = Training Expense, notes JSON contains batchName)
 *  2. localStorage — kvj_local_expense_claims (batch field match)
 */

import { useEffect, useState, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { supabase } from '../../../shared/integration/supabase';

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
  /** Human-readable display label for the drawer title */
  batchCode: string;
  /** Number of students in the batch (live count or capacity fallback) */
  studentCount: number;
  startDate?: string;
  endDate?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDateStr(val?: string | null): Date | null {
  if (!val || val === '—') return null;
  // Try YYYY-MM-DD
  const ymd = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  // Try DD/MM/YYYY
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(start?: string, end?: string): number {
  const s = parseDateStr(start);
  const e = parseDateStr(end);
  if (!s || !e) return 1;
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

function formatDate(val?: string | null): string {
  if (!val) return '—';
  const d = parseDateStr(val);
  if (!d) return val;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function isBatchMatch(notes: string | undefined, batchName: string): boolean {
  if (!batchName) return false;
  if (!notes) return false;
  const lower = notes.toLowerCase();
  const target = batchName.toLowerCase();
  // Check raw JSON string
  if (lower.includes(target)) return true;
  // Try parsing
  try {
    const parsed = JSON.parse(notes);
    const nb: string = parsed?.batchName || '';
    return nb.toLowerCase().includes(target) || target.includes(nb.toLowerCase());
  } catch {
    return false;
  }
}

function parseExpenseRow(raw: RawExpenseClaim): ExpenseRow {
  let expenseType = 'Expense';
  let submittedBy = '—';
  let route: string | undefined;
  let vehicle: string | undefined;
  let km: number | undefined;
  let dateStr = raw.created_at ? formatDate(raw.created_at) : '—';

  try {
    const parsed = JSON.parse(raw.notes || '{}');
    expenseType = parsed.expenseType || expenseType;
    submittedBy = parsed.personName || submittedBy;
    route = parsed.route;
    vehicle = parsed.vehicle;
    km = parsed.km;
    if (parsed.expenseDate) dateStr = formatDate(parsed.expenseDate);
  } catch { /* noop */ }

  return {
    id: raw.id,
    date: dateStr,
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
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      boxShadow: 'var(--e1)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>
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
  startDate,
  endDate,
}: BatchExpenseDetailsDrawerProps) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Load expense data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !batchName) return;

    setLoading(true);
    const fetched: ExpenseRow[] = [];

    // 1. Try Supabase
    (async () => {
      try {
        const { data } = await supabase
          .from('flwdsk_expense_claims')
          .select('id, amount, category, status, receipt_url, created_at, notes, employee_id')
          .eq('category', 'Training Expense');

        if (data && data.length > 0) {
          data
            .filter((r: RawExpenseClaim) => isBatchMatch(r.notes, batchName))
            .forEach((r: RawExpenseClaim) => fetched.push(parseExpenseRow(r)));
        }
      } catch { /* fall through to localStorage */ }

      // 2. Merge localStorage (dedup by id)
      try {
        const local = JSON.parse(localStorage.getItem('kvj_local_expense_claims') || '[]');
        if (Array.isArray(local)) {
          local
            .filter((r: any) => {
              const batchField: string = r.batch || '';
              return (
                batchField.toLowerCase().includes(batchName.toLowerCase()) ||
                batchName.toLowerCase().includes(batchField.toLowerCase())
              ) && batchField;
            })
            .forEach((r: any) => {
              if (!fetched.find((f) => f.id === r.id)) {
                fetched.push({
                  id: r.id,
                  date: r.date || formatDate(r.createdAt),
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

      setExpenses(fetched);
      setLoading(false);
    })();
  }, [open, batchName]);

  // ── Analytics ────────────────────────────────────────────────────────────
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const avgExpense   = useMemo(() => expenses.length > 0 ? totalExpense / expenses.length : 0, [totalExpense, expenses]);
  const costPerStudent = useMemo(() => studentCount > 0 ? totalExpense / studentCount : 0, [totalExpense, studentCount]);
  const trainingDays   = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const avgPerDay      = useMemo(() => totalExpense / trainingDays, [totalExpense, trainingDays]);

  // ── Sorted rows ──────────────────────────────────────────────────────────
  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      if (sortKey === 'amount') {
        return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      // Sort by date string
      const da = parseDateStr(a.date)?.getTime() ?? 0;
      const db = parseDateStr(b.date)?.getTime() ?? 0;
      return sortDir === 'desc' ? db - da : da - db;
    });
  }, [expenses, sortKey, sortDir]);

  const toggleSort = (key: 'date' | 'amount') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`💰 Expense Details — ${batchCode || batchName}`}
      size="lg"
    >
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading expense data…
        </div>
      ) : expenses.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 36 }}>📭</span>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            No expense claims found for <strong>{batchCode || batchName}</strong>.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Expenses tagged to this batch will appear here once submitted.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <KpiCard
              label="Total Expense"
              value={fmt(totalExpense)}
              sub={`${expenses.length} claim${expenses.length !== 1 ? 's' : ''}`}
              accent="var(--brand)"
            />
            <KpiCard
              label="Average Expense"
              value={fmt(avgExpense)}
              sub="per claim"
            />
            <KpiCard
              label="Cost / Student"
              value={studentCount > 0 ? fmt(costPerStudent) : '—'}
              sub={studentCount > 0 ? `${studentCount} student${studentCount !== 1 ? 's' : ''}` : 'No student count available'}
              accent={studentCount > 0 ? 'var(--status-info, #2563eb)' : undefined}
            />
            <KpiCard
              label="Avg Expense / Day"
              value={fmt(avgPerDay)}
              sub={`over ${trainingDays} day${trainingDays !== 1 ? 's' : ''}`}
              accent="var(--status-success, #16a34a)"
            />
          </div>

          {/* ── Divider ── */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '0 -4px' }} />

          {/* ── Expense Log Table ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                Detailed Expense Log
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {expenses.length} record{expenses.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)' }}>
                    {[
                      { key: 'date',   label: 'Date' },
                      { key: null,     label: 'Expense Type' },
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
                          textAlign: i === 3 ? 'right' : 'left',
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
                  {sortedExpenses.map((exp, idx) => (
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
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                      Total ({expenses.length} claims)
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(totalExpense)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default BatchExpenseDetailsDrawer;
