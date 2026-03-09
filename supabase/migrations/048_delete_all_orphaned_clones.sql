-- One-time cleanup: delete ALL orphaned clones (where the original item no longer exists)
-- This catches "The Map" regardless of its exact title, plus any other orphans.

-- Delete framework principles on orphaned clones
DELETE FROM ai_framework_principles
WHERE framework_id IN (
  SELECT f.id FROM ai_frameworks f
  JOIN manifest_items i ON f.manifest_item_id = i.id
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete frameworks on orphaned clones
DELETE FROM ai_frameworks
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete summaries on orphaned clones
DELETE FROM manifest_summaries
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete declarations on orphaned clones
DELETE FROM manifest_declarations
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete action steps on orphaned clones
DELETE FROM manifest_action_steps
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete chunks on orphaned clones
DELETE FROM manifest_chunks
WHERE manifest_item_id IN (
  SELECT i.id FROM manifest_items i
  WHERE i.source_manifest_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM manifest_items orig WHERE orig.id = i.source_manifest_item_id
  )
);

-- Delete the orphaned clone items themselves
DELETE FROM manifest_items
WHERE source_manifest_item_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM manifest_items orig WHERE orig.id = source_manifest_item_id
);
