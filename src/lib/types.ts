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

// Compass task life area tags (action-oriented, single tag per task)
// Different from Log's life_area_tags which are broader and multi-tag
export type CompassLifeArea =
  | 'spouse_marriage'
  | 'family'
  | 'career_work'
  | 'home'
  | 'spiritual'
  | 'health_physical'
  | 'social'
  | 'financial'
  | 'personal'
  | 'custom';

export type TaskStatus = 'pending' | 'completed' | 'carried_forward' | 'cancelled';
export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | null;
export type EisenhowerQuadrant = 'do_now' | 'schedule' | 'delegate' | 'eliminate';
export type ImportanceLevel = 'critical_1' | 'important_3' | 'small_9';
export type TaskBreakerLevel = 'quick' | 'detailed' | 'granular';
export type TaskSource =
  | 'manual'
  | 'helm_conversation'
  | 'log_routed'
  | 'meeting_action'
  | 'rigging_output'
  | 'wheel_commitment'
  | 'recurring_generated'
  | 'unload_the_hold';

export interface CompassTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  recurrence_rule: RecurrenceRule;
  life_area_tag: CompassLifeArea | null;
  eisenhower_quadrant: EisenhowerQuadrant | null;
  frog_rank: number | null;
  importance_level: ImportanceLevel | null;
  big_rock: boolean;
  ivy_lee_rank: number | null;
  sort_order: number;
  parent_task_id: string | null;
  task_breaker_level: TaskBreakerLevel | null;
  related_goal_id: string | null;
  related_wheel_id: string | null;
  related_meeting_id: string | null;
  related_rigging_plan_id: string | null;
  source: TaskSource;
  source_reference_id: string | null;
  victory_flagged: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const COMPASS_LIFE_AREA_LABELS: Record<CompassLifeArea, string> = {
  spouse_marriage: 'Spouse / Marriage',
  family: 'Family',
  career_work: 'Career / Work',
  home: 'Home',
  spiritual: 'Spiritual',
  health_physical: 'Health / Physical',
  social: 'Social',
  financial: 'Financial',
  personal: 'Personal',
  custom: 'Custom',
};

export const COMPASS_VIEW_LABELS: Record<CompassView, string> = {
  simple_list: 'Simple List',
  eisenhower: 'Eisenhower',
  eat_the_frog: 'Frog',
  one_three_nine: '1/3/9',
  big_rocks: 'Big Rocks',
  ivy_lee: 'Ivy Lee',
  by_category: 'By Category',
};

export const COMPASS_VIEW_DESCRIPTIONS: Record<CompassView, string> = {
  simple_list: 'Plain checkboxes. No framework — just check things off.',
  eisenhower: 'Four quadrants: Do Now (urgent + important), Schedule (important, not urgent), Delegate (urgent, not important), Eliminate (neither). Focus on what matters, not just what\'s loud.',
  eat_the_frog: 'Your hardest or most dreaded task goes to the top. Do it first — everything else feels easier after.',
  one_three_nine: 'Limits your day: 1 critical task, 3 important tasks, 9 small tasks. Keeps you focused without being overwhelmed.',
  big_rocks: 'Identify your 2-3 major priorities. Everything else is gravel that fits around them. If the big rocks don\'t go in first, they won\'t fit at all.',
  ivy_lee: 'Your top 6 tasks, strictly ordered. Work only on #1 until it\'s done. Then #2. Simple, powerful, no multitasking.',
  by_category: 'Tasks grouped by life area: marriage, family, work, spiritual, etc. See at a glance what each role in your life needs from you today.',
};

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

// === PRD-04: The Helm ===

export type HelmPageContext =
  | { page: 'crowsnest' }
  | { page: 'compass'; activeView?: string }
  | { page: 'helm' }
  | { page: 'log' }
  | { page: 'charts' }
  | { page: 'mast' }
  | { page: 'keel' }
  | { page: 'wheel'; wheelId?: string }
  | { page: 'lifeinventory' }
  | { page: 'rigging'; planId?: string }
  | { page: 'firstmate' }
  | { page: 'crew'; personId?: string }
  | { page: 'victories' }
  | { page: 'safeharbor' }
  | { page: 'manifest' }
  | { page: 'settings' }
  | { page: 'meetings'; meetingType?: string; personId?: string }
  | { page: 'lists' }
  | { page: 'reveille' }
  | { page: 'reckoning' };

export type GuidedMode =
  | 'wheel'
  | 'life_inventory'
  | 'rigging'
  | 'declaration'
  | 'self_discovery'
  | 'meeting'
  | 'first_mate_action'
  | 'safe_harbor'
  | 'unload_the_hold'
  | null;

export type GuidedSubtype =
  | 'quality_time'
  | 'gifts'
  | 'observe_serve'
  | 'words_of_affirmation'
  | 'gratitude'
  | null;

export type MessageRole = 'user' | 'assistant' | 'system';

export interface HelmConversation {
  id: string;
  user_id: string;
  title: string | null;
  guided_mode: GuidedMode;
  guided_subtype: GuidedSubtype;
  guided_mode_reference_id: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HelmMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  page_context: string | null;
  voice_transcript: boolean;
  file_storage_path: string | null;
  file_type: string | null;
  created_at: string;
}

export const GUIDED_MODE_LABELS: Record<string, string> = {
  wheel: 'The Wheel',
  life_inventory: 'Life Inventory',
  rigging: 'Rigging',
  declaration: 'Declaration',
  self_discovery: 'Self-Discovery',
  meeting: 'Meeting',
  first_mate_action: 'First Mate',
  safe_harbor: 'Safe Harbor',
  unload_the_hold: 'Unload the Hold',
};

// === PRD-05: The Log ===

export type LogEntryType =
  | 'journal'
  | 'gratitude'
  | 'reflection'
  | 'quick_note'
  | 'meeting_notes'
  | 'transcript'
  | 'helm_conversation'
  | 'brain_dump'
  | 'custom';

export type LogSource =
  | 'manual_text'
  | 'voice_transcription'
  | 'helm_conversation'
  | 'meeting_framework'
  | 'unload_the_hold';

export type LogRouteTarget =
  | 'compass_task'
  | 'list_item'
  | 'reminder'
  | 'mast_entry'
  | 'keel_entry'
  | 'victory'
  | 'spouse_insight'
  | 'crew_note';

export type LifeAreaTag =
  | 'spiritual'
  | 'marriage'
  | 'family'
  | 'physical'
  | 'emotional'
  | 'social'
  | 'professional'
  | 'financial'
  | 'personal_development'
  | 'service';

export const LIFE_AREA_LABELS: Record<string, string> = {
  spiritual: 'Spiritual',
  marriage: 'Marriage',
  family: 'Family',
  physical: 'Physical',
  emotional: 'Emotional',
  social: 'Social',
  professional: 'Professional',
  financial: 'Financial',
  personal_development: 'Personal Development',
  service: 'Service',
};

export const LOG_ENTRY_TYPE_LABELS: Record<LogEntryType, string> = {
  journal: 'Journal',
  gratitude: 'Gratitude',
  reflection: 'Reflection',
  quick_note: 'Quick Note',
  meeting_notes: 'Meeting Notes',
  transcript: 'Transcript',
  helm_conversation: 'Helm Conversation',
  brain_dump: 'Brain Dump',
  custom: 'Custom',
};

export interface LogEntry {
  id: string;
  user_id: string;
  text: string;
  entry_type: LogEntryType;
  life_area_tags: string[];
  source: LogSource;
  source_reference_id: string | null;
  audio_file_path: string | null;
  routed_to: string[];
  routed_reference_ids: Record<string, string>;
  related_wheel_id: string | null;
  related_meeting_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogFilters {
  entryType: LogEntryType | null;
  lifeAreaTag: string | null;
  dateRange: 'today' | 'this_week' | 'this_month' | 'all' | 'custom';
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}

// === PRD-06 Part 3: Lists ===

export type ListType = 'shopping' | 'wishlist' | 'expenses' | 'todo' | 'custom';
export type ListAiAction = 'store_only' | 'remind' | 'schedule' | 'prioritize';

export interface List {
  id: string;
  user_id: string;
  title: string;
  list_type: ListType;
  ai_action: ListAiAction;
  share_token: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  user_id: string;
  text: string;
  checked: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const LIST_TYPE_LABELS: Record<ListType, string> = {
  shopping: 'Shopping',
  wishlist: 'Wishlist',
  expenses: 'Expenses',
  todo: 'To-Do',
  custom: 'Custom',
};

export const LIST_AI_ACTION_LABELS: Record<ListAiAction, string> = {
  store_only: 'Just store it',
  remind: 'Remind me',
  schedule: 'Help me schedule it',
  prioritize: 'Help me prioritize it',
};

// === PRD-20: Unload the Hold ===

export type HoldDumpStatus = 'dumping' | 'sorting' | 'triaging' | 'routed' | 'cancelled';

export type TriageCategory =
  | 'task'
  | 'journal'
  | 'insight'
  | 'principle'
  | 'person_note'
  | 'reminder'
  | 'list_item'
  | 'discard';

export const TRIAGE_CATEGORY_LABELS: Record<TriageCategory, string> = {
  task: 'Task',
  journal: 'Journal',
  insight: 'Insight',
  principle: 'Principle',
  person_note: 'Person Note',
  reminder: 'Reminder',
  list_item: 'List Item',
  discard: 'Discard',
};

export const TRIAGE_CATEGORY_DESTINATIONS: Record<TriageCategory, string> = {
  task: 'Compass',
  journal: 'Log',
  insight: 'Keel',
  principle: 'Mast',
  person_note: 'Crew',
  reminder: 'Reminders',
  list_item: 'Lists',
  discard: 'Skip',
};

export interface TriageItem {
  id: string;
  text: string;
  category: TriageCategory;
  metadata: {
    life_area_tag?: string;
    due_suggestion?: 'today' | 'this_week' | 'no_date';
    entry_type?: string;
    keel_category?: string;
    mast_type?: string;
    person_name?: string;
    reminder_text?: string;
    suggested_list?: string;
  };
}

export interface HoldDump {
  id: string;
  user_id: string;
  conversation_id: string;
  items_extracted: number;
  items_routed: number;
  items_discarded: number;
  triage_result: TriageItem[];
  status: HoldDumpStatus;
  log_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

// === PRD-08: Victory Recorder ===

export type VictorySource = 'manual' | 'compass_task' | 'log_entry' | 'helm_conversation' | 'chart_milestone' | 'unload_the_hold';

export interface Victory {
  id: string;
  user_id: string;
  description: string;
  celebration_text: string | null;
  life_area_tag: string | null;
  source: VictorySource;
  source_reference_id: string | null;
  related_mast_entry_id: string | null;
  related_wheel_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const VICTORY_SOURCE_LABELS: Record<VictorySource, string> = {
  manual: 'Manual',
  compass_task: 'Compass Task',
  log_entry: 'Log Entry',
  helm_conversation: 'Helm Conversation',
  chart_milestone: 'Chart Milestone',
  unload_the_hold: 'Unload the Hold',
};

// === PRD-07: Charts ===

export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type GoalProgressType = 'percentage' | 'streak' | 'count' | 'boolean';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  life_area_tag: string | null;
  target_date: string | null;
  status: GoalStatus;
  progress_type: GoalProgressType;
  progress_current: number;
  progress_target: number | null;
  related_mast_entry_id: string | null;
  related_wheel_id: string | null;
  related_rigging_plan_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TrackerType = 'count' | 'yes_no' | 'duration' | 'rating';
export type TrackerVisualization = 'line_graph' | 'streak_calendar' | 'bar_chart';

export type TrackerPromptPeriod = 'morning' | 'evening' | 'both';

export interface CustomTracker {
  id: string;
  user_id: string;
  name: string;
  tracking_type: TrackerType;
  target_value: number | null;
  visualization: TrackerVisualization;
  life_area_tag: string | null;
  prompt_period: TrackerPromptPeriod | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerEntry {
  id: string;
  tracker_id: string;
  user_id: string;
  entry_date: string;
  value_numeric: number | null;
  value_boolean: boolean | null;
  created_at: string;
}

export interface StreakInfo {
  taskId: string;
  taskTitle: string;
  currentStreak: number;
  longestStreak: number;
  lastCompleted: string | null;
  isAtMilestone: boolean;
  nextMilestone: number;
}

export interface ChartsSummary {
  taskCompletion: { completed: number; total: number; period: string };
  activeStreaks: StreakInfo[];
  goals: { title: string; progress: number; target: number }[];
  victoryCount: number;
  victoryBreakdown: Record<string, number>;
  journalCount: number;
}

// === PRD-10: Reveille + Reckoning ===

export interface DailyRhythmStatus {
  id: string;
  user_id: string;
  rhythm_date: string;
  reveille_dismissed: boolean;
  reckoning_dismissed: boolean;
  gratitude_prompt_completed: boolean;
  joy_prompt_completed: boolean;
  anticipation_prompt_completed: boolean;
  mast_thought_morning_id: string | null;
  morning_reading_source: string | null;
  mast_thought_evening_id: string | null;
  evening_reading_source: string | null;
  created_at: string;
}
