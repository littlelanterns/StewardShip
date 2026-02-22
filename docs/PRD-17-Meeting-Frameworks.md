# PRD-17: Meeting Frameworks — Structured Reflective Meetings

## Overview

Meeting Frameworks is the cadence engine of StewardShip. On a ship, the crew gathers at regular intervals — the captain's muster, the watch change, the navigation check — to align, assess, and adjust course. Without these rhythms, even a well-equipped vessel drifts.

In StewardShip, Meeting Frameworks provides structured, recurring meeting templates for the user's most important relationships and responsibilities: marriage, children, personal growth, and business. These are not calendar events — they are AI-guided conversations at The Helm that follow a purposeful agenda, produce actionable outputs (tasks, goals, notes, insights), and build a growing record of growth over time.

Meeting Frameworks draws from three philosophical traditions that share a common foundation of principle-centered living:
- **Nicholeen Peck's Teaching Self-Government (TSG):** Family unity, clear expectations, mentor meetings
- **Oliver DeMille's Thomas Jefferson Education (TJEd):** Mentorship over instruction, phases of learning, mission-driven education
- **Stephen Covey's 7 Habits:** Quadrant II planning, roles-based goal setting, "Begin with the End in Mind," "Sharpen the Saw"

The AI applies these frameworks naturally — never naming authors or philosophies during the meeting (Rule 4: Teach Principles, Not Authors). The user experiences a warm, structured conversation. The frameworks operate beneath the surface.

All meetings share **eight core elements** that ensure consistency and depth:
1. Opening prayer or centering moment
2. Review of previous goals and commitments
3. Current state assessment
4. Vision alignment (connect to Mast principles)
5. Goal setting
6. Action planning
7. Recording impressions
8. Closing prayer or reflection

Faith elements (prayer, scripture connections) are applied based on the user's Mast context — present and natural for faith-oriented users, replaced with centering/reflection for secular future users.

---

## User Stories

### Starting Meetings
- As a user, I want to start a scheduled meeting with one tap so the AI walks me through the agenda.
- As a user, I want to record notes after a meeting that already happened so I don't lose what was discussed.
- As a user, I want the AI to know my spouse, children, and Mast context so the meeting conversation is personalized.

### During Meetings
- As a user, I want the AI to guide me through each agenda section without rushing me.
- As a user, I want to skip sections that don't apply this week without the AI making me feel guilty.
- As a user, I want the AI to connect what I'm discussing to my values and goals naturally.
- As a user, I want to capture action items during the meeting that become Compass tasks.

### After Meetings
- As a user, I want meeting notes saved to my Log so I can reference them later.
- As a user, I want to see my meeting history per relationship (spouse, each child, business).
- As a user, I want the AI to notice patterns across meetings over time (recurring themes, unresolved issues, growth trends).

### Scheduling
- As a user, I want to set up recurring meeting schedules so I'm reminded in Reveille when a meeting is due.
- As a user, I want to adjust meeting frequency without losing my history.
- As a user, I want to skip a week without the AI guilt-tripping me about it.

### Custom Meetings
- As a user, I want to create my own meeting templates for recurring conversations the built-in types don't cover.
- As a user, I want the AI to help me design a meeting agenda template through conversation.
- As a user, I want to upload an agenda document and have the AI turn it into a reusable template.

---

## Screens

### Screen 1: Meeting Frameworks Main Page

**What the user sees:**

**Page Header:**
- "Meeting Frameworks"
- "Structured conversations that build your most important relationships and keep your life on course."

**Upcoming / Due Meetings (Top Section):**
Cards for meetings that are due soon or overdue, based on schedule. Each card shows:
- Meeting type icon and name (e.g., "Couple Meeting," "Mentor Meeting: Jake")
- Last completed date
- Next due date
- "Start Meeting" button (opens Helm in live mode)
- "Record Notes" button (opens Helm in after-the-fact mode)
- Status indicator: on track, due today, overdue

Overdue meetings shown with gentle indicator — no red alerts, no guilt language. Just "Last met: 2 weeks ago."

**Meeting Types (Below Upcoming):**
Collapsible sections for each meeting category:

**Couple Meeting**
- Schedule info (e.g., "Weekly — Sundays")
- "Start Meeting" / "Record Notes" buttons
- "View History" — list of past meetings with dates
- "Edit Schedule" link

**Parent-Child Mentor Meetings**
- One subsection per child (pulled from `people` where `relationship_type = 'child'`)
- Each shows: child's name, schedule, last meeting date, "Start Meeting" / "Record Notes"
- "View History" per child

**Personal Review**
- Three cadences shown:
  - Weekly Review (schedule + last completed)
  - Monthly Review (schedule + last completed)
  - Quarterly Inventory (last completed, next suggested date — links to Life Inventory)
- "Start [type]" / "Record Notes" buttons

**Business Review**
- Schedule info
- "Start Meeting" / "Record Notes" buttons
- "View History"

**Custom Meetings**
- Any user-created meeting templates
- "Create Custom Meeting" button → Screen 5

**Settings Link:**
- "Meeting Schedules" link to Screen 4

---

### Screen 2: Meeting Session at The Helm

This is not a separate screen — it's the Helm in `guided_mode = 'meeting'` with `guided_subtype` indicating the meeting type and `guided_mode_reference_id` pointing to the `meetings` record being created.

**Two entry modes:**

**Live Mode ("Start Meeting"):**
AI walks through the meeting agenda section by section in real time. The user can be in the actual meeting (couple meeting with spouse, mentor meeting with child) and use the app as a guide, or can be alone using the AI as a structured reflection partner.

**Record After Mode ("Record Notes"):**
The meeting already happened. The AI asks targeted questions to capture what was discussed, what was decided, and what impressions were recorded. Lighter touch — doesn't walk through every agenda section, just captures the substance.

**AI Behavior During Live Mode:**

The AI presents each agenda section as a conversational prompt, not a rigid form. It moves through sections naturally, spending more time where the user engages deeply and moving quickly through sections the user wants to skip.

Section transitions feel like: "That's a great insight about your week. Let's shift gears — how are you and [wife's name] feeling about your shared goals right now?"

The AI can:
- Reference First Mate context during Couple Meetings (spouse insights, love language, recent prompts)
- Reference Crew context during Parent-Child Meetings (child's personality, interests, challenges, growth notes)
- Reference Mast principles during vision alignment sections
- Reference Charts and Compass during review sections
- Reference Life Inventory during Personal Review
- Reference Manifest wisdom (via RAG) during any meeting when relevant

At the end of each meeting, the AI:
1. Summarizes what was discussed and decided
2. Lists suggested action items → user confirms which become Compass tasks
3. Lists suggested insights to save → user confirms which go to Log, First Mate, Crew, Keel, etc.
4. Offers to save the full meeting summary to the Log
5. Marks the meeting as completed in the `meetings` table

---

### Screen 3: Meeting History (Per Type or Per Person)

**What the user sees:**
- Reverse chronological list of completed meetings
- Each shows: date, brief AI-generated summary (2-3 sentences), action items created, notes saved
- Tap to expand and see full meeting notes (links to Log entry)
- Filter by date range
- AI-generated "Pattern Note" at top if 5+ meetings exist: "Over the last month, communication has been a recurring theme in your Couple Meetings. You and [wife] have been working on being more present during conversations — and recent meetings suggest real progress."

---

### Screen 4: Meeting Schedules (Settings Subsection)

**What the user sees:**

One row per meeting type/instance:

| Meeting | Frequency | Day/Time | Notifications |
|---------|-----------|----------|---------------|
| Couple Meeting | Weekly | Sunday 8:00 PM | Reveille reminder |
| Mentor: Jake | Bi-weekly | Saturday 10:00 AM | Reveille reminder |
| Mentor: Emma | Weekly | Wednesday 7:00 PM | Reveille reminder |
| Weekly Review | Weekly | Sunday 6:00 PM | Reveille reminder |
| Monthly Review | Monthly | 1st Sunday | Reveille reminder |
| Quarterly Inventory | Quarterly | — | AI suggests |
| Business Review | Weekly | Monday 8:00 AM | Reveille reminder |

Each row has "Edit" to change frequency, day/time, and notification preference.

"Add Schedule" button for setting up new recurring meetings (including custom types).

**Frequency options:** Weekly, Bi-weekly, Monthly, Quarterly, Custom (every N days)

**Notification options:** Reveille reminder (day of), Day-before reminder, None

**Quarterly Inventory** does not have a hard schedule — the AI may suggest it in conversation if 3+ months have passed since the last Life Inventory refresh. The user can also start one manually from the Personal Review section.

---

### Screen 5: Create Custom Meeting Template

**What the user sees:**

**Two options:**

**Option A: Create with AI**
Opens the Helm in a template-creation mode. AI asks:
- "What kind of meeting is this? Who is it with?"
- "What's the purpose — what should this meeting accomplish?"
- "How often should it happen?"
- "What topics or sections should the agenda cover?"

AI generates a structured agenda template from the conversation. User reviews, edits, saves.

**Option B: Upload an Agenda**
- File picker (accepts PDF, TXT, MD, images)
- AI extracts the agenda structure and converts it into a meeting template
- User reviews, edits section names and prompts, saves

**Option C: Write It Myself**
- Template name field
- Frequency selector
- Related person selector (optional — from Crew/First Mate)
- Agenda sections: user adds sections with title and AI prompt text for each
- "Save Template" button

After saving, the custom meeting appears in the Meeting Frameworks page and can be scheduled.

**Custom Template Data:**
- Template name
- Meeting category: 'custom'
- Default frequency
- Related person_id (optional)
- Agenda sections: ordered array of {title, ai_prompt_text}
- Source: 'ai_generated', 'uploaded_file', 'manual'

---

## Data Schema

### Table: `meetings`

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
| helm_conversation_id | UUID | null | NULL | FK → helm_conversations (the meeting conversation) |
| log_entry_id | UUID | null | NULL | FK → log_entries (if notes saved to Log) |
| meeting_date | DATE | CURRENT_DATE | NOT NULL | The date of the meeting |
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

### Table: `meeting_schedules`

Recurring meeting schedule configuration — one row per scheduled meeting cadence.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| meeting_type | TEXT | | NOT NULL | Same enum as meetings table |
| template_id | UUID | null | NULL | FK → meeting_templates (for custom) |
| related_person_id | UUID | null | NULL | FK → people (spouse, child, etc.) |
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

### Table: `meeting_templates`

User-created custom meeting templates with agenda structure.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Template display name |
| description | TEXT | null | NULL | Optional description of the meeting's purpose |
| default_frequency | TEXT | 'weekly' | NOT NULL | Suggested frequency when scheduling |
| default_related_person_id | UUID | null | NULL | FK → people (if this meeting is always with a specific person) |
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

## AI Behavior

### Context Loading by Meeting Type

**Couple Meeting:**
- Always loaded: Mast, Keel, First Mate (full spouse_insights), recent Log entries
- Loaded when relevant: Life Inventory (Marriage/Partnership area), active Wheels, recent Helm conversations tagged with marriage, previous Couple Meeting notes (last 2-3)
- `guided_subtype = 'couple'`

**Parent-Child Mentor Meeting:**
- Always loaded: Mast, Keel, child's Crew profile (crew_notes, personality, interests, challenges, growth)
- Loaded when relevant: previous mentor meeting notes for this child (last 2-3), Life Inventory (Family/Parenting area)
- `guided_subtype = 'parent_child'`

**Personal Review (Weekly):**
- Always loaded: Mast, Keel, recent Log entries (past 7 days), Compass tasks (this week — completed, pending, carried), Charts (active streaks, goal progress), Victories (this week)
- Loaded when relevant: active Wheels, active Rigging plans, Life Inventory
- `guided_subtype = 'weekly_review'`

**Personal Review (Monthly):**
- Always loaded: Mast, Keel, Log entries (past 30 days — themes, not full text), Charts (monthly trends), Victories (this month), Life Inventory (all areas)
- Loaded when relevant: active Wheels, active Rigging plans, previous monthly reviews (last 2)
- `guided_subtype = 'monthly_review'`

**Quarterly Inventory:**
- This redirects to Life Inventory guided mode (`guided_mode = 'life_inventory'`) rather than meeting mode. The meeting record is still created in the `meetings` table for scheduling continuity, but the conversation uses the Life Inventory flow from PRD-11.
- `meeting_type = 'quarterly_inventory'` in the meetings table, but `guided_mode = 'life_inventory'` on the helm conversation

**Business Review:**
- Always loaded: Mast (especially work/stewardship principles), Keel (professional strengths/weaknesses), Compass tasks (business-tagged), Charts (business-related trackers), recent Log entries (business-tagged)
- Loaded when relevant: active Rigging plans (business-related), Manifest RAG (business frameworks, uploaded materials), Life Inventory (Professional/Career and Financial areas)
- `guided_subtype = 'business'`

**Custom Meeting:**
- Always loaded: Mast, Keel
- Loaded when relevant: related person's context (if person is linked), previous meetings of this custom type (last 2-3), custom template agenda sections
- `guided_subtype = 'custom'`

---

### Meeting Agendas by Type

#### Couple Meeting Agenda (Live Mode)

The AI walks through these sections conversationally, adapting timing to the user's engagement level. Total target: 30-60 minutes.

**1. Opening Prayer / Centering (2-5 min)**
AI: "Let's start by inviting the Lord into this conversation. Would you like to open with a prayer, or shall we take a quiet moment to center?"
- For faith users: prayer. For future secular users: centering/intention-setting moment.

**2. Appreciation and Connection (5-10 min)**
AI: "Before we get into the week — what's one thing you appreciated about [wife's name] this past week? And what's one moment where you felt connected to each other?"
- Responses optionally saved to spouse_insights (gratitude category) and/or Log
- Draws from First Mate context to prompt deeper if answers are surface-level

**3. Review Previous Commitments (5-10 min)**
AI references action items from the previous Couple Meeting (pulled from Compass tasks with `source = 'meeting_action'` and `related_meeting_id`):
"Last week you committed to [task]. How did that go?"
- Celebrate completions. Explore what blocked unfinished items without judgment.

**4. State of the Union (10-15 min)**
AI: "How are you doing — emotionally, mentally, spiritually? And how do you think [wife's name] is doing?"
- Empathetic listening mode (similar to Safe Harbor Phase 1 — validate first)
- AI uses First Mate communication insights to help frame discussion
- If conflicts surface, Tier 1 capacity building applies (communication tools, "I feel / I need" statements)
- AI encourages the user to also ask his wife these questions during the actual meeting

**5. Goals and Planning — Quadrant II Focus (10-15 min)**
AI: "Looking at your shared goals on the Mast — what's one thing you'd like to focus on together this week that's important but not urgent?"
- References Mast shared principles
- Suggests 1-3 goals across dimensions (spiritual, relational, practical)
- Goals become Compass tasks with `life_area_tag = 'spouse_marriage'`

**6. Calendar and Logistics (5 min)**
AI: "Any scheduling or logistics to coordinate for the week? Date night, childcare, travel, events?"
- Light section — AI doesn't overstructure this. Just captures what the user shares.

**7. Recording Impressions (5 min)**
AI: "Take a moment — were there any insights, promptings, or feelings during this conversation that you want to hold onto?"
- User's response saved to Log with `entry_type = 'meeting_notes'`
- If spouse-relevant insights emerge, AI offers to save to First Mate

**8. Closing Prayer / Reflection (2 min)**
AI: "Would you like to close with a prayer together, or shall I offer a closing thought?"

---

#### Parent-Child Mentor Meeting Agenda (Live Mode)

Age-adaptive based on child's age from Crew profile. Total target: 20-45 minutes.

**1. Opening Prayer (2 min)**
AI: "Would you or [child's name] like to open with a prayer?"

**2. Connection and Exciting News (5-10 min)**
AI: "Start by connecting. Ask [child's name] what their exciting news is from this week — what happened that was fun, interesting, or important to them?"
- AI encourages the parent to actively listen, show genuine interest
- This section builds trust and makes the meeting a positive, anticipated event

**3. Review Previous Goals (5-10 min)**
AI references previous meeting goals:
"Last time, [child's name] was working on [goal]. How did that go?"
- Celebrate effort and progress, not just completion
- If goals weren't met, AI coaches the parent to discuss without judgment and brainstorm solutions together

**4. Goal Setting — Phase-Adapted (5-15 min)**
AI adapts approach based on child's age:
- **Ages 0-8 (Core Phase):** Focus on simple habits and character development. One fun goal, one character goal. "What's something [child's name] could practice this week? And what's something fun you could do together?"
- **Ages 8-12 (Love of Learning):** Help the child identify interests and set exploration goals. "What's [child's name] excited about right now? How could they go deeper on that this week?"
- **Ages 12-16+ (Scholar Phase):** More structured goal setting across areas (spiritual, educational, personal, social). "What does [child's name] want to accomplish this week? Let's help them think about what matters most."
- Always includes a "fun goal" — something parent and child do together

**5. Skill Building Discussion (5-10 min)**
AI: "Is there a specific skill or character trait you're working on with [child's name] right now? How could you practice it together this week?"
- AI references child's crew_notes for context (challenges, growth areas)
- Connects to Mast: "What kind of father do you want to be in this moment?"

**6. Recording Impressions and Plan (2-5 min)**
AI: "What stood out to you from this conversation? Any impressions about [child's name] that you want to remember?"
- Notes saved to Log with `entry_type = 'meeting_notes'` and `related_meeting_id`
- Child-specific insights offered for save to `crew_notes` with `source_type = 'meeting_notes'`
- Goals become Compass tasks (life_area_tag = 'family')

**7. Closing Prayer (2 min)**

---

#### Personal Weekly Review Agenda (Live Mode)

The user meets with themselves. AI serves as structured reflection partner. Total target: 30-60 minutes.

**1. Opening Prayer / Centering (5 min)**
AI: "Let's begin your weekly review. Take a moment to clear your mind and focus. Would you like to open with a prayer?"

**2. Review the Past Week (10-15 min)**
AI pulls data automatically:
- "Here's what your week looked like: [X] tasks completed out of [Y]. [Z] carried forward. You logged [N] victories. Your active streaks: [list]."
- "Looking at your Log entries this week, here are the themes I noticed: [themes]."
- AI asks: "What went well? What was hard? Anything surprising?"
- Victories celebrated. Struggles acknowledged without judgment.

**3. Roles and Goals — Quadrant II Planning (10-20 min)**
AI walks through the user's life roles:
"Let's think about your key roles this week — as a husband, a father, a professional, an individual. For each role, what's one important-but-not-urgent thing you could focus on?"
- References Mast principles per role
- References Life Inventory vision for each area
- References active Wheels: "Your Wheel on [hub] — what's one action that moves that forward?"
- References active Rigging plans: "Your plan for [title] — the next milestone is [milestone]. Any tasks to schedule?"
- AI suggests 1-3 "Big Rock" goals for the week

**4. Organize the Week (5-10 min)**
AI: "Let's get these into your Compass. Which of these should I add as tasks for this week?"
- Goals and Big Rocks → Compass tasks with appropriate life_area_tags
- AI can also help the user review and triage carried-forward tasks

**5. Recording Impressions (5 min)**
AI: "Any insights or impressions from this review?"
- Saved to Log

**6. Closing Prayer (2 min)**

---

#### Personal Monthly Review Agenda (Live Mode)

Deeper and more strategic. Total target: 60-90 minutes.

**1. Opening Prayer / Centering (5 min)**

**2. Review the Past Month (15-20 min)**
AI pulls monthly data:
- Charts: trends in trackers, habit streaks, goal progress
- Log: monthly themes extracted from entries
- Victories: monthly summary
- Compass: task completion rate, patterns
- "Here's your month at a glance. [Summary]. What stands out to you?"

**3. Life Inventory Mini-Check (20-30 min)**
AI walks through life areas with light-touch questions:
"How are you feeling about your [area] right now? Has anything shifted since we last checked in?"
- Not a full Life Inventory rebuild — just a pulse check
- References current Life Inventory summaries and notes movement
- If the user is in a good place: quick acknowledgment and move on
- If something has shifted: AI explores and offers to update the Life Inventory current summary

**4. Mast Review (5-10 min)**
AI: "Let's look at your principles. Are you living in alignment with your Mast? Does anything need to be refined?"
- Not a rewrite — just a check-in. Most months: "Still feels right." Some months: "I need to adjust this."

**5. Set Monthly Goals (10-15 min)**
- Based on the review, AI helps identify 1-3 key goals for the upcoming month
- Connected to Life Inventory areas and active Wheels/Rigging plans

**6. Recording Impressions (5 min)**

**7. Closing Prayer (2 min)**

---

#### Business Review Agenda (Live Mode)

For entrepreneurs, freelancers, and anyone managing their professional life as a stewardship. Total target: 30-60 minutes.

**1. Opening Prayer / Vision Review (5 min)**
AI: "Let's begin your business review. Take a moment to reconnect with why you do this work."
- References Mast work/stewardship principles
- For the initial user: frames work as worship, an opportunity to serve — not just earn. (Drawing from the user's faith framework, not forced.)

**2. Review the Past Week (10-15 min)**
AI: "How did this week go for the business? What were the key outcomes?"
- If user has business-tagged trackers in Charts: AI references KPIs
- Reviews business-tagged Compass tasks: completed, pending, carried
- Reviews business-tagged Log entries for insights
- AI asks: "What went well? What didn't? Why?"

**3. Strategic Focus — Quadrant II (10-20 min)**
AI: "What are the most important, non-urgent activities for the coming week that will drive long-term growth?"
- AI helps identify the difference between urgent-reactive work and important-strategic work
- Suggests "Big Rock" business goals for the week
- If Rigging plans exist for business projects: references upcoming milestones
- If Manifest contains business frameworks: AI can draw from them via RAG ("There's a concept from your uploaded materials about [principle] that might apply here...")

**4. Organize the Week (5-10 min)**
AI: "Let's schedule your Big Rocks. What gets added to the Compass?"
- Business tasks created with appropriate life_area_tag

**5. Recording Impressions (5 min)**
AI: "Any strategic insights or impressions to capture?"
- Saved to Log with business life_area_tag

**6. Closing Prayer (2 min)**

---

#### Custom Meeting Agenda (Live Mode)

AI follows the template's `agenda_sections` JSONB array, using each section's `ai_prompt_text` as a conversation prompt. The eight core elements (prayer, review, goals, etc.) are available as suggested sections when creating a custom template, but not required.

---

### Record After Mode (All Meeting Types)

When the user selects "Record Notes" instead of "Start Meeting":

AI: "It sounds like you've already had your [meeting type]. Let me help you capture what happened."

The AI asks a condensed set of questions:
1. "What were the highlights? What was discussed?"
2. "Were there any decisions or commitments made?"
3. "Any insights or impressions you want to remember?"
4. "Any action items to add to your Compass?"

AI processes responses into:
- Meeting summary (saved to `meetings.summary`)
- Log entry with `entry_type = 'meeting_notes'`
- Compass tasks from action items
- Insights routed to appropriate features (First Mate, Crew, Keel)

Record After mode is intentionally lighter — the user shouldn't feel like they're reliving the meeting, just capturing the essence.

---

### Pattern Recognition Across Meetings

After 5+ meetings of the same type, the AI begins noticing patterns:
- Recurring themes or topics
- Goals that repeatedly carry forward (something is blocking progress)
- Growth trends (positive movement over time)
- Relationship patterns (communication improvements, recurring friction points)

Patterns are reflected in conversation at the start of meetings ("I've noticed that over the last month, the topic of quality time keeps coming up in your Couple Meetings. Would you like to explore what's underneath that?") and on the Meeting History screen as a brief AI-generated "Pattern Note."

The AI never assigns scores or health ratings. It observes and reflects — the user draws their own conclusions.

---

### Scheduling and Reveille Integration

When a meeting is due (based on `meeting_schedules.next_due_date`):
- **Reveille:** "You have a [meeting type] scheduled today." with a "Start Meeting" button
- **Day-before (if enabled):** Mentioned in Reveille the day before: "Tomorrow is your [meeting type] with [person]."

When a meeting is overdue:
- Mentioned once in Reveille, gently: "It's been [X days] since your last [meeting type]. When you're ready, I'm here."
- Not mentioned again for 7 days. No guilt. No nagging.
- Exception: the AI can mention it naturally if the user brings up a related topic at the Helm ("You mentioned wanting to connect more with Jake. Your mentor meeting with him is a great place for that — it's been a couple weeks since your last one.")

After a meeting is completed:
- `meeting_schedules.last_completed_date` updated
- `meeting_schedules.next_due_date` recalculated based on frequency

---

## Cross-Feature Connections

### ← The Mast (Always Loaded)
Vision alignment step in every meeting. Mast principles referenced when setting goals and making decisions.

### ← The Keel (Always Loaded)
Personality and processing style inform how the AI guides meetings. If the user is a verbal processor, meetings are more conversational. If they're an internal processor, AI gives more space.

### ← First Mate (Couple Meeting)
Full spouse context loaded. Recent spouse prompts, insights, love language all inform the conversation. Couple Meeting is the primary structured touchpoint for the marriage relationship.

### ← Crew (Parent-Child Meeting)
Child's full profile loaded — personality, interests, challenges, growth notes, previous meeting notes. Meeting notes save back to crew_notes.

### ← Life Inventory (Monthly/Quarterly)
Monthly Review includes a mini Life Inventory check. Quarterly Inventory redirects to full Life Inventory guided mode (PRD-11).

### ← Charts + Compass + Victories (Review Meetings)
Weekly and Monthly Reviews pull real data — task completion, streaks, victories, trends. This grounds the reflection in facts, not just feelings.

### ← The Manifest (Business Review + Any Meeting)
Business frameworks, books, and uploaded reference materials available via RAG during any meeting conversation, but especially Business Review.

### ← Active Wheels + Rigging Plans (Review Meetings)
Active change processes and plans referenced during goal-setting sections. "Your Wheel on [X] — what moves that forward this week?"

### → The Log (Meeting Notes)
Every completed meeting can save a summary to the Log with `entry_type = 'meeting_notes'`, `source = 'meeting_framework'`, and `related_meeting_id`.

### → The Compass (Action Items)
Action items confirmed during meetings become Compass tasks with `source = 'meeting_action'` and `related_meeting_id`.

### → First Mate (Couple Meeting Insights)
Spouse-relevant insights offered for save to `spouse_insights` (same Helm-to-First-Mate flow).

### → Crew (Parent-Child Meeting Notes)
Child-specific insights and observations saved to `crew_notes` with `source_type = 'meeting_notes'`.

### → The Keel (Self-Insights)
If self-knowledge emerges during any meeting, AI offers to save to Keel (same Helm-to-Keel flow).

### → Victory Recorder
If a meeting review surfaces a genuine accomplishment, AI offers a victory prompt.

### → Reveille / Reckoning (Schedule Integration)
Due and upcoming meetings surfaced in morning briefing. Meeting completion noted in Reckoning if one happened today.

### → Reminders (PRD-18)
Meeting schedules feed into the reminder/notification system for push notifications and in-app alerts.

---

## Onboarding Integration

Meeting Frameworks is NOT part of initial onboarding — it's introduced later, either:
1. When the user has set up First Mate and/or added children to Crew, the AI suggests: "Now that I know about [wife/children], you might enjoy setting up regular meeting rhythms. Want to learn about Meeting Frameworks?"
2. When the user has been using the app for 1-2 weeks and has established basic patterns, the AI can mention it naturally.
3. The user discovers it via navigation.

The AI can help set up initial schedules conversationally: "What day works best for a Couple Meeting? How often would you like to check in with each child?"

---

## Edge Cases

### No Spouse / No Children
- Couple Meeting section hidden if no First Mate is set up
- Parent-Child section hidden if no children in Crew
- Personal Review and Business Review are always available
- Custom meetings always available

### Meeting Interrupted
- If the user exits mid-meeting, the meeting stays in `status = 'in_progress'`
- On return, AI offers to resume: "We were in the middle of your [meeting type]. Want to pick up where we left off?"
- Same guided mode progress persistence pattern as Wheel and Rigging

### Skipped Meetings
- User can explicitly mark a meeting as skipped (from the Upcoming section)
- `status = 'skipped'` recorded in `meetings` table
- `next_due_date` still advances on the schedule
- AI does not reference skipped meetings negatively

### First Meeting (No History)
- AI adjusts language: "This is your first [meeting type]. Let's walk through the agenda together — you'll find your rhythm quickly."
- No "review previous" section since there's nothing to review
- AI may spend more time on the appreciation/connection sections to set the tone

### Very Young Children
- For children under 4-5, the mentor meeting is more of a parent reflection about the child than a meeting with the child
- AI adapts: "Since [child's name] is [age], this is really a time for you to reflect on how [he/she] is growing and what you want to be intentional about this week."

### Couple Meeting When Things Are Hard
- Same three-tier safety system as First Mate (PRD-12) and Safe Harbor (PRD-14)
- If red flags surface during a Couple Meeting, Crisis Override applies
- If the couple is in a rough patch, AI validates and encourages: "Marriage has seasons. This is a hard one. The fact that you're showing up for this meeting says something important."

### Business Review for Non-Business Users
- Business Review is optional and does not appear in Upcoming unless the user has created a schedule for it
- If the user creates business-tagged goals or trackers, the AI may suggest: "You've been tracking business goals — would a weekly Business Review help you stay strategic?"

---

## What "Done" Looks Like

### MVP
- Meeting Frameworks page with Upcoming/Due section and meeting type categories
- Four built-in meeting types: Couple Meeting, Parent-Child Mentor, Personal Review (Weekly + Monthly), Business Review
- Quarterly Inventory as scheduled cadence that redirects to Life Inventory guided mode
- Live Mode: AI walks through full agenda at the Helm (`guided_mode = 'meeting'` with `guided_subtype`)
- Record After Mode: condensed capture flow for meetings that already happened
- Age-adaptive Parent-Child agendas (Core Phase, Love of Learning, Scholar Phase)
- Eight core elements applied across all meeting types
- Meeting notes saved to Log with proper entry_type, source, and related_meeting_id
- Action items → Compass tasks with source = 'meeting_action'
- Insights routed to First Mate, Crew, Keel as appropriate
- Meeting History per type and per person
- Meeting Schedules: recurring configuration with frequency, day/time, notification preferences
- Reveille integration: due meetings shown in morning briefing
- Custom meeting templates: create with AI, write manually, or upload agenda file
- In-progress meeting persistence (resume interrupted meetings)
- Skip meeting without penalty
- `meetings`, `meeting_schedules`, `meeting_templates` tables with RLS
- Pattern recognition for 5+ meetings (reflected in conversation and History screen)

### MVP When Dependency Is Ready
- Reveille/Reckoning meeting reminders and completion display (requires PRD-10 full integration)
- Push notification reminders (requires PRD-18 Reminders)
- Manifest RAG for business review frameworks (requires PRD-15 Manifest)
- Life Inventory Quarterly Inventory redirect (requires PRD-11)

### Post-MVP
- Meeting agenda customization per instance (adjust sections for this specific meeting before starting)
- Multi-participant meetings (both spouses using the app — shared meeting record)
- Meeting templates marketplace (share/discover templates created by other users)
- Calendar export (meeting schedule → Google Calendar events)
- Pre-meeting preparation prompts (AI sends a prep note the day before: "For your Couple Meeting tomorrow, you might want to think about...")
- Meeting effectiveness tracking (did action items get completed? did patterns resolve?)
- Family Council meeting type (whole family, not one-on-one)

---

## CLAUDE.md Additions from This PRD

- [ ] Meeting Frameworks provides structured, recurring meeting templates guided by AI at The Helm (`guided_mode = 'meeting'`). Four built-in types: Couple, Parent-Child Mentor, Personal Review (weekly/monthly/quarterly), Business Review. Plus user-created custom templates.
- [ ] Eight core elements in every meeting: opening prayer/centering, review previous, current state, vision alignment, goal setting, action planning, recording impressions, closing prayer/reflection. Faith elements adaptive to user's Mast context.
- [ ] Two entry modes: Live Mode (AI walks through agenda in real-time) and Record After (condensed capture after the meeting already happened).
- [ ] Parent-Child meetings are age-adaptive: Core Phase (0-8) focuses on simple habits and fun goals, Love of Learning (8-12) explores interests, Scholar Phase (12+) sets structured goals. AI adapts based on child's age from Crew profile.
- [ ] Couple Meeting loads full First Mate + Keel context. State of the Union section uses empathetic listening (validate first). Three-tier safety applies.
- [ ] Business Review loads Mast work/stewardship principles. Frames work as meaningful service, not just productivity. Manifest RAG available for business framework content.
- [ ] Personal Reviews pull real data: Compass task completion, Chart streaks, Victory summaries, Log themes. Weekly = tactical (roles-based Quadrant II planning). Monthly = strategic (mini Life Inventory, Mast review).
- [ ] Quarterly Inventory = scheduled cadence that opens Life Inventory guided mode (PRD-11), not a separate meeting flow. Meeting record created for scheduling continuity.
- [ ] Meeting schedules surface in Reveille. Overdue meetings mentioned once, gently, then not again for 7 days. No guilt, no nagging.
- [ ] Pattern recognition after 5+ meetings of same type. AI notices recurring themes, carry-forward goals, growth trends. Reflects in conversation, never assigns scores.
- [ ] Custom meeting templates: user can create via AI conversation, manual form entry, or by uploading an agenda file for AI extraction. Templates stored with ordered agenda sections.
- [ ] Convention: Meeting notes → Log (entry_type = 'meeting_notes', source = 'meeting_framework'). Action items → Compass (source = 'meeting_action'). Insights → First Mate / Crew / Keel as appropriate.
- [ ] Convention: AI references previous meeting notes (last 2-3) when starting a new meeting of the same type. Provides continuity without overwhelming context.

---

## DATABASE_SCHEMA Additions from This PRD

Tables added:
- `meetings` — individual meeting records with type, status, summary, related person, Helm conversation link, Log link
- `meeting_schedules` — recurring schedule configuration with frequency, preferred day/time, notification preferences, due date tracking
- `meeting_templates` — user-created custom meeting templates with JSONB agenda sections

Update `helm_conversations.guided_mode` enum: already includes `'meeting'`

Add `guided_subtype` values: `'couple'`, `'parent_child'`, `'weekly_review'`, `'monthly_review'`, `'business'`, `'custom'`

Update `log_entries.routed_to` enum: already includes relevant values. No changes needed.

Update "Tables Not Yet Defined" section:
- ~~meetings | PRD-17~~ → DONE
- ~~meeting_schedules | PRD-17~~ → DONE
- meeting_templates | PRD-17 | DONE (new — not previously listed)

Update Foreign Key map:
- auth.users → meetings, meeting_schedules, meeting_templates
- meetings → helm_conversations (helm_conversation_id)
- meetings → log_entries (log_entry_id)
- meetings → people (related_person_id)
- meetings → meeting_templates (template_id)
- meeting_schedules → people (related_person_id)
- meeting_schedules → meeting_templates (template_id)

---

*End of PRD-17*
