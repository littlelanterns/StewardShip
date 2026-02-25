-- Migration 015: Create helm-attachments storage bucket for Helm file attachments

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'helm-attachments',
  'helm-attachments',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/markdown'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for helm-attachments bucket
CREATE POLICY "Users can upload their own helm attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'helm-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own helm attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'helm-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own helm attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'helm-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role needs access for signed URLs in Edge Functions
CREATE POLICY "Service role can read helm attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'helm-attachments'
    AND auth.role() = 'service_role'
  );
