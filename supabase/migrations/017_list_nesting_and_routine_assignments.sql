-- Migration 017: List item nesting + routine assignments

-- 1. List item nesting
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES list_items(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_list_items_parent ON list_items(parent_item_id);

-- 2. Routine assignments table
CREATE TABLE IF NOT EXISTS routine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  recurrence_rule TEXT NOT NULL DEFAULT 'daily',
  custom_days INTEGER[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_assignments_user ON routine_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_assignments_list ON routine_assignments(list_id);
CREATE INDEX IF NOT EXISTS idx_routine_assignments_status ON routine_assignments(status);

-- RLS
ALTER TABLE routine_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own routine assignments"
  ON routine_assignments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER set_routine_assignments_updated_at
  BEFORE UPDATE ON routine_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
