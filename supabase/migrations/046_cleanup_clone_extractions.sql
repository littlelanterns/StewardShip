-- One-time cleanup: delete all extractions from cloned items (non-original copies)
-- This affects items where source_manifest_item_id IS NOT NULL (i.e. books cloned to other users)
-- After this, the admin can re-push extractions via the Admin Book Manager

-- Delete framework principles on cloned items
DELETE FROM ai_framework_principles
WHERE framework_id IN (
  SELECT f.id FROM ai_frameworks f
  JOIN manifest_items i ON f.manifest_item_id = i.id
  WHERE i.source_manifest_item_id IS NOT NULL
);

-- Delete frameworks on cloned items
DELETE FROM ai_frameworks
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE source_manifest_item_id IS NOT NULL
);

-- Delete summaries on cloned items
DELETE FROM manifest_summaries
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE source_manifest_item_id IS NOT NULL
);

-- Delete declarations on cloned items
DELETE FROM manifest_declarations
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE source_manifest_item_id IS NOT NULL
);

-- Delete action steps on cloned items
DELETE FROM manifest_action_steps
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE source_manifest_item_id IS NOT NULL
);

-- Reset extraction_status on all cloned items
UPDATE manifest_items
SET extraction_status = 'none'
WHERE source_manifest_item_id IS NOT NULL
AND extraction_status IS NOT NULL
AND extraction_status != 'none';
