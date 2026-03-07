-- PRD-24: Manifest Extract & Discuss
-- Adds genre system, extraction tables, heart-based curation, book discussions

-- 1. manifest_items additions
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'none';
-- usage_designations column left in place but deprecated — nothing reads it after this migration

-- 2. manifest_summaries — chapter-by-chapter summary extraction
CREATE TABLE IF NOT EXISTS manifest_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  section_title TEXT,
  section_index INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hearted BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_from_go_deeper BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE manifest_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own summaries"
  ON manifest_summaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_manifest_summaries_item ON manifest_summaries(manifest_item_id, section_index, sort_order);
CREATE INDEX idx_manifest_summaries_hearted ON manifest_summaries(user_id, is_hearted, is_deleted);

-- 3. manifest_declarations — Mast content / declaration extraction
CREATE TABLE IF NOT EXISTS manifest_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  section_title TEXT,
  section_index INTEGER NOT NULL DEFAULT 0,
  value_name TEXT,
  declaration_text TEXT NOT NULL,
  declaration_style TEXT NOT NULL,
  is_hearted BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  sent_to_mast BOOLEAN NOT NULL DEFAULT false,
  mast_entry_id UUID REFERENCES mast_entries(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_from_go_deeper BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE manifest_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own declarations"
  ON manifest_declarations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_manifest_declarations_item ON manifest_declarations(manifest_item_id, section_index, sort_order);
CREATE INDEX idx_manifest_declarations_hearted ON manifest_declarations(user_id, is_hearted, is_deleted);

-- 4. ai_framework_principles additions for heart/delete curation
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS is_hearted BOOLEAN DEFAULT false;
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS is_from_go_deeper BOOLEAN DEFAULT false;

-- 5. book_discussions — dedicated book discussion conversations
CREATE TABLE IF NOT EXISTS book_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  manifest_item_ids UUID[] NOT NULL,
  discussion_type TEXT NOT NULL DEFAULT 'discuss',
  audience TEXT NOT NULL DEFAULT 'personal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own discussions"
  ON book_discussions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_book_discussions_user ON book_discussions(user_id, updated_at DESC);

-- Auto-update updated_at
CREATE TRIGGER update_book_discussions_updated_at
  BEFORE UPDATE ON book_discussions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 6. book_discussion_messages — messages within book discussions
CREATE TABLE IF NOT EXISTS book_discussion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discussion_id UUID NOT NULL REFERENCES book_discussions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE book_discussion_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own discussion messages"
  ON book_discussion_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_book_discussion_messages_discussion ON book_discussion_messages(discussion_id, created_at ASC);

-- 7. user_settings — book knowledge access setting
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS book_knowledge_access TEXT DEFAULT 'hearted_only';

-- 8. Update match_manifest_chunks to remove usage_designations filter
-- Usage designations are deprecated — all processed books are now searchable via RAG
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
    AND (1 - (mc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
