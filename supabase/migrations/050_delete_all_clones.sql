-- One-time cleanup: delete ALL cloned manifest items across all users.
-- Clones are items with source_manifest_item_id IS NOT NULL.
-- Since manifest_summaries, manifest_declarations, manifest_action_steps,
-- manifest_chunks, ai_frameworks (and ai_framework_principles via cascade)
-- all have ON DELETE CASCADE from manifest_items, deleting the item cascades everything.

-- Step 1: Clean up book_discussions that reference clone IDs
-- (book_discussions.manifest_item_ids is a UUID[] array, no FK cascade)
DELETE FROM book_discussion_messages
WHERE discussion_id IN (
  SELECT bd.id FROM book_discussions bd
  WHERE EXISTS (
    SELECT 1 FROM unnest(bd.manifest_item_ids) AS item_id
    JOIN manifest_items mi ON mi.id = item_id
    WHERE mi.source_manifest_item_id IS NOT NULL
  )
  -- Only delete discussions that ONLY reference clones
  AND NOT EXISTS (
    SELECT 1 FROM unnest(bd.manifest_item_ids) AS item_id
    JOIN manifest_items mi ON mi.id = item_id
    WHERE mi.source_manifest_item_id IS NULL
  )
);

DELETE FROM book_discussions
WHERE EXISTS (
  SELECT 1 FROM unnest(manifest_item_ids) AS item_id
  JOIN manifest_items mi ON mi.id = item_id
  WHERE mi.source_manifest_item_id IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM unnest(manifest_item_ids) AS item_id
  JOIN manifest_items mi ON mi.id = item_id
  WHERE mi.source_manifest_item_id IS NULL
);

-- For mixed discussions (both clones and originals), remove clone IDs from the array
UPDATE book_discussions
SET manifest_item_ids = (
  SELECT array_agg(item_id)
  FROM unnest(manifest_item_ids) AS item_id
  WHERE item_id NOT IN (
    SELECT id FROM manifest_items WHERE source_manifest_item_id IS NOT NULL
  )
)
WHERE EXISTS (
  SELECT 1 FROM unnest(manifest_item_ids) AS item_id
  JOIN manifest_items mi ON mi.id = item_id
  WHERE mi.source_manifest_item_id IS NOT NULL
);

-- Step 2: Delete all cloned manifest items (cascades to summaries, declarations,
-- action_steps, chunks, ai_frameworks, ai_framework_principles)
DELETE FROM manifest_items
WHERE source_manifest_item_id IS NOT NULL;
