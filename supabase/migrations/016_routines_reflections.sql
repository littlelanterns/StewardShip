-- Migration 016: Routines, Reflections & Reports
-- Phase 9.5: Adds routine list type support, reflection questions/responses, and routine completion history

-- === Lists table: add routine-specific columns ===
ALTER TABLE lists ADD COLUMN IF NOT EXISTS reset_schedule TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS reset_custom_days INTEGER[];
ALTER TABLE lists ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ;

-- === List items: add notes column ===
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- === Routine Completion History ===
CREATE TABLE IF NOT EXISTS routine_completion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_completion_history_user ON routine_completion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_completion_history_list ON routine_completion_history(list_id);
CREATE INDEX IF NOT EXISTS idx_routine_completion_history_date ON routine_completion_history(completed_at DESC);

ALTER TABLE routine_completion_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own routine history"
  ON routine_completion_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === Reflection Questions ===
CREATE TABLE IF NOT EXISTS reflection_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_ai_suggested BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflection_questions_user ON reflection_questions(user_id);

ALTER TABLE reflection_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reflection questions"
  ON reflection_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER set_reflection_questions_updated_at
  BEFORE UPDATE ON reflection_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- === Reflection Responses ===
CREATE TABLE IF NOT EXISTS reflection_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES reflection_questions(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  response_date DATE NOT NULL DEFAULT CURRENT_DATE,
  routed_to_log BOOLEAN NOT NULL DEFAULT false,
  log_entry_id UUID REFERENCES log_entries(id) ON DELETE SET NULL,
  routed_to_victory BOOLEAN NOT NULL DEFAULT false,
  victory_id UUID REFERENCES victories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflection_responses_user ON reflection_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_responses_question ON reflection_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_reflection_responses_date ON reflection_responses(response_date DESC);
CREATE INDEX IF NOT EXISTS idx_reflection_responses_user_date ON reflection_responses(user_id, response_date);

ALTER TABLE reflection_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reflection responses"
  ON reflection_responses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER set_reflection_responses_updated_at
  BEFORE UPDATE ON reflection_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
