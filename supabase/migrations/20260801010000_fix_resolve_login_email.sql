-- Fix resolve_login_email phone match logic
-- Precludes empty-string matches ('' = '') when an alphabetical username is supplied
-- and an employee record lacks a registered phone number.
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
      OR (
        regexp_replace(trim(identifier), '[^0-9]', '', 'g') <> ''
        AND regexp_replace(coalesce(e.phone, ''), '[^0-9]', '', 'g') =
            regexp_replace(trim(identifier),      '[^0-9]', '', 'g')
      )
    )
    -- Never match on an empty/blank identifier.
    AND length(trim(identifier)) > 0
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
