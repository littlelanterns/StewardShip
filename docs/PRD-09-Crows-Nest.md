# PRD-09: Crow's Nest — Dashboard / Command Center

## Overview

The Crow's Nest is the home page. It's the first thing the user sees when opening the app (unless Reveille or Reckoning intercepts). It answers the question: "What's the state of my voyage right now?"

On a ship, the crow's nest is the highest vantage point — the place where you can see everything at once. StewardShip's Crow's Nest gives the user a panoramic view of their life across all features, surfaced as summary cards they can tap to go deeper.

The Crow's Nest creates no data of its own. It is entirely a read-and-navigate feature — aggregating from every other feature and providing quick access to all of them.

---

## User Stories

### At a Glance
- As a user, I want to see a summary of my day when I open the app so I know what needs my attention.
- As a user, I want to see my active streaks so I'm motivated to maintain them.
- As a user, I want to see recent victories so I'm reminded of my progress.
- As a user, I want to see my active Wheels so I know what I'm working on changing.
- As a user, I want to see upcoming reminders and meetings so nothing sneaks up on me.

### Navigation
- As a user, I want to tap any card to go directly to that feature so I can act on what I see.
- As a user, I want quick-action buttons so I can start common actions without navigating through menus.

### Personalization
- As a user, I want the dashboard to feel relevant to MY day, not a generic layout.

---

## Screens

### Screen 1: Crow's Nest Main Page

**What the user sees:**

**Top Section: Greeting**
- Personalized greeting using display name and time of day:
  - Morning (5am-12pm): "Good morning, [name]."
  - Afternoon (12pm-5pm): "Good afternoon, [name]."
  - Evening (5pm-9pm): "Good evening, [name]."
  - Night (9pm-5am): "Burning the midnight oil, [name]?"
- Today's date, day of the week
- Optional: A brief Mast-sourced thought or principle (rotated daily, drawn from the user's own Mast entries). Displayed as a subtle, italicized line beneath the greeting. Tappable to go to The Mast.

**Card Section: Summary Cards (scrollable vertically)**

Each card is tappable to navigate to the relevant feature. Cards are displayed in a fixed order but only appear when they have content to show. Empty cards are hidden, not shown as blank.

---

**Card 1: Today's Compass**
- Shows: number of tasks today, number completed, number remaining
- Top 3 uncompleted tasks listed by priority (from whichever view is set as default)
- Quick-action: "Add Task" button on the card
- Tap card → navigates to The Compass

---

**Card 2: Active Streaks**
- Shows: top 3-5 active streaks with current count
- Any streak approaching a milestone (e.g., at 27 days, approaching 30) gets a subtle highlight
- Tap card → navigates to Charts (streaks detail)
- Only shown if the user has recurring tasks with active streaks

---

**Card 3: Recent Victories**
- Shows: last 2-3 victories with brief description text (truncated)
- Victory count for the current week
- Gold accent on this card (consistent with Victory Recorder theming)
- Tap card → navigates to Victory Recorder
- Only shown if victories exist

---

**Card 4: Active Wheels**
- Shows: one card per active Wheel (max 3 displayed, "View all" if more)
- Each shows: hub description, progress indicator (which spokes complete), days since start
- Tap a Wheel card → navigates to that Wheel's detail page
- Only shown if active Wheels exist

---

**Card 5: Goals in Progress**
- Shows: top 3 active goals with progress bars
- Goals closest to completion shown first
- Tap card → navigates to Charts (goals detail)
- Only shown if active goals exist

---

**Card 6: Upcoming**
- Shows: next 3 upcoming items across reminders, meetings, and scheduled tasks
- Each item shows: title/description, date/time, type indicator (reminder, meeting, task)
- Tap an individual item → navigates to its source
- Tap the card header → navigates to a combined upcoming view (or Settings for reminders)
- Only shown if upcoming items exist within the next 7 days

---

**Card 7: Journal Snapshot**
- Shows: number of Log entries this week, last entry date, brief text preview of most recent entry
- Quick-action: "New Entry" button on the card
- Tap card → navigates to The Log
- Only shown if Log entries exist (hide for brand new users until they write their first entry)

---

**Card 8: Mast Thought**
- Shows: a randomly selected Mast entry (rotates daily or on each app open)
- Displayed as a clean, contemplative card with the principle text
- Tap card → navigates to The Mast
- Only shown if Mast entries exist

---

**Quick Actions Bar**
Below or above the cards (sticky at bottom of screen or between greeting and cards):
- "New Task" → opens Compass add task
- "New Entry" → opens Log create entry
- "Record Victory" → opens Victory Recorder create
- "Open Helm" → opens full-page Helm

These are always visible regardless of which cards are showing.

---

**Interactions:**
- Pull-to-refresh → reloads all card data
- Pull up Helm drawer → AI has full dashboard context (today's tasks, streaks, recent victories, active Wheels)
- Scroll vertically through cards
- Each card tappable to its feature

---

## Data Sources

The Crow's Nest reads from every major feature table but writes to none.

| Card | Data Source | Query |
|------|-----------|-------|
| Today's Compass | `compass_tasks` | Where due_date = today AND status = 'pending', count completed today |
| Active Streaks | `compass_tasks` | Recurring tasks, calculate consecutive completion days |
| Recent Victories | `victories` | Last 3 by created_at, count this week |
| Active Wheels | `wheel_instances` | Where status = 'active', spoke completion status |
| Goals in Progress | `goals` | Where status = 'active', ordered by progress_current DESC |
| Upcoming | `reminders`, `meetings`, `compass_tasks` | Next 7 days, sorted by date |
| Journal Snapshot | `log_entries` | Count this week, most recent entry |
| Mast Thought | `mast_entries` | Random active entry, rotated daily |

---

## AI Behavior

### Dashboard Context at The Helm
When the Helm drawer is opened from the Crow's Nest, the AI receives a summary of the dashboard state:

```
Dashboard summary (Crow's Nest):
- Today: [X] tasks, [Y] completed, [Z] remaining. Top pending: [task1], [task2], [task3]
- Streaks: [habit1] ([N] days), [habit2] ([N] days)
- Recent victories: [count] this week
- Active Wheels: [count] — [hub descriptions]
- Goals: [goal1] at [X]%, [goal2] at [Y]%
- Upcoming: [next item] on [date]
```

This allows the AI to offer contextual help: "You have 6 tasks left today and it's already 4pm. Want to identify which 2-3 are most important and defer the rest?"

### No AI-Generated Dashboard Content
The Crow's Nest does not generate AI content. All text on cards comes directly from stored data. The Mast Thought card displays the user's own words. This keeps the dashboard fast and avoids API calls on every page load.

The one exception: if Reveille is disabled and the user opens the app in the morning, the greeting could optionally include a brief AI-generated morning thought (but this is a Reveille feature, not a Crow's Nest feature — see PRD-10).

---

## Layout Considerations

### Mobile (Primary)
- Single column of cards, full width
- Quick Actions bar fixed at bottom above the navigation bar
- Greeting at top, cards scroll beneath
- Cards are compact — just enough info to be useful, not enough to replace the actual feature page

### Tablet / Desktop
- Two-column card layout
- Greeting spans full width
- Quick Actions bar in the greeting area or sidebar
- Cards can be slightly larger with more detail visible

### Card Sizing
- Cards should be uniform height within each row (on desktop) or variable height (on mobile, content-driven)
- No card should require scrolling within itself — if content overflows, truncate with "View more" which navigates to the feature

---

## Edge Cases

### Brand New User (No Data)
- Greeting still shows with name
- Mast Thought card hidden (no Mast entries yet)
- All other cards hidden (no data)
- Instead of an empty page, show a welcoming message:
  - "Welcome aboard, [name]. Your voyage starts here."
  - Below: brief orientation — "Start by setting your guiding principles on The Mast, or jump straight into journaling in The Log. Wherever you begin, your Crow's Nest will grow to reflect your journey."
  - Quick action buttons still visible so the user has clear entry points

### Partially Set Up User
- Cards appear as their features get used
- A user who has only set up their Mast and written two Log entries sees: Mast Thought card + Journal Snapshot card + Quick Actions
- No pressure to "complete" the dashboard — it fills in naturally

### Stale Data
- Dashboard data refreshes on every page visit (not cached between visits)
- Pull-to-refresh available for manual refresh within a visit
- Data queries should be lightweight (counts and recent items, not full table scans)

### Time Zone Handling
- Greeting time of day based on user's timezone from `user_profiles`
- "Today's" tasks based on user's local date
- Upcoming items sorted by user's local time

---

## What "Done" Looks Like

### MVP
- Crow's Nest as home page with personalized greeting
- Today's Compass card with task counts and top 3 pending
- Active Streaks card with counts
- Mast Thought card (random daily rotation)
- Journal Snapshot card
- Quick Actions bar (New Task, New Entry, Record Victory, Open Helm)
- All cards tappable to navigate to their feature
- Empty cards hidden, new user welcome message
- Helm drawer from Crow's Nest loads dashboard summary
- RLS respected on all data queries

### MVP When Dependency Is Ready
- Recent Victories card (requires PRD-08 with data)
- Active Wheels card (requires PRD-11)
- Goals in Progress card (requires goals with data)
- Upcoming card (requires PRD-17 meetings + PRD-18 reminders)

### Post-MVP
- Card reordering (user drags to customize card priority)
- Card visibility toggles (user hides cards they don't want)
- Two-column tablet/desktop layout
- Dashboard-specific widgets (weather, calendar preview)
- Time-of-day adaptive card priority (morning: show tasks first; evening: show victories first)

---

## CLAUDE.md Additions from This PRD

- [ ] Crow's Nest is read-only — creates no data, aggregates from all features
- [ ] Cards only shown when they have content. Empty cards hidden, never displayed blank.
- [ ] New user welcome message pattern: warm orientation, not empty state guilt
- [ ] No AI-generated content on dashboard (keeps it fast, no API calls on page load)
- [ ] Dashboard context format for Helm defined
- [ ] Time-of-day greeting logic based on user timezone

---

*End of PRD-09*
