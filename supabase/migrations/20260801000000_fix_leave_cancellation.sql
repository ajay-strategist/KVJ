-- Fix leave cancellation check constraint
ALTER TABLE public.flwdsk_leave_records DROP CONSTRAINT IF EXISTS leave_records_status_check;
ALTER TABLE public.flwdsk_leave_records ADD CONSTRAINT leave_records_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
