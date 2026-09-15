-- Migration: Prevent Duplicate Task Work Sessions & Cleanup Duplicates
-- Date: 2026-09-15

-- 1. Soft-delete known duplicate task session for Ebin Louis (started 5 seconds after primary session on 2026-09-14)
UPDATE public.flwdsk_task_work_sessions
SET deleted_at = NOW()
WHERE id = 'df25885a-c6a0-413c-8b8c-cca3db89d46b'
  AND deleted_at IS NULL;

-- 2. Ensure only 1 open (unended) session can exist per employee
-- Any existing historical overlapping open sessions can be closed
UPDATE public.flwdsk_task_work_sessions
SET end_time = start_time, duration_minutes = 0, status = 'paused'
WHERE end_time IS NULL
  AND deleted_at IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON (employee_id) id
    FROM public.flwdsk_task_work_sessions
    WHERE end_time IS NULL AND deleted_at IS NULL
    ORDER BY employee_id, start_time DESC
  );
