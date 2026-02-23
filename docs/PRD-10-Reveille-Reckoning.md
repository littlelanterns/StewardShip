# PRD-10: Reveille + Reckoning — Daily Rhythms

## Overview

Reveille and Reckoning are the bookends of the day. They are not pages in the traditional sense — they are time-triggered experiences that appear when the user opens the app at the right time. They create a daily rhythm of intentional starts and reflective closes.

On a ship, reveille is the morning call that wakes the crew and sets the day's course. Reckoning is the evening accounting — what happened, what was learned, what comes next.

Both are lightweight, card-based experiences. They aggregate data from other features into a focused briefing, help the user set or review priorities, and offer an optional pathway deeper into The Helm for conversation.

---

## Part 1: Reveille — Morning Briefing

### User Stories

- As a user, I want a brief morning overview when I open the app so I start my day with clarity.
- As a user, I want to see today's priorities so I know what matters most.
- As a user, I want a thought from my Mast or Manifest to ground my morning.
- As a user, I want to see my active streaks so I'm reminded to maintain them.
- As a user, I want to be able to edit my priorities for today right from the morning briefing.
- As a user, I want the option to go deeper in conversation if I need to process something.

### When Reveille Appears

- Reveille appears when the user opens the app between their configured reveille_time and noon (user's local time)
- Configurable in Settings: reveille_enabled (default: true), reveille_time (default: 7:00 AM)
- Reveille shows once per day. After the user dismisses it, it does not reappear that day.
- If disabled in Settings, app opens directly to Crow's Nest

### Screen: Reveille Card

**What the user sees:**

A single, clean, full-screen card (or near-full-screen) with sections that scroll vertically. The feel is calm and grounding — morning light, not alarm bells.

**Section 1: Morning Greeting**
- "Good morning, [name]."
- Today's date, day of the week

**Section 2: Morning Thought**
- A principle, scripture, or quote drawn from the user's Mast entries
- Rotation frequency configurable in Settings:
  - "Every app open" — new Mast entry each time the app is opened
  - "Daily" (default) — one entry per day, persists across app opens
  - "Weekly" — one entry per week, changes on Monday
  - "Manual" — user selects a specific Mast entry to pin until they change it
- Cycles through entries systematically (least-recently-shown) so nothing is missed over time
- Displayed in Georgia font, slightly larger, contemplative styling
- Tappable to go to The Mast

**Section 3: Morning Reading (Manifest Devotional + Log Breakthroughs)**
The AI curates a personalized reading from the user's own materials — a daily devotional drawn from THEIR library, not generic content.

**How the AI selects content:**
- Based on relevance to what the user is currently processing: active Wheel topics, recent Helm conversation themes, recent Log entry patterns, current growth areas
- If no strong relevance signal, rotates through Manifest content the user hasn't revisited recently

**Source A: Manifest Devotional (RAG-powered)**
- The AI pulls a relevant passage or insight from the user's uploaded Manifest library — scriptures, books, therapy workbooks, devotionals, personal notes
- Displayed as a brief AI-generated summary or paraphrase of the source content, with a clear source reference:
  - "From Straight Line Leadership, Chapter 3:" followed by a summary of the key principle
  - "From the Book of Mormon, 1 Nephi 6:" followed by the core message of the passage
  - "From Swedenborg, Divine Providence §60:" followed by the relevant concept
  - "From your therapist's workbook, Section on Boundaries:" followed by the applicable insight
- **Multi-source connections:** The AI may draw from multiple Manifest sources when a meaningful connection exists:
  - "Connecting Atomic Habits (Ch. 2) and your Enneagram results:" followed by an AI-synthesized insight showing how the two relate to the user's current situation
  - "Both 1 Nephi 3:7 and Straight Line Leadership, Ch. 5 speak to this:" followed by a brief synthesis
- Source references are tappable → navigate to the full content in The Manifest
- Requires Manifest to have content uploaded

**Source B: Log Breakthrough**
- The AI surfaces a past journal entry where the user had a breakthrough, insight, or moment of clarity that's relevant to what they're currently working through
- Displayed with date and framing: "Three months ago you wrote this after a hard week — it might be worth rereading today:"
- Followed by the Log entry text (truncated if long, with "Read full entry" link → navigates to the Log entry)
- Requires sufficient Log history and relevance matching

**Display:**
- Brief: 3-5 sentence summary/excerpt maximum, not a full reading
- Source attribution always visible below the content
- "Show me another" text link to get a different selection
- Slightly different visual treatment from the Mast Thought (distinct card styling so the user can tell the difference)

**Fallback logic:**
- If Manifest has content: prefer Manifest Devotional, occasionally surface Log Breakthroughs for variety
- If Manifest is empty but Log has history: show Log Breakthroughs only
- If neither has sufficient content: section hidden entirely
- Minimum thresholds: Manifest needs at least 1 uploaded document, Log needs at least 10 entries

**Section 4: Today's Priorities**
- Shows today's tasks from The Compass, ordered by the user's default view priority
- Top 5 tasks displayed (or fewer if fewer exist)
- Each task has a checkbox — user can check off tasks right here
- "Edit Priorities" button → navigates to The Compass to reorder or add
- If no tasks exist for today: "No tasks set for today. Want to plan your day?" with a button to add tasks or open The Helm

**Section 5: Streaks to Maintain**
- Shows recurring habits that need action today
- Each shows: habit name, current streak count
- Checkbox to mark as done right from Reveille
- Only shown if the user has recurring tasks

**Section 6: Upcoming Today**
- Meetings or reminders scheduled for today
- Each shows: title, time
- Only shown if items exist for today

**Section 7: Custom Tracker Prompts**
- If the user has custom trackers configured to prompt in the morning, they appear here
- Quick-log inputs matching the tracker type (number, yes/no, rating, duration)
- "Log" button next to each
- Only shown if the user has custom trackers

**Bottom Actions:**
- "Start My Day" button (dismisses Reveille, goes to Crow's Nest)
- "Talk to The Helm" button (opens full-page Helm for a morning conversation)

**Interactions:**
- Check off a task → task marked complete in Compass, subtle completion indicator
- Check off a streak habit → marked complete, streak count updates
- Log a custom tracker → entry saved
- Tap "Start My Day" → Reveille dismissed for the day, Crow's Nest loads
- Tap "Talk to The Helm" → opens Helm with morning context loaded. AI might say: "Good morning. What's on your mind as you start the day?"
- Swipe down or tap X → same as "Start My Day"

---

## Part 2: Reckoning — Evening Review

### User Stories

- As a user, I want an evening review when I open the app so I can close my day intentionally.
- As a user, I want to see what I accomplished today so I feel a sense of completion.
- As a user, I want to review my victories from today through a conversational reflection.
- As a user, I want to carry forward or reschedule incomplete tasks so tomorrow starts clean.
- As a user, I want to set my top priorities for tomorrow so I wake up with direction.
- As a user, I want a closing thought from my Mast to end the day grounded.
- As a user, I want the option to journal or go deeper in conversation if I need to process.

### When Reckoning Appears

- Reckoning appears when the user opens the app between their configured reckoning_time and midnight (user's local time)
- Configurable in Settings: reckoning_enabled (default: true), reckoning_time (default: 9:00 PM)
- Reckoning shows once per day. After the user dismisses it, it does not reappear that day.
- If disabled in Settings, app opens directly to Crow's Nest
- Also accessible manually from Crow's Nest ("Evening Review" button) at any time after reckoning_time

### Screen: Reckoning Card

**What the user sees:**

A single, clean, full-screen card with sections that scroll vertically. The feel is reflective and warm — end-of-day settling, not report card.

**Section 1: Evening Greeting**
- "Good evening, [name]. Let's look at how today went."

**Section 2: Today's Accomplishments**
- Tasks completed today: count and list
- Each completed task shown with a subtle checkmark
- If many tasks completed, show top 5 with "[X] more completed" expandable

**Section 3: Victory Review**
- If victories were recorded today: the conversational Victory Review narrative (from PRD-08)
  - AI-generated warm reflection connecting today's victories to identity, Mast, and Wheels
  - Editable
  - "Save to Log" button
- If no victories recorded today: section is skipped entirely (not shown)

**Section 4: Incomplete Tasks — Carry Forward**
- Tasks not completed today listed with options per task:
  - "Tomorrow" — moves due date to tomorrow
  - "Reschedule" — opens date picker
  - "Done with it" — marks as cancelled
  - "Still today" — keeps it (for users doing Reckoning before midnight who might still finish)
- If all tasks were completed: section shows "Everything done. Clean slate." (brief, not over-celebrating)

**Note (added during Phase 4A build):** The Compass carry forward flow is built and functional as a manual action from the Compass page. When Reckoning is built in Phase 6, it should trigger the carry forward flow as part of the evening review. The existing `CarryForwardView` component can be embedded in or navigated to from Reckoning. The Stub Registry tracks this: "Compass → Carry forward from Reckoning trigger."

**Section 5: Tomorrow's Priorities**
- "What are your top priorities for tomorrow?"
- Shows any tasks already scheduled for tomorrow
- "Add" button to create new tasks for tomorrow
- User can reorder to set priority
- AI suggestion (if Helm context is available): "Based on what carried forward and your active goals, here's what I'd suggest for tomorrow: [top 3]." Displayed as a subtle suggestion, user accepts or modifies.

**Section 6: Closing Thought**
- Same three-source system as Reveille's Morning Reading, but always a DIFFERENT selection:
  - Manifest Devotional: a relevant passage from the user's library
  - Mast Thought: one of the user's own principles
  - Log Breakthrough: a past insight worth revisiting
- Evening selection is never the same as the morning's — tracked via `daily_rhythm_status`
- Displayed in contemplative styling
- Tappable source reference → navigates to source

**Section 7: Prompted Entries (Optional)**
- If a gratitude, joy, or anticipation prompt is scheduled for today and hasn't been completed:
  - Gratitude: "What are you grateful for today?"
  - Joy: "What brought you joy recently?"
  - Anticipation: "What are you looking forward to?"
- Text input field — user can write a brief response
- "Save" → creates a Log entry with the appropriate type
- "Skip" → dismisses the prompt for today
- Only shown if prompt is due based on user's frequency settings

**Section 8: Custom Tracker Prompts (Evening)**
- Same as Reveille Section 6 but for trackers configured for evening logging
- Quick-log inputs
- Only shown if applicable

**Bottom Actions:**
- "Close My Day" button (dismisses Reckoning, goes to Crow's Nest)
- "Journal" button (opens The Log to write a full entry)
- "Talk to The Helm" button (opens full-page Helm for evening conversation)

**Interactions:**
- Carry forward a task → task updated, removed from this section
- Add tomorrow task → task created in Compass with tomorrow's date
- Accept AI priority suggestion → tasks reordered accordingly
- Write a prompted entry → Log entry created, prompt marked as completed for today
- Log a custom tracker → entry saved
- Tap "Close My Day" → Reckoning dismissed for the day
- Tap "Journal" → navigates to Log create entry
- Tap "Talk to The Helm" → opens Helm with evening context. AI might say: "How are you feeling about today?"

---

## Data Schema

Reveille and Reckoning create no new tables. They read from existing tables and write through existing features:

### Reads From
| Data | Source Table |
|------|-------------|
| User name, timezone | `user_profiles` |
| Reveille/Reckoning settings | `user_settings` |
| Morning/closing thought | `mast_entries`, `manifest_items` + `manifest_chunks` (RAG), `log_entries` (breakthroughs) |
| Relevance matching for readings | `helm_conversations`, `helm_messages`, `wheel_instances`, `log_entries` (recent) |
| Today's tasks | `compass_tasks` |
| Active streaks | `compass_tasks` (recurring) |
| Today's meetings/reminders | `meetings`, `reminders` |
| Today's victories | `victories` |
| Custom tracker prompts | `custom_trackers` |
| Prompt frequency settings | `user_settings` |

### Writes Through
| Action | Destination |
|--------|------------|
| Check off task | Updates `compass_tasks.status` |
| Check off streak habit | Updates `compass_tasks.status` |
| Carry forward task | Updates `compass_tasks.due_date` |
| Cancel task | Updates `compass_tasks.status` to 'cancelled' |
| Add tomorrow task | Creates new `compass_tasks` record |
| Log custom tracker | Creates `tracker_entries` record |
| Save prompted entry | Creates `log_entries` record |
| Save Victory Review to Log | Creates `log_entries` record |

### Tracking Dismissal

To ensure Reveille and Reckoning show only once per day, we need a lightweight tracking mechanism:

#### Table: `daily_rhythm_status`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| rhythm_date | DATE | CURRENT_DATE | NOT NULL | The date this status is for |
| reveille_dismissed | BOOLEAN | false | NOT NULL | Has Reveille been dismissed today |
| reckoning_dismissed | BOOLEAN | false | NOT NULL | Has Reckoning been dismissed today |
| gratitude_prompt_completed | BOOLEAN | false | NOT NULL | Has today's gratitude prompt been answered |
| joy_prompt_completed | BOOLEAN | false | NOT NULL | Has today's joy/wonder prompt been answered |
| anticipation_prompt_completed | BOOLEAN | false | NOT NULL | Has today's anticipation prompt been answered |
| mast_thought_morning_id | UUID | null | NULL | FK → mast_entries (if Mast source). ID of morning reading. |
| morning_reading_source | TEXT | null | NULL | Enum: 'mast', 'manifest', 'log'. Which source was shown. |
| mast_thought_evening_id | UUID | null | NULL | FK → mast_entries (if Mast source). ID of evening reading. |
| evening_reading_source | TEXT | null | NULL | Enum: 'mast', 'manifest', 'log'. Which source was shown. |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own status only.
**Indexes:**
- `user_id, rhythm_date` (UNIQUE — one record per user per day)

**Note:** Records are created on first app open each day. Old records can be cleaned up periodically (keep last 90 days).

---

## Morning/Evening Reading Selection Logic

### Three Sources
1. **Mast Thought:** User's own principles, declarations, scriptures, values
2. **Manifest Devotional:** AI-summarized content from user's uploaded library (RAG-powered), with chapter/verse/section references
3. **Log Breakthrough:** Past journal entries containing insights or breakthroughs, contextually relevant to current situation

### Mast Thought Rotation Settings
Rotation frequency is controlled by `user_settings.mast_thought_rotation`:
- **every_open:** New selection each time the app is opened
- **daily:** New selection once per day (default). Stored in `daily_rhythm_status`.
- **weekly:** New selection once per week, changes on Monday
- **manual:** User pins a specific entry to display until they change it

### Selection Logic
1. Determine which source types are enabled in Settings (Mast, Manifest, Log — one or more)
2. For Manifest Devotional: run RAG query weighted by recent Helm themes, active Wheels, and recent Log entries. Generate brief summary with source attribution (book + chapter, scripture reference, etc.)
3. For Mast Thought: query all active Mast entries, select least-recently-shown
4. For Log Breakthrough: query Log entries older than 30 days, score for insight/breakthrough language, match to current context
5. If multiple sources enabled: rotate between them or select the most contextually relevant
6. Store morning selection in `daily_rhythm_status.mast_thought_morning_id` (and source type)
7. Evening selection is always different from morning — different source or different entry
8. "Show me another" on either reading cycles to the next best option

---

## Morning Reading Selection Logic

The Morning Reading draws from the user's own uploaded materials and journal history. Selection priority:

1. **Relevance match:** AI checks recent Helm conversation themes, active Wheel topics, and recent Log entry patterns. If a Manifest passage or Log breakthrough is relevant to what the user has been processing, prioritize it.
2. **Unvisited highlights:** If no strong relevance signal, rotate through Manifest content and significant Log entries the user hasn't been shown recently.
3. **Source variety:** Alternate between Manifest uploads (books, scriptures, therapy notes) and Log breakthroughs so the user gets variety.

The Morning Reading is generated via a lightweight RAG query against Manifest embeddings + a recency check against Log entries. The AI selects the excerpt and writes a brief framing if needed, but the content itself is always the user's own material.

This section requires The Manifest (PRD-15) to be built for uploaded materials, and sufficient Log history for journal-sourced readings.

---

## AI Behavior

### Reveille Context
When the user taps "Talk to The Helm" from Reveille, the AI receives:
- Today's tasks and priorities
- Active streaks at risk (habits due today)
- Any meetings or reminders for today
- The morning Mast thought that was displayed
- Recent context from last few days of Log entries

The AI opens with something grounded and practical, not overly enthusiastic:
- "Good morning. You've got [X] things on your plate today. Anything weighing on you before you start?"
- "Morning. Your biggest task today looks like [frog task]. Want to think through how to approach it?"

### Reckoning Context
When the user taps "Talk to The Helm" from Reckoning, the AI receives:
- Today's completed tasks and victories
- Incomplete tasks and carry-forward decisions
- Tomorrow's current priorities
- Today's Log entries
- The evening Mast thought
- Victory Review narrative (if generated)

The AI opens with something reflective:
- "How are you feeling about today?"
- "Looks like you got through [X] of your [Y] tasks. How do you feel about what's left?"
- If heavy day detected from Log: "It looks like today was a lot. Want to talk about it, or just close things out and rest?"

### Prompted Entry Suggestions
When a gratitude/joy/anticipation prompt appears in Reckoning and the user writes a response, the AI does not intervene. The prompt is a simple capture moment, not a conversation starter. The entry saves to the Log quietly.

If the user taps "Talk to The Helm" AFTER writing a prompted entry, the AI can reference it: "I saw you mentioned being grateful for [X]. That's worth holding onto."

---

## Edge Cases

### App Opened Multiple Times
- Reveille/Reckoning show on first qualifying open only
- Once dismissed, they don't reappear until the next day
- Tracked via `daily_rhythm_status`

### App Opened During Both Windows
- If the user opens the app at 7am (Reveille) and again at 10pm (Reckoning), they see both — one each
- The two experiences never overlap or interfere

### Midnight Crossover
- If the user opens the app at 11:30pm and is still in Reckoning at 12:01am, they remain in Reckoning (it doesn't suddenly switch to Reveille)
- The next Reveille triggers on the next morning open after the new day's reveille_time

### User Changes Time Zones
- If the user travels and their device timezone changes, Reveille/Reckoning times are based on the timezone in `user_profiles`
- User can update their timezone in Settings to match their current location

### No Tasks, No Streaks, No Victories
- Reveille with no tasks: Section 3 shows "No tasks set for today" with add/plan options. Other sections shown if applicable.
- Reckoning with nothing completed: Section 2 shows "No tasks were checked off today. Some days are like that." No guilt. Section 4 shows any pending tasks for carry-forward.
- Sections with no data are hidden, not shown blank. The experience contracts gracefully.

### Reveille Disabled, Reckoning Enabled (or vice versa)
- Each is independently toggleable
- Disabling one has no effect on the other

---

## What "Done" Looks Like

### MVP
- Reveille: morning greeting, Mast thought (with configurable rotation: every open/daily/weekly/custom), today's priorities (with checkboxes), streak reminders, "Start My Day" and "Talk to Helm" buttons
- Reckoning: evening greeting, today's accomplishments, carry forward flow, tomorrow's priorities, closing Mast thought, "Close My Day" / "Journal" / "Talk to Helm" buttons
- Victory Review embedded in Reckoning (from PRD-08)
- Prompted entries in Reckoning (gratitude/joy/anticipation based on frequency settings)
- Once-per-day display with dismissal tracking
- Mast thought rotation with configurable frequency
- Settings: enable/disable each, set times, set Mast thought rotation frequency
- Reveille/Reckoning context passed to Helm when user opens conversation from either

### MVP When Dependency Is Ready
- Morning Reading section in Reveille (requires PRD-15: The Manifest for uploaded materials, and sufficient Log history)
- Upcoming meetings/reminders in Reveille (requires PRD-17, PRD-18)
- Custom tracker prompts in both (requires custom trackers with morning/evening config)
- AI priority suggestions for tomorrow in Reckoning (requires accumulated task/goal data)

### Post-MVP
- Prompted entries in Reveille (morning gratitude option)
- Weekly Reveille variant on Mondays (week preview)
- Reckoning weekly summary option on Fridays/Sundays
- Notification to open the app at Reveille/Reckoning time (push notification)
- Animated transitions between sections (calm, not flashy)

---

## CLAUDE.md Additions from This PRD

- [ ] Reveille/Reckoning are time-triggered experiences, not navigable pages (though Reckoning also accessible manually from Crow's Nest)
- [ ] Show once per day, tracked via `daily_rhythm_status` table
- [ ] Mast thought rotation: systematic cycling, morning and evening always different, least-recently-shown selection
- [ ] Sections with no data are hidden — experience contracts gracefully, never shows blank sections
- [ ] No guilt language in empty states: "Some days are like that" not "You didn't complete anything"
- [ ] Prompted entries (gratitude/joy/anticipation) are simple captures, not conversation starters
- [ ] `daily_rhythm_status` table schema

---

*End of PRD-10*
