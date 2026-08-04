-- Recreate flwdsk_authenticate with search_path set to public, extensions to support pgcrypto functions
CREATE OR REPLACE FUNCTION public.flwdsk_authenticate(
  p_email    text,
  p_password text
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE
  v_id            uuid;
  v_password_hash text;
  v_status        text;
BEGIN
  SELECT id, password_hash, status::text
    INTO v_id, v_password_hash, v_status
    FROM public.flwdsk_employees
   WHERE lower(email) = lower(trim(p_email))
     AND deleted_at IS NULL
   LIMIT 1;

  -- Not found, inactive, or no password set yet
  IF v_id IS NULL OR v_status <> 'active' OR v_password_hash IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify bcrypt hash
  IF crypt(p_password, v_password_hash) = v_password_hash THEN
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flwdsk_authenticate(text, text) TO anon, authenticated;


-- Recreate flwdsk_set_password with search_path set to public, extensions to support pgcrypto functions
CREATE OR REPLACE FUNCTION public.flwdsk_set_password(
  p_employee_id uuid,
  p_new_password text
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions
AS $$
BEGIN
  IF length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.flwdsk_employees
     SET password_hash        = crypt(p_new_password, gen_salt('bf', 10)),
         must_change_password = false,
         updated_at           = now()
   WHERE id = p_employee_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flwdsk_set_password(uuid, text) TO anon, authenticated;
