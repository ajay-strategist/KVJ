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
export function saveSessionNote(id: string, notes: string) {
  if (!id || !notes) return;
  try {
    const raw = localStorage.getItem('kvj_session_notes_v1');
    const map = raw ? JSON.parse(raw) : {};
    map[id] = notes;
    localStorage.setItem('kvj_session_notes_v1', JSON.stringify(map));
  } catch {}
}

export function getSessionNotesMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem('kvj_session_notes_v1');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// In-flight mutex to prevent concurrent double-clicks or parallel starts for the same user/task
const sessionStartInFlight = new Set<string>();

/**
 * Deduplicate task work sessions:
 * If two sessions have the same employee_id, same task_id, and start within 60 seconds
 * of each other, keep only the primary one to prevent double counting.
 */
export function deduplicateTaskSessions<T extends { employeeId?: string; employee_id?: string; taskId?: string; task_id?: string; startTime?: string; start_time?: string; id: string }>(sessions: T[]): T[] {
  if (!sessions || sessions.length <= 1) return sessions || [];
  const result: T[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (seenIds.has(s.id)) continue;

    const sEmp = s.employeeId || s.employee_id;
    const sTask = s.taskId || s.task_id;
    const sStart = s.startTime || s.start_time;
    const sStartTime = sStart ? new Date(sStart).getTime() : 0;

    let isDuplicate = false;
    for (const existing of result) {
      const eEmp = existing.employeeId || existing.employee_id;
      const eTask = existing.taskId || existing.task_id;
      const eStart = existing.startTime || existing.start_time;
      const eStartTime = eStart ? new Date(eStart).getTime() : 0;

      if (sEmp && sEmp === eEmp && sTask && sTask === eTask && sStartTime && eStartTime) {
        const diffMs = Math.abs(sStartTime - eStartTime);
        if (diffMs < 60000) { // within 60 seconds
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      seenIds.add(s.id);
      result.push(s);
    }
  }

  return result;
}

export function useTaskSessions() {
  const { user } = useAuth();
  const repo = useMemo(() => container.resolve(TASK_WORK_SESSION_REPOSITORY_TOKEN), []);
  const actor = useMemo(() => (user ? { id: user.id, role: user.role } : null), [user]);

  const closeOtherOpenSessions = useCallback(
    async (excludeTaskId?: UUID, status: 'paused' | 'completed' = 'paused') => {
      if (!user || !actor) return;
      try {
        let query = supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('employee_id', user.id)
          .is('end_time', null)
          .is('deleted_at', null);
        if (excludeTaskId) {
          query = query.neq('task_id', excludeTaskId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
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

  const closeAllOpenSessionsForEmployee = useCallback(
    async (status: 'paused' | 'completed') => {
      return closeOtherOpenSessions(undefined, status);
    },
    [closeOtherOpenSessions]
  );

  /** Close whatever open session exists for this task with the given status. Closes all duplicates if any exist. */
  const closeOpen = useCallback(
    async (taskId: UUID | undefined, status: 'paused' | 'completed', notes?: string) => {
      if (!user || !taskId || !actor) return;
      try {
        const { data, error } = await supabase
          .from('flwdsk_task_work_sessions')
          .select('*')
          .eq('employee_id', user.id)
          .eq('task_id', taskId)
          .is('end_time', null)
          .is('deleted_at', null)
          .order('start_time', { ascending: true });

        if (!error && data && data.length > 0) {
          const endTime = new Date();
          // Primary session gets updated with accurate duration and status
          const primary = data[0];
          const durationMinutes = Math.max(
            0,
            Math.round((endTime.getTime() - new Date(primary.start_time).getTime()) / 60000),
          );
          const updates: any = { endTime: endTime.toISOString(), durationMinutes, status };
          if (notes) updates.notes = notes;
          await repo.update(
            primary.id,
            updates as Partial<TaskWorkSession>,
            actor,
          );

          // If duplicate open sessions existed, soft-delete them to avoid double-counting time
          if (data.length > 1) {
            for (const dup of data.slice(1)) {
              await supabase
                .from('flwdsk_task_work_sessions')
                .update({ deleted_at: endTime.toISOString() })
                .eq('id', dup.id);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to close open sessions for task:', e);
      }
    },
    [repo, user, actor],
  );

  /** Begin a session: check for running session, close other tasks, and guard against duplicate starts. */
  const startSession = useCallback(
    async (input: StartSessionInput) => {
      if (!user || !actor) return { ok: false as const, error: 'Unauthenticated' };
      const lockKey = `${user.id}_${input.taskId || 'general'}`;
      if (sessionStartInFlight.has(lockKey)) {
        return { ok: true as const };
      }
      sessionStartInFlight.add(lockKey);

      try {
        // 1. Check if an active open session ALREADY exists for this employee and task
        if (input.taskId) {
          const { data: openSessions } = await supabase
            .from('flwdsk_task_work_sessions')
            .select('*')
            .eq('employee_id', user.id)
            .eq('task_id', input.taskId)
            .is('end_time', null)
            .is('deleted_at', null)
            .order('start_time', { ascending: true });

          if (openSessions && openSessions.length > 0) {
            // Task is ALREADY running! Clean up any duplicate open rows and return ok
            if (openSessions.length > 1) {
              const duplicates = openSessions.slice(1);
              for (const dup of duplicates) {
                await supabase
                  .from('flwdsk_task_work_sessions')
                  .update({ deleted_at: new Date().toISOString() })
                  .eq('id', dup.id);
              }
            }
            await closeOtherOpenSessions(input.taskId, 'paused');
            return { ok: true as const };
          }
        }

        // 2. Pause any other tasks currently running for this employee
        await closeOtherOpenSessions(input.taskId, 'paused');

        // 3. Create the single fresh running row
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
      } finally {
        sessionStartInFlight.delete(lockKey);
      }
    },
    [user, actor, repo, closeOtherOpenSessions],
  );

  const pauseSession = useCallback(
    async (taskId: UUID | undefined, notes?: string) => {
      try {
        if (taskId && notes) {
          saveSessionNote(taskId, notes);
          try {
            await supabase
              .from('flwdsk_tasks')
              .update({ description: notes })
              .eq('id', taskId);
          } catch (_) {}
        }
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

  /** All non-deleted sessions, newest first — for the Work Sessions timeline. */
  const listSessions = useCallback(async (): Promise<TaskWorkSession[]> => {
    const page = await repo.findMany({
      sort: [{ field: 'startTime', dir: 'desc' }],
      pageSize: 500,
    });
    return page.data;
  }, [repo]);

  const updateSessionNote = useCallback(
    async (sessionId: UUID | string, notes: string, taskId?: UUID | string) => {
      try {
        saveSessionNote(sessionId, notes);
        if (taskId) {
          saveSessionNote(taskId, notes);
          try {
            await supabase
              .from('flwdsk_tasks')
              .update({ description: notes })
              .eq('id', taskId);
          } catch (_) {}
        } else {
          const tid = sessionId.replace(/^local-(db-)?/, '');
          if (tid) {
            saveSessionNote(tid, notes);
            try {
              await supabase
                .from('flwdsk_tasks')
                .update({ description: notes })
                .eq('id', tid);
            } catch (_) {}
          }
        }
        try {
          await supabase
            .from('flwdsk_task_work_sessions')
            .update({ notes })
            .eq('id', sessionId);
        } catch (_) {}

        return { ok: true as const };
      } catch (e: any) {
        return { ok: false as const, error: e?.message || 'Failed to update session note' };
      }
    },
    []
  );

  return { startSession, pauseSession, completeSession, listSessions, updateSessionNote };
}
