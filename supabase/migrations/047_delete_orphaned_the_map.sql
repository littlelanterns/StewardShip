-- One-time cleanup: delete orphaned clones of "The Map"
-- The original was deleted by the admin, but clones persist in other users' libraries.
-- These are manifest_items with source_manifest_item_id pointing to a non-existent item.

-- First, delete any extraction data on orphaned Map clones
DELETE FROM ai_framework_principles
WHERE framework_id IN (
  SELECT f.id FROM ai_frameworks f
  JOIN manifest_items i ON f.manifest_item_id = i.id
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

DELETE FROM ai_frameworks
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

DELETE FROM manifest_summaries
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

DELETE FROM manifest_declarations
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

DELETE FROM manifest_action_steps
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

DELETE FROM manifest_chunks
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.title ILIKE '%the map%'
  AND i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Finally, delete the orphaned clone items themselves
DELETE FROM manifest_items
WHERE title ILIKE '%the map%'
AND source_manifest_item_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM manifest_items orig WHERE orig.id = source_manifest_item_id
);
