-- =============================================================================
-- Migration: Rename all Flow Desk tables to have 'flwdsk_' prefix to avoid clash
-- =============================================================================

-- 1. Rename all tables
ALTER TABLE IF EXISTS public.departments RENAME TO flwdsk_departments;
ALTER TABLE IF EXISTS public.employees RENAME TO flwdsk_employees;
ALTER TABLE IF EXISTS public.attendance_records RENAME TO flwdsk_attendance_records;
ALTER TABLE IF EXISTS public.work_sessions RENAME TO flwdsk_work_sessions;
ALTER TABLE IF EXISTS public.break_records RENAME TO flwdsk_break_records;
ALTER TABLE IF EXISTS public.attendance_corrections RENAME TO flwdsk_attendance_corrections;
ALTER TABLE IF EXISTS public.leave_records RENAME TO flwdsk_leave_records;
ALTER TABLE IF EXISTS public.declared_holidays RENAME TO flwdsk_declared_holidays;
ALTER TABLE IF EXISTS public.colleges RENAME TO flwdsk_colleges;
ALTER TABLE IF EXISTS public.courses RENAME TO flwdsk_courses;
ALTER TABLE IF EXISTS public.batches RENAME TO flwdsk_batches;
ALTER TABLE IF EXISTS public.student_records RENAME TO flwdsk_student_records;
ALTER TABLE IF EXISTS public.enrollments RENAME TO flwdsk_enrollments;
ALTER TABLE IF EXISTS public.schedule_sessions RENAME TO flwdsk_schedule_sessions;
ALTER TABLE IF EXISTS public.assessments RENAME TO flwdsk_assessments;
ALTER TABLE IF EXISTS public.final_exam_results RENAME TO flwdsk_final_exam_results;
ALTER TABLE IF EXISTS public.vouchers RENAME TO flwdsk_vouchers;
ALTER TABLE IF EXISTS public.certificates RENAME TO flwdsk_certificates;
ALTER TABLE IF EXISTS public.referrals RENAME TO flwdsk_referrals;
ALTER TABLE IF EXISTS public.alumni_profiles RENAME TO flwdsk_alumni_profiles;
ALTER TABLE IF EXISTS public.clients RENAME TO flwdsk_clients;
ALTER TABLE IF EXISTS public.projects RENAME TO flwdsk_projects;
ALTER TABLE IF EXISTS public.milestones RENAME TO flwdsk_milestones;
ALTER TABLE IF EXISTS public.tasks RENAME TO flwdsk_tasks;
ALTER TABLE IF EXISTS public.resource_allocations RENAME TO flwdsk_resource_allocations;
ALTER TABLE IF EXISTS public.timesheets RENAME TO flwdsk_timesheets;
ALTER TABLE IF EXISTS public.client_meetings RENAME TO flwdsk_client_meetings;
ALTER TABLE IF EXISTS public.expense_claims RENAME TO flwdsk_expense_claims;
ALTER TABLE IF EXISTS public.budgets RENAME TO flwdsk_budgets;
ALTER TABLE IF EXISTS public.vendors RENAME TO flwdsk_vendors;
ALTER TABLE IF EXISTS public.purchase_orders RENAME TO flwdsk_purchase_orders;
ALTER TABLE IF EXISTS public.assets RENAME TO flwdsk_assets;
ALTER TABLE IF EXISTS public.salary_structures RENAME TO flwdsk_salary_structures;
ALTER TABLE IF EXISTS public.travel_requests RENAME TO flwdsk_travel_requests;
ALTER TABLE IF EXISTS public.chat_channels RENAME TO flwdsk_chat_channels;
ALTER TABLE IF EXISTS public.chat_messages RENAME TO flwdsk_chat_messages;
ALTER TABLE IF EXISTS public.announcements RENAME TO flwdsk_announcements;
ALTER TABLE IF EXISTS public.email_logs RENAME TO flwdsk_email_logs;
ALTER TABLE IF EXISTS public.notification_preferences RENAME TO flwdsk_notification_preferences;
ALTER TABLE IF EXISTS public.kpi_definitions RENAME TO flwdsk_kpi_definitions;
ALTER TABLE IF EXISTS public.saved_reports RENAME TO flwdsk_saved_reports;
ALTER TABLE IF EXISTS public.system_settings RENAME TO flwdsk_system_settings;
ALTER TABLE IF EXISTS public.user_email_configs RENAME TO flwdsk_user_email_configs;
ALTER TABLE IF EXISTS public.task_work_sessions RENAME TO flwdsk_task_work_sessions;
ALTER TABLE IF EXISTS public.expense_types RENAME TO flwdsk_expense_types;
ALTER TABLE IF EXISTS public.audit_logs RENAME TO flwdsk_audit_logs;

-- 2. Recreate functions to reference renamed table
CREATE OR REPLACE FUNCTION public.current_role()
  RETURNS user_role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM flwdsk_employees WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT e.email
  FROM public.flwdsk_employees e
  WHERE e.deleted_at IS NULL
    AND (
      lower(e.email) = lower(trim(identifier))
      OR lower(e.username) = lower(trim(identifier))
      OR regexp_replace(coalesce(e.phone, ''), '[^0-9]', '', 'g') =
         regexp_replace(trim(identifier),      '[^0-9]', '', 'g')
    )
    -- Never match on an empty/blank identifier.
    AND length(trim(identifier)) > 0
  LIMIT 1;
$$;
