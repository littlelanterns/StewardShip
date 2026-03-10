-- Deduplicate cloned manifest_items per user.
-- When the same book was uploaded multiple times as separate originals, each got cloned
-- separately, resulting in 2-5 copies of the same book per non-source user.
--
-- Strategy: For each user, group by title. Keep the "best" copy (prefer extraction_status='completed',
-- then most chunks, then oldest). Archive the rest. Cascade-delete extraction data for archived dupes.

-- Step 1: Identify the "keeper" per user+title (the best clone to retain)
-- and archive all other duplicates
DO $$
DECLARE
  dupe_record RECORD;
  keeper_id UUID;
  archive_count INT := 0;
BEGIN
  -- For each user + title combo that has more than one non-archived item
  FOR dupe_record IN
    SELECT user_id, title, COUNT(*) as cnt
    FROM manifest_items
    WHERE archived_at IS NULL
      AND parent_manifest_item_id IS NULL
    GROUP BY user_id, title
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the best one to keep:
    -- 1. Prefer extraction_status = 'completed'
    -- 2. Then prefer processing_status = 'completed'
    -- 3. Then prefer most chunks
    -- 4. Then prefer original (non-clone) over clone
    -- 5. Then oldest (first created)
    SELECT id INTO keeper_id
    FROM manifest_items
    WHERE user_id = dupe_record.user_id
      AND title = dupe_record.title
      AND archived_at IS NULL
      AND parent_manifest_item_id IS NULL
    ORDER BY
      (CASE WHEN extraction_status = 'completed' THEN 0 ELSE 1 END),
      (CASE WHEN processing_status = 'completed' THEN 0 ELSE 1 END),
      COALESCE(chunk_count, 0) DESC,
      (CASE WHEN source_manifest_item_id IS NULL THEN 0 ELSE 1 END),
      created_at ASC
    LIMIT 1;

    -- Archive all duplicates except the keeper
    UPDATE manifest_items
    SET archived_at = NOW()
    WHERE user_id = dupe_record.user_id
      AND title = dupe_record.title
      AND archived_at IS NULL
      AND parent_manifest_item_id IS NULL
      AND id != keeper_id;

    GET DIAGNOSTICS archive_count = ROW_COUNT;
    RAISE NOTICE 'User % title "%" — kept %, archived % dupes',
      dupe_record.user_id, LEFT(dupe_record.title, 50), keeper_id, archive_count;
  END LOOP;
END $$;

-- Step 2: Hard-delete extraction data for archived duplicates (they're just noise)
-- Delete summaries for archived items
DELETE FROM manifest_summaries
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE archived_at IS NOT NULL
);

-- Delete declarations for archived items
DELETE FROM manifest_declarations
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE archived_at IS NOT NULL
);

-- Delete action steps for archived items
DELETE FROM manifest_action_steps
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE archived_at IS NOT NULL
);

-- Delete framework principles for frameworks linked to archived items
DELETE FROM ai_framework_principles
WHERE framework_id IN (
  SELECT af.id FROM ai_frameworks af
  JOIN manifest_items mi ON af.manifest_item_id = mi.id
  WHERE mi.archived_at IS NOT NULL
);

-- Delete frameworks for archived items
DELETE FROM ai_frameworks
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items WHERE archived_at IS NOT NULL
);

-- Step 3: Report final state
DO $$
DECLARE
  active_count INT;
  archived_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM manifest_items WHERE archived_at IS NULL AND parent_manifest_item_id IS NULL;

  SELECT COUNT(*) INTO archived_count
  FROM manifest_items WHERE archived_at IS NOT NULL AND parent_manifest_item_id IS NULL;

  RAISE NOTICE 'Deduplication complete: % active items, % archived items', active_count, archived_count;
END $$;
