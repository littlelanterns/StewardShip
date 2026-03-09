-- Migration 045: manifest_action_steps table for Action Steps extraction tab
-- Mirrors manifest_summaries pattern with added sent_to_compass tracking

CREATE TABLE IF NOT EXISTS manifest_action_steps (
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
  sent_to_compass BOOLEAN NOT NULL DEFAULT false,
  compass_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE manifest_action_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own action steps"
  ON manifest_action_steps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_manifest_action_steps_item
  ON manifest_action_steps(manifest_item_id, section_index, sort_order);

CREATE INDEX idx_manifest_action_steps_hearted
  ON manifest_action_steps(user_id, is_hearted, is_deleted);
