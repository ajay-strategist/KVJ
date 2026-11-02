-- Migration: 20261101020000_consolidate_schedule_sessions.sql
-- Description: Consolidate training sessions into canonical flwdsk_schedule_sessions per CAL-Q01 and ISSUE-005 (MIG-002)

-- 1. Add visual planning columns to flwdsk_schedule_sessions
ALTER TABLE public.flwdsk_schedule_sessions
  ADD COLUMN IF NOT EXISTS session_title TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'Offline',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- 2. Non-destructive reconciliation from flwdsk_calendar_sessions if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'flwdsk_calendar_sessions'
  ) THEN
    -- Update existing parent schedule sessions (student_id IS NULL) with calendar metadata
    UPDATE public.flwdsk_schedule_sessions ss
    SET 
      session_title = COALESCE(ss.session_title, cs.title),
      start_time = COALESCE(ss.start_time, cs.start_time),
      end_time = COALESCE(ss.end_time, cs.end_time),
      venue = COALESCE(ss.venue, cs.venue),
      mode = COALESCE(ss.mode, cs.mode, 'Offline'),
      color = COALESCE(ss.color, cs.color, '#3b82f6')
    FROM public.flwdsk_calendar_sessions cs
    WHERE ss.batch_id = cs.batch_id
      AND ss.date = cs.date
      AND (
        (ss.start_time IS NOT NULL AND ss.start_time = cs.start_time)
        OR ss.start_time IS NULL
      )
      AND ss.student_id IS NULL;

    -- Insert calendar sessions that do not exist yet in flwdsk_schedule_sessions
    INSERT INTO public.flwdsk_schedule_sessions (
      batch_id,
      trainer_id,
      date,
      session_title,
      start_time,
      end_time,
      venue,
      mode,
      color,
      status
    )
    SELECT
      cs.batch_id,
      cs.trainer_id,
      cs.date,
      cs.title,
      cs.start_time,
      cs.end_time,
      cs.venue,
      COALESCE(cs.mode, 'Offline'),
      COALESCE(cs.color, '#3b82f6'),
      'Scheduled'
    FROM public.flwdsk_calendar_sessions cs
    WHERE NOT EXISTS (
      SELECT 1 FROM public.flwdsk_schedule_sessions ss
      WHERE ss.batch_id = cs.batch_id
        AND ss.date = cs.date
        AND (ss.start_time = cs.start_time OR (ss.start_time IS NULL AND cs.start_time IS NULL))
    );
  END IF;
END $$;

