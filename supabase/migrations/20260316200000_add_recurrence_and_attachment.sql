-- Add recurrence and attachment columns to financial_transactions
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS recurrence_months INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create storage bucket for attachments if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Allow authenticated users to read attachments
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

-- Allow authenticated users to delete their attachments
CREATE POLICY "Authenticated users can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
