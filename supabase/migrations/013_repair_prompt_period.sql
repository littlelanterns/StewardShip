-- Repair: prompt_period column was defined in migration 006 but not applied to the remote DB.
-- Re-applying with IF NOT EXISTS to be safe.

ALTER TABLE custom_trackers
  ADD COLUMN IF NOT EXISTS prompt_period TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custom_trackers_prompt_period_check'
  ) THEN
    ALTER TABLE custom_trackers
      ADD CONSTRAINT custom_trackers_prompt_period_check
      CHECK (prompt_period IN ('morning', 'evening', 'both') OR prompt_period IS NULL);
  END IF;
END $$;
