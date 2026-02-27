-- Migration 022: Meeting agenda items
-- Allows users to add discussion items between meetings that carry forward

CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL,
  related_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  template_id UUID REFERENCES meeting_templates(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  discussed_in_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- status enum: 'pending' (not yet discussed), 'discussed' (addressed in a meeting), 'deferred' (explicitly pushed to next meeting)

CREATE INDEX idx_meeting_agenda_items_user_type ON meeting_agenda_items(user_id, meeting_type, status);
CREATE INDEX idx_meeting_agenda_items_user_person ON meeting_agenda_items(user_id, related_person_id, status);
CREATE INDEX idx_meeting_agenda_items_meeting ON meeting_agenda_items(discussed_in_meeting_id);

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agenda items"
  ON meeting_agenda_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_meeting_agenda_items_updated_at
  BEFORE UPDATE ON meeting_agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
