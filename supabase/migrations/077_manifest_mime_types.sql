-- Add text/x-markdown to manifest-files bucket allowed MIME types
-- Browsers inconsistently report .md files as text/markdown, text/x-markdown,
-- or application/octet-stream, causing 400 errors on upload.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/octet-stream',
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm',
  'image/png', 'image/jpeg', 'image/webp'
]
WHERE id = 'manifest-files';
