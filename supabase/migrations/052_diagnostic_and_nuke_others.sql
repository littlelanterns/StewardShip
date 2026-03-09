-- 80 items across 7 users. Delete everything for the 6 non-original users.
-- Strategy: the original uploader is the user with the most items.

DO $$
DECLARE
  original_uploader UUID;
  deleted_count INT;
BEGIN
  -- Find the user with the most manifest_items
  SELECT user_id INTO original_uploader
  FROM manifest_items
  GROUP BY user_id
  ORDER BY count(*) DESC
  LIMIT 1;

  RAISE NOTICE 'Original uploader: %', original_uploader;
  RAISE NOTICE 'Items to keep: %',
    (SELECT count(*) FROM manifest_items WHERE user_id = original_uploader);
  RAISE NOTICE 'Items to delete: %',
    (SELECT count(*) FROM manifest_items WHERE user_id != original_uploader);

  -- Delete book_discussion_messages for others
  DELETE FROM book_discussion_messages
  WHERE discussion_id IN (
    SELECT id FROM book_discussions WHERE user_id != original_uploader
  );

  -- Delete book_discussions for others
  DELETE FROM book_discussions WHERE user_id != original_uploader;

  -- Delete framework principles for others
  DELETE FROM ai_framework_principles
  WHERE framework_id IN (
    SELECT id FROM ai_frameworks WHERE user_id != original_uploader
  );

  -- Delete frameworks for others
  DELETE FROM ai_frameworks WHERE user_id != original_uploader;

  -- Delete summaries for others
  DELETE FROM manifest_summaries WHERE user_id != original_uploader;

  -- Delete declarations for others
  DELETE FROM manifest_declarations WHERE user_id != original_uploader;

  -- Delete action steps for others
  DELETE FROM manifest_action_steps WHERE user_id != original_uploader;

  -- Delete chunks for others
  DELETE FROM manifest_chunks
  WHERE manifest_item_id IN (
    SELECT id FROM manifest_items WHERE user_id != original_uploader
  );

  -- Delete manifest items for others
  DELETE FROM manifest_items WHERE user_id != original_uploader;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % items. Remaining: %', deleted_count,
    (SELECT count(*) FROM manifest_items);
END $$;
