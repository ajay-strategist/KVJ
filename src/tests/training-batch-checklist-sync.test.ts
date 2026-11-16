import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toCardVM,
  loadAllLocalChecklistDoneStates,
  saveAllLocalChecklistDoneStates,
  fetchRemoteBatchChecklists,
  syncBatchChecklistToSupabase,
} from '../modules/training/components/TrainingBatchCarousel';
import { supabase } from '../shared/integration/supabase';
import type { Batch, Course } from '../modules/training/training.repository';

describe('Training Batch Checklist Sync & Multi-User Persistence (Issue B)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockCourse: Course = {
    id: 'course-1',
    title: 'Excel Expert 365',
    durationHours: 30,
    checklist: [
      'Create Google Classroom',
      'Complete the Training',
      'Collect Feedback',
      'Exam',
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as unknown as Course;

  const mockBatch: Batch = {
    id: 'batch-1',
    code: 'MIM - 1 MBA - 2026-2027 - Batch 1',
    courseId: 'course-1',
    trainingName: 'Excel Expert 365',
    college: 'MIM',
    academicYear: '2026-2027',
    batchNo: 'Batch 1',
    phase: 'In Progress',
    completedTasks: 0,
    totalTasks: 0,
    capacity: 60,
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  } as unknown as Batch;

  it('toCardVM calculates totalTasks from course checklist if batch totalTasks is 0', () => {
    const vm = toCardVM(mockBatch, [mockCourse], []);
    expect(vm.totalTasks).toBe(4);
    expect(vm.completedTasks).toBe(0);
    expect(vm.courseChecklist).toEqual([
      'Create Google Classroom',
      'Complete the Training',
      'Collect Feedback',
      'Exam',
    ]);
  });

  it('toCardVM preserves completedTasks and computes accurate progress', () => {
    const updatedBatch: Batch = { ...mockBatch, completedTasks: 2, totalTasks: 4 };
    const vm = toCardVM(updatedBatch, [mockCourse], []);
    expect(vm.completedTasks).toBe(2);
    expect(vm.totalTasks).toBe(4);
    expect(vm.progress).toBe(50);
  });

  it('syncBatchChecklistToSupabase updates localStorage, flwdsk_batches, and flwdsk_system_settings', async () => {
    const updateBatchMock = vi.fn().mockResolvedValue({ error: null });
    const upsertSettingsMock = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'flwdsk_batches') {
        return {
          update: (payload: any) => ({
            eq: (col: string, val: string) => {
              updateBatchMock(payload, col, val);
              return Promise.resolve({ error: null });
            },
          }),
        } as any;
      }
      if (table === 'flwdsk_system_settings') {
        return {
          upsert: (payload: any, options: any) => {
            upsertSettingsMock(payload, options);
            return Promise.resolve({ error: null });
          },
        } as any;
      }
      return {} as any;
    });

    const taskState = {
      'Create Google Classroom': true,
      'Complete the Training': false,
    };

    await syncBatchChecklistToSupabase('batch-1', taskState, 1, 4);

    // 1. Verify localStorage is updated
    const local = loadAllLocalChecklistDoneStates();
    expect(local['batch-1']).toEqual(taskState);

    // 2. Verify flwdsk_batches update is called with completed_tasks & total_tasks
    expect(updateBatchMock).toHaveBeenCalledTimes(1);
    const [batchPayload, batchCol, batchVal] = updateBatchMock.mock.calls[0];
    expect(batchPayload.completed_tasks).toBe(1);
    expect(batchPayload.total_tasks).toBe(4);
    expect(batchCol).toBe('id');
    expect(batchVal).toBe('batch-1');

    // 3. Verify flwdsk_system_settings upsert is called with key and value
    expect(upsertSettingsMock).toHaveBeenCalledTimes(1);
    const [settingsPayload, settingsOptions] = upsertSettingsMock.mock.calls[0];
    expect(settingsPayload.key).toBe('batch_checklist_state');
    expect(settingsPayload.value['batch-1']).toEqual(taskState);
    expect(settingsOptions).toEqual({ onConflict: 'key' });
  });

  it('fetchRemoteBatchChecklists pulls cloud checklist state and merges with local cache', async () => {
    saveAllLocalChecklistDoneStates({
      'batch-local': { 'Task A': true },
    });

    const cloudData = {
      'batch-1': {
        'Create Google Classroom': true,
        'Complete the Training': true,
      },
    };

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'flwdsk_system_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { value: cloudData }, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const result = await fetchRemoteBatchChecklists();
    expect(result['batch-1']).toEqual({
      'Create Google Classroom': true,
      'Complete the Training': true,
    });
    expect(result['batch-local']).toEqual({ 'Task A': true });

    // Local storage should now reflect the merged state
    const merged = loadAllLocalChecklistDoneStates();
    expect(merged['batch-1']).toBeDefined();
    expect(merged['batch-local']).toBeDefined();
  });

  it('vanishing option: items marked done are filtered out of visibleChecklist while showAll is false', () => {
    const rawChecklist = [
      { id: '1', label: 'Create Google Classroom', done: false },
      { id: '2', label: 'Complete the Training', done: false },
    ];

    // Initially both visible
    let visible = rawChecklist.filter((t) => !t.done);
    expect(visible.length).toBe(2);

    // Toggle item 1 to done
    const updated = rawChecklist.map((t) => (t.id === '1' ? { ...t, done: true } : t));
    visible = updated.filter((t) => !t.done);

    // Item 1 has vanished from visible checklist!
    expect(visible.length).toBe(1);
    expect(visible[0].label).toBe('Complete the Training');

    // When showAll is true, both are visible
    const showAll = updated;
    expect(showAll.length).toBe(2);
  });

  it('manual batch closing: 4/4 checklist completion does not automatically close the batch', () => {
    const batch: Batch = {
      ...mockBatch,
      phase: 'In Progress',
      completedTasks: 4,
      totalTasks: 4,
    };
    const vm = toCardVM(batch, [mockCourse], []);

    // Phase must remain 'In Progress' until user manually clicks Close Batch
    expect(vm.phase).toBe('In Progress');
    expect(vm.completedTasks).toBe(4);
    expect(vm.totalTasks).toBe(4);
    expect(vm.progress).toBe(100);
  });
});
