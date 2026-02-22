# StewardShip: System Overview PRD v2

## Document Purpose

This document provides the system-level view of how all StewardShip features connect to each other. It defines the data flow between features, shared data dependencies, and the rules that govern cross-feature interactions. Every individual feature PRD should be read alongside this document.

This is the "map." The individual PRDs are the detailed blueprints for each location on the map.

---

## System Architecture Overview

### Application Type
- Progressive Web App (PWA), installable from browser
- Mobile-first responsive design (primary use: phone saved as app)
- Desktop-compatible (secondary use: browser on computer)

### Tech Stack
- **Frontend:** Vite + React + TypeScript (matching MyAIM-Central for component portability)
- **Backend/Database:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, pgvector)
- **Hosting:** Vercel (git-based continuous deployment)
- **AI Conversation:** Claude Sonnet via OpenRouter (initial); BYOK support planned
- **AI Transcription:** OpenAI Whisper API
- **AI Embeddings:** OpenAI or Voyage embeddings â†’ Supabase pgvector

### Design System
- **Color palette (default "Captain's Quarters" theme):** Deep teal (#12403A), dark teal (#1F514E), mid teal (#3B6E67), slate gray (#879E9D), cognac (#A46A3C), deep brown (#733C0C), gold (#C9A84C), warm cream (#F5F0E8), navy (#2C3E50)
- **Typography:** Georgia for headings, Arial/system sans-serif for body
- **No emoji** on adult interfaces. Text-based buttons only.
- **Gold effects** reserved exclusively for victory celebrations and achievement moments.
- **CSS variables** for all colors and theme values. All components use `var(--color-*)` -- never hardcoded values.
- **Theme system:** Infrastructure-first approach. ThemeProvider React context manages active theme, persists to `user_settings.theme`. Theme files in `src/styles/themes/` override CSS custom properties. Default theme: `captains_quarters`. Additional themes added during development.
- **Shared component library:** `src/components/shared/` contains base themed components (Button, Card, Input, Modal, Tooltip) used by all features.
- **Aesthetic:** "Captain's quarters" â€” warm, contemplative, purposeful, nautical without being cartoonish

---

## Feature Inventory

### Primary Features (User-Facing Pages/Views)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 1 | **The Helm** | Chat interface â€” persistent drawer from any page + dedicated full page | Critical |
| 2 | **The Log** | Journal / commonplace book / universal inbox | Critical |
| 3 | **The Compass** | Task management with prioritization view toggles | Critical |
| 4 | **Charts** | Progress tracking and visualization | Critical |
| 5 | **Crow's Nest** | Dashboard / command center | Critical |
| 6 | **The Mast** | Guiding principles and declarations | Critical |
| 7 | **The Keel** | Personality and self-knowledge | High |
| 8 | **First Mate** | Spouse profile, relationship tools, spouse questions | High |
| 9 | **Crew** | People context profiles + Sphere of Influence visualization | High |
| 10 | **Victory Recorder** | Accomplishment tracking + Victory Review narratives | High |
| 11 | **Safe Harbor** | Stress relief and advice | High |
| 12 | **The Manifest** | PDF knowledge base (RAG) | High |
| 13 | **Rigging** | Planning tool for projects and larger goals | High |
| 14 | **Settings** | All configuration | Critical |

### Tools (Features Within Other Features)

| # | Tool | Lives Within | Description |
|---|------|-------------|-------------|
| 15 | **The Wheel** | Own page (view/manage) + Helm (guided work) | Change process guided tool |
| 16 | **Task Breaker** | The Compass | AI task decomposition |
| 17 | **Life Inventory** | Own page (view/edit/archive) + Helm (guided process) | Structured life assessment |
| 18 | **Lists** | The Compass (or standalone) | Flexible shareable lists |
| 19 | **Sphere of Influence** | Crew (alternate view) | Relationship influence visualization |

### Rhythms (Time-Based Experiences)

| # | Rhythm | Timing | Description |
|---|--------|--------|-------------|
| 20 | **Reveille** | Morning | Daily morning briefing card |
| 21 | **Reckoning** | Evening | Daily evening review card + optional conversation |
| 22 | **Friday Overview** | Weekly | Week-in-review |
| 23 | **Sunday Reflection** | Weekly | Spiritual focused session |
| 24 | **Monthly Review** | Monthly | Deeper assessment |
| 25 | **Quarterly Inventory** | Quarterly | Life Inventory refresh conversation (AI may suggest if 3+ months, never pushes) |

### Meeting Frameworks (Guided Structured Sessions)

| # | Meeting | Frequency | Description |
|---|---------|-----------|-------------|
| 26 | **Couple Meeting** | Weekly or custom | Marriage alignment and planning. AI-guided with First Mate context. |
| 27 | **Parent-Child Mentor** | Weekly, bi-weekly, or custom | One-on-one with each child. Age-adaptive. |
| 28 | **Personal Review** | Weekly / Monthly / Quarterly | Self-review: tactical (weekly), strategic (monthly), full inventory (quarterly). |
| 29 | **Business Review** | Weekly or custom | Professional stewardship and strategic planning. |
| 30 | **Custom Meetings** | User-defined | User-created templates via AI, manual, or uploaded agenda. |

### System Features (Background/Infrastructure)

| # | Feature | Description |
|---|---------|-------------|
| 31 | **Reminders** | Push notifications, in-app alerts, batched prompts |
| 32 | **Voice/Transcription** | Recording and Whisper transcription |
| 33 | **Printable Journal Export** | Compile Log entries into downloadable document |
| 34 | **AI Cost Management** | Usage tracking, context controls, max_tokens |

---

## The Helm: Persistent Chat Architecture

The Helm is the AI chat interface. It exists in TWO forms:

### 1. Persistent Drawer (Available From Every Page)
- A pull-up drawer at the bottom of every page in the app
- When pulled up, the AI automatically knows which page the user is on and loads relevant context
- The drawer persists across page navigation â€” mid-conversation is not lost when switching pages
- Suitable for quick questions, in-context help, and short interactions
- Can be dismissed by pulling down

### 2. Full-Page Helm (Dedicated Chat Page)
- For longer, deeper conversations where the drawer is insufficient
- Accessible from the bottom navigation bar and from an "expand" button on the drawer
- Used for guided processes: Wheel building, Life Inventory, meeting frameworks, Rigging planning sessions

### Context-Aware Behavior
The AI adapts based on where the user pulls up the drawer:
- **From Compass:** AI knows you're thinking about tasks. Can help prioritize, break down, or discuss what's blocking you.
- **From First Mate:** AI knows you're thinking about your marriage. Loads spouse profile context.
- **From Crew:** AI knows which person you may be looking at. Loads their context.
- **From Charts:** AI can discuss progress trends.
- **From Mast:** AI can help refine principles or craft declarations.
- **From Wheel page:** AI loads that Wheel's data and can continue working on it.
- **From any page:** AI always has Mast loaded as baseline context.

### Auto-Sorting Tool Detection
When the user starts talking, the AI identifies which tool or feature is relevant and attaches to it. If the user starts discussing a task, the conversation connects to Compass. If they start processing a relationship issue, it connects to First Mate or Crew. The user does not need to manually select a mode.

---

## The Log: Universal Inbox / Commonplace Book

The Log serves dual purpose: it is both a journal AND a universal capture point for anything the user wants to record. Any observation, note, quote, thought, or item can be entered into The Log, and then the user (or AI) decides what to do with it.

### Routing Options (After Entry)
When something is captured in The Log, the user can:
- **Save to journal** â€” stays as a Log entry, tagged and searchable
- **Create a task** â€” routes to The Compass
- **Add to a list** â€” routes to Lists
- **Set a reminder** â€” creates a Reminder
- **Use as future context** â€” saves to Keel (self-knowledge) or Mast (principles)
- **This is a victory** â€” routes to Victory Recorder
- **Just capture it** â€” stays in Log as raw note, unprocessed

The AI can suggest routing based on content: "That sounds like a task â€” want me to add it to your Compass?" But the user always confirms.

---

## Page Patterns for View + Work Features

Several features follow a consistent pattern where there is a VIEW/MANAGE page and the actual WORK happens conversationally at The Helm.

### The Wheel
- **Wheel Page:** Shows active Wheels (progress by spoke, status), completed Wheels, archived Wheels, "Start a New Wheel" button
- **Start a New Wheel:** Opens the Helm in Wheel guided mode. AI walks through Hub then Spoke 1-6. Tells user the "always answer" for each spoke before exploring specifics.
- **Tap existing Wheel:** Opens detail view showing Hub and all Spoke data visually. User can edit any Spoke directly. Can also tap "Continue at Helm" to resume working conversationally.
- **Spoke 3 essays:** "Who I Am" and "Who I Want to Become" are viewable, editable, and exportable (download or email). AI offers to send insights to Keel and vision to Mast (user decides).
- **Archive/Complete:** Available on each Wheel. Completion evaluated at checkpoint date â€” user decides.

### Life Inventory
- **Life Inventory Page:** Shows life areas (default + custom) with brief current state summaries. No ratings or scales.
- **Each area expands to show:** Where I was (baseline), Where I am (current), Where I'm wanting to end up (vision). All user-editable.
- **Start a Life Inventory Conversation:** Opens the Helm for organic conversational assessment. AI asks warm questions, organizes into areas behind the scenes, reflects back for user to refine.
- **Discuss This Area:** Opens Helm with that area as context. User can explore gap-closing strategies consistent with Mast and Keel.
- **Seeded from onboarding** â€” user doesn't see the organized page until later. Areas with no data show "Not explored yet."
- **Updates from Helm:** AI notices relevant info in regular conversations and asks "Would you like me to add that to your Life Inventory for context?" Never silently updates.

### Rigging (Planning)
- **Rigging Page:** Shows active plan cards with progress indicators (milestone completion bar, next upcoming milestone, connected Mast principle, nudge preference icon). Filter by status (Active, Paused, Completed, All). Sort by recently updated, alphabetical, or target date. Completed plans in collapsed section below active.
- **Start New Plan:** Opens the Helm in Rigging guided mode (`guided_mode = 'rigging'`). AI walks through: describe goal → connect to Mast → select framework(s) → conversational walk-through → compile → review → set nudge preferences → save. Manual plan creation also available (form-based, no AI required).
- **Plan Detail View:** Shows title, description, status, connected Mast principles, connected Goals, frameworks used (in plain language). Milestones displayed as ordered timeline with status, target dates, linked task counts. MoSCoW section (if applicable), Obstacles section (if applicable), 10-10-10 section (if applicable). Per-plan nudge preferences editable. "Continue Planning" opens Helm for revision. "Break Down Next Milestone" opens Task Breaker.
- **Five Planning Frameworks:** MoSCoW (prioritization), Backward Planning (work backward from desired end state), Milestone Mapping (phases with checkpoints), Obstacle Pre-mortem (what could go wrong + mitigation), 10-10-10 Decision Framework (10 days / 10 months / 10 years). AI selects appropriate framework(s) based on what user describes — can combine ("mixed"). AI uses plain language, never jargon unless user asks.
- **Milestone-to-Task Flow:** Task Breaker generates Compass tasks from milestones at quick/detailed/granular levels. Tasks created with `related_rigging_plan_id` and `source = 'rigging_output'`.
- **Per-Plan Nudge Preferences:** Approaching milestones in Reveille/Reckoning (default on), related conversation connections in Helm (default on), overdue milestone nudges (default OFF — no guilt). Nudge tone always merciful and informational. Overdue nudges back off after 2 mentions if ignored.
- **View Plan:** Shows the plan structure, milestones, task breakdown. Tasks feed into Compass.

All saved data on these pages is editable by the user at any time (see Cross-Feature Rule 11: Human Override).

---

## Crew + Sphere of Influence

### Crew: People Management
- **Add Crewmate** button to add individuals
- Each person assigned to one or more **categories**: Immediate Family, Extended Family, Professional/Business, Social/Friends, Church/Community, Custom
- **Category View:** Default view, people grouped by category, collapsible sections
- **Sphere View:** Alternate view, interactive concentric circle visualization (see below)
- Toggle between Category View and Sphere View

### Sphere of Influence (Atwater Framework)
An interactive visualization tool within Crew for understanding and intentionally managing relationship influence levels.

**6 Spheres (center outward):**
1. **Focus** â€” Maximum 3: Self, Spouse, God (fixed for married users)
2. **Family** â€” Parents, siblings, children, in-laws, closest friends
3. **Friends** â€” Extended family, close friends, work/school/church entities
4. **Acquaintances** â€” Colleagues, church congregation, classmates
5. **Community** â€” Local services, stores, local government
6. **Geo-Political** â€” State/federal/international government, media, social media

**Each person has TWO sphere assignments:**
- **Desired sphere:** Where the user WANTS this person's influence level to be (required when placing someone)
- **Current sphere:** Where the person actually IS right now in terms of influence (optional â€” some people you just don't want to think about where they currently are)

**When there is a gap between current and desired, the AI helps:**

Moving someone INWARD (strengthening):
- Suggests specific actions: invite to dinner, send a text, initiate shared activity
- Tracks progress over time through Helm conversations

Moving someone OUTWARD (protecting boundaries):
- Validates the boundary: "Their opinions carry the weight you'd give someone in the Community sphere, not a family authority"
- Helps reframe interactions when they happen

Detecting misalignment between behavior and intention:
- If the user placed social media in Geo-Political but journal entries suggest it's operating at Friends-level influence, the AI can gently reflect this
- If politics is placed in Geo-Political but dominates journal entries and Helm conversations, the AI notices the discrepancy

**Visualization:**
- Interactive concentric circles with the sacred triangle (Me, Spouse, God) fixed at center
- Mobile: tap person to select, tap sphere to move them
- Desktop: drag and drop
- People appear as labeled dots within their sphere
- Color coding by category optional

**Differentation from Covey's Circle of Influence:**
- Covey's Circle of Influence vs. Circle of Concern = what you CAN influence vs. what you worry about (outward)
- Atwater's Sphere of Influence = what you ALLOW to influence YOU (inward)
- Both are valuable. Different tools. Both available in the app. They do not replace each other.

**Integration with other features:**
- The Wheel Spoke 4: AI suggests support people from appropriate spheres
- First Mate: Spouse permanently in Focus
- Meeting Frameworks: Couple's Sphere review as periodic topic
- The Keel: Sphere awareness informs self-knowledge about boundary patterns

---

## First Mate: Spouse Questions

In addition to the pre-loaded profile and relationship nudges, the AI generates questions the user can ask his spouse. The user enters her responses, building the First Mate profile over time.

### Flow
1. AI generates a question based on what's already known and what gaps exist in the spouse profile
2. User asks his spouse the question (in real life, not through the app)
3. User enters her response in the app
4. Response is stored in First Mate profile as context
5. AI uses this for future relationship advice, compliment suggestions, and conversation starters
6. AI periodically generates new questions as the relationship context deepens

### Example Questions
- "What's one thing that made you feel loved this week?"
- "What's something you're worried about that I might not know?"
- "If you could change one thing about how we spend our evenings, what would it be?"
- "What's a dream you haven't talked about in a while?"

These are conversation starters for the couple AND context-builders for the AI.

---

## Rigging: The Planning Tool

Rigging translates goals and aspirations into actionable plans. On a ship, rigging is the system of ropes and chains that controls the sails — it translates intention into action.

### When to Use Rigging
When the user has a goal, project, or aspiration bigger than a single task. Examples: career transition, home renovation, launching a side business, improving marriage, preparing for a new baby, writing a book. The boundary between Rigging and Compass is soft — AI suggests Rigging when something is too big for a task, but user always decides. No gatekeeping.

### Planning Frameworks Available
The AI offers the appropriate framework based on what’s being planned. The user never needs to know framework names — the AI uses plain language and picks what fits:
- **MoSCoW:** Prioritize elements of a project (Must have, Should have, Could have, Won’t have now). Best for overwhelming projects with too many moving parts.
- **Backward Planning:** Start from the desired end state, work backward to today’s first step. Best for big decisions and time-sensitive goals.
- **Milestone Mapping:** Break a large goal into phases with checkpoint dates. Best for projects with clear deliverables and goals with uncertainty.
- **Obstacle Pre-mortem:** “What could go wrong? What will you do when it does?” Best for goals with uncertainty and repeated failed attempts.
- **10-10-10 Decision Framework:** What will this decision look like in 10 days, 10 months, 10 years? Best for big decisions and life transitions.
- **Mixed:** Frameworks can be combined. A home renovation might get Milestone Mapping + MoSCoW + Pre-mortem. A career change might get Backward Planning + 10-10-10 + Pre-mortem.

### Planning Sessions
Planning happens conversationally at The Helm (`guided_mode = 'rigging'`). The flow:
1. Describe what you’re trying to accomplish (plain language)
2. AI connects to Mast principles when natural (not forced)
3. AI selects framework(s) and walks through conversationally — one question at a time
4. AI compiles the plan and presents for review (everything editable)
5. AI asks about nudge preferences
6. User confirms → plan saved, milestones trackable, tasks can be generated

The output is structured into:
- Milestones with target dates (tracked in Charts)
- Tasks at quick/detailed/granular levels (fed into The Compass via Task Breaker)
- MoSCoW items (if applicable)
- Obstacles with mitigation plans (if applicable)
- 10-10-10 analysis (if applicable)
- Connected Mast principles (purpose alignment)
- Connected Goals (tracking integration)

### Per-Plan Nudge Preferences
Each plan has its own nudge settings, configured during creation and editable anytime:
- **Approaching milestones** (default on): Mentioned in Reveille/Reckoning
- **Related conversations** (default on): AI connects related topics during Helm conversations (max once per conversation per plan)
- **Overdue milestones** (default OFF): Merciful tone, backs off after 2 mentions if ignored
- Plans with all nudges off: the plan exists on the Rigging page but AI never mentions it unless user brings it up

### Manual Plan Creation
Users who prefer not to use the AI can create plans directly from the Rigging page via “Create Plan Manually” — a form-based interface for title, description, milestones, and obstacles. AI can help later via “Continue Planning.”

### Rigging Page
- View active plans with progress indicators (milestone completion bar, next upcoming milestone)
- Filter by status: Active, Paused, Completed, All
- See milestone progress on each plan card
- Completed plans in collapsed section
- Archive completed plans
- “Start New Plan” opens The Helm


## Data Flow Map

This section defines how data moves between features.

### The Mast (Writes To â†’ Everything)

The Mast is referenced by virtually every AI interaction. READ by all features, WRITTEN by direct editing and Manifest intake flow.

```
The Mast â”€â”€readsâ”€â”€â†’ The Helm (AI references values in every conversation)
The Mast â”€â”€readsâ”€â”€â†’ Safe Harbor (advice filtered through principles)
The Mast â”€â”€readsâ”€â”€â†’ The Wheel (defines "aligned with who I want to be")
The Mast â”€â”€readsâ”€â”€â†’ Reveille (morning thought drawn from Mast)
The Mast â”€â”€readsâ”€â”€â†’ Reckoning (closing thought from Mast)
The Mast â”€â”€readsâ”€â”€â†’ Meeting Frameworks (vision alignment step)
The Mast â”€â”€readsâ”€â”€â†’ Reminders (faith-aligned nudges)
The Mast â”€â”€readsâ”€â”€â†’ First Mate (sacred triangle context)
The Mast â”€â”€readsâ”€â”€â†’ Rigging (purpose alignment for plans)
The Manifest â”€â”€writesâ”€â”€â†’ The Mast (intake flow: extract principles)
The Log â”€â”€writesâ”€â”€â†’ The Mast (route entry as principle/value)
```

### The Keel (Writes To â†’ AI Context)

```
The Keel â”€â”€readsâ”€â”€â†’ The Helm (AI adapts advice to personality)
The Keel â”€â”€readsâ”€â”€â†’ First Mate (relationship dynamics advice)
The Keel â”€â”€readsâ”€â”€â†’ The Wheel Spoke 3 (self-inventory draws from self-knowledge)
The Keel â”€â”€readsâ”€â”€â†’ Safe Harbor (understands user's processing style)
The Keel â”€â”€readsâ”€â”€â†’ Crew/Sphere (boundary pattern awareness)
The Manifest â”€â”€writesâ”€â”€â†’ The Keel (intake flow: personality test results)
The Helm â”€â”€writesâ”€â”€â†’ The Keel (conversational self-discovery compiled)
The Log â”€â”€writesâ”€â”€â†’ The Keel (route entry as self-knowledge)
```

### The Helm (Central Hub â€” Reads/Writes Everything)

```
READS FROM:
  The Mast, The Keel, The Manifest (RAG), The Log (history),
  Charts (progress data), First Mate, Crew, active Wheels,
  The Compass (today's tasks), Victory Recorder (recent wins),
  Rigging (active plans), Sphere of Influence (relationship context),
  Current page context (which page the drawer was opened from)

WRITES TO:
  The Log (conversations saved, commonplace entries routed)
  The Compass (tasks created from conversation)
  Victory Recorder (victories identified in conversation)
  The Wheel (guided Wheel process runs here)
  Life Inventory (guided process runs here)
  Rigging (planning sessions run here)
  The Keel (self-knowledge discovered conversationally)
  The Mast (declarations crafted in conversation)
  First Mate (relationship insights, spouse question responses)
  Crew (people context mentioned in conversation)
  Lists (list items created from conversation)
  Reminders (reminders set from conversation)
```

### The Log (Universal Inbox â€” Receives From Many, Routes To Many)

```
WRITTEN BY:
  Direct user entry (text or voice) â€” commonplace book captures
  The Helm (save conversation as journal entry)
  Meeting Frameworks (recording impressions step)
  Voice transcription (audio â†’ transcript â†’ Log entry)

ROUTES TO (user chooses):
  The Compass (create task from entry)
  Lists (add to a list)
  Reminders (set reminder from entry)
  The Mast (save as principle/value)
  The Keel (save as self-knowledge)
  Victory Recorder (flag as victory)
  Stays in Log (default)

READ BY:
  The Helm (AI references past journal entries)
  Charts (patterns extracted from Log)
  Victory Recorder (AI identifies victories in entries)
  Reckoning (today's entries summarized)
  Weekly/Monthly/Quarterly reviews (Log themes analyzed)
  Printable Journal Export (selected entries compiled)
  Sphere of Influence (AI detects misalignment in journal content)
```

### The Compass (Tasks â€” Central Action Hub)

```
WRITTEN BY:
  Direct user entry
  The Helm (tasks created from conversation)
  The Log (entries routed as tasks)
  The Wheel (Spoke 6 actions become tasks)
  Task Breaker (substeps added to existing tasks)
  Meeting Frameworks (action items from meetings)
  Rigging (planning output becomes tasks)
  Reveille (user edits today's priorities)
  Reckoning (user sets tomorrow's top 3-5)
  AI suggestions (recurring habits, goal-derived tasks)

READ BY:
  Crow's Nest (today's task summary)
  Reveille (today's priorities)
  Reckoning (today's completions and carryovers)
  Charts (completion rates tracked)
  Victory Recorder (completed tasks flagged as victories)
  Reminders (task-based reminders)
  The Helm (AI references tasks in conversation)
```

### Charts (Progress Tracking â€” Aggregates From Multiple Sources)

```
WRITTEN BY (data sources):
  The Compass (task completion rates, streak data)
  The Log (entry frequency, tagged entries)
  Victory Recorder (victory counts by category)
  The Wheel (progress metrics on active Wheels)
  Rigging (milestone completion)
  Habit trackers (custom tracked metrics)

READ BY:
  Crow's Nest (summary visualizations)
  Reckoning (today's progress snapshot)
  Weekly/Monthly/Quarterly reviews (trend analysis)
  The Helm (AI references progress in conversation)
```

### Victory Recorder (Fed By Multiple Sources)

```
WRITTEN BY:
  The Compass (task checked â†’ "Is this a victory?")
  The Log (AI identifies accomplishments OR user routes entry)
  Charts (milestones reached: streaks, goal percentages)
  The Helm (user mentions accomplishment in conversation)
  Direct manual entry

EACH VICTORY INCLUDES:
  Description of the accomplishment
  Life area category tag(s)
  Connection to Mast principle (if applicable)
  Connection to active Wheel (if applicable)
  AI-generated identity-reinforcing celebration text (user-editable)
  Timestamp

READ BY:
  Crow's Nest (recent victories displayed)
  Reckoning (Victory Review â€” conversational AI narrative of today's victories)
  Charts (victory trends over time)
  Weekly/Monthly/Quarterly reviews (victory summaries)
  The Helm (AI references past victories for encouragement)
  Victory Review (conversational narrative for today/week/month/custom period)
```

### The Wheel (Complex Cross-Feature Tool)

```
READS FROM:
  The Mast (defines alignment target â€” "who I want to become")
  The Keel (self-knowledge loaded during Spoke 3)
  Life Inventory (user may see areas where a Wheel is valuable, but user always initiates)
  Crew (support people for Spoke 4 â€” Supporter, Reminder, Observer)
  Sphere of Influence (appropriate sphere for support people)
  The Log (patterns for Spoke 5 evidence â€” AI as supplemental Observer)
  Charts (progress data for Spoke 5 evidence)
  The Manifest (framework wisdom for advice)

WRITES TO:
  The Compass (Spoke 6 actions optionally become daily tasks â€” AI suggests, user decides)
  The Keel (Spoke 3 insights optionally sent â€” AI offers, user decides)
  The Mast (Spoke 3 Part 2 vision optionally becomes declarations â€” AI offers, user decides)
  The Log (Wheel reflections saved as journal entries)
  Charts (Wheel progress metrics tracked)
  Crew (support people roles documented)
  Reminders (Rim check-in reminders, default ~2 weeks, user adjustable)
```

### First Mate (Spouse â€” Specialized Context)

```
WRITTEN BY:
  Direct user editing (profile setup)
  Spouse question responses (user asks, enters her answer)
  The Helm (relationship insights from conversation)
  Meeting Frameworks: Couple Meeting (notes and goals)

READ BY:
  The Helm (AI references spouse context in advice)
  Reminders (relationship nudges informed by profile)
  The Wheel Spoke 4 (spouse role boundaries)
  Meeting Frameworks: Couple Meeting (agenda context)
  Sphere of Influence (spouse fixed in Focus)
```

### Crew + Sphere of Influence

```
WRITTEN BY:
  Direct user entry (Add Crewmate button)
  The Helm (people mentioned in conversation)
  Meeting Frameworks: Parent-Child Mentor (notes per child)
  Sphere of Influence (sphere assignments per person)

READ BY:
  The Helm (AI knows who people are when mentioned)
  The Wheel Spoke 4 (support people identification)
  Meeting Frameworks (child-specific agendas)
  Reminders (people-related nudges)
  Sphere of Influence (visualization and AI suggestions)
```

### Rigging (Planning Tool)

```
READS FROM:
  The Mast (purpose alignment — always loaded in Rigging guided mode)
  Goals (what's being planned toward, link milestones to existing goals)
  The Keel (strengths/weaknesses for realistic planning)
  Life Inventory (if plan connects to assessed life areas)
  Active Wheels (if plan connects to a change process)
  The Manifest (RAG for relevant reference material)
  Active Rigging plans (to detect overlap and avoid duplicates)

WRITES TO:
  The Compass (tasks generated from milestones via Task Breaker)
  Charts (milestones tracked as progress, goal-linked milestones contribute to goals)
  Goals (goals created or updated from planning)
  The Log (planning session summaries saved for reference)
  Victory Recorder (plan completion and significant milestones can trigger victory suggestions)
  Reveille / Reckoning (approaching and overdue milestones surface when user has enabled nudging)
```

### The Manifest (Knowledge Base)

```
WRITTEN BY:
  PDF upload
  Audio file upload â†’ transcription â†’ stored as searchable text
  Direct text/note addition

INTAKE FLOW (on upload, AI asks how to use it):
  â†’ General reference (stays in Manifest, available via RAG)
  â†’ Extract principles for The Mast
  â†’ Inform The Keel (personality data)
  â†’ Reference for specific goal or Wheel
  â†’ Store for later

READ BY:
  The Helm (RAG: relevant passages pulled into conversation context)
  Safe Harbor (wisdom drawn from uploaded materials)
  Reveille (spiritual/motivational thoughts from uploaded materials)
  The Wheel (framework concepts for identity work)
  Rigging (reference material for planning)
```

### Reveille (Morning â€” Aggregates Read-Only)

```
READS FROM:
  The Mast (spiritual/motivational thought source)
  The Manifest (additional thought sources via RAG)
  The Compass (today's priorities)
  Reminders (what's relevant today)
  Charts (active streaks to maintain)
  Calendar integration (today's appointments, when implemented)

WRITES TO:
  The Compass (user can edit today's priorities from Reveille)
  The Helm (tapping a prompt opens conversation)
```

### Reckoning (Evening â€” Aggregates + Sets Tomorrow)

```
READS FROM:
  The Compass (today's completions and carryovers)
  The Log (today's entries)
  Victory Recorder (today's victories â†’ Victory Review conversational narrative)
  The Mast (closing thought source)
  Calendar integration (tomorrow's appointments, when implemented)

WRITES TO:
  The Compass (tomorrow's top 3-5 priorities set here)
  The Helm (optional deeper conversation)
  Victory Recorder (win of the day confirmed here)
```

### Reminders + Rhythms (Notification Infrastructure — Background System)

```
TRIGGERED BY:
  The Compass (task due dates, recurring task streaks at risk)
  The Wheel (Rim check-in cycle, next_rim_date)
  First Mate (important dates: anniversary/birthday, spouse prompt schedule)
  Crew (important dates: birthdays/milestones for crew members)
  Meeting Frameworks (meeting_schedules.next_due_date, day-before)
  Charts (active streaks at risk — not logged by EOD)
  Rigging (approaching milestones if nudge enabled, overdue milestones max 2x)
  Lists (items with "remind me" action)
  The Log (entries routed as reminders with user-specified date/time)
  Settings (custom user-set reminders, journal export monthly)
  Rhythm schedule (Friday Overview, Sunday Reflection, Monthly Review, Quarterly Inventory)
  Rhythm prompts (gratitude/joy/anticipation per user frequency settings)

DELIVERY METHODS:
  Reveille batch (default — non-urgent, shown in morning briefing)
  Reckoning batch (evening — streaks, prompted entries)
  Push notifications (time-critical — important dates, custom timed, meeting day-of)
  In-app alerts (contextual — while app is open, never interrupts Helm)

LIFECYCLE:
  pending → delivered → acted_on / dismissed / snoozed / archived
  Snooze presets: 1 hour, later today, tomorrow, next week
  Auto-dismiss after 3 snoozes, auto-archive after 30 days

CONTROLS:
  Master notification toggle (push on/off)
  Quiet hours (no push between 10 PM and reveille_time)
  Per-type delivery preferences in user_settings
  Max 5 push notifications per day (excess batched to Reveille)
  Important dates advance notice: 0, 1, 3, or 7 days
```

---

## Shared Data Entities

Core data objects referenced by multiple features. Individual PRDs define how each feature interacts with them.

### User
- Authentication credentials
- Profile basics (name, timezone)
- AI provider settings and API keys (encrypted)
- Notification preferences
- Display preferences (default Compass view, theme)
- Calendar connection tokens (when implemented)

### Mast Entries
- Type: value, declaration, scripture, principle, faith_foundation, vision
- Text content
- Category (optional)
- Created/updated timestamps
- Active/archived status

### Keel Entries
- Type: personality_test, trait, tendency, strength, weakness, freeform, you_inc
- Text content
- Source (e.g., "Enneagram," "self-observed," "uploaded PDF")
- Created/updated timestamps

### Log Entries (Journal / Commonplace Book)
- Text content (may be long-form)
- Entry type: journal, gratitude, reflection, quick_note, meeting_notes, transcript, helm_conversation, custom
- Life area tags (multiple allowed, AI auto-assigned on save): spiritual, marriage, family, physical, emotional, social, professional, financial, personal_development, service, custom
- Source: manual_text, voice_transcription, helm_conversation, meeting_framework
- Routed to (if applicable): compass_task, list_item, reminder, mast_entry, keel_entry, victory, none
- Created timestamp
- Related Wheel ID (optional)
- Related Meeting ID (optional)

### Tasks (Compass)
- Title
- Description (optional)
- Status: pending, completed, carried_forward, cancelled
- Priority metadata (for view toggles): eisenhower_quadrant, frog_rank, importance_level (1/3/9), big_rock boolean, ivy_lee_rank
- Life area category tag (AI auto-assigned): spouse_marriage, family, career_work, home, spiritual, health_physical, social, financial, personal, custom
- AI-suggested priority (user confirms before saving)
- Due date (optional)
- Recurrence rule (optional, for habits)
- Parent task ID (for Task Breaker substeps)
- Task Breaker detail level (quick, detailed, granular)
- Related goal ID (optional)
- Related Wheel ID (optional)
- Related meeting ID (optional)
- Related Rigging plan ID (optional)
- Completed timestamp
- Victory flagged (boolean)

### Lists
- Title
- Type: todo, shopping, wishlist, expenses, custom
- Items (ordered array of text + checked boolean)
- AI interaction preference: remind, schedule, prioritize, store_only
- Shared status and share link (for future multi-user / MyAIM connection)
- Created/updated timestamps

### Goals
- Title
- Description
- Life area category
- Target date (optional)
- Status: active, completed, paused, archived
- Progress metric type: percentage, streak, count, boolean
- Current progress value
- Related Mast entry ID (which principle this goal serves)
- Related Wheel ID (optional)
- Related Rigging plan ID (optional)

### Victories
- Description
- Life area category tag(s)
- Source: compass_task, log_entry, chart_milestone, helm_conversation, manual
- Source reference ID (which task, entry, etc.)
- Mast connection text (AI-generated, user-editable)
- Wheel connection ID (optional)
- AI celebration text (user-editable)
- Timestamp

### Wheel Instances
- Hub: description of what to change (aspirational, not punitive)
- Status: in_progress, active, completed, archived
- Spoke 1 (Why): self-worth/belonging connection text. Always-answer: "To increase self-worth and belonging for myself or others." AI tells user upfront.
- Spoke 2 (When): start date, checkpoint date, notes. Always-answer: "As soon as possible." Merciful, not rigid.
- Spoke 3 Part 1 (Who I Am): compiled essay â€” honest assessment. Should be genuinely uncomfortable. Exportable (download/email). AI offers to send insights to Keel.
- Spoke 3 Part 2 (Who I Want to Become): compiled essay â€” role models (at least 2, ideally 3-4) + vision of success. Exportable. AI offers to send vision to Mast.
- Spoke 4 (Support): three roles with specific boundaries:
  - Supporter: {name, relationship, what_support_looks_like, script}. Spouse CAN be.
  - Reminder: {name, relationship, proximity, signal, script}. Spouse NEVER. Ideally proximate to change environment.
  - Observer: {name, relationship, proximity, what_to_watch, script}. Spouse NEVER (but can share observations WITH observer). Ideally able to see user in context.
  - AI serves supplementally in all three roles but pushes toward human connection.
- Spoke 5 (Evidence): defined upfront, reviewed during Rim. Three sources: self-observation, observer feedback, blind test. Plus fruits. Array of {text, source, seen, date_seen}.
- Spoke 6 (Becoming): "I do what the person I want to be would do." Current action commitments. AI suggests Compass tasks, user decides. Array of {text, compass_task_id}.
- Current spoke progress (0=hub only, 1-6=working, 7=all complete)
- Rim: interval (default 14 days, user adjustable), next check-in date, check-in count
- Related Mast entry IDs
- Related Goal IDs
- Life area tag (AI auto-assigned, user removable)

### People (Crew + First Mate)
- Name
- Relationship type: spouse, child, coworker, friend, parent, sibling, mentor, other
- Is First Mate (boolean â€” only one spouse)
- Categories (multiple): immediate_family, extended_family, professional, social, church_community, custom
- Notes (freeform)
- Age (optional, relevant for children)
- Personality notes (optional)
- Love language (optional, primarily for First Mate)
- Important dates (array: birthdays, anniversaries, etc.)
- Wheel support roles (array: which Wheels they support, in what role)
- Mentor meeting notes (for children, linked to Log entries)
- Sphere of Influence: desired sphere (focus, family, friends, acquaintances, community, geo_political)
- Sphere of Influence: current sphere (optional â€” same enum, nullable)
- Spouse question responses (for First Mate: array of question + response + date)

### Rigging Plans
- Title
- Description
- Status: active, completed, paused, archived
- Planning framework: moscow, backward, milestone, premortem, ten_ten_ten, mixed
- Frameworks used: array of all frameworks applied (for mixed plans)
- MoSCoW items (if applicable): must_have, should_have, could_have, wont_have arrays
- 10-10-10 analysis (if applicable): decision text, 10-day perspective, 10-month perspective, 10-year perspective, conclusion
- Milestones (array: title, target_date, status, related_goal_id, task_breaker_level, completed_at)
- Obstacle pre-mortem items (array: risk, mitigation_plan, status: watching/triggered/resolved)
- Related Mast entry IDs (purpose alignment, UUID array)
- Related Goal IDs (UUID array)
- Nudge preferences per plan: approaching_milestones (default on), related_conversations (default on), overdue_milestones (default off)
- Helm conversation ID (the planning session that created this)
- Completed timestamp
- Created/updated timestamps

### Rigging Milestones
- Plan ID (which plan this milestone belongs to)
- Title
- Description (optional)
- Sort order (within the plan)
- Target date (optional)
- Status: not_started, in_progress, completed, skipped
- Task Breaker level: quick, detailed, granular, null (if not yet broken down)
- Related Goal ID (if milestone maps to a specific goal)
- Completed timestamp

### Rigging Obstacles
- Plan ID (which plan this obstacle belongs to)
- Risk description (what could go wrong)
- Mitigation plan (what the user will do when it happens)
- Status: watching, triggered, resolved
- Sort order (display order)

### Meetings
- Meeting type: couple, parent_child, weekly_review, monthly_review, quarterly_inventory, business, custom
- Template ID (FK → meeting_templates, for custom meetings)
- Related person ID (spouse for couple, child for parent_child, null for personal/business)
- Status: in_progress, completed, skipped
- Entry mode: live, record_after
- Summary (AI-generated meeting summary)
- Impressions (user-recorded insights/promptings)
- Helm conversation ID (FK → helm_conversations)
- Log entry ID (FK → log_entries, if notes saved to Log)
- Meeting date
- Completed timestamp

### Meeting Schedules
- Meeting type (same enum as meetings)
- Template ID (for custom meetings)
- Related person ID
- Frequency: weekly, biweekly, monthly, quarterly, custom
- Custom interval days (for custom frequency)
- Preferred day of week
- Preferred time
- Notification type: reveille, day_before, both, none
- Is active (can pause without deleting)
- Last completed date (denormalized)
- Next due date (calculated from frequency + last completed)

### Meeting Templates
- Template name
- Description (optional)
- Default frequency
- Default related person ID (optional)
- Agenda sections: JSONB array of {title, ai_prompt_text, sort_order}
- Source: manual, ai_generated, uploaded_file
- File storage path (if from uploaded file)

### Manifest Items
- File name
- File type: pdf, audio_transcript, text_note
- Storage path (Supabase Storage)
- Usage designation: general_reference, mast_extraction, keel_info, specific_goal, store_only
- Related Wheel ID (optional)
- Chunk embeddings (stored in pgvector table)
- Upload timestamp

### Life Inventory Areas
- Life area name (default: Spiritual/Faith, Marriage/Partnership, Family/Parenting, Physical Health, Emotional/Mental Health, Social/Friendships, Professional/Career, Financial, Personal Development/Learning, Service/Contribution â€” plus custom areas)
- Is custom (boolean)
- Display order
- Where I was: baseline summary text (first compiled observation, preserved as snapshot)
- Where I was: baseline date
- Where I am: current summary text (most recent compiled observation, updated with user confirmation)
- Where I am: current date
- Where I'm wanting to end up: vision summary text
- Where I'm wanting to end up: vision date
- All text is user-editable
- History of past snapshots per area (showing how "Where I am" has evolved over time)

### Life Inventory Snapshots
- Area ID (which life area this snapshot belongs to)
- Snapshot type: baseline, current, vision
- Summary text (the compiled observation at this point in time)
- Helm conversation ID (which conversation produced this)
- Timestamp

### Reminders
- Reminder type: task_due, task_overdue, streak_at_risk, meeting_due, meeting_day_before, important_date, wheel_rim, rigging_milestone, rigging_overdue, spouse_prompt, gratitude_prompt, joy_prompt, anticipation_prompt, list_item, log_routed, custom, journal_export, friday_overview, sunday_reflection, monthly_review, quarterly_inventory
- Title (short display text, ≤100 chars for push)
- Body (optional longer description)
- Delivery method: push, reveille_batch, reckoning_batch, in_app
- Scheduled at (when to deliver; null = next batch)
- Status: pending, delivered, acted_on, dismissed, snoozed, archived
- Snoozed until (re-delivery timestamp)
- Snooze count (auto-dismiss after 3)
- Related entity type + ID (compass_task, meeting, person, wheel_instance, rigging_plan, rigging_milestone, list_item, log_entry, spouse_prompt, null)
- Source feature: compass, meetings, first_mate, crew, wheel, rigging, charts, lists, log, rhythms, settings, user
- Metadata JSONB (person_name, date_label, streak_name, etc.)
- Archived timestamp

### Push Subscriptions
- Endpoint URL (Web Push API)
- p256dh key (client public key)
- Auth key (auth secret)
- Device label (user-friendly name)
- Is active (can deactivate without deleting)

### Rhythm Status
- Rhythm type: friday_overview, sunday_reflection, monthly_review, quarterly_inventory
- Period key: '2026-W08' (week), '2026-02' (month), '2026-Q1' (quarter)
- Status: pending, shown, dismissed, completed
- Shown/dismissed/completed timestamps

---

## Cross-Feature Rules

These rules govern behavior spanning multiple features. Every individual PRD must respect these rules.

### Rule 1: Victory Flow
When ANY of the following occur, the system checks whether a victory should be recorded:
- A task is completed in The Compass
- A milestone is reached in Charts (streak count, goal percentage)
- The AI identifies an accomplishment in a Helm conversation
- The AI identifies an accomplishment in a Log entry
The user always confirms before a victory is recorded.

### Rule 2: Mast Context in AI Interactions
Every AI response in The Helm, Safe Harbor, Reveille, Reckoning, The Wheel, Meeting Frameworks, and Rigging must have access to the user's Mast entries as part of the system prompt context. Referenced naturally when relevant, never forced.

### Rule 3: Declarations, Not Affirmations
Anywhere the app helps the user craft personal statements, the language must be honest commitment language ("I choose to become..." "I am committed to...") never hollow affirmation language ("I am already...").

### Rule 4: Teach Principles, Not Authors
Frameworks applied naturally without citing author names in conversation. Attribution offered afterward or upon request.

### Rule 5: Faith Context â€” Relevant, Not Forced
Faith references included when the topic naturally connects. Not injected into purely functional conversations unless user brings it up or it connects to a Mast principle.

### Rule 6: Redirect to Human Connection
When the user would benefit from talking to a real person, the AI suggests this. Specifically redirects to prayer and divine guidance for spiritual matters: "Have you taken this to the Lord?"

### Rule 7: AI Suggests, User Confirms
For task categorization, victory flagging, Wheel recommendations, Manifest intake routing, Compass view placement, Sphere of Influence suggestions, and Log routing suggestions â€” the AI suggests but the user always confirms.

### Rule 8: Crisis Override
If indicators of crisis detected (suicidal ideation, self-harm, domestic violence, severe distress), ALL other behaviors overridden. Immediate crisis resources. No coaching. Supersedes all other rules.

### Rule 9: Privacy and Data Isolation
All user data isolated per user via Supabase RLS. API keys encrypted at rest. Shared lists use explicit share tokens.

### Rule 10: Component Portability
All features built as self-contained modules with clean TypeScript interfaces, CSS variable-based theming, and Supabase-compatible schemas. Extractable for Inner Oracle and MyAIM-Central.

### Rule 11: Human Override / Edit on All Saved Data
Any data that the AI generates, suggests, summarizes, or compiles can be edited or overridden by the user at any time. Nothing is locked once AI writes it. This applies to:
- AI-generated celebration text on victories
- AI-suggested task categorizations
- AI-compiled Keel summaries
- AI-generated gap analysis in Life Inventory
- Wheel Spoke data compiled from conversations
- Meeting notes and summaries
- Rigging plan structures
- Sphere of Influence AI suggestions
- Every other piece of AI-generated content

### Rule 12: Persistent Helm Context
The Helm drawer maintains conversation state across page navigation. Switching pages does not clear the current conversation. Context from the current page is additive, not replacing.

### Rule 13: Steward, Not Captain
God is the Captain. The user is the steward â€” entrusted with the vessel, responsible for navigating faithfully, but serving under divine authority. NEVER call the user "Captain." Use "Steward" if a title is needed, or simply their name. The AI frames the nautical metaphor as stewardship, not ownership or mastery. (Reference: Orson F. Whitney's response to Invictus.)

### Rule 14: No Emoji
Zero emoji in UI, AI responses, or generated content. Text-based buttons only. Gold visual effects reserved exclusively for Victory Recorder and streak milestones.

### Rule 15: AI Auto-Tagging
When entries are saved (Log entries, Compass tasks, Victories), the AI automatically suggests and applies life area tags. Tags appear as removable chips â€" the user can delete or add but never needs to make tagging decisions themselves.


### Rule 16: Gender & Relationship Adaptive
The AI adapts pronouns, feature visibility, and relationship framing based on `user_profiles.gender` and `user_profiles.relationship_status`. Null values default to gender-neutral/inclusive language. The user can change these at any time in Settings and the app adapts immediately. See ADDENDUM-User-Flexibility.md for full details.

---

## Navigation Structure

### Primary Navigation (Bottom Bar on Mobile, Sidebar on Desktop)

| Position | Destination | Description |
|----------|-------------|-------------|
| 1 | Crow's Nest | Dashboard / command center home |
| 2 | The Compass | Tasks, lists, prioritization views |
| 3 | The Helm | Full-page chat (center, prominent) |
| 4 | The Log | Journal / commonplace book |
| 5 | More menu | Everything else (see below) |

### More Menu Contents
- Charts (progress tracking)
- The Mast (guiding principles)
- The Keel (personality/self-knowledge)
- The Wheel (view/manage change processes)
- Life Inventory (view/edit assessments)
- Rigging (planning)
- First Mate (spouse)
- Crew (people + Sphere of Influence)
- Victory Recorder
- Safe Harbor
- The Manifest (knowledge base)
- Settings

### Persistent Helm Drawer
- Available from EVERY page as a pull-up drawer at bottom
- Drawer has an "expand to full page" button
- Conversation persists across page navigation

### Crow's Nest (Command Center)
The home page shows summary cards from all major features. Each card is tappable to navigate to that feature:
- Today's Compass summary
- Active streaks and Charts highlights
- Recent Log entries
- Active Wheel progress
- Recent victories
- Upcoming reminders and meetings
- Quick-action buttons

### Context-Sensitive Access
- The Wheel, Life Inventory, Rigging: Own pages for viewing + Helm for guided work
- Reveille: Appears on app open in the morning (configurable)
- Reckoning: Appears on app open in the evening or via Crow's Nest (configurable)
- Meeting Frameworks: Accessed via Crew (parent-child), First Mate (couple), Settings (scheduling)
- Sphere of Influence: Alternate view within Crew page
- Task Breaker: Button on individual tasks within Compass

---

## The Compass: Prioritization View Toggles

The same tasks are viewable through different prioritization frameworks. A toggle at the top of the page lets the user switch views instantly. When hovering over (desktop) or long-pressing (mobile) a view toggle, a brief description modal explains the framework.

### Daily Views
| View | Description (shown on hover/long-press) |
|------|----------------------------------------|
| **Simple List** | Plain checkboxes. No framework, just check things off. |
| **Eisenhower Matrix** | Four quadrants: Do Now (urgent + important), Schedule (important, not urgent), Delegate (urgent, not important), Delete (neither). |
| **Eat the Frog** | Your hardest or most dreaded task at the top. Do it first â€” everything else feels easier. |
| **1/3/9** | Limits your day to 13 items: 1 critical task, 3 important tasks, and 9 small tasks. |
| **Big Rocks** | Identify your 2-3 major priorities. Everything else is gravel that fits around them. |
| **Ivy Lee** | Your top 6 tasks ordered by importance. Work on only the first until finished. |
| **By Category** | Tasks grouped by life area: Spouse/Marriage, Family, Career/Work, Home, Spiritual, Health, Social, Financial, Personal, Custom. |

### AI Behavior with Views
When a view is toggled, the AI suggests placement for each task (which quadrant, which rank, which category). The user confirms or adjusts before the view saves. The AI can also suggest a view based on context: "You mentioned low energy today. The 1/3/9 view might help you focus on just one critical thing."

### MoSCoW
MoSCoW (Must have, Should have, Could have, Won't have) lives in **Rigging** as a planning framework, NOT as a daily Compass view. It is used when planning projects, not when viewing daily tasks.

---

## AI System Prompt Structure

Every AI interaction includes these context layers (loaded dynamically based on relevance):

### Always Included
1. **Base personality:** Warm, empathetic, direct processing partner. Not a friend, not clinical. Boundaried.
2. **Framework awareness:** Straight Line Leadership contrasts, Atomic Habits, Change Wheel, 5 Levels of Consciousness, Covey/7 Habits/Divine Center, Thou Shall Prosper, TSG/TJEd, Sphere of Influence
3. **Behavioral rules:** All 15 cross-feature rules
4. **User's Mast entries**

### Included When Relevant
5. **User's Keel data** (personality context)
6. **Active Wheel data** (if user is working on a Wheel)
7. **First Mate profile** (if relationship topic)
8. **Crew members** (if specific people mentioned)
9. **Sphere of Influence data** (if relationship/boundary topic)
10. **RAG results from Manifest** (if knowledge base query relevant)
11. **Recent Log entries** (if user references recent events)
12. **Charts summary** (if progress/trends relevant)
13. **Today's Compass** (if task-related)
14. **Active Rigging plans** (if planning/project topic)
15. **Current page context** (which page the drawer was opened from)

### Context Window Management
- Mast always loaded (relatively small)
- Additional context loaded selectively based on conversation topic
- User can toggle shorter/longer context in Settings
- RAG retrieval pulls only top-K relevant chunks

---

## Build Order and Dependencies

### Phase 1: Foundation
1. Auth + User Setup
2. Database Schema (all tables)
3. Design System (CSS variables, component library)
4. Navigation Shell (routing, bottom bar, sidebar, Helm drawer infrastructure)

### Phase 2: Core Identity
5. The Mast (CRUD for principles, declarations)
6. The Keel (CRUD for personality data)

### Phase 3: Primary Interface
7. The Helm (chat UI, AI integration, context loading, drawer + full page)
8. The Log (commonplace book CRUD, routing options, tagging)

### Phase 4: Daily Action
9. The Compass (task CRUD, all 7 view toggles with hover descriptions, category tagging)
10. Task Breaker (AI decomposition within Compass)
11. Lists (CRUD, shareable links)

### Phase 5: Progress
12. Victory Recorder (CRUD, source tracking, AI celebration, Victory Review narratives)
13. Charts (visualization components, data aggregation)
14. Crow's Nest (dashboard aggregating from all sources)

### Phase 6: Daily Rhythms
15. Reveille (morning card, data aggregation)
16. Reckoning (evening card, tomorrow prep, optional Helm link)

### Phase 7: Growth Tools
17. The Wheel (page + guided Helm process, all Spokes, Rim cycle)
18. Life Inventory (page + guided Helm process, gap analysis)
19. Safe Harbor (specialized AI mode)
20. Rigging (page + guided Helm planning, MoSCoW + other frameworks)

### Phase 8: Relationships
21. First Mate (spouse profile, nudges, spouse questions, sacred triangle)
22. Crew (people profiles, categories, Add Crewmate, mentor notes)
23. Sphere of Influence (visualization, drag/tap placement, current/desired, AI suggestions)

### Phase 9: Knowledge
24. The Manifest (file upload, RAG pipeline, intake flow)

### Phase 10: Cadence
25. Meeting Frameworks (templates, custom scheduling, note integration)
26. Reminders (push notifications, scheduling engine)
27. Rhythms (Friday, Sunday, Monthly, Quarterly triggers, gratitude/joy/anticipation prompts)

### Phase 11: Polish
28. Settings (complete panel)
29. Printable Journal Export
30. Cost tracking dashboard
31. Google Calendar integration (post-launch)

---

## File Structure

```
stewardship/
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ manifest.json
â”‚   â”œâ”€â”€ sw.js
â”‚   â””â”€â”€ icons/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ main.tsx
â”‚   â”œâ”€â”€ App.tsx
â”‚   â”œâ”€â”€ styles/
â”‚   â”‚   â”œâ”€â”€ theme.css          (CSS variables)
â”‚   â”‚   â””â”€â”€ global.css
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ supabase.ts
â”‚   â”‚   â”œâ”€â”€ ai.ts              (AI provider adapter)
â”‚   â”‚   â”œâ”€â”€ rag.ts             (embed, store, query)
â”‚   â”‚   â”œâ”€â”€ whisper.ts         (transcription)
â”‚   â”‚   â””â”€â”€ types.ts           (ALL shared TypeScript interfaces)
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useAuth.ts
â”‚   â”‚   â”œâ”€â”€ useMast.ts
â”‚   â”‚   â”œâ”€â”€ useKeel.ts
â”‚   â”‚   â”œâ”€â”€ useLog.ts
â”‚   â”‚   â”œâ”€â”€ useCompass.ts
â”‚   â”‚   â”œâ”€â”€ useCharts.ts
â”‚   â”‚   â”œâ”€â”€ useVictories.ts
â”‚   â”‚   â”œâ”€â”€ useWheel.ts
â”‚   â”‚   â”œâ”€â”€ useCrew.ts
â”‚   â”‚   â”œâ”€â”€ useSphere.ts
â”‚   â”‚   â”œâ”€â”€ useFirstMate.ts
â”‚   â”‚   â”œâ”€â”€ useManifest.ts
â”‚   â”‚   â”œâ”€â”€ useRigging.ts
â”‚   â”‚   â”œâ”€â”€ useLists.ts
â”‚   â”‚   â”œâ”€â”€ useMeetings.ts
â”‚   â”‚   â”œâ”€â”€ useReminders.ts
â”‚   â”‚   â””â”€â”€ useAI.ts
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ shared/            (buttons, cards, inputs, modals, tooltips)
â”‚   â”‚   â”œâ”€â”€ navigation/        (bottom bar, sidebar, routing)
â”‚   â”‚   â”œâ”€â”€ helm/              (chat UI, message bubbles, voice input, drawer)
â”‚   â”‚   â”œâ”€â”€ log/               (entry, entry list, tags, routing selector)
â”‚   â”‚   â”œâ”€â”€ compass/           (task list, view toggles, task item, task breaker, hover descriptions)
â”‚   â”‚   â”œâ”€â”€ charts/            (graphs, streaks, trackers)
â”‚   â”‚   â”œâ”€â”€ crowsnest/         (dashboard cards, summary widgets)
â”‚   â”‚   â”œâ”€â”€ mast/              (principle cards, declaration editor)
â”‚   â”‚   â”œâ”€â”€ keel/              (personality display, flexible input)
â”‚   â”‚   â”œâ”€â”€ firstmate/         (spouse profile, nudges, spouse questions)
â”‚   â”‚   â”œâ”€â”€ crew/              (people list, person card, mentor notes, category view)
â”‚   â”‚   â”œâ”€â”€ sphere/            (concentric circles visualization, drag/tap)
â”‚   â”‚   â”œâ”€â”€ safeharbor/        (entry, resource display)
â”‚   â”‚   â”œâ”€â”€ victories/         (victory list, celebration, filters)
â”‚   â”‚   â”œâ”€â”€ reveille/          (morning card)
â”‚   â”‚   â”œâ”€â”€ reckoning/         (evening card, tomorrow prep)
â”‚   â”‚   â”œâ”€â”€ wheel/             (wheel page, spoke display, rim checkin)
â”‚   â”‚   â”œâ”€â”€ manifest/          (upload, intake flow, file list)
â”‚   â”‚   â”œâ”€â”€ rigging/           (plan view, framework selectors, milestone display)
â”‚   â”‚   â”œâ”€â”€ lists/             (list CRUD, share UI)
â”‚   â”‚   â”œâ”€â”€ meetings/          (templates, agenda, scheduling)
â”‚   â”‚   â”œâ”€â”€ lifeinventory/     (assessment, area ratings, gap display)
â”‚   â”‚   â””â”€â”€ settings/          (all settings panels)
â”‚   â””â”€â”€ pages/
â”‚       â”œâ”€â”€ CrowsNest.tsx
â”‚       â”œâ”€â”€ Compass.tsx
â”‚       â”œâ”€â”€ Helm.tsx
â”‚       â”œâ”€â”€ Log.tsx
â”‚       â”œâ”€â”€ Mast.tsx
â”‚       â”œâ”€â”€ Keel.tsx
â”‚       â”œâ”€â”€ Wheel.tsx
â”‚       â”œâ”€â”€ LifeInventory.tsx
â”‚       â”œâ”€â”€ Rigging.tsx
â”‚       â”œâ”€â”€ FirstMate.tsx
â”‚       â”œâ”€â”€ Crew.tsx
â”‚       â”œâ”€â”€ Charts.tsx
â”‚       â”œâ”€â”€ Victories.tsx
â”‚       â”œâ”€â”€ SafeHarbor.tsx
â”‚       â”œâ”€â”€ Manifest.tsx
â”‚       â”œâ”€â”€ Lists.tsx
â”‚       â”œâ”€â”€ Settings.tsx
â”‚       â”œâ”€â”€ Onboarding.tsx
â”‚       â””â”€â”€ Auth.tsx
â”œâ”€â”€ supabase/
â”‚   â”œâ”€â”€ migrations/
â”‚   â””â”€â”€ functions/
â”œâ”€â”€ CLAUDE.md
â”œâ”€â”€ package.json
â”œâ”€â”€ vite.config.ts
â”œâ”€â”€ tsconfig.json
â””â”€â”€ README.md
```

---

## Individual PRD Index

| PRD | Status |
|-----|--------|
| PRD-01: Auth & User Setup | Built |
| PRD-02: The Mast | In Development |
| PRD-03: The Keel | In Development |
| PRD-04: The Helm (Drawer + Full Page) | PRD Written |
| PRD-05: The Log (Commonplace Book) | PRD Written |
| PRD-06: The Compass + Task Breaker + Lists | PRD Written |
| PRD-07: Charts | PRD Written |
| PRD-08: Victory Recorder | PRD Written |
| PRD-09: Crow’s Nest | PRD Written |
| PRD-10: Reveille + Reckoning | PRD Written |
| PRD-11: The Wheel + Life Inventory | PRD Written |
| PRD-12: First Mate (incl. Spouse Questions) | PRD Written |
| PRD-13: Crew + Sphere of Influence | PRD Written |
| PRD-14: Safe Harbor | PRD Written |
| PRD-15: The Manifest | PRD Written |
| PRD-16: Rigging (Planning Tool) | PRD Written |
| PRD-17: Meeting Frameworks | PRD Written |
| PRD-18: Reminders + Rhythms | PRD Written |
| PRD-19: Settings | PRD Written |

---

*End of System Overview PRD v2*
