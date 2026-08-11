-- =============================================================================
-- Migration: Create auto-clock-out function for dangling sessions
-- File: supabase/migrations/20260809000000_auto_clock_out.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.flwdsk_auto_clock_out()
RETURNS void AS $$
DECLARE
  rec RECORD;
  v_total_work_min integer;
  v_total_break_min integer;
BEGIN
  -- Find all attendance records that are not clocked out and belong to a past date
  FOR rec IN
    SELECT id, work_date, first_clock_in
    FROM public.flwdsk_attendance_records
    WHERE status IN ('present', 'on_break') AND work_date < current_date AND deleted_at IS NULL
  LOOP
    -- 1. Close open break records at 23:59:59 of that work date
    UPDATE public.flwdsk_break_records
    SET end_time = (rec.work_date + time '23:59:59')::timestamptz
    WHERE work_session_id IN (
      SELECT id FROM public.flwdsk_work_sessions WHERE attendance_record_id = rec.id
    ) AND end_time IS NULL;
    
    -- 2. Close open work sessions at 23:59:59 of that work date
    UPDATE public.flwdsk_work_sessions
    SET clock_out = (rec.work_date + time '23:59:59')::timestamptz
    WHERE attendance_record_id = rec.id AND clock_out IS NULL;
    
    -- 3. Calculate total break minutes
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60), 0)::integer
    INTO v_total_break_min
    FROM public.flwdsk_break_records
    WHERE work_session_id IN (
      SELECT id FROM public.flwdsk_work_sessions WHERE attendance_record_id = rec.id
    );
    
    -- 4. Calculate total working minutes
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))/60), 0)::integer
    INTO v_total_work_min
    FROM public.flwdsk_work_sessions
    WHERE attendance_record_id = rec.id;
    
    -- 5. Update attendance record status, last_clock_out, total minutes
    UPDATE public.flwdsk_attendance_records
    SET status = 'clocked_out',
        last_clock_out = (rec.work_date + time '23:59:59')::timestamptz,
        total_working_minutes = GREATEST(0, v_total_work_min - v_total_break_min),
        total_break_minutes = v_total_break_min,
        updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe pg_cron scheduling
DO $$
BEGIN
  -- Attempt to enable pg_cron extension if possible
  PERFORM * FROM pg_extension WHERE extname = 'pg_cron';
  IF NOT FOUND THEN
    BEGIN
      CREATE EXTENSION pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not enable pg_cron extension: %', SQLERRM;
      RETURN;
    END;
  END IF;

  -- Schedule pg_cron job
  BEGIN
    -- Unschedule first to avoid duplicate keys
    PERFORM cron.unschedule('flwdsk-auto-clock-out-job');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore error if job doesn't exist
  END;

  BEGIN
    PERFORM cron.schedule(
      'flwdsk-auto-clock-out-job',
      '59 23 * * *',
      'SELECT public.flwdsk_auto_clock_out();'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not schedule auto-clock-out job in pg_cron: %', SQLERRM;
  END;
END $$;

-- Safe enablement of Supabase Realtime for chat messages and channels
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Check if flwdsk_chat_messages is already in the publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'flwdsk_chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.flwdsk_chat_messages;
    END IF;

    -- Check if flwdsk_chat_channels is already in the publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'flwdsk_chat_channels'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.flwdsk_chat_channels;
    END IF;
  END IF;
END $$;
