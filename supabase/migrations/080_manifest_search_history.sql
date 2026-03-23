-- Search history for Manifest semantic search
CREATE TABLE IF NOT EXISTS manifest_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'any',
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manifest_search_history_user ON manifest_search_history(user_id, created_at DESC);

ALTER TABLE manifest_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own search history"
  ON manifest_search_history FOR ALL USING (auth.uid() = user_id);
