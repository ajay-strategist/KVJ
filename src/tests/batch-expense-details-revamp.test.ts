import { describe, it, expect } from 'vitest';
import {
  mergeTimeIntervals,
  calculateMergedHours,
  normalizeBatchKey,
  isBatchMatch,
  isSessionForBatch,
  calculateExpensePivotTable,
  ExpenseRow,
  TimeInterval,
} from '../modules/training/components/BatchExpenseDetailsDrawer';

describe('BatchExpenseDetailsDrawer Revamp & Calculations', () => {
  describe('Batch Workhours & Interval Merging (REQ-02)', () => {
    it('Scenario A: Simultaneous Trainers (overlapping hours merged)', () => {
      // Trainer A: 09:00 - 15:00 (540 to 900)
      // Trainer B: 09:00 - 15:00 (540 to 900)
      const intervals: TimeInterval[] = [
        { start: 9 * 60, end: 15 * 60 },
        { start: 9 * 60, end: 15 * 60 },
      ];
      const merged = mergeTimeIntervals(intervals);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ start: 540, end: 900 });

      const batchWorkhours = calculateMergedHours(intervals);
      expect(batchWorkhours).toBe(6);

      // Total Man-hours must sum individual durations: 6 + 6 = 12h
      const individualDurations = intervals.map((i) => (i.end - i.start) / 60);
      const totalManHours = individualDurations.reduce((a, b) => a + b, 0);
      expect(totalManHours).toBe(12);
      expect(batchWorkhours).not.toBe(totalManHours);
    });

    it('Scenario B: Sequential Trainers (contiguous intervals joined)', () => {
      // Trainer A: 09:00 - 13:00 (540 to 780)
      // Trainer B: 13:00 - 16:00 (780 to 960)
      const intervals: TimeInterval[] = [
        { start: 9 * 60, end: 13 * 60 },
        { start: 13 * 60, end: 16 * 60 },
      ];
      const merged = mergeTimeIntervals(intervals);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ start: 540, end: 960 });

      const batchWorkhours = calculateMergedHours(intervals);
      expect(batchWorkhours).toBe(7);

      const totalManHours = intervals.reduce((sum, i) => sum + (i.end - i.start) / 60, 0);
      expect(totalManHours).toBe(7);
    });

    it('Scenario C: Different Clock-Out Times (longer duration covers earlier departure)', () => {
      // Trainer A: 09:00 - 16:00 (540 to 960)
      // Trainer B: 09:00 - 12:00 (540 to 720)
      const intervals: TimeInterval[] = [
        { start: 9 * 60, end: 16 * 60 },
        { start: 9 * 60, end: 12 * 60 },
      ];
      const merged = mergeTimeIntervals(intervals);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({ start: 540, end: 960 });

      const batchWorkhours = calculateMergedHours(intervals);
      expect(batchWorkhours).toBe(7);

      const totalManHours = intervals.reduce((sum, i) => sum + (i.end - i.start) / 60, 0);
      expect(totalManHours).toBe(10); // 7 + 3 = 10
    });

    it('handles multiple non-overlapping periods on the same day correctly', () => {
      // Morning session: 09:00 - 12:00 (3h)
      // Afternoon session: 14:00 - 17:00 (3h)
      const intervals: TimeInterval[] = [
        { start: 9 * 60, end: 12 * 60 },
        { start: 14 * 60, end: 17 * 60 },
      ];
      const merged = mergeTimeIntervals(intervals);
      expect(merged).toHaveLength(2);
      expect(calculateMergedHours(intervals)).toBe(6);
    });

    it('safely handles empty intervals', () => {
      expect(mergeTimeIntervals([])).toEqual([]);
      expect(calculateMergedHours([])).toBe(0);
    });
  });

  describe('Batch Key Normalization & Matching (REQ-01 & Anti-leakage)', () => {
    it('normalizes training batch names with prefixes', () => {
      expect(normalizeBatchKey('Training: MIM - UG - 2026 - 2027 - Batch 1')).toBe('mimugb1');
      expect(normalizeBatchKey('Class: MIM - UG - Batch 1')).toBe('mimugb1');
      expect(normalizeBatchKey('MIM - UG - Batch 1')).toBe('mimugb1');
    });

    it('matches work session work_type to batch correctly', () => {
      const ws = { work_type: 'Training: MIM - UG - 2026 - 2027 - Batch 1', notes: '' };
      expect(isSessionForBatch(ws, 'MIM - UG - 2026 - 2027 - Batch 1')).toBe(true);
      expect(isSessionForBatch(ws, 'SJCE - MCA - 2026 - 2027 - Batch 1')).toBe(false);
    });

    it('matches work session notes to batch correctly', () => {
      const ws = { work_type: 'Training', notes: 'Location: MIM - UG - Batch 1' };
      expect(isSessionForBatch(ws, 'MIM - UG - 2026 - 2027 - Batch 1')).toBe(true);
      expect(isSessionForBatch(ws, 'Other College - Batch 2')).toBe(false);
    });
  });

  describe('KPI Calculations & Zero Division Protection', () => {
    it('protects Cost Per Student against division by zero', () => {
      const totalExpense = 50000;
      const zeroStudents = 0;
      const costPerStudent = zeroStudents > 0 ? totalExpense / zeroStudents : 0;
      expect(costPerStudent).toBe(0);
    });

    it('calculates Cost Per Student accurately with valid student count', () => {
      const totalExpense = 50000;
      const students = 50;
      const costPerStudent = students > 0 ? totalExpense / students : 0;
      expect(costPerStudent).toBe(1000);
    });

    it('protects Avg Expense Per Day against division by zero', () => {
      const totalExpense = 50000;
      const zeroDays = 0;
      const avgExpensePerDay = zeroDays > 0 ? totalExpense / zeroDays : 0;
      expect(avgExpensePerDay).toBe(0);
    });

    it('calculates Avg Expense Per Day accurately with unique training dates', () => {
      const totalExpense = 50000;
      const uniqueTrainingDays = 5;
      const avgExpensePerDay = uniqueTrainingDays > 0 ? totalExpense / uniqueTrainingDays : 0;
      expect(avgExpensePerDay).toBe(10000);
    });
  });

  describe('Trainer & Submitter Allocation — Excel Pivot Table Breakdown', () => {
    const mockExpenses: ExpenseRow[] = [
      // Linto George: 6 claims, total ₹3,469
      { id: '1', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Metro', category: 'Training Expense', amount: 50, submittedBy: 'Linto George', status: 'approved' },
      { id: '2', date: '27/10/2026', rawDate: '2026-10-27', expenseType: 'Self Travel', category: 'Training Expense', amount: 1045, submittedBy: 'Linto George', status: 'approved' },
      { id: '3', date: '28/10/2026', rawDate: '2026-10-28', expenseType: 'Self Travel', category: 'Training Expense', amount: 1045, submittedBy: 'Linto George', status: 'approved' },
      { id: '4', date: '29/10/2026', rawDate: '2026-10-29', expenseType: 'Self Travel', category: 'Training Expense', amount: 1249, submittedBy: 'Linto George', status: 'approved' },
      { id: '5', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Evening Tea', category: 'Training Expense', amount: 40, submittedBy: 'Linto George', status: 'approved' },
      { id: '6', date: '27/10/2026', rawDate: '2026-10-27', expenseType: 'Evening Tea', category: 'Training Expense', amount: 40, submittedBy: 'Linto George', status: 'approved' },

      // Ajay Thomas: 2 claims, total ₹3,192
      { id: '7', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Self Travel', category: 'Training Expense', amount: 1596, submittedBy: 'Ajay Thomas', status: 'approved' },
      { id: '8', date: '27/10/2026', rawDate: '2026-10-27', expenseType: 'Self Travel', category: 'Training Expense', amount: 1596, submittedBy: 'Ajay Thomas', status: 'approved' },

      // Jomon Joseph: 2 claims, total ₹843
      { id: '9', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Self Travel', category: 'Training Expense', amount: 800, submittedBy: 'Jomon Joseph', status: 'approved' },
      { id: '10', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Morning Tea', category: 'Training Expense', amount: 43, submittedBy: 'Jomon Joseph', status: 'approved' },

      // Anoop Baiju: 3 claims, total ₹355
      { id: '11', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Auto', category: 'Training Expense', amount: 150, submittedBy: 'Anoop Baiju', status: 'approved' },
      { id: '12', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Bus', category: 'Training Expense', amount: 120, submittedBy: 'Anoop Baiju', status: 'approved' },
      { id: '13', date: '26/10/2026', rawDate: '2026-10-26', expenseType: 'Evening Tea', category: 'Training Expense', amount: 85, submittedBy: 'Anoop Baiju', status: 'approved' },
    ];

    it('calculates employee level totals and % of Grand Total correctly', () => {
      const grandTotal = 3469 + 3192 + 843 + 355; // 7859
      const pivot = calculateExpensePivotTable(mockExpenses, grandTotal);

      expect(pivot.grandTotal).toBe(7859);
      expect(pivot.totalClaimsCount).toBe(13);
      expect(pivot.rows).toHaveLength(4);

      // 1. Linto George
      const linto = pivot.rows[0];
      expect(linto.employeeName).toBe('Linto George');
      expect(linto.amount).toBe(3469);
      expect(linto.claimsCount).toBe(6);
      expect(linto.percentOfRowTotal).toBe(100.0);
      expect(linto.percentOfGrandTotal).toBeCloseTo((3469 / 7859) * 100, 1);

      // 2. Ajay Thomas
      const ajay = pivot.rows[1];
      expect(ajay.employeeName).toBe('Ajay Thomas');
      expect(ajay.amount).toBe(3192);
      expect(ajay.claimsCount).toBe(2);
      expect(ajay.percentOfRowTotal).toBe(100.0);
      expect(ajay.percentOfGrandTotal).toBeCloseTo((3192 / 7859) * 100, 1);

      // 3. Jomon Joseph
      const jomon = pivot.rows[2];
      expect(jomon.employeeName).toBe('Jomon Joseph');
      expect(jomon.amount).toBe(843);
      expect(jomon.percentOfGrandTotal).toBeCloseTo((843 / 7859) * 100, 1);

      // 4. Anoop Baiju
      const anoop = pivot.rows[3];
      expect(anoop.employeeName).toBe('Anoop Baiju');
      expect(anoop.amount).toBe(355);
      expect(anoop.percentOfGrandTotal).toBeCloseTo((355 / 7859) * 100, 1);
    });

    it('correctly nests categories under each employee with % of Row Total and % of Grand Total', () => {
      const grandTotal = 7859;
      const pivot = calculateExpensePivotTable(mockExpenses, grandTotal);
      const linto = pivot.rows[0];

      // Categories under Linto: Self Travel (3339), Evening Tea (80), Metro (50)
      expect(linto.categories).toHaveLength(3);

      const selfTravel = linto.categories.find((c) => c.category === 'Self Travel')!;
      expect(selfTravel).toBeDefined();
      expect(selfTravel.amount).toBe(3339);
      expect(selfTravel.claimsCount).toBe(3);
      // % of Row Total = Category Amount / Linto Total * 100
      expect(selfTravel.percentOfRowTotal).toBeCloseTo((3339 / 3469) * 100, 1);
      // % of Grand Total = Category Amount / Grand Total * 100
      expect(selfTravel.percentOfGrandTotal).toBeCloseTo((3339 / 7859) * 100, 1);

      const eveningTea = linto.categories.find((c) => c.category === 'Evening Tea')!;
      expect(eveningTea.amount).toBe(80);
      expect(eveningTea.claimsCount).toBe(2);
      expect(eveningTea.percentOfRowTotal).toBeCloseTo((80 / 3469) * 100, 1);
      expect(eveningTea.percentOfGrandTotal).toBeCloseTo((80 / 7859) * 100, 1);

      const metro = linto.categories.find((c) => c.category === 'Metro')!;
      expect(metro.amount).toBe(50);
      expect(metro.claimsCount).toBe(1);
      expect(metro.percentOfRowTotal).toBeCloseTo((50 / 3469) * 100, 1);
      expect(metro.percentOfGrandTotal).toBeCloseTo((50 / 7859) * 100, 1);

      // The sum of % of Row Total across categories under Linto must equal 100%
      const sumCategoryRowPercentages = linto.categories.reduce((s, c) => s + c.percentOfRowTotal, 0);
      expect(sumCategoryRowPercentages).toBeCloseTo(100.0, 1);
    });

    it('handles empty expense list safely without division by zero', () => {
      const emptyPivot = calculateExpensePivotTable([], 0);
      expect(emptyPivot.grandTotal).toBe(0);
      expect(emptyPivot.rows).toEqual([]);
      expect(emptyPivot.percentOfGrandTotal).toBe(100.0);
    });
  });
});

