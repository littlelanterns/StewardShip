-- Wipe ALL manifest-related data for every user EXCEPT the original book uploader.
-- The original uploader is identified as the user who owns manifest_items
-- with source_manifest_item_id IS NULL (i.e. the originals, not clones).

-- Step 1: Identify the original uploader
-- (Using a CTE so we can reference it throughout)

-- Delete book_discussion_messages for non-uploaders
DELETE FROM book_discussion_messages
WHERE discussion_id IN (
  SELECT id FROM book_discussions
  WHERE user_id NOT IN (
    SELECT DISTINCT user_id FROM manifest_items
    WHERE source_manifest_item_id IS NULL
  )
);

-- Delete book_discussions for non-uploaders
DELETE FROM book_discussions
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);

-- Delete framework principles for non-uploaders
DELETE FROM ai_framework_principles
WHERE framework_id IN (
  SELECT id FROM ai_frameworks
  WHERE user_id NOT IN (
    SELECT DISTINCT user_id FROM manifest_items
    WHERE source_manifest_item_id IS NULL
  )
);

-- Delete frameworks for non-uploaders
DELETE FROM ai_frameworks
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);

-- Delete summaries for non-uploaders
DELETE FROM manifest_summaries
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);

-- Delete declarations for non-uploaders
DELETE FROM manifest_declarations
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);

-- Delete action steps for non-uploaders
DELETE FROM manifest_action_steps
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);

-- Delete chunks for non-uploaders
DELETE FROM manifest_chunks
WHERE manifest_item_id IN (
  SELECT id FROM manifest_items
  WHERE user_id NOT IN (
    SELECT DISTINCT user_id FROM manifest_items
    WHERE source_manifest_item_id IS NULL
  )
);

-- Delete all manifest_items for non-uploaders
DELETE FROM manifest_items
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM manifest_items
  WHERE source_manifest_item_id IS NULL
);
