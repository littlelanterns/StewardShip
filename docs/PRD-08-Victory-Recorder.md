# PRD-08: Victory Recorder

## Overview

The Victory Recorder captures and celebrates the user's accomplishments. It answers the question: "What have I done right?" In a world that constantly moves the goalposts, the Victory Recorder is a deliberate practice of noticing, recording, and honoring growth.

Victories are not just big milestones. Catching yourself before you raise your voice, having a difficult conversation you've been avoiding, remembering to pray when you'd rather scroll — those are victories. The Victory Recorder trains the user to see them.

Victories flow in from across the app — completed tasks, Log entries, Helm conversations, Chart milestones — and each one is connected to the user's identity through AI-generated celebration text that links the action to who the user is becoming.

---

## User Stories

### Recording
- As a user, I want to record a victory manually when I notice I've done something worth celebrating.
- As a user, I want the app to prompt me when something might be a victory (task completion, milestone, etc.) so I don't miss it.
- As a user, I want victories from different sources to land in one place.

### Celebration
- As a user, I want the AI to celebrate my victories in a way that connects to my identity and values, not generic praise.
- As a user, I want to edit the AI's celebration text because it might not capture what the moment meant to me.

### Reviewing
- As a user, I want to browse my victories over time so I can see how far I've come.
- As a user, I want to filter victories by life area so I can see where I'm growing most.
- As a user, I want my victories surfaced during hard times as evidence that I am capable of growth.

### Sharing
- As a user, I want a monthly victory summary so I can see the month's highlights.
- As a user, I want to export or share a victory when I want to tell someone about it.

---

## Screens

### Screen 1: Victory Recorder Main Page

**What the user sees:**
- Page title: "Victory Recorder"
- Brief contextual line: "Evidence of the man you're becoming."
- Victory count summary at top: "[X] victories recorded" with breakdown by life area as small category chips
- Time filter: All Time | This Month | This Week | Today
- Life area filter: All | individual area chips (tappable to toggle)
- Victories displayed in reverse chronological order as cards:
  - Victory description text
  - AI celebration text (in italics or slightly different styling — warm, personal)
  - Life area tag
  - Source indicator (task, journal, conversation, milestone, manual)
  - Date
  - Mast connection if applicable (small text: "Connected to: [principle]")
  - Wheel connection if applicable (small text: "Part of your [hub description] Wheel")
  - Gold accent on the card (subtle — thin gold left border or faint gold background tint)
- "Record a Victory" floating action button
- Helm drawer accessible

**Interactions:**
- Tap a victory card → expands to show full detail plus edit/archive options
- Tap "Record a Victory" → opens Screen 2
- Tap a Mast connection → navigates to Mast
- Tap a Wheel connection → navigates to Wheel detail
- Filter by time or life area → list updates immediately

---

### Screen 2: Record a Victory

**What the user sees:**
- Text area: "What did you accomplish?" (large, inviting)
- After entering text, AI immediately generates:
  - Suggested life area tag (displayed as removable chip)
  - Suggested celebration text (displayed below in italic, editable)
  - Suggested Mast connection if detected (displayed as a linkable chip, removable)
  - Suggested Wheel connection if an active Wheel relates (displayed as a linkable chip, removable)
- All AI suggestions are editable or removable before saving
- "Save" button

**After saving:**
- Gold shimmer/sparkle animation plays briefly (the ONLY place in the app with gold effects)
- Victory card appears at the top of the list

**When arriving from another feature (task completion, Log routing, etc.):**
- Description field is pre-filled with the source content
- AI suggestions are already generated
- User reviews, edits if needed, saves

---

### Screen 3: Victory Detail (Expanded Card)

**What the user sees:**
- Full victory description
- AI celebration text (editable — "Edit" button next to it)
- Life area tag (editable)
- Mast connection (editable — can add, change, or remove)
- Wheel connection (editable — can add, change, or remove)
- Source info: where this victory came from (task title, Log entry excerpt, Helm conversation excerpt, Chart milestone)
- Source link (tappable to navigate to the source)
- Date and time
- "Archive" button
- "Share" button (copies victory text + celebration to clipboard, or generates a shareable text block)

---

### Screen 4: Victory Review (Conversational)

**What the user sees:**
- Accessible from: Reckoning (evening review), Victory Recorder main page ("Victory Review" button), or via the Helm
- Time period selector at top: Today | This Week | This Month | Custom
- AI-generated conversational narrative reflecting on the victories from the selected period
- Not a list — a warm, personal paragraph (or two) that:
  - Names the specific victories from the period
  - Connects them to each other when patterns exist
  - Connects them to Mast principles and active Wheels when applicable
  - Observes what the victories say about who the user is becoming
  - Notes any themes, growth areas, or firsts
- Below the narrative: the individual victory cards from the period (scrollable, for reference)
- "Edit" button on the narrative (fully editable, like all AI content)
- "Save to Log" button (saves the narrative as a Log entry of type 'reflection')
- "Share" button (copies narrative text)

**Example — Today:**
"You knocked out that call with the contractor you'd been avoiding — that's the same pattern you broke last week with the email to your boss. You're getting faster at eating the frog. You also had a real conversation with your son during his mentor meeting tonight. He opened up about school, and you listened instead of jumping to solutions. That's your declaration about presence in action. Two victories, two different life areas, both pointing the same direction."

**Example — This Month:**
"Seventeen victories this month. Your strongest growth was in marriage — five of those were moments where you chose your wife's love language over your default. That's not accidental anymore, that's becoming instinct. Spiritually, the prayer streak hit 30 days, and three journal entries this month connected back to your faith foundations. The career area is quieter this month, which makes sense given everything happening at home. Not every season needs growth everywhere."

**When accessed from Reckoning:**
- The Victory Review for "Today" is embedded as a section within the Reckoning evening flow
- If there are no victories today, this section is skipped (not shown as empty)
- If there's only one victory, the narrative is brief but still personal

**When no victories exist for the period:**
- Don't show an empty state or "no victories" message
- Skip the section entirely (in Reckoning) or show: "Nothing recorded for this period. That doesn't mean nothing happened — sometimes we're too busy growing to notice it."

---

### Screen 5: Monthly Victory Summary

**What the user sees:**
- Accessible from a "Monthly Summary" button on the Victory Recorder main page
- Month selector (defaults to current month)
- Summary card:
  - Total victories for the month
  - Breakdown by life area (horizontal bar chart or category list with counts)
  - Top 3 victories (AI-selected based on Mast alignment and significance)
  - AI-generated month narrative: a brief paragraph connecting the month's victories to the user's growth trajectory
- "Export" button (generates a formatted text or PDF of the month's victories)
- All AI-generated content on this page is editable

---

## Data Schema

### Table: `victories`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| description | TEXT | | NOT NULL | What was accomplished |
| celebration_text | TEXT | null | NULL | AI-generated identity-reinforcing text. User-editable. |
| life_area_tag | TEXT | null | NULL | AI auto-assigned |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'compass_task', 'log_entry', 'helm_conversation', 'chart_milestone' |
| source_reference_id | UUID | null | NULL | FK → source record |
| related_mast_entry_id | UUID | null | NULL | FK → mast_entries |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own victories only.

**Indexes:**
- `user_id, created_at DESC` (chronological browsing)
- `user_id, life_area_tag` (filter by area)
- `user_id, source` (filter by source type)

---

## Incoming Flows (How Victories Get Recorded)

| Source | Trigger | What Happens |
|--------|---------|-------------|
| Manual entry | User taps "Record a Victory" | Opens Screen 2, user writes description |
| Compass task | Task checked off → victory prompt | Description pre-filled with task title. source = 'compass_task' |
| The Log | User routes entry as victory | Description pre-filled with Log text. source = 'log_entry' |
| The Helm | AI identifies accomplishment in conversation | AI suggests: "That sounds like a victory. Want to record it?" Description pre-filled from conversation. source = 'helm_conversation' |
| Charts milestone | Streak or goal milestone reached | Description pre-filled with milestone details (e.g., "30-day prayer streak"). source = 'chart_milestone' |

All incoming victories go through the same creation flow: pre-filled → AI generates suggestions → user reviews and edits → save.

---

## AI Behavior

### Celebration Text Generation

When a victory is recorded, the AI generates celebration text that connects the action to the user's identity and values. Rules:

**Connect to Mast when possible:**
- If the victory relates to a Mast principle, the celebration explicitly connects them
- "Your declaration says you choose patience with your children. Tonight you chose it. That's your declaration in action."

**Connect to Wheel when possible:**
- If the victory relates to an active Wheel, reference the growth journey
- "Three weeks ago you started a Wheel about being more present at home. Putting your phone down during dinner — that's Spoke 6 in action."

**Identity-based, not performance-based:**
- NOT: "Great job!" / "Well done!" / "You should be proud!" (generic)
- NOT: "I'm so proud of you!" (AI is not a parent or friend)
- YES: "That's the kind of man you described in your vision."
- YES: "That conversation took courage. The fact that you initiated it tells you something about who you're becoming."
- YES: "Small moment. Big shift. You chose presence over distraction."

**Brief and warm:**
- Celebration text should be 1-3 sentences, not a paragraph
- Warm but not gushing
- Specific to this victory, not generic

### Victory Identification in Conversations

During Helm conversations, the AI listens for accomplishments the user might not recognize as victories:
- User mentions they had a hard conversation → "That took courage. Want to record that as a victory?"
- User mentions they resisted a bad habit → "That's a win worth noting. Should we capture it?"
- User mentions progress on a goal → "You're moving the needle. Want to add this to your Victory Recorder?"

The AI does NOT:
- Suggest victories for trivial things (completing a routine task that has no growth significance)
- Suggest victories more than once per conversation unless genuine separate accomplishments occur
- Force the victory prompt — if the user says no or ignores it, move on

### Victories as Encouragement During Hard Times

When the AI detects discouragement, frustration, or self-doubt in Helm conversations, it can draw from recent victories as evidence of capability:
- "I hear you saying you can't do this. But two weeks ago you recorded a victory about [X]. You've done hard things before."
- "Your Victory Recorder shows 14 entries this month. That's 14 times you noticed growth in yourself. The struggle you're in right now doesn't erase those."

This is done gently, never dismissively. The AI acknowledges the difficulty FIRST, then offers the evidence.

### Monthly Narrative Generation

At the end of each month (or when the user views the Monthly Summary), the AI generates a brief narrative:
- Identifies themes across the month's victories
- Connects to Mast principles and active Wheels
- Notes any trends (increasing victories in a specific area, first victory in a new area)
- Written in warm, personal tone

Example: "This month you recorded 11 victories, with the strongest growth in marriage and spiritual life. Three of those connected directly to your declaration about presence — you're not just saying it, you're living it. The conversation with your wife on the 14th and the prayer streak you started on the 8th stand out. You're building something real."

The user can edit this narrative before saving or exporting.

---

## Gold Visual Effects

The Victory Recorder is the ONLY place in the app that uses gold visual effects. This is deliberate — gold is reserved exclusively for celebration.

**Where gold appears:**
- Victory cards: thin gold left border or faint gold background tint
- Save animation: brief gold shimmer/sparkle when a victory is saved
- Streak milestones on Charts: gold accent on the milestone marker
- Monthly summary header: gold accent

**Where gold does NOT appear:**
- Navigation
- Buttons (except save on Victory creation)
- Any other feature
- General theming

---

## Edge Cases

### No Victories Yet
- Empty state: "No victories recorded yet. You've already taken the first step by being here — that counts. When you notice something you've done right, no matter how small, come back and record it."
- The empty state itself is warm and encouraging, not guilt-inducing

### Victory from Deleted Source
- If a task, Log entry, or other source is deleted/archived after a victory was recorded from it, the victory remains intact
- The source link becomes inactive: "Original source no longer available"
- The victory description stands on its own

### Very Frequent Victory Recording
- No limit on how many victories can be recorded
- If the user records many per day, the AI does not throttle suggestions — but it also doesn't inflate significance
- The AI keeps celebration text proportionate to the accomplishment

### Editing Celebration Text
- User can fully rewrite the AI celebration text
- User can clear it entirely (empty celebration text is allowed — the description stands alone)
- Edited text is saved as-is, AI does not regenerate unless user explicitly requests it

---

## What "Done" Looks Like

### MVP
- Victory Recorder main page with chronological list
- Record a victory manually with AI-generated celebration text, life area tag, and Mast/Wheel connections
- Edit all AI-generated content on victories
- Gold visual effects on victory cards and save animation
- Receive victories from Compass task completion prompt
- Receive victories from Log routing
- Filter by time period and life area
- Victory detail view with source links
- Victory Review: conversational AI narrative for today/this week/this month
- Victory Review embedded in Reckoning evening flow
- Archive victories
- Helm drawer from Victory Recorder loads recent victories as context
- RLS on all data

### MVP When Dependency Is Ready
- Receive victories from Helm conversation suggestions (requires Helm AI identification logic)
- Receive victories from Chart milestones (requires PRD-07 milestone detection)
- Monthly Victory Summary with AI narrative (requires sufficient data)
- Victories as encouragement during hard times (requires AI context loading of victories)

### Post-MVP
- Monthly summary export as PDF
- Share individual victories (formatted text block)
- Yearly victory review
- Victory categories visualization on Charts
- AI learning what the user considers victory-worthy based on past confirmations/rejections

---

## CLAUDE.md Additions from This PRD

- [ ] Gold visual effects: ONLY on Victory Recorder and streak milestones. Nowhere else in the app.
- [ ] Victory celebration text rules: identity-based, not performance-based. 1-3 sentences. Connected to Mast/Wheel when possible.
- [ ] Victory identification in conversations: suggest when genuine, not for trivial things, max once per accomplishment, accept "no" gracefully.
- [ ] Victories as encouragement: acknowledge difficulty FIRST, then offer evidence. Never dismissive.
- [ ] Victory from deleted source: victory persists, source link becomes inactive.
- [ ] `victories` table schema

---

*End of PRD-08*
