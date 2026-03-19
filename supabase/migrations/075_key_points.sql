-- PRD-25: Key Points — is_key_point boolean on all 5 extraction tables
-- Enables abridged view showing only the most important 2-3 items per section

ALTER TABLE manifest_summaries ADD COLUMN IF NOT EXISTS is_key_point BOOLEAN DEFAULT false;
ALTER TABLE manifest_declarations ADD COLUMN IF NOT EXISTS is_key_point BOOLEAN DEFAULT false;
ALTER TABLE manifest_action_steps ADD COLUMN IF NOT EXISTS is_key_point BOOLEAN DEFAULT false;
ALTER TABLE manifest_questions ADD COLUMN IF NOT EXISTS is_key_point BOOLEAN DEFAULT false;
ALTER TABLE ai_framework_principles ADD COLUMN IF NOT EXISTS is_key_point BOOLEAN DEFAULT false;

-- Backfill: Mark first 2 items per section per table as key points
-- (AI extraction outputs items roughly in order of importance)

-- Summaries: top 2 per (manifest_item_id, section_title) by sort_order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY manifest_item_id, COALESCE(section_title, '__full__')
    ORDER BY sort_order ASC
  ) AS rn
  FROM manifest_summaries WHERE is_deleted = false
)
UPDATE manifest_summaries SET is_key_point = true
WHERE id IN (SELECT id FROM ranked WHERE rn <= 2);

-- Declarations: top 2 per section
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY manifest_item_id, COALESCE(section_title, '__full__')
    ORDER BY sort_order ASC
  ) AS rn
  FROM manifest_declarations WHERE is_deleted = false
)
UPDATE manifest_declarations SET is_key_point = true
WHERE id IN (SELECT id FROM ranked WHERE rn <= 2);

-- Action Steps: top 2 per section
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY manifest_item_id, COALESCE(section_title, '__full__')
    ORDER BY sort_order ASC
  ) AS rn
  FROM manifest_action_steps WHERE is_deleted = false
)
UPDATE manifest_action_steps SET is_key_point = true
WHERE id IN (SELECT id FROM ranked WHERE rn <= 2);

-- Questions: top 2 per section
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY manifest_item_id, COALESCE(section_title, '__full__')
    ORDER BY sort_order ASC
  ) AS rn
  FROM manifest_questions WHERE is_deleted = false
)
UPDATE manifest_questions SET is_key_point = true
WHERE id IN (SELECT id FROM ranked WHERE rn <= 2);

-- Framework Principles: top 2 per section
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY framework_id, COALESCE(section_title, '__full__')
    ORDER BY sort_order ASC
  ) AS rn
  FROM ai_framework_principles WHERE (is_deleted = false OR is_deleted IS NULL)
)
UPDATE ai_framework_principles SET is_key_point = true
WHERE id IN (SELECT id FROM ranked WHERE rn <= 2);
