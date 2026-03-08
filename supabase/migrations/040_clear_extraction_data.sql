-- Clear all extraction data for fresh re-extraction (single user, safe to wipe)
DELETE FROM ai_framework_principles;
DELETE FROM ai_frameworks;
DELETE FROM manifest_summaries;
DELETE FROM manifest_declarations;
UPDATE manifest_items SET extraction_status = 'none';
