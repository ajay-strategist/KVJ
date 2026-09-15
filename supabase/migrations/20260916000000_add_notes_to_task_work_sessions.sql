-- =============================================================================
-- Add notes column to flwdsk_task_work_sessions
-- Allows each individual work session interval to store its distinct update note.
-- =============================================================================

ALTER TABLE public.flwdsk_task_work_sessions
ADD COLUMN IF NOT EXISTS notes text;
