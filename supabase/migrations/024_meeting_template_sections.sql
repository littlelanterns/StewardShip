-- Migration 024: Per-user meeting template section customization
-- Allows users to customize agenda sections for ANY meeting type

CREATE TABLE IF NOT EXISTS meeting_template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL,
  template_id UUID REFERENCES meeting_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  ai_prompt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  default_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate default section seeding
CREATE UNIQUE INDEX idx_mts_unique_default
  ON meeting_template_sections(user_id, meeting_type, default_key)
  WHERE default_key IS NOT NULL;

-- Fast lookup by user + meeting type
CREATE INDEX idx_mts_user_type ON meeting_template_sections(user_id, meeting_type);

-- Custom template sections
CREATE INDEX idx_mts_template ON meeting_template_sections(template_id) WHERE template_id IS NOT NULL;

ALTER TABLE meeting_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meeting template sections"
  ON meeting_template_sections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_meeting_template_sections_updated_at
  BEFORE UPDATE ON meeting_template_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
