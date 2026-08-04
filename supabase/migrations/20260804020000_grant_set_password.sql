-- Grant execute on flwdsk_set_password to anon so it can be called pre-auth / with anon key
GRANT EXECUTE ON FUNCTION public.flwdsk_set_password(uuid, text) TO anon, authenticated;
