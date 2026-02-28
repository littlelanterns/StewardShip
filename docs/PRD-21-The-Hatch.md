# PRD-21: The Hatch (Smart Notepad)
## StewardShip — Capture Anything, Route It Anywhere

**Feature Name:** The Hatch
**Database Prefix:** `hatch_`
**Route:** `/hatch` (full-page mode + history)
**Component Folder:** `src/components/hatch/`
**Hook:** `src/hooks/useHatch.ts`

**Status:** Not Started
**Dependencies:** PRD-04 (Helm), PRD-05 (Log), PRD-06 (Compass + Lists), PRD-07 (Charts), PRD-08 (Victory Recorder), PRD-11B (Voice Input), PRD-17 (Meeting Frameworks)
**Created:** February 27, 2026

---

## Table of Contents

1. [Philosophy & Role](#philosophy)
2. [What The Hatch Is NOT](#what-it-is-not)
3. [Location & Layout](#location)
4. [Core Behavior](#core-behavior)
5. [Tabs & Autosave](#tabs)
6. [Voice Input](#voice)
7. [Full-Page Mode](#full-page)
8. [Routing System: "Send to..." Grid](#routing)
9. [Routing Destinations](#destinations)
10. [Track Progress Routing (Inline Picker)](#track-progress)
11. [Tasks & Lists Routing Details](#tasks-lists)
12. [Agenda Routing (Inline Meeting Picker)](#agenda)
13. [Review & Route (AI Extraction)](#review-route)
14. [Edit in Hatch (Universal Action)](#edit-in-hatch)
15. [Tab Lifecycle After Routing](#lifecycle)
16. [Hatch History](#history)
17. [Relationship to The Log](#log-relationship)
18. [Relationship to Helm Conversation History](#helm-relationship)
19. [Database Schema](#schema)
20. [Edge Functions](#edge-functions)
21. [AI Context Integration](#ai-context)
22. [Component Architecture](#components)
23. [Design & Styling](#design)
24. [Settings Integration](#settings)
25. [Stub Registry Additions](#stubs)
26. [Build Phases](#build-phases)
27. [Acceptance Criteria](#acceptance-criteria)

---

<a id="philosophy"></a>
## 1. Philosophy & Role

The Hatch is the **universal front door** for capturing content in StewardShip. Its core philosophy:

> **Capture anything from one place, route it where it needs to go later.**

Users should never have to figure out where something goes before they capture it. The Hatch is the "I have a thought" entry point. Capture first, decide where it goes second. This eliminates the cognitive load of navigating to the right feature before jotting something down.

### Three Roles
1. **Fresh capture:** Start typing or speaking something new from scratch
2. **AI editing desk:** "Edit in Hatch" from any Helm conversation to refine before saving
3. **Routing hub:** "Send to..." menu sends finished content to its permanent home

### Alignment with Design Principles
The Hatch embodies the **Human-in-the-Mix** principle: nothing goes from an AI conversation into the permanent record without the user touching it first. AI generates, human reviews and edits in The Hatch, human decides where it goes via routing.

This also supports the **"designing for a non-planner"** principle — someone who has a thought shouldn't need to decide whether it's a task, journal entry, or goal before they can capture it.

---

<a id="what-it-is-not"></a>
## 2. What The Hatch Is NOT

- It is NOT The Log (The Log is the organized history/read view)
- It is NOT a permanent storage location (content is routed elsewhere or archived)
- It is NOT The Helm (The Helm is the AI conversation interface in the bottom drawer)
- It does NOT replace direct writing surfaces — The Log's `+` button, Victory's `+`, and other feature-specific entry points continue to work as they do today

### The Hybrid Approach
Existing features keep their direct entry points. The Hatch is an **additional** universal entry point. Users who know they want a Log entry can still tap `+` on The Log page. Users who have a thought and don't know where it goes yet start in The Hatch. Two doors to the same rooms.

---

<a id="location"></a>
## 3. Location & Layout

### Desktop
- Lives in a **right drawer** — a new addition to StewardShip's existing layout
- `>` button to collapse the drawer, `<` to reopen
- Remembers open/closed state per user (persisted in `user_settings`)
- Sits alongside the main content area without affecting existing layout

### Desktop Layout with Hatch
```
┌─────────┬──────────────────────────────────────┬─────────────────┐
│         │                              [⚙]     │                 │
│  Side   │                                      │  THE HATCH      │
│  Menu   │       Main Content Area              │  (right drawer) │
│         │                                      │                 │
│         │                                      │                 │
│ < close │                                      │         close > │
│         │                                      │                 │
├─────────┴──────────────────────────────────────┴─────────────────┤
│                   ^ The Helm (pull-up drawer)                    │
└──────────────────────────────────────────────────────────────────┘
```

### Mobile
- **Slide-in from right** (gesture or button tap)
- Not visible by default on mobile (screen real estate)
- Full functionality when open (tabs, voice, routing, full-page mode)
- Full-page mode is especially useful on mobile where the drawer is narrow
- Access via a dedicated icon in bottom navigation bar or floating action button

### Responsive Behavior
- On narrow viewports (e.g., 13" laptop with sidebar open), the Hatch auto-collapses to prevent squeezing the main content area
- Priority order for display space: main content > Helm drawer > sidebar > Hatch
- The Hatch never overlaps The Helm — they occupy separate zones

### StewardShip Layout Considerations
- No five-zone layout adoption — StewardShip's existing layout stays as-is
- The Helm stays where it currently is (bottom drawer)
- The Hatch is simply a new right-side drawer added to the existing interface
- No QuickTasks top drawer

---

<a id="core-behavior"></a>
## 4. Core Behavior

- **Autosaves continuously** — leaving the page and coming back, everything is still there
- Content persists **across sessions** (saved to database via `hatch_tabs` table), not just within a single browser session
- Content persists until the user either:
  - Routes it via "Send to..." (tab closes, moves to history)
  - Manually closes the tab with the X button (moves to history as archived)
- Multiple tabs supported (see Tabs section)
- Voice-to-text input available (microphone button, reusing existing `VoiceRecordButton`)
- Tabs are auto-named by The Helm based on content; user can rename anytime

---

<a id="tabs"></a>
## 5. Tabs & Autosave

### Tab Behavior
- Can have **multiple tabs** open simultaneously
- Each tab is an independent capture workspace
- Each tab has its own **X button** to close (moves to history as archived)
- Tabs are auto-named by Helm based on content (e.g., "Morning brain dump Feb 27", "Meeting prep notes")
- User can click/tap the tab name to rename manually
- New tab: `+` button in the tab bar
- Soft limit: **10 concurrent active tabs** — warning shown but not enforced hard

### Autosave
- Content saves to `hatch_tabs` table via debounced updates (500ms after last keystroke)
- If the user navigates away, closes the browser, or switches devices, tabs and content are preserved exactly as left
- Autosave is silent — no "saving..." indicator unless on slow connection (show subtle indicator after 3s without successful save)

### Tab States
- **Active:** Currently open in the drawer, editable. `status = 'active'`
- **Routed:** Content was sent somewhere via "Send to...", tab closed. `status = 'routed'`
- **Archived:** Tab was manually closed (X button) without routing. `status = 'archived'`

---

<a id="voice"></a>
## 6. Voice Input

### Implementation
Reuses the existing `VoiceRecordButton` shared component and `whisper-transcribe` Edge Function built in Phase 11B.

### Behavior in The Hatch
- Microphone button present in the input/toolbar area of each tab
- Creates raw text in the current tab (just a transcript)
- No automatic AI extraction (unlike Meetings, which could auto-extract)
- User decides what to do: edit as a document, route with "Send to...", or hit "Review & Route" to trigger Helm extraction
- Maximum flexibility — it's their workspace

### Fallback
- **Online:** Whisper API (primary — accurate, ~$0.006/minute)
- **Offline:** Browser Web Speech API (automatic fallback when no internet detected)

---

<a id="full-page"></a>
## 7. Full-Page Mode

### Behavior
- **Expand button** (Lucide `Maximize2` icon) in the top corner of The Hatch
- Clicking it transitions the current tab to fill the **full main content area**
- Tab and all content stay exactly the same — only the viewport changes
- **Collapse button** (`Minimize2`) returns the tab to the right drawer
- All functionality identical in full-page mode (routing buttons, voice input, tabs)
- Sidebar remains accessible (can be open or closed alongside full-page Hatch)

### Use Cases
- Working on longer content before routing to The Log
- Reviewing and editing AI-generated content from a Helm conversation
- Voice brain dump sessions where more writing space is needed
- Editing meeting transcripts

### Route
Full-page mode uses the `/hatch` route. The Hatch History page is also available at `/hatch` with a tab/toggle to switch between active workspace and history view.

---

<a id="routing"></a>
## 8. Routing System: "Send to..." Grid

### Layout
At the bottom of each Hatch tab:

**Two buttons side by side:**
- **"Send to..."** (primary, `var(--color-cognac)`) — opens the routing grid
- **"Review & Route"** (secondary, `var(--color-mid-teal)`) — triggers Helm AI extraction

### "Send to..." Grid Structure

**Favorites Section (top, larger buttons):**
- Top 3-4 most-used destinations
- Auto-sorted by user's personal usage frequency (tracked in `hatch_routing_stats`)
- Each shows a Lucide icon + label with subtle tinted background
- Favorites adapt over time as usage patterns change

**All Destinations Section (below, compact grid):**
- Full grid of every routing option
- Lucide icon + label for each
- Subtle hover effects (background tint + border color change)
- Cancel button at the bottom to close the grid

### Visual Style
- Follows StewardShip's Captain's Quarters theme
- Each destination has its own accent color for the icon badge
- Hover states: background tints to the destination's accent color
- Clean, not overwhelming — organized and scannable

---

<a id="destinations"></a>
## 9. Routing Destinations (10 Total)

| Destination | StewardShip Name | Lucide Icon | Accent Color | What Happens |
|---|---|---|---|---|
| The Log | Journal entry | BookOpen | `var(--color-deep-teal)` | Saves as Log entry (tagged, searchable, filterable) |
| The Compass (individual) | Individual tasks | CheckSquare | `var(--color-gold)` | Helm parses into separate task items, opens Compass with drafts |
| The Compass (single) | Single task | ClipboardCheck | `var(--color-gold)` | Saves entire note as one task, opens Compass for configuration |
| Lists | List card | List | `var(--color-mid-teal)` | Saves items as a single list with checkboxes, opens Lists page |
| Victory | Victory record | Trophy | `var(--color-gold)` | Records as a victory/accomplishment |
| The Keel | Self-knowledge entry | Compass | `var(--color-cognac)` | Saves to user's Keel profile |
| The Mast | Guiding star update | Star | `var(--color-gold)` | Updates Mast principles/declarations |
| Note | General note | StickyNote | `var(--color-slate-gray)` | Saves as a general note (minimal routing, just capture) |
| Agenda | Meeting Framework agenda | Users | `var(--color-deep-brown)` | Opens inline meeting picker overlay (see Agenda section) |
| Charts + Goals | Progress tracker | BarChart2 | `var(--color-mid-teal)` | Opens inline chart/tracker picker overlay (see Track Progress section) |

### Inline Picker Overlay Pattern
Two destinations use an **inline picker overlay** — a small menu that appears within the Send To grid without navigating away:

| Destination | Picker Shows | Create New Option |
|---|---|---|
| Agenda | Upcoming meetings with agenda capability | "+Create Meeting" |
| Charts + Goals | Existing trackers/charts (Helm pre-highlights suggested match) | "+Create Tracker" |

This is a single reusable component (`InlinePickerOverlay`) populated with different data per destination. Build once, use twice. Extensible for future picker candidates (e.g., List picker for adding to existing lists).

---

<a id="track-progress"></a>
## 10. Track Progress Routing (Inline Picker)

### How It Works
When user selects "Charts + Goals" from the Send To grid:

1. **Inline chart/tracker picker overlay appears** (same pattern as Agenda picker)
2. Shows all existing trackers, with **Helm's suggested match pre-highlighted** based on content analysis:
   - "Water Intake" (highlighted if content mentions water)
   - "Exercise"
   - "Reading"
   - etc.
3. **"+Create Tracker"** button at the bottom if no match exists
4. User confirms the suggested tracker or picks a different one
5. **Helm extracts the data point** and logs it to the selected tracker
6. **User moves on** — minimal friction

### Smart Matching Examples
- "Drank 8 glasses of water" → Water Intake tracker
- "Ran 2 miles this morning" → Exercise tracker
- "Read 30 pages" → Reading tracker
- "Practiced piano for 20 minutes" → Music Practice tracker

### When No Tracker Exists
Helm offers to create one:
> "I don't see a tracker for that. Want me to create one?"

### Review & Correction
On the **Charts page**, a **"Recently Tracked" review section** shows:
- What was logged, which tracker it was applied to, when
- **Edit button** on each entry for corrections
- Items age off the review section after 2 days
- Data stays permanently in the tracker

---

<a id="tasks-lists"></a>
## 11. Tasks & Lists Routing Details

### "Save & Edit as Tasks" (Individual — The Compass)
- Helm parses content into separate task items
- Each becomes its own **draft task** on the Compass page
- User assigns: due date, priority, recurrence, category, etc.
- Supports the full Compass task configuration flow

### "Save as Single Task" (The Compass)
- Entire note becomes **one task** (useful for complex tasks with details or sub-steps)
- Opens Compass for configuration
- Sub-steps can be formatted as a checklist within the single task

### "Save & Edit as List" (Lists)
- Items stay grouped as a **single list card with checkboxes**
- Card gets a title (AI-suggested or user-named)
- Routes to **Lists page** as one unit for further organization
- Can be saved as a reusable routine list if applicable

---

<a id="agenda"></a>
## 12. Agenda Routing (Inline Meeting Picker)

### Behavior
When user selects "Agenda" from the Send To grid:

1. **Inline overlay appears** within the Send To grid
2. Shows a list of **upcoming meetings with agenda capability:**
   - "Weekly Check-in — Saturday"
   - "Mentor Session — Next Tuesday"
   - etc. (pulled from `meeting_schedules` + `meetings`)
3. User taps the meeting they want to add the agenda item to
4. **"+Create Meeting"** button at the bottom for new meetings
5. Content is added as an agenda item to the selected meeting (uses `meeting_agenda_items` table)

### Agenda Item Source Tracking
The agenda item retains a reference back to the Hatch history entry (`source_hatch_tab_id`), so the user can see where the agenda item originated.

---

<a id="review-route"></a>
## 13. Review & Route (AI Extraction)

### What It Is
"Review & Route" triggers The Helm to scan content, extract actionable/saveable items, and present them as individually routable cards. This is the power feature that turns a voice brain dump or long note into organized, routed content.

### Where It's Available
- Hatch tabs (button at bottom alongside "Send to...")
- Helm conversations (action button on conversations)
- Meeting transcripts (after recording ends)
- Any content surface where "Review & Route" button appears

### How It Works
1. User taps "Review & Route"
2. Helm processes the content via the `hatch-extract` Edge Function and identifies structured items
3. Extracted items appear as **cards**, each with its own routing buttons (same Send To icon set)
4. User reviews each item, can edit the text, and clicks the destination button
5. "Skip" option for items they don't want to route
6. Skipped items remain in the original content

### Extraction Categories
Helm identifies and tags items by type:
- **Action items** → suggested as The Compass tasks
- **Calendar dates/events** → flagged for user awareness (no calendar feature yet)
- **Emotional insights / reflections** → suggested as The Log entries
- **Personal revelations** → suggested as The Keel entries
- **Values / commitments** → suggested as The Mast updates
- **Victories / accomplishments** → suggested as Victory entries
- **Trackable data** → suggested as Charts + Goals
- **Meeting follow-ups** → suggested as Agenda items
- **Shopping/needs** → suggested as List items
- **General notes** → suggested as Note

### Example Output
```
Extracted from: Morning brain dump (8 min voice note)

┌─────────────────────────────────────────────────┐
│ "I need to schedule the car for an oil change"   │
│ [Compass] [Note] [Skip]                         │
├─────────────────────────────────────────────────┤
│ "I realized I've been neglecting my reading goal"│
│ [Log] [Keel] [Note] [Skip]                      │
├─────────────────────────────────────────────────┤
│ "Ran 3 miles this morning!"                      │
│ [Victory] [Charts] [Skip]                        │
├─────────────────────────────────────────────────┤
│ "Want to discuss vacation plans at Friday mtg"   │
│ [Agenda] [Note] [Skip]                           │
├─────────────────────────────────────────────────┤
│ "Feeling grateful for the conversation with Sam" │
│ [Log] [Note] [Skip]                              │
└─────────────────────────────────────────────────┘

[Route All Selected] [Edit Full Content in Hatch] [Save as Note Only]
```

### Edge Function: `hatch-extract`
New Edge Function for AI extraction. Takes content text as input, returns structured JSON array of extracted items with suggested destinations and confidence scores.

**Request:**
```json
{
  "content": "string — the raw text to extract from",
  "user_context": {
    "trackers": ["Water Intake", "Exercise", "Reading"],
    "upcoming_meetings": ["Weekly Check-in — Saturday"],
    "mast_declarations": ["I will prioritize health"]
  }
}
```

**Response:**
```json
{
  "items": [
    {
      "text": "I need to schedule the car for an oil change",
      "type": "action_item",
      "suggested_destinations": ["compass_single", "note"],
      "confidence": 0.92
    }
  ]
}
```

---

<a id="edit-in-hatch"></a>
## 14. "Edit in Hatch" (Universal Action)

### What It Is
"Edit in Hatch" is available on Helm conversations and other content surfaces. It sends content to a new Hatch tab for editing before routing.

### Where It's Available
- Any Helm conversation (general chat in bottom drawer)
- Helm guided mode sessions (Wheel, Rigging, First Mate, etc.)
- Meeting transcripts
- Helm conversation history (reviewing past conversations)
- Extracted items from Review & Route (edit individual items before routing)

### How It Works
1. User sees content they want to refine (a Helm response, generated talking points, etc.)
2. They select a **specific section** or choose to send the **whole conversation**
3. Content appears in a **new Hatch tab**, fully editable
4. User refines, edits, adds their own thoughts
5. When ready, they route it via "Send to..." or "Review & Route"

### Use Case Examples
- **Cyrano generates a message draft** → "Edit in Hatch" → refine wording → copy final draft
- **Helm surfaces an insight during Wheel session** → "Edit in Hatch" → add personal reflection → "Send to..." The Log
- **Higgins creates talking points** → "Edit in Hatch" → adjust for specific situation → "Send to..." Agenda
- **Helm helps draft a Mast declaration** → "Edit in Hatch" → make it their own words → "Send to..." The Mast

### Alignment with Human-in-the-Mix
This ensures AI-generated content always passes through a human editing step before being saved permanently. The Hatch is the bridge between AI output and the user's permanent record.

---

<a id="lifecycle"></a>
## 15. Tab Lifecycle After Routing

### The Flow
1. **User routes content** via "Send to..." → destination selected
2. **Tab closes** with a brief **"Undo" toast** (visible for 5 seconds, allows reversal)
3. **Tab moves to Hatch History** → tagged with destination (e.g., "Routed to: The Compass", "Routed to: Weekly Check-in Agenda")
4. **In Hatch History**, clicking a routed entry opens the content **in its destination**, not back in The Hatch:
   - Routed to The Compass → opens Compass page with that task
   - Routed to Agenda → opens meeting with that agenda item
   - Routed to The Log → opens that Log entry
   - Went through Review & Route → opens the extraction results
5. The original Hatch content is preserved in history regardless

### Undo Behavior
- After routing, a small toast notification appears: "[Tab name] sent to [Destination]. Undo?"
- If user clicks "Undo" within ~5 seconds, the tab reopens with all content intact, routing is reversed
- If the toast expires, the routing is finalized

---

<a id="history"></a>
## 16. Hatch History

### What It Contains
Every Hatch tab that has ever had content, organized by state:

- **Active:** Currently open in the drawer, editable
- **Routed:** Content was sent somewhere via "Send to...", tagged with destination + link
- **Archived:** Tab was manually closed (X button) without routing, content preserved

### Access Points
- **Quick access:** Dropdown in the Hatch drawer header (recent items, clock icon)
- **Full view:** Full-page mode at `/hatch` with history toggle

### Capabilities
- **Sort** by: date created, date modified, name, status
- **Filter** by: status (active/routed/archived), destination, date range
- **Search** through content of all history entries
- **Reopen** an archived entry (creates a new active tab with the content)
- **Delete** history entries permanently
- **Click routed entries** to navigate to destination

### Auto-Naming
- Tabs are auto-named by Helm based on content (e.g., "Morning brain dump Feb 27", "Meeting prep notes")
- Uses the same auto-titling pattern as Helm conversations
- User can rename at any time by clicking/tapping the tab name

---

<a id="log-relationship"></a>
## 17. Relationship to The Log

### Clear Separation of Roles
- **The Hatch** = input/editing tool (capture and route)
- **The Log** = organized output/history (view, filter, reflect)

### The Hybrid Approach
- The Log's `+` button continues to create entries directly (no change to existing behavior)
- The Hatch's "Send to... → The Log" also creates Log entries
- Both paths result in the same `journal_entries` record
- When routed from The Hatch, the entry includes `source = 'hatch'` for tracking

### What Appears in The Log
Only content that was **explicitly routed there** by the user:
- Hatch entries routed via "Send to... → The Log"
- Reflections from Reveille/Reckoning
- Victories (tagged as such)
- Meeting notes (routed by user)
- Content routed from Review & Route extraction
- Direct entries via The Log's own `+` button

### What Does NOT Appear in The Log
- Raw Helm conversation transcripts (those live in Helm History)
- Unrouted Hatch content (still in Hatch tabs or history)
- Tasks (live in Compass)
- Lists (live in Lists)

---

<a id="helm-relationship"></a>
## 18. Relationship to Helm Conversation History

### Clear Separation
- **Helm Conversation History** = raw AI interactions (complete conversation logs)
- **The Log** = user-curated content (only what the user chose to keep)
- **The Hatch** = the bridge between them (edit and route)

### Helm History Enhancements
With The Hatch, Helm conversations gain:
- **"Edit in Hatch"** button available on any conversation or message
- **"Review & Route"** button available on any conversation
- View which items were extracted/routed from a conversation (tracked via `source_helm_conversation_id`)

### Helm History Does NOT Appear in The Log
Conversations stay in Helm History unless the user explicitly routes content from them to The Log via The Hatch.

---

<a id="schema"></a>
## 19. Database Schema

### Table: `hatch_tabs`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | 'Untitled' | NOT NULL | Auto-named by Helm, user-editable |
| content | TEXT | '' | NOT NULL | Raw text content of the tab |
| status | TEXT | 'active' | NOT NULL | Enum: 'active', 'routed', 'archived' |
| routed_to | TEXT | null | NULL | Destination identifier (e.g., 'log', 'compass_individual', 'compass_single', 'lists', 'victory', 'keel', 'mast', 'note', 'agenda', 'charts') |
| routed_destination_id | UUID | null | NULL | FK to the created record in the destination table (e.g., the `journal_entries.id`, `compass_tasks.id`) |
| routed_meeting_id | UUID | null | NULL | FK → meetings.id (for agenda routing) |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'helm_edit', 'review_route', 'voice' |
| source_helm_conversation_id | UUID | null | NULL | FK → helm_conversations.id (if created via "Edit in Hatch") |
| sort_order | INTEGER | 0 | NOT NULL | Tab position in the tab bar |
| is_auto_named | BOOLEAN | true | NOT NULL | Whether the title was auto-generated (vs user-renamed) |
| archived_at | TIMESTAMPTZ | null | NULL | When tab was archived/closed |
| routed_at | TIMESTAMPTZ | null | NULL | When content was routed |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own tabs only.
**Indexes:** `user_id`, `status`, `user_id + status` (composite for active tab queries), `updated_at DESC`.

### Table: `hatch_routing_stats`

Tracks per-user routing frequency for the Favorites section of the Send To grid.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| destination | TEXT | | NOT NULL | Same enum as `hatch_tabs.routed_to` |
| route_count | INTEGER | 0 | NOT NULL | Lifetime count |
| last_used_at | TIMESTAMPTZ | now() | NOT NULL | For recency weighting |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own stats only.
**Unique constraint:** `(user_id, destination)`.

### Table: `hatch_extracted_items`

Stores items extracted via Review & Route for tracking and undo capability.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| hatch_tab_id | UUID | | NOT NULL | FK → hatch_tabs.id |
| extracted_text | TEXT | | NOT NULL | The text of the extracted item |
| item_type | TEXT | | NOT NULL | Enum: 'action_item', 'reflection', 'revelation', 'value', 'victory', 'trackable', 'meeting_followup', 'list_item', 'general' |
| suggested_destination | TEXT | | NOT NULL | AI's primary suggestion |
| actual_destination | TEXT | null | NULL | Where user actually routed it (null if skipped) |
| destination_record_id | UUID | null | NULL | FK to created record |
| confidence | REAL | | NOT NULL | AI confidence score 0-1 |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'routed', 'skipped' |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own items only.
**Indexes:** `hatch_tab_id`, `user_id + status`.

### Migration: `025_hatch.sql`

Creates all three tables, indexes, RLS policies, and auto-update triggers. Also adds `source_hatch_tab_id UUID NULL` column to `meeting_agenda_items` for agenda item source tracking.

### Updates to Existing Tables

**`journal_entries`:** The existing `source` column (TEXT) should include `'hatch'` as a valid source value. No schema change needed — just ensure the app passes `source: 'hatch'` when routing from The Hatch.

**`user_settings`:** Add `hatch_drawer_open BOOLEAN DEFAULT true` for persisting drawer state.

---

<a id="edge-functions"></a>
## 20. Edge Functions

### `hatch-extract` (New)
AI extraction for Review & Route.

**Purpose:** Takes raw text content and user context, returns structured extracted items with suggested destinations and confidence scores.

**Model:** Claude Haiku (cost-optimized — extraction is formulaic, doesn't need Sonnet)

**System Prompt Pattern:**
```
You are an extraction assistant for a personal growth app. 
Analyze the provided text and extract discrete items that could be:
- Action items (tasks to do)
- Reflections or emotional insights (journal-worthy)
- Personal revelations (self-knowledge)
- Values or commitments (guiding principles)
- Victories or accomplishments
- Trackable data points (numbers, durations, quantities)
- Meeting follow-ups (agenda items)
- List items (shopping, packing, etc.)
- General notes

For each extracted item, provide:
1. The exact text (cleaned up from speech if needed)
2. The item type
3. Suggested destination(s) ranked by relevance
4. Confidence score (0-1)

Context about user's existing trackers and meetings is provided to improve matching.
Return JSON only.
```

**Input:** Content text + user context (tracker names, upcoming meeting names, Mast declarations)
**Output:** JSON array of extracted items

### `hatch-auto-title` (New — or extend existing auto-title pattern)
Generates a descriptive title for a Hatch tab based on its content. Can reuse the same pattern as Helm conversation auto-titling.

**Model:** Claude Haiku
**Input:** First ~500 characters of tab content
**Output:** Short descriptive title (3-6 words)

---

<a id="ai-context"></a>
## 21. AI Context Integration

### Helm Context Loading
Add `shouldLoadHatch` keyword function and `formatHatchContext` to the existing context assembly pipeline.

**Keywords:** "notepad", "hatch", "note", "jotted", "wrote down", "captured", "drafting"

**Context format:**
```
## Active Hatch Tabs
The user has [N] active tabs in The Hatch:
- "[Tab title]" — [first 100 chars of content]...
- "[Tab title]" — [first 100 chars of content]...
```

This allows Helm to reference what the user is currently working on in The Hatch if they mention it in conversation.

### Hatch Uses Helm Context
When Review & Route or Track Progress matching occurs, the Hatch passes relevant user context to the AI:
- Existing tracker names (for smart matching)
- Upcoming meeting names (for agenda matching)
- Mast declarations (for value/commitment matching)

---

<a id="components"></a>
## 22. Component Architecture

```
src/components/hatch/
├── HatchDrawer.tsx          — Right drawer shell (open/close, resize)
├── HatchDrawer.css
├── HatchTabBar.tsx          — Tab bar with +, tab names, close buttons
├── HatchTabContent.tsx      — Text editor for individual tab content
├── HatchToolbar.tsx         — Voice button, expand/collapse, history access
├── HatchSendToGrid.tsx      — The "Send to..." routing grid
├── HatchDestinationButton.tsx — Individual destination in the grid
├── HatchInlinePickerOverlay.tsx — Reusable picker for Agenda + Charts
├── HatchReviewRoute.tsx     — Review & Route extraction results view
├── HatchExtractedCard.tsx   — Individual extracted item with routing buttons
├── HatchHistory.tsx         — History view (full-page accessible)
├── HatchHistoryItem.tsx     — Individual history entry
└── HatchUndoToast.tsx       — Toast notification after routing
```

### Hook: `useHatch`
```typescript
// Core state
activeTabs: HatchTab[]
activeTabId: string | null
loading: boolean

// Tab operations
createTab(sourceType?: HatchSourceType, content?: string, sourceConversationId?: string): Promise<HatchTab>
updateTabContent(tabId: string, content: string): void  // debounced
updateTabTitle(tabId: string, title: string): Promise<void>
closeTab(tabId: string): Promise<void>  // archives
reorderTabs(tabIds: string[]): Promise<void>
reopenTab(tabId: string): Promise<HatchTab>  // from history

// Routing
routeTab(tabId: string, destination: string, destinationId?: string, meetingId?: string): Promise<void>
undoRoute(tabId: string): Promise<void>
getRoutingStats(): Promise<HatchRoutingStat[]>

// Review & Route
extractItems(tabId: string): Promise<HatchExtractedItem[]>
routeExtractedItem(itemId: string, destination: string): Promise<void>
skipExtractedItem(itemId: string): Promise<void>

// History
getHistory(filters?: HatchHistoryFilters): Promise<HatchTab[]>
searchHistory(query: string): Promise<HatchTab[]>
deleteHistoryItem(tabId: string): Promise<void>

// Auto-title
autoTitleTab(tabId: string): Promise<string>
```

### Context: `HatchContext`
```typescript
interface HatchContextType {
  // Drawer state
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
  
  // Full-page mode
  isFullPage: boolean
  enterFullPage: () => void
  exitFullPage: () => void
  
  // Tab management (delegated from useHatch)
  activeTabs: HatchTab[]
  activeTabId: string | null
  setActiveTabId: (id: string) => void
  createTab: (sourceType?: HatchSourceType, content?: string, sourceConversationId?: string) => Promise<HatchTab>
  // ... remaining operations from useHatch
}
```

The `HatchProvider` wraps the app alongside `HelmProvider` in `App.tsx`.

---

<a id="design"></a>
## 23. Design & Styling

### General
- Follows StewardShip's Captain's Quarters theme
- All colors via CSS variables — never hardcoded
- Mobile-first responsive design
- Minimum 44px touch targets
- No emoji on the interface
- No gold effects (reserved for victories only)

### Drawer Styling
- Background: `var(--color-cream)` or slightly warmer variant
- Border left: subtle `var(--color-slate-gray)` at reduced opacity
- Drawer width: ~320px on desktop (adjustable via CSS variable `--hatch-drawer-width`)
- Smooth transition for open/close animation

### Tab Bar
- Background: slightly darker than drawer body (`color-mix(in srgb, var(--color-deep-teal) 5%, var(--color-cream))`)
- Active tab: `var(--color-cream)` background with bottom border accent
- Tab text: `var(--font-heading, Georgia, serif)` for tab names
- `+` button: `var(--color-mid-teal)` icon

### Text Editor
- Clean textarea or contenteditable area
- Font: system sans-serif for body text (consistent with rest of app)
- Subtle placeholder: "What's on your mind?" or "Drop it in The Hatch..."
- Line height and padding for comfortable reading/writing

### Send To Grid
- "Send to..." button: `var(--color-cognac)` background, `var(--color-cream)` text
- "Review & Route" button: `var(--color-mid-teal)` background, `var(--color-cream)` text
- Grid: 3-column layout for destinations on desktop, 2-column on mobile
- Each destination has a consistent accent color (same color in grid, in history tags, and in the destination feature)
- Cancel button: subtle, text-only at bottom of grid

### Icons
- Lucide icons throughout (consistent with rest of app)
- No emoji icons
- Icon + text label for all routing buttons

---

<a id="settings"></a>
## 24. Settings Integration

Add a **"The Hatch"** section to Settings (between existing sections, logical placement near "The Log" or "The Helm"):

- **Default drawer state:** Open / Closed on desktop (toggle)
- **Auto-title tabs:** On / Off (toggle — some users may prefer manual naming)
- **Show Review & Route button:** On / Off (toggle — some users may find it overwhelming initially)
- **Clear all Hatch history:** Destructive action with confirmation modal

---

<a id="stubs"></a>
## 25. Stub Registry Additions

### New Stubs Created by The Hatch

| Stub | Created By | Wired By | Status |
|------|-----------|----------|--------|
| Hatch → Helm context loading (active tabs) | PRD-21 (Hatch) | Phase A (Hatch build) | STUB |
| Hatch → "Edit in Hatch" button on Helm messages | PRD-21 (Hatch) | Phase B (Hatch build) | STUB |
| Hatch → "Review & Route" button on Helm conversations | PRD-21 (Hatch) | Phase B (Hatch build) | STUB |
| Hatch → Charts "Recently Tracked" review section | PRD-21 (Hatch) | Enhancement | STUB |
| Hatch → Meeting agenda item source tracking | PRD-21 (Hatch) | Phase A (Hatch build) | STUB |
| Hatch → Crow's Nest widget for active Hatch tabs | PRD-21 (Hatch) | Enhancement | STUB |
| Hatch → Mobile bottom nav icon or FAB access | PRD-21 (Hatch) | Phase A (Hatch build) | STUB |

### Existing Stubs Wired by The Hatch
None — The Hatch is a new feature that doesn't wire any previously created stubs.

---

<a id="build-phases"></a>
## 26. Build Phases

### Phase A: Core Hatch (Drawer + Tabs + Direct Routing)

**Database:**
- Migration `025_hatch.sql`: `hatch_tabs`, `hatch_routing_stats` tables, RLS, indexes, triggers
- Add `hatch_drawer_open` to `user_settings`

**Types:**
- `HatchTab`, `HatchTabStatus`, `HatchSourceType`, `HatchRoutingDestination`, `HatchRoutingStat`

**Components:**
- `HatchDrawer` (right drawer shell with open/close, responsive behavior)
- `HatchTabBar` (tab management, +, close, rename)
- `HatchTabContent` (text editor with autosave)
- `HatchToolbar` (voice button via `VoiceRecordButton`, expand, history access)
- `HatchSendToGrid` (routing grid with favorites + all destinations)
- `HatchDestinationButton` (individual destination)
- `HatchInlinePickerOverlay` (for Agenda + Charts destinations)
- `HatchUndoToast` (undo after routing)

**Hook:**
- `useHatch` (CRUD, autosave, routing, routing stats)

**Context:**
- `HatchContext` + `HatchProvider` in App.tsx

**Integration:**
- Wire `HatchDrawer` into main layout
- Voice input via existing `VoiceRecordButton` + `whisper-transcribe`
- Direct routing to: The Log, Compass, Lists, Victory, Keel, Mast, Note
- Inline picker routing to: Agenda (meetings), Charts + Goals (trackers)
- Routing stats tracking for favorites
- Settings section

**Auto-titling:**
- `hatch-auto-title` Edge Function (or reuse existing auto-title pattern)

### Phase B: AI Extraction + Full-Page Mode + History + Edit in Hatch

**Database:**
- Add `hatch_extracted_items` table to migration
- Add `source_hatch_tab_id` to `meeting_agenda_items`

**Components:**
- `HatchReviewRoute` (extraction results view)
- `HatchExtractedCard` (individual extracted item with routing)
- `HatchHistory` (full history view with sort/filter/search)
- `HatchHistoryItem` (individual history entry with destination links)
- Full-page mode (`/hatch` route, workspace + history toggle)

**Edge Function:**
- `hatch-extract` (AI extraction for Review & Route)

**Integration:**
- "Edit in Hatch" button on Helm message actions
- "Review & Route" button on Helm conversations
- Helm context loading for active Hatch tabs (`shouldLoadHatch`, `formatHatchContext`)
- Track Progress smart matching via extraction
- History page at `/hatch` route
- Sidebar navigation link for The Hatch

---

<a id="acceptance-criteria"></a>
## 27. Acceptance Criteria

### Phase A

**Drawer:**
- [ ] Right drawer opens/closes with animation on desktop
- [ ] Drawer state persists across sessions
- [ ] Drawer collapses on narrow viewports
- [ ] Mobile: slides in from right on button tap
- [ ] Drawer does not interfere with Helm bottom drawer

**Tabs:**
- [ ] Create new tabs via `+` button
- [ ] Switch between tabs
- [ ] Close tabs (moves to archived status)
- [ ] Rename tabs by clicking/tapping title
- [ ] Content autosaves with 500ms debounce
- [ ] Content persists across browser sessions and device switches
- [ ] Soft limit warning at 10 concurrent tabs

**Voice:**
- [ ] VoiceRecordButton appears in Hatch toolbar
- [ ] Voice input creates text in current tab
- [ ] Whisper API used online, Web Speech API offline fallback

**Routing:**
- [ ] "Send to..." button opens grid
- [ ] All 10 destinations appear in grid
- [ ] Favorites section shows top 3-4 by usage
- [ ] Routing to The Log creates `journal_entries` record with `source = 'hatch'`
- [ ] Routing to Compass (individual) triggers AI task parsing
- [ ] Routing to Compass (single) creates one task
- [ ] Routing to Lists creates list with checkboxes
- [ ] Routing to Victory creates accomplishment record
- [ ] Routing to Keel saves to user profile
- [ ] Routing to Mast updates declarations
- [ ] Routing to Note saves general note
- [ ] Routing to Agenda shows inline meeting picker, creates agenda item
- [ ] Routing to Charts + Goals shows inline tracker picker, logs data point
- [ ] Undo toast appears for 5 seconds after routing
- [ ] Undo reverses the routing action
- [ ] Routed tab moves to history with destination tag
- [ ] Routing stats increment on each route

**Settings:**
- [ ] Hatch section appears in Settings
- [ ] Default drawer state toggle works
- [ ] Auto-title toggle works

**TypeScript:**
- [ ] All types compile without errors
- [ ] No `any` types

### Phase B

**Review & Route:**
- [ ] "Review & Route" button triggers `hatch-extract` Edge Function
- [ ] Extracted items appear as cards with routing buttons
- [ ] Each card shows suggested destination(s) with primary highlighted
- [ ] User can edit extracted text before routing
- [ ] "Skip" removes item from routing queue
- [ ] Routed items create records in destination tables
- [ ] Skipped items remain in original content

**Full-Page Mode:**
- [ ] Expand button transitions Hatch to full main content area
- [ ] Collapse button returns to drawer
- [ ] All functionality works identically in full-page mode
- [ ] `/hatch` route loads full-page mode

**History:**
- [ ] History shows all tabs (active, routed, archived)
- [ ] Sort by date, name, status
- [ ] Filter by status, destination, date range
- [ ] Search across content
- [ ] Click routed entry → navigates to destination
- [ ] Reopen archived entry → creates new active tab
- [ ] Delete history entry permanently

**Edit in Hatch:**
- [ ] "Edit in Hatch" button appears on Helm messages
- [ ] Clicking creates new Hatch tab with conversation content
- [ ] Source tracking links back to Helm conversation
- [ ] Tab can be edited and routed normally

**AI Context:**
- [ ] `shouldLoadHatch` detects relevant keywords
- [ ] `formatHatchContext` provides active tab summaries to Helm
- [ ] Context respects user's context budget setting

---

## Document History

- **February 27, 2026:** Initial PRD created from Smart Notepad Complete Specification, adapted for StewardShip with nautical naming ("The Hatch"), 10 routing destinations, hybrid approach for existing writing surfaces, and 2-phase build plan.

---

**END OF PRD-21**
