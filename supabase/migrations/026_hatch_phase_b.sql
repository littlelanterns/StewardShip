-- 026_hatch_phase_b.sql
-- Phase B: Hatch extracted items + meeting agenda source tracking

-- ============================================
-- Table: hatch_extracted_items
-- Stores items extracted via Review & Route
-- ============================================

CREATE TABLE IF NOT EXISTS hatch_extracted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hatch_tab_id UUID NOT NULL REFERENCES hatch_tabs(id) ON DELETE CASCADE,
  extracted_text TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'action_item', 'reflection', 'revelation', 'value', 'victory',
    'trackable', 'meeting_followup', 'list_item', 'general'
  )),
  suggested_destination TEXT NOT NULL,
  actual_destination TEXT DEFAULT NULL,
  destination_record_id UUID DEFAULT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'routed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_hatch_extracted_items_tab ON hatch_extracted_items(hatch_tab_id);
CREATE INDEX idx_hatch_extracted_items_user_status ON hatch_extracted_items(user_id, status);

-- RLS
ALTER TABLE hatch_extracted_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extracted items"
  ON hatch_extracted_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extracted items"
  ON hatch_extracted_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extracted items"
  ON hatch_extracted_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extracted items"
  ON hatch_extracted_items FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON hatch_extracted_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Add source_hatch_tab_id to meeting_agenda_items
-- ============================================

ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS source_hatch_tab_id UUID REFERENCES hatch_tabs(id) ON DELETE SET NULL;
