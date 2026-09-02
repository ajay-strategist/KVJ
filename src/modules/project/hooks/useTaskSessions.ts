import { useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../../shared/integration/supabase';
import {
  TASK_WORK_SESSION_REPOSITORY_TOKEN,
  type TaskWorkSession,
} from '../project.repository';
import type { UUID } from '../../../core/types';

/** Uppercase initials of the work title, used as a short Work Code (e.g. MWSS). */
export function deriveWorkCode(title: string): string {
  return (title || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 8);
}

export interface StartSessionInput {
  taskId?: UUID;
  projectId?: UUID;
  workTitle: string;
  workCode?: string;
  supervisorId?: UUID;
  supervisorName?: string;
  notes?: string;
}

/**
 * Records real per-interval task work sessions (Start → Pause/Submit), which
 * drive the Work Sessions timeline on the Task Worklog page.
 *
 * Every write is persisted to task_work_sessions in the database — there is no
 * local-only state, so the timeline is accurate across refreshes and users.
 */
export function useTaskSessions() {
  const { user } = useAuth();
  const repo = useMemo(() => container.resolve(TASK_WORK_SESSION_REPOSITORY_TOKEN), []);
  const actor = useMemo(() => (user ? { id: user.id, role: user.role } : null), [user]);

  const closeAllOpenSessionsForEmployee = useCallback(
    async (status: 'paused' | 'completed') => {
      if (!user || !actor) return;
      try {
        const { data, error } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('employee_id', user.id)
          .is('end_time', null)
          .is('deleted_at', null);
        if (!error && data) {
          const endTime = new Date();
          for (const s of data) {
            const durationMinutes = Math.max(
              0,
              Math.round((endTime.getTime() - new Date(s.start_time).getTime()) / 60000),
            );
            await repo.update(
              s.id,
              { endTime: endTime.toISOString(), durationMinutes, status } as Partial<TaskWorkSession>,
              actor,
            );
          }
        }
      } catch (e) {
        console.warn('Could not auto-close other sessions:', e);
      }
    },
    [repo, user, actor]
  );

  /** Close whatever open session exists for this task with the given status. */
  const closeOpen = useCallback(
    async (taskId: UUID | undefined, status: 'paused' | 'completed', notes?: string) => {
      if (!user || !taskId || !actor) return;
      const open = await repo.findOpenSession(user.id, taskId);
      if (!open) return;
      const endTime = new Date();
      const durationMinutes = Math.max(
        0,
        Math.round((endTime.getTime() - new Date(open.startTime).getTime()) / 60000),
      );
      const updates: any = { endTime: endTime.toISOString(), durationMinutes, status };
      if (notes) updates.notes = notes;
      await repo.update(
        open.id,
        updates as Partial<TaskWorkSession>,
        actor,
      );
    },
    [repo, user, actor],
  );

  /** Begin a session: close any dangling open one, then open a fresh running row. */
  const startSession = useCallback(
    async (input: StartSessionInput) => {
      if (!user || !actor) return { ok: false as const, error: 'Unauthenticated' };
      try {
        await closeAllOpenSessionsForEmployee('paused');
        await repo.create(
          {
            taskId: input.taskId,
            projectId: input.projectId,
            employeeId: user.id,
            supervisorId: input.supervisorId,
            supervisorName: input.supervisorName,
            workTitle: input.workTitle,
            workCode: input.workCode || deriveWorkCode(input.workTitle),
            startTime: new Date().toISOString(),
            status: 'running',
            notes: input.notes,
          } as any,
          actor,
        );
        return { ok: true as const };
      } catch (e: any) {
        return { ok: false as const, error: e?.message || 'Failed to start task session' };
      }
    },
    [user, actor, repo, closeAllOpenSessionsForEmployee],
  );

  const pauseSession = useCallback(
    async (taskId: UUID | undefined, notes?: string) => {
      try {
        await closeOpen(taskId, 'paused', notes);
        return { ok: true as const };
      } catch (e: any) {
        return { ok: false as const, error: e?.message ?? 'Failed to pause session' };
      }
    },
    [closeOpen],
  );

  const completeSession = useCallback(
    async (taskId: UUID) => {
      try {
        await closeOpen(taskId, 'completed');
        return { ok: true as const };
      } catch (e: any) {
        return { ok: false as const, error: e?.message ?? 'Failed to complete session' };
      }
    },
    [closeOpen],
  );

  const updateSessionNote = useCallback(
    async (sessionId: UUID | string, notes: string, taskId?: UUID | string) => {
      try {
        if (sessionId.startsWith('local-')) {
          const tid = taskId || sessionId.replace(/^local-(db-)?/, '');
          if (tid) {
            await supabase
              .from('flwdsk_tasks')
              .update({ description: notes })
              .eq('id', tid);
          }
        } else {
          await supabase
            .from('flwdsk_task_work_sessions')
            .update({ notes })
            .eq('id', sessionId);
          if (taskId) {
            await supabase
              .from('flwdsk_tasks')
              .update({ description: notes })
              .eq('id', taskId);
          }
        }
        return { ok: true as const };
      } catch (e: any) {
        return { ok: false as const, error: e?.message || 'Failed to update session note' };
      }
    },
    []
  );

  return { startSession, pauseSession, completeSession, listSessions, updateSessionNote };
}
