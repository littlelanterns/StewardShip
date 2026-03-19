-- PRD-25 Phase 5: Manifest Browsing Enhancements
-- Adds last_viewed_at for "Recently Viewed" sort and tags on extraction tables

-- Add last_viewed_at to manifest_items for "Recently Viewed" sort
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_manifest_items_last_viewed ON manifest_items (user_id, last_viewed_at DESC NULLS LAST);

-- Add tags to extraction tables for cross-content tagging
ALTER TABLE manifest_summaries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_declarations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_action_steps ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_questions ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- GIN indexes for tag queries
CREATE INDEX IF NOT EXISTS idx_manifest_summaries_tags ON manifest_summaries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_manifest_declarations_tags ON manifest_declarations USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_manifest_action_steps_tags ON manifest_action_steps USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_manifest_questions_tags ON manifest_questions USING GIN (tags);
