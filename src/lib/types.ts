// PRD-01: Auth & User Setup

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
export type RelationshipStatus = 'single' | 'dating' | 'married' | 'divorced' | 'widowed';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  timezone: string;
  onboarding_completed: boolean;
  gender: Gender | null;
  relationship_status: RelationshipStatus | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  ai_provider: 'openrouter' | 'gemini' | 'openai';
  ai_api_key_encrypted: string | null;
  ai_model: string;
  max_tokens: number;
  context_window_size: 'short' | 'medium' | 'long';
  reveille_enabled: boolean;
  reveille_time: string;
  reckoning_enabled: boolean;
  reckoning_time: string;
  default_compass_view: CompassView;
  theme: string;
  push_notifications_enabled: boolean;
  gratitude_prompt_frequency: 'daily' | 'every_other_day' | 'weekly' | 'off';
  joy_prompt_frequency: 'every_few_days' | 'weekly' | 'off';
  anticipation_prompt_frequency: 'weekly' | 'biweekly' | 'off';
  mast_thought_rotation: 'every_open' | 'daily' | 'weekly' | 'manual';
  mast_thought_pinned_id: string | null;
  morning_reading_sources: string[];
  journal_export_reminder: boolean;
  friday_overview_enabled: boolean;
  friday_overview_time: string;
  friday_overview_day: string;
  sunday_reflection_enabled: boolean;
  sunday_reflection_time: string;
  sunday_reflection_day: string;
  monthly_review_enabled: boolean;
  monthly_review_day: number;
  quarterly_inventory_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string | null;
  important_dates_advance_days: number;
  max_daily_push: number;
  notification_tasks: 'reveille_batch' | 'push' | 'off';
  notification_meetings: 'reveille_batch' | 'push' | 'both' | 'off';
  notification_people: 'push' | 'reveille_batch' | 'off';
  notification_growth: 'reveille_batch' | 'off';
  notification_streaks: 'reckoning_batch' | 'off';
  notification_rhythms: 'push' | 'in_app' | 'off';
  notification_custom: 'push' | 'reveille_batch';
  google_calendar_token: string | null;
  created_at: string;
  updated_at: string;
}

export type CompassView =
  | 'simple_list'
  | 'eisenhower'
  | 'eat_the_frog'
  | 'one_three_nine'
  | 'big_rocks'
  | 'ivy_lee'
  | 'by_category';
