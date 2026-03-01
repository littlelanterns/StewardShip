-- PRD-22: Priorities table + SLL exposures on user_profiles

-- === priorities table ===
CREATE TABLE public.priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  tier TEXT NOT NULL DEFAULT 'interested' CHECK (tier IN ('interested', 'committed_later', 'committed_now', 'achieved')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  linked_plan_id UUID REFERENCES public.rigging_plans(id) ON DELETE SET NULL,
  linked_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  linked_wheel_id UUID REFERENCES public.wheel_instances(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID,
  promoted_at TIMESTAMPTZ,
  achieved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_priorities_user_tier ON priorities(user_id, tier, archived_at);
CREATE INDEX idx_priorities_committed_now ON priorities(user_id)
  WHERE tier = 'committed_now' AND archived_at IS NULL;

-- Auto-update updated_at
CREATE TRIGGER set_priorities_updated_at
  BEFORE UPDATE ON priorities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own priorities"
  ON priorities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own priorities"
  ON priorities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own priorities"
  ON priorities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own priorities"
  ON priorities FOR DELETE USING (auth.uid() = user_id);

-- === SLL exposures on user_profiles ===
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS sll_exposures JSONB DEFAULT '{}';
