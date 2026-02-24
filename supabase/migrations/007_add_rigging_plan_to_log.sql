-- Add related_rigging_plan_id to log_entries for Rigging journaling (Phase 7B)
ALTER TABLE public.log_entries
  ADD COLUMN IF NOT EXISTS related_rigging_plan_id UUID DEFAULT NULL;

-- Index for filtering log entries by rigging plan
CREATE INDEX IF NOT EXISTS idx_log_entries_rigging_plan
  ON log_entries (related_rigging_plan_id)
  WHERE related_rigging_plan_id IS NOT NULL;
