-- Add user_note column to extraction tables for personal annotations
ALTER TABLE manifest_summaries ADD COLUMN IF NOT EXISTS user_note TEXT;
ALTER TABLE manifest_declarations ADD COLUMN IF NOT EXISTS user_note TEXT;
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS user_note TEXT;
