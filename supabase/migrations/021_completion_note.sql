-- Migration 021: Add completion_note to compass_tasks
-- Allows users to add an optional note when completing a task

ALTER TABLE compass_tasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
