-- =============================================================================
-- KVJ Analytics / Flow Desk — LEGACY TABLE CLEANUP SCRIPT
--
-- Safely removes legacy tables that are no longer used by KVJ Analytics.
--
-- PRESERVED TABLES (DO NOT DROP):
--   - All KVJ Analytics tables: employees, departments, attendance_records,
--     work_sessions, break_records, attendance_corrections, leave_records,
--     projects, tasks, task_work_sessions, announcements, declared_holidays,
--     expense_claims, colleges, courses, batches, enrollments, assessments,
--     final_exam_results, certificates, students.
--   - All external application tables starting with 'uct_' or 'uct'.
-- =============================================================================

-- 1) Safely drop legacy 'users' table if it exists (replaced by auth.users + public.employees)
DROP TABLE IF EXISTS public.users CASCADE;

-- 2) View remaining tables in public schema for inspection
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
