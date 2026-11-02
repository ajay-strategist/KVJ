-- Migration: 20261101030000_composite_indexes.sql
-- Description: Composite performance indexes for attendance, work sessions, and training schedules (MIG-003)

CREATE INDEX IF NOT EXISTS idx_flwdsk_att_emp_date 
  ON public.flwdsk_attendance_records(employee_id, date);

CREATE INDEX IF NOT EXISTS idx_flwdsk_tws_emp_open 
  ON public.flwdsk_task_work_sessions(employee_id, end_time);

CREATE INDEX IF NOT EXISTS idx_flwdsk_sched_batch_date 
  ON public.flwdsk_schedule_sessions(batch_id, date);

