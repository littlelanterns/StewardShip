-- Migration 041: Auto-clone manifest books to all users
-- Adds source_manifest_item_id for tracking cloned books
-- Updates match_manifest_chunks to include source item chunks for RAG

-- 1. Add source_manifest_item_id to manifest_items
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS source_manifest_item_id UUID REFERENCES manifest_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manifest_items_source ON manifest_items(source_manifest_item_id) WHERE source_manifest_item_id IS NOT NULL;

-- 2. Update match_manifest_chunks to also return chunks from source items (for cloned books)
-- Cloned items don't have their own chunks — they reference the original via source_manifest_item_id.
-- This updated function finds chunks belonging to either the user's own items OR the source items of their clones.
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
  WHERE mc.manifest_item_id IN (
    -- User's own items (original uploads)
    SELECT mi.id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.archived_at IS NULL
      AND mi.processing_status = 'completed'
    UNION
    -- Source items for user's clones (chunks belong to the original uploader)
    SELECT mi.source_manifest_item_id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.source_manifest_item_id IS NOT NULL
      AND mi.archived_at IS NULL
  )
    AND (1 - (mc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
