# PRD-07: Charts — Progress Tracking & Visualization

## Overview

Charts is the visual evidence of the journey. It answers the question: "Where have I been, and where am I going?" Charts aggregates data from across the app — task completions, habit streaks, goal progress, victory counts, journal frequency — and presents it as meaningful visualizations.

On a ship, charts show the waters you've navigated, the distances covered, and the course ahead. StewardShip's Charts do the same for personal growth.

Charts is primarily a READ feature — it consumes data from other features rather than creating its own. The exceptions are custom trackers, where the user defines something they want to track manually.

---

## User Stories

### Viewing Progress
- As a user, I want to see how many tasks I've completed over time so I can see my consistency.
- As a user, I want to see my habit streaks so I know how long I've maintained good practices.
- As a user, I want to see my goal progress as a percentage or visual bar so I know how close I am.
- As a user, I want to see my victory count by life area so I can see where I'm growing most.
- As a user, I want to see journal entry frequency so I can track my reflection habit.

### Time Periods
- As a user, I want to toggle between daily, weekly, monthly, and yearly views so I can see both detail and big picture.
- As a user, I want to select a custom date range for any chart.

### Custom Tracking
- As a user, I want to create a custom tracker for something not automatically captured (e.g., water intake, pages read, hours of sleep).
- As a user, I want to log a value for my custom tracker each day.

### AI Insight
- As a user, I want the AI to notice trends in my data and comment on them during conversations.
- As a user, I want the AI to celebrate milestones (streak counts, goal percentages) meaningfully.

---

## Screens

### Screen 1: Charts Main Page

**What the user sees:**
- Page title: "Charts"
- Brief contextual line: "Where you've been and where you're going."
- Time period toggle at top: Day | Week | Month | Year | Custom
- Dashboard-style layout with chart cards, scrollable vertically:

**Automatic Chart Cards (generated from app data):**

1. **Task Completion Rate**
   - Bar chart or line graph showing tasks completed vs. total by day/week
   - Shows current period compared to previous period
   - Tappable for detail view

2. **Active Streaks**
   - List of recurring tasks/habits with current streak counts
   - Each streak shows: habit name, streak count (days), last completed date
   - Streak milestones highlighted with gold accent (7 days, 30 days, 90 days, 365 days)
   - Tappable for streak history

3. **Goal Progress**
   - Progress bars for each active goal
   - Shows: goal title, percentage complete, target date (if set)
   - Tappable to navigate to goal detail

4. **Victory Summary**
   - Count of victories by life area, displayed as a simple horizontal bar chart or category breakdown
   - Time period respects the toggle at top
   - Tappable to navigate to Victory Recorder with filter applied

5. **Journal Activity**
   - Heatmap or frequency chart showing days with Log entries
   - Darker = more entries that day
   - Helps visualize journaling consistency

6. **Wheel Progress** (shown only if active Wheels exist)
   - Card per active Wheel showing: hub description, which spokes are complete, days since start, days until checkpoint
   - Tappable to navigate to Wheel detail

**Custom Tracker Cards** (user-created, see Screen 3):
- Each custom tracker displayed as its own card with the chosen visualization
- Positioned after automatic cards, user can reorder

**"Add Tracker" button** at bottom of page

**Interactions:**
- Toggle time period → all cards update to reflect selected period
- Tap any card → opens detail view (Screen 2) with more granular data
- Tap "Add Tracker" → opens Screen 3
- Pull up Helm drawer → AI has Charts summary loaded as context

---

### Screen 2: Chart Detail View

**What the user sees (varies by chart type):**

**For Task Completion:**
- Larger graph with full data points for selected period
- Toggle between bar chart and line graph
- Breakdown by life area category (optional toggle)
- Comparison to previous equivalent period (e.g., this week vs. last week)

**For Streaks:**
- Full streak history for a specific habit
- Calendar view showing which days were completed (green) vs. missed (empty)
- Longest streak, current streak, total completions
- Milestone markers on the calendar

**For Goals:**
- Goal detail: title, description, Mast connection, target date
- Progress over time as a line graph
- Related tasks and their completion status
- "Update Progress" button for manually-tracked goals

**For Victories:**
- Full victory list filtered by the selected time period
- Category breakdown chart
- Each victory tappable to view details

**For Journal Activity:**
- Calendar heatmap showing entry frequency
- Tap a day to see entries from that day (navigates to Log with date filter)

**For Wheels:**
- Visual representation of the Wheel (hub + spokes with completion status)
- Timeline of spoke completions
- Evidence entries from Spoke 5
- Next Rim check-in date

---

### Screen 3: Create Custom Tracker

**What the user sees:**
- Tracker name field (e.g., "Water intake", "Pages read", "Hours of sleep")
- Tracking type:
  - **Count** — log a number each day (e.g., glasses of water: 8)
  - **Yes/No** — did I do it today? (e.g., "Read scriptures": yes/no, builds a streak)
  - **Duration** — hours and minutes (e.g., sleep: 7h 30m)
  - **Rating** — 1-10 scale (e.g., energy level: 7)
- Target value (optional — e.g., "Goal: 8 glasses per day")
- Visualization preference:
  - Line graph (default for Count, Duration, Rating)
  - Streak calendar (default for Yes/No)
  - Bar chart
- Life area tag (AI auto-suggests based on tracker name)
- "Create" button

---

### Screen 4: Log Custom Tracker Entry

**What the user sees:**
- Accessed from the custom tracker card on Charts main page (tap "Log" button on the card)
- Also promptable from Reveille or Reckoning
- Simple input matching the tracker type:
  - Count: number input
  - Yes/No: two buttons
  - Duration: hours/minutes picker
  - Rating: 1-10 slider or tap
- Date (defaults to today, can change)
- "Save" button

Quick interaction — should take less than 5 seconds for a daily log entry.

---

## Data Schema

### Table: `goals`

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
| progress_current | NUMERIC | 0 | NOT NULL | Current progress value |
| progress_target | NUMERIC | 100 | NULL | Target value (100 for percentage, custom for count) |
| related_mast_entry_id | UUID | null | NULL | FK → mast_entries (which principle this serves) |
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

### Table: `custom_trackers`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Tracker name |
| tracking_type | TEXT | | NOT NULL | Enum: 'count', 'yes_no', 'duration', 'rating' |
| target_value | NUMERIC | null | NULL | Optional daily target |
| visualization | TEXT | 'line_graph' | NOT NULL | Enum: 'line_graph', 'streak_calendar', 'bar_chart' |
| life_area_tag | TEXT | null | NULL | AI auto-assigned |
| sort_order | INTEGER | 0 | NOT NULL | Display order on Charts page |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own trackers only.
**Indexes:**
- `user_id, archived_at` (active trackers)

---

### Table: `tracker_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| tracker_id | UUID | | NOT NULL | FK → custom_trackers |
| user_id | UUID | | NOT NULL | FK → auth.users |
| entry_date | DATE | CURRENT_DATE | NOT NULL | Date of this entry |
| value_numeric | NUMERIC | null | NULL | For count, duration (in minutes), rating |
| value_boolean | BOOLEAN | null | NULL | For yes_no type |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users CRUD own entries only.
**Indexes:**
- `tracker_id, entry_date` (loading entries for a tracker by date)
- `user_id, entry_date` (all entries for a user on a date)

**Constraint:** UNIQUE on `(tracker_id, entry_date)` — one entry per tracker per day.

---

## Data Sources (What Charts Reads From)

Charts does not own most of the data it displays. It reads from other tables:

| Chart | Data Source | Query |
|-------|-----------|-------|
| Task Completion Rate | `compass_tasks` | Count completed vs. total by date range, grouped by day/week |
| Active Streaks | `compass_tasks` where recurrence_rule is not null | Calculate consecutive completion days |
| Goal Progress | `goals` | Read progress_current vs. progress_target |
| Victory Summary | `victories` (PRD-08) | Count by life_area_tag, grouped by period |
| Journal Activity | `log_entries` | Count entries by date |
| Wheel Progress | `wheel_instances` (PRD-11) | Read spoke completion status |
| Custom Trackers | `tracker_entries` | Read values by date for the tracker |

### Streak Calculation Logic
A streak is calculated from `compass_tasks` where:
- `recurrence_rule` is not null (it's a recurring/habit task)
- Count consecutive days where `status = 'completed'` going backward from today
- A missed day breaks the streak
- Weekday-only habits: weekends don't count as misses
- Weekly habits: one completion per week maintains the streak

Streak data is calculated on-the-fly from task data, not stored separately. This avoids sync issues.

---

## AI Behavior

### Charts in AI Context
When the AI needs progress data, a summary is generated from Charts data:

```
Progress summary (Charts):
- Task completion: [X]% this week ([Y] of [Z] tasks)
- Active streaks: [habit1] (14 days), [habit2] (7 days)
- Goals: [goal1] at 65%, [goal2] at 30%
- Victories this month: [count] ([breakdown by area])
- Journal entries this week: [count]
```

This summary is loaded when:
- Progress/trends discussion at The Helm
- Weekly/monthly/quarterly review sessions
- Reckoning (abbreviated: today's stats only)
- AI detects user discussing motivation, progress, or discouragement

### Milestone Celebrations
When a milestone is reached, the AI celebrates by connecting it to identity (not generic praise):
- **Streak milestones (7, 30, 90, 365 days):** "Seven days of consistent prayer. That's not just a streak — that's a rhythm you've built into who you are."
- **Goal milestones (25%, 50%, 75%, 100%):** "You're halfway to your reading goal. The man who set that goal three months ago would be proud of the one checking it off today."
- **Victory count milestones (10, 25, 50, 100):** "Fifty victories recorded. That's fifty times you noticed your own growth and honored it."

Milestones trigger a gold accent visual on the relevant chart card. The celebration text appears in Reckoning or the next Helm interaction, not as a popup.

### Trend Observations
The AI can notice trends and bring them up naturally:
- "Your task completion has been climbing for three weeks straight. Something's clicking."
- "I notice your journaling dropped off this week. Everything okay, or just a busy stretch?"
- "Your sleep tracker shows a pattern — you tend to sleep worse on Sundays. Any idea what's going on there?"

These are offered in Helm conversations when relevant, not as unsolicited notifications.

---

## Edge Cases

### No Data Yet
- New user with no task history, no streaks, no goals
- Charts shows a friendly empty state per card: "Complete some tasks to see your progress here" / "Create a goal to start tracking" / "Add a custom tracker to measure what matters to you"
- Never shows empty graphs or zero-data charts — either show the encouragement message or hide the card until data exists

### Broken Streaks
- When a streak breaks, it's not dramatized. The card simply shows the new current streak (0 or 1) alongside "Longest streak: [X] days"
- The AI does NOT mention broken streaks unless the user brings it up. If they do, the AI is merciful: "Streaks break. It doesn't erase the 23 days you did show up. What matters is starting again."

### Goal Progress Tracking
- For percentage-based goals: user or AI updates `progress_current` manually or through task completions
- For streak-based goals: automatically calculated from task data
- For count-based goals: updated via task completions or custom tracker entries
- For boolean goals: marked complete manually

### Custom Tracker Missed Days
- If the user forgets to log a custom tracker entry, the day shows as empty (not zero)
- The user can backfill entries for past dates
- For yes_no trackers, an empty day does NOT count as "no" — it counts as "not logged"
- This distinction matters for streak calculations on custom trackers

### Large Data Sets
- For users with 6+ months of data, charts should remain performant
- Aggregate data for longer time periods (monthly/yearly views aggregate daily data)
- Consider materialized views or cached aggregations if performance becomes an issue

---

## What "Done" Looks Like

### MVP
- Charts main page with time period toggle
- Task Completion Rate chart (bar chart, daily/weekly view)
- Active Streaks display with streak counts
- Goal Progress bars for active goals
- Goals table and CRUD (create, edit, update progress, archive)
- Custom Trackers: create, log daily entries, view line graph or streak calendar
- Chart detail views for task completion and streaks
- Streak milestone gold accents (7, 30, 90, 365)
- Empty states for cards with no data
- Helm drawer from Charts loads progress summary as context
- RLS on all data

### MVP When Dependency Is Ready
- Victory Summary chart (requires PRD-08: Victory Recorder)
- Journal Activity heatmap (requires sufficient Log data)
- Wheel Progress cards (requires PRD-11: The Wheel)
- AI milestone celebrations in Reckoning (requires PRD-10)
- Custom tracker prompts in Reveille/Reckoning (requires PRD-10, PRD-18)

### Post-MVP
- AI trend observations in Helm conversations
- Comparison periods (this week vs. last week)
- Life area breakdown on task completion chart
- Export chart data as image or PDF
- Shareable progress snapshots (for accountability partners)
- Custom tracker templates (pre-made trackers for common items: water, sleep, exercise)

---

## CLAUDE.md Additions from This PRD

- [ ] Streak calculation: on-the-fly from task data, not stored separately. Weekday habits skip weekends. Weekly habits = one per week.
- [ ] Milestone celebration style: connect to identity, gold accent on chart card, text appears in Reckoning or next Helm interaction (not popup)
- [ ] Broken streaks: AI does NOT mention unless user brings it up. Merciful, not punitive.
- [ ] Empty chart states: friendly encouragement message or hide card, never show empty graphs
- [ ] Custom tracker missed days: empty ≠ no/zero. Empty = not logged. Matters for streak calc.
- [ ] Charts context for AI: summary format defined, loaded when progress/motivation discussion detected
- [ ] `goals`, `custom_trackers`, `tracker_entries` table schemas

---

*End of PRD-07*
