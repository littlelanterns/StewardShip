# PRD-22: Priorities + Straight Line Leadership Integration + Bulk Add & AI Sort

## Overview

This PRD covers three tightly integrated systems that share a common philosophy: **capture messy, organize smart, act clear.**

- **Priorities** — A 4-tier commitment management system in Rigging, informed by Straight Line Leadership's distinction between interests, involvements, and commitments. Shows as a summary card on the Crow's Nest.
- **SLL Integration** — Straight Line Leadership principles woven into the Helm's AI behavior with teach-on-first-use introduction and tappable term refreshers. Same language for all users; explanations when new.
- **Bulk Add + AI Sort** — A universal "paste messy text, AI sorts it" pattern applied across all identity features (Mast, Keel, First Mate, Crew Notes), action features (Compass Tasks, Rigging Milestones, Victory Recorder), and the new Priorities system.

These three systems are specified together because they share infrastructure (AI parsing, framework context, the same teach-on-first-use tracking) and because the Priorities feature only makes sense with both SLL's philosophical framework and Bulk Add's input method.

### Design Principles

- **Messy input is always less intimidating than perfect entry.** A braindump into a text box should always be an option alongside structured forms.
- **AI sorts, human confirms.** The AI suggests categories and tiers; the user reviews, edits, and approves before anything is saved.
- **Teach when relevant, not before.** SLL concepts are introduced the first time they're useful in conversation, not in an onboarding lecture.
- **Same language, all ages.** Teens get the same vocabulary as adults. Concepts are explained when new, then shorthand after.
- **5–7 real commitments.** The Priorities system enforces Djukich's insight that humans can carry 5–7 authentic commitments. Everything else is parked.

---

## Part 1: Priorities Feature

### Overview

Priorities lives in Rigging and answers the question: **"What am I actually committed to accomplishing right now?"** It implements Djukich's 4-Step Priority Filter and 5–7 Commitment Rule as a structured system with four tiers.

### User Stories

- As a user, I want to distinguish between things I'm interested in and things I'm committed to, so I stop confusing the two.
- As a user, I want to see only my active 5–7 commitments on my dashboard so I stay focused.
- As a user, I want to paste a sprint plan and have the AI sort it into commitment tiers so I don't have to manually categorize everything.
- As a user, I want to be prompted when a commitment is achieved so I can promote the next priority from my queue.
- As a user, I want the AI to reference my active commitments when giving advice so its guidance is aligned with what I'm actually up to.

### The Four Tiers

#### Tier 1: Interested In

Captured ideas and aspirations that have not become commitments. Visible in the Priorities view within Rigging but explicitly flagged as "interest only." They do NOT appear on the Crow's Nest. As Djukich writes: people don't do much about what they're merely interested in. Parking interests here is honest, not dismissive — it acknowledges them without pretending they're commitments.

#### Tier 2: Committed To — Later

Real commitments with a future activation date or that are waiting for capacity. These are genuine "I will do this" items that aren't yet in the active queue. They may have defined scope and timelines. When capacity opens up in Tier 3, the system prompts the user to consider promoting from this tier.

#### Tier 3: Committed To — Now (Active)

**Maximum 5–7 items.** These are the ONLY priorities that appear on the Crow's Nest card. They represent what the user is actively giving their best energy to right now. The AI references these in every relevant conversation. Each active commitment can optionally link to a Rigging plan, a Goal, or a Wheel.

#### Tier 4: Achieved / Rotated

Completed or deprioritized commitments that move to history. When an item is marked achieved, the system prompts: "You have a slot open. Is anything ready to move from committed-later to committed-now?" Achieved items can optionally trigger a Victory record.

### Screens

#### Screen 1: Priorities View (within Rigging)

Accessible from the Rigging page as a tab or section alongside plans. Shows all four tiers as collapsible groups with counts. Active commitments (Tier 3) are displayed prominently at the top.

Each priority shows: title, optional description, tier badge, linked plan/goal/wheel (if any), created date, and drag handle for reordering within tier.

**Interactions:** Tap to expand/edit. Drag to reorder within tier. Swipe or button to move between tiers. "+ Add Priority" button opens the add flow (single or bulk). "Mark Achieved" button on active items.

#### Screen 2: Crow's Nest Card

A single card titled "Current Commitments" showing only Tier 3 items. Displays each commitment's title. Optional progress indicator if linked to a goal with measurable progress. Tapping the card navigates to the full Priorities view in Rigging. Card only appears when Tier 3 has items.

#### Screen 3: Add Priority

Two paths: "Write it myself" (single entry form with title, description, tier selector) and "Bulk Add" (paste text, AI sorts into tiers). Both paths lead to the review screen before saving.

#### Screen 4: Promotion Prompt

When a Tier 3 item is achieved and the count drops below 5, a prompt appears: *"You have capacity for another active commitment. Here's what's waiting in your committed-later queue:"* User can promote one, skip, or dismiss.

### AI Context Integration

Active commitments (Tier 3) are included in the Helm system prompt alongside Mast entries:

```
ACTIVE COMMITMENTS (Priorities — Committed Now):
1. [commitment title]
2. [commitment title]
...
```

The AI uses these to provide contextual guidance. When the user discusses spending time on something, the AI can ask (using SLL language): "Is that a necessary required action for one of your commitments? Or is this a surface action?"

---

## Part 2: Straight Line Leadership Integration

### Overview

SLL principles are woven into the Helm's AI behavior as **Level 2: Bake in with teach-on-first-use.** The AI uses SLL distinctions naturally when relevant. Each distinction is introduced with context the first time a user encounters it. After introduction, the AI uses shorthand. Users can request refreshers at any time.

### Teach-on-First-Use Behavior

The system tracks which SLL distinctions each user has encountered via the `sll_exposures` field on `user_profiles`. On first use, the AI weaves in a brief natural explanation. On subsequent uses, it uses the shorthand term.

**Example: First Encounter**

> User: "I keep saying I'm going to start exercising but I never do."
>
> AI: "It sounds like exercising is something you think you *should* do, but it hasn't become a *must* yet. There's a real difference — 'shoulds' carry guilt but rarely lead to action. 'Musts' are things you've decided are happening, period. What would make this shift from should to must for you?"

**Example: Subsequent Use**

> AI: "Is that a should or a must?"

### Tappable Term Refresher

When the AI uses an SLL term in a response, the term is rendered as a **tappable element** in the chat UI. Tapping opens a brief inline card explaining the distinction with an example relevant to the user's context. This is not a tooltip — it's a small expandable section below the term.

**Implementation:** SLL terms in AI responses are wrapped in a special marker (e.g., `[[sll:should_vs_must]]`) that the chat renderer converts to a tappable component. Each marker maps to a distinction definition stored client-side.

### Distinction Library

The following SLL distinctions are integrated into the AI's vocabulary. Each has a key, a short definition, and contextual triggers for when the AI should use it:

| Key | Definition | When AI Uses It |
|-----|-----------|-----------------|
| `should_vs_must` | Shoulds drain energy; musts create action | User expresses guilt about not doing something, uses "I should" language |
| `core_vs_surface` | Core actions produce results; surface actions produce busyness | User describes busy day with no progress, or asks about priorities |
| `owner_vs_victim` | Owners create circumstances; victims are created by them | User blames external factors, feels powerless |
| `wanting_vs_creating` | Wanting depletes; creating energizes | User stuck in wishing mode, not acting |
| `commitment_vs_trying` | Trying is code for "don't count on it" | User says "I'll try" or hedges on commitments |
| `commitment_vs_involvement` | 5–7 real commitments; everything else is involvement | User overwhelmed with too many things |
| `dream_vs_project` | Dreams stay in your head; projects get your hands on them | User describes aspirations without action plans |
| `stop_stopping` | Slow is fine; stopping is the problem | User reports breaking a streak or quitting a habit |
| `worry_vs_concern` | Worry is passive; concern is active | User spiraling in anxiety without action |
| `corrective_vs_protective` | Course corrections get you there; protecting ego keeps you off course | User defensive about a failure or mistake |
| `purpose_management` | Know your purpose and you solve time management forever | User reports "not enough time" issues |
| `now_vs_later` | Later is code for never | User postponing important actions |
| `focus_vs_spray` | Winners focus; losers spray | User scattered across many things |
| `playing_to_win` | Playing to win vs. playing not to lose | User being overly cautious, not taking growth risks |
| `positive_no` | A positive no creates time by protecting your commitments | User overcommitting, saying yes to everything |
| `discomfort_vs_chaos` | Keep discomfort at discomfort; never escalate to chaos | User catastrophizing a setback |
| `productivity_vs_busyness` | Productivity does what matters; busyness puts on a show | User confusing activity with accomplishment |
| `kind_vs_nice` | Kind is truthful; nice is protecting your own feelings | User avoiding a difficult conversation |
| `agreements_vs_expectations` | Agreements are explicit; expectations are silent resentments | Relationship discussions, spouse/family tensions |
| `radical_self_honesty` | The easier you are on yourself, the harder life is on you | User rationalizing or minimizing a pattern |

### AI Language Patterns by Context

#### Reveille (Morning)

- "Here are your current commitments. What's the most necessary required action for today?"
- "What inner stance will you choose to operate from today?"

#### Reckoning (Evening)

- "Where did you operate from ownership today?"
- "Was there a moment where you said yes to something that should have been a positive no?"
- "Did you stay on the straight line, or did you zigzag? No judgment — just awareness."

#### When User Is Stuck

- "What's the most powerful action you can take right now?"
- "Is this a problem, or a decision to make? If you know the cause, you just need to decide."

#### When User Reports Failure

- "Any ship on a journey is off course most of the time. The corrections are what get you there. What correction does this call for?"
- "The past doesn't predict your future. The stance you're taking right now does. What stance do you want to operate from here?"

#### When Helping Set Priorities (Rigging)

- "Is this something you're interested in, or something you're committed to? There's a big difference."
- "You can carry about 5–7 real commitments at once. Which of these are your commitments for right now?"

#### Relationship Context (First Mate/Crew)

- "Do you have an agreement about that, or is it an expectation? Agreements are explicit — expectations are silent resentments waiting to happen."

### Framework Architecture (Future-Ready)

SLL language is stored in a separable prompt layer, not hardcoded into components:

- **`sll_exposures`** — JSONB field on `user_profiles` tracking which distinctions each user has encountered, with timestamps.
- **Framework prompt snippets** — A library of SLL language patterns loaded into the Helm system prompt. Currently SLL is the only framework; the architecture supports adding 7 Habits, Atomic Habits, GTD, etc. later.
- **Distinction definitions** — Client-side JSON mapping distinction keys to definitions and examples for the tappable refresher UI.

---

## Part 3: Bulk Add + AI Sort System

### Overview

A universal **"paste messy text → AI parses → review → save"** pattern applied to every feature that accepts text entry. The core insight: putting in a messy braindump is almost always less intimidating than figuring out the ideal wording and correct category first.

### The Universal Flow

1. User taps "Bulk Add" (or "Paste & Sort") on any supported feature.
2. Input screen: large textarea with placeholder text appropriate to the feature. Accepts paste, typed text, or content from voice transcription.
3. User taps "Sort This" — AI parses the text into individual items and suggests the category/tier/type for each.
4. Review screen: parsed items shown as editable cards. Each card shows the item text (editable), suggested category (changeable via dropdown), and a checkbox (selected by default). User can edit text, change categories, deselect items, reorder, and delete.
5. User taps "Save Selected" — items are created in the database with proper metadata and sort_order.

### Shared Component: BulkAddWithAISort

A single React component configured per feature via props. Already-built patterns in `BulkAddItems` (Lists) and `BulkAddCrew` (Crew) inform the design. The shared component handles: textarea input with placeholder, AI parsing call with feature-specific prompt, review/edit UI with category dropdowns, select/deselect per item, reorder capability, and save callback.

**Feature-specific configuration via props:**

- **`categories`** — The valid categories/types for this feature (e.g., Mast types, Keel categories, Priority tiers)
- **`categoryLabels`** — Display labels for each category
- **`parsePrompt`** — Feature-specific AI prompt for parsing (what to extract, how to categorize)
- **`onSave`** — Callback that receives the confirmed items and persists them to the correct table
- **`placeholder`** — Textarea placeholder text appropriate to the feature

### Feature-Specific Configurations

| Feature | Sort Categories | Placeholder Text | Special Behavior |
|---------|----------------|-----------------|-----------------|
| **The Mast** | Values, Declarations, Faith Foundations, Scriptures & Quotes, Vision | "Paste principles, beliefs, vision statements..." | Also suggests optional freeform category (Marriage, Work, etc.) |
| **The Keel** | Personality, Traits, Strengths, Growth Areas, You Inc., General | "Paste self-observations, test results, personality notes..." | Also suggests source label (self-observed, therapist, etc.) |
| **First Mate** | Communication, Love Language, Preferences, History, Strengths, Growth, General | "Paste things you've learned about your partner..." | Also suggests source label |
| **Crew Notes** | Personality, Interests, Challenges, Growth, Observations, General | "Paste observations about this person..." | Scoped to a specific crew member |
| **Compass Tasks** | N/A (flat list) | "Paste a messy to-do list, brain dump of tasks..." | AI parses into individual tasks, auto-suggests life area tags and due dates |
| **Priorities** | Interested In, Committed Later, Committed Now | "Paste goals, aspirations, sprint plans..." | AI uses SLL 4-step filter to sort. Enforces 5–7 max for Committed Now. |
| **Rigging** | Milestones (ordered) | "Paste a project plan, sprint plan, or goal breakdown..." | AI structures into milestones with target dates. Offers to break milestones into tasks via Task Breaker. |
| **Victories** | N/A (flat list with life area tag) | "Paste your wins this week, achievements to record..." | AI parses into individual victories, suggests life area tags |

### Input Methods

#### 1. Paste Text (Primary)

User pastes or types directly into the textarea. Accepts any format: one per line, comma-separated, numbered lists, freeform paragraphs, or a mix. The AI handles parsing regardless of input structure.

#### 2. Voice Dictation

User taps microphone icon on the bulk add textarea. Voice is transcribed to text (using existing Whisper integration). Transcribed text populates the textarea, then user proceeds with "Sort This."

#### 3. Hatch Integration

From The Hatch, when a user routes content to a feature that supports bulk add (Mast, Keel, etc.), the routing flow offers "Add as single item" or "Bulk sort into multiple items." Selecting bulk sort opens the feature's bulk add review screen with the Hatch content pre-parsed.

### Rigging Bulk Add: Sprint Plan Import

The most complex bulk add variant. When a user pastes a project plan or sprint plan into Rigging's bulk add, the AI:

1. Parses the text into discrete milestones (not just line items — understands hierarchical structure).
2. Suggests a sequence order for the milestones.
3. Suggests target dates based on any date references in the text or even distribution across the plan timeframe.
4. Identifies items that are tasks (too small for milestones) and groups them under the appropriate milestone.
5. Presents the structured plan for review: milestones as major items, tasks nested beneath each.
6. On save: creates the Rigging plan with milestones, and optionally creates Compass tasks linked to each milestone via Task Breaker.

For the specific use case: paste a 45-day sprint plan → AI structures it into milestones with dates → review and adjust → save as a Rigging plan with all milestones and tasks ready to go.

### AI Parsing Prompt Pattern

Each feature's AI parsing call uses a structured prompt that returns JSON. The prompt includes: the feature name and purpose, the valid categories with descriptions, the raw user text, and instructions to return an array of parsed items with suggested categories and confidence scores. The AI response is parsed client-side and displayed in the review UI.

**Fallback:** If the AI call fails, the system falls back to simple line-by-line splitting (one item per non-empty line) with the default category selected. This matches the existing pattern in BulkAddItems.

---

## Part 4: Data Schema

### New Table: `priorities`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Priority title. Cannot be empty. |
| description | TEXT | null | NULL | Optional longer description |
| tier | TEXT | | NOT NULL | Enum: 'interested', 'committed_later', 'committed_now', 'achieved' |
| sort_order | INTEGER | 0 | NOT NULL | Order within tier group |
| linked_plan_id | UUID | null | NULL | FK → rigging_plans (optional) |
| linked_goal_id | UUID | null | NULL | FK → goals (optional) |
| linked_wheel_id | UUID | null | NULL | FK → growth_cycles (optional) |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'bulk_add', 'helm_conversation', 'hatch_routed' |
| achieved_at | TIMESTAMPTZ | null | NULL | When moved to achieved tier |
| promoted_at | TIMESTAMPTZ | null | NULL | When moved to committed_now |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own priorities only.

**Indexes:**
- `user_id, tier, archived_at` (grouped display)
- `user_id` WHERE `tier = 'committed_now'` AND `archived_at IS NULL` (Crow's Nest card and AI context)

**Constraint:** Application-level enforcement of max 7 items in `committed_now` tier. Not a DB constraint — the UI prevents adding beyond 7 and the AI respects the limit.

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON priorities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### Modified Table: `user_profiles`

Add column:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| sll_exposures | JSONB | '{}' | Map of distinction_key → {first_seen: timestamp, count: number}. Tracks which SLL distinctions this user has been introduced to. |

### No Changes Required for Bulk Add

The bulk add system does not require new tables. It writes to existing tables (`mast_entries`, `keel_entries`, `spouse_insights`, `crew_notes`, `compass_tasks`, `rigging_plan_milestones`, `victories`) using existing schemas. The `source` field on each table tracks that the entry came from bulk add.

---

## Part 5: Cross-Feature Connections

### Priorities

- **→ Crow's Nest:** Summary card showing Tier 3 (Committed Now) items.
- **→ Helm AI Context:** Active commitments included in system prompt for every conversation.
- **→ Reveille:** "Here are your current commitments" section in morning briefing.
- **→ Reckoning:** "Which of your commitments did you advance today?"
- **← Rigging Plans:** Plans can link to priorities. Completing a plan can mark a priority achieved.
- **← Goals:** Goals can link to priorities. Goal completion can mark a priority achieved.
- **← Victory Recorder:** Achieving a priority can trigger a victory suggestion.

### SLL Integration

- **Helm:** All SLL language patterns live in the Helm system prompt. Exposure tracking informs whether to explain or use shorthand.
- **Chat UI:** Tappable SLL terms rendered as interactive elements in chat messages.
- **Reveille/Reckoning:** SLL-informed prompts woven into daily rhythm questions.
- **Rigging:** SLL's dream-vs-project and commitment distinctions used in planning conversations.
- **Safe Harbor:** Worry-vs-concern and discomfort-vs-chaos distinctions in crisis support.

### Bulk Add

- **Every identity feature:** Mast, Keel, First Mate, Crew Notes get a "Bulk Add" button alongside existing "Write it myself" and "Craft at Helm."
- **Compass:** Quick-add bar gains a "Paste multiple" option.
- **Rigging:** "Import plan" option on new plan creation alongside AI-guided and manual.
- **Victories:** "Record multiple" option alongside single victory entry.
- **Hatch:** When routing to a bulk-add-supported feature, option to "Bulk sort into multiple items."

---

## Part 6: Build Order & Dependencies

### Phase A: Foundation

- **A1: BulkAddWithAISort shared component** — The core component with textarea, AI parsing, review UI. Configurable via props. Builds on patterns from BulkAddItems and BulkAddCrew.
- **A2: SLL distinction definitions** — Client-side JSON with all distinction keys, definitions, and examples. Used by tappable term UI.
- **A3: `sll_exposures` field on `user_profiles`** — Migration to add JSONB column.

### Phase B: Bulk Add Rollout

- **B1: Mast bulk add** — Wire BulkAddWithAISort into MastAddModal as a third option alongside "Write it myself" and "Craft at Helm."
- **B2: Keel bulk add** — Same pattern for KeelAddModal.
- **B3: First Mate bulk add** — Same pattern for AddInsightModal.
- **B4: Crew Notes bulk add** — Same pattern for AddCrewNoteModal.
- **B5: Compass Tasks bulk add** — "Paste multiple" option on task creation.
- **B6: Victory bulk add** — "Record multiple" option on victory entry.

### Phase C: Priorities

- **C1: `priorities` table migration** — Create table with RLS.
- **C2: Priorities UI** — View within Rigging page, 4-tier display, add/edit/move/achieve flows.
- **C3: Priorities bulk add** — Wire BulkAddWithAISort with SLL 4-tier sorting.
- **C4: Crow's Nest card** — "Current Commitments" card showing Tier 3.
- **C5: Promotion prompt** — Flow when achieving a Tier 3 item.

### Phase D: SLL AI Integration

- **D1: Helm system prompt update** — Add SLL framework snippets, active commitments context, exposure-aware introduction logic.
- **D2: Tappable term UI** — Chat renderer detects SLL markers and renders interactive elements.
- **D3: Reveille/Reckoning SLL prompts** — Integrate SLL language into daily rhythm questions.
- **D4: Priorities AI context** — Active commitments loaded into Helm context.

### Phase E: Rigging Sprint Import

- **E1: Rigging bulk add** — "Import Plan" option that accepts pasted project/sprint plans.
- **E2: Milestone + Task generation** — AI structures input into milestones and nested tasks.
- **E3: Hatch bulk routing** — When routing from Hatch to bulk-add-supported features, offer "Bulk sort into multiple items."

---

## Part 7: What "Done" Looks Like

### MVP

- [ ] Priorities view in Rigging with 4 tiers, add/edit/move/achieve flows.
- [ ] 5–7 active commitment cap enforced in UI.
- [ ] Crow's Nest "Current Commitments" card.
- [ ] Promotion prompt when a Tier 3 item is achieved.
- [ ] BulkAddWithAISort component working on: Mast, Keel, First Mate, Crew Notes, Compass Tasks, Priorities, Victories.
- [ ] SLL distinctions in Helm system prompt with teach-on-first-use behavior.
- [ ] `sll_exposures` tracking per user.
- [ ] Tappable SLL terms in chat UI with refresher cards.
- [ ] Active commitments included in Helm AI context.

### MVP When Dependency Is Ready

- [ ] Rigging sprint plan import (requires Rigging milestones + Task Breaker to be stable).
- [ ] Hatch bulk routing integration (requires Hatch routing to be stable).
- [ ] Reveille/Reckoning SLL prompts (requires Reveille/Reckoning to be stable).
- [ ] Voice dictation on bulk add textarea (requires Whisper integration to be stable).

### Post-MVP

- [ ] Framework selector for MyAIM merge (add 7 Habits, Atomic Habits, GTD alongside SLL).
- [ ] Priority auto-achievement when linked plan/goal completes.
- [ ] SLL distinction analytics (which distinctions resonate most with each user).
- [ ] AI-suggested priority promotions based on progress patterns.

---

## Edge Cases

### User Tries to Add More Than 7 Active Commitments
- UI prevents it. Button to add to Tier 3 is disabled when count = 7.
- AI explains: "You're at capacity with 7 active commitments. Would you like to add this to your committed-later queue, or achieve one of your current commitments to make room?"

### User Has No Priorities Set
- Crow's Nest card doesn't appear (no empty state card).
- AI may periodically suggest: "I notice you haven't set any priorities yet. Knowing what you're committed to right now helps me give you better guidance. Want to set some up?" Maximum once per week, same pattern as empty Mast.

### Bulk Add Returns Poor AI Results
- User can always edit every parsed item — change text, change category, deselect.
- If AI parsing completely fails, fallback to line-by-line split with default category.
- "Re-sort" button to re-run AI parsing after user edits the raw text.

### SLL Term Used but User Has Seen It Before
- AI checks `sll_exposures` and uses shorthand.
- If the shorthand feels abrupt in context, the AI may briefly remind: "Remember the distinction between core and surface actions? What you're describing sounds like..."

### Sprint Plan Paste Is Very Long
- AI parsing handles up to ~4000 words of input (model context limit).
- For longer plans, the system suggests splitting into phases: "This is a big plan. Want to import it in sections? I can handle one phase at a time."

---

## CLAUDE.md Additions from This PRD

- [ ] Priorities: 4-tier system (interested, committed_later, committed_now, achieved). Max 5–7 in committed_now. Lives in Rigging, card on Crow's Nest. Active commitments always loaded in AI context.
- [ ] SLL Integration: Teach-on-first-use with `sll_exposures` tracking. Tappable terms in chat. Framework prompt snippets in Helm system prompt. Same language for all ages.
- [ ] Bulk Add: `BulkAddWithAISort` shared component. Available on Mast, Keel, First Mate, Crew Notes, Compass Tasks, Priorities, Rigging (sprint import), Victories. Fallback to line-by-line split if AI fails.
- [ ] Convention: `source = 'bulk_add'` on all entries created via bulk add flow.
- [ ] Convention: SLL distinction keys use snake_case (e.g., `should_vs_must`, `core_vs_surface`).

---

## DATABASE_SCHEMA Additions from This PRD

Tables added:
- `priorities` — 4-tier commitment tracking with linked plans/goals/wheels, tier management, achievement tracking

Columns added:
- `user_profiles.sll_exposures` — JSONB tracking SLL distinction exposure per user

Update "Tables Not Yet Defined" section:
- ~~priorities | PRD-22~~ → DONE

Update Foreign Key map:
- auth.users → priorities
- priorities → rigging_plans (linked_plan_id)
- priorities → goals (linked_goal_id)
- priorities → growth_cycles (linked_wheel_id)

---

*End of PRD-22*
