-- Manifest Collections: named, reusable groupings of books (many-to-many)

-- 1. Collections table
CREATE TABLE IF NOT EXISTS manifest_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manifest_collections_user
  ON manifest_collections(user_id);

ALTER TABLE manifest_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own collections"
  ON manifest_collections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_manifest_collections_updated_at
  BEFORE UPDATE ON manifest_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 2. Junction table (many-to-many: books ↔ collections)
CREATE TABLE IF NOT EXISTS manifest_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES manifest_collections(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES manifest_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, manifest_item_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection
  ON manifest_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_item
  ON manifest_collection_items(manifest_item_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_user
  ON manifest_collection_items(user_id);

ALTER TABLE manifest_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own collection items"
  ON manifest_collection_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
