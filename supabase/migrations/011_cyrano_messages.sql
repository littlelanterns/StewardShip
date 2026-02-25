-- Phase 9+ Enhancement: Dedicated Cyrano Messages table
-- Replaces Option A (spouse_insights with cyrano_draft category + JSONB metadata)
-- with Option B (proper typed columns for communication coaching tracking)

CREATE TABLE public.cyrano_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  people_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  raw_input TEXT NOT NULL,
  crafted_version TEXT NOT NULL,
  final_version TEXT,
  teaching_skill TEXT CHECK (teaching_skill IN (
    'specificity', 'her_lens', 'feeling_over_function',
    'timing', 'callback_power', 'unsaid_need', 'presence_proof'
  )),
  teaching_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'saved_for_later')),
  sent_at TIMESTAMPTZ,
  helm_conversation_id UUID REFERENCES helm_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cyrano_messages_user ON cyrano_messages (user_id, status);
CREATE INDEX idx_cyrano_messages_user_created ON cyrano_messages (user_id, created_at DESC);
CREATE INDEX idx_cyrano_messages_skill ON cyrano_messages (user_id, teaching_skill);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cyrano_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE cyrano_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own cyrano_messages"
  ON cyrano_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cyrano_messages"
  ON cyrano_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cyrano_messages"
  ON cyrano_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cyrano_messages"
  ON cyrano_messages FOR DELETE USING (auth.uid() = user_id);

-- Migrate any existing cyrano_draft insights to the new table
-- This handles the case where Cyrano was used between the Option A build and this migration
INSERT INTO cyrano_messages (user_id, people_id, raw_input, crafted_version, status, created_at)
SELECT
  si.user_id,
  si.person_id,
  si.text,
  si.text,
  'draft',
  si.created_at
FROM spouse_insights si
WHERE si.category = 'cyrano_draft'
  AND si.archived_at IS NULL;

-- Remove migrated cyrano_draft records from spouse_insights
-- They now live in the proper table
DELETE FROM spouse_insights WHERE category = 'cyrano_draft';
