-- Add manifest_questions to match_manifest_content() semantic search
-- Questions were added after the original function was created in migration 061

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

    UNION ALL

    -- manifest_questions (added post-migration 064)
    SELECT
      'manifest_questions'::TEXT,
      mq.id,
      mq.manifest_item_id,
      mi.title,
      LEFT(mq.text, 200)::TEXT,
      (1 - (mq.embedding <=> query_embedding))::FLOAT
    FROM manifest_questions mq
    JOIN manifest_items mi ON mi.id = mq.manifest_item_id
    WHERE mq.user_id = target_user_id
      AND mq.embedding IS NOT NULL
      AND mq.is_deleted = false
      AND mi.archived_at IS NULL
      AND (1 - (mq.embedding <=> query_embedding)) > match_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
