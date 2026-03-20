-- Study Guide: audience column on extraction tables
-- Allows multiple audience versions of the same extraction content

ALTER TABLE manifest_summaries ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'original';
ALTER TABLE manifest_action_steps ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'original';
ALTER TABLE manifest_questions ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'original';
ALTER TABLE manifest_declarations ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'original';

-- Index for filtering by audience
CREATE INDEX IF NOT EXISTS idx_manifest_summaries_audience ON manifest_summaries (manifest_item_id, audience);
CREATE INDEX IF NOT EXISTS idx_manifest_action_steps_audience ON manifest_action_steps (manifest_item_id, audience);
CREATE INDEX IF NOT EXISTS idx_manifest_questions_audience ON manifest_questions (manifest_item_id, audience);
CREATE INDEX IF NOT EXISTS idx_manifest_declarations_audience ON manifest_declarations (manifest_item_id, audience);
