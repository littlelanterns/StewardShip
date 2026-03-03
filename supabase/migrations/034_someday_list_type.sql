-- Migration 034: Someday list type + victory_on_complete

-- Add victory_on_complete flag to lists
ALTER TABLE lists ADD COLUMN IF NOT EXISTS victory_on_complete BOOLEAN NOT NULL DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN lists.victory_on_complete IS 'When true, checking off items triggers victory celebration flow';
