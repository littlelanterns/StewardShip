-- Migration 044: Re-run framework section_title backfill
-- Migration 042 ran before cloned principles were created, so cloned items
-- still have NULL section_title. This re-runs the same logic.

DO $$
DECLARE
  fw RECORD;
  sec RECORD;
  principle_count INT;
  section_count INT;
  per_section INT;
  remainder INT;
  current_offset INT;
  current_batch INT;
BEGIN
  FOR fw IN
    SELECT DISTINCT af.id AS framework_id, af.manifest_item_id, af.user_id
    FROM ai_frameworks af
    JOIN ai_framework_principles afp ON afp.framework_id = af.id
    WHERE afp.section_title IS NULL
      AND af.manifest_item_id IS NOT NULL
  LOOP
    SELECT COUNT(*) INTO principle_count
    FROM ai_framework_principles
    WHERE framework_id = fw.framework_id AND section_title IS NULL;

    -- Get sections from summaries for this book+user
    SELECT COUNT(DISTINCT section_index) INTO section_count
    FROM manifest_summaries
    WHERE manifest_item_id = fw.manifest_item_id
      AND user_id = fw.user_id
      AND is_deleted = false
      AND section_title IS NOT NULL;

    -- If no summaries for this user (cloned item), try getting sections
    -- from the SOURCE item's summaries via source_manifest_item_id
    IF section_count = 0 THEN
      SELECT COUNT(DISTINCT ms.section_index) INTO section_count
      FROM manifest_summaries ms
      JOIN manifest_items mi ON mi.source_manifest_item_id = ms.manifest_item_id
        AND mi.id = fw.manifest_item_id
      WHERE ms.is_deleted = false
        AND ms.section_title IS NOT NULL;
    END IF;

    IF section_count = 0 OR principle_count = 0 THEN
      CONTINUE;
    END IF;

    per_section := principle_count / section_count;
    remainder := principle_count % section_count;
    current_offset := 0;

    -- Try user's own summaries first
    FOR sec IN
      (SELECT DISTINCT section_title, section_index
       FROM manifest_summaries
       WHERE manifest_item_id = fw.manifest_item_id
         AND user_id = fw.user_id
         AND is_deleted = false
         AND section_title IS NOT NULL
       ORDER BY section_index)
      UNION ALL
      -- Fall back to source item's summaries for cloned items
      (SELECT DISTINCT ms.section_title, ms.section_index
       FROM manifest_summaries ms
       JOIN manifest_items mi ON mi.source_manifest_item_id = ms.manifest_item_id
         AND mi.id = fw.manifest_item_id
       WHERE ms.is_deleted = false
         AND ms.section_title IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM manifest_summaries ms2
           WHERE ms2.manifest_item_id = fw.manifest_item_id
             AND ms2.user_id = fw.user_id
             AND ms2.is_deleted = false
             AND ms2.section_title IS NOT NULL
         )
       ORDER BY ms.section_index)
    LOOP
      current_batch := per_section;
      IF remainder > 0 THEN
        current_batch := current_batch + 1;
        remainder := remainder - 1;
      END IF;

      UPDATE ai_framework_principles
      SET section_title = sec.section_title
      WHERE framework_id = fw.framework_id
        AND section_title IS NULL
        AND id IN (
          SELECT id FROM ai_framework_principles
          WHERE framework_id = fw.framework_id
          ORDER BY sort_order
          LIMIT current_batch OFFSET current_offset
        );

      current_offset := current_offset + current_batch;
    END LOOP;

    RAISE NOTICE 'Updated % principles across % sections for framework %',
      principle_count, section_count, fw.framework_id;
  END LOOP;
END $$;
