-- Migration 032: Family Council meeting type + hidden_from_meetings on people
-- Family Council is stored as text in meeting_type columns (no enum), so no type change needed.
-- Add hidden_from_meetings boolean to people table for filtering.

ALTER TABLE people ADD COLUMN IF NOT EXISTS hidden_from_meetings BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN people.hidden_from_meetings IS 'When true, this person is excluded from meeting person picker lists';
