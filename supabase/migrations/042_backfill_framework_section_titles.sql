-- Migration 042: Backfill section_title on ai_framework_principles
-- Principles were extracted per-section but section_title was not saved.
-- This uses a heuristic: principles are ordered by sort_order matching the
-- section processing order. We assign section_titles from manifest_summaries
-- sections to groups of principles proportionally.

-- For each framework linked to a manifest_item, get the ordered list of
-- distinct sections from manifest_summaries, then distribute principles
-- across those sections based on sort_order grouping.

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
  -- Process each framework that has principles with NULL section_title
  FOR fw IN
    SELECT DISTINCT af.id AS framework_id, af.manifest_item_id, af.user_id
    FROM ai_frameworks af
    JOIN ai_framework_principles afp ON afp.framework_id = af.id
    WHERE afp.section_title IS NULL
      AND af.manifest_item_id IS NOT NULL
  LOOP
    -- Count principles for this framework
    SELECT COUNT(*) INTO principle_count
    FROM ai_framework_principles
    WHERE framework_id = fw.framework_id AND section_title IS NULL;

    -- Get ordered sections from manifest_summaries for this book+user
    SELECT COUNT(DISTINCT section_index) INTO section_count
    FROM manifest_summaries
    WHERE manifest_item_id = fw.manifest_item_id
      AND user_id = fw.user_id
      AND is_deleted = false
      AND section_title IS NOT NULL;

    -- Skip if no sections found or no principles
    IF section_count = 0 OR principle_count = 0 THEN
      CONTINUE;
    END IF;

    -- Distribute principles evenly across sections
    per_section := principle_count / section_count;
    remainder := principle_count % section_count;
    current_offset := 0;

    FOR sec IN
      SELECT DISTINCT section_title, section_index
      FROM manifest_summaries
      WHERE manifest_item_id = fw.manifest_item_id
        AND user_id = fw.user_id
        AND is_deleted = false
        AND section_title IS NOT NULL
      ORDER BY section_index
    LOOP
      -- Give one extra to early sections if there's a remainder
      current_batch := per_section;
      IF remainder > 0 THEN
        current_batch := current_batch + 1;
        remainder := remainder - 1;
      END IF;

      -- Update principles in this sort_order range
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
