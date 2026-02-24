-- Phase 9A: Manifest storage bucket + updated match function

-- Create private storage bucket for Manifest files
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'manifest-files',
  'manifest-files',
  false,
  ARRAY['application/pdf', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'image/png', 'image/jpeg'],
  52428800 -- 50MB limit
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access their own files
-- Files are stored at: {user_id}/{filename}
CREATE POLICY "Users can upload own manifest files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'manifest-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own manifest files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'manifest-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own manifest files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'manifest-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update match_manifest_chunks to include usage_designations filter
-- Exclude store_only, mast_extraction, keel_info from RAG results
CREATE OR REPLACE FUNCTION public.match_manifest_chunks(
  query_embedding extensions.vector(1536),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  manifest_item_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT mc.id, mc.manifest_item_id, mc.chunk_text, mc.metadata,
    (1 - (mc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM manifest_chunks mc
  JOIN manifest_items mi ON mc.manifest_item_id = mi.id
  WHERE mc.user_id = p_user_id
    AND mi.archived_at IS NULL
    AND mi.processing_status = 'completed'
    AND mi.usage_designations && ARRAY['general_reference', 'framework_source', 'goal_specific']
    AND (1 - (mc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
