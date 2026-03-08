-- Migration 043: Fix extraction_status for books that have extraction data
-- Some books have extraction data (summaries/frameworks/declarations) but
-- extraction_status is not 'completed'. This fixes those records.

-- Update any manifest_items that have summaries but aren't marked completed
UPDATE manifest_items mi
SET extraction_status = 'completed'
WHERE extraction_status IS DISTINCT FROM 'completed'
  AND EXISTS (
    SELECT 1 FROM manifest_summaries ms
    WHERE ms.manifest_item_id = mi.id
      AND ms.user_id = mi.user_id
      AND ms.is_deleted = false
    LIMIT 1
  );
