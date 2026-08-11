-- ============================================================
-- Migration: Create flwdsk_calendar_sessions table
-- For: Training Calendar page (TrainingCalendar.tsx)
-- RLS: relationship-scoped (training admin OR the batch's trainer), matching the
-- rest of the Training module (Phase 6.30 / 6.42). This file previously DISABLEd
-- RLS, which — because it sorts after the 6.30 migration — reopened the table on
-- a fresh reset. It is now secure-by-itself.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.flwdsk_calendar_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid REFERENCES public.flwdsk_batches(id) ON DELETE SET NULL,
  trainer_id    uuid REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL,
  date          date NOT NULL,
  session_title text,
  start_time    text,
  end_time      text,
  venue         text,
  mode          text DEFAULT 'Offline',
  student_count integer DEFAULT 0,
  status        text DEFAULT 'Scheduled',
  color         text DEFAULT '#3b82f6',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  deleted_at    timestamptz
);

-- Enable RLS and apply relationship-scoped policies. Guarded on the Phase 6.30
-- helper functions so this file is safe to run in any order: if the helpers do
-- not yet exist, RLS is left as-is and the 6.30 / 6.42 migrations install the
-- policies instead.
ALTER TABLE public.flwdsk_calendar_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regprocedure('public.is_training_admin()') IS NOT NULL
     AND to_regprocedure('public.is_batch_trainer(uuid)') IS NOT NULL THEN

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='flwdsk_calendar_sessions'
                     AND policyname='calendar_sessions_select') THEN
      EXECUTE $p$CREATE POLICY calendar_sessions_select ON public.flwdsk_calendar_sessions
        FOR SELECT USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))$p$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='flwdsk_calendar_sessions'
                     AND policyname='calendar_sessions_write') THEN
      EXECUTE $p$CREATE POLICY calendar_sessions_write ON public.flwdsk_calendar_sessions
        FOR ALL USING (public.is_training_admin() OR public.is_batch_trainer(batch_id))
        WITH CHECK (public.is_training_admin() OR public.is_batch_trainer(batch_id))$p$;
    END IF;
  END IF;
END $$;
