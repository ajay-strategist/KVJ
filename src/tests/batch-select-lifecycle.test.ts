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
});

