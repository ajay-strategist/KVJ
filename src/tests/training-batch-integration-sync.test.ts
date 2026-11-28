import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateStandardBatchCode,
  normalizeBatchCode,
  normalizeCodeSegment,
  isDuplicateBatchCode,
} from '../modules/training/utils/batch-formatter';
import { TrainingService } from '../modules/training/training.service';
import {
  SupabaseBatchRepository,
  toggleBatchChecklistItemAtomic,
} from '../modules/training/supabase-training.repository';
import { supabase } from '../shared/integration/supabase';

describe('Standardized 5-Part Batch Code Utility', () => {
  it('generates canonical COLLEGE_CODE - PROGRAM - ACADEMIC_YEAR - BATCH_NO - COURSE_CODE', () => {
    const code = generateStandardBatchCode({
      collegeCode: ' abc ',
      program: 'bcom   self',
      academicYear: '2026-2027',
      batchNo: 'batch 1',
      courseCode: 'excel',
    });
    expect(code).toBe('ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL');
  });

  it('matches live UI preview (allowPartial) with saved code when all segments are filled', () => {
    const input = {
      collegeCode: 'MIM',
      program: '1 MBA',
      academicYear: '2026-2027',
      batchNo: 'Batch 3',
      courseCode: 'BA-101',
    };
    const preview = generateStandardBatchCode(input, { allowPartial: true });
    const saved = generateStandardBatchCode(input);
    expect(preview).toBe(saved);
    expect(saved).toBe('MIM - 1 MBA - 2026-2027 - BATCH 3 - BA-101');
  });

  it('normalizes whitespace and casing consistently and detects duplicate batch codes', () => {
    const existing = [
      { id: 'b-1', code: 'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL', deletedAt: null },
      { id: 'b-2', code: 'ABC - BCOM SELF - 2026-2027 - BATCH 2 - EXCEL', deletedAt: '2026-11-01T00:00:00Z' },
    ];

    expect(normalizeCodeSegment('  sjcet  (Copy) ')).toBe('SJCET');
    expect(normalizeBatchCode('abc  -  bcom self - 2026-2027 - batch 1 - excel')).toBe(
      'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL'
    );

    // Active duplicate is detected regardless of case/spacing
    expect(
      isDuplicateBatchCode('  abc -  bcom self - 2026-2027 - batch 1 - excel ', existing)
    ).toBe(true);

    // Editing the same batch ID is allowed
    expect(
      isDuplicateBatchCode('ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL', existing, 'b-1')
    ).toBe(false);

    // Soft-deleted batch code does not block reuse
    expect(
      isDuplicateBatchCode('ABC - BCOM SELF - 2026-2027 - BATCH 2 - EXCEL', existing)
    ).toBe(false);
  });
});

describe('TrainingService Batch Code Uniqueness & UUID Preservation', () => {
  const actor = { id: '11111111-1111-4111-8111-111111111111', role: 'ADMIN' };

  function makeMockService(existingByCode: Record<string, any> = {}) {
    const noop = async () => ({});
    const batchRepo: any = {
      findByCode: vi.fn(async (code: string) => existingByCode[normalizeBatchCode(code)] ?? null),
      create: vi.fn(async (data: any) => ({
        id: '22222222-2222-4222-8222-222222222222',
        ...data,
        createdAt: '2026-11-28T00:00:00Z',
        updatedAt: '2026-11-28T00:00:00Z',
      })),
      update: vi.fn(async (id: string, patch: any) => ({
        id,
        ...patch,
        updatedAt: '2026-11-28T01:00:00Z',
      })),
    };
    const activity: any = { log: vi.fn(noop) };
    const audit: any = { log: vi.fn(noop) };
    const svc = new TrainingService();
    Object.defineProperty(svc, 'batchRepo', { get: () => batchRepo });
    Object.defineProperty(svc, 'activity', { get: () => activity });
    Object.defineProperty(svc, 'audit', { get: () => audit });
    return { svc, batchRepo };
  }

  it('creates a batch with collegeId, courseId, and normalized 5-part batch code', async () => {
    const { svc, batchRepo } = makeMockService();
    const res = await svc.createBatch(
      {
        collegeId: 'col-uuid-1',
        courseId: 'crs-uuid-1',
        college: 'ABC College',
        program: 'BCOM SELF',
        academicYear: '2026-2027',
        batchNo: 'Batch 1',
        code: 'abc - bcom self - 2026-2027 - batch 1 - excel',
      },
      actor
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.id).toBe('22222222-2222-4222-8222-222222222222');
      expect(res.value.code).toBe('ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL');
      expect(res.value.collegeId).toBe('col-uuid-1');
      expect(res.value.courseId).toBe('crs-uuid-1');
    }
    expect(batchRepo.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate batch codes on create and update', async () => {
    const existingBatch = {
      id: 'existing-batch-uuid',
      code: 'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL',
    };
    const { svc, batchRepo } = makeMockService({
      'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL': existingBatch,
    });

    const createRes = await svc.createBatch(
      {
        courseId: 'crs-1',
        collegeId: 'col-1',
        code: 'abc - bcom self - 2026-2027 - batch 1 - excel',
      },
      actor
    );
    expect(createRes.ok).toBe(false);
    expect(batchRepo.create).not.toHaveBeenCalled();

    // Updating a different batch to the colliding code is rejected
    const updateCollision = await svc.updateBatch(
      'other-batch-uuid',
      { code: 'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL' },
      actor
    );
    expect(updateCollision.ok).toBe(false);
    expect(batchRepo.update).not.toHaveBeenCalled();

    // Updating the same batch preserves its UUID
    const updateSame = await svc.updateBatch(
      'existing-batch-uuid',
      { code: 'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL', capacity: 60 },
      actor
    );
    expect(updateSame.ok).toBe(true);
    if (updateSame.ok) {
      expect(updateSame.value.id).toBe('existing-batch-uuid');
    }
  });
});

describe('Integration API, Incremental Sync & Atomic Checklist RPC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('listIntegrationRecords & findUpdatedSince return joined college/course/checklist and soft-deleted rows', async () => {
    const sampleRows = [
      {
        id: 'batch-uuid-1',
        batch_code: 'ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL',
        batch_no: 'Batch 1',
        program: 'BCOM SELF',
        academic_year: '2026-2027',
        college_id: 'col-uuid-1',
        college_code: 'ABC',
        college_name: 'ABC Renamed College',
        course_id: 'crs-uuid-1',
        course_code: 'EXCEL',
        course_title: 'Excel Expert',
        course_checklist_template: ['Setup Lab', 'Conduct Session'],
        updated_at: '2026-11-28T10:00:00Z',
        deleted_at: null,
      },
      {
        id: 'batch-uuid-2',
        batch_code: 'ABC - BBA - 2026-2027 - BATCH 1 - PBI',
        college_id: 'col-uuid-1',
        course_id: 'crs-uuid-2',
        updated_at: '2026-11-28T10:05:00Z',
        deleted_at: '2026-11-28T10:05:00Z',
      },
    ];

    const orderMock = vi.fn(async () => ({ data: sampleRows, error: null }));
    const gtMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ gt: gtMock, order: orderMock }));
    vi.spyOn(supabase, 'from').mockImplementation(() => ({ select: selectMock } as any));

    const repo = new SupabaseBatchRepository();
    const all = await repo.listIntegrationRecords({ includeDeleted: true });
    expect(all).toHaveLength(2);
    expect(all[0].collegeName).toBe('ABC Renamed College');
    expect(all[0].courseChecklistTemplate).toEqual(['Setup Lab', 'Conduct Session']);

    const delta = await repo.findUpdatedSince('2026-11-28T09:00:00Z', { includeDeleted: true });
    expect(delta).toHaveLength(2);
    expect(delta[1].deletedAt).toBe('2026-11-28T10:05:00Z');
  });

  it('toggleBatchChecklistItemAtomic invokes atomic RPC per task without whole-JSON overwrite', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: {
        id: 'item-1',
        batch_id: 'batch-uuid-1',
        task_label: 'Setup Lab',
        is_done: true,
        source_app: 'flowdesk',
      },
      error: null,
    } as any);

    const res = await toggleBatchChecklistItemAtomic({
      batchId: 'batch-uuid-1',
      taskLabel: 'Setup Lab',
      isDone: true,
      actorId: 'actor-1',
      actorName: 'Admin User',
      sourceApp: 'flowdesk',
      totalTasks: 4,
    });

    expect(rpcSpy).toHaveBeenCalledWith('toggle_batch_checklist_item', {
      p_batch_id: 'batch-uuid-1',
      p_task_label: 'Setup Lab',
      p_is_done: true,
      p_actor_id: 'actor-1',
      p_actor_name: 'Admin User',
      p_source_app: 'flowdesk',
      p_total_tasks: 4,
    });
    expect(res?.taskLabel).toBe('Setup Lab');
    expect(res?.isDone).toBe(true);
  });
});
