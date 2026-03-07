-- Migration 037: Add processing_detail column for real-time progress tracking
-- Shows the current processing stage (e.g., "Generating embeddings (batch 2 of 5)...")
ALTER TABLE manifest_items ADD COLUMN IF NOT EXISTS processing_detail TEXT;
