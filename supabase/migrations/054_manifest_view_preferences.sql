-- Persist Manifest page view preferences
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS manifest_group_mode TEXT NOT NULL DEFAULT 'by_folder',
  ADD COLUMN IF NOT EXISTS manifest_sort TEXT NOT NULL DEFAULT 'newest',
  ADD COLUMN IF NOT EXISTS manifest_layout TEXT NOT NULL DEFAULT 'compact';
