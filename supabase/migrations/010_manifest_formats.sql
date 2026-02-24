-- Expand manifest-files bucket to accept EPUB, DOCX, TXT, MD formats
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm',
  'image/png', 'image/jpeg'
]
WHERE id = 'manifest-files';
