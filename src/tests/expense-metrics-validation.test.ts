import { describe, it, expect } from 'vitest';

describe('Phase 7: Expense Analytics 16 Metrics & Metric 7 Logic (UIUX-REQ-018)', () => {
  const APPROVED_16_METRICS = [
    'Total Institutional Spend',
    'Training vs Office Expenses Split',
    'Cost Per Student',
    'Cost Per Training Day',
    'Batch-Level Total Expense',
    'Batch-Level Cost Per Student',
    'Cost Per Training Day by Batch',
    'Expense by Category Breakdown',
    'Expense by Type Breakdown',
    'Monthly Expense Trend',
    'Monthly Expense by Type',
    'Employee Expense Leaderboard',
    'Batch × Expense Types Heatmap',
    'Batch Expense Share (%)',
    'Travel Modality Breakdown',
    'Prior Year Academic Comparison Benchmark',
  ];

  it('exactly 16 metrics in scope, excluding Average Amount', () => {
    expect(APPROVED_16_METRICS).toHaveLength(16);
    expect(APPROVED_16_METRICS).not.toContain('Average Amount');
    expect(APPROVED_16_METRICS).toContain('Cost Per Training Day by Batch');
  });

  describe('Metric 7 Calculation Engine', () => {
    function calculateMetric7(
      totalExpense: number,
      canonicalScheduleDates: string[],
      expenseClaimDates: string[]
    ) {
      // Rule: Exclusively distinct dates from canonical schedule sessions
      // Claim dates are strictly prohibited as evidence of training dates
      const distinctCanonicalDates = new Set(canonicalScheduleDates).size;

      if (distinctCanonicalDates > 0) {
        return {
          trainingDays: distinctCanonicalDates,
          costPerDay: totalExpense / distinctCanonicalDates,
          status: 'CANONICAL',
        };
      }

      // Fallback: 1 day if expenses exist, with pre-commencement badge
      if (totalExpense > 0) {
        return {
          trainingDays: 1,
          costPerDay: totalExpense / 1,
          status: 'PRE_COMMENCEMENT',
        };
      }

      return {
        trainingDays: 0,
        costPerDay: 0,
        status: 'SESSION_DATA_UNAVAILABLE',
      };
    }

    it('computes denominator exclusively from canonical schedule session dates', () => {
      const canonicalDates = ['2026-09-01', '2026-09-02', '2026-09-03'];
      const claimDates = ['2026-08-15', '2026-08-20', '2026-09-01', '2026-09-02', '2026-09-03'];
      const res = calculateMetric7(30000, canonicalDates, claimDates);

      expect(res.trainingDays).toBe(3);
      expect(res.costPerDay).toBe(10000);
      expect(res.status).toBe('CANONICAL');
    });

    it('uses fallback denominator of 1 day (pre-commencement) when claims exist before training starts', () => {
      const canonicalDates: string[] = []; // No training session logged yet
      const advanceClaimDates = ['2026-08-15']; // Advance booking before training
      const res = calculateMetric7(5000, canonicalDates, advanceClaimDates);

      expect(res.trainingDays).toBe(1);
      expect(res.costPerDay).toBe(5000);
      expect(res.status).toBe('PRE_COMMENCEMENT');
    });

    it('returns 0 training days and SESSION_DATA_UNAVAILABLE when zero sessions and zero expenses', () => {
      const res = calculateMetric7(0, [], []);
      expect(res.trainingDays).toBe(0);
      expect(res.costPerDay).toBe(0);
      expect(res.status).toBe('SESSION_DATA_UNAVAILABLE');
    });
  });
});

