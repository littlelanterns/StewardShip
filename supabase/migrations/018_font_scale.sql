-- Appearance & Accessibility: Font scale setting
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS font_scale TEXT NOT NULL DEFAULT 'default';

-- Allowed values: 'default', 'large', 'extra_large'
-- Theme column already exists (user_settings.theme) — no change needed
-- New theme values: 'deep_waters', 'hearthstone' (added to app-level enum, no DB constraint)
