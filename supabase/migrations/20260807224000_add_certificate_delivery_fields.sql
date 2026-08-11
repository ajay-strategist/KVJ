-- Alter table flwdsk_certificates to add delivery fields
ALTER TABLE public.flwdsk_certificates ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.flwdsk_certificates ADD COLUMN IF NOT EXISTS collected_by TEXT;
ALTER TABLE public.flwdsk_certificates ADD COLUMN IF NOT EXISTS certificate_count INTEGER;
ALTER TABLE public.flwdsk_certificates ADD COLUMN IF NOT EXISTS certificate_receipt_path TEXT;

-- Create storage bucket for certificate-receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-receipts', 'certificate-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Grant RLS access to certificate-receipts storage bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated insert certificate-receipts'
  ) THEN
    CREATE POLICY "Allow authenticated insert certificate-receipts" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'certificate-receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated select certificate-receipts'
  ) THEN
    CREATE POLICY "Allow authenticated select certificate-receipts" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'certificate-receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated update certificate-receipts'
  ) THEN
    CREATE POLICY "Allow authenticated update certificate-receipts" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'certificate-receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated delete certificate-receipts'
  ) THEN
    CREATE POLICY "Allow authenticated delete certificate-receipts" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'certificate-receipts');
  END IF;
END $$;
