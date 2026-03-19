-- Optimize match_manifest_chunks to prevent statement timeout
-- The complex 3-way UNION subquery prevented the HNSW index from being used efficiently.
-- Fix: Materialize allowed item IDs in a CTE, add statement timeout guard.

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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard against long-running queries (8 second timeout)
  PERFORM set_config('statement_timeout', '8000', true);

  RETURN QUERY
  WITH allowed_items AS MATERIALIZED (
    -- User's own items (original uploads, non-part items)
    SELECT mi.id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.archived_at IS NULL
      AND mi.processing_status = 'completed'
    UNION
    -- Source items for user's clones
    SELECT mi.source_manifest_item_id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.source_manifest_item_id IS NOT NULL
      AND mi.archived_at IS NULL
    UNION
    -- Child parts of user's split books
    SELECT mi.id FROM manifest_items mi
    WHERE mi.user_id = p_user_id
      AND mi.parent_manifest_item_id IS NOT NULL
      AND mi.archived_at IS NULL
      AND mi.processing_status = 'completed'
  )
  SELECT mc.id, mc.manifest_item_id, mc.chunk_text, mc.metadata,
    (1 - (mc.embedding <=> query_embedding))::FLOAT AS sim
  FROM manifest_chunks mc
  INNER JOIN allowed_items ai ON mc.manifest_item_id = ai.id
  WHERE (1 - (mc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY sim DESC
  LIMIT match_count;

  -- Reset timeout
  PERFORM set_config('statement_timeout', '0', true);
END;
$$;
