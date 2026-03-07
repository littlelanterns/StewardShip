-- AI-generated 2-4 sentence summary of the item's content
ALTER TABLE manifest_items
  ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL;

-- Table of contents extracted from EPUB NCX/nav, PDF outline, DOCX headings, or MD headings
-- JSON array of { title: string, level: number } objects
ALTER TABLE manifest_items
  ADD COLUMN IF NOT EXISTS toc JSONB DEFAULT NULL;

COMMENT ON COLUMN manifest_items.ai_summary IS
  'AI-generated summary (2-4 sentences). Generated at intake or on demand via manifest-enrich.';

COMMENT ON COLUMN manifest_items.toc IS
  'Table of contents as JSON array: [{ title: string, level: number }]. Extracted during processing from EPUB NCX/nav, PDF outline, DOCX headings, or MD headings. Null when no TOC available.';
