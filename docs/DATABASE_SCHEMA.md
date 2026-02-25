# StewardShip: Database Schema

> This is a living document. Updated after each PRD is written.
> Last updated: After Phase 10C (Settings) — All PRDs complete

---

## Conventions

- **Table names:** snake_case plural (`mast_entries`, `log_entries`, `compass_tasks`)
- **Column names:** snake_case (`created_at`, `life_area`, `parent_task_id`)
- **All tables have:** `id` (UUID, primary key), `user_id` (UUID, FK → auth.users), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)
- **Soft delete:** `archived_at` TIMESTAMPTZ column (null = active, set = archived). No hard deletes in user-facing features.
- **All IDs:** UUID via `gen_random_uuid()`
- **All timestamps:** TIMESTAMPTZ with `now()` default
- **updated_at:** Auto-set via trigger on every table that has it
- **RLS:** Every table has Row-Level Security. Users can only access their own data.

---

## Tables by PRD

### PRD-01: Auth & User Setup

#### `user_profiles`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users. UNIQUE. |
| display_name | TEXT | | NOT NULL | User's preferred name for AI greetings |
| timezone | TEXT | 'America/Chicago' | NOT NULL | IANA timezone string |
| onboarding_completed | BOOLEAN | false | NOT NULL | Set true after onboarding finishes |
| gender | TEXT | null | NULL | Enum: 'male', 'female', 'prefer_not_to_say'. Set during onboarding or Settings. |
| relationship_status | TEXT | null | NULL | Enum: 'single', 'dating', 'married', 'divorced', 'widowed'. Set during onboarding or Settings. |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users read/update own profile only. Insert via trigger on auth.users creation.
**Indexes:** `user_id` (unique)

---

#### `user_settings`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users. UNIQUE. |
| ai_provider | TEXT | 'openrouter' | NOT NULL | Enum: 'openrouter', 'gemini', 'openai' |
| ai_api_key_encrypted | TEXT | null | NULL | Encrypted API key. Null = use developer key. |
| ai_model | TEXT | 'anthropic/claude-sonnet' | NOT NULL | Model string for selected provider |
| max_tokens | INTEGER | 1024 | NOT NULL | System-level cap on AI response length |
| context_window_size | TEXT | 'medium' | NOT NULL | Enum: 'short', 'medium', 'long' |
| reveille_enabled | BOOLEAN | true | NOT NULL | Show morning briefing |
| reveille_time | TIME | '07:00' | NOT NULL | When to trigger Reveille |
| reckoning_enabled | BOOLEAN | true | NOT NULL | Show evening review |
| reckoning_time | TIME | '21:00' | NOT NULL | When to trigger Reckoning |
| default_compass_view | TEXT | 'simple_list' | NOT NULL | Enum: 'simple_list', 'eisenhower', 'eat_the_frog', 'one_three_nine', 'big_rocks', 'ivy_lee', 'by_category' |
| theme | TEXT | 'captains_quarters' | NOT NULL | Active UI theme. Default: 'captains_quarters'. Additional themes defined in frontend. |
| push_notifications_enabled | BOOLEAN | true | NOT NULL | Master toggle |
| gratitude_prompt_frequency | TEXT | 'daily' | NOT NULL | Enum: 'daily', 'every_other_day', 'weekly', 'off' |
| joy_prompt_frequency | TEXT | 'every_few_days' | NOT NULL | Enum: 'every_few_days', 'weekly', 'off' |
| anticipation_prompt_frequency | TEXT | 'weekly' | NOT NULL | Enum: 'weekly', 'biweekly', 'off' |
| mast_thought_rotation | TEXT | 'daily' | NOT NULL | Enum: 'every_open', 'daily', 'weekly', 'manual' |
| mast_thought_pinned_id | UUID | null | NULL | FK → mast_entries. Used when rotation = 'manual'. |
| morning_reading_sources | TEXT[] | '{mast,manifest,log}' | NOT NULL | Which sources enabled for morning/evening readings |
| journal_export_reminder | BOOLEAN | false | NOT NULL | Monthly reminder to export journal |
| friday_overview_enabled | BOOLEAN | true | NOT NULL | Show Friday Overview rhythm |
| friday_overview_time | TIME | '17:00' | NOT NULL | When to trigger Friday Overview |
| friday_overview_day | TEXT | 'friday' | NOT NULL | Day of week for Friday Overview |
| sunday_reflection_enabled | BOOLEAN | true | NOT NULL | Show Sunday Reflection rhythm |
| sunday_reflection_time | TIME | '19:00' | NOT NULL | When to trigger Sunday Reflection |
| sunday_reflection_day | TEXT | 'sunday' | NOT NULL | Day of week for Sunday Reflection |
| monthly_review_enabled | BOOLEAN | true | NOT NULL | Show Monthly Review prompt |
| monthly_review_day | INTEGER | 1 | NOT NULL | Day of month (1-28) |
| quarterly_inventory_enabled | BOOLEAN | true | NOT NULL | Show Quarterly Inventory prompt |
| quiet_hours_start | TIME | '22:00' | NOT NULL | Push notification quiet hours start |
| quiet_hours_end | TIME | null | NULL | Null = use reveille_time |
| important_dates_advance_days | INTEGER | 1 | NOT NULL | Days before important dates to remind (0, 1, 3, 7) |
| max_daily_push | INTEGER | 5 | NOT NULL | Maximum push notifications per day |
| notification_tasks | TEXT | 'reveille_batch' | NOT NULL | Enum: 'reveille_batch', 'push', 'off' |
| notification_meetings | TEXT | 'reveille_batch' | NOT NULL | Enum: 'reveille_batch', 'push', 'both', 'off' |
| notification_people | TEXT | 'push' | NOT NULL | Enum: 'push', 'reveille_batch', 'off' |
| notification_growth | TEXT | 'reveille_batch' | NOT NULL | Enum: 'reveille_batch', 'off' |
| notification_streaks | TEXT | 'reckoning_batch' | NOT NULL | Enum: 'reckoning_batch', 'off' |
| notification_rhythms | TEXT | 'push' | NOT NULL | Enum: 'push', 'in_app', 'off' |
| notification_custom | TEXT | 'push' | NOT NULL | Enum: 'push', 'reveille_batch' |
| google_calendar_token | TEXT | null | NULL | OAuth token, encrypted. Post-launch. |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users read/update own settings only. Insert via trigger on auth.users creation.
**Indexes:** `user_id` (unique)

---

### PRD-02: The Mast

#### `mast_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| type | TEXT | | NOT NULL | Enum: 'value', 'declaration', 'faith_foundation', 'scripture_quote', 'vision' |
| text | TEXT | | NOT NULL | The principle content. Cannot be empty. |
| category | TEXT | null | NULL | Optional freeform (e.g., "Marriage", "Work") |
| sort_order | INTEGER | 0 | NOT NULL | Order within type group. Lower = higher. |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'helm_conversation', 'manifest_extraction', 'log_routed', 'unload_the_hold' |
| source_reference_id | UUID | null | NULL | FK → source entry if applicable |
| archived_at | TIMESTAMPTZ | null | NULL | Null = active. Set = archived. |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entries only.
**Indexes:**
- `user_id, type, archived_at` (grouped display of active entries)
- `user_id, archived_at` (archived view)

---

### PRD-03: The Keel

#### `keel_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| category | TEXT | | NOT NULL | Enum: 'personality_assessment', 'trait_tendency', 'strength', 'growth_area', 'you_inc', 'general' |
| text | TEXT | | NOT NULL | Entry content. Can be substantial for test summaries. |
| source | TEXT | 'self_observed' | NOT NULL | Freeform label (e.g., 'Enneagram Type 1', 'MBTI - INTJ', 'therapist') |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'manifest_extraction', 'log_routed', 'unload_the_hold' |
| source_reference_id | UUID | null | NULL | FK → source entry if applicable |
| file_storage_path | TEXT | null | NULL | Path in Supabase Storage if file was uploaded |
| sort_order | INTEGER | 0 | NOT NULL | Order within category group |
| archived_at | TIMESTAMPTZ | null | NULL | Null = active |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entries only.
**Indexes:**
- `user_id, category, archived_at` (grouped display)

---

### PRD-04: The Helm

#### `helm_conversations`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | null | NULL | AI-generated topic summary (~5-10 words) |
| guided_mode | TEXT | null | NULL | Enum: 'wheel', 'life_inventory', 'rigging', 'declaration', 'self_discovery', 'meeting', 'first_mate_action', 'safe_harbor', 'unload_the_hold', null |
| guided_subtype | TEXT | null | NULL | Sub-mode within guided_mode (e.g., 'quality_time', 'gifts', 'observe_serve', 'words_of_affirmation', 'gratitude' for first_mate_action) |
| guided_mode_reference_id | UUID | null | NULL | FK → the in-progress record (wheel, plan, person, etc.) |
| is_active | BOOLEAN | true | NOT NULL | Currently active conversation |
| archived_at | TIMESTAMPTZ | null | NULL | |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users access own conversations only.
**Indexes:**
- `user_id, is_active` (loading active conversation)
- `user_id, created_at DESC` (conversation history)

---

#### `helm_messages`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| conversation_id | UUID | | NOT NULL | FK → helm_conversations |
| user_id | UUID | | NOT NULL | FK → auth.users |
| role | TEXT | | NOT NULL | Enum: 'user', 'assistant', 'system' |
| content | TEXT | | NOT NULL | Message text |
| page_context | TEXT | null | NULL | Which page user was on when message sent |
| voice_transcript | BOOLEAN | false | NOT NULL | Whether from voice transcription |
| file_storage_path | TEXT | null | NULL | Supabase Storage path if attachment |
| file_type | TEXT | null | NULL | MIME type of attachment if present |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own messages only.
**Indexes:**
- `conversation_id, created_at` (loading messages in order)

**Note:** `helm_messages` does not have `updated_at` — messages are immutable once sent.

---

### PRD-05: The Log

#### `log_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| text | TEXT | | NOT NULL | Entry content (can be long-form) |
| entry_type | TEXT | 'journal' | NOT NULL | Enum: 'journal', 'gratitude', 'reflection', 'quick_note', 'meeting_notes', 'transcript', 'helm_conversation', 'brain_dump', 'custom' |
| life_area_tags | TEXT[] | '{}' | NOT NULL | Array of tags. AI auto-applied. GIN indexed. |
| source | TEXT | 'manual_text' | NOT NULL | Enum: 'manual_text', 'voice_transcription', 'helm_conversation', 'meeting_framework', 'unload_the_hold' |
| source_reference_id | UUID | null | NULL | FK → helm_conversations or meetings |
| audio_file_path | TEXT | null | NULL | Supabase Storage path for voice entries |
| routed_to | TEXT[] | '{}' | NOT NULL | Tracking array: 'compass_task', 'list_item', 'reminder', 'mast_entry', 'keel_entry', 'victory', 'spouse_insight', 'crew_note' |
| routed_reference_ids | JSONB | '{}' | NOT NULL | Map of route type to record ID |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| related_meeting_id | UUID | null | NULL | FK → meetings |
| archived_at | TIMESTAMPTZ | null | NULL | Null = active |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entries only.
**Indexes:**
- `user_id, created_at DESC` (chronological browsing)
- `user_id, entry_type, archived_at` (type filtering)
- `user_id, archived_at` (active entries)
- `user_id, life_area_tags` (GIN index for array queries)
- Full-text search index on `text`

---

### PRD-06: The Compass + Task Breaker + Lists

#### `compass_tasks`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Task title |
| description | TEXT | null | NULL | Optional longer description |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'completed', 'carried_forward', 'cancelled' |
| due_date | DATE | CURRENT_DATE | NULL | Null = no specific date |
| recurrence_rule | TEXT | null | NULL | Enum: 'daily', 'weekdays', 'weekly', 'custom', null |
| life_area_tag | TEXT | null | NULL | AI auto-assigned single primary tag |
| eisenhower_quadrant | TEXT | null | NULL | Enum: 'do_now', 'schedule', 'delegate', 'eliminate' |
| frog_rank | INTEGER | null | NULL | 1 = the frog |
| importance_level | TEXT | null | NULL | Enum: 'critical_1', 'important_3', 'small_9' |
| big_rock | BOOLEAN | false | NOT NULL | Big Rocks view flag |
| ivy_lee_rank | INTEGER | null | NULL | 1-6 for Ivy Lee view |
| sort_order | INTEGER | 0 | NOT NULL | Simple List and By Category order |
| parent_task_id | UUID | null | NULL | FK → compass_tasks (self-ref for subtasks) |
| task_breaker_level | TEXT | null | NULL | Enum: 'quick', 'detailed', 'granular', null |
| related_goal_id | UUID | null | NULL | FK → goals |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| related_meeting_id | UUID | null | NULL | FK → meetings |
| related_rigging_plan_id | UUID | null | NULL | FK → rigging_plans |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'helm_conversation', 'log_routed', 'meeting_action', 'rigging_output', 'wheel_commitment', 'recurring_generated', 'unload_the_hold' |
| source_reference_id | UUID | null | NULL | FK → source record |
| victory_flagged | BOOLEAN | false | NOT NULL | Recorded as victory on completion |
| completed_at | TIMESTAMPTZ | null | NULL | When completed |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own tasks only.
**Indexes:**
- `user_id, due_date, status` (today's tasks)
- `user_id, status, archived_at` (active tasks)
- `user_id, life_area_tag` (By Category view)
- `parent_task_id` (subtasks)
- `user_id, related_goal_id` (tasks by goal)
- `user_id, related_wheel_id` (tasks by Wheel)

---

#### `lists`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | List title |
| list_type | TEXT | 'custom' | NOT NULL | Enum: 'shopping', 'wishlist', 'expenses', 'todo', 'custom' |
| ai_action | TEXT | 'store_only' | NOT NULL | Enum: 'store_only', 'remind', 'schedule', 'prioritize' |
| share_token | TEXT | null | NULL | Unique token for sharing. Null = not shared. |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own lists. Future: shared access via share_token.
**Indexes:**
- `user_id, archived_at` (active lists)
- `share_token` (unique)

---

#### `list_items`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| list_id | UUID | | NOT NULL | FK → lists |
| user_id | UUID | | NOT NULL | FK → auth.users |
| text | TEXT | | NOT NULL | Item text |
| checked | BOOLEAN | false | NOT NULL | Checked off |
| sort_order | INTEGER | 0 | NOT NULL | Order within list |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own items.
**Indexes:**
- `list_id, sort_order` (items in order)

---

### PRD-07: Charts

#### `goals`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Goal title |
| description | TEXT | null | NULL | Optional description |
| life_area_tag | TEXT | null | NULL | AI auto-assigned |
| target_date | DATE | null | NULL | Optional deadline |
| status | TEXT | 'active' | NOT NULL | Enum: 'active', 'completed', 'paused', 'archived' |
| progress_type | TEXT | 'percentage' | NOT NULL | Enum: 'percentage', 'streak', 'count', 'boolean' |
| progress_current | NUMERIC | 0 | NOT NULL | Current value |
| progress_target | NUMERIC | 100 | NULL | Target value |
| related_mast_entry_id | UUID | null | NULL | FK → mast_entries |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| related_rigging_plan_id | UUID | null | NULL | FK → rigging_plans |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own goals only.
**Indexes:**
- `user_id, status, archived_at` (active goals)
- `user_id, life_area_tag` (goals by area)

---

#### `custom_trackers`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Tracker name |
| tracking_type | TEXT | | NOT NULL | Enum: 'count', 'yes_no', 'duration', 'rating' |
| target_value | NUMERIC | null | NULL | Optional daily target |
| visualization | TEXT | 'line_graph' | NOT NULL | Enum: 'line_graph', 'streak_calendar', 'bar_chart' |
| life_area_tag | TEXT | null | NULL | AI auto-assigned |
| prompt_period | TEXT | null | NULL | Enum: 'morning', 'evening', 'both', null. When to show quick-log prompt in Reveille/Reckoning. |
| sort_order | INTEGER | 0 | NOT NULL | Display order |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own trackers only.
**Indexes:**
- `user_id, archived_at` (active trackers)

---

#### `tracker_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| tracker_id | UUID | | NOT NULL | FK → custom_trackers |
| user_id | UUID | | NOT NULL | FK → auth.users |
| entry_date | DATE | CURRENT_DATE | NOT NULL | Date of entry |
| value_numeric | NUMERIC | null | NULL | For count, duration (minutes), rating |
| value_boolean | BOOLEAN | null | NULL | For yes_no type |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users CRUD own entries only.
**Indexes:**
- `tracker_id, entry_date` (entries by date)
- `user_id, entry_date` (all entries for a date)
**Constraint:** UNIQUE on `(tracker_id, entry_date)`

**Note:** `tracker_entries` has no `updated_at` — entries are replaced, not updated.

---

### PRD-08: Victory Recorder

#### `victories`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| description | TEXT | | NOT NULL | What was accomplished |
| celebration_text | TEXT | null | NULL | AI-generated, user-editable |
| life_area_tag | TEXT | null | NULL | AI auto-assigned |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'compass_task', 'log_entry', 'helm_conversation', 'chart_milestone', 'unload_the_hold' |
| source_reference_id | UUID | null | NULL | FK → source record |
| related_mast_entry_id | UUID | null | NULL | FK → mast_entries |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own victories only.
**Indexes:**
- `user_id, created_at DESC` (chronological)
- `user_id, life_area_tag` (filter by area)
- `user_id, source` (filter by source)

---

### PRD-10: Reveille + Reckoning

#### `daily_rhythm_status`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| rhythm_date | DATE | CURRENT_DATE | NOT NULL | The date this status is for |
| reveille_dismissed | BOOLEAN | false | NOT NULL | Reveille dismissed today |
| reckoning_dismissed | BOOLEAN | false | NOT NULL | Reckoning dismissed today |
| gratitude_prompt_completed | BOOLEAN | false | NOT NULL | Gratitude prompt answered today |
| joy_prompt_completed | BOOLEAN | false | NOT NULL | Joy prompt answered today |
| anticipation_prompt_completed | BOOLEAN | false | NOT NULL | Anticipation prompt answered today |
| mast_thought_morning_id | UUID | null | NULL | ID of morning reading (FK → mast_entries if Mast source) |
| morning_reading_source | TEXT | null | NULL | Enum: 'mast', 'manifest', 'log' |
| mast_thought_evening_id | UUID | null | NULL | ID of evening reading (FK → mast_entries if Mast source) |
| evening_reading_source | TEXT | null | NULL | Enum: 'mast', 'manifest', 'log' |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own status only.
**Indexes:**
- `user_id, rhythm_date` (UNIQUE)

**Note:** No `updated_at` — fields are set individually throughout the day. Records older than 90 days can be cleaned up.

---

### PRD-11: The Wheel + Life Inventory

#### `wheel_instances`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| hub_text | TEXT | | NOT NULL | Core change in user's words |
| status | TEXT | 'in_progress' | NOT NULL | Enum: 'in_progress', 'active', 'completed', 'archived' |
| spoke_1_why | TEXT | null | NULL | How this change builds self-worth/belonging |
| spoke_2_start_date | DATE | null | NULL | When the change effort begins |
| spoke_2_checkpoint_date | DATE | null | NULL | Date to evaluate progress |
| spoke_2_notes | TEXT | null | NULL | Any context about the timeline |
| spoke_3_who_i_am | TEXT | null | NULL | Compiled essay: honest assessment |
| spoke_3_who_i_want_to_be | TEXT | null | NULL | Compiled essay: vision with role models |
| spoke_4_supporter | JSONB | null | NULL | {name, relationship, what_support_looks_like, script} |
| spoke_4_reminder | JSONB | null | NULL | {name, relationship, proximity, signal, script} |
| spoke_4_observer | JSONB | null | NULL | {name, relationship, proximity, what_to_watch, script} |
| spoke_5_evidence | JSONB | null | NULL | Array of {text, source: self/observer/blind_test/fruit, seen: boolean, date_seen} |
| spoke_6_becoming | JSONB | null | NULL | Array of {text, compass_task_id} |
| current_spoke | INTEGER | 0 | NOT NULL | 0=hub only, 1-6=working on that spoke, 7=all complete |
| rim_interval_days | INTEGER | 14 | NOT NULL | Days between Rim check-ins (user adjustable) |
| next_rim_date | DATE | null | NULL | When next Rim is scheduled |
| rim_count | INTEGER | 0 | NOT NULL | How many Rim check-ins completed |
| related_mast_entry_id | UUID | null | NULL | FK → mast_entries (optional) |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations |
| life_area_tag | TEXT | null | NULL | AI auto-assigned, user removable |
| archived_at | TIMESTAMPTZ | null | NULL | |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own Wheels only.
**Indexes:**
- `user_id, status` (active Wheels)
- `user_id, next_rim_date` (upcoming Rim check-ins)

---

#### `wheel_rim_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| wheel_id | UUID | | NOT NULL | FK → wheel_instances |
| user_id | UUID | | NOT NULL | FK → auth.users |
| rim_number | INTEGER | | NOT NULL | Which check-in (1, 2, 3...) |
| notes | TEXT | null | NULL | General observations from the check-in |
| spoke_updates | JSONB | null | NULL | Any changes made to spokes during this Rim |
| evidence_progress | JSONB | null | NULL | Evidence reviewed: what has been seen, what has not |
| new_actions | JSONB | null | NULL | Any new commitments from Spoke 6 |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own Rim entries.
**Indexes:**
- `wheel_id, rim_number`

---

#### `life_inventory_areas`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| area_name | TEXT | | NOT NULL | Default enum or custom string |
| is_custom | BOOLEAN | false | NOT NULL | Whether user-created |
| display_order | INTEGER | | NOT NULL | For custom ordering |
| baseline_summary | TEXT | null | NULL | "Where I was" — first compiled observation |
| baseline_date | DATE | null | NULL | When baseline was established |
| current_summary | TEXT | null | NULL | "Where I am" — most recent compiled observation |
| current_assessed_date | DATE | null | NULL | When current summary was last updated |
| vision_summary | TEXT | null | NULL | "Where I'm wanting to end up" |
| vision_date | DATE | null | NULL | When vision was last updated |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own areas.
**Indexes:**
- `user_id, display_order` (page rendering)

---

#### `life_inventory_snapshots`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| area_id | UUID | | NOT NULL | FK → life_inventory_areas |
| user_id | UUID | | NOT NULL | FK → auth.users |
| snapshot_type | TEXT | | NOT NULL | Enum: 'baseline', 'current', 'vision' |
| summary_text | TEXT | | NOT NULL | The compiled observation at this point in time |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations (which conversation produced this) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own snapshots.
**Indexes:**
- `area_id, snapshot_type, created_at DESC` (history per area)

---

## PRD-12: First Mate (Spouse Profile & Relationship Growth)

#### `people`

Shared table for First Mate (PRD-12) and Crew (PRD-13).

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Display name |
| relationship_type | TEXT | | NOT NULL | Enum: 'spouse', 'child', 'parent', 'sibling', 'coworker', 'friend', 'mentor', 'other' |
| is_first_mate | BOOLEAN | false | NOT NULL | Only one person can be true per user |
| categories | TEXT[] | '{}' | NOT NULL | Array: 'immediate_family', 'extended_family', 'professional', 'social', 'church_community', 'custom' |
| notes | TEXT | null | NULL | General freeform notes |
| age | INTEGER | null | NULL | Optional, relevant for children |
| personality_summary | TEXT | null | NULL | AI-compiled personality shorthand (e.g., "ENFP / Type 3/2 / Acts of Service") |
| love_language | TEXT | null | NULL | Primary love language if known |
| important_dates | JSONB | null | NULL | Array of {label, date, recurring} (e.g., {label: "Anniversary", date: "2008-06-14", recurring: true}) |
| desired_sphere | TEXT | null | NULL | Enum: 'focus', 'family', 'friends', 'acquaintances', 'community', 'geo_political'. Added PRD-13. |
| current_sphere | TEXT | null | NULL | Same enum, nullable. Where the person actually IS right now. Added PRD-13. |
| has_rich_context | BOOLEAN | false | NOT NULL | Whether this person uses crew_notes. Auto-true for children. Added PRD-13. |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own people only.
**Indexes:**
- `user_id, is_first_mate` (quick First Mate lookup)
- `user_id, relationship_type, archived_at` (filtered views)
- `user_id, archived_at` (active people list)
- `user_id, desired_sphere, archived_at` (sphere view grouping — added PRD-13)

**Constraint:** Partial unique index enforcing maximum one `is_first_mate = true` per `user_id`:
```sql
CREATE UNIQUE INDEX unique_first_mate_per_user ON people (user_id) WHERE is_first_mate = true AND archived_at IS NULL;
```

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `spouse_insights`

All knowledge about the spouse from any source. Each record is one categorized insight.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people (the First Mate) |
| category | TEXT | | NOT NULL | Enum: 'personality', 'love_appreciation', 'communication', 'dreams_goals', 'challenges_needs', 'their_world', 'observation', 'their_response', 'gratitude', 'general' |
| text | TEXT | | NOT NULL | The insight content |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'spouse_prompt', 'log_routed' |
| source_label | TEXT | null | NULL | Freeform label (e.g., "Gallup StrengthsFinder", "she told me", "I noticed at dinner") |
| source_reference_id | UUID | null | NULL | FK → source record if applicable |
| file_storage_path | TEXT | null | NULL | If from uploaded file, path in Supabase Storage |
| is_rag_indexed | BOOLEAN | false | NOT NULL | True if content was too large for direct context and was sent to Manifest RAG |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own insights only.
**Indexes:**
- `user_id, person_id, category, archived_at` (category grouping on page)
- `user_id, person_id, archived_at` (all active insights)
- `user_id, person_id, source_type` (filter by source)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON spouse_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `spouse_prompts`

AI-generated prompts (questions, reflections, actions) and user responses.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people (the First Mate) |
| prompt_type | TEXT | | NOT NULL | Enum: 'ask_her', 'reflect', 'express' |
| prompt_text | TEXT | | NOT NULL | The AI-generated prompt |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'acted_on', 'skipped' |
| response_text | TEXT | null | NULL | What she said (for ask_her) or what the user observed/did (for reflect/express) |
| response_saved_as_insight | BOOLEAN | false | NOT NULL | Whether the response was also saved to spouse_insights |
| insight_id | UUID | null | NULL | FK → spouse_insights if response was saved |
| generation_context | TEXT | null | NULL | Why the AI generated this prompt (gap-filling, contextual, etc.) — for AI, not shown to user |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| acted_on_at | TIMESTAMPTZ | null | NULL | When the user marked it done |

**RLS:** Users access own prompts only.
**Indexes:**
- `user_id, person_id, status` (current pending prompt)
- `user_id, person_id, created_at DESC` (prompt history)

---

#### `cyrano_messages`

Dedicated table for Cyrano Me communication coaching data. Tracks raw user input, AI-crafted versions, teaching skills, and sent status. Enables growth tracking, skill rotation, and message export.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| people_id | UUID | | NOT NULL | FK → people (the First Mate) |
| raw_input | TEXT | | NOT NULL | What the user originally typed |
| crafted_version | TEXT | | NOT NULL | The AI's suggested version |
| final_version | TEXT | null | NULL | What the user actually sent (after edits) |
| teaching_skill | TEXT | null | NULL | CHECK: 'specificity', 'her_lens', 'feeling_over_function', 'timing', 'callback_power', 'unsaid_need', 'presence_proof' |
| teaching_note | TEXT | null | NULL | The AI's explanation of why the changes matter |
| status | TEXT | 'draft' | NOT NULL | CHECK: 'draft', 'sent', 'saved_for_later' |
| sent_at | TIMESTAMPTZ | null | NULL | When marked as sent |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations (ON DELETE SET NULL) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own cyrano_messages only.
**Indexes:**
- `user_id, status` (fetch drafts/saved)
- `user_id, created_at DESC` (message history)
- `user_id, teaching_skill` (skill distribution)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cyrano_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## PRD-13: Crew + Sphere of Influence

#### `crew_notes`

Categorized context for children and close relationships. Lighter than `spouse_insights` — no prompt system, no Marriage Toolbox.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people |
| category | TEXT | | NOT NULL | Enum: 'personality', 'interests', 'challenges', 'growth', 'observation', 'general' |
| text | TEXT | | NOT NULL | The note content |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'meeting_notes', 'log_routed' |
| source_label | TEXT | null | NULL | Freeform (e.g., "parent-child meeting," "I noticed at practice") |
| source_reference_id | UUID | null | NULL | FK → source record if applicable |
| file_storage_path | TEXT | null | NULL | If from uploaded file |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own notes only.
**Indexes:**
- `user_id, person_id, category, archived_at` (category grouping)
- `user_id, person_id, archived_at` (all notes for a person)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crew_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `sphere_entities`

Non-person influences placed in spheres (social media, news, politics, etc.).

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | e.g., "Instagram," "CNN," "Local politics" |
| entity_category | TEXT | | NOT NULL | Enum: 'social_media', 'news_media', 'politics', 'entertainment', 'ideology', 'custom' |
| desired_sphere | TEXT | | NOT NULL | Enum: 'focus', 'family', 'friends', 'acquaintances', 'community', 'geo_political' |
| current_sphere | TEXT | null | NULL | Optional |
| notes | TEXT | null | NULL | Optional freeform context |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entities only.
**Indexes:**
- `user_id, desired_sphere, archived_at` (sphere view grouping)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sphere_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## PRD-15: The Manifest (Knowledge Base & RAG)

#### `manifest_items`

Metadata for each uploaded file, transcript, or text note in the Manifest.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Display title (default: filename, user-editable) |
| file_type | TEXT | | NOT NULL | Enum: 'pdf', 'epub', 'docx', 'txt', 'md', 'audio', 'image', 'text_note' |
| file_name | TEXT | null | NULL | Original filename (null for text notes) |
| storage_path | TEXT | null | NULL | Supabase Storage path (null for text notes) |
| text_content | TEXT | null | NULL | Full extracted/transcribed text |
| file_size_bytes | INTEGER | null | NULL | |
| usage_designations | TEXT[] | '{}' | NOT NULL | Array: 'general_reference', 'framework_source', 'mast_extraction', 'keel_info', 'goal_specific', 'store_only' |
| tags | TEXT[] | '{}' | NOT NULL | Auto-generated and user-added tags |
| folder_group | TEXT | 'uncategorized' | NOT NULL | AI-assigned or user-overridden folder grouping |
| related_wheel_id | UUID | null | NULL | FK → wheels (if goal/wheel specific) |
| related_goal_id | UUID | null | NULL | FK → goals (if goal specific) |
| processing_status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'processing', 'completed', 'failed' |
| chunk_count | INTEGER | 0 | NOT NULL | Number of chunks generated |
| intake_completed | BOOLEAN | false | NOT NULL | Whether user has completed intake flow |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own items only.
**Indexes:**
- `user_id, archived_at` (active items list)
- `user_id, folder_group, archived_at` (folder view)
- `user_id, processing_status` (pending/failed items)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON manifest_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `manifest_chunks`

Chunked and embedded segments for RAG retrieval via pgvector.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items |
| chunk_index | INTEGER | | NOT NULL | Order within the source document |
| chunk_text | TEXT | | NOT NULL | The text content of this chunk |
| token_count | INTEGER | | NOT NULL | Approximate token count |
| embedding | vector(1536) | | NOT NULL | pgvector embedding (dimension matches embedding model) |
| metadata | JSONB | '{}' | NOT NULL | Chapter, page number, section heading if extractable |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own chunks only.
**Indexes:**
- `manifest_item_id` (all chunks for an item)
- HNSW index on `embedding` for similarity search

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION match_manifest_chunks(
  query_embedding vector(1536),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  manifest_item_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT mc.id, mc.manifest_item_id, mc.chunk_text, mc.metadata,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM manifest_chunks mc
  JOIN manifest_items mi ON mc.manifest_item_id = mi.id
  WHERE mc.user_id = p_user_id
    AND mi.archived_at IS NULL
    AND mi.processing_status = 'completed'
    AND mi.usage_designations && ARRAY['general_reference', 'framework_source', 'goal_specific']
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

#### `ai_frameworks`

Framework-level metadata. Each corresponds to one Manifest item designated as a framework source.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items |
| name | TEXT | | NOT NULL | Framework display name (default: source title, user-editable) |
| is_active | BOOLEAN | true | NOT NULL | Whether loaded into AI context |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own frameworks only.
**Indexes:**
- `user_id, is_active, archived_at` (active frameworks for context loading)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `ai_framework_principles`

Individual extracted principles per framework. Loaded into AI system prompt when framework is active.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| framework_id | UUID | | NOT NULL | FK → ai_frameworks |
| text | TEXT | | NOT NULL | The principle statement |
| sort_order | INTEGER | 0 | NOT NULL | User-controllable ordering |
| is_user_added | BOOLEAN | false | NOT NULL | Whether manually added vs. AI-extracted |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own principles only.
**Indexes:**
- `framework_id, sort_order, archived_at` (ordered principles per framework)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_framework_principles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## PRD-16: Rigging (Planning Tool)

#### `rigging_plans`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Plan title (AI-suggested, user-editable) |
| description | TEXT | null | NULL | Plan description |
| status | TEXT | 'active' | NOT NULL | Enum: 'active', 'completed', 'paused', 'archived' |
| planning_framework | TEXT | null | NULL | Enum: 'moscow', 'backward', 'milestone', 'premortem', 'ten_ten_ten', 'mixed' |
| frameworks_used | TEXT[] | '{}' | NOT NULL | Array of all frameworks applied (for mixed plans) |
| moscow_must_have | TEXT[] | '{}' | NOT NULL | MoSCoW: non-negotiable items |
| moscow_should_have | TEXT[] | '{}' | NOT NULL | MoSCoW: important but not critical |
| moscow_could_have | TEXT[] | '{}' | NOT NULL | MoSCoW: nice to have |
| moscow_wont_have | TEXT[] | '{}' | NOT NULL | MoSCoW: explicitly deferred |
| ten_ten_ten_decision | TEXT | null | NULL | The decision being evaluated |
| ten_ten_ten_10_days | TEXT | null | NULL | 10-day perspective |
| ten_ten_ten_10_months | TEXT | null | NULL | 10-month perspective |
| ten_ten_ten_10_years | TEXT | null | NULL | 10-year perspective |
| ten_ten_ten_conclusion | TEXT | null | NULL | Final decision and reasoning |
| related_mast_entry_ids | UUID[] | '{}' | NOT NULL | Connected Mast principles |
| related_goal_ids | UUID[] | '{}' | NOT NULL | Connected Goals |
| nudge_approaching_milestones | BOOLEAN | true | NOT NULL | Mention upcoming milestones in Reveille/Reckoning |
| nudge_related_conversations | BOOLEAN | true | NOT NULL | Connect related topics during Helm conversations |
| nudge_overdue_milestones | BOOLEAN | false | NOT NULL | Nudge about overdue milestones (default off — no guilt) |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations (the planning session that created this) |
| completed_at | TIMESTAMPTZ | null | NULL | When the plan was marked complete |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own plans only.
**Indexes:**
- `user_id, status, archived_at` (active plans list)
- `user_id, updated_at DESC` (recently updated)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `rigging_milestones`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| plan_id | UUID | | NOT NULL | FK → rigging_plans |
| title | TEXT | | NOT NULL | Milestone title |
| description | TEXT | null | NULL | Optional detail |
| sort_order | INTEGER | 0 | NOT NULL | Order within the plan |
| target_date | DATE | null | NULL | Target completion date (optional) |
| status | TEXT | 'not_started' | NOT NULL | Enum: 'not_started', 'in_progress', 'completed', 'skipped' |
| task_breaker_level | TEXT | null | NULL | Enum: 'quick', 'detailed', 'granular', null (if not yet broken down) |
| related_goal_id | UUID | null | NULL | FK → goals (if milestone maps to a specific goal) |
| completed_at | TIMESTAMPTZ | null | NULL | When milestone was completed |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users access own milestones only.
**Indexes:**
- `plan_id, sort_order` (ordered milestones per plan)
- `user_id, status, target_date` (upcoming milestones for nudging)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `rigging_obstacles`

Obstacle pre-mortem entries associated with a plan.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| plan_id | UUID | | NOT NULL | FK → rigging_plans |
| risk_description | TEXT | | NOT NULL | What could go wrong |
| mitigation_plan | TEXT | | NOT NULL | What the user will do when it happens |
| status | TEXT | 'watching' | NOT NULL | Enum: 'watching', 'triggered', 'resolved' |
| sort_order | INTEGER | 0 | NOT NULL | Display order |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users access own obstacles only.
**Indexes:**
- `plan_id, sort_order` (ordered obstacles per plan)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_obstacles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## PRD-17: Meeting Frameworks

#### `meetings`

Individual meeting records — one row per completed or in-progress meeting.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| meeting_type | TEXT | | NOT NULL | Enum: 'couple', 'parent_child', 'weekly_review', 'monthly_review', 'quarterly_inventory', 'business', 'custom' |
| template_id | UUID | null | NULL | FK → meeting_templates (for custom meetings) |
| related_person_id | UUID | null | NULL | FK → people (spouse for couple, child for parent_child, null for personal/business) |
| status | TEXT | 'in_progress' | NOT NULL | Enum: 'in_progress', 'completed', 'skipped' |
| entry_mode | TEXT | 'live' | NOT NULL | Enum: 'live', 'record_after' |
| summary | TEXT | null | NULL | AI-generated meeting summary |
| impressions | TEXT | null | NULL | User's recorded impressions/promptings |
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations |
| log_entry_id | UUID | null | NULL | FK → log_entries (if notes saved to Log) |
| meeting_date | DATE | CURRENT_DATE | NOT NULL | The date of the meeting |
| pattern_note | TEXT | null | NULL | AI-generated pattern observation (after 5+ meetings of same type) |
| completed_at | TIMESTAMPTZ | null | NULL | When the meeting was marked complete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own meetings only.
**Indexes:**
- `user_id, meeting_type, meeting_date DESC` (history by type)
- `user_id, related_person_id, meeting_date DESC` (history per person)
- `user_id, status` (in-progress meetings)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `meeting_schedules`

Recurring meeting schedule configuration.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| meeting_type | TEXT | | NOT NULL | Same enum as meetings table |
| template_id | UUID | null | NULL | FK → meeting_templates (for custom) |
| related_person_id | UUID | null | NULL | FK → people |
| frequency | TEXT | 'weekly' | NOT NULL | Enum: 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom' |
| custom_interval_days | INTEGER | null | NULL | For frequency = 'custom' |
| preferred_day | TEXT | null | NULL | Enum: 'monday', 'tuesday', ... 'sunday', null |
| preferred_time | TIME | null | NULL | Suggested time (for reminders) |
| notification_type | TEXT | 'reveille' | NOT NULL | Enum: 'reveille', 'day_before', 'both', 'none' |
| is_active | BOOLEAN | true | NOT NULL | Can pause without deleting |
| last_completed_date | DATE | null | NULL | Denormalized for quick "due" calculation |
| next_due_date | DATE | null | NULL | Calculated from frequency + last_completed |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own schedules only.
**Indexes:**
- `user_id, is_active, next_due_date` (upcoming meetings for Reveille)
- `user_id, meeting_type` (schedule by type)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `meeting_templates`

User-created custom meeting templates with agenda structure.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Template display name |
| description | TEXT | null | NULL | Optional description of the meeting's purpose |
| default_frequency | TEXT | 'weekly' | NOT NULL | Suggested frequency when scheduling |
| default_related_person_id | UUID | null | NULL | FK → people (if meeting is always with a specific person) |
| agenda_sections | JSONB | '[]' | NOT NULL | Array of {title: string, ai_prompt_text: string, sort_order: number} |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'ai_generated', 'uploaded_file' |
| file_storage_path | TEXT | null | NULL | If created from uploaded file |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own templates only.
**Indexes:**
- `user_id, archived_at` (active templates)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## PRD-18: Reminders + Rhythms

#### `reminders`

Individual reminder records with full lifecycle tracking.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| reminder_type | TEXT | | NOT NULL | Enum: 'task_due', 'task_overdue', 'streak_at_risk', 'meeting_due', 'meeting_day_before', 'important_date', 'wheel_rim', 'rigging_milestone', 'rigging_overdue', 'spouse_prompt', 'gratitude_prompt', 'joy_prompt', 'anticipation_prompt', 'list_item', 'log_routed', 'custom', 'journal_export', 'friday_overview', 'sunday_reflection', 'monthly_review', 'quarterly_inventory' |
| title | TEXT | | NOT NULL | Short display text (≤100 chars for push) |
| body | TEXT | null | NULL | Optional longer description |
| delivery_method | TEXT | 'reveille_batch' | NOT NULL | Enum: 'push', 'reveille_batch', 'reckoning_batch', 'in_app' |
| scheduled_at | TIMESTAMPTZ | null | NULL | When to deliver (null = next Reveille/Reckoning batch) |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'delivered', 'acted_on', 'dismissed', 'snoozed', 'archived' |
| snoozed_until | TIMESTAMPTZ | null | NULL | If snoozed, when to re-deliver |
| snooze_count | INTEGER | 0 | NOT NULL | Times snoozed (auto-dismiss after 3) |
| related_entity_type | TEXT | null | NULL | Enum: 'compass_task', 'meeting', 'meeting_schedule', 'person', 'wheel_instance', 'rigging_plan', 'rigging_milestone', 'list_item', 'log_entry', 'spouse_prompt', null |
| related_entity_id | UUID | null | NULL | FK → the related record |
| source_feature | TEXT | | NOT NULL | Enum: 'compass', 'meetings', 'first_mate', 'crew', 'wheel', 'rigging', 'charts', 'lists', 'log', 'rhythms', 'settings', 'user' |
| metadata | JSONB | '{}' | NOT NULL | Extra context: {person_name, date_label, streak_name, etc.} |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete / auto-cleanup |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users access own reminders only.
**Indexes:**
- `user_id, status, scheduled_at` (pending reminders due for delivery)
- `user_id, status, delivery_method` (batch queries for Reveille/Reckoning)
- `user_id, reminder_type, status` (type-filtered views)
- `user_id, related_entity_type, related_entity_id` (deduplication checks)
- `user_id, archived_at` (active reminders)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `push_subscriptions`

Web Push API subscription records per device.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| endpoint | TEXT | | NOT NULL | Push service endpoint URL |
| p256dh_key | TEXT | | NOT NULL | Client public key |
| auth_key | TEXT | | NOT NULL | Auth secret |
| device_label | TEXT | null | NULL | User-friendly device name |
| is_active | BOOLEAN | true | NOT NULL | Can deactivate without deleting |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users manage own subscriptions only.
**Indexes:**
- `user_id, is_active` (active subscriptions)
- `endpoint` (UNIQUE — prevent duplicates)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

#### `rhythm_status`

Tracks weekly/monthly/quarterly rhythm card display and dismissal.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| rhythm_type | TEXT | | NOT NULL | Enum: 'friday_overview', 'sunday_reflection', 'monthly_review', 'quarterly_inventory' |
| period_key | TEXT | | NOT NULL | Identifies the period: '2026-W08', '2026-02', '2026-Q1' |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'shown', 'dismissed', 'completed' |
| shown_at | TIMESTAMPTZ | null | NULL | |
| dismissed_at | TIMESTAMPTZ | null | NULL | |
| completed_at | TIMESTAMPTZ | null | NULL | |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own status only.
**Indexes:**
- `user_id, rhythm_type, period_key` (UNIQUE — one per rhythm per period)

**Note:** No `updated_at` — status fields set individually. Records can be cleaned up after 6 months.

---

## PRD-20: Unload the Hold

#### `hold_dumps`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| conversation_id | UUID | | NOT NULL | FK → helm_conversations |
| items_extracted | INTEGER | 0 | NOT NULL | Count of items AI extracted |
| items_routed | INTEGER | 0 | NOT NULL | Count of items user confirmed |
| items_discarded | INTEGER | 0 | NOT NULL | Count of items user discarded |
| triage_result | JSONB | '[]' | NOT NULL | Full AI triage response |
| status | TEXT | 'dumping' | NOT NULL | Enum: 'dumping', 'sorting', 'triaging', 'routed', 'cancelled' |
| log_entry_id | UUID | null | NULL | FK → log_entries (archived copy) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own dumps only.
**Indexes:**
- `user_id, created_at DESC` (history)
- `user_id, status` (active dumps)
- `conversation_id` (link to Helm conversation)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hold_dumps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## Triggers

### Auto-create profile and settings on signup

```sql
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
```

### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table with updated_at:
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mast_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON keel_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON helm_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON log_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON compass_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON list_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_trackers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON victories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON wheel_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON life_inventory_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON spouse_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crew_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sphere_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON manifest_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_framework_principles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rigging_obstacles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meeting_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hold_dumps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## Foreign Key Relationship Map

```
auth.users
  ├── user_profiles (user_id → auth.users.id)
  ├── user_settings (user_id → auth.users.id)
  ├── mast_entries (user_id → auth.users.id)
  ├── keel_entries (user_id → auth.users.id)
  ├── helm_conversations (user_id → auth.users.id)
  ├── helm_messages (user_id → auth.users.id)
  ├── log_entries (user_id → auth.users.id)
  ├── compass_tasks (user_id → auth.users.id)
  ├── lists (user_id → auth.users.id)
  ├── list_items (user_id → auth.users.id)
  ├── goals (user_id → auth.users.id)
  ├── custom_trackers (user_id → auth.users.id)
  ├── tracker_entries (user_id → auth.users.id)
  ├── victories (user_id → auth.users.id)
  ├── daily_rhythm_status (user_id → auth.users.id)
  ├── wheel_instances (user_id → auth.users.id)
  ├── wheel_rim_entries (user_id → auth.users.id)
  ├── life_inventory_snapshots (user_id → auth.users.id)
  ├── life_inventory_areas (user_id → auth.users.id)
  ├── people (user_id → auth.users.id)
  ├── crew_notes (user_id → auth.users.id)
  ├── sphere_entities (user_id → auth.users.id)
  ├── manifest_items (user_id → auth.users.id)
  ├── manifest_chunks (user_id → auth.users.id)
  ├── ai_frameworks (user_id → auth.users.id)
  ├── ai_framework_principles (user_id → auth.users.id)
  ├── spouse_insights (user_id → auth.users.id)
  ├── spouse_prompts (user_id → auth.users.id)
  ├── cyrano_messages (user_id → auth.users.id)
  ├── rigging_plans (user_id → auth.users.id)
  ├── rigging_milestones (user_id → auth.users.id)
  ├── rigging_obstacles (user_id → auth.users.id)
  ├── meetings (user_id → auth.users.id)
  ├── meeting_schedules (user_id → auth.users.id)
  ├── meeting_templates (user_id → auth.users.id)
  ├── reminders (user_id → auth.users.id)
  ├── push_subscriptions (user_id → auth.users.id)
  ├── rhythm_status (user_id → auth.users.id)
  └── hold_dumps (user_id → auth.users.id)

helm_conversations
  ├── helm_messages (conversation_id → helm_conversations.id)
  ├── log_entries (source_reference_id → helm_conversations.id, when source = 'helm_conversation')
  ├── wheel_instances (helm_conversation_id → helm_conversations.id)
  ├── rigging_plans (helm_conversation_id → helm_conversations.id)
  ├── cyrano_messages (helm_conversation_id → helm_conversations.id)
  └── hold_dumps (conversation_id → helm_conversations.id)

compass_tasks
  └── compass_tasks (parent_task_id → compass_tasks.id, self-referential for subtasks)

lists
  └── list_items (list_id → lists.id)

goals
  ├── related_mast_entry_id → mast_entries.id
  ├── related_wheel_id → wheel_instances.id
  └── related_rigging_plan_id → rigging_plans.id

custom_trackers
  └── tracker_entries (tracker_id → custom_trackers.id)

wheel_instances
  └── wheel_rim_entries (wheel_id → wheel_instances.id)

life_inventory_areas
  └── life_inventory_snapshots (area_id → life_inventory_areas.id)

people
  ├── spouse_insights (person_id → people.id)
  ├── spouse_prompts (person_id → people.id)
  ├── cyrano_messages (people_id → people.id)
  ├── crew_notes (person_id → people.id)
  ├── meetings (related_person_id → people.id)
  └── meeting_schedules (related_person_id → people.id)

manifest_items
  ├── manifest_chunks (manifest_item_id → manifest_items.id)
  └── ai_frameworks (manifest_item_id → manifest_items.id)

ai_frameworks
  └── ai_framework_principles (framework_id → ai_frameworks.id)

rigging_plans
  ├── rigging_milestones (plan_id → rigging_plans.id)
  └── rigging_obstacles (plan_id → rigging_plans.id)

rigging_milestones
  └── related_goal_id → goals.id

meetings
  ├── helm_conversations (helm_conversation_id → helm_conversations.id)
  ├── log_entries (log_entry_id → log_entries.id)
  ├── people (related_person_id → people.id)
  └── meeting_templates (template_id → meeting_templates.id)

meeting_schedules
  ├── people (related_person_id → people.id)
  └── meeting_templates (template_id → meeting_templates.id)

compass_tasks
  └── related_rigging_plan_id → rigging_plans.id
```

---

## Tables — All PRDs Complete

All tables across PRDs 01-20 have been defined (39 total). Settings (PRD-19) introduces no new tables. PRD-20 adds `hold_dumps`. PRD-12A adds `cyrano_messages`.

| Table | Expected PRD | Purpose |
|-------|-------------|---------|
| log_entries | ~~PRD-05~~ DONE | Journal / commonplace book entries |
| compass_tasks | ~~PRD-06~~ DONE | Tasks with prioritization metadata |
| lists | ~~PRD-06~~ DONE | List headers |
| list_items | ~~PRD-06~~ DONE | Individual list items |
| goals | ~~PRD-07~~ DONE | Goal tracking |
| victories | ~~PRD-08~~ DONE | Accomplishment records |
| custom_trackers | ~~PRD-07~~ DONE | Custom tracker definitions |
| tracker_entries | ~~PRD-07~~ DONE | Daily tracker log entries |
| wheel_instances | ~~PRD-11~~ DONE | Change Wheel data (hub, all spokes, rim scheduling) |
| wheel_rim_entries | ~~PRD-11~~ DONE | Periodic Rim check-in records |
| life_inventory_areas | ~~PRD-11~~ DONE | Life areas with baseline/current/vision summaries |
| life_inventory_snapshots | ~~PRD-11~~ DONE | Historical snapshots of area observations |
| people | ~~PRD-12/13~~ DONE (PRD-12) | Crew + First Mate profiles |
| spouse_insights | ~~PRD-12~~ DONE | Spouse knowledge from all sources |
| spouse_prompts | ~~PRD-12~~ DONE | AI-generated relationship prompts and responses |
| cyrano_messages | ~~PRD-12A~~ DONE | Cyrano Me communication coaching data with teaching skill tracking |
| crew_notes | ~~PRD-13~~ DONE | Categorized context for children and close relationships |
| sphere_entities | ~~PRD-13~~ DONE | Non-person influences in spheres |
| ~~people_sphere~~ | ~~PRD-13~~ REPLACED | Sphere data stored as columns on people table instead |
| manifest_items | ~~PRD-15~~ DONE | Uploaded files metadata |
| manifest_chunks | ~~PRD-15~~ DONE | Embedding chunks for RAG (pgvector) |
| ai_frameworks | ~~PRD-15~~ DONE | Extracted framework principles from Manifest uploads, loaded alongside Mast |
| ai_framework_principles | ~~PRD-15~~ DONE | Individual principle statements per framework |
| rigging_plans | ~~PRD-16~~ DONE | Planning tool records with framework data, MoSCoW, 10-10-10, nudge prefs |
| rigging_milestones | ~~PRD-16~~ DONE | Milestones within plans with target dates, status, Task Breaker level |
| rigging_obstacles | ~~PRD-16~~ DONE | Pre-mortem risk/mitigation entries with status tracking |
| meetings | ~~PRD-17~~ DONE | Individual meeting records with type, status, summary, Helm/Log links |
| meeting_schedules | ~~PRD-17~~ DONE | Recurring meeting configuration with frequency, day/time, notifications |
| meeting_templates | PRD-17 | DONE (new — user-created custom meeting templates with JSONB agenda sections) |
| reminders | ~~PRD-18~~ DONE | Reminder records with type, delivery method, lifecycle status, snooze tracking, related entity |
| push_subscriptions | PRD-18 | DONE (new — Web Push API device subscription records) |
| rhythm_status | PRD-18 | DONE (new — tracks weekly/monthly/quarterly rhythm card dismissals) |
| hold_dumps | PRD-20 | DONE (new — brain dump triage records linking to Helm conversations) |
| reminder_schedules | PRD-18 | Not needed — scheduling handled within reminders table + server-side Edge Function |

---

## Applied Migrations

| Migration | Description |
|-----------|-------------|
| 001-008 | Core schema, auth triggers, RLS policies, all tables through Phase 8B |
| 009_manifest_storage.sql | Private `manifest-files` storage bucket + updated `match_manifest_chunks` with `usage_designations` filter |
| 010_manifest_formats.sql | Expanded `manifest-files` bucket MIME types to include EPUB, DOCX, TXT, MD |
| 011_cyrano_messages.sql | Dedicated Cyrano Messages table with teaching skill tracking, migrates existing cyrano_draft spouse_insights |
| 012_delete_user_account.sql | `delete_user_account()` RPC function — SECURITY DEFINER, deletes from `auth.users` where `id = auth.uid()`, cascades to all related tables via FK constraints. Granted to `authenticated` role only. |

---

*End of Database Schema — updates with each PRD*
