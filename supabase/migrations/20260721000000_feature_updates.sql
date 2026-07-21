-- Supabase Migration: 20260721000000_feature_updates.sql
-- Feature updates for Attendance, Training, Projects, Expenses, Vouchers, and Email Configs

CREATE TABLE IF NOT EXISTS public.declared_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available', -- 'available', 'assigned', 'unallocated'
  assigned_student_register_no TEXT,
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_email_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  smtp_host TEXT NOT NULL DEFAULT 'smtp.office365.com',
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,
  from_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO public.system_settings (key, value)
VALUES 
  ('bike_rate_per_km', '5.0'::jsonb),
  ('car_rate_per_km', '12.0'::jsonb),
  ('pass_percentage', '84.0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS policies
ALTER TABLE public.declared_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to holidays" ON public.declared_holidays FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to vouchers" ON public.vouchers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow user email config access" ON public.user_email_configs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated system settings" ON public.system_settings FOR ALL USING (auth.role() = 'authenticated');
