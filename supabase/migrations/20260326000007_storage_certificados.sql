-- supabase/migrations/20260326000007_storage_certificados.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados',
  'certificados',
  false,
  5242880,
  ARRAY['application/x-pkcs12', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_storage_cert" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'certificados')
  WITH CHECK (bucket_id = 'certificados');
