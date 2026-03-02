-- Migration 033: Add is_included column for seasonal focus
-- Allows users to toggle individual entries out of AI context without archiving

ALTER TABLE ai_framework_principles
ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE mast_entries
ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE keel_entries
ADD COLUMN is_included BOOLEAN NOT NULL DEFAULT true;
