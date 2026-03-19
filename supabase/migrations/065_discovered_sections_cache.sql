-- Cache discovered sections on manifest_items so they survive page reloads
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS discovered_sections JSONB DEFAULT NULL;

COMMENT ON COLUMN manifest_items.discovered_sections IS 'Cached section discovery results (title, start_char, end_char, description). Persisted so re-discovery is not needed on reload.';
