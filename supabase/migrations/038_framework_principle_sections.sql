-- Add section_title to ai_framework_principles for grouping by source section
ALTER TABLE ai_framework_principles
ADD COLUMN IF NOT EXISTS section_title TEXT;
