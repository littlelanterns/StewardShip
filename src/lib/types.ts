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

// === PRD-02: The Mast ===

export type MastEntryType = 'value' | 'declaration' | 'faith_foundation' | 'scripture_quote' | 'vision';

export type EntrySource = 'manual' | 'helm_conversation' | 'manifest_extraction' | 'log_routed';

export interface MastEntry {
  id: string;
  user_id: string;
  type: MastEntryType;
  text: string;
  category: string | null;
  sort_order: number;
  source: EntrySource;
  source_reference_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MAST_TYPE_LABELS: Record<MastEntryType, string> = {
  value: 'Values',
  declaration: 'Declarations',
  faith_foundation: 'Faith Foundations',
  scripture_quote: 'Scriptures & Quotes',
  vision: 'Vision',
};

export const MAST_TYPE_ORDER: MastEntryType[] = [
  'value', 'declaration', 'faith_foundation', 'scripture_quote', 'vision'
];

// === PRD-03: The Keel ===

export type KeelCategory = 'personality_assessment' | 'trait_tendency' | 'strength' | 'growth_area' | 'you_inc' | 'general';

export type KeelSourceType = 'manual' | 'uploaded_file' | 'helm_conversation' | 'manifest_extraction' | 'log_routed';

export interface KeelEntry {
  id: string;
  user_id: string;
  category: KeelCategory;
  text: string;
  source: string;
  source_type: KeelSourceType;
  source_reference_id: string | null;
  file_storage_path: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const KEEL_CATEGORY_LABELS: Record<KeelCategory, string> = {
  personality_assessment: 'Personality Assessments',
  trait_tendency: 'Traits & Tendencies',
  strength: 'Strengths',
  growth_area: 'Growth Areas',
  you_inc: 'You, Inc.',
  general: 'General Self-Knowledge',
};

export const KEEL_CATEGORY_ORDER: KeelCategory[] = [
  'personality_assessment', 'trait_tendency', 'strength', 'growth_area', 'you_inc', 'general'
];
