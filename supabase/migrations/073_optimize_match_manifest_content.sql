-- Optimize match_manifest_content for free-tier performance.
-- The UNION ALL across 5 tables prevents HNSW index usage.
-- Fix: Query each table independently with ORDER BY + LIMIT (enables index scan),
-- then merge results in a final sort. Each sub-query is fast via HNSW.

CREATE OR REPLACE FUNCTION public.match_manifest_content(
  query_embedding extensions.vector(1536),
  target_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 15
)
RETURNS TABLE (
  source_table TEXT,
  record_id UUID,
  manifest_item_id UUID,
  book_title TEXT,
  content_preview TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  -- Each CTE uses ORDER BY embedding <=> query_embedding LIMIT N
  -- which allows the HNSW index to be used (single-table scan pattern).
  -- We fetch match_count per table then merge and re-limit.
  RETURN QUERY
  WITH
  s AS (
    SELECT 'manifest_summaries'::TEXT AS src, ms.id, ms.manifest_item_id AS mid,
      LEFT(ms.text, 200)::TEXT AS preview,
      (1 - (ms.embedding <=> query_embedding))::FLOAT AS sim
    FROM manifest_summaries ms
    WHERE ms.user_id = target_user_id AND ms.embedding IS NOT NULL AND ms.is_deleted = false
    ORDER BY ms.embedding <=> query_embedding
    LIMIT match_count
  ),
  d AS (
    SELECT 'manifest_declarations'::TEXT, md.id, md.manifest_item_id,
      LEFT(md.declaration_text, 200)::TEXT,
      (1 - (md.embedding <=> query_embedding))::FLOAT
    FROM manifest_declarations md
    WHERE md.user_id = target_user_id AND md.embedding IS NOT NULL AND md.is_deleted = false
    ORDER BY md.embedding <=> query_embedding
    LIMIT match_count
  ),
  f AS (
    SELECT 'ai_framework_principles'::TEXT, afp.id, af.manifest_item_id,
      LEFT(afp.text, 200)::TEXT,
      (1 - (afp.embedding <=> query_embedding))::FLOAT
    FROM ai_framework_principles afp
    JOIN ai_frameworks af ON af.id = afp.framework_id
    WHERE afp.user_id = target_user_id AND afp.embedding IS NOT NULL
      AND (afp.is_deleted = false OR afp.is_deleted IS NULL)
      AND (afp.archived_at IS NULL) AND af.archived_at IS NULL
    ORDER BY afp.embedding <=> query_embedding
    LIMIT match_count
  ),
  a AS (
    SELECT 'manifest_action_steps'::TEXT, mas.id, mas.manifest_item_id,
      LEFT(mas.text, 200)::TEXT,
      (1 - (mas.embedding <=> query_embedding))::FLOAT
    FROM manifest_action_steps mas
    WHERE mas.user_id = target_user_id AND mas.embedding IS NOT NULL AND mas.is_deleted = false
    ORDER BY mas.embedding <=> query_embedding
    LIMIT match_count
  ),
  q AS (
    SELECT 'manifest_questions'::TEXT, mq.id, mq.manifest_item_id,
      LEFT(mq.text, 200)::TEXT,
      (1 - (mq.embedding <=> query_embedding))::FLOAT
    FROM manifest_questions mq
    WHERE mq.user_id = target_user_id AND mq.embedding IS NOT NULL AND mq.is_deleted = false
    ORDER BY mq.embedding <=> query_embedding
    LIMIT match_count
  ),
  combined AS (
    SELECT * FROM s UNION ALL SELECT * FROM d UNION ALL SELECT * FROM f UNION ALL SELECT * FROM a UNION ALL SELECT * FROM q
  )
  SELECT c.src, c.id, c.mid, mi.title, c.preview, c.sim
  FROM combined c
  JOIN manifest_items mi ON mi.id = c.mid
  WHERE c.sim > match_threshold AND mi.archived_at IS NULL
  ORDER BY c.sim DESC
  LIMIT match_count;
END;
$$;
