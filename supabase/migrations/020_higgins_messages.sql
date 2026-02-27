-- Migration 020: Higgins — Crew Communication Coach
-- PRD-13A: Dedicated table for Higgins coaching messages

CREATE TABLE public.higgins_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  people_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('say_something', 'navigate_situation')),
  raw_input TEXT NOT NULL,
  crafted_version TEXT,
  final_version TEXT,
  teaching_skill TEXT CHECK (teaching_skill IN (
    'naming_emotion', 'perspective_shift', 'validation_first',
    'behavior_vs_identity', 'invitation', 'repair', 'boundaries_with_love'
  )),
  teaching_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'saved_for_later')),
  sent_at TIMESTAMPTZ,
  helm_conversation_id UUID REFERENCES helm_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.higgins_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own higgins messages" ON public.higgins_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_higgins_user_status ON public.higgins_messages(user_id, status);
CREATE INDEX idx_higgins_user_person_date ON public.higgins_messages(user_id, people_id, created_at DESC);
CREATE INDEX idx_higgins_user_skill ON public.higgins_messages(user_id, teaching_skill);

-- Auto-update trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.higgins_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
