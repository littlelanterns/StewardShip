-- PRD-25 Phase 6: Manifest Resurfacing
-- Track which hearted items have been surfaced recently to avoid repetition

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS manifest_resurfaced_ids JSONB DEFAULT '[]';
-- Format: [{ "id": "uuid", "table": "manifest_summaries", "shown_at": "iso8601" }]
-- Cleanup: remove entries older than 7 days on each query
