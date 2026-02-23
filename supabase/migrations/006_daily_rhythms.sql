-- Phase 6: Daily Rhythms (Reveille + Reckoning)

-- Create daily_rhythm_status table
CREATE TABLE daily_rhythm_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rhythm_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reveille_dismissed BOOLEAN NOT NULL DEFAULT false,
  reckoning_dismissed BOOLEAN NOT NULL DEFAULT false,
  gratitude_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  joy_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  anticipation_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  mast_thought_morning_id UUID NULL,
  morning_reading_source TEXT NULL,
  mast_thought_evening_id UUID NULL,
  evening_reading_source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE daily_rhythm_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rhythm status"
  ON daily_rhythm_status FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Unique constraint: one record per user per day
CREATE UNIQUE INDEX idx_daily_rhythm_status_user_date
  ON daily_rhythm_status(user_id, rhythm_date);

-- Add prompt_period to custom_trackers
ALTER TABLE custom_trackers
  ADD COLUMN IF NOT EXISTS prompt_period TEXT NULL;

ALTER TABLE custom_trackers
  ADD CONSTRAINT custom_trackers_prompt_period_check
  CHECK (prompt_period IN ('morning', 'evening', 'both') OR prompt_period IS NULL);
