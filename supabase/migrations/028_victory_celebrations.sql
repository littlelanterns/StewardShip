-- Victory Celebration Archive
CREATE TABLE victory_celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative TEXT NOT NULL,
  period TEXT NOT NULL,
  accomplishment_count INTEGER NOT NULL DEFAULT 0,
  accomplishment_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE victory_celebrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own celebrations"
  ON victory_celebrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own celebrations"
  ON victory_celebrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own celebrations"
  ON victory_celebrations FOR DELETE
  USING (user_id = auth.uid());

-- Index
CREATE INDEX idx_victory_celebrations_user_date
  ON victory_celebrations (user_id, created_at DESC);
