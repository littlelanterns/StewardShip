-- Migration 025: The Hatch — Universal capture notepad + routing hub (PRD-21)
-- Phase A: hatch_tabs, hatch_routing_stats, user_settings addition

-- ============================================================
-- hatch_tabs: Stores all Hatch capture tabs per user
-- ============================================================
CREATE TABLE IF NOT EXISTS hatch_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'routed', 'archived')),
  routed_to TEXT,
  routed_destination_id UUID,
  routed_meeting_id UUID,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'helm_edit', 'review_route', 'voice')),
  source_helm_conversation_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_auto_named BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  routed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_hatch_tabs_user ON hatch_tabs(user_id);
CREATE INDEX idx_hatch_tabs_status ON hatch_tabs(status);
CREATE INDEX idx_hatch_tabs_user_status ON hatch_tabs(user_id, status);
CREATE INDEX idx_hatch_tabs_updated ON hatch_tabs(updated_at DESC);

ALTER TABLE hatch_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own hatch tabs"
  ON hatch_tabs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_hatch_tabs_updated_at
  BEFORE UPDATE ON hatch_tabs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- hatch_routing_stats: Tracks per-user routing frequency for favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS hatch_routing_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  route_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one row per user per destination
ALTER TABLE hatch_routing_stats
  ADD CONSTRAINT hatch_routing_stats_user_destination_unique UNIQUE (user_id, destination);

ALTER TABLE hatch_routing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own hatch routing stats"
  ON hatch_routing_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_hatch_routing_stats_updated_at
  BEFORE UPDATE ON hatch_routing_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- user_settings: Add hatch_drawer_open preference
-- ============================================================
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS hatch_drawer_open BOOLEAN NOT NULL DEFAULT true;
