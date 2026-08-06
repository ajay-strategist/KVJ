-- Drop restrictive policies on system_settings and flwdsk_system_settings
DROP POLICY IF EXISTS "Allow authenticated system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated system settings" ON public.flwdsk_system_settings;
DROP POLICY IF EXISTS "kvj_full_access_policy" ON public.system_settings;
DROP POLICY IF EXISTS "kvj_full_access_policy" ON public.flwdsk_system_settings;

-- Enable RLS
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flwdsk_system_settings ENABLE ROW LEVEL SECURITY;

-- Create permissive full access policies
CREATE POLICY "kvj_full_access_policy" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "kvj_full_access_policy" ON public.flwdsk_system_settings FOR ALL USING (true) WITH CHECK (true);

-- Grant select/insert/update/delete permissions
GRANT ALL ON public.system_settings TO anon, authenticated, service_role;
GRANT ALL ON public.flwdsk_system_settings TO anon, authenticated, service_role;
