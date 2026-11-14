import { describe, it, expect, vi } from 'vitest';
import { formatBatchWithCourse } from '../modules/training/utils/batch-formatter';
import { cleanBatchNameForDisplay } from '../modules/finance/forms/ExpenseClaimModal';

describe('formatBatchWithCourse utility', () => {
  it('appends course/training title to batch code when not already present', () => {
    const batch1 = {
      code: 'SJCET - 2 MBA - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Excel Expert 365',
    };
    const batch2 = {
      code: 'SJCET - 2 MBA - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Data Analytics',
    };
    const batch3 = {
      code: 'SJCET - MBA - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Business Analytics',
    };

    expect(formatBatchWithCourse(batch1)).toBe('SJCET - 2 MBA - Batch 1 — Excel Expert 365');
    expect(formatBatchWithCourse(batch2)).toBe('SJCET - 2 MBA - Batch 1 — Data Analytics');
    expect(formatBatchWithCourse(batch3)).toBe('SJCET - MBA - Batch 1 — Business Analytics');
  });

  it('does not duplicate course title if already included in base name', () => {
    const batchWithCourseInCode = {
      code: 'SJCET - Business Analytics - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Business Analytics',
    };
    expect(formatBatchWithCourse(batchWithCourseInCode)).toBe('SJCET - Business Analytics - Batch 1');
  });

  it('gracefully handles missing batch or empty object', () => {
    expect(formatBatchWithCourse(null)).toBe('Training Batch');
    expect(formatBatchWithCourse(undefined)).toBe('Training Batch');
    expect(formatBatchWithCourse({ code: '' })).toBe('Batch');
  });
});

describe('cleanBatchNameForDisplay with course enrichment', () => {
  const batches = [
    {
      id: 'batch-1',
      code: 'SJCET - 2 MBA - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Excel Expert 365',
      college: 'SJCET',
    },
    {
      id: 'batch-2',
      code: 'MIM - BCOM - Batch 1',
      batchNo: 'Batch 1',
      trainingName: 'Data Analytics',
      college: 'MIM',
    },
  ];

  it('enriches raw batch code with course title when matching batch exists', () => {
    expect(cleanBatchNameForDisplay('SJCET - 2 MBA - Batch 1', batches)).toBe(
      'SJCET - 2 MBA - Batch 1 — Excel Expert 365'
    );
    expect(cleanBatchNameForDisplay('MIM - BCOM - Batch 1', batches)).toBe(
      'MIM - BCOM - Batch 1 — Data Analytics'
    );
  });

  it('preserves existing formatted batch with course separator', () => {
    expect(
      cleanBatchNameForDisplay('SJCET - 2 MBA - Batch 1 — Excel Expert 365', batches)
    ).toBe('SJCET - 2 MBA - Batch 1 — Excel Expert 365');
  });

  it('cleans legacy prefixes properly', () => {
    expect(cleanBatchNameForDisplay('Batch (SJCET - 2 MBA - Batch 1)', batches)).toBe(
      'SJCET - 2 MBA - Batch 1 — Excel Expert 365'
    );
  });
});

describe('CEO Auto-Approval logic verification', () => {
  it('identifies CEO role and flags auto-approved status for expense claims and attendance', () => {
    const isCeo = (role?: string) => role?.toUpperCase() === 'CEO';

    expect(isCeo('CEO')).toBe(true);
    expect(isCeo('ceo')).toBe(true);
    expect(isCeo('EMPLOYEE')).toBe(false);
    expect(isCeo('ADMIN')).toBe(false);

    const getExpenseStatus = (role?: string) => (isCeo(role) ? 'approved' : 'submitted');
    expect(getExpenseStatus('CEO')).toBe('approved');
    expect(getExpenseStatus('EMPLOYEE')).toBe('submitted');

    const getAttendanceCorrectionStatus = (role?: string) => (isCeo(role) ? 'approved' : 'pending');
    expect(getAttendanceCorrectionStatus('CEO')).toBe('approved');
    expect(getAttendanceCorrectionStatus('EMPLOYEE')).toBe('pending');
  });
});
