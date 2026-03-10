-- Track which tags users click most, for usage-based sorting
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS tag_usage_counts JSONB DEFAULT '{}'::jsonb;
