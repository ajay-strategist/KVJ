-- ============================================================
-- Migration: Create flwdsk_calendar_sessions table
-- For: Training Calendar page (TrainingCalendar.tsx)
-- NO Row Level Security — anyone can read/write this table
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

-- Disable RLS — no restrictions, anyone can read and write
ALTER TABLE public.flwdsk_calendar_sessions DISABLE ROW LEVEL SECURITY;
