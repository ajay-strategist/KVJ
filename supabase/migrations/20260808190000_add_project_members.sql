-- =============================================================================
-- Add project MEMBERS (in addition to the single supervisor).
-- Stored as a JSON array of employee ids on the project row, matching the app's
-- camelCase `memberIds` <-> snake_case `member_ids` auto-mapping.
-- Additive & idempotent; nothing is dropped.
-- =============================================================================

ALTER TABLE public.flwdsk_projects
  ADD COLUMN IF NOT EXISTS member_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
