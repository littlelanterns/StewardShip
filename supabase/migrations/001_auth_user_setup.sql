-- PRD-01: Auth & User Setup
-- Tables: user_profiles, user_settings
-- Triggers: handle_new_user, update_updated_at

-- ─── updated_at trigger function ───

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── user_profiles ───

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── user_settings ───

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL DEFAULT 'openrouter',
  ai_api_key_encrypted TEXT DEFAULT NULL,
  ai_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet',
  max_tokens INTEGER NOT NULL DEFAULT 1024,
  context_window_size TEXT NOT NULL DEFAULT 'medium',
  reveille_enabled BOOLEAN NOT NULL DEFAULT true,
  reveille_time TIME NOT NULL DEFAULT '07:00',
  reckoning_enabled BOOLEAN NOT NULL DEFAULT true,
  reckoning_time TIME NOT NULL DEFAULT '21:00',
  default_compass_view TEXT NOT NULL DEFAULT 'simple_list',
  theme TEXT NOT NULL DEFAULT 'captains_quarters',
  push_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  gratitude_prompt_frequency TEXT NOT NULL DEFAULT 'daily',
  joy_prompt_frequency TEXT NOT NULL DEFAULT 'every_few_days',
  anticipation_prompt_frequency TEXT NOT NULL DEFAULT 'weekly',
  mast_thought_rotation TEXT NOT NULL DEFAULT 'daily',
  mast_thought_pinned_id UUID DEFAULT NULL,
  morning_reading_sources TEXT[] NOT NULL DEFAULT '{mast,manifest,log}',
  journal_export_reminder BOOLEAN NOT NULL DEFAULT false,
  friday_overview_enabled BOOLEAN NOT NULL DEFAULT true,
  friday_overview_time TIME NOT NULL DEFAULT '17:00',
  friday_overview_day TEXT NOT NULL DEFAULT 'friday',
  sunday_reflection_enabled BOOLEAN NOT NULL DEFAULT true,
  sunday_reflection_time TIME NOT NULL DEFAULT '19:00',
  sunday_reflection_day TEXT NOT NULL DEFAULT 'sunday',
  monthly_review_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_review_day INTEGER NOT NULL DEFAULT 1,
  quarterly_inventory_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT NULL,
  important_dates_advance_days INTEGER NOT NULL DEFAULT 1,
  max_daily_push INTEGER NOT NULL DEFAULT 5,
  notification_tasks TEXT NOT NULL DEFAULT 'reveille_batch',
  notification_meetings TEXT NOT NULL DEFAULT 'reveille_batch',
  notification_people TEXT NOT NULL DEFAULT 'push',
  notification_growth TEXT NOT NULL DEFAULT 'reveille_batch',
  notification_streaks TEXT NOT NULL DEFAULT 'reckoning_batch',
  notification_rhythms TEXT NOT NULL DEFAULT 'push',
  notification_custom TEXT NOT NULL DEFAULT 'push',
  google_calendar_token TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Auto-create profile and settings on signup ───

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Steward'),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'America/Chicago')
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
