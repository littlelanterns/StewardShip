-- Migration 061: Semantic Embeddings Infrastructure
-- Adds vector embedding columns to 7 content tables for semantic search.
-- Creates HNSW indexes for fast cosine similarity search.
-- Creates match_manifest_content() and match_personal_context() search functions.
-- pgvector extension already enabled (used by manifest_chunks since migration 002).

-- ============================================================
-- 1. Add embedding columns (extensions.vector(1536) — same type as manifest_chunks)
-- ============================================================

ALTER TABLE manifest_summaries ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE manifest_declarations ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE manifest_action_steps ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE mast_entries ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE keel_entries ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- ============================================================
-- 2. HNSW indexes for cosine similarity search
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_manifest_summaries_embedding
  ON manifest_summaries USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_manifest_declarations_embedding
  ON manifest_declarations USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ai_framework_principles_embedding
  ON ai_framework_principles USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_manifest_action_steps_embedding
  ON manifest_action_steps USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_mast_entries_embedding
  ON mast_entries USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_keel_entries_embedding
  ON keel_entries USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_journal_entries_embedding
  ON journal_entries USING hnsw (embedding extensions.vector_cosine_ops);

-- ============================================================
-- 3. Semantic search: Manifest content (books)
-- ============================================================

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
AS $$
BEGIN
  RETURN QUERY
  (
    -- manifest_summaries
    SELECT
      'manifest_summaries'::TEXT AS source_table,
      ms.id AS record_id,
      ms.manifest_item_id,
      mi.title AS book_title,
      LEFT(ms.text, 200)::TEXT AS content_preview,
      (1 - (ms.embedding <=> query_embedding))::FLOAT AS similarity
    FROM manifest_summaries ms
    JOIN manifest_items mi ON mi.id = ms.manifest_item_id
    WHERE ms.user_id = target_user_id
      AND ms.embedding IS NOT NULL
      AND ms.is_deleted = false
      AND mi.archived_at IS NULL
      AND (1 - (ms.embedding <=> query_embedding)) > match_threshold

    UNION ALL

    -- manifest_declarations
    SELECT
      'manifest_declarations'::TEXT,
      md.id,
      md.manifest_item_id,
      mi.title,
      LEFT(md.declaration_text, 200)::TEXT,
      (1 - (md.embedding <=> query_embedding))::FLOAT
    FROM manifest_declarations md
    JOIN manifest_items mi ON mi.id = md.manifest_item_id
    WHERE md.user_id = target_user_id
      AND md.embedding IS NOT NULL
      AND md.is_deleted = false
      AND mi.archived_at IS NULL
      AND (1 - (md.embedding <=> query_embedding)) > match_threshold

    UNION ALL

    -- ai_framework_principles
    SELECT
      'ai_framework_principles'::TEXT,
      afp.id,
      af.manifest_item_id,
      mi.title,
      LEFT(afp.text, 200)::TEXT,
      (1 - (afp.embedding <=> query_embedding))::FLOAT
    FROM ai_framework_principles afp
    JOIN ai_frameworks af ON af.id = afp.framework_id
    JOIN manifest_items mi ON mi.id = af.manifest_item_id
    WHERE afp.user_id = target_user_id
      AND afp.embedding IS NOT NULL
      AND (afp.is_deleted = false OR afp.is_deleted IS NULL)
      AND (afp.archived_at IS NULL)
      AND af.archived_at IS NULL
      AND mi.archived_at IS NULL
      AND (1 - (afp.embedding <=> query_embedding)) > match_threshold

    UNION ALL

    -- manifest_action_steps
    SELECT
      'manifest_action_steps'::TEXT,
      mas.id,
      mas.manifest_item_id,
      mi.title,
      LEFT(mas.text, 200)::TEXT,
      (1 - (mas.embedding <=> query_embedding))::FLOAT
    FROM manifest_action_steps mas
    JOIN manifest_items mi ON mi.id = mas.manifest_item_id
    WHERE mas.user_id = target_user_id
      AND mas.embedding IS NOT NULL
      AND mas.is_deleted = false
      AND mi.archived_at IS NULL
      AND (1 - (mas.embedding <=> query_embedding)) > match_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 4. Semantic search: Personal context (mast, keel, journal)
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_personal_context(
  query_embedding extensions.vector(1536),
  target_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  source_table TEXT,
  record_id UUID,
  content_preview TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  (
    -- mast_entries
    SELECT
      'mast_entries'::TEXT AS source_table,
      me.id AS record_id,
      LEFT(me.text, 200)::TEXT AS content_preview,
      (1 - (me.embedding <=> query_embedding))::FLOAT AS similarity
    FROM mast_entries me
    WHERE me.user_id = target_user_id
      AND me.embedding IS NOT NULL
      AND me.archived_at IS NULL
      AND (1 - (me.embedding <=> query_embedding)) > match_threshold

    UNION ALL

    -- keel_entries
    SELECT
      'keel_entries'::TEXT,
      ke.id,
      LEFT(ke.text, 200)::TEXT,
      (1 - (ke.embedding <=> query_embedding))::FLOAT
    FROM keel_entries ke
    WHERE ke.user_id = target_user_id
      AND ke.embedding IS NOT NULL
      AND ke.archived_at IS NULL
      AND (1 - (ke.embedding <=> query_embedding)) > match_threshold

    UNION ALL

    -- journal_entries
    SELECT
      'journal_entries'::TEXT,
      je.id,
      LEFT(je.text, 200)::TEXT,
      (1 - (je.embedding <=> query_embedding))::FLOAT
    FROM journal_entries je
    WHERE je.user_id = target_user_id
      AND je.embedding IS NOT NULL
      AND je.archived_at IS NULL
      AND (1 - (je.embedding <=> query_embedding)) > match_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
