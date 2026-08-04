-- Add supervisor_id column to flwdsk_projects table
ALTER TABLE public.flwdsk_projects
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.flwdsk_employees(id) ON DELETE SET NULL;
