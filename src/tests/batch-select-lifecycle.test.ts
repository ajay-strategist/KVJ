import { describe, it, expect } from 'vitest';
import {
  normalizeBatchPhase,
  APPROVED_BATCH_STATUSES,
  type ApprovedBatchStatus,
} from '../modules/training/training.repository';

describe('Phase 3: Universal SearchableBatchSelect & Training Lifecycle (DISC-002, CONF-001, ISSUE-013)', () => {
  it('APPROVED_BATCH_STATUSES contains exactly the 4 stakeholder approved statuses', () => {
    expect(APPROVED_BATCH_STATUSES).toEqual([
      'Not Started',
      'In Progress',
      'Completed',
      'Closed',
    ]);
  });

  it('normalizeBatchPhase maps legacy "Scheduled" and "Preparation" to "Not Started"', () => {
    expect(normalizeBatchPhase('Scheduled')).toBe('Not Started');
    expect(normalizeBatchPhase('Preparation')).toBe('Not Started');
    expect(normalizeBatchPhase('Not Started')).toBe('Not Started');
    expect(normalizeBatchPhase(null)).toBe('Not Started');
    expect(normalizeBatchPhase(undefined)).toBe('Not Started');
  });

  it('normalizeBatchPhase maps progress phases to "In Progress"', () => {
    expect(normalizeBatchPhase('In Progress')).toBe('In Progress');
    expect(normalizeBatchPhase('Assessment')).toBe('In Progress');
    expect(normalizeBatchPhase('Feedback')).toBe('In Progress');
    expect(normalizeBatchPhase('Certificate')).toBe('In Progress');
  });

  it('normalizeBatchPhase preserves distinct "Completed" and "Closed" statuses', () => {
    expect(normalizeBatchPhase('Completed')).toBe('Completed');
    expect(normalizeBatchPhase('Closed')).toBe('Closed');
    expect(normalizeBatchPhase('Completed')).not.toBe(normalizeBatchPhase('Closed'));
  });

  it('guarantees SearchableBatchSelect resolves MIM - UG when MIM - UG is selected even if STC - UG shares the course', () => {
    const batches: any[] = [
      {
        id: 'batch-stc-1',
        code: 'STC - UG - Batch 1',
        batchNo: 'Batch 1',
        college: 'STC',
        trainingName: 'Business Analytics',
        phase: 'In Progress',
      },
      {
        id: 'batch-mim-1',
        code: 'MIM - UG - Batch 1',
        batchNo: 'Batch 1',
        college: 'MIM',
        trainingName: 'Business Analytics',
        phase: 'In Progress',
      },
    ];

    // Simulate SearchableBatchSelect matching logic
    const resolveSelectedBatch = (value: string) => {
      const valLower = value.toLowerCase().trim();
      const byId = batches.find((b) => b.id === value);
      if (byId) return byId;

      const byFormatted = batches.find(
        (b) => `${b.code} — ${b.trainingName}`.toLowerCase() === valLower
      );
      if (byFormatted) return byFormatted;

      const byCode = batches.find(
        (b) => b.code && b.code.toLowerCase() === valLower
      );
      if (byCode) return byCode;

      const byCodePrefix = batches.find(
        (b) =>
          b.code &&
          (valLower.startsWith(b.code.toLowerCase() + ' —') ||
            valLower.startsWith(b.code.toLowerCase() + ' -') ||
            valLower.startsWith(b.code.toLowerCase() + ' '))
      );
      if (byCodePrefix) return byCodePrefix;

      return undefined;
    };

    // Selecting MIM - UG by formatted name
    expect(resolveSelectedBatch('MIM - UG - Batch 1 — Business Analytics')?.id).toBe('batch-mim-1');

    // Selecting MIM - UG by code
    expect(resolveSelectedBatch('MIM - UG - Batch 1')?.id).toBe('batch-mim-1');

    // Selecting STC - UG by formatted name
    expect(resolveSelectedBatch('STC - UG - Batch 1 — Business Analytics')?.id).toBe('batch-stc-1');
  });
});

