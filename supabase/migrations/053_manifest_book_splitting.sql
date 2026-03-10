-- Migration 053: Auto-split large books into parts
-- Adds parent/child relationship for split books
-- Updates match_manifest_chunks to include child parts in RAG search

-- 1. Add parent/child columns
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS parent_manifest_item_id UUID REFERENCES manifest_items(id) ON DELETE CASCADE;
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS part_number INTEGER;
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS part_count INTEGER;

-- Index for efficient child-part queries
CREATE INDEX IF NOT EXISTS idx_manifest_items_parent ON manifest_items(parent_manifest_item_id) WHERE parent_manifest_item_id IS NOT NULL;

-- 2. Update match_manifest_chunks to also include chunks from child parts of split books
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
    -- User's own items (original uploads, non-part items)
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
    UNION
    -- Child parts of user's split books (each part has its own chunks)
    SELECT mi.id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.parent_manifest_item_id IS NOT NULL
      AND mi.archived_at IS NULL
      AND mi.processing_status = 'completed'
  )
    AND (1 - (mc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
