# PRD-05: The Log — Journal / Commonplace Book / Universal Inbox

## Overview

The Log is both a journal and a universal capture point. It serves the traditional function of a daily journal (reflections, gratitude, processing) while also acting as a "commonplace book" — a place where any thought, observation, quote, idea, or note can land. From The Log, entries can be routed to other features in the app.

On a ship, the log records the daily voyage — where you went, what happened, what you observed. StewardShip's Log does the same for life.

The Log is one of the most heavily connected features in the app. It receives input from The Helm, Meeting Frameworks, and voice transcription. It is read by Charts, Victory Recorder, Reckoning, and periodic reviews. Its entries can be routed to The Compass, Lists, Reminders, The Mast, The Keel, and Victory Recorder.

---

## User Stories

### Capturing
- As a user, I want to write a journal entry about my day so I can process my thoughts.
- As a user, I want to jot down a quick note or observation without deciding what to do with it yet.
- As a user, I want to record a gratitude entry so I can build a practice of thankfulness.
- As a user, I want to capture a quote, scripture, or idea I encountered so I don't lose it.
- As a user, I want to record a voice entry when typing isn't convenient.
- As a user, I want to save a Helm conversation to my Log so I can reference the discussion later.

### Organizing
- As a user, I want to tag entries by life area so I can find related entries later.
- As a user, I want to mark what type of entry it is (journal, gratitude, reflection, quick note, etc.) so I can filter by type.
- As a user, I want to search my Log by keyword so I can find past entries.
- As a user, I want to filter my Log by date range, type, and life area tag.

### Routing
- As a user, I want to turn a note into a task so I don't forget to act on it.
- As a user, I want to route a thought to my Mast because it crystallized a value I want to live by.
- As a user, I want to route a self-observation to my Keel because I learned something about myself.
- As a user, I want to flag an entry as a victory so it shows up in my Victory Recorder.
- As a user, I want to set a reminder about something I captured so I'm prompted to follow up.
- As a user, I want to add an item to a list from a note I jotted down.

### Reviewing
- As a user, I want to browse my journal chronologically to see my journey over time.
- As a user, I want to see my gratitude entries gathered together.
- As a user, I want to export selected entries as a printable document.

---

## Screens

### Screen 1: Log Main Page

**What the user sees:**
- Page title: "The Log"
- Brief contextual line: "A record of the voyage."
- "New Entry" floating action button (prominent, always visible)
- Filter bar at top:
  - Entry type filter: All, Journal, Gratitude, Reflection, Quick Note, Meeting Notes, Transcript, Helm Conversation
  - Life area filter: All, Spiritual, Marriage, Family, Physical, Emotional, Social, Professional, Financial, Personal, Service, Custom
  - Date range: Today, This Week, This Month, Custom Range
  - Search icon (tap to reveal search field)
- Entries displayed in reverse chronological order (newest first)
- Each entry card shows:
  - First ~2-3 lines of text (truncated)
  - Entry type badge (small colored tag)
  - Life area tag(s) (AI-applied)
  - Date and time
  - Source indicator if not manual (voice icon for transcription, chat icon for Helm, people icon for meeting)
  - Routing indicator if the entry was routed somewhere (small icon: compass for task, flag for victory, etc.)

**Interactions:**
- Tap an entry card → opens Screen 3 (entry detail view)
- Tap "New Entry" → opens Screen 2 (create entry)
- Tap search icon → reveals search field, search filters entries in real-time
- Adjust filters → entries list updates immediately
- Pull up Helm drawer → AI has recent Log context loaded

---

### Screen 2: Create New Entry

**What the user sees:**
- Large text area (most of the screen, inviting to write)
- Entry type selector at top: Journal, Gratitude, Reflection, Quick Note, Custom
  - Default: Journal (but remembers last used type in the session)
  - Gratitude type pre-fills a subtle prompt above the text area: "What are you feeling grateful for?"
  - Reflection type pre-fills: "What's on your mind?"
  - Quick Note has no prompt — just the blank text area
- Voice recording button in the input area (microphone icon with "Record" label on first use)
- "Save" button

**Voice entry flow:**
- Tap voice record → recording starts, visual pulsing indicator
- Tap again to stop → audio sent to Whisper for transcription
- Transcribed text appears in the text area — user can edit before saving
- Original audio file stored in Supabase Storage and linked to the entry

**After tapping "Save":**
- Entry is saved to database
- AI automatically suggests life area tags based on the content and applies them immediately
- Tags appear below the entry as removable chips — user can tap X on any tag to remove it, or tap "+ Add Tag" to add their own
- User does not need to make any tagging decisions — AI handles it, user just corrects if needed
- Routing prompt appears (see Screen 4: Routing Selector)

---

### Screen 3: Entry Detail View

**What the user sees:**
- Full text of the entry
- Entry type badge
- Life area tags (AI-applied, user-editable — removable chips with + Add Tag option)
- Date, time
- Source info (manual, voice, Helm conversation, meeting)
- If voice entry: "Play original audio" button
- Action buttons at bottom:
  - "Edit" → opens edit mode (text area becomes editable, type/tags changeable)
  - "Route" → opens Screen 4 (Routing Selector) to route this entry somewhere
  - "Archive" → soft delete with confirmation
- If the entry has already been routed: shows where it was routed with a link (e.g., "Routed to: Compass task" — tappable to go to that task)

**Interactions:**
- Tap "Edit" → inline edit mode, save/cancel buttons appear
- Tap "Route" → routing selector
- Tap "Archive" → "Archive this entry? You can restore it later." → archives
- Tap routing link → navigates to the routed item
- Long-press text → standard copy behavior

---

### Screen 4: Routing Selector

**This appears after saving a new entry, or when tapping "Route" on an existing entry.**

**What the user sees:**
A clean list of routing options:
- "Just save it" (default — entry stays in Log, no routing)
- "Create a task" → entry text becomes task title/description in Compass. User can edit before creating.
- "Add to a list" → shows list picker, entry text becomes list item. User can select which list or create new.
- "Set a reminder" → opens date/time picker. Creates a reminder linked to this entry.
- "Save to Mast" → asks for Mast type (value, declaration, faith foundation, scripture/quote, vision) and optional category. Creates a Mast entry linked to this Log entry.
- "Save to Keel" → asks for Keel category. Creates a Keel entry linked to this Log entry.
- "This is a victory" → opens victory creation: pre-filled with entry text, asks for life area category and optional Mast/Wheel connection. Creates a Victory linked to this Log entry.
- "Do something else with it" → opens the Helm drawer with this entry's text as context: "I just captured this in my Log: [text]. What would you like to do with it?"

**After routing:**
- The Log entry gets a `routed_to` field set (for display purposes)
- The original entry REMAINS in the Log — routing copies/links, never moves
- Multiple routings from the same entry are allowed (route to Mast AND create a task)

**AI-Suggested Routing:**
- After the user saves an entry, the AI can suggest a route based on content:
  - If the entry sounds like a to-do: "This sounds like something you need to do. Want to add it to your Compass?"
  - If the entry sounds like a victory: "That sounds like a real accomplishment. Want to record it as a victory?"
  - If the entry contains a principle or value: "That reads like a core principle. Would it belong on your Mast?"
- Suggestion appears as a subtle prompt above the routing options, not a popup
- User can ignore the suggestion and choose any option

---

### Screen 5: Archived Entries

- Same pattern as Mast/Keel: list of archived entries with restore option
- Accessible from a "View Archived" link at bottom of Log main page

---

### Screen 6: Printable Journal Export

**What the user sees:**
- "Export Journal" button accessible from Log main page (in a menu or settings area)
- Export configuration screen:
  - Date range selector (start date, end date)
  - Quick presets: "Last Month", "Last 3 Months", "This Year", "Custom Range"
  - Entry type filter (include/exclude: journal, gratitude, reflection, etc.)
  - Life area filter (include/exclude specific areas)
  - Include routing information? (toggle)
  - Format: PDF or DOCX
- "Generate Export" button
- After generation: download link and preview

**Monthly Export Reminder:**
- Configurable in Settings: "Remind me to export my journal monthly" (toggle, default off)
- When enabled, a reminder fires on the 1st of each month: "It's a new month. Would you like to export last month's journal entries?"
- Tapping the reminder opens the export screen with "Last Month" pre-selected

**Technical notes:**
- Export generated server-side via Supabase Edge Function or client-side with a library
- Formatted with StewardShip branding: title page, date headers, clean typography
- Entries organized chronologically within the selected range

---

## Data Schema

### Table: `log_entries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| text | TEXT | | NOT NULL | Entry content (can be long-form) |
| entry_type | TEXT | 'journal' | NOT NULL | Enum: 'journal', 'gratitude', 'reflection', 'quick_note', 'meeting_notes', 'transcript', 'helm_conversation', 'custom' |
| life_area_tags | TEXT[] | '{}' | NOT NULL | Array of life area tags. AI auto-applied on save. GIN indexed. |
| source | TEXT | 'manual_text' | NOT NULL | Enum: 'manual_text', 'voice_transcription', 'helm_conversation', 'meeting_framework' |
| source_reference_id | UUID | null | NULL | FK → helm_conversations.id or meetings.id if applicable |
| audio_file_path | TEXT | null | NULL | Supabase Storage path for voice entries |
| routed_to | TEXT[] | '{}' | NOT NULL | Array tracking where this entry was routed: 'compass_task', 'list_item', 'reminder', 'mast_entry', 'keel_entry', 'victory'. For display only. |
| routed_reference_ids | JSONB | '{}' | NOT NULL | Map of route type to created record ID: {"compass_task": "uuid", "victory": "uuid"} |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances if entry relates to a Wheel |
| related_meeting_id | UUID | null | NULL | FK → meetings if from a meeting |
| archived_at | TIMESTAMPTZ | null | NULL | Null = active |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entries only.

**Indexes:**
- `user_id, created_at DESC` (chronological browsing — primary query)
- `user_id, entry_type, archived_at` (type filtering)
- `user_id, archived_at` (active entries only)
- `user_id, life_area_tags` (GIN index for array containment queries)
- Full-text search index on `text` column (for keyword search)

---

## AI Behavior

### How the AI Uses Log Data

**Loaded when relevant:** Recent Log entries are loaded into the AI context when:
- The user references recent events ("I mentioned yesterday..." or "earlier this week...")
- The Helm drawer is opened from the Log page
- During Reckoning (today's entries summarized)
- During weekly/monthly/quarterly reviews (patterns analyzed)
- When the AI detects the user might benefit from Log context (mentions feelings, events, or situations that match recent entries)

**Format in system prompt:**

```
Recent journal entries (The Log):

[date] [type]: [first ~200 chars of text]
[date] [type]: [first ~200 chars of text]
...
```

Limited to last 7 days by default, top 10 entries. Expanded for review sessions.

### Pattern Recognition
Over time, the AI can identify patterns in Log entries:
- Recurring themes (mentions of stress at work every Monday, gratitude for wife consistently)
- Mood trends (several "hard" or "rough" entries in a row)
- Alignment or misalignment with Mast principles
- Progress on Wheel commitments visible in daily reflections

Pattern recognition is used in:
- Weekly reviews: "Looking at your Log this week, I notice three entries about feeling disconnected from your kids. Want to explore what's happening there?"
- Reckoning: "Today's entry about the conversation with your boss echoes something you wrote last Tuesday. There might be a pattern worth examining."
- Charts: mood trends visualized over time

### Gratitude, Joy, and Anticipation Prompts
The Log is the natural home for prompted entries. When a gratitude/joy/anticipation prompt fires (based on user's frequency settings):
- The prompt appears as a notification or in Reveille/Reckoning
- Tapping opens Screen 2 (Create New Entry) with the appropriate type pre-selected and the prompt text as a subtle header
- Gratitude: "What are you feeling grateful for?"
- Joy/Wonder: "Describe a moment of joy or wonder recently."
- Anticipation: "What are you looking forward to or excited about?"

---

## Incoming Flows (How Entries Get INTO The Log)

### From Direct Entry
- User taps "New Entry" on Log page → writes/records → saves

### From The Helm
- User taps "Save to Log" on a conversation or specific message
- Creates a log_entry with source = 'helm_conversation' and source_reference_id = conversation ID
- Entry type set to 'helm_conversation'
- User can edit text, add tags, set type before saving

### From Meeting Frameworks
- At the "Record Impressions" step of any meeting, notes are saved as a Log entry
- source = 'meeting_framework', source_reference_id = meeting ID
- Entry type set to 'meeting_notes'
- Related person(s) from the meeting linked via related_meeting_id

### From Voice Recording
- User records a voice entry → Whisper transcribes → text appears in entry
- source = 'voice_transcription'
- Original audio stored at audio_file_path

### From Prompted Rhythms
- Gratitude, joy, and anticipation prompts open the Log with the appropriate type pre-selected

---

## Outgoing Flows (How Entries Route OUT of The Log)

All routing is done through the Routing Selector (Screen 4). The original entry always stays in The Log.

### To The Compass (Create Task)
- Entry text becomes task title (truncated if long) and description
- User can edit before creating
- Task created in `compass_tasks` with source tracking back to log entry
- Log entry gets `routed_to` updated with 'compass_task' and the task ID

### To Lists (Add to List)
- User picks which list (or creates new)
- Entry text becomes list item
- Log entry gets `routed_to` updated

### To Reminders
- User picks date/time for reminder
- Reminder created with content from entry text and reference to log entry ID
- Log entry gets `routed_to` updated

### To The Mast
- User selects Mast type and optional category
- Mast entry created with source = 'log_routed' and source_reference_id = log entry ID
- Log entry gets `routed_to` updated
- See PRD-02 for Mast entry details

### To The Keel
- User selects Keel category
- Keel entry created with source_type = 'log_routed' and source_reference_id = log entry ID
- Log entry gets `routed_to` updated
- See PRD-03 for Keel entry details

### To Victory Recorder
- Entry text pre-fills victory description
- User selects life area category and optional Mast/Wheel connection
- Victory created with source = 'log_entry' and source_reference_id = log entry ID
- Log entry gets `routed_to` updated

### To The Helm (For Further Processing)
- "Do something else with it" opens Helm drawer with entry text as context
- AI can then help decide what to do with the entry

---

## Edge Cases

### Very Long Entries
- No character limit on text field
- Display truncates on the main list view with "Read more" expansion
- Full text always visible in detail view
- For AI context loading, long entries may be truncated to ~200 characters with "[full entry available]"

### Empty Entries
- Text field cannot be empty — "Save" button is disabled until text is entered
- Voice entries that transcribe to empty string: show error "Transcription was empty. Try recording again?"

### Multiple Routings
- A single entry can be routed to multiple destinations
- Example: a note that becomes both a task AND a Mast principle
- Each routing is independent — editing the Log entry does not update the routed copies
- The `routed_to` array and `routed_reference_ids` JSONB track all routings

### Editing After Routing
- If the user edits a Log entry that has already been routed, the routed copies are NOT automatically updated
- The routed items are independent copies from the moment of routing
- This avoids unexpected side effects

### Search Performance
- Full-text search uses PostgreSQL's built-in full-text search capabilities
- For large journals (1000+ entries), search results may need pagination
- Search covers text content only, not tags or metadata (those are filtered separately)

### Offline Entry
- If the user is offline, entries can be written and saved to local storage
- On reconnect, local entries are synced to Supabase
- Conflict resolution: local entries are always created as new records (no merge conflicts possible since entries are append-only)

---

## What "Done" Looks Like

### MVP
- Log main page with chronological entry list
- Create new entry (text input with type, life area tags, mood)
- Voice recording with Whisper transcription
- Entry detail view with full text and metadata
- Edit entries inline
- Archive and restore entries
- Filter by entry type, life area, and date range
- Keyword search
- Routing selector with all routing options (Compass, Lists, Reminders, Mast, Keel, Victory, Helm)
- AI-suggested routing after save
- Receive entries from Helm (Save to Log)
- Entries display in Reckoning (today's entries summary)
- Helm drawer from Log page loads recent entries as context
- RLS on all data

### MVP When Dependency Is Ready
- Receive entries from Meeting Frameworks (requires PRD-17)
- Prompted entries from Reveille/Reckoning rhythms (requires PRD-10, PRD-18)
- Pattern recognition in AI (requires accumulated data)
- Route to Lists (requires PRD-06: Lists)
- Route to Victory Recorder (requires PRD-08)

### Post-MVP
- Printable journal export (PDF/DOCX)
- Mood trend visualization (integration with Charts)
- AI pattern recognition in weekly/monthly reviews
- Offline entry with sync
- Rich text formatting in entries (bold, italic, bullet lists)
- Image attachment on entries

---

## CLAUDE.md Additions from This PRD

- [ ] Log entry routing pattern: original stays in Log, copies/links are created, multiple routings allowed
- [ ] `routed_to` array + `routed_reference_ids` JSONB pattern for tracking where entries were sent
- [ ] Editing routed entries does NOT update the routed copies (independence after routing)
- [ ] Full-text search: use PostgreSQL built-in, not external service
- [ ] Life area tags as TEXT[] array with GIN index
- [ ] Mood as optional simple enum, not a scale
- [ ] Prompted entries (gratitude/joy/anticipation) open Log with pre-selected type
- [ ] AI context from Log: last 7 days, top 10 entries, ~200 char truncation per entry

---

*End of PRD-05*
