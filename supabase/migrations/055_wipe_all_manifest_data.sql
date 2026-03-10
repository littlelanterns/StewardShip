-- Wipe all manifest data so user can re-upload with retitled books
-- Infrastructure (tables, indexes, RLS, functions) remains intact

-- Extraction content
DELETE FROM public.manifest_summaries;
DELETE FROM public.manifest_declarations;
DELETE FROM public.manifest_action_steps;

-- Frameworks and principles
DELETE FROM public.ai_framework_principles;
DELETE FROM public.ai_frameworks;

-- Book discussions
DELETE FROM public.book_discussion_messages;
DELETE FROM public.book_discussions;

-- Chunks and embeddings
DELETE FROM public.manifest_chunks;

-- Books (including clones and parts)
DELETE FROM public.manifest_items;
