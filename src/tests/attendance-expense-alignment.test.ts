import { describe, it, expect } from 'vitest';
import { getExpenseClaimDate } from '../modules/attendance/pages/AttendanceLogPage';

describe('Attendance Log & Expense Summary Alignment', () => {
  it('correctly extracts expense date from JSON notes, expenseDate, or createdAt', () => {
    // 1. JSON notes with expenseDate
    const claimWithJson = {
      id: 'claim-1',
      amount: 798,
      notes: JSON.stringify({
        personName: 'Ajay Thomas',
        expenseType: 'Self Travel',
        expenseDate: '2026-10-21',
      }),
      createdAt: '2026-10-25T10:00:00Z',
    };
    expect(getExpenseClaimDate(claimWithJson)).toBe('2026-10-21');

    // 2. Direct expenseDate field
    const claimWithDirectDate = {
      id: 'claim-2',
      amount: 80,
      expenseDate: '2026-10-22',
      createdAt: '2026-10-22T12:00:00Z',
    };
    expect(getExpenseClaimDate(claimWithDirectDate)).toBe('2026-10-22');

    // 3. Fallback to createdAt
    const claimFallback = {
      id: 'claim-3',
      amount: 50,
      createdAt: '2026-10-24T12:00:00Z',
    };
    expect(getExpenseClaimDate(claimFallback)).toBe('2026-10-24');
  });

  it('ensures days without an attendance record still retain their expenses in calendar days', () => {
    // Simulating October 2026 claims:
    // Notice 2026-10-21 had a 798 travel expense, but the employee did not clock in on that day
    const claimList = [
      { id: '1', amount: 589, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-03' }) },
      { id: '2', amount: 589, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-03' }) },
      { id: '3', amount: 156, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-07' }) },
      { id: '4', amount: 15, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-07' }) },
      { id: '5', amount: 48, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-08' }) },
      { id: '6', amount: 798, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-21' }) }, // travel day, no clock-in
      { id: '7', amount: 80, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-22' }) },
      { id: '8', amount: 798, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-23' }) },
      { id: '9', amount: 105, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-24' }) },
      { id: '10', amount: 330, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-24' }) },
      { id: '11', amount: 201, status: 'approved', notes: JSON.stringify({ expenseDate: '2026-10-24' }) },
    ];

    // Attendance records only exist for days when employee clocked in (2026-10-21 is absent)
    const recList = [
      { workDate: '2026-10-03' },
      { workDate: '2026-10-07' },
      { workDate: '2026-10-08' },
      // 2026-10-21 is NOT in attendance records!
      { workDate: '2026-10-22' },
      { workDate: '2026-10-23' },
      { workDate: '2026-10-24' },
    ];

    const days: Array<{ date: string; hasRecord: boolean; expenses: string }> = [];
    const dates = [
      '2026-10-03', '2026-10-07', '2026-10-08', '2026-10-21',
      '2026-10-22', '2026-10-23', '2026-10-24',
    ];

    for (const dateStr of dates) {
      const record = recList.find((r) => r.workDate === dateStr);
      const dayClaims = claimList.filter(
        (c) => (c.status || '').toLowerCase() === 'approved' && getExpenseClaimDate(c) === dateStr
      );
      const dayExpensesSum = dayClaims.reduce((sum, c) => sum + (c.amount || 0), 0);

      if (record) {
        days.push({
          date: dateStr,
          hasRecord: true,
          expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '',
        });
      } else {
        // Even without an attendance record, daily expenses must NOT be blanked out
        days.push({
          date: dateStr,
          hasRecord: false,
          expenses: dayExpensesSum > 0 ? `₹ ${dayExpensesSum.toFixed(2)}` : '',
        });
      }
    }

    // Oct 21 must have the 798.00 expense recorded even with hasRecord = false
    const oct21 = days.find((d) => d.date === '2026-10-21');
    expect(oct21?.hasRecord).toBe(false);
    expect(oct21?.expenses).toBe('₹ 798.00');

    // Total expenses across calendar days must equal total claimed expenses
    const totalFromDays = days.reduce((sum, d) => {
      const amt = parseFloat(d.expenses.replace(/[^\d.]/g, '')) || 0;
      return sum + amt;
    }, 0);

    const totalFromClaims = claimList.reduce((sum, c) => sum + c.amount, 0);

    expect(totalFromClaims).toBe(3709);
    expect(totalFromDays).toBe(3709);
  });
});

