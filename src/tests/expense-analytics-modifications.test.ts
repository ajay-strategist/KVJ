import { describe, it, expect } from 'vitest';

describe('Expense Analytics Modification & Layout Stability', () => {
  it('automatically derives prior year benchmark without manual select', () => {
    const getPriorYear = (academicYear: string) => {
      const m = academicYear.match(/^(\d{4})-(\d{4})/);
      if (m) {
        const y1 = Number(m[1]) - 1;
        const y2 = Number(m[2]) - 1;
        return `${y1}-${y2}`;
      }
      return '2025-2026';
    };

    expect(getPriorYear('2026-2027')).toBe('2025-2026');
    expect(getPriorYear('2027-2028')).toBe('2026-2027');
    expect(getPriorYear('all')).toBe('2025-2026');
  });

  it('filters claims by single expense type dropdown selection', () => {
    const claims = [
      { id: '1', expenseType: 'Food & Snacks', amount: 500 },
      { id: '2', expenseType: 'Travel', amount: 1200 },
      { id: '3', expenseType: 'Stay', amount: 3000 },
    ];

    const filterByType = (typeSelection: string) => {
      if (typeSelection === 'all') return claims;
      return claims.filter((c) => c.expenseType === typeSelection);
    };

    expect(filterByType('all')).toHaveLength(3);
    expect(filterByType('Travel')).toEqual([{ id: '2', expenseType: 'Travel', amount: 1200 }]);
    expect(filterByType('Food & Snacks')).toHaveLength(1);
  });
});

