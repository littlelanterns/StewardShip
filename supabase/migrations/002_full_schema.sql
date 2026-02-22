-- ============================================================================
-- StewardShip: Full Database Schema (PRD-02 through PRD-18)
-- Skips user_profiles and user_settings (already in 001_auth_user_setup.sql)
-- ============================================================================
--
-- Table creation order respects FK dependencies:
--   1. Independent tables (only depend on auth.users)
--   2. Tables with structural parent FKs (hard-enforced)
--   3. Cross-feature optional references are UUID columns WITHOUT FK constraints
--      to avoid circular deps and cascading deletion across feature boundaries.
--
-- Every table gets: RLS enabled, CRUD policies, updated_at trigger (where applicable)
-- ============================================================================

-- ─── Enable pgvector extension (required for manifest_chunks) ───

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ─── Add FK from user_settings to mast_entries (deferred until mast_entries exists) ───
-- This will be added via ALTER TABLE at the end of the migration.


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-02: The Mast
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.mast_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mast_entries_user_type_active ON mast_entries (user_id, type, archived_at);
CREATE INDEX idx_mast_entries_user_archived ON mast_entries (user_id, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON mast_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE mast_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own mast_entries"
  ON mast_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mast_entries"
  ON mast_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mast_entries"
  ON mast_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own mast_entries"
  ON mast_entries FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-03: The Keel
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.keel_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'self_observed',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID DEFAULT NULL,
  file_storage_path TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keel_entries_user_cat_active ON keel_entries (user_id, category, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON keel_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE keel_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own keel_entries"
  ON keel_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own keel_entries"
  ON keel_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keel_entries"
  ON keel_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own keel_entries"
  ON keel_entries FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-04: The Helm
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.helm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT NULL,
  guided_mode TEXT DEFAULT NULL,
  guided_subtype TEXT DEFAULT NULL,
  guided_mode_reference_id UUID DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helm_conv_user_active ON helm_conversations (user_id, is_active);
CREATE INDEX idx_helm_conv_user_created ON helm_conversations (user_id, created_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON helm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE helm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own helm_conversations"
  ON helm_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own helm_conversations"
  ON helm_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own helm_conversations"
  ON helm_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own helm_conversations"
  ON helm_conversations FOR DELETE USING (auth.uid() = user_id);

-- ─── helm_messages (no updated_at — immutable) ───

CREATE TABLE public.helm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES helm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  page_context TEXT DEFAULT NULL,
  voice_transcript BOOLEAN NOT NULL DEFAULT false,
  file_storage_path TEXT DEFAULT NULL,
  file_type TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helm_messages_conv_created ON helm_messages (conversation_id, created_at);

ALTER TABLE helm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own helm_messages"
  ON helm_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own helm_messages"
  ON helm_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own helm_messages"
  ON helm_messages FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-12/13: People (shared for First Mate + Crew + Sphere)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  is_first_mate BOOLEAN NOT NULL DEFAULT false,
  categories TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT DEFAULT NULL,
  age INTEGER DEFAULT NULL,
  personality_summary TEXT DEFAULT NULL,
  love_language TEXT DEFAULT NULL,
  important_dates JSONB DEFAULT NULL,
  desired_sphere TEXT DEFAULT NULL,
  current_sphere TEXT DEFAULT NULL,
  has_rich_context BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_user_first_mate ON people (user_id, is_first_mate);
CREATE INDEX idx_people_user_reltype_active ON people (user_id, relationship_type, archived_at);
CREATE INDEX idx_people_user_active ON people (user_id, archived_at);
CREATE INDEX idx_people_user_sphere_active ON people (user_id, desired_sphere, archived_at);

-- Only one active First Mate per user
CREATE UNIQUE INDEX unique_first_mate_per_user ON people (user_id)
  WHERE is_first_mate = true AND archived_at IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own people"
  ON people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own people"
  ON people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own people"
  ON people FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own people"
  ON people FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-17: Meeting Templates (before meetings, since meetings references it)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.meeting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  default_frequency TEXT NOT NULL DEFAULT 'weekly',
  default_related_person_id UUID DEFAULT NULL,
  agenda_sections JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  file_storage_path TEXT DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_templates_user_active ON meeting_templates (user_id, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE meeting_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own meeting_templates"
  ON meeting_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting_templates"
  ON meeting_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting_templates"
  ON meeting_templates FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting_templates"
  ON meeting_templates FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-11: Wheel Instances
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.wheel_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hub_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  spoke_1_why TEXT DEFAULT NULL,
  spoke_2_start_date DATE DEFAULT NULL,
  spoke_2_checkpoint_date DATE DEFAULT NULL,
  spoke_2_notes TEXT DEFAULT NULL,
  spoke_3_who_i_am TEXT DEFAULT NULL,
  spoke_3_who_i_want_to_be TEXT DEFAULT NULL,
  spoke_4_supporter JSONB DEFAULT NULL,
  spoke_4_reminder JSONB DEFAULT NULL,
  spoke_4_observer JSONB DEFAULT NULL,
  spoke_5_evidence JSONB DEFAULT NULL,
  spoke_6_becoming JSONB DEFAULT NULL,
  current_spoke INTEGER NOT NULL DEFAULT 0,
  rim_interval_days INTEGER NOT NULL DEFAULT 14,
  next_rim_date DATE DEFAULT NULL,
  rim_count INTEGER NOT NULL DEFAULT 0,
  related_mast_entry_id UUID DEFAULT NULL,
  helm_conversation_id UUID DEFAULT NULL,
  life_area_tag TEXT DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wheel_user_status ON wheel_instances (user_id, status);
CREATE INDEX idx_wheel_user_rim ON wheel_instances (user_id, next_rim_date);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON wheel_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE wheel_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wheel_instances"
  ON wheel_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wheel_instances"
  ON wheel_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wheel_instances"
  ON wheel_instances FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wheel_instances"
  ON wheel_instances FOR DELETE USING (auth.uid() = user_id);

-- ─── wheel_rim_entries (no updated_at) ───

CREATE TABLE public.wheel_rim_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wheel_id UUID NOT NULL REFERENCES wheel_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rim_number INTEGER NOT NULL,
  notes TEXT DEFAULT NULL,
  spoke_updates JSONB DEFAULT NULL,
  evidence_progress JSONB DEFAULT NULL,
  new_actions JSONB DEFAULT NULL,
  helm_conversation_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wheel_rim_wheel_num ON wheel_rim_entries (wheel_id, rim_number);

ALTER TABLE wheel_rim_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wheel_rim_entries"
  ON wheel_rim_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wheel_rim_entries"
  ON wheel_rim_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wheel_rim_entries"
  ON wheel_rim_entries FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-11: Life Inventory
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.life_inventory_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_name TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL,
  baseline_summary TEXT DEFAULT NULL,
  baseline_date DATE DEFAULT NULL,
  current_summary TEXT DEFAULT NULL,
  current_assessed_date DATE DEFAULT NULL,
  vision_summary TEXT DEFAULT NULL,
  vision_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_life_inv_user_order ON life_inventory_areas (user_id, display_order);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON life_inventory_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE life_inventory_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own life_inventory_areas"
  ON life_inventory_areas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own life_inventory_areas"
  ON life_inventory_areas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life_inventory_areas"
  ON life_inventory_areas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own life_inventory_areas"
  ON life_inventory_areas FOR DELETE USING (auth.uid() = user_id);

-- ─── life_inventory_snapshots (no updated_at) ───

CREATE TABLE public.life_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES life_inventory_areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  helm_conversation_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_life_inv_snap_area_type ON life_inventory_snapshots (area_id, snapshot_type, created_at DESC);

ALTER TABLE life_inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own life_inventory_snapshots"
  ON life_inventory_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own life_inventory_snapshots"
  ON life_inventory_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own life_inventory_snapshots"
  ON life_inventory_snapshots FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-16: Rigging
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.rigging_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  planning_framework TEXT DEFAULT NULL,
  frameworks_used TEXT[] NOT NULL DEFAULT '{}',
  moscow_must_have TEXT[] NOT NULL DEFAULT '{}',
  moscow_should_have TEXT[] NOT NULL DEFAULT '{}',
  moscow_could_have TEXT[] NOT NULL DEFAULT '{}',
  moscow_wont_have TEXT[] NOT NULL DEFAULT '{}',
  ten_ten_ten_decision TEXT DEFAULT NULL,
  ten_ten_ten_10_days TEXT DEFAULT NULL,
  ten_ten_ten_10_months TEXT DEFAULT NULL,
  ten_ten_ten_10_years TEXT DEFAULT NULL,
  ten_ten_ten_conclusion TEXT DEFAULT NULL,
  related_mast_entry_ids UUID[] NOT NULL DEFAULT '{}',
  related_goal_ids UUID[] NOT NULL DEFAULT '{}',
  nudge_approaching_milestones BOOLEAN NOT NULL DEFAULT true,
  nudge_related_conversations BOOLEAN NOT NULL DEFAULT true,
  nudge_overdue_milestones BOOLEAN NOT NULL DEFAULT false,
  helm_conversation_id UUID DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rigging_plans_user_status ON rigging_plans (user_id, status, archived_at);
CREATE INDEX idx_rigging_plans_user_updated ON rigging_plans (user_id, updated_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE rigging_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rigging_plans"
  ON rigging_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rigging_plans"
  ON rigging_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rigging_plans"
  ON rigging_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own rigging_plans"
  ON rigging_plans FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-07: Goals (depends on mast_entries, wheel_instances, rigging_plans — soft refs)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  life_area_tag TEXT DEFAULT NULL,
  target_date DATE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  progress_type TEXT NOT NULL DEFAULT 'percentage',
  progress_current NUMERIC NOT NULL DEFAULT 0,
  progress_target NUMERIC DEFAULT 100,
  related_mast_entry_id UUID DEFAULT NULL,
  related_wheel_id UUID DEFAULT NULL,
  related_rigging_plan_id UUID DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user_status ON goals (user_id, status, archived_at);
CREATE INDEX idx_goals_user_area ON goals (user_id, life_area_tag);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own goals"
  ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE USING (auth.uid() = user_id);


-- ─── rigging_milestones (depends on rigging_plans, goals — soft ref to goals) ───

CREATE TABLE public.rigging_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES rigging_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_date DATE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  task_breaker_level TEXT DEFAULT NULL,
  related_goal_id UUID DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rigging_ms_plan_order ON rigging_milestones (plan_id, sort_order);
CREATE INDEX idx_rigging_ms_user_status ON rigging_milestones (user_id, status, target_date);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE rigging_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rigging_milestones"
  ON rigging_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rigging_milestones"
  ON rigging_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rigging_milestones"
  ON rigging_milestones FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own rigging_milestones"
  ON rigging_milestones FOR DELETE USING (auth.uid() = user_id);


-- ─── rigging_obstacles ───

CREATE TABLE public.rigging_obstacles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES rigging_plans(id) ON DELETE CASCADE,
  risk_description TEXT NOT NULL,
  mitigation_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'watching',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rigging_obs_plan_order ON rigging_obstacles (plan_id, sort_order);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_obstacles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE rigging_obstacles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rigging_obstacles"
  ON rigging_obstacles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rigging_obstacles"
  ON rigging_obstacles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rigging_obstacles"
  ON rigging_obstacles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own rigging_obstacles"
  ON rigging_obstacles FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-05: The Log
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'journal',
  life_area_tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual_text',
  source_reference_id UUID DEFAULT NULL,
  audio_file_path TEXT DEFAULT NULL,
  routed_to TEXT[] NOT NULL DEFAULT '{}',
  routed_reference_ids JSONB NOT NULL DEFAULT '{}',
  related_wheel_id UUID DEFAULT NULL,
  related_meeting_id UUID DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_log_entries_user_created ON log_entries (user_id, created_at DESC);
CREATE INDEX idx_log_entries_user_type_active ON log_entries (user_id, entry_type, archived_at);
CREATE INDEX idx_log_entries_user_active ON log_entries (user_id, archived_at);
CREATE INDEX idx_log_entries_life_area_tags ON log_entries USING GIN (life_area_tags);

-- Full-text search index
CREATE INDEX idx_log_entries_text_search ON log_entries
  USING GIN (to_tsvector('english', text));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON log_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own log_entries"
  ON log_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own log_entries"
  ON log_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own log_entries"
  ON log_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own log_entries"
  ON log_entries FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-06: The Compass + Task Breaker
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.compass_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE DEFAULT CURRENT_DATE,
  recurrence_rule TEXT DEFAULT NULL,
  life_area_tag TEXT DEFAULT NULL,
  eisenhower_quadrant TEXT DEFAULT NULL,
  frog_rank INTEGER DEFAULT NULL,
  importance_level TEXT DEFAULT NULL,
  big_rock BOOLEAN NOT NULL DEFAULT false,
  ivy_lee_rank INTEGER DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_task_id UUID DEFAULT NULL REFERENCES compass_tasks(id) ON DELETE SET NULL,
  task_breaker_level TEXT DEFAULT NULL,
  related_goal_id UUID DEFAULT NULL,
  related_wheel_id UUID DEFAULT NULL,
  related_meeting_id UUID DEFAULT NULL,
  related_rigging_plan_id UUID DEFAULT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID DEFAULT NULL,
  victory_flagged BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compass_user_date_status ON compass_tasks (user_id, due_date, status);
CREATE INDEX idx_compass_user_status_active ON compass_tasks (user_id, status, archived_at);
CREATE INDEX idx_compass_user_area ON compass_tasks (user_id, life_area_tag);
CREATE INDEX idx_compass_parent ON compass_tasks (parent_task_id);
CREATE INDEX idx_compass_user_goal ON compass_tasks (user_id, related_goal_id);
CREATE INDEX idx_compass_user_wheel ON compass_tasks (user_id, related_wheel_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON compass_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE compass_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own compass_tasks"
  ON compass_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own compass_tasks"
  ON compass_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own compass_tasks"
  ON compass_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own compass_tasks"
  ON compass_tasks FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-06: Lists
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'custom',
  ai_action TEXT NOT NULL DEFAULT 'store_only',
  share_token TEXT DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lists_user_active ON lists (user_id, archived_at);
CREATE UNIQUE INDEX idx_lists_share_token ON lists (share_token) WHERE share_token IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own lists"
  ON lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lists"
  ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_list_items_list_order ON list_items (list_id, sort_order);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own list_items"
  ON list_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own list_items"
  ON list_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own list_items"
  ON list_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own list_items"
  ON list_items FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-07: Charts — Custom Trackers
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.custom_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tracking_type TEXT NOT NULL,
  target_value NUMERIC DEFAULT NULL,
  visualization TEXT NOT NULL DEFAULT 'line_graph',
  life_area_tag TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_trackers_user_active ON custom_trackers (user_id, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_trackers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE custom_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own custom_trackers"
  ON custom_trackers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom_trackers"
  ON custom_trackers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom_trackers"
  ON custom_trackers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom_trackers"
  ON custom_trackers FOR DELETE USING (auth.uid() = user_id);


-- ─── tracker_entries (no updated_at — replaced, not updated) ───

CREATE TABLE public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES custom_trackers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value_numeric NUMERIC DEFAULT NULL,
  value_boolean BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tracker_entries_unique_date UNIQUE (tracker_id, entry_date)
);

CREATE INDEX idx_tracker_entries_tracker_date ON tracker_entries (tracker_id, entry_date);
CREATE INDEX idx_tracker_entries_user_date ON tracker_entries (user_id, entry_date);

ALTER TABLE tracker_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own tracker_entries"
  ON tracker_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracker_entries"
  ON tracker_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracker_entries"
  ON tracker_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracker_entries"
  ON tracker_entries FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-08: Victory Recorder
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.victories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  celebration_text TEXT DEFAULT NULL,
  life_area_tag TEXT DEFAULT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference_id UUID DEFAULT NULL,
  related_mast_entry_id UUID DEFAULT NULL,
  related_wheel_id UUID DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_victories_user_created ON victories (user_id, created_at DESC);
CREATE INDEX idx_victories_user_area ON victories (user_id, life_area_tag);
CREATE INDEX idx_victories_user_source ON victories (user_id, source);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON victories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE victories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own victories"
  ON victories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own victories"
  ON victories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own victories"
  ON victories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own victories"
  ON victories FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-10: Daily Rhythm Status (no updated_at)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.daily_rhythm_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rhythm_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reveille_dismissed BOOLEAN NOT NULL DEFAULT false,
  reckoning_dismissed BOOLEAN NOT NULL DEFAULT false,
  gratitude_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  joy_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  anticipation_prompt_completed BOOLEAN NOT NULL DEFAULT false,
  mast_thought_morning_id UUID DEFAULT NULL,
  morning_reading_source TEXT DEFAULT NULL,
  mast_thought_evening_id UUID DEFAULT NULL,
  evening_reading_source TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_rhythm_unique_date UNIQUE (user_id, rhythm_date)
);

ALTER TABLE daily_rhythm_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own daily_rhythm_status"
  ON daily_rhythm_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_rhythm_status"
  ON daily_rhythm_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_rhythm_status"
  ON daily_rhythm_status FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-12: Spouse Insights + Prompts
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.spouse_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_label TEXT DEFAULT NULL,
  source_reference_id UUID DEFAULT NULL,
  file_storage_path TEXT DEFAULT NULL,
  is_rag_indexed BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spouse_insights_person_cat ON spouse_insights (user_id, person_id, category, archived_at);
CREATE INDEX idx_spouse_insights_person_active ON spouse_insights (user_id, person_id, archived_at);
CREATE INDEX idx_spouse_insights_person_source ON spouse_insights (user_id, person_id, source_type);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON spouse_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE spouse_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own spouse_insights"
  ON spouse_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spouse_insights"
  ON spouse_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spouse_insights"
  ON spouse_insights FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own spouse_insights"
  ON spouse_insights FOR DELETE USING (auth.uid() = user_id);


-- ─── spouse_prompts (no updated_at) ───

CREATE TABLE public.spouse_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_text TEXT DEFAULT NULL,
  response_saved_as_insight BOOLEAN NOT NULL DEFAULT false,
  insight_id UUID DEFAULT NULL,
  generation_context TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_on_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_spouse_prompts_person_status ON spouse_prompts (user_id, person_id, status);
CREATE INDEX idx_spouse_prompts_person_created ON spouse_prompts (user_id, person_id, created_at DESC);

ALTER TABLE spouse_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own spouse_prompts"
  ON spouse_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spouse_prompts"
  ON spouse_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spouse_prompts"
  ON spouse_prompts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own spouse_prompts"
  ON spouse_prompts FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-13: Crew Notes + Sphere Entities
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.crew_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_label TEXT DEFAULT NULL,
  source_reference_id UUID DEFAULT NULL,
  file_storage_path TEXT DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crew_notes_person_cat ON crew_notes (user_id, person_id, category, archived_at);
CREATE INDEX idx_crew_notes_person_active ON crew_notes (user_id, person_id, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON crew_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE crew_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own crew_notes"
  ON crew_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crew_notes"
  ON crew_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own crew_notes"
  ON crew_notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own crew_notes"
  ON crew_notes FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE public.sphere_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_category TEXT NOT NULL,
  desired_sphere TEXT NOT NULL,
  current_sphere TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sphere_entities_user_sphere ON sphere_entities (user_id, desired_sphere, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON sphere_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE sphere_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sphere_entities"
  ON sphere_entities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sphere_entities"
  ON sphere_entities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sphere_entities"
  ON sphere_entities FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sphere_entities"
  ON sphere_entities FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-15: The Manifest (Knowledge Base & RAG)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.manifest_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT DEFAULT NULL,
  storage_path TEXT DEFAULT NULL,
  text_content TEXT DEFAULT NULL,
  file_size_bytes INTEGER DEFAULT NULL,
  usage_designations TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  folder_group TEXT NOT NULL DEFAULT 'uncategorized',
  related_wheel_id UUID DEFAULT NULL,
  related_goal_id UUID DEFAULT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  intake_completed BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manifest_items_user_active ON manifest_items (user_id, archived_at);
CREATE INDEX idx_manifest_items_user_folder ON manifest_items (user_id, folder_group, archived_at);
CREATE INDEX idx_manifest_items_user_status ON manifest_items (user_id, processing_status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON manifest_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE manifest_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own manifest_items"
  ON manifest_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manifest_items"
  ON manifest_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manifest_items"
  ON manifest_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own manifest_items"
  ON manifest_items FOR DELETE USING (auth.uid() = user_id);


-- ─── manifest_chunks (pgvector, no updated_at) ───

CREATE TABLE public.manifest_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manifest_chunks_item ON manifest_chunks (manifest_item_id);

-- HNSW index for similarity search
CREATE INDEX idx_manifest_chunks_embedding ON manifest_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE manifest_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own manifest_chunks"
  ON manifest_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manifest_chunks"
  ON manifest_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own manifest_chunks"
  ON manifest_chunks FOR DELETE USING (auth.uid() = user_id);


-- ─── RAG similarity search function ───

CREATE OR REPLACE FUNCTION public.match_manifest_chunks(
  query_embedding extensions.vector(1536),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  manifest_item_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT mc.id, mc.manifest_item_id, mc.chunk_text, mc.metadata,
    (1 - (mc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM manifest_chunks mc
  JOIN manifest_items mi ON mc.manifest_item_id = mi.id
  WHERE mc.user_id = p_user_id
    AND mi.archived_at IS NULL
    AND mi.processing_status = 'completed'
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


-- ─── ai_frameworks ───

CREATE TABLE public.ai_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_frameworks_user_active ON ai_frameworks (user_id, is_active, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE ai_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own ai_frameworks"
  ON ai_frameworks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_frameworks"
  ON ai_frameworks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_frameworks"
  ON ai_frameworks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_frameworks"
  ON ai_frameworks FOR DELETE USING (auth.uid() = user_id);


-- ─── ai_framework_principles ───

CREATE TABLE public.ai_framework_principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES ai_frameworks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_user_added BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_fw_principles_order ON ai_framework_principles (framework_id, sort_order, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_framework_principles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE ai_framework_principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own ai_framework_principles"
  ON ai_framework_principles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_framework_principles"
  ON ai_framework_principles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_framework_principles"
  ON ai_framework_principles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_framework_principles"
  ON ai_framework_principles FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-17: Meetings + Schedules
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL,
  template_id UUID DEFAULT NULL REFERENCES meeting_templates(id) ON DELETE SET NULL,
  related_person_id UUID DEFAULT NULL REFERENCES people(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  entry_mode TEXT NOT NULL DEFAULT 'live',
  summary TEXT DEFAULT NULL,
  impressions TEXT DEFAULT NULL,
  helm_conversation_id UUID DEFAULT NULL,
  log_entry_id UUID DEFAULT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_user_type_date ON meetings (user_id, meeting_type, meeting_date DESC);
CREATE INDEX idx_meetings_user_person_date ON meetings (user_id, related_person_id, meeting_date DESC);
CREATE INDEX idx_meetings_user_status ON meetings (user_id, status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own meetings"
  ON meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meetings"
  ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings"
  ON meetings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings"
  ON meetings FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE public.meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL,
  template_id UUID DEFAULT NULL REFERENCES meeting_templates(id) ON DELETE SET NULL,
  related_person_id UUID DEFAULT NULL REFERENCES people(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  custom_interval_days INTEGER DEFAULT NULL,
  preferred_day TEXT DEFAULT NULL,
  preferred_time TIME DEFAULT NULL,
  notification_type TEXT NOT NULL DEFAULT 'reveille',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_completed_date DATE DEFAULT NULL,
  next_due_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_sched_user_active ON meeting_schedules (user_id, is_active, next_due_date);
CREATE INDEX idx_meeting_sched_user_type ON meeting_schedules (user_id, meeting_type);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE meeting_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own meeting_schedules"
  ON meeting_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting_schedules"
  ON meeting_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting_schedules"
  ON meeting_schedules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting_schedules"
  ON meeting_schedules FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- PRD-18: Reminders + Push Subscriptions + Rhythm Status
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'reveille_batch',
  scheduled_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  snoozed_until TIMESTAMPTZ DEFAULT NULL,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  related_entity_type TEXT DEFAULT NULL,
  related_entity_id UUID DEFAULT NULL,
  source_feature TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_user_status_sched ON reminders (user_id, status, scheduled_at);
CREATE INDEX idx_reminders_user_status_method ON reminders (user_id, status, delivery_method);
CREATE INDEX idx_reminders_user_type_status ON reminders (user_id, reminder_type, status);
CREATE INDEX idx_reminders_user_entity ON reminders (user_id, related_entity_type, related_entity_id);
CREATE INDEX idx_reminders_user_active ON reminders (user_id, archived_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own reminders"
  ON reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_label TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subs_user_active ON push_subscriptions (user_id, is_active);
CREATE UNIQUE INDEX idx_push_subs_endpoint ON push_subscriptions (endpoint);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own push_subscriptions"
  ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push_subscriptions"
  ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push_subscriptions"
  ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push_subscriptions"
  ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);


-- ─── rhythm_status (no updated_at) ───

CREATE TABLE public.rhythm_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rhythm_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shown_at TIMESTAMPTZ DEFAULT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rhythm_status_unique_period UNIQUE (user_id, rhythm_type, period_key)
);

ALTER TABLE rhythm_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rhythm_status"
  ON rhythm_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rhythm_status"
  ON rhythm_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rhythm_status"
  ON rhythm_status FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- Deferred FK: user_settings.mast_thought_pinned_id → mast_entries
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_settings
  ADD CONSTRAINT fk_user_settings_mast_pinned
  FOREIGN KEY (mast_thought_pinned_id) REFERENCES mast_entries(id)
  ON DELETE SET NULL;
