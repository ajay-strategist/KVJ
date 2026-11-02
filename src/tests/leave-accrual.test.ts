import { describe, it, expect } from 'vitest';
import { calculateEarnedLeaveAllocation } from '../shared/utils/leaveAccrual';

describe('Leave Accrual & Balance Calculations (BR-LEAVE-011 & ISSUE-011)', () => {
  it('awards standard months to an employee who joined before current FY', () => {
    // Current FY started 2026-04-01. As of 2026-09-15 (6 months: Apr, May, Jun, Jul, Aug, Sep)
    const earned = calculateEarnedLeaveAllocation({
      dateOfJoining: '2025-01-10',
      probationEndDate: '2025-04-10',
      allocationPerMonth: 1,
      asOfDate: '2026-09-15',
    });
    expect(earned).toBe(6);
  });

  it('calculates pro-rata quota for an employee who joined mid-year (ISSUE-011 fix)', () => {
    // Employee joined 2026-07-01. As of 2026-09-15 (3 months: Jul, Aug, Sep)
    // Previously, flawed logic awarded 6 months from April 1!
    const earned = calculateEarnedLeaveAllocation({
      dateOfJoining: '2026-07-01',
      probationEndDate: null,
      allocationPerMonth: 1,
      asOfDate: '2026-09-15',
    });
    expect(earned).toBe(3);
  });

  it('holds accrual until after probation completion (EMP-Q01 & BR-EMP-002)', () => {
    // Employee joined 2026-04-01, probation ends 2026-06-30 (completion date 2026-07-01).
    // As of 2026-05-15 (still on probation): 0 earned leaves
    const earnedDuringProbation = calculateEarnedLeaveAllocation({
      dateOfJoining: '2026-04-01',
      probationEndDate: '2026-06-30',
      allocationPerMonth: 1,
      asOfDate: '2026-05-15',
    });
    expect(earnedDuringProbation).toBe(0);

    // As of 2026-09-15 (Jul, Aug, Sep = 3 months earned after probation completion)
    const earnedPostProbation = calculateEarnedLeaveAllocation({
      dateOfJoining: '2026-04-01',
      probationEndDate: '2026-06-30',
      allocationPerMonth: 1,
      asOfDate: '2026-09-15',
    });
    expect(earnedPostProbation).toBe(3);
  });

  it('returns 0 when employee joining date is in the future relative to asOfDate', () => {
    const earned = calculateEarnedLeaveAllocation({
      dateOfJoining: '2026-11-01',
      asOfDate: '2026-09-15',
    });
    expect(earned).toBe(0);
  });
});

