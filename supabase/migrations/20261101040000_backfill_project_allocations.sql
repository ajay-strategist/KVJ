-- Migration: 20261101040000_backfill_project_allocations.sql
-- Description: Idempotent backfill from flwdsk_projects.member_ids to flwdsk_resource_allocations logging inserted IDs to flwdsk_migration_log per PROJECT-Q1, ISSUE-006, and MIG-004

DO $$
DECLARE
  rec RECORD;
  new_alloc_id UUID;
BEGIN
  -- Iterate through projects with non-empty member_ids
  FOR rec IN
    SELECT 
      p.id AS project_id,
      (m.elem)::uuid AS employee_id
    FROM public.flwdsk_projects p,
         jsonb_array_elements_text(p.member_ids) AS m(elem)
    WHERE p.member_ids IS NOT NULL
      AND jsonb_typeof(p.member_ids) = 'array'
      AND m.elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (m.elem)::uuid IN (SELECT id FROM public.flwdsk_employees)
      AND NOT EXISTS (
        SELECT 1 FROM public.flwdsk_resource_allocations ra
        WHERE ra.project_id = p.id AND ra.employee_id = (m.elem)::uuid
      )
  LOOP
    -- Insert allocation record
    INSERT INTO public.flwdsk_resource_allocations (
      project_id,
      employee_id,
      role,
      status
    ) VALUES (
      rec.project_id,
      rec.employee_id,
      'Team Member',
      'active'
    )
    RETURNING id INTO new_alloc_id;

    -- Log provenance to flwdsk_migration_log
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'flwdsk_migration_log'
    ) THEN
      INSERT INTO public.flwdsk_migration_log (
        migration_name,
        record_id,
        target_table,
        executed_at,
        metadata
      ) VALUES (
        'MIG-004_PROJECT_ALLOCATIONS_BACKFILL',
        new_alloc_id,
        'flwdsk_resource_allocations',
        NOW(),
        jsonb_build_object('project_id', rec.project_id, 'employee_id', rec.employee_id)
      );
    END IF;
  END LOOP;
END $$;

