-- Push collections: track origin collection and previously pushed items for curation-aware re-push
ALTER TABLE manifest_collections
  ADD COLUMN source_collection_id UUID REFERENCES manifest_collections(id) ON DELETE SET NULL,
  ADD COLUMN pushed_item_source_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_manifest_collections_source
  ON manifest_collections(source_collection_id)
  WHERE source_collection_id IS NOT NULL;
