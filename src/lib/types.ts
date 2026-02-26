// PRD-01: Auth & User Setup

export type Gender = 'male' | 'female' | 'prefer_not_to_say';
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
  show_feature_guides: boolean;
  dismissed_guides: string[];
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
  | { page: 'reckoning' }
  | { page: 'reflections' }
  | { page: 'reports' };

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
  | 'manifest_discuss'
  | null;

export type GuidedSubtype =
  | 'quality_time'
  | 'gifts'
  | 'observe_serve'
  | 'words_of_affirmation'
  | 'gratitude'
  | 'cyrano'
  | 'couple'
  | 'parent_child'
  | 'weekly_review'
  | 'monthly_review'
  | 'business'
  | 'custom'
  | 'template_creation'
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
  related_rigging_plan_id: string | null;
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
  relatedWheelId: string | null;
  relatedRiggingPlanId: string | null;
}

// === PRD-06 Part 3: Lists ===

export type ListType = 'shopping' | 'wishlist' | 'expenses' | 'todo' | 'custom' | 'routine';
export type ListAiAction = 'store_only' | 'remind' | 'schedule' | 'prioritize';
export type ResetSchedule = 'daily' | 'weekdays' | 'weekly' | 'on_completion' | 'custom';

export interface List {
  id: string;
  user_id: string;
  title: string;
  list_type: ListType;
  ai_action: ListAiAction;
  share_token: string | null;
  reset_schedule: ResetSchedule | null;
  reset_custom_days: number[] | null;
  last_reset_at: string | null;
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
  notes: string | null;
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
  routine: 'Routine',
};

export const RESET_SCHEDULE_LABELS: Record<ResetSchedule, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  on_completion: 'On Completion',
  custom: 'Custom Days',
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

// === PRD-11: The Wheel ===

export type WheelStatus = 'in_progress' | 'active' | 'completed' | 'archived';

export interface WheelSupportPerson {
  name: string;
  relationship: string | null;
  role_description: string | null;
  conversation_script: string | null;
}

export interface WheelEvidenceSource {
  type: 'self_observation' | 'observer_feedback' | 'blind_test' | 'fruits';
  description: string;
  seen: boolean;
  date_seen: string | null;
}

export interface WheelBecomingAction {
  text: string;
  compass_task_id: string | null;
}

export interface WheelInstance {
  id: string;
  user_id: string;
  hub_text: string;
  status: WheelStatus;
  spoke_1_why: string | null;
  spoke_2_start_date: string | null;
  spoke_2_checkpoint_date: string | null;
  spoke_2_notes: string | null;
  spoke_3_who_i_am: string | null;
  spoke_3_who_i_want_to_be: string | null;
  spoke_4_supporter: WheelSupportPerson | null;
  spoke_4_reminder: WheelSupportPerson | null;
  spoke_4_observer: WheelSupportPerson | null;
  spoke_5_evidence: WheelEvidenceSource[] | null;
  spoke_6_becoming: WheelBecomingAction[] | null;
  current_spoke: number;
  rim_interval_days: number;
  next_rim_date: string | null;
  rim_count: number;
  related_mast_entry_id: string | null;
  helm_conversation_id: string | null;
  life_area_tag: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WheelRimEntry {
  id: string;
  wheel_id: string;
  user_id: string;
  rim_number: number;
  notes: string | null;
  spoke_updates: Record<string, string> | null;
  evidence_progress: Record<string, string> | null;
  new_actions: WheelBecomingAction[] | null;
  helm_conversation_id: string | null;
  created_at: string;
}

export const WHEEL_STATUS_LABELS: Record<WheelStatus, string> = {
  in_progress: 'Building',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export const SPOKE_LABELS: Record<number, string> = {
  0: 'Hub',
  1: 'Why',
  2: 'When',
  3: 'Self-Inventory',
  4: 'Support',
  5: 'Evidence',
  6: 'Becoming',
};

// === PRD-11: Life Inventory ===

export type SnapshotType = 'baseline' | 'current' | 'vision';

export interface LifeInventoryArea {
  id: string;
  user_id: string;
  area_name: string;
  is_custom: boolean;
  display_order: number;
  baseline_summary: string | null;
  baseline_date: string | null;
  current_summary: string | null;
  current_assessed_date: string | null;
  vision_summary: string | null;
  vision_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LifeInventorySnapshot {
  id: string;
  area_id: string;
  user_id: string;
  snapshot_type: SnapshotType;
  summary_text: string;
  helm_conversation_id: string | null;
  created_at: string;
}

export const DEFAULT_LIFE_AREAS: string[] = [
  'Spiritual / Faith',
  'Marriage / Partnership',
  'Family / Parenting',
  'Physical Health',
  'Emotional / Mental Health',
  'Social / Friendships',
  'Professional / Career',
  'Financial',
  'Personal Development / Learning',
  'Service / Contribution',
];

export const SNAPSHOT_TYPE_LABELS: Record<SnapshotType, string> = {
  baseline: 'Where I Was',
  current: 'Where I Am',
  vision: 'Where I Want to Be',
};

// === PRD-16: Rigging ===

export type RiggingPlanStatus = 'active' | 'completed' | 'paused' | 'archived';
export type PlanningFramework = 'moscow' | 'backward' | 'milestone' | 'premortem' | 'ten_ten_ten' | 'mixed';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type ObstacleStatus = 'watching' | 'triggered' | 'resolved';

export interface RiggingPlan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: RiggingPlanStatus;
  planning_framework: PlanningFramework | null;
  frameworks_used: string[];
  moscow_must_have: string[];
  moscow_should_have: string[];
  moscow_could_have: string[];
  moscow_wont_have: string[];
  ten_ten_ten_decision: string | null;
  ten_ten_ten_10_days: string | null;
  ten_ten_ten_10_months: string | null;
  ten_ten_ten_10_years: string | null;
  ten_ten_ten_conclusion: string | null;
  related_mast_entry_ids: string[];
  related_goal_ids: string[];
  nudge_approaching_milestones: boolean;
  nudge_related_conversations: boolean;
  nudge_overdue_milestones: boolean;
  helm_conversation_id: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiggingMilestone {
  id: string;
  user_id: string;
  plan_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  target_date: string | null;
  status: MilestoneStatus;
  task_breaker_level: TaskBreakerLevel | null;
  related_goal_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiggingObstacle {
  id: string;
  user_id: string;
  plan_id: string;
  risk_description: string;
  mitigation_plan: string;
  status: ObstacleStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const PLANNING_FRAMEWORK_LABELS: Record<PlanningFramework, string> = {
  moscow: 'MoSCoW',
  backward: 'Backward Planning',
  milestone: 'Milestone Mapping',
  premortem: 'Obstacle Pre-mortem',
  ten_ten_ten: '10-10-10',
  mixed: 'Mixed',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const OBSTACLE_STATUS_LABELS: Record<ObstacleStatus, string> = {
  watching: 'Watching',
  triggered: 'Triggered',
  resolved: 'Resolved',
};

// === PRD-12: First Mate + PRD-13: Crew ===

export type RelationshipType = 'spouse' | 'child' | 'parent' | 'sibling' | 'coworker' | 'friend' | 'mentor' | 'other';

export type SphereLevel = 'focus' | 'family' | 'friends' | 'acquaintances' | 'community' | 'geo_political';

export const SPHERE_LEVEL_LABELS: Record<SphereLevel, string> = {
  focus: 'Focus',
  family: 'Family',
  friends: 'Friends',
  acquaintances: 'Acquaintances',
  community: 'Community',
  geo_political: 'Geo-Political',
};

export const SPHERE_LEVEL_ORDER: SphereLevel[] = [
  'focus', 'family', 'friends', 'acquaintances', 'community', 'geo_political',
];

export type SphereEntityCategory = 'social_media' | 'news_media' | 'politics' | 'entertainment' | 'ideology' | 'custom';

export const SPHERE_ENTITY_CATEGORY_LABELS: Record<SphereEntityCategory, string> = {
  social_media: 'Social Media',
  news_media: 'News & Media',
  politics: 'Politics',
  entertainment: 'Entertainment',
  ideology: 'Ideology',
  custom: 'Custom',
};

export interface SphereEntity {
  id: string;
  user_id: string;
  name: string;
  entity_category: SphereEntityCategory;
  desired_sphere: SphereLevel;
  current_sphere: SphereLevel | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SpouseInsightCategory =
  | 'personality'
  | 'love_appreciation'
  | 'communication'
  | 'dreams_goals'
  | 'challenges_needs'
  | 'their_world'
  | 'observation'
  | 'their_response'
  | 'gratitude'
  | 'general';

export type SpouseInsightSourceType = 'manual' | 'uploaded_file' | 'helm_conversation' | 'spouse_prompt' | 'log_routed';

export type SpousePromptType = 'ask_them' | 'reflect' | 'express';

export type SpousePromptStatus = 'pending' | 'acted_on' | 'skipped';

export type CrewNoteCategory = 'personality' | 'interests' | 'challenges' | 'growth' | 'observation' | 'general';

export type CrewNoteSourceType = 'manual' | 'uploaded_file' | 'helm_conversation' | 'meeting_notes' | 'log_routed';

export interface ImportantDate {
  label: string;
  date: string;
  recurring: boolean;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  relationship_type: RelationshipType;
  is_first_mate: boolean;
  categories: string[];
  notes: string | null;
  age: number | null;
  personality_summary: string | null;
  love_language: string | null;
  important_dates: ImportantDate[] | null;
  desired_sphere: SphereLevel | null;
  current_sphere: SphereLevel | null;
  has_rich_context: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpouseInsight {
  id: string;
  user_id: string;
  person_id: string;
  category: SpouseInsightCategory;
  text: string;
  source_type: SpouseInsightSourceType;
  source_label: string | null;
  source_reference_id: string | null;
  file_storage_path: string | null;
  is_rag_indexed: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpousePrompt {
  id: string;
  user_id: string;
  person_id: string;
  prompt_type: SpousePromptType;
  prompt_text: string;
  status: SpousePromptStatus;
  response_text: string | null;
  response_saved_as_insight: boolean;
  insight_id: string | null;
  generation_context: string | null;
  created_at: string;
  acted_on_at: string | null;
}

export interface CrewNote {
  id: string;
  user_id: string;
  person_id: string;
  category: CrewNoteCategory;
  text: string;
  source_type: CrewNoteSourceType;
  source_label: string | null;
  source_reference_id: string | null;
  file_storage_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const SPOUSE_INSIGHT_CATEGORY_LABELS: Record<SpouseInsightCategory, string> = {
  personality: 'Personality & Wiring',
  love_appreciation: 'Love & Appreciation',
  communication: 'Communication',
  dreams_goals: 'Dreams & Goals',
  challenges_needs: 'Challenges & Needs',
  their_world: 'Their World',
  observation: 'Observations',
  their_response: 'Their Responses',
  gratitude: 'Gratitude',
  general: 'General',
};

export const SPOUSE_INSIGHT_CATEGORY_ORDER: SpouseInsightCategory[] = [
  'personality', 'love_appreciation', 'communication', 'dreams_goals',
  'challenges_needs', 'their_world', 'gratitude', 'observation', 'their_response', 'general',
];

export const SPOUSE_PROMPT_TYPE_LABELS: Record<SpousePromptType, string> = {
  ask_them: 'Ask',
  reflect: 'Reflect',
  express: 'Express',
};

// === PRD-12A: Cyrano Me ===

export type CyranoTeachingSkill =
  | 'specificity'
  | 'her_lens'
  | 'feeling_over_function'
  | 'timing'
  | 'callback_power'
  | 'unsaid_need'
  | 'presence_proof';

export type CyranoStatus = 'draft' | 'sent' | 'saved_for_later';

export interface CyranoMessage {
  id: string;
  user_id: string;
  people_id: string;
  raw_input: string;
  crafted_version: string;
  final_version: string | null;
  teaching_skill: CyranoTeachingSkill | null;
  teaching_note: string | null;
  status: CyranoStatus;
  sent_at: string | null;
  helm_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export const CYRANO_TEACHING_SKILL_LABELS: Record<CyranoTeachingSkill, string> = {
  specificity: 'Specificity',
  her_lens: 'Her Lens',
  feeling_over_function: 'Feeling over Function',
  timing: 'Timing & Context',
  callback_power: 'Callback Power',
  unsaid_need: 'The Unsaid Need',
  presence_proof: 'Presence Proof',
};

export const CREW_NOTE_CATEGORY_LABELS: Record<CrewNoteCategory, string> = {
  personality: 'Personality',
  interests: 'Interests',
  challenges: 'Challenges',
  growth: 'Growth',
  observation: 'Observations',
  general: 'General',
};

export const CREW_NOTE_CATEGORY_ORDER: CrewNoteCategory[] = [
  'personality', 'interests', 'challenges', 'growth', 'observation', 'general',
];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
  coworker: 'Coworker',
  friend: 'Friend',
  mentor: 'Mentor',
  other: 'Other',
};

export const CREW_SECTIONS: { key: string; label: string; types: RelationshipType[] }[] = [
  { key: 'immediate_family', label: 'Immediate Family', types: ['spouse', 'child'] },
  { key: 'extended_family', label: 'Extended Family', types: ['parent', 'sibling'] },
  { key: 'professional', label: 'Professional', types: ['coworker', 'mentor'] },
  { key: 'social', label: 'Social & Friends', types: ['friend'] },
  { key: 'other', label: 'Other', types: ['other'] },
];

// === PRD-15: The Manifest ===

export type ManifestFileType = 'pdf' | 'epub' | 'docx' | 'txt' | 'md' | 'audio' | 'image' | 'text_note';
export type ManifestProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ManifestUsageDesignation =
  | 'general_reference'
  | 'framework_source'
  | 'mast_extraction'
  | 'keel_info'
  | 'goal_specific'
  | 'store_only';

export interface ManifestItem {
  id: string;
  user_id: string;
  title: string;
  file_type: ManifestFileType;
  file_name: string | null;
  storage_path: string | null;
  text_content: string | null;
  file_size_bytes: number | null;
  usage_designations: ManifestUsageDesignation[];
  tags: string[];
  folder_group: string;
  related_wheel_id: string | null;
  related_goal_id: string | null;
  processing_status: ManifestProcessingStatus;
  chunk_count: number;
  intake_completed: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManifestChunk {
  id: string;
  user_id: string;
  manifest_item_id: string;
  chunk_index: number;
  chunk_text: string;
  token_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIFramework {
  id: string;
  user_id: string;
  manifest_item_id: string;
  name: string;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  principles?: AIFrameworkPrinciple[];
}

export interface AIFrameworkPrinciple {
  id: string;
  user_id: string;
  framework_id: string;
  text: string;
  sort_order: number;
  is_user_added: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManifestSearchResult {
  id: string;
  manifest_item_id: string;
  chunk_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
  source_title?: string;
}

export const MANIFEST_FILE_TYPE_LABELS: Record<ManifestFileType, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'Word Doc',
  txt: 'Text File',
  md: 'Markdown',
  audio: 'Audio',
  image: 'Image',
  text_note: 'Text Note',
};

export const MANIFEST_USAGE_LABELS: Record<ManifestUsageDesignation, string> = {
  general_reference: 'General Reference',
  framework_source: 'Framework Source',
  mast_extraction: 'Mast Extraction',
  keel_info: 'Keel Info',
  goal_specific: 'Goal / Wheel Specific',
  store_only: 'Store for Later',
};

export const MANIFEST_STATUS_LABELS: Record<ManifestProcessingStatus, string> = {
  pending: 'Pending',
  processing: 'Processing...',
  completed: 'Ready',
  failed: 'Failed',
};

// === PRD-17: Meeting Frameworks ===

export type MeetingType = 'couple' | 'parent_child' | 'weekly_review' | 'monthly_review' | 'quarterly_inventory' | 'business' | 'custom';

export type MeetingStatus = 'in_progress' | 'completed' | 'skipped';

export type MeetingEntryMode = 'live' | 'record_after';

export type MeetingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';

export type MeetingNotificationType = 'reveille' | 'day_before' | 'both' | 'none';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type MeetingTemplateSource = 'manual' | 'ai_generated' | 'uploaded_file';

export interface MeetingAgendaSection {
  title: string;
  ai_prompt_text: string;
  sort_order: number;
}

export interface Meeting {
  id: string;
  user_id: string;
  meeting_type: MeetingType;
  template_id: string | null;
  related_person_id: string | null;
  status: MeetingStatus;
  entry_mode: MeetingEntryMode;
  summary: string | null;
  impressions: string | null;
  pattern_note: string | null;
  helm_conversation_id: string | null;
  log_entry_id: string | null;
  meeting_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingSchedule {
  id: string;
  user_id: string;
  meeting_type: MeetingType;
  template_id: string | null;
  related_person_id: string | null;
  frequency: MeetingFrequency;
  custom_interval_days: number | null;
  preferred_day: DayOfWeek | null;
  preferred_time: string | null;
  notification_type: MeetingNotificationType;
  is_active: boolean;
  last_completed_date: string | null;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  default_frequency: MeetingFrequency;
  default_related_person_id: string | null;
  agenda_sections: MeetingAgendaSection[];
  source: MeetingTemplateSource;
  file_storage_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  couple: 'Couple Meeting',
  parent_child: 'Parent-Child Mentor Meeting',
  weekly_review: 'Weekly Review',
  monthly_review: 'Monthly Review',
  quarterly_inventory: 'Quarterly Inventory',
  business: 'Business Review',
  custom: 'Custom Meeting',
};

export const MEETING_FREQUENCY_LABELS: Record<MeetingFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  custom: 'Custom',
};

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const MEETING_ENTRY_MODE_LABELS: Record<MeetingEntryMode, string> = {
  live: 'Live Mode',
  record_after: 'Record After',
};

export const MEETING_NOTIFICATION_LABELS: Record<MeetingNotificationType, string> = {
  reveille: 'Morning Briefing',
  day_before: 'Day Before',
  both: 'Both',
  none: 'None',
};

// === PRD-18: Reminders + Rhythms ===

export type ReminderType =
  | 'task_due' | 'task_overdue' | 'streak_at_risk'
  | 'meeting_due' | 'meeting_day_before'
  | 'important_date' | 'wheel_rim'
  | 'rigging_milestone' | 'rigging_overdue'
  | 'spouse_prompt' | 'gratitude_prompt' | 'joy_prompt' | 'anticipation_prompt'
  | 'list_item' | 'log_routed' | 'custom'
  | 'journal_export'
  | 'friday_overview' | 'sunday_reflection' | 'monthly_review' | 'quarterly_inventory';

export type ReminderDeliveryMethod = 'push' | 'reveille_batch' | 'reckoning_batch' | 'in_app';

export type ReminderStatus = 'pending' | 'delivered' | 'acted_on' | 'dismissed' | 'snoozed' | 'archived';

export type ReminderEntityType =
  | 'compass_task' | 'meeting' | 'meeting_schedule' | 'person'
  | 'wheel_instance' | 'rigging_plan' | 'rigging_milestone'
  | 'list_item' | 'log_entry' | 'spouse_prompt' | null;

export type ReminderSourceFeature =
  | 'compass' | 'meetings' | 'first_mate' | 'crew' | 'wheel'
  | 'rigging' | 'charts' | 'lists' | 'log' | 'rhythms' | 'settings' | 'user';

export type RhythmType = 'friday_overview' | 'sunday_reflection' | 'monthly_review' | 'quarterly_inventory';

export type RhythmCardStatus = 'pending' | 'shown' | 'dismissed' | 'completed';

export type SnoozePreset = '1_hour' | 'later_today' | 'tomorrow' | 'next_week';

export type NotificationDeliveryPref =
  | 'push' | 'reveille_batch' | 'reckoning_batch' | 'in_app' | 'both' | 'off';

export interface Reminder {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  title: string;
  body: string | null;
  delivery_method: ReminderDeliveryMethod;
  scheduled_at: string | null;
  status: ReminderStatus;
  snoozed_until: string | null;
  snooze_count: number;
  related_entity_type: ReminderEntityType;
  related_entity_id: string | null;
  source_feature: ReminderSourceFeature;
  metadata: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RhythmStatusRecord {
  id: string;
  user_id: string;
  rhythm_type: RhythmType;
  period_key: string;
  status: RhythmCardStatus;
  shown_at: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  device_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const SNOOZE_PRESET_LABELS: Record<SnoozePreset, string> = {
  '1_hour': '1 Hour',
  'later_today': 'Later Today',
  'tomorrow': 'Tomorrow',
  'next_week': 'Next Week',
};

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  task_due: 'Task Due',
  task_overdue: 'Task Overdue',
  streak_at_risk: 'Streak at Risk',
  meeting_due: 'Meeting Due',
  meeting_day_before: 'Meeting Tomorrow',
  important_date: 'Important Date',
  wheel_rim: 'Wheel Check-in',
  rigging_milestone: 'Milestone Approaching',
  rigging_overdue: 'Milestone Overdue',
  spouse_prompt: 'Spouse Prompt',
  gratitude_prompt: 'Gratitude',
  joy_prompt: 'Joy',
  anticipation_prompt: 'Anticipation',
  list_item: 'List Reminder',
  log_routed: 'Follow Up',
  custom: 'Reminder',
  journal_export: 'Journal Export',
  friday_overview: 'Friday Overview',
  sunday_reflection: 'Sunday Reflection',
  monthly_review: 'Monthly Review',
  quarterly_inventory: 'Quarterly Inventory',
};

export const RHYTHM_TYPE_LABELS: Record<RhythmType, string> = {
  friday_overview: 'Friday Overview',
  sunday_reflection: 'Sunday Reflection',
  monthly_review: 'Monthly Review',
  quarterly_inventory: 'Quarterly Inventory',
};

// === Phase 9.5: Routines, Reflections & Reports ===

export interface RoutineItemSnapshot {
  id: string;
  text: string;
  checked: boolean;
  notes: string | null;
}

export interface RoutineCompletionHistory {
  id: string;
  user_id: string;
  list_id: string;
  completed_at: string;
  items_snapshot: RoutineItemSnapshot[];
  total_items: number;
  completed_items: number;
  created_at: string;
}

export interface ReflectionQuestion {
  id: string;
  user_id: string;
  question_text: string;
  is_default: boolean;
  is_ai_suggested: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReflectionResponse {
  id: string;
  user_id: string;
  question_id: string;
  response_text: string;
  response_date: string;
  routed_to_log: boolean;
  log_entry_id: string | null;
  routed_to_victory: boolean;
  victory_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined field
  question_text?: string;
}

export type ReportPeriod = 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';

export type ReportSection =
  | 'tasks'
  | 'routines'
  | 'journal'
  | 'victories'
  | 'reflections'
  | 'goals'
  | 'streaks';

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  custom: 'Custom Range',
};

export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  tasks: 'Tasks',
  routines: 'Routines',
  journal: 'Journal Entries',
  victories: 'Victories',
  reflections: 'Reflections',
  goals: 'Goals',
  streaks: 'Streaks',
};

export interface ReportConfig {
  period: ReportPeriod;
  sections: ReportSection[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportTaskData {
  completed: number;
  pending: number;
  carried_forward: number;
  cancelled: number;
  byLifeArea: Record<string, number>;
}

export interface ReportRoutineData {
  routineName: string;
  completionCount: number;
  averageCompletion: number;
}

export interface ReportJournalData {
  total: number;
  byType: Record<string, number>;
}

export interface ReportVictoryData {
  total: number;
  descriptions: string[];
}

export interface ReportReflectionData {
  total: number;
  questions: { question: string; response: string; date: string }[];
}

export interface ReportGoalData {
  title: string;
  progress: number;
  target: number | null;
  status: string;
}

export interface ReportStreakData {
  taskTitle: string;
  currentStreak: number;
  longestStreak: number;
}

export interface ReportData {
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  tasks?: ReportTaskData;
  routines?: ReportRoutineData[];
  journal?: ReportJournalData;
  victories?: ReportVictoryData;
  reflections?: ReportReflectionData;
  goals?: ReportGoalData[];
  streaks?: ReportStreakData[];
}
