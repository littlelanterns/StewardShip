# PRD-16: Rigging — The Planning Tool

## Overview

Rigging is where intention becomes action. On a ship, rigging is the system of ropes and chains that controls the sails — without it, the wind blows but the vessel doesn't move. In StewardShip, Rigging translates goals, aspirations, and projects into structured, actionable plans that feed directly into the features the user already uses.

Rigging is designed for a non-planner. The user never needs to know what MoSCoW prioritization or a pre-mortem analysis is. They describe what they want to accomplish, and the AI picks the right planning framework(s), asks the right questions conversationally, and produces a structured plan with milestones, tasks, and obstacle mitigation — all reviewed and confirmed by the user before anything is saved.

The key insight: most people don't fail at planning because they lack tools. They fail because the tools assume you already know how to plan. Rigging assumes you don't. The AI does the structuring; the user does the thinking.

Planning sessions happen conversationally at The Helm with `guided_mode = 'rigging'`. The Rigging page is where plans live after creation — a place to see progress, review milestones, and launch new planning sessions.

---

## User Stories

### Creating Plans
- As a user, I want to describe what I'm trying to accomplish in plain language and have the AI help me build a plan around it.
- As a user, I want the AI to pick the right planning approach without me needing to know framework names or terminology.
- As a user, I want to review and edit everything the AI generates before it becomes my plan.
- As a user, I want to connect my plan to my principles (Mast) so I remember why this matters.

### Managing Plans
- As a user, I want to see all my active plans in one place with clear progress indicators.
- As a user, I want to tap into a plan and see its milestones, tasks, and obstacles.
- As a user, I want to pause a plan when life gets in the way without losing any of the work.
- As a user, I want to archive completed plans so I can look back on what I accomplished.

### Breaking Down Work
- As a user, I want milestones broken down into tasks that appear in my Compass.
- As a user, I want to choose how detailed the breakdown is (quick overview, detailed steps, or granular concrete actions).
- As a user, I want to break down individual milestones further at any time, not just during initial planning.

### Progress and Nudging
- As a user, I want to choose for each plan whether the AI reminds me about it — some plans need nudges, some don't.
- As a user, I want milestone progress to show up in Charts so I can see momentum.
- As a user, I want the AI to notice when something I'm discussing in a regular conversation connects to an active plan.

### Adapting Plans
- As a user, I want to revise a plan when circumstances change without starting over.
- As a user, I want the AI to help me adjust timelines, add milestones, or re-prioritize when things shift.
- As a user, I want completed milestones to stay visible so I can see how far I've come.

---

## Screens

### Screen 1: Rigging Main Page

**What the user sees:**

**Page Header:**
- "Rigging"
- "Your plans and projects. Where intention becomes action."

**Action Button (Top):**
- "Start New Plan" — primary action, opens The Helm in Rigging guided mode

**Filter/Sort Bar:**
- Filter by status: Active (default), Paused, Completed, All
- Sort: Recently updated (default), Alphabetical, Target date

**Plan Cards:**
Active plans displayed as cards in a scrollable list. Each card shows:
- Plan title
- Brief description (first ~80 characters)
- Status indicator (Active, Paused, Completed)
- Milestone progress: "3 of 7 milestones complete" with a simple progress bar
- Next upcoming milestone title and target date (if set)
- Connected Mast principle (if linked, shown as a small label)
- Last updated date
- Nudge preference icon (subtle indicator if reminders are on for this plan)

Tap a card to open Plan Detail (Screen 2).

**Empty State:**
- "No plans yet. When you have something bigger than a single task — a career move, a home project, a personal goal — this is where it takes shape."
- "Start New Plan" button

**Completed Plans Section:**
- Collapsed by default below active plans
- "Completed Plans (X)" header, tap to expand
- Completed plan cards show the same info but with a completed state and completion date

---

### Screen 2: Plan Detail View

**What the user sees:**

**Header:**
- Plan title (editable)
- Status badge (Active / Paused / Completed)
- Description (editable, expandable)

**Connected Context (Below Header):**
- Connected Mast principles (tap to view, editable — can add/remove connections)
- Connected Goals (if any, with links to Charts)
- Planning framework(s) used (shown in plain language: "Built using milestone planning and obstacle analysis" — not "MoSCoW + Pre-mortem")

**Action Buttons:**
- "Continue Planning" — reopens Helm in Rigging mode for this plan (to add milestones, adjust, etc.)
- "Break Down Next Milestone" — opens Task Breaker for the next incomplete milestone
- Plan menu (three-dot): Pause Plan, Archive, Delete

**Milestones Section:**
Milestones displayed as an ordered list/timeline. Each milestone shows:
- Title
- Target date (if set)
- Status: not_started, in_progress, completed, skipped
- Related tasks count: "4 tasks (2 complete)"
- Expand to see linked Compass tasks
- "Break Down" button on each milestone (opens Task Breaker with quick/detailed/granular options)

Completed milestones stay visible with a completed indicator and completion date. Not hidden — the user sees progress accumulating.

**MoSCoW Section (if applicable):**
Only shown if the plan used MoSCoW prioritization. Four collapsible sections:
- Must Have — items that are non-negotiable
- Should Have — important but not critical
- Could Have — nice to have if time/resources allow
- Won't Have (This Time) — explicitly deferred

Each item is a text entry. User can move items between categories. AI suggests initial categorization, user confirms.

**Obstacles Section (if applicable):**
Only shown if the plan included a pre-mortem. Each obstacle entry shows:
- Risk description
- Mitigation plan
- Status: watching, triggered, resolved

**10-10-10 Section (if applicable):**
Only shown if the plan used the 10-10-10 framework. Shows the decision analysis:
- The decision being evaluated
- 10-day perspective
- 10-month perspective
- 10-year perspective
- Final decision and reasoning

**Nudge Preferences (Bottom of Page):**
- "Reminder Settings for This Plan"
- Options:
  - AI mentions approaching milestones in Reveille/Reckoning (toggle)
  - AI connects related topics during Helm conversations (toggle)
  - AI nudges about overdue milestones (toggle — separate from approaching, so user can get advance notice without guilt about late ones)
- These are set during plan creation and editable here anytime

---

### Screen 3: Planning Session at The Helm

This is not a separate screen — it's the Helm in `guided_mode = 'rigging'` with `guided_mode_reference_id` pointing to the plan being created or edited.

**New Plan Flow:**

1. AI opens: "What are you trying to accomplish? Describe the goal, project, or change you're working toward."

2. User describes in plain language. AI asks follow-up questions to understand scope, timeline, and motivation.

3. AI connects to Mast: "This connects to your principle about [relevant declaration]. Want to link them?" (Only if a natural connection exists. Not forced.)

4. AI selects framework(s) based on what's being planned and walks through them conversationally:

   **For projects with clear deliverables** (home renovation, launching a business, writing a book):
   - Milestone Mapping: "Let's break this into phases. What does the end look like? Now let's work backward..."
   - MoSCoW: "Of everything involved, what absolutely must happen versus what would be nice? Let's sort through this..."

   **For decisions** (career change, major purchase, life transition):
   - 10-10-10: "Let's think about this decision at three time horizons. In 10 days, how will you feel about this choice?..."
   - Backward Planning: "Picture yourself a year from now having made this change. What had to happen to get there?..."

   **For goals with uncertainty** (improving marriage, personal growth, career shift):
   - Obstacle Pre-mortem: "Before we plan forward, let's think about what could go wrong. What are the biggest risks?..."
   - Milestone Mapping: "Even with uncertainty, we can set checkpoint dates where you evaluate and adjust..."

   **For anything:** The AI can combine frameworks. A home renovation might get Milestone Mapping + MoSCoW + Pre-mortem. A career change might get Backward Planning + 10-10-10 + Pre-mortem. The AI uses what fits.

5. AI compiles the plan and presents it for review:
   - "Here's what we've built. Take a look and tell me what to adjust."
   - Plan title (AI suggests, user edits)
   - Description
   - Milestones with target dates
   - MoSCoW items (if used)
   - Obstacles and mitigation (if used)
   - 10-10-10 analysis (if used)
   - Connected Mast principles
   - Connected Goals (AI suggests linking to existing goals or creating new ones)

6. AI asks about nudge preferences:
   - "How do you want me to handle reminders for this plan?"
   - "I can mention upcoming milestones in your morning or evening check-in, connect related topics when they come up in conversation, or nudge you if something falls behind. You can also turn all of that off — some plans just need to exist without pressure. What works for you?"

7. User confirms. Plan is saved. Milestones become trackable. Tasks can be generated immediately or later.

**Continuing an Existing Plan:**

When the user taps "Continue Planning" from a plan detail:
- AI loads the full plan context
- Opens with: "Where would you like to pick up? We could add milestones, adjust the timeline, break down the next milestone into tasks, or talk through how things are going."
- User drives the conversation. AI helps restructure, add, remove, or adjust.

**Task Generation from Milestones:**

At any point during or after planning, the AI can generate tasks from milestones:
- "Want me to break [milestone] into tasks for your Compass?"
- User chooses breakdown level:
  - **Quick** — 3-5 high-level steps
  - **Detailed** — substeps within steps
  - **Granular** — very small, concrete first actions ("Open laptop. Search for contractors in your area. Save the top 3.")
- Generated tasks are presented for review. User confirms which to create.
- Tasks created in `compass_tasks` with `related_rigging_plan_id` set and `parent_task_id` linking subtasks to the milestone's parent task.

---

## Data Schema

### Table: `rigging_plans`

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

### Table: `rigging_milestones`

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

### Table: `rigging_obstacles`

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

## AI Behavior

### Framework Selection Logic

The AI selects frameworks based on what the user describes. This is not rigid — it's a starting point that the AI adjusts as the conversation unfolds.

**Signals → Framework:**

| What the user describes | Primary framework(s) | Why |
|------------------------|---------------------|-----|
| Project with clear deliverables (renovation, book, event) | Milestone Mapping + MoSCoW | Needs phases and prioritization |
| Big decision (career change, move, major purchase) | 10-10-10 + Backward Planning | Needs perspective and path |
| Goal with uncertainty (improve marriage, get healthy) | Milestone Mapping + Obstacle Pre-mortem | Needs checkpoints and risk awareness |
| Overwhelming project (too many moving parts) | MoSCoW + Milestone Mapping | Needs prioritization first, then phases |
| Time-sensitive goal (deadline-driven) | Backward Planning + Milestone Mapping | Needs to work backward from the deadline |
| Repeated failed attempts (tried before, didn't stick) | Obstacle Pre-mortem + Milestone Mapping | Needs to understand why it failed, then plan differently |

**The AI explains its approach in plain language:**
- "Since this has a lot of moving parts, let's start by figuring out what absolutely has to happen versus what would be nice. Then we'll map out the phases."
- "You've tried this before. Before we plan forward, let's think about what got in the way last time. What could derail this again?"
- "This is a big decision. Let's look at it from three angles — how you'll feel about it in 10 days, 10 months, and 10 years."

**If the user wants to know the framework name:** The AI tells them simply. "That's called a pre-mortem — thinking through what could go wrong before it happens." But it never leads with the jargon.

**If the user asks to use a specific framework:** The AI accommodates. "Sure, let's use the 10-10-10 approach. Here's how it works..." The user always has override control.

### Context Loading for Rigging

When Rigging guided mode activates at The Helm:

**Always loaded:**
- Mast entries (to connect plans to principles)
- Active Rigging plans (to avoid duplicate planning and to reference existing work)

**Loaded when relevant:**
- Keel entries (if the plan involves personal change or self-knowledge is relevant)
- Life Inventory (if the plan connects to a life area the user has assessed)
- Goals and custom trackers (to link milestones to existing goals)
- Manifest RAG (if the user has uploaded books or resources relevant to the planning topic — business books for a side business, etc.)
- Active Wheels (if the plan connects to a change process)

**Format addition to system prompt:**
```
MODE: Rigging — Planning Session

The user is creating or editing a plan. Your job is to help them think through
what they're trying to accomplish and structure it into something actionable.

APPROACH:
1. ASK what they're trying to accomplish. Understand scope, timeline, motivation.
2. CONNECT to their Mast principles when natural — not forced.
3. SELECT the right planning framework(s) based on what they describe. Don't name 
   the framework unless they ask. Just ask the right questions.
4. WALK THROUGH the framework conversationally. One question at a time. Don't rush.
5. COMPILE the plan and present it for review. Everything is editable.
6. ASK about nudge preferences — how do they want to be reminded about this plan?
7. OFFER to break milestones into tasks (Task Breaker: quick/detailed/granular).

RULES:
- The user is not a planner. Don't assume they know how to plan.
- Use plain language. "What absolutely has to happen?" not "Let's prioritize using MoSCoW."
- One question at a time. Don't overwhelm with multi-part questions.
- Save incrementally — milestones and obstacles save as the conversation progresses.
- Everything the AI generates is editable by the user.
- Connect to Mast, Goals, Wheels only when genuinely relevant. Not every plan needs 
  a spiritual connection.

ACTIVE PLANS: [loaded — so AI knows what's already being worked on]
```

### Nudge Behavior

Nudging follows the per-plan preferences set during creation:

**Approaching Milestones (if enabled for this plan):**
- In Reveille: "You have a milestone coming up on [plan title]: '[milestone title]' is targeted for [date]. How's it looking?"
- Tone: informational, not pressuring. The user set this reminder because they wanted it.

**Related Conversations (if enabled for this plan):**
- During regular Helm conversations, if the user mentions something that connects to an active plan, the AI notes it: "That relates to your [plan title] plan — want to update anything there?"
- Maximum once per conversation per plan. Not repeated if dismissed.
- This is a connection, not a redirect. The current conversation continues.

**Overdue Milestones (if enabled for this plan):**
- Default OFF. The user has to opt into this.
- When enabled, tone is merciful, not guilt-inducing: "The [milestone title] milestone on your [plan title] plan was targeted for [date]. Want to adjust the timeline, or has this one been handled?"
- Follows the established convention: no guilt language. "Some plans need to flex" not "You missed your deadline."
- If the user repeatedly ignores overdue nudges, AI backs off after 2 mentions and waits for the user to bring it up.

**Plans with all nudges off:**
- The plan exists on the Rigging page. The AI never mentions it unless the user brings it up or visits the Rigging page.
- Some plans just need to exist as a reference without active management. That's fine.

### Milestone-to-Task Flow (Task Breaker Integration)

When the user wants to break a milestone into tasks:

1. AI presents the milestone and asks: "How detailed do you want the breakdown?"
   - **Quick** — "I'll give you 3-5 high-level steps."
   - **Detailed** — "I'll break it into steps with substeps."
   - **Granular** — "I'll give you very specific, concrete actions — small enough that you know exactly what to do first."

2. AI generates the breakdown based on the milestone context, the overall plan, and any relevant Keel/Manifest data.

3. User reviews. Can edit, reorder, add, or remove tasks before confirming.

4. Confirmed tasks are created in `compass_tasks` with:
   - `related_rigging_plan_id` = the plan ID
   - `parent_task_id` = links subtasks to their parent
   - `task_breaker_level` = the chosen level
   - `source` = 'rigging_plan'
   - Life area tag AI-suggested based on plan context

5. Tasks appear in the Compass like any other tasks. They're visually linked to the Rigging plan but functionally identical to manually created tasks.

6. The milestone's `task_breaker_level` is updated to record that it's been broken down.

7. Breaking down can happen at any time — during initial planning, later from the Plan Detail page, or during a "Continue Planning" session at the Helm.

### Plan Revision

Plans are living documents. The user can revise at any time:

**From the Plan Detail page:**
- Edit title, description directly (inline editing)
- Move MoSCoW items between categories
- Edit milestone titles, dates, descriptions
- Add/remove milestones manually
- Update obstacle status (watching → triggered → resolved)
- Change nudge preferences

**From the Helm ("Continue Planning"):**
- AI loads the full plan context and helps restructure
- Can add new milestones, adjust timeline, re-prioritize
- Can run an additional framework on an existing plan (e.g., add a pre-mortem to a plan that originally only used Milestone Mapping)
- Changes save incrementally as the conversation progresses

**Plan completion:**
- When all milestones are marked complete (or the user manually marks the plan complete), the plan moves to "Completed" status
- AI offers a brief reflection: "You finished your [plan title]. [Identity-based acknowledgment connecting to Mast]. Want to record this as a victory?"
- Victory prompt follows the standard pattern — never forced
- Completed plans remain viewable on the Rigging page under the collapsed "Completed Plans" section

---

## Cross-Feature Connections

### ← The Mast (Purpose Alignment)
Plans connect to Mast principles when relevant. The AI suggests connections during planning. The user can add or remove connections from the Plan Detail page.

### ← The Keel (Self-Knowledge)
Personality data and processing style inform how the AI structures planning conversations. If the Keel says the user gets overwhelmed by details, the AI keeps milestone descriptions high-level.

### ← The Manifest (Reference Material)
RAG retrieval during planning sessions. If the user has uploaded business books and is planning a side business, relevant passages are available. If they have parenting resources and are planning a homeschool year, same thing.

### ← Life Inventory (Context)
If the user has assessed relevant life areas, the AI understands where this plan fits in the bigger picture and can reference the gap between current and vision.

### ← The Wheel (Change Connection)
If the plan relates to an active Wheel (change process), the AI connects them. A plan to improve fitness might link to a Wheel about health identity.

### → The Compass (Tasks)
Task Breaker generates tasks from milestones. Tasks live in Compass with `related_rigging_plan_id` linking back.

### → Charts (Progress)
Milestone completion tracked as progress. Goal-linked milestones contribute to goal progress metrics. Custom trackers can be linked to plan milestones.

### → Goals (Tracking)
Plans can create or link to Goals. Milestones can map to specific goal checkpoints.

### → Victory Recorder (Completion)
Plan completion and significant milestone completion can trigger victory suggestions.

### → Reveille / Reckoning (Nudging)
Approaching and overdue milestones surface in daily rhythms when the user has enabled nudging for that plan.

### → The Log (Capture)
Planning session summaries can be saved to the Log for reference. The plan itself persists in Rigging, but key insights or decisions from the conversation may be worth preserving in the Log.

---

## Edge Cases

### User Describes Something Too Small for Rigging
- If the user says "I need to buy groceries" — that's a task, not a plan
- AI recognizes this: "That sounds like a quick task. Want me to add it to your Compass instead? Rigging is more for bigger projects that need multiple steps over time."
- Not gatekeeping — if the user insists, AI accommodates. But it gently suggests the better tool.

### User Describes Something That Overlaps an Existing Plan
- AI loads active plans and detects overlap: "You already have a plan called '[existing plan]' that covers some of this. Want to add to that plan, or is this a separate project?"
- User decides. AI doesn't block.

### Plan Becomes Irrelevant
- Life changes. Plans become moot.
- User can archive from the Plan Detail page. AI doesn't ask why.
- If the user mentions in conversation that a plan is no longer relevant, AI offers: "Want me to archive that plan?"

### Too Many Active Plans
- No hard limit on active plans
- If the user has 5+ active plans, AI gently reflects: "You've got quite a few plans going. Are all of these still active, or are some worth pausing?"
- This is an observation, not a restriction. The user decides.

### Milestone Dates Pass Without Completion
- If nudging is enabled: merciful tone, option to adjust
- If nudging is disabled: AI says nothing
- Milestone status does NOT auto-change. The user manually updates (or AI suggests during a check-in conversation)
- No auto-failure. No red indicators. A missed date is just a date that needs updating.

### Planning Session Interrupted
- Follows the guided mode progress persistence pattern from CLAUDE.md
- Each milestone and obstacle saves to the database as the conversation progresses
- On return, AI detects the in-progress plan and offers to resume: "We were working on your [plan title] plan. Want to pick up where we left off? Here's what we've captured so far..."

### User Wants to Plan Without the AI
- Manual plan creation option on the Rigging page: "Create Plan Manually"
- Opens a form-based interface: title, description, add milestones, add obstacles
- No AI conversation required. User fills in what they want.
- The plan is fully functional — same detail page, same nudging options, same Task Breaker access
- AI can help later if the user taps "Continue Planning"

### Faith Integration
- Consistent with Faith Ethics Framework: faith context applied only when relevant
- If the plan connects to spiritual growth, family stewardship, or values-driven decisions, the AI naturally connects to Mast principles that include faith elements
- If the plan is "renovate the kitchen," faith context is not injected
- For the initial user: when plans connect to being a good father, husband, or steward, the AI can draw on his faith framework naturally — "This plan to be more present with your kids connects to your principle about stewardship of your family."
- Never forced. Relevant, not ritualistic.

---

## What "Done" Looks Like

### MVP
- Rigging page with active plan cards showing progress indicators
- Plan Detail view with milestones, MoSCoW, obstacles, 10-10-10 sections (shown only when applicable)
- "Start New Plan" opens Helm in Rigging guided mode
- AI framework selection based on user description (all 5 frameworks + mixed mode)
- Conversational planning flow: describe → connect to Mast → framework walk-through → compile → review → save
- Per-plan nudge preferences (approaching milestones, related conversations, overdue milestones)
- Milestone-to-task generation via Task Breaker (quick/detailed/granular)
- Tasks created in Compass with `related_rigging_plan_id` linked
- "Continue Planning" to reopen a plan at the Helm for revision
- Inline editing on Plan Detail page (title, description, milestone dates, MoSCoW items, obstacle status)
- Plan status management: active, paused, completed, archived
- Completed plans section on Rigging page
- Manual plan creation option (form-based, no AI required)
- Victory suggestion on plan completion
- Guided mode progress persistence (interrupted sessions resumable)
- RLS on all tables

### MVP When Dependency Is Ready
- Manifest RAG for planning sessions (requires PRD-15 Manifest)
- Reveille/Reckoning milestone nudging (requires PRD-10)
- Goal linking with progress tracking (requires Goals in Charts)
- Wheel connection when plans relate to active change processes

### Post-MVP
- Plan templates: "Planning a home renovation? Start with this template" — pre-loaded milestones and common obstacles
- Plan sharing (export as PDF or shareable link)
- Plan duplication (copy a completed plan's structure for a similar future project)
- Timeline visualization (visual roadmap of milestones on a date axis)
- AI-suggested plan adjustments based on progress patterns ("You've been consistently hitting milestones early — want to compress the timeline?")
- Milestone dependencies (milestone B can't start until milestone A is complete)

---

## CLAUDE.md Additions from This PRD

- [ ] Rigging is the planning tool for goals, projects, and aspirations bigger than a single task. Plans are created conversationally at The Helm (`guided_mode = 'rigging'`) and managed from the Rigging page.
- [ ] AI selects planning frameworks based on what the user describes. Five frameworks available: MoSCoW, Backward Planning, Milestone Mapping, Obstacle Pre-mortem, 10-10-10. Frameworks can be combined ("mixed"). AI uses plain language — no jargon unless the user asks.
- [ ] Per-plan nudge preferences: approaching milestones (Reveille/Reckoning), related conversation connections (Helm), overdue milestone nudges (default off). User sets during creation, editable anytime.
- [ ] Nudge tone: merciful, informational, never guilt-inducing. Overdue nudges back off after 2 mentions if ignored.
- [ ] Task Breaker integration: milestones broken into Compass tasks at quick/detailed/granular levels. Tasks created with `related_rigging_plan_id` and `source = 'rigging_plan'`.
- [ ] Rigging/Compass boundary is soft: AI suggests Rigging when something is too big for a task, but user decides. No gatekeeping.
- [ ] Manual plan creation available — no AI conversation required. AI can help later via "Continue Planning."
- [ ] Faith integration: relevant, not forced. Plans connecting to family, stewardship, or values naturally reference Mast principles with faith elements. Kitchen renovations don't get scripture.

---

## DATABASE_SCHEMA Additions from This PRD

Tables added:
- `rigging_plans` — plan metadata, framework data, MoSCoW arrays, 10-10-10 analysis, nudge preferences, Mast/Goal connections
- `rigging_milestones` — ordered milestones within plans, target dates, status, Task Breaker level
- `rigging_obstacles` — pre-mortem risk/mitigation entries with status tracking

Update "Tables Not Yet Defined" section:
- ~~rigging_plans | PRD-16~~ → DONE
- ~~rigging_milestones | PRD-16~~ → DONE
- rigging_obstacles | PRD-16 | DONE (new — was implied by "Obstacle pre-mortem items" in System Overview but not listed as a separate table)

Update `helm_conversations.guided_mode` enum: already includes `'rigging'`

Update Foreign Key map:
- auth.users → rigging_plans, rigging_milestones, rigging_obstacles
- rigging_plans → rigging_milestones (plan_id)
- rigging_plans → rigging_obstacles (plan_id)
- rigging_plans → helm_conversations (helm_conversation_id)
- rigging_milestones → goals (related_goal_id)
- compass_tasks → rigging_plans (related_rigging_plan_id — already exists in compass_tasks schema)

---

*End of PRD-16*
