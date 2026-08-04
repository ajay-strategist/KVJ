-- Create flwdsk_expense_types table
CREATE TABLE IF NOT EXISTS public.flwdsk_expense_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant permissions so users can read and insert custom expense types
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flwdsk_expense_types TO anon, authenticated, service_role;

-- Enable RLS and add public read/write access policies
ALTER TABLE public.flwdsk_expense_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read custom expense types" ON public.flwdsk_expense_types
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert custom expense types" ON public.flwdsk_expense_types
  FOR INSERT WITH CHECK (true);
