-- Increase manifest-files bucket size limit from 50MB to 100MB
-- Some EPUBs with embedded images exceed 50MB
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'manifest-files';
