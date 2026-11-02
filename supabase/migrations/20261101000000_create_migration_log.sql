-- Migration: 20261101000000_create_migration_log.sql
-- Description: Audit table for tracking non-destructive data migrations, provenance, and backfills (MIG-000)

CREATE TABLE IF NOT EXISTS public.flwdsk_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_flwdsk_mig_log_name ON public.flwdsk_migration_log(migration_name, target_table);

