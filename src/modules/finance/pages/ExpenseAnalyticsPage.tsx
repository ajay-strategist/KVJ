/**
 * KVJ Analytics — Expense Analytics & Intelligence Engine (Enterprise Edition)
 *
 * Implements 20 analytical dimensions, 6 interactive multi-level filters,
 * VisionOS glassmorphism aesthetics, responsive SVG charts, 2D cross-tab matrix heatmap,
 * YoY comparative matching by (College + Program/Stream + Course), and multi-sheet Excel export.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Building2,
  GraduationCap,
  Filter,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  PieChart,
  Car,
  Bus,
  ArrowUpDown,
  Search,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Badge, Button } from '../../../shared/ui/components';
import { supabase } from '../../../shared/integration/supabase';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { normalizeBatchKey, isBatchMatch } from '../../training/components/BatchExpenseDetailsDrawer';
import {
  exportExpenseAnalyticsToExcel,
  type ExportPayload,
} from '../utils/exportExpenseAnalyticsExcel';

// ── Types ──────────────────────────────────────────────────────────────────

interface ClaimRecord {
  id: string;
  amount: number;
  category: 'Training Expense' | 'Office Expense' | string;
  status: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  employee_id?: string;
  // Parsed note fields
  personName: string;
  expenseType: string;
  batchName: string;
  expenseDate: string;
  route?: string;
  vehicle?: 'Bike' | 'Car' | string;
  km?: number;
  rate?: number;
  userNotes?: string;
  matchedBatchId?: string;
}

interface BatchRecord {
  id: string;
  code: string;
  batch_no: string;
  training_name: string;
  college: string;
  academic_year: string;
  course_id: string;
  trainer_id?: string;
  start_date?: string;
  end_date?: string;
  capacity: number;
  studentCount: number;
  program: string;
  comparisonKey: string;
}

interface EmployeeRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

type TabKey = 'overview' | 'batches' | 'types-monthly' | 'travel' | 'matrix' | 'yoy';
type DatePreset = 'all' | 'month' | '30d' | '90d' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatNumber = (val: number): string => {
  return new Intl.NumberFormat('en-IN').format(val || 0);
};

function parseDate(str?: string | null): Date | null {
  if (!str) return null;
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(str?: string | null): string {
  if (!str) return '—';
  const d = parseDate(str);
  if (!d) return str;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#84CC16', // Lime
  '#64748B', // Slate
];

export function ExpenseAnalyticsPage() {
  const { toast } = useNotifications();

  // ── Remote Data State ────────────────────────────────────────────────────
  const [loading, setLoading] = useState<boolean>(true);
  const [rawClaims, setRawClaims] = useState<ClaimRecord[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [enrollmentsMap, setEnrollmentsMap] = useState<Record<string, number>>({});

  // ── Filters State ────────────────────────────────────────────────────────
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [comparisonYear, setComparisonYear] = useState<string>('2025-2026');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Training Expense' | 'Office Expense'>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');

  // ── UI View State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [batchSortField, setBatchSortField] = useState<'expense' | 'costPerStudent' | 'costPerDay' | 'students'>('expense');
  const [batchSortAsc, setBatchSortAsc] = useState<boolean>(false);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);

  // ── 1. Load Data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Claims
      const { data: claimsData, error: claimsErr } = await supabase
        .from('flwdsk_expense_claims')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (claimsErr) throw claimsErr;

      // Fetch Batches
      const { data: batchesData, error: batchesErr } = await supabase
        .from('flwdsk_batches')
        .select('*')
        .is('deleted_at', null);

      if (batchesErr) throw batchesErr;

      // Fetch Employees
      const { data: empsData } = await supabase
        .from('flwdsk_employees')
        .select('id, first_name, last_name, email, role');

      // Fetch Enrollments for exact live student counts
      const { data: enrollsData } = await supabase
        .from('flwdsk_enrollments')
        .select('batch_id')
        .is('deleted_at', null);

      const enrollCounts: Record<string, number> = {};
      enrollsData?.forEach((e: any) => {
        if (e.batch_id) {
          enrollCounts[e.batch_id] = (enrollCounts[e.batch_id] || 0) + 1;
        }
      });
      setEnrollmentsMap(enrollCounts);

      // Map Batches
      const mappedBatches: BatchRecord[] = (batchesData || []).map((b: any) => {
        const col = b.college || '';
        let prog = b.program || '';
        if (!prog && b.code && b.code.includes('-')) {
          const parts = b.code.split('-');
          if (parts.length >= 2) prog = parts[1].trim();
        }
        const crs = b.training_name || '';
        const bNo = b.batch_no || '';
        const yr = b.academic_year || '2026-2027';
        const cKey = `${col.trim().toLowerCase()}|${prog.trim().toLowerCase()}|${crs.trim().toLowerCase()}`;
        const studentCount = enrollCounts[b.id] || Number(b.capacity) || 0;

        return {
          id: b.id,
          code: b.code || '',
          batch_no: bNo,
          training_name: crs,
          college: col,
          academic_year: yr,
          course_id: b.course_id || '',
          trainer_id: b.trainer_id,
          start_date: b.start_date,
          end_date: b.end_date,
          capacity: Number(b.capacity) || 0,
          studentCount,
          program: prog,
          comparisonKey: cKey,
        };
      });
      setBatches(mappedBatches);

      // Map Claims with Batch Matching
      const mappedClaims: ClaimRecord[] = (claimsData || []).map((c: any) => {
        let pName = 'Employee';
        let expType = 'Misc';
        let bName = '';
        let expDate = c.created_at ? c.created_at.slice(0, 10) : '';
        let route = '';
        let vehicle = undefined;
        let km = undefined;
        let rate = undefined;
        let userNotes = c.notes || '';

        if (c.notes && typeof c.notes === 'string' && c.notes.trim().startsWith('{')) {
          try {
            const p = JSON.parse(c.notes);
            pName = p.personName || pName;
            expType = p.expenseType || expType;
            bName = p.batchName || bName;
            if (p.expenseDate) expDate = p.expenseDate;
            route = p.route || route;
            vehicle = p.vehicle;
            km = p.km !== undefined && p.km !== null ? Number(p.km) : undefined;
            rate = p.rate !== undefined && p.rate !== null ? Number(p.rate) : undefined;
            userNotes = p.userNotes || '';
          } catch { /* noop */ }
        }

        // Match to batch
        let matchedBatchId: string | undefined = undefined;
        if (c.category === 'Training Expense') {
          for (const b of mappedBatches) {
            if (isBatchMatch(c.notes, b.code, b.training_name, b as any)) {
              matchedBatchId = b.id;
              break;
            }
          }
        }

        return {
          id: c.id,
          amount: Number(c.amount) || 0,
          category: c.category || 'Office Expense',
          status: (c.status || 'submitted').toLowerCase(),
          receipt_url: c.receipt_url,
          notes: userNotes,
          created_at: c.created_at,
          employee_id: c.employee_id,
          personName: pName,
          expenseType: expType,
          batchName: bName,
          expenseDate: expDate,
          route,
          vehicle,
          km,
          rate,
          userNotes,
          matchedBatchId,
        };
      });
      setRawClaims(mappedClaims);

      // Map Employees
      setEmployees(empsData || []);
    } catch (err: any) {
      console.error('Error loading expense analytics data:', err);
      toast({
        variant: 'error',
        title: 'Failed to load expense data',
        message: err.message || 'Please check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── 2. Unique Filter Options ─────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => { if (b.academic_year) set.add(b.academic_year); });
    set.add('2026-2027');
    set.add('2025-2026');
    set.add('2024-2025');
    return Array.from(set).sort().reverse();
  }, [batches]);

  const availableColleges = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => { if (b.college) set.add(b.college); });
    return Array.from(set).sort();
  }, [batches]);

  const availableBatchesForCollege = useMemo(() => {
    if (selectedCollege === 'all') return batches;
    return batches.filter(b => b.college === selectedCollege);
  }, [batches, selectedCollege]);

  const availableExpenseTypes = useMemo(() => {
    const set = new Set<string>();
    rawClaims.forEach(c => { if (c.expenseType) set.add(c.expenseType); });
    return Array.from(set).sort();
  }, [rawClaims]);

  // ── 3. Date Filtering Helper ─────────────────────────────────────────────
  const isInDateRange = useCallback((dateStr: string): boolean => {
    if (!dateStr || datePreset === 'all') return true;
    const d = parseDate(dateStr);
    if (!d) return true;

    const now = new Date();
    if (datePreset === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (datePreset === '30d') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 30;
    }
    if (datePreset === '90d') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 90;
    }
    // Academic Year Quarters (AY starts April 1)
    const month = d.getMonth(); // 0-based: 3=Apr, 4=May, 5=Jun
    if (datePreset === 'q1') return month >= 3 && month <= 5;
    if (datePreset === 'q2') return month >= 6 && month <= 8;
    if (datePreset === 'q3') return month >= 9 && month <= 11;
    if (datePreset === 'q4') return month >= 0 && month <= 2;

    if (datePreset === 'custom') {
      const start = customStart ? parseDate(customStart) : null;
      const end = customEnd ? parseDate(customEnd) : null;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    }
    return true;
  }, [datePreset, customStart, customEnd]);

  // ── 4. Filtered Claims ───────────────────────────────────────────────────
  const filteredClaims = useMemo(() => {
    return rawClaims.filter(c => {
      // Category filter
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;

      // Expense Types multi-select
      if (selectedTypes.length > 0 && !selectedTypes.includes(c.expenseType)) return false;

      // Employee filter
      if (selectedEmployeeId !== 'all') {
        const emp = employees.find(e => e.id === selectedEmployeeId);
        const fullName = emp ? `${emp.first_name} ${emp.last_name}`.trim().toLowerCase() : '';
        const claimPerson = c.personName?.toLowerCase() || '';
        const matchId = c.employee_id === selectedEmployeeId;
        const matchName = fullName && claimPerson.includes(fullName);
        if (!matchId && !matchName) return false;
      }

      // College & Batch filter
      if (selectedBatchId !== 'all') {
        if (c.category !== 'Training Expense') return false;
        if (c.matchedBatchId !== selectedBatchId) return false;
      } else if (selectedCollege !== 'all') {
        if (c.category !== 'Training Expense') return false;
        const b = batches.find(x => x.id === c.matchedBatchId);
        if (!b || b.college !== selectedCollege) return false;
      }

      // Academic Year filter
      if (academicYear !== 'all') {
        if (c.category === 'Training Expense') {
          const b = batches.find(x => x.id === c.matchedBatchId);
          if (b && b.academic_year !== academicYear) return false;
        } else {
          // For office expenses, check date span of academic year
          const yrStart = parseInt(academicYear.slice(0, 4), 10);
          if (!isNaN(yrStart)) {
            const d = parseDate(c.expenseDate);
            if (d) {
              const startAY = new Date(yrStart, 3, 1);
              const endAY = new Date(yrStart + 1, 2, 31, 23, 59, 59);
              if (d < startAY || d > endAY) return false;
            }
          }
        }
      }

      // Date Range filter
      if (!isInDateRange(c.expenseDate)) return false;

      return true;
    });
  }, [
    rawClaims,
    categoryFilter,
    selectedTypes,
    selectedEmployeeId,
    selectedBatchId,
    selectedCollege,
    academicYear,
    batches,
    employees,
    isInDateRange,
  ]);

  // ── 5. Prior Year Benchmark Claims (for M15–M20) ──────────────────────────
  const priorYearClaims = useMemo(() => {
    if (!comparisonYear || comparisonYear === 'all') return [];
    return rawClaims.filter(c => {
      if (c.category === 'Training Expense') {
        const b = batches.find(x => x.id === c.matchedBatchId);
        if (b && b.academic_year === comparisonYear) return true;
      } else {
        const yrStart = parseInt(comparisonYear.slice(0, 4), 10);
        if (!isNaN(yrStart)) {
          const d = parseDate(c.expenseDate);
          if (d) {
            const startAY = new Date(yrStart, 3, 1);
            const endAY = new Date(yrStart + 1, 2, 31, 23, 59, 59);
            return d >= startAY && d <= endAY;
          }
        }
      }
      return false;
    });
  }, [rawClaims, comparisonYear, batches]);

  // ── 6. Metrics Calculations (M1–M20) ─────────────────────────────────────

  // M1: Total Expenses
  const totalExpenses = useMemo(() => {
    return filteredClaims.reduce((sum, c) => sum + c.amount, 0);
  }, [filteredClaims]);

  // M2: Training Expenses
  const trainingExpenses = useMemo(() => {
    return filteredClaims
      .filter(c => c.category === 'Training Expense')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [filteredClaims]);

  // Office Expenses
  const officeExpenses = useMemo(() => {
    return filteredClaims
      .filter(c => c.category === 'Office Expense')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [filteredClaims]);

  // Active batches covered in filtered scope
  const activeBatchesInScope = useMemo(() => {
    return batches.filter(b => {
      if (academicYear !== 'all' && b.academic_year !== academicYear) return false;
      if (selectedCollege !== 'all' && b.college !== selectedCollege) return false;
      if (selectedBatchId !== 'all' && b.id !== selectedBatchId) return false;
      return true;
    });
  }, [batches, academicYear, selectedCollege, selectedBatchId]);

  // Total Students Covered in scope
  const totalStudentsInScope = useMemo(() => {
    return activeBatchesInScope.reduce((sum, b) => sum + (b.studentCount || b.capacity || 0), 0);
  }, [activeBatchesInScope]);

  // Total Training Days across active batches in scope
  const totalTrainingDaysInScope = useMemo(() => {
    let days = 0;
    activeBatchesInScope.forEach(b => {
      // Calculate unique expense dates for this batch
      const bClaims = filteredClaims.filter(c => c.matchedBatchId === b.id);
      const uniqueDays = new Set(bClaims.map(c => c.expenseDate)).size;
      days += Math.max(uniqueDays, 1);
    });
    return Math.max(days, 1);
  }, [activeBatchesInScope, filteredClaims]);

  // M3: Cost / Student
  const costPerStudent = useMemo(() => {
    if (totalStudentsInScope === 0) return 0;
    return trainingExpenses / totalStudentsInScope;
  }, [trainingExpenses, totalStudentsInScope]);

  // M4: Cost / Training Day
  const costPerTrainingDay = useMemo(() => {
    if (totalTrainingDaysInScope === 0) return 0;
    return trainingExpenses / totalTrainingDaysInScope;
  }, [trainingExpenses, totalTrainingDaysInScope]);

  // M15 & M16: Prior Year Expense & Cost/Student
  const priorYearTotalExpense = useMemo(() => {
    return priorYearClaims.reduce((sum, c) => sum + c.amount, 0);
  }, [priorYearClaims]);

  const priorYearBatches = useMemo(() => {
    return batches.filter(b => b.academic_year === comparisonYear);
  }, [batches, comparisonYear]);

  const priorYearStudents = useMemo(() => {
    return priorYearBatches.reduce((sum, b) => sum + (b.studentCount || b.capacity || 0), 0);
  }, [priorYearBatches]);

  const priorYearCostPerStudent = useMemo(() => {
    if (priorYearStudents === 0) return 0;
    const pyTraining = priorYearClaims
      .filter(c => c.category === 'Training Expense')
      .reduce((sum, c) => sum + c.amount, 0);
    return pyTraining / priorYearStudents;
  }, [priorYearClaims, priorYearStudents]);

  // M19: YoY Expense Variance & Growth %
  const yoyExpenseDiff = totalExpenses - priorYearTotalExpense;
  const yoyExpenseGrowthPct = priorYearTotalExpense > 0
    ? ((totalExpenses - priorYearTotalExpense) / priorYearTotalExpense) * 100
    : 0;

  // ── M5, M6, M7, M13: Batch Level Breakdown ───────────────────────────────
  const batchAnalytics = useMemo(() => {
    return activeBatchesInScope.map(b => {
      const bClaims = filteredClaims.filter(c => c.matchedBatchId === b.id);
      const totalExpense = bClaims.reduce((sum, c) => sum + c.amount, 0);
      const students = b.studentCount || b.capacity || 0;
      const costPerStudent = students > 0 ? totalExpense / students : 0;

      const uniqueDays = new Set(bClaims.map(c => c.expenseDate)).size;
      const trainingDays = Math.max(uniqueDays, 1);
      const costPerDay = totalExpense / trainingDays;

      const sharePct = trainingExpenses > 0 ? (totalExpense / trainingExpenses) * 100 : 0;

      // Travel vs other
      const travelClaims = bClaims.filter(c =>
        ['Self Travel', 'Bus', 'Metro', 'Auto', 'Uber', 'Train'].includes(c.expenseType)
      );
      const travelExpense = travelClaims.reduce((sum, c) => sum + c.amount, 0);
      const otherExpense = totalExpense - travelExpense;

      return {
        id: b.id,
        code: b.code,
        college: b.college,
        program: b.program,
        course: b.training_name,
        batchNo: b.batch_no,
        totalExpense,
        studentCount: students,
        costPerStudent,
        trainingDays,
        costPerDay,
        sharePct,
        travelExpense,
        otherExpense,
        claimsCount: bClaims.length,
        claims: bClaims,
      };
    });
  }, [activeBatchesInScope, filteredClaims, trainingExpenses]);

  // Sorted and searched batch analytics
  const processedBatches = useMemo(() => {
    let list = [...batchAnalytics];
    if (batchSearch.trim()) {
      const term = batchSearch.trim().toLowerCase();
      list = list.filter(
        b =>
          b.code.toLowerCase().includes(term) ||
          b.college.toLowerCase().includes(term) ||
          b.program.toLowerCase().includes(term) ||
          b.course.toLowerCase().includes(term)
      );
    }
    list.sort((a, b) => {
      let vA = 0;
      let vB = 0;
      if (batchSortField === 'expense') {
        vA = a.totalExpense;
        vB = b.totalExpense;
      } else if (batchSortField === 'costPerStudent') {
        vA = a.costPerStudent;
        vB = b.costPerStudent;
      } else if (batchSortField === 'costPerDay') {
        vA = a.costPerDay;
        vB = b.costPerDay;
      } else if (batchSortField === 'students') {
        vA = a.studentCount;
        vB = b.studentCount;
      }
      return batchSortAsc ? vA - vB : vB - vA;
    });
    return list;
  }, [batchAnalytics, batchSearch, batchSortField, batchSortAsc]);

  // ── M8: Expense by Expense Type ──────────────────────────────────────────
  const expenseTypeBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number; category: string }> = {};
    filteredClaims.forEach(c => {
      const t = c.expenseType || 'Misc';
      if (!map[t]) {
        map[t] = { amount: 0, count: 0, category: c.category };
      }
      map[t].amount += c.amount;
      map[t].count += 1;
    });

    const list = Object.entries(map).map(([type, data]) => ({
      type,
      category: data.category,
      amount: data.amount,
      claimsCount: data.count,
      sharePct: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
    }));
    return list.sort((a, b) => b.amount - a.amount);
  }, [filteredClaims, totalExpenses]);

  // ── M9 & M10: Monthly Expenses & Monthly by Type ─────────────────────────
  const monthlyProgression = useMemo(() => {
    const monthsMap: Record<string, {
      monthKey: string;
      monthLabel: string;
      office: number;
      training: number;
      total: number;
      count: number;
      types: Record<string, number>;
    }> = {};

    filteredClaims.forEach(c => {
      const d = parseDate(c.expenseDate);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!monthsMap[key]) {
        monthsMap[key] = {
          monthKey: key,
          monthLabel: label,
          office: 0,
          training: 0,
          total: 0,
          count: 0,
          types: {},
        };
      }
      if (c.category === 'Office Expense') monthsMap[key].office += c.amount;
      else monthsMap[key].training += c.amount;

      monthsMap[key].total += c.amount;
      monthsMap[key].count += 1;

      const t = c.expenseType || 'Misc';
      monthsMap[key].types[t] = (monthsMap[key].types[t] || 0) + c.amount;
    });

    const sortedKeys = Object.keys(monthsMap).sort();
    return sortedKeys.map(k => monthsMap[k]);
  }, [filteredClaims]);

  // ── M11: Expense by Employees ────────────────────────────────────────────
  const employeeLeaderboard = useMemo(() => {
    const empMap: Record<string, {
      name: string;
      role: string;
      claimsCount: number;
      totalAmount: number;
      types: Record<string, number>;
    }> = {};

    filteredClaims.forEach(c => {
      const empId = c.employee_id;
      const matchedEmp = employees.find(e => e.id === empId);
      const name = matchedEmp
        ? `${matchedEmp.first_name} ${matchedEmp.last_name}`.trim()
        : c.personName || 'Employee';
      const role = matchedEmp?.role || 'Staff';

      if (!empMap[name]) {
        empMap[name] = {
          name,
          role,
          claimsCount: 0,
          totalAmount: 0,
          types: {},
        };
      }
      empMap[name].claimsCount += 1;
      empMap[name].totalAmount += c.amount;

      const t = c.expenseType || 'Misc';
      empMap[name].types[t] = (empMap[name].types[t] || 0) + c.amount;
    });

    return Object.values(empMap)
      .map(e => ({
        ...e,
        avgClaim: e.claimsCount > 0 ? e.totalAmount / e.claimsCount : 0,
        sharePct: totalExpenses > 0 ? (e.totalAmount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredClaims, employees, totalExpenses]);

  // ── M12: 2D Matrix (Batches × Expense Types) ─────────────────────────────
  const matrixData = useMemo(() => {
    const distinctBatches = activeBatchesInScope.map(b => b.code);
    const distinctTypes = expenseTypeBreakdown.map(t => t.type);

    const matrix: Record<string, Record<string, number>> = {};
    const batchTotals: Record<string, number> = {};
    const typeTotals: Record<string, number> = {};
    let grandTotal = 0;

    distinctBatches.forEach(bCode => {
      matrix[bCode] = {};
      distinctTypes.forEach(tName => {
        matrix[bCode][tName] = 0;
      });
      batchTotals[bCode] = 0;
    });

    distinctTypes.forEach(tName => {
      typeTotals[tName] = 0;
    });

    filteredClaims.forEach(c => {
      if (c.category !== 'Training Expense') return;
      const b = batches.find(x => x.id === c.matchedBatchId);
      if (!b) return;
      const bCode = b.code;
      const tName = c.expenseType || 'Misc';

      if (!matrix[bCode]) matrix[bCode] = {};
      matrix[bCode][tName] = (matrix[bCode][tName] || 0) + c.amount;
      batchTotals[bCode] = (batchTotals[bCode] || 0) + c.amount;
      typeTotals[tName] = (typeTotals[tName] || 0) + c.amount;
      grandTotal += c.amount;
    });

    // Find max cell value for heatmap intensity
    let maxCellVal = 1;
    distinctBatches.forEach(bCode => {
      distinctTypes.forEach(tName => {
        const val = matrix[bCode]?.[tName] || 0;
        if (val > maxCellVal) maxCellVal = val;
      });
    });

    return {
      batches: distinctBatches,
      types: distinctTypes,
      matrix,
      batchTotals,
      typeTotals,
      grandTotal,
      maxCellVal,
    };
  }, [activeBatchesInScope, expenseTypeBreakdown, filteredClaims, batches]);

  // ── M14: Travel Expense Comparison in Batch ──────────────────────────────
  const travelModalityAnalytics = useMemo(() => {
    return activeBatchesInScope.map(b => {
      const bClaims = filteredClaims.filter(c => c.matchedBatchId === b.id);
      let bikeAmount = 0;
      let bikeKm = 0;
      let carAmount = 0;
      let carKm = 0;
      let busAmount = 0;
      let metroAmount = 0;
      let autoAmount = 0;
      let uberAmount = 0;

      bClaims.forEach(c => {
        const t = c.expenseType?.toLowerCase() || '';
        if (t.includes('self travel') || c.vehicle) {
          if (c.vehicle === 'Bike') {
            bikeAmount += c.amount;
            bikeKm += c.km || 0;
          } else if (c.vehicle === 'Car') {
            carAmount += c.amount;
            carKm += c.km || 0;
          } else {
            bikeAmount += c.amount;
          }
        } else if (t.includes('bus')) {
          busAmount += c.amount;
        } else if (t.includes('metro')) {
          metroAmount += c.amount;
        } else if (t.includes('auto')) {
          autoAmount += c.amount;
        } else if (t.includes('uber') || t.includes('cab') || t.includes('taxi')) {
          uberAmount += c.amount;
        }
      });

      const totalTravel = bikeAmount + carAmount + busAmount + metroAmount + autoAmount + uberAmount;
      const totalSpend = bClaims.reduce((sum, c) => sum + c.amount, 0);
      const travelSharePct = totalSpend > 0 ? (totalTravel / totalSpend) * 100 : 0;

      return {
        batchId: b.id,
        batchCode: b.code,
        college: b.college,
        selfTravelBikeAmount: bikeAmount,
        selfTravelBikeKm: bikeKm,
        selfTravelCarAmount: carAmount,
        selfTravelCarKm: carKm,
        busAmount,
        metroAmount,
        autoAmount,
        uberAmount,
        totalTravelAmount: totalTravel,
        totalBatchExpense: totalSpend,
        travelSharePct,
      };
    });
  }, [activeBatchesInScope, filteredClaims]);

  // ── M15–M20: Prior Year Academic Comparison Matrix ───────────────────────
  // Matched strictly by: [College Name] + [Program / Stream] + [Course]
  const yoyComparisonData = useMemo(() => {
    // Current Year Batches
    const currentYearBatches = batches.filter(b => b.academic_year === academicYear);
    // Prior Year Batches
    const priorBatches = batches.filter(b => b.academic_year === comparisonYear);

    // Group batches by comparisonKey
    const currentMap = new Map<string, BatchRecord[]>();
    currentYearBatches.forEach(b => {
      const k = b.comparisonKey;
      if (!currentMap.has(k)) currentMap.set(k, []);
      currentMap.get(k)!.push(b);
    });

    const priorMap = new Map<string, BatchRecord[]>();
    priorBatches.forEach(b => {
      const k = b.comparisonKey;
      if (!priorMap.has(k)) priorMap.set(k, []);
      priorMap.get(k)!.push(b);
    });

    // Unique keys from current scope
    const allKeys = Array.from(new Set([...currentMap.keys()]));

    return allKeys.map(k => {
      const curBatches = currentMap.get(k) || [];
      const pyBatches = priorMap.get(k) || [];

      const college = curBatches[0]?.college || pyBatches[0]?.college || '—';
      const program = curBatches[0]?.program || pyBatches[0]?.program || '—';
      const course = curBatches[0]?.training_name || pyBatches[0]?.training_name || '—';

      // Aggregate current metrics
      let currentExpense = 0;
      let currentStudents = 0;
      curBatches.forEach(b => {
        currentStudents += b.studentCount || b.capacity || 0;
        const bClaims = filteredClaims.filter(c => c.matchedBatchId === b.id);
        currentExpense += bClaims.reduce((sum, c) => sum + c.amount, 0);
      });
      const currentCostPerStudent = currentStudents > 0 ? currentExpense / currentStudents : 0;

      // Aggregate prior year metrics
      let priorExpense = 0;
      let priorStudents = 0;
      pyBatches.forEach(b => {
        priorStudents += b.studentCount || b.capacity || 0;
        const bClaims = priorYearClaims.filter(c => c.matchedBatchId === b.id);
        priorExpense += bClaims.reduce((sum, c) => sum + c.amount, 0);
      });
      const priorCostPerStudent = priorStudents > 0 ? priorExpense / priorStudents : 0;

      const varianceAmount = currentExpense - priorExpense;
      const growthPct = priorExpense > 0 ? ((currentExpense - priorExpense) / priorExpense) * 100 : 0;

      return {
        key: k,
        college,
        program,
        course,
        currentBatch: curBatches.map(b => b.code).join(', '),
        currentStudents,
        currentExpense,
        currentCostPerStudent,
        priorBatch: pyBatches.map(b => b.code).join(', ') || 'No Prior Baseline Record',
        priorStudents,
        priorExpense,
        priorCostPerStudent,
        varianceAmount,
        growthPct,
      };
    });
  }, [batches, academicYear, comparisonYear, filteredClaims, priorYearClaims]);

  // ── 7. Excel Export Handler ──────────────────────────────────────────────
  const handleExportExcel = useCallback(() => {
    try {
      const payload: ExportPayload = {
        kpis: {
          academicYear,
          comparisonYear,
          totalExpenses,
          trainingExpenses,
          officeExpenses,
          totalStudents: totalStudentsInScope,
          costPerStudent,
          totalTrainingDays: totalTrainingDaysInScope,
          costPerTrainingDay,
          batchesCovered: activeBatchesInScope.length,
          totalClaimsCount: filteredClaims.length,
          priorYearTotalExpense,
          priorYearCostPerStudent,
          yoyExpenseDiff,
          yoyExpenseGrowthPct,
        },
        batches: processedBatches.map(b => ({
          code: b.code,
          college: b.college,
          program: b.program,
          course: b.course,
          batchNo: b.batchNo,
          totalExpense: b.totalExpense,
          studentCount: b.studentCount,
          costPerStudent: b.costPerStudent,
          trainingDays: b.trainingDays,
          costPerDay: b.costPerDay,
          sharePct: b.sharePct,
          travelExpense: b.travelExpense,
          otherExpense: b.otherExpense,
          claimsCount: b.claimsCount,
        })),
        types: expenseTypeBreakdown,
        monthly: monthlyProgression.map(m => ({
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          officeExpense: m.office,
          trainingExpense: m.training,
          totalExpense: m.total,
          claimsCount: m.count,
        })),
        employees: employeeLeaderboard,
        travel: travelModalityAnalytics,
        matrix: {
          batches: matrixData.batches,
          types: matrixData.types,
          matrix: matrixData.matrix,
          batchTotals: matrixData.batchTotals,
          typeTotals: matrixData.typeTotals,
          grandTotal: matrixData.grandTotal,
        },
        yoy: yoyComparisonData,
        rawClaims: filteredClaims.map(c => {
          const b = batches.find(x => x.id === c.matchedBatchId);
          return {
            id: c.id,
            date: formatDateDisplay(c.expenseDate),
            employeeName: c.personName,
            category: c.category,
            expenseType: c.expenseType,
            college: b?.college || '—',
            batchName: b?.code || c.batchName || '—',
            amount: c.amount,
            vehicle: c.vehicle,
            km: c.km,
            rate: c.rate,
            route: c.route,
            status: c.status,
            notes: c.notes,
          };
        }),
      };

      exportExpenseAnalyticsToExcel(payload);
      toast({
        variant: 'success',
        title: 'Report Downloaded',
        message: `Exported comprehensive 9-sheet Expense Analytics workbook.`,
      });
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      toast({
        variant: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not export Excel workbook.',
      });
    }
  }, [
    academicYear,
    comparisonYear,
    totalExpenses,
    trainingExpenses,
    officeExpenses,
    totalStudentsInScope,
    costPerStudent,
    totalTrainingDaysInScope,
    costPerTrainingDay,
    activeBatchesInScope,
    filteredClaims,
    priorYearTotalExpense,
    priorYearCostPerStudent,
    yoyExpenseDiff,
    yoyExpenseGrowthPct,
    processedBatches,
    expenseTypeBreakdown,
    monthlyProgression,
    employeeLeaderboard,
    travelModalityAnalytics,
    matrixData,
    yoyComparisonData,
    batches,
    toast,
  ]);

  // Reset all filters
  const handleResetFilters = () => {
    setAcademicYear('2026-2027');
    setComparisonYear('2025-2026');
    setDatePreset('all');
    setCustomStart('');
    setCustomEnd('');
    setCategoryFilter('all');
    setSelectedTypes([]);
    setSelectedEmployeeId('all');
    setSelectedCollege('all');
    setSelectedBatchId('all');
    setBatchSearch('');
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 8px 60px 8px' }}>
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <PageHeader
          title="Expense Analytics"
          subtitle="Comprehensive financial intelligence, batch efficiency, unit cost per student & prior-year benchmarks"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                disabled={loading}
                aria-label="Refresh financial data"
              >
                <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', marginRight: 6 }} />
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportExcel}
                aria-label="Export complete Excel report"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
                Export Excel Report
              </Button>
            </div>
          }
        />

        {/* ── Sticky / Floating Filter Console (Glassmorphism) ───────────── */}
        <div
          style={{
            marginTop: 18,
            marginBottom: 24,
            padding: '16px 20px',
            borderRadius: 16,
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={18} style={{ color: 'var(--brand)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Filter & Comparative Parameters
              </span>
              <Badge tone="neutral" style={{ fontSize: 11, padding: '2px 8px' }}>
                {filteredClaims.length} Claims Active
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            >
              Reset All Filters
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Filter 1: Academic Year */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Academic Year (Current)
              </label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Academic Years</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Benchmark Academic Year (For YoY M15-M20) */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Comparison Benchmark Year
              </label>
              <select
                value={comparisonYear}
                onChange={e => setComparisonYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Date Range Preset */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Date Range Span
              </label>
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value as DatePreset)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Entire Academic Year</option>
                <option value="month">This Month</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="q1">Q1 (Apr - Jun)</option>
                <option value="q2">Q2 (Jul - Sep)</option>
                <option value="q3">Q3 (Oct - Dec)</option>
                <option value="q4">Q4 (Jan - Mar)</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Filter 3: Classification */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Expense Classification
              </label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Classifications</option>
                <option value="Training Expense">Training Expenses Only</option>
                <option value="Office Expense">Office Expenses Only</option>
              </select>
            </div>

            {/* Filter 4: College Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                College / Institution
              </label>
              <select
                value={selectedCollege}
                onChange={e => {
                  setSelectedCollege(e.target.value);
                  setSelectedBatchId('all');
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Colleges ({availableColleges.length})</option>
                {availableColleges.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter 5: Batch Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Training Batch
              </label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Batches ({availableBatchesForCollege.length})</option>
                {availableBatchesForCollege.map(b => (
                  <option key={b.id} value={b.id}>{b.code}</option>
                ))}
              </select>
            </div>

            {/* Filter 6: Employee / Trainer */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Employee / Trainer
              </label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Employees / Trainers</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Pickers if selected */}
          {datePreset === 'custom' && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Expense Type Quick Filter Chips */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: 4 }}>
              Expense Types:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTypes([])}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: selectedTypes.length === 0 ? 'var(--brand)' : 'var(--bg-card)',
                color: selectedTypes.length === 0 ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              All Types
            </button>
            {availableExpenseTypes.map(t => {
              const active = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (active) setSelectedTypes(selectedTypes.filter(x => x !== t));
                    else setSelectedTypes([...selectedTypes, t]);
                  }}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 20,
                    border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    background: active ? 'var(--brand-muted)' : 'var(--bg-card)',
                    color: active ? 'var(--brand)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Top Executive KPI Cards (Metrics 1–4, 15–16) ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
          {/* M1: Total Expenses */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Total Expenses
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                <DollarSign size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatINR(totalExpenses)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{filteredClaims.length} total claims</span>
              {priorYearTotalExpense > 0 ? (
                <span style={{ fontWeight: 700, color: yoyExpenseDiff > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {yoyExpenseDiff > 0 ? '+' : ''}{yoyExpenseGrowthPct.toFixed(1)}% YoY
                </span>
              ) : (
                <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Active AY Scope</span>
              )}
            </div>
          </div>

          {/* M2: Training Expenses */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Training Expenses
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <GraduationCap size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatINR(trainingExpenses)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Office: {formatINR(officeExpenses)}</span>
              <span style={{ fontWeight: 700, color: '#10B981' }}>
                {totalExpenses > 0 ? ((trainingExpenses / totalExpenses) * 100).toFixed(0) : 0}% of Budget
              </span>
            </div>
          </div>

          {/* M3: Cost / Student */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Cost / Student
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatINR(costPerStudent)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{formatNumber(totalStudentsInScope)} students</span>
              {priorYearCostPerStudent > 0 && (
                <span style={{ fontWeight: 600, color: 'var(--brand)' }}>
                  PY: {formatINR(priorYearCostPerStudent)}
                </span>
              )}
            </div>
          </div>

          {/* M4: Cost / Training Day */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Cost / Training Day
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                <Calendar size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatINR(costPerTrainingDay)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{totalTrainingDaysInScope} active training days</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Run-Rate</span>
            </div>
          </div>

          {/* Covered Batches Count */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Covered Batches
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(6, 182, 212, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4' }}>
                <Building2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {activeBatchesInScope.length} Batches
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{availableColleges.length} Colleges</span>
              <span style={{ color: '#06B6D4', fontWeight: 600 }}>100% Tracked</span>
            </div>
          </div>

          {/* M15 & M16: Prior Year Benchmark */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                15. Prior Year Benchmark
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(236, 72, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatINR(priorYearTotalExpense)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>AY {comparisonYear}</span>
              <span style={{ fontWeight: 600, color: '#EC4899' }}>
                M16: {formatINR(priorYearCostPerStudent)} / stu
              </span>
            </div>
          </div>
        </div>

        {/* ── Navigation Tab Strip ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px',
            borderRadius: 12,
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            marginBottom: 24,
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'overview', label: 'Executive Overview', icon: PieChart },
            { id: 'batches', label: 'Batch Unit Economics (M5–M7, M13)', icon: Layers },
            { id: 'types-monthly', label: 'Expense Types & Monthly (M8–M11)', icon: BarChart3 },
            { id: 'travel', label: 'Travel Modality Intelligence (M14)', icon: Car },
            { id: 'matrix', label: 'Cross-Tab Heatmap Grid (M12)', icon: SlidersHorizontal },
            { id: 'yoy', label: 'YoY Academic Comparison (M15–M20)', icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  background: active ? 'var(--brand)' : 'transparent',
                  boxShadow: active ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: EXECUTIVE OVERVIEW
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
            {/* M9: Monthly Trajectory Area Chart */}
            <div
              style={{
                gridColumn: 'span 7',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    9. Monthly Expenses Trajectory
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Month-over-month expenditure trend and progression
                  </p>
                </div>
                <Badge tone="neutral">{monthlyProgression.length} Months Tracked</Badge>
              </div>

              {monthlyProgression.length > 0 ? (
                <div>
                  {/* Responsive SVG Area Chart */}
                  <svg viewBox="0 0 500 200" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid horizontal lines */}
                    <line x1="40" y1="30" x2="480" y2="30" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="40" y1="85" x2="480" y2="85" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="40" y1="140" x2="480" y2="140" stroke="var(--border)" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border)" opacity="0.8" />

                    {(() => {
                      const maxVal = Math.max(...monthlyProgression.map(m => m.total), 1);
                      const points = monthlyProgression.map((m, idx) => {
                        const x = 50 + (idx / Math.max(monthlyProgression.length - 1, 1)) * 420;
                        const y = 170 - (m.total / maxVal) * 140;
                        return { x, y, ...m };
                      });

                      const pathStr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const areaStr = `${pathStr} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;

                      return (
                        <>
                          <path d={areaStr} fill="url(#areaGradient)" />
                          <path d={pathStr} fill="none" stroke="#3B82F6" strokeWidth="2.5" />
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4.5" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2.5" />
                              <text x={p.x} y="185" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontWeight="600">
                                {p.monthLabel.split(' ')[0]}
                              </text>
                              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontWeight="700">
                                {formatINR(p.total)}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No monthly transactions recorded in selected filters.
                </div>
              )}
            </div>

            {/* M8: Expense Type Distribution (Interactive Donut) */}
            <div
              style={{
                gridColumn: 'span 5',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    8. Expense Type Share
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Distribution across food, tea, travel & supplies
                  </p>
                </div>
              </div>

              {/* Donut Chart and Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    {(() => {
                      let cumulativeAngle = 0;
                      const total = expenseTypeBreakdown.reduce((sum, t) => sum + t.amount, 0) || 1;
                      return expenseTypeBreakdown.slice(0, 6).map((t, idx) => {
                        const slicePct = t.amount / total;
                        const dashArray = `${slicePct * 251.2} 251.2`;
                        const dashOffset = -cumulativeAngle * 251.2;
                        cumulativeAngle += slicePct;
                        const color = PALETTE[idx % PALETTE.length];
                        return (
                          <circle
                            key={t.type}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke={color}
                            strokeWidth={hoveredDonutIdx === idx ? '16' : '13'}
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease' }}
                            onMouseEnter={() => setHoveredDonutIdx(idx)}
                            onMouseLeave={() => setHoveredDonutIdx(null)}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(totalExpenses)}</span>
                  </div>
                </div>

                {/* Legend */}
                <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {expenseTypeBreakdown.slice(0, 6).map((t, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    return (
                      <div
                        key={t.type}
                        onMouseEnter={() => setHoveredDonutIdx(idx)}
                        onMouseLeave={() => setHoveredDonutIdx(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          padding: '3px 6px',
                          borderRadius: 6,
                          background: hoveredDonutIdx === idx ? 'var(--bg-hover)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t.type}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(t.amount)}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>({t.sharePct.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* M13: Expense Concentration by Batch */}
            <div
              style={{
                gridColumn: 'span 12',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    13. Expense Concentration by Batch (% Share of Training Budget)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Identifies high-impact batches and capital allocation concentration across colleges
                  </p>
                </div>
                <Badge tone="neutral">Pareto Analysis</Badge>
              </div>

              {/* Concentration Stacked Progress Bar */}
              <div style={{ width: '100%', height: 20, borderRadius: 10, overflow: 'hidden', display: 'flex', background: 'var(--bg-sunken)', marginBottom: 16 }}>
                {batchAnalytics
                  .filter(b => b.totalExpense > 0)
                  .sort((a, b) => b.totalExpense - a.totalExpense)
                  .map((b, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    return (
                      <div
                        key={b.id}
                        title={`${b.code}: ${formatINR(b.totalExpense)} (${b.sharePct.toFixed(1)}%)`}
                        style={{
                          width: `${b.sharePct}%`,
                          height: '100%',
                          background: color,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    );
                  })}
              </div>

              {/* Top 5 Concentrated Batches Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {batchAnalytics
                  .filter(b => b.totalExpense > 0)
                  .sort((a, b) => b.totalExpense - a.totalExpense)
                  .slice(0, 5)
                  .map((b, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    return (
                      <div
                        key={b.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>
                            Rank #{idx + 1}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {b.sharePct.toFixed(1)}% Share
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.code}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>{b.college} ({b.studentCount} stu)</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(b.totalExpense)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: BATCH FINANCIALS & UNIT ECONOMICS (M5, M6, M7, M13)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'batches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search and Sort Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 14,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search batch code, college, program, course..."
                  value={batchSearch}
                  onChange={e => setBatchSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Sort By:</span>
                <select
                  value={batchSortField}
                  onChange={e => setBatchSortField(e.target.value as any)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="expense">Total Expense (M5)</option>
                  <option value="costPerStudent">Cost / Student (M6)</option>
                  <option value="costPerDay">Cost / Training Day (M7)</option>
                  <option value="students">Student Capacity</option>
                </select>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBatchSortAsc(!batchSortAsc)}
                  title="Toggle Ascending/Descending"
                >
                  <ArrowUpDown size={14} style={{ marginRight: 4 }} />
                  {batchSortAsc ? 'Asc' : 'Desc'}
                </Button>
              </div>
            </div>

            {/* M5, M6, M7 Comprehensive Batch Analytics Table */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Batch Code & College</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Program / Course</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>5. Total Expense</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Students</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>6. Cost / Student</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Days</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>7. Cost / Day</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>13. Budget Share</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Claims</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedBatches.length > 0 ? (
                      processedBatches.map(b => (
                        <tr
                          key={b.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.code}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.college} • {b.batchNo}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{b.course}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.program}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatINR(b.totalExpense)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <Badge tone={b.studentCount > 0 ? 'neutral' : 'warning'}>
                              {b.studentCount} stu
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: b.costPerStudent > 300 ? 'var(--status-danger)' : b.costPerStudent < 100 ? 'var(--status-success)' : 'var(--brand)',
                              }}
                            >
                              {formatINR(b.costPerStudent)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {b.trainingDays}d
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {formatINR(b.costPerDay)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <div style={{ width: 44, height: 6, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(b.sharePct, 100)}%`, height: '100%', background: 'var(--brand)' }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{b.sharePct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <Badge tone={b.claimsCount > 0 ? 'success' : 'neutral'}>
                              {b.claimsCount} claims
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No batches found matching filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: EXPENSE TYPES & MONTHLY BREAKDOWN (M8, M9, M10, M11)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'types-monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
            {/* M10: Monthly Expense by Expense Type (Stacked Visualization) */}
            <div
              style={{
                gridColumn: 'span 12',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    10. Monthly Expense by Expense Type (Stacked Breakdown)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Granular monthly spend composition across tea, lunch, travel & stationery
                  </p>
                </div>
              </div>

              {monthlyProgression.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {monthlyProgression.map(m => {
                    const topTypes = Object.entries(m.types)
                      .map(([t, amt]) => ({ type: t, amount: amt }))
                      .sort((a, b) => b.amount - a.amount);

                    return (
                      <div key={m.monthKey} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.monthLabel}</span>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatINR(m.total)} ({m.count} claims)
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div style={{ width: '100%', height: 16, borderRadius: 8, overflow: 'hidden', display: 'flex', background: 'var(--bg-sunken)' }}>
                          {topTypes.map((t, idx) => {
                            const pct = m.total > 0 ? (t.amount / m.total) * 100 : 0;
                            const color = PALETTE[idx % PALETTE.length];
                            return (
                              <div
                                key={t.type}
                                title={`${t.type}: ${formatINR(t.amount)} (${pct.toFixed(1)}%)`}
                                style={{ width: `${pct}%`, height: '100%', background: color }}
                              />
                            );
                          })}
                        </div>
                        {/* Mini pill legend for this month */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                          {topTypes.slice(0, 5).map((t, idx) => (
                            <span key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE[idx % PALETTE.length] }} />
                              {t.type}: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(t.amount)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No monthly transactions in current scope.
                </div>
              )}
            </div>

            {/* M11: Expense by Employees Leaderboard */}
            <div
              style={{
                gridColumn: 'span 6',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    11. Expense by Employees / Trainers
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Reimbursements claimed per staff member
                  </p>
                </div>
                <Badge tone="neutral">{employeeLeaderboard.length} Claimants</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                {employeeLeaderboard.map((emp, idx) => (
                  <div
                    key={emp.name}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--brand-muted)',
                          color: 'var(--brand)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {emp.role} • {emp.claimsCount} claims • Avg: {formatINR(emp.avgClaim)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(emp.totalAmount)}</div>
                      <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 600 }}>{emp.sharePct.toFixed(1)}% Share</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* M8: Detailed Expense Types Table */}
            <div
              style={{
                gridColumn: 'span 6',
                padding: '20px 24px',
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    8. Expense Type Summary Table
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Ranked expenditure by sub-category
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)' }}>Type</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)' }}>Category</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Claims</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseTypeBreakdown.map(t => (
                      <tr key={t.type} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.type}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{t.category}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(t.amount)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{t.claimsCount}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--brand)' }}>{t.sharePct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 4: TRAVEL MODALITY INTELLIGENCE (M14)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'travel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Travel Summary Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {/* Bike Self Travel */}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3B82F6', marginBottom: 6 }}>
                  <Car size={18} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Self Travel (Bike)</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.selfTravelBikeAmount, 0))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatNumber(travelModalityAnalytics.reduce((s, t) => s + t.selfTravelBikeKm, 0))} Total Kilometers
                </div>
              </div>

              {/* Car Self Travel */}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', marginBottom: 6 }}>
                  <Car size={18} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Self Travel (Car)</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.selfTravelCarAmount, 0))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatNumber(travelModalityAnalytics.reduce((s, t) => s + t.selfTravelCarKm, 0))} Total Kilometers
                </div>
              </div>

              {/* Public Bus */}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F59E0B', marginBottom: 6 }}>
                  <Bus size={18} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Bus & Public Transit</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.busAmount, 0))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Cost-effective group transit
                </div>
              </div>

              {/* Auto & Cabs */}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B5CF6', marginBottom: 6 }}>
                  <Car size={18} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Auto & Cabs (Uber)</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.autoAmount + t.uberAmount, 0))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Auto: {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.autoAmount, 0))} • Uber: {formatINR(travelModalityAnalytics.reduce((s, t) => s + t.uberAmount, 0))}
                </div>
              </div>
            </div>

            {/* Batch-by-Batch Travel Comparison Table */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  14. Travel Expense Comparison Across Training Batches
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Compares modal choices (Bike vs Car vs Bus vs Cabs) across institutions to optimize routing costs
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Batch Code & College</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Bike (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Car (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Bus (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Metro (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Auto (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Uber (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Total Travel</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Travel %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {travelModalityAnalytics.map(t => (
                      <tr key={t.batchId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.batchCode}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.college}</div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.selfTravelBikeAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.selfTravelBikeAmount > 0 ? `${formatINR(t.selfTravelBikeAmount)} (${t.selfTravelBikeKm}km)` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.selfTravelCarAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.selfTravelCarAmount > 0 ? `${formatINR(t.selfTravelCarAmount)} (${t.selfTravelCarKm}km)` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.busAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.busAmount > 0 ? formatINR(t.busAmount) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.metroAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.metroAmount > 0 ? formatINR(t.metroAmount) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.autoAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.autoAmount > 0 ? formatINR(t.autoAmount) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: t.uberAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {t.uberAmount > 0 ? formatINR(t.uberAmount) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatINR(t.totalTravelAmount)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <Badge tone={t.travelSharePct > 60 ? 'warning' : 'neutral'}>
                            {t.travelSharePct.toFixed(0)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 5: CROSS-TAB MATRIX HEATMAP GRID (M12)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'matrix' && (
          <div
            style={{
              borderRadius: 16,
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  12. Expense by Expense Type and Batch (2D Cross-Tab Heatmap Grid)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Interactive multi-dimensional matrix showing exact expense type costs incurred by each batch
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Heatmap:</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', fontWeight: 600 }}>Low</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.35)', color: '#1E40AF', fontWeight: 700 }}>Medium</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.7)', color: '#FFFFFF', fontWeight: 800 }}>High Intensity</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 600 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 2, minWidth: 240 }}>
                      Training Batch Code
                    </th>
                    {matrixData.types.map(tName => (
                      <th key={tName} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-muted)', minWidth: 100 }}>
                        {tName}
                      </th>
                    ))}
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)', minWidth: 120 }}>
                      Batch Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.batches.map(bCode => {
                    const rowTotal = matrixData.batchTotals[bCode] || 0;
                    return (
                      <tr key={bCode} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td
                          style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            position: 'sticky',
                            left: 0,
                            background: 'var(--bg-surface)',
                            zIndex: 1,
                            borderRight: '1px solid var(--border)',
                          }}
                        >
                          {bCode}
                        </td>
                        {matrixData.types.map(tName => {
                          const val = matrixData.matrix[bCode]?.[tName] || 0;
                          const intensity = val > 0 ? Math.min(val / matrixData.maxCellVal, 1) : 0;
                          const bg = intensity > 0 ? `rgba(59, 130, 246, ${Math.max(intensity * 0.7, 0.08)})` : 'transparent';
                          const textColor = intensity > 0.4 ? '#FFFFFF' : val > 0 ? 'var(--text-primary)' : 'var(--text-disabled)';

                          return (
                            <td
                              key={tName}
                              style={{
                                padding: '10px 12px',
                                background: bg,
                                color: textColor,
                                fontWeight: val > 0 ? 600 : 400,
                                borderRight: '1px solid rgba(0,0,0,0.03)',
                              }}
                            >
                              {val > 0 ? formatINR(val) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)', background: 'var(--bg-sunken)' }}>
                          {formatINR(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand Totals Row */}
                  <tr style={{ background: 'var(--bg-sunken)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td style={{ padding: '12px 14px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 2, color: 'var(--text-primary)' }}>
                      TOTAL BY EXPENSE TYPE
                    </td>
                    {matrixData.types.map(tName => (
                      <td key={tName} style={{ padding: '12px 12px', color: 'var(--brand)' }}>
                        {formatINR(matrixData.typeTotals[tName] || 0)}
                      </td>
                    ))}
                    <td style={{ padding: '12px 14px', color: '#10B981', fontSize: 13 }}>
                      {formatINR(matrixData.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 6: PRIOR-YEAR (YOY) ACADEMIC COMPARISON (M15–M20)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'yoy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Banner explaining Decision 2 logic */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Sparkles size={24} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Prior-Year Matching Key: [College Name] + [Program / Stream] + [Program / Course]
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Comparing <strong>AY {academicYear}</strong> vs <strong>AY {comparisonYear}</strong>.
                  Matches recurring academic batches to assess annual inflation, student unit cost changes, and batch efficiency across academic cycles.
                </p>
              </div>
            </div>

            {/* Top YoY Comparative Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  15. Current vs Prior Expense
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(totalExpenses)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs {formatINR(priorYearTotalExpense)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: yoyExpenseDiff > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                  {yoyExpenseDiff > 0 ? '+' : ''}{formatINR(yoyExpenseDiff)} ({yoyExpenseGrowthPct.toFixed(1)}%)
                </div>
              </div>

              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  16. Cost Per Student Variance
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(costPerStudent)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs {formatINR(priorYearCostPerStudent)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>
                  {formatINR(costPerStudent - priorYearCostPerStudent)} diff / student
                </div>
              </div>

              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Tracked Programs
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  {yoyComparisonData.length} Matched Sets
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  Matching College + Stream + Course
                </div>
              </div>
            </div>

            {/* M20: Matched Comparative Program Table */}
            <div
              style={{
                borderRadius: 16,
                background: 'var(--bg-surface)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  20. Batch-to-Batch Prior Year Matched Comparison Table
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Granular YoY comparison by College Name, Program / Stream & Course
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>College & Stream</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Course</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Current Expense ({academicYear})</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Current Cost/Stu</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Prior Expense ({comparisonYear})</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Prior Cost/Stu</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>19. Variance (₹)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>YoY Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yoyComparisonData.length > 0 ? (
                      yoyComparisonData.map(y => (
                        <tr key={y.key} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{y.college}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{y.program}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {y.course}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatINR(y.currentExpense)}
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{y.currentStudents} stu</div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--brand)' }}>
                            {formatINR(y.currentCostPerStudent)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {y.priorExpense > 0 ? formatINR(y.priorExpense) : '—'}
                            {y.priorStudents > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{y.priorStudents} stu</div>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {y.priorCostPerStudent > 0 ? formatINR(y.priorCostPerStudent) : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: y.varianceAmount > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                            {y.priorExpense > 0 ? (
                              `${y.varianceAmount > 0 ? '+' : ''}${formatINR(y.varianceAmount)}`
                            ) : (
                              'Baseline'
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {y.priorExpense > 0 ? (
                              <Badge tone={y.growthPct > 0 ? 'danger' : 'success'}>
                                {y.growthPct > 0 ? '+' : ''}{y.growthPct.toFixed(1)}%
                              </Badge>
                            ) : (
                              <Badge tone="neutral">New in {academicYear}</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No matched batches found for selected comparison parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
export default ExpenseAnalyticsPage;
