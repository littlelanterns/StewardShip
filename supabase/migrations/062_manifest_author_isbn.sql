-- Migration 062: Add author and ISBN metadata to manifest_items
-- Supports format-native extraction (EPUB OPF, PDF info dict, DOCX core.xml)
-- and AI-based fallback via manifest-enrich Edge Function.

ALTER TABLE manifest_items
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT NULL;

ALTER TABLE manifest_items
  ADD COLUMN IF NOT EXISTS isbn TEXT DEFAULT NULL;

COMMENT ON COLUMN manifest_items.author IS
  'Book author(s). Extracted from EPUB OPF dc:creator, PDF info dict, DOCX core.xml, or AI enrichment. Comma-separated if multiple authors.';

COMMENT ON COLUMN manifest_items.isbn IS
  'ISBN-10 or ISBN-13. Extracted from EPUB OPF dc:identifier or AI enrichment. Null when unavailable.';
