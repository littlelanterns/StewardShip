-- Phase 11F: Feature Guide System
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS show_feature_guides BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dismissed_guides TEXT[] NOT NULL DEFAULT '{}';
