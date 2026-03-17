-- Migration 063: Add missing user_note column to manifest_action_steps
-- This column was added to manifest_summaries, manifest_declarations, and
-- ai_framework_principles in migration 049 but was accidentally omitted
-- from manifest_action_steps. Without it, all SELECT queries using
-- MANIFEST_ACTION_STEP_COLUMNS fail because the column doesn't exist.

ALTER TABLE manifest_action_steps ADD COLUMN IF NOT EXISTS user_note TEXT;
