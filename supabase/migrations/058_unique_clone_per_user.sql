-- Prevent duplicate clones: each user can only have one clone of a given source item.
-- First remove any remaining duplicates (keep oldest per user+source pair).
DELETE FROM manifest_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, source_manifest_item_id
             ORDER BY created_at ASC
           ) AS rn
    FROM manifest_items
    WHERE source_manifest_item_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Now add the unique constraint (partial — only applies when source_manifest_item_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_items_unique_clone
  ON manifest_items (user_id, source_manifest_item_id)
  WHERE source_manifest_item_id IS NOT NULL AND archived_at IS NULL;
