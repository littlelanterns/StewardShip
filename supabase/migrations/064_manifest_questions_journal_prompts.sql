-- Migration 064: Manifest Questions (5th extraction tab) + Journal Prompts
-- Questions extracted from books for reflection, implementation, recognition, discussion
-- Journal Prompts are the user's saved prompt library sourced from extractions or manual entry

-- 1. manifest_questions table (follows manifest_action_steps pattern exactly)
CREATE TABLE IF NOT EXISTS manifest_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  section_title TEXT,
  section_index INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT 'reflection',
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hearted BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_from_go_deeper BOOLEAN NOT NULL DEFAULT false,
  user_note TEXT,
  sent_to_prompts BOOLEAN NOT NULL DEFAULT false,
  journal_prompt_id UUID,
  embedding extensions.vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE manifest_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own manifest questions"
  ON manifest_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_manifest_questions_item ON manifest_questions(manifest_item_id, section_index, sort_order);
CREATE INDEX idx_manifest_questions_user ON manifest_questions(user_id);
CREATE INDEX idx_manifest_questions_hearted ON manifest_questions(user_id, is_hearted) WHERE is_hearted = true AND is_deleted = false;

-- HNSW index for semantic search on questions
CREATE INDEX idx_manifest_questions_embedding ON manifest_questions
  USING hnsw (embedding extensions.vector_cosine_ops);

-- 2. journal_prompts table
CREATE TABLE IF NOT EXISTS journal_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID,
  source_book_title TEXT,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE journal_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own journal prompts"
  ON journal_prompts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_journal_prompts_user ON journal_prompts(user_id);
CREATE INDEX idx_journal_prompts_source ON journal_prompts(user_id, source);
CREATE INDEX idx_journal_prompts_tags ON journal_prompts USING GIN (tags);

-- FK from manifest_questions to journal_prompts
ALTER TABLE manifest_questions
  ADD CONSTRAINT fk_manifest_questions_journal_prompt
  FOREIGN KEY (journal_prompt_id) REFERENCES journal_prompts(id) ON DELETE SET NULL;

-- Auto-update trigger for journal_prompts
CREATE TRIGGER set_journal_prompts_updated_at
  BEFORE UPDATE ON journal_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Update match_manifest_content to include manifest_questions
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

    -- manifest_questions
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
