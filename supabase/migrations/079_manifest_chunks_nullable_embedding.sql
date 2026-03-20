-- Allow manifest_chunks.embedding to be NULL so chunks can be inserted first,
-- then embeddings backfilled asynchronously by manifest-embed Edge Function.
-- This prevents "null value in column embedding violates not-null constraint" errors.
ALTER TABLE manifest_chunks ALTER COLUMN embedding DROP NOT NULL;
