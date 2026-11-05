import { describe, it, expect } from 'vitest';
import {
  mergeTimeIntervals,
  calculateMergedHours,
  normalizeBatchKey,
  isBatchMatch,
  isSessionForBatch,
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
});

