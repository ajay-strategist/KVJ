-- Migration: 20261101010000_add_probation_end_date.sql
-- Description: Add single probation_end_date column to flwdsk_employees per EMP-Q01, DISC-001, and ISSUE-010 (MIG-001)

ALTER TABLE public.flwdsk_employees
  ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;

