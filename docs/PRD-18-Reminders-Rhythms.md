# PRD-18: Reminders + Rhythms — Notification Infrastructure & Periodic Cadences

## Overview

Reminders + Rhythms is the nervous system of StewardShip. On a ship, the watch bell doesn't decide what the crew does — it ensures the right people are alert at the right time. Reminders + Rhythms serves the same function: it delivers the right prompt to the right person at the right moment, drawn from every other feature in the app.

This PRD covers two interconnected systems:

**1. Reminders:** The scheduling engine and notification infrastructure. Every time-sensitive behavior in the app — task due dates, meeting schedules, important dates, streak maintenance, Wheel check-ins, prompted entries — flows through this system. Reminders are delivered via push notifications (for time-critical items) or batched into Reveille/Reckoning (for everything else).

**2. Rhythms:** Periodic cadences beyond the daily Reveille/Reckoning defined in PRD-10. These are time-triggered reflective experiences that create the weekly, monthly, and quarterly heartbeat of the user's growth journey:
- **Friday Overview:** Week-in-review summary card
- **Sunday Reflection:** Spiritually-focused renewal card
- **Monthly Review Prompt:** Nudge toward the Monthly Review meeting (PRD-17)
- **Quarterly Inventory Prompt:** Nudge toward the Life Inventory refresh (PRD-11/17)

The guiding principle: **StewardShip should feel like a wise companion who remembers what you told it to remember, not an anxious productivity app that buzzes every five minutes.** Reminders are helpful, merciful, and dismissable. The user is always in control.

---

## User Stories

### Reminders
- As a user, I want to be reminded about tasks that are due today so I don't forget what matters.
- As a user, I want to be reminded about important dates (anniversary, birthdays) so I can plan ahead.
- As a user, I want to set a custom reminder from any conversation or Log entry so I follow up on things I care about.
- As a user, I want to snooze a reminder when I can't act on it right now.
- As a user, I want to control which types of reminders I receive and how they're delivered.
- As a user, I want reminders batched into my morning briefing so I'm not bombarded throughout the day.
- As a user, I want time-critical reminders (meeting starting, date today) to come as push notifications.

### Rhythms
- As a user, I want a Friday summary of my week so I can reflect on what happened before the weekend.
- As a user, I want a Sunday moment of spiritual reflection to ground me before the new week.
- As a user, I want a monthly nudge to do a deeper review so I stay strategic, not just tactical.
- As a user, I want a quarterly nudge to reassess my Life Inventory so I don't drift.

### Control
- As a user, I want a master toggle to turn off all notifications when I need peace.
- As a user, I want to configure reminder delivery preferences per type (push, Reveille batch, or off).
- As a user, I want to disable any rhythm without losing my data or settings.
- As a user, I want to adjust prompt frequencies (gratitude, joy, anticipation) without disabling them entirely.

---

## Part 1: Reminders — Scheduling Engine & Notification Infrastructure

### Reminder Sources

Every reminder in StewardShip originates from one of these sources:

| Source | Trigger | Default Delivery | Example |
|--------|---------|-----------------|---------|
| **Compass tasks** | Task due date | Reveille batch | "You have 3 tasks due today" |
| **Compass recurring tasks** | Streak at risk (not logged by EOD) | Reckoning batch | "Your daily reading streak — don't forget today" |
| **Meeting schedules** | Meeting due/day-before | Reveille batch + optional push | "Couple Meeting scheduled today" |
| **Important dates (First Mate)** | Anniversary, spouse birthday | Push (day of) + Reveille | "[Wife's name]'s birthday is today" |
| **Important dates (Crew)** | Birthdays, milestones | Push (day of) + Reveille | "Jake's birthday is tomorrow" |
| **Wheel Rim check-in** | next_rim_date reached | Reveille batch | "Your Wheel check-in for [hub] is due" |
| **Rigging milestones** | Approaching target_date (if nudge enabled) | Reveille batch | "Your milestone [title] is coming up in 3 days" |
| **Rigging overdue** | Past target_date (if nudge enabled) | Reveille batch (max 2x then stops) | "Your milestone [title] was due 5 days ago" |
| **Spouse prompts** | Prompt frequency schedule | Reveille batch | "Your First Mate question for today: [prompt]" |
| **Gratitude/Joy/Anticipation** | User-configured frequency | Reckoning batch | "What are you grateful for today?" |
| **Lists** | User chose "remind me" on a list item | Reveille batch or push (based on time) | "Reminder: [list item text]" |
| **Log routed** | User set a reminder from a Log entry | Push at scheduled time | "Follow up: [Log entry excerpt]" |
| **Custom user** | User creates a freeform reminder | Push at scheduled time | "[User's reminder text]" |
| **Journal export** | Monthly (if enabled in Settings) | Push (1st of month) | "New month — would you like to export last month's journal?" |
| **Friday Overview** | Friday, user-configured time | Push + in-app card | "Your week in review is ready" |
| **Sunday Reflection** | Sunday, user-configured time | Push + in-app card | "A moment of reflection before the new week" |
| **Monthly Review** | Monthly, user-configured day | Push + Reveille | "Time for your monthly review" |
| **Quarterly Inventory** | ~90 days since last Life Inventory | Reveille only (gentle) | "It's been a few months since your last Life Inventory" |

### Delivery Methods

**1. Reveille Batch (Primary — non-urgent)**
Most reminders are batched into the morning Reveille card. This is the default and preferred delivery method. The user sees everything relevant for the day in one calm, organized view. Already defined in PRD-10; this PRD adds the reminder aggregation layer.

Reveille reminder sections (in addition to existing Reveille content from PRD-10):
- "Reminders for Today" — consolidated list of all due reminders
- Each item shows: source icon, brief text, action button (dismiss, snooze, act)
- Items grouped by type: tasks, meetings, people, growth tools, custom

**2. Reckoning Batch (Evening — reflective)**
Some reminders are more appropriate for evening: streak maintenance, gratitude/joy/anticipation prompts, follow-up on things from earlier in the day.

Reckoning reminder sections (in addition to existing Reckoning content from PRD-10):
- "Before you close the day" — evening-appropriate reminders
- Streak reminders for habits not yet logged today
- Prompted entries (gratitude, joy, anticipation) per user's frequency settings

**3. Push Notification (Time-critical only)**
Push notifications are reserved for items that need attention at a specific time or that would be missed if batched:
- Important dates (day of and day before)
- Custom reminders with a specific time set by the user
- Meeting starting soon (if user configured day-of push)
- Friday Overview / Sunday Reflection ready
- Log-routed reminders at their scheduled time

Push notifications include:
- Brief text (max ~100 characters)
- Tap action: opens the relevant page/feature in the app
- No sound by default (user can enable in device settings)

**4. In-App Alert (Contextual)**
When the user is already in the app and a reminder becomes relevant:
- Subtle banner at top of screen, auto-dismisses after 8 seconds
- Only for time-specific reminders that fire while the app is open
- Never interrupts a Helm conversation — queued until conversation is idle or user navigates away

### Reminder Lifecycle

```
CREATED → PENDING → DELIVERED → [ACTED_ON | DISMISSED | SNOOZED]
                                              ↓
                                     SNOOZED → PENDING (at snooze time)
```

**Created:** Reminder record created when the trigger condition is met (task due date set, meeting scheduled, user creates custom reminder, etc.). Some reminders are created in advance (important dates), others are generated on the day they're relevant (streak reminders).

**Pending:** Waiting for delivery time. For Reveille-batched reminders, delivery time = the user's reveille_time. For push notifications, delivery time = the scheduled time on the reminder.

**Delivered:** The reminder has been shown to the user (in Reveille, Reckoning, push, or in-app).

**Terminal states:**
- **Acted On:** User tapped to act on it (opened the task, started the meeting, etc.)
- **Dismissed:** User explicitly dismissed it
- **Snoozed:** User chose to be reminded later. Snooze presets: 1 hour, later today (6 hours), tomorrow, next week. Snoozed reminders return to PENDING with a new delivery time.

**Auto-cleanup:** Delivered reminders older than 30 days are auto-archived. Dismissed reminders older than 7 days are auto-archived. Snoozed reminders that are never acted on are auto-dismissed after 3 snooze cycles.

### Reminder Intelligence

**Deduplication:** If a task due-date reminder and a Rigging milestone reminder reference the same underlying work, the system consolidates into a single reminder with both contexts.

**Frequency Capping:** No more than 5 push notifications per day (excluding user-created custom reminders with specific times). If more than 5 would fire, the excess are batched into the next Reveille.

**Quiet Hours:** No push notifications between 10 PM and the user's reveille_time. Reminders that would fire during quiet hours are held until Reveille.

**Merciful Defaults:**
- Rigging overdue milestones: mentioned max 2 times, then stops (user already knows)
- Wheel Rim check-ins: mentioned once, then waits for the user to act
- Spouse prompts: frequency configurable, never feels like nagging
- Streak reminders: only in Reckoning (evening), never push notifications, never guilt language

---

## Part 2: Rhythms — Periodic Cadences

Rhythms are time-triggered reflective experiences that extend beyond the daily Reveille/Reckoning. They create the weekly, monthly, and quarterly heartbeat.

### Friday Overview (Weekly)

**When:** Friday, user-configured time (default: 5:00 PM). Can also be triggered manually from Crow's Nest.

**What it is:** A compact week-in-review card, similar in style to Reveille/Reckoning but focused on the whole week.

**What the user sees:**

**Section 1: Week Summary**
- "Here's your week, [name]."
- Tasks: [X] completed, [Y] carried forward, [Z] cancelled
- Victories: [N] recorded this week (brief list if ≤ 3, count if more)
- Streaks maintained: [list of active streaks]

**Section 2: Log Themes**
- AI-extracted themes from this week's Log entries (2-3 bullet points max)
- "This week's themes: [theme 1], [theme 2]"

**Section 3: Next Week Preview**
- Tasks already scheduled for next week
- Meetings due next week
- Upcoming important dates (next 7 days)
- Active Rigging milestones approaching

**Section 4: Reflection Prompt**
- A single, warm question: "What's one thing from this week you want to carry into next week?" or "What surprised you this week?"
- Response saves to Log with `entry_type = 'reflection'`

**Footer:**
- "Start Weekly Review" button → opens Personal Weekly Review meeting (PRD-17)
- "Dismiss" button

**Tracking:** Dismissal tracked in a new `rhythm_status` record for the week. Shows once per week. If dismissed, does not reappear until next Friday.

---

### Sunday Reflection (Weekly)

**When:** Sunday, user-configured time (default: 7:00 PM). Can also be triggered manually.

**What it is:** A spiritually-focused renewal moment. Shorter and more contemplative than the Friday Overview.

**What the user sees:**

**Section 1: Greeting**
- "A moment of stillness before the new week, [name]."

**Section 2: Spiritual Reading**
- A Mast principle from the faith_foundation or scripture_quote type, rotated weekly
- OR a Manifest devotional passage (if user has faith-related materials uploaded)
- Displayed in Georgia font, contemplative styling

**Section 3: Renewal Prompt**
- One of four rotating dimensions (Covey's "Sharpen the Saw," applied without attribution):
  - Physical: "How did you care for your body this week? What does your body need in the week ahead?"
  - Spiritual: "Where did you feel closest to God this week? Where do you want to draw nearer?"
  - Mental: "What did you learn this week? What are you curious about?"
  - Social/Emotional: "Who did you connect with this week? Who needs your attention next week?"
- Response saves to Log with `entry_type = 'reflection'`

**Section 4: Intention Setting**
- "What's one intention for the coming week?"
- Response saves to Log with `entry_type = 'reflection'` and optionally creates a Compass task

**Footer:**
- "Go Deeper at The Helm" button → opens free-form Helm conversation with Mast + Keel + Life Inventory loaded
- "Dismiss" button

**Faith Adaptation:** For users without faith-related Mast entries, Section 2 draws from other Mast types (values, visions) and Section 3 skips the "closest to God" framing, using secular renewal language instead.

---

### Monthly Review Prompt

**When:** User-configured day of month (default: 1st), shown in Reveille.

**What it is:** NOT a full review — just a nudge toward the Monthly Review meeting framework (PRD-17). The actual review happens at the Helm.

**What the user sees (in Reveille):**

A card in the Reveille morning briefing:
- "It's a new month, [name]. Time for your monthly review?"
- Brief stats teaser: "[X] tasks completed, [Y] victories, [Z] Log entries last month"
- "Start Monthly Review" button → opens Personal Monthly Review meeting (PRD-17)
- "Not today" button → dismisses for this month (can still start manually from Meeting Frameworks page)

If the user has a Monthly Review meeting schedule configured (PRD-17), this prompt coordinates with that schedule rather than duplicating.

---

### Quarterly Inventory Prompt

**When:** ~90 days since the last Life Inventory update (calculated from `life_inventory_areas.updated_at`). Shown in Reveille.

**What it is:** A gentle suggestion, not a demand. Many users may not want a full quarterly inventory.

**What the user sees (in Reveille):**

A card:
- "It's been about [X] months since you last updated your Life Inventory. Some things may have shifted. Want to take a fresh look?"
- "Start Life Inventory" button → opens Life Inventory guided mode (PRD-11)
- "Not now" button → dismisses. AI will not re-suggest for another 30 days.

The AI may also mention this conversationally at the Helm once (not repeatedly) if the user is discussing life changes or feeling stuck.

---

### Rhythm Settings

All rhythms are configurable in Settings:

| Rhythm | Default | Options |
|--------|---------|---------|
| Friday Overview | Enabled, Friday 5:00 PM | Day of week, time, enabled/disabled |
| Sunday Reflection | Enabled, Sunday 7:00 PM | Day of week, time, enabled/disabled |
| Monthly Review Prompt | Enabled, 1st of month | Day of month, enabled/disabled |
| Quarterly Inventory Prompt | Enabled, AI-determined | Enabled/disabled (timing is always ~90 days from last) |
| Gratitude Prompt | Daily (in Reckoning) | daily, every_other_day, weekly, off |
| Joy Prompt | Every few days (in Reckoning) | every_few_days, weekly, off |
| Anticipation Prompt | Weekly (in Reckoning) | weekly, biweekly, off |

Gratitude/Joy/Anticipation prompts are delivered within Reckoning (PRD-10) and tracked via `daily_rhythm_status`. Their frequency settings already exist in `user_settings` (PRD-01). This PRD does not change their delivery — it just confirms they're part of the Rhythms system.

---

## Part 3: Notification Preferences & Settings

### Settings Page: Notifications Section

**Master Toggle:**
- "Notifications" — ON/OFF. When off, NO push notifications are sent. Reveille/Reckoning still work (they're in-app experiences, not push).

**Quiet Hours:**
- Start time (default: 10:00 PM)
- End time (default: user's reveille_time)
- Push notifications held during quiet hours, delivered in next Reveille

**Per-Type Notification Preferences:**

| Category | Types | Delivery Options |
|----------|-------|-----------------|
| Tasks | Due today, overdue | Reveille batch, push, off |
| Meetings | Due today, day-before | Reveille batch, push, both, off |
| People | Important dates, spouse prompts | Push (day of), Reveille batch, off |
| Growth | Wheel Rim, Rigging milestones | Reveille batch, off |
| Streaks | At-risk streaks | Reckoning batch, off |
| Rhythms | Friday, Sunday, Monthly, Quarterly | Push + in-app, in-app only, off |
| Custom | User-created reminders | Push at time, Reveille batch |
| Prompts | Gratitude, joy, anticipation | Reckoning batch (frequency in separate setting), off |

Default: most things batch into Reveille/Reckoning. Push is the exception, not the rule.

**Important Dates Advance Notice:**
- "Remind me before important dates" — options: day of only, 1 day before, 3 days before, 1 week before
- Default: 1 day before
- Applies to all important dates from First Mate and Crew

---

## Data Schema

### Table: `reminders`

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
| snooze_count | INTEGER | 0 | NOT NULL | Number of times snoozed (auto-dismiss after 3) |
| related_entity_type | TEXT | null | NULL | Enum: 'compass_task', 'meeting', 'meeting_schedule', 'person', 'wheel_instance', 'rigging_plan', 'rigging_milestone', 'list_item', 'log_entry', 'spouse_prompt', null |
| related_entity_id | UUID | null | NULL | FK → the related record |
| source_feature | TEXT | | NOT NULL | Which feature created this: 'compass', 'meetings', 'first_mate', 'crew', 'wheel', 'rigging', 'charts', 'lists', 'log', 'rhythms', 'settings', 'user' |
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

### Table: `push_subscriptions`

Web Push API subscription records for the PWA.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| endpoint | TEXT | | NOT NULL | Push service endpoint URL |
| p256dh_key | TEXT | | NOT NULL | Client public key |
| auth_key | TEXT | | NOT NULL | Auth secret |
| device_label | TEXT | null | NULL | User-friendly device name (e.g., "iPhone", "Work Laptop") |
| is_active | BOOLEAN | true | NOT NULL | Can deactivate without deleting |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users manage own subscriptions only.
**Indexes:**
- `user_id, is_active` (active subscriptions for push delivery)
- `endpoint` (unique — prevent duplicate subscriptions)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

### Table: `rhythm_status`

Tracks weekly/monthly/quarterly rhythm dismissals to prevent re-showing.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| rhythm_type | TEXT | | NOT NULL | Enum: 'friday_overview', 'sunday_reflection', 'monthly_review', 'quarterly_inventory' |
| period_key | TEXT | | NOT NULL | Identifies the period: '2026-W08' (week), '2026-02' (month), '2026-Q1' (quarter) |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'shown', 'dismissed', 'completed' |
| shown_at | TIMESTAMPTZ | null | NULL | When the rhythm card was displayed |
| dismissed_at | TIMESTAMPTZ | null | NULL | When dismissed |
| completed_at | TIMESTAMPTZ | null | NULL | When the user completed the associated action (e.g., started the review) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own status only.
**Indexes:**
- `user_id, rhythm_type, period_key` (UNIQUE — one record per rhythm per period)

**Note:** `rhythm_status` has no `updated_at` — status fields are set individually. This table is lightweight and records can be cleaned up after 6 months.

---

### Changes to Existing Tables

**`user_settings` — new columns for rhythm preferences:**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| friday_overview_enabled | BOOLEAN | true | Show Friday Overview |
| friday_overview_time | TIME | '17:00' | When to trigger |
| friday_overview_day | TEXT | 'friday' | Day of week |
| sunday_reflection_enabled | BOOLEAN | true | Show Sunday Reflection |
| sunday_reflection_time | TIME | '19:00' | When to trigger |
| sunday_reflection_day | TEXT | 'sunday' | Day of week |
| monthly_review_enabled | BOOLEAN | true | Show Monthly Review prompt |
| monthly_review_day | INTEGER | 1 | Day of month (1-28) |
| quarterly_inventory_enabled | BOOLEAN | true | Show Quarterly Inventory prompt |
| quiet_hours_start | TIME | '22:00' | Push notification quiet hours start |
| quiet_hours_end | TIME | null | Null = use reveille_time |
| important_dates_advance_days | INTEGER | 1 | Days before important dates to remind (0, 1, 3, 7) |
| max_daily_push | INTEGER | 5 | Maximum push notifications per day |
| notification_tasks | TEXT | 'reveille_batch' | Enum: 'reveille_batch', 'push', 'off' |
| notification_meetings | TEXT | 'reveille_batch' | Enum: 'reveille_batch', 'push', 'both', 'off' |
| notification_people | TEXT | 'push' | Enum: 'push', 'reveille_batch', 'off' |
| notification_growth | TEXT | 'reveille_batch' | Enum: 'reveille_batch', 'off' |
| notification_streaks | TEXT | 'reckoning_batch' | Enum: 'reckoning_batch', 'off' |
| notification_rhythms | TEXT | 'push' | Enum: 'push', 'in_app', 'off' |
| notification_custom | TEXT | 'push' | Enum: 'push', 'reveille_batch' |

---

## Reminder Generation Logic

Reminders are generated by a combination of client-side checks and a server-side scheduled function.

### Client-Side (On App Open)

When the user opens the app:
1. Check `daily_rhythm_status` — is today's Reveille/Reckoning already dismissed?
2. Query `reminders` where `status = 'pending'` and `delivery_method = 'reveille_batch'` and `scheduled_at <= now()`
3. Query `meeting_schedules` where `next_due_date <= today` — generate meeting reminders if none exist
4. Query `compass_tasks` where `due_date = today` and `status = 'pending'` — generate task reminders if none exist
5. Check `rhythm_status` — should Friday/Sunday/Monthly/Quarterly be shown?

### Server-Side Scheduled Function (Supabase Edge Function, runs periodically)

A lightweight function that runs every 15 minutes (or on a cron schedule):
1. **Important dates:** For each user, check `people.important_dates` JSONB. If a date matches tomorrow or today (based on `important_dates_advance_days`), create a reminder if one doesn't already exist.
2. **Push delivery:** For reminders where `status = 'pending'` and `delivery_method = 'push'` and `scheduled_at <= now()`, send via Web Push API to the user's `push_subscriptions`.
3. **Rhythm triggers:** For each user, check if Friday/Sunday/Monthly/Quarterly rhythms should fire based on user settings and `rhythm_status`.
4. **Auto-cleanup:** Archive delivered reminders older than 30 days. Auto-dismiss reminders snoozed 3+ times.
5. **Wheel Rim reminders:** Check `wheel_instances` where `status = 'active'` and `next_rim_date <= today`. Create reminder if none exists.
6. **Rigging milestone reminders:** Check `rigging_milestones` where `target_date` is approaching and the parent plan has `nudge_approaching_milestones = true`. Create reminder if none exists.

### Deduplication

Before creating any reminder, check if one already exists for the same `related_entity_type` + `related_entity_id` + `reminder_type` with `status IN ('pending', 'delivered', 'snoozed')`. If so, don't create a duplicate.

---

## Cross-Feature Connections

### ← The Compass (PRD-06)
Task due dates and recurring task streaks generate reminders. Tasks due today → Reveille batch. Streaks at risk → Reckoning batch.

### ← Meeting Schedules (PRD-17)
`meeting_schedules.next_due_date` triggers meeting reminders. Day-before and day-of reminders per user's notification_meetings setting.

### ← First Mate (PRD-12)
Spouse important dates → push notifications with advance notice. Spouse prompt schedule → Reveille batch at user-configured frequency.

### ← Crew (PRD-13)
Crew member important dates → push notifications with advance notice. Sphere gap check-ins → post-MVP AI-suggested reminders.

### ← The Wheel (PRD-11)
Rim check-in cycle (`next_rim_date`) → Reveille batch reminder. One reminder per due date — not repeated if ignored.

### ← Rigging (PRD-16)
Approaching milestones → Reveille batch (if `nudge_approaching_milestones = true`). Overdue milestones → max 2 reminders then stops (if `nudge_overdue_milestones = true`).

### ← Charts (PRD-07)
Active streaks at risk (not logged by evening) → Reckoning batch. Never push — streaks are encouraging, not urgent.

### ← Lists (PRD-06)
List items with `ai_action = 'remind'` → reminder at user-specified time.

### ← The Log (PRD-05)
Entries routed as reminders → custom reminder at user-specified date/time.

### ← Settings (PRD-01/19)
Master notification toggle, per-type preferences, quiet hours, prompt frequencies — all control reminder behavior.

### → Reveille (PRD-10)
Pending `reveille_batch` reminders are aggregated and shown in the "Reminders for Today" section of the morning briefing.

### → Reckoning (PRD-10)
Pending `reckoning_batch` reminders are aggregated and shown in the "Before you close the day" section of the evening review.

### → Push Notifications
Time-critical reminders delivered via Web Push API to registered `push_subscriptions`.

---

## Edge Cases

### No Push Subscription
If the user has not granted push notification permission or has no active `push_subscriptions`:
- Push-designated reminders fall back to `reveille_batch` delivery
- Settings shows: "Push notifications not enabled. Enable them to receive time-sensitive reminders." with a setup button

### User in Different Timezone
All reminder scheduling uses the user's timezone from `user_profiles.timezone`. If the user travels and their device timezone changes, reminders still fire based on their configured timezone until they update it in Settings.

### Many Reminders on One Day
If more than 10 reminders are batched into Reveille:
- Show top 5 with "and [X] more" expandable section
- Priority order: important dates > meetings > tasks > growth > custom

### Reminder for Deleted Entity
If the related entity (task, plan, meeting schedule) is archived or deleted:
- Reminder is auto-archived
- Never shown to the user

### First-Time Setup
On first app open after onboarding:
- Push notification permission requested with context: "StewardShip can send you reminders for important dates, meetings, and time-sensitive tasks. You can customize what you receive in Settings."
- If declined, app works fully — just without push. User can enable later in Settings.

### Couple Meeting with No Spouse
If Couple Meeting schedule exists but First Mate is removed:
- Meeting schedule auto-deactivated
- Related reminders auto-archived

---

## What "Done" Looks Like

### MVP
- `reminders` table with full lifecycle (pending → delivered → acted_on/dismissed/snoozed/archived)
- `push_subscriptions` table for Web Push API
- `rhythm_status` table for weekly/monthly/quarterly tracking
- New `user_settings` columns for rhythm preferences and notification settings
- Reminder generation from: Compass tasks, Meeting schedules, Important dates (First Mate + Crew), Wheel Rim, Rigging milestones (if nudge enabled), Lists, Log-routed reminders, Custom user reminders
- Reveille batch delivery: "Reminders for Today" section in morning briefing
- Reckoning batch delivery: "Before you close the day" section with streaks and prompted entries
- Push notification delivery for time-critical items (important dates, custom reminders with time, meeting day-of)
- Snooze with presets: 1 hour, later today, tomorrow, next week
- Frequency capping: max 5 push per day, quiet hours
- Deduplication logic
- Friday Overview rhythm card (week summary, reflection prompt)
- Sunday Reflection rhythm card (spiritual reading, renewal prompt, intention setting)
- Monthly Review prompt in Reveille (links to PRD-17 Monthly Review meeting)
- Quarterly Inventory prompt in Reveille (links to PRD-11 Life Inventory)
- Notification Settings page: master toggle, quiet hours, per-type delivery preferences, rhythm settings
- Auto-cleanup of old reminders
- RLS on all tables

### MVP When Dependency Is Ready
- Rigging milestone nudges (requires PRD-16 full implementation)
- Wheel Rim reminders (requires PRD-11 full implementation)
- Meeting schedule reminders (requires PRD-17 full implementation)
- Spouse prompt reminders (requires PRD-12 full implementation)
- Charts streak reminders (requires PRD-07 full implementation)

### Post-MVP
- AI-determined reminders (AI notices patterns and suggests creating reminders proactively)
- Sphere gap check-in nudges (periodic nudge to review relationships drifting from desired sphere)
- Smart batching (AI optimizes delivery timing based on when user typically opens the app)
- Reminder analytics (how often does the user act on vs dismiss each type — used to auto-tune delivery)
- Google Calendar sync (meetings and important dates synced bidirectionally)
- Notification channels (separate push notification channels on Android for different reminder types)
- Location-based reminders (post-MVP, requires device location permission)
- Reminder templates (save a reminder pattern for reuse, e.g., "Every payday, review budget")

---

## CLAUDE.md Additions from This PRD

- [ ] Reminders is the notification infrastructure — every time-sensitive behavior in the app flows through it. Delivery methods: Reveille batch (default, non-urgent), Reckoning batch (evening reflective), push notification (time-critical only), in-app alert (contextual).
- [ ] Reminder lifecycle: pending → delivered → acted_on / dismissed / snoozed / archived. Snooze presets: 1 hour, later today, tomorrow, next week. Auto-dismiss after 3 snoozes.
- [ ] Merciful defaults: Rigging overdue milestones max 2 mentions then stops. Wheel Rim mentioned once. Streaks only in Reckoning, never push. No guilt language ever.
- [ ] Frequency capping: max 5 push notifications per day. Quiet hours (default 10 PM to reveille_time). Excess batched into next Reveille.
- [ ] Rhythms beyond daily Reveille/Reckoning: Friday Overview (week summary card), Sunday Reflection (spiritual renewal card), Monthly Review prompt (links to PRD-17), Quarterly Inventory prompt (links to PRD-11). All configurable day/time, all disableable.
- [ ] Friday Overview: week stats, Log themes, next week preview, reflection prompt. Sunday Reflection: spiritual reading, four-dimension renewal prompt (physical/spiritual/mental/social), intention setting. Both are lightweight cards, not full meeting sessions.
- [ ] Reminder sources: Compass tasks, Meeting schedules, Important dates (First Mate + Crew), Wheel Rim, Rigging milestones, Spouse prompts, Streaks, Lists, Log-routed, Custom user, Rhythms, Journal export.
- [ ] Push notifications require Web Push API subscription. If not granted, all reminders fall back to Reveille/Reckoning batch. App works fully without push.
- [ ] Convention: Most reminders batch into Reveille/Reckoning. Push reserved for: important dates, custom time-specific reminders, meeting day-of, rhythm triggers. StewardShip should never feel like a noisy productivity app.
- [ ] Three tables: `reminders` (individual reminder records with lifecycle), `push_subscriptions` (Web Push API device registrations), `rhythm_status` (tracks weekly/monthly/quarterly rhythm dismissals).
- [ ] New `user_settings` columns for: rhythm enable/disable and timing, quiet hours, per-type notification delivery preferences, important dates advance notice, max daily push cap.

---

## DATABASE_SCHEMA Additions from This PRD

Tables added:
- `reminders` — individual reminder records with type, delivery method, lifecycle status, snooze tracking, related entity linking, metadata
- `push_subscriptions` — Web Push API subscription records per device
- `rhythm_status` — tracks weekly/monthly/quarterly rhythm card display and dismissal

Updated tables:
- `user_settings` — new columns for rhythm preferences, notification preferences, quiet hours

Update "Tables Not Yet Defined" section:
- ~~reminders | PRD-18~~ → DONE
- push_subscriptions | PRD-18 | DONE (new)
- rhythm_status | PRD-18 | DONE (new)

Update Foreign Key map:
- auth.users → reminders, push_subscriptions, rhythm_status

---

*End of PRD-18*
