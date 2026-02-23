# PRD-20: Unload the Hold

## Overview

Unload the Hold is a Helm-based brain dump feature that lets users pour out unstructured thoughts in a guided conversation, with the AI adaptively listening and — when it seems genuinely helpful — offering to ask clarifying questions before sorting everything into actionable items routed to the appropriate StewardShip features.

**Nautical metaphor:** The hold is the cargo area below deck where everything accumulates during a voyage — provisions, cargo, supplies, things picked up along the way. Unloading the hold is the deliberate act of bringing everything up on deck, sorting it, and putting each item where it belongs. In StewardShip, mental cargo accumulates — tasks, worries, observations, reminders, ideas — and Unload the Hold processes it all.

**Core principle:** The user's only job is to get it all out. The AI listens, helps the user feel heard and complete, then sorts. The user reviews and confirms before anything is routed. Nothing happens silently.

---

## User Stories

- As a user, I want to dump everything on my mind in a conversation so I can talk through the mess rather than just type into a void.
- As a user, I want the AI to read the room — just listening when I'm rattling off tasks, but offering to ask clarifying questions when things are tangled or emotional.
- As a user, I want the AI to sort my brain dump into categories (tasks, journal entries, insights, reminders, people notes) so I can review and route them in one batch.
- As a user, I want a structured review screen where I can adjust the AI's sorting before confirming.
- As a user, I want to access the brain dump from anywhere in the app so I can use it whenever mental clutter builds up.

---

## Entry Point

Unload the Hold is a **global action** that opens a Helm conversation in guided mode. Accessible from:

1. **Floating Action Button (FAB) menu** — on pages that have a FAB (Compass, Log, Crow's Nest), long-press or expand the FAB to reveal "Unload the Hold" as an option alongside the primary action
2. **Navigation "More" menu** — listed alongside other features
3. **The Helm** — AI can suggest it when it detects the user is overwhelmed or listing multiple unrelated things: "Sounds like you've got a lot swirling around. Want to unload the hold?"

Opening Unload the Hold creates a new Helm conversation with `guided_mode = 'unload_the_hold'`.

---

## Conversation Flow

### Phase 1: The Dump (Conversational)

The AI opens the conversation:

> "Let's get it all out. Tell me everything that's on your mind — tasks, worries, ideas, things you need to remember, stuff that's been bugging you. Don't worry about organizing it. I'll sort through it when you're ready."

**AI behavior during the dump:**

- **Default posture: listen.** The AI's primary job is to receive, not direct. Short acknowledgments between messages: "Got it." / "Keep going." / "What else?" / "I'm tracking all of this."
- **Never interrupt a flow.** If the user sends multiple messages in quick succession, the AI does NOT interject between them. It waits until there's a natural pause.
- **Adaptive engagement — read the room.** The AI calibrates its involvement based on the nature of the dump:
  - **Straightforward dumps** (task lists, errands, concrete items): Just receive. Minimal acknowledgments. Don't slow the user down with questions.
  - **Messy or emotional dumps** (tangled feelings, unclear priorities, things that could be tasks OR reflections): The AI may offer to help sort through things conversationally. It doesn't assume — it asks: *"There's a lot tangled up in what you're saying about your sister. I can just file it and sort it, or if it would help, I can ask a couple questions to make sure I put things in the right place. Up to you."*
  - **Mixed dumps** (some concrete, some emotional): Receive the concrete items silently, offer light engagement on the ambiguous parts.
- **Always offer, never impose.** If the AI thinks conversation would help, it offers — the user can always say "just sort it" and the AI respects that immediately. The user stays in control of the pace.
- **Clarifying questions stay brief and specific.** Not therapy-style open questions. Good: "Is the budget thing a task for this week or more of a longer-term worry?" Not: "Tell me more about how the budget situation makes you feel."
- **Gently check for completeness.** After the user seems to slow down: "Is there anything else rattling around in there, or is that everything?" / "Take a moment — anything else before I start sorting?"
- **No unsolicited coaching during the dump.** The AI does not offer advice or apply frameworks unless the user explicitly asks. This is a dump, not a processing session. If the user wants to go deeper on something, they'll signal it.
- **The user signals they're done.** Either explicitly ("That's everything" / "I'm done" / "Sort it") or the AI detects a natural stopping point after the completeness check.

### Phase 2: The Sort (AI Processing)

Once the user signals completion, the AI responds:

> "Alright, let me sort through everything you've put on deck."

Brief processing pause (the AI calls the triage Edge Function), then presents a conversational summary:

> "Here's what I pulled from your dump — [X] items total:
>
> **Tasks (5):** Call the dentist, finish the quarterly report, pick up groceries, schedule that meeting with Tom, fix the leaky faucet
>
> **Journal entries (2):** Your feelings about the conversation with your sister, the realization about how you've been handling stress
>
> **Insights (1):** You noticed that you shut down when you feel criticized — that's a Keel-worthy observation
>
> **Reminders (1):** Mom's birthday is next Thursday
>
> **List items (1):** New running shoes added to your wishlist
>
> Does this look right? I can adjust anything before we route it all. Or tap 'Review & Route' to see the full breakdown and make changes there."

The AI presents this as a natural conversation message — warm, organized, but not clinical. It's a summary, not a spreadsheet.

### Phase 3: The Triage (Structured UI)

A **"Review & Route" button** appears below the AI's summary message (similar to how "Save to Log" or "Create Task" action buttons work on Helm messages). Tapping it opens the structured triage screen (see Screen section below).

The user can also continue the conversation before opening the triage screen:
- "Actually, move the dentist thing to a reminder instead of a task"
- "I forgot one more thing — I need to email the landlord"
- "That thing about my sister isn't really journal-worthy, just discard it"

The AI updates its triage accordingly. When the user is satisfied, they tap "Review & Route" to open the structured screen for final confirmation.

### Phase 4: Routing & Confirmation

After the user confirms routing on the triage screen, they return to the Helm conversation where the AI closes warmly:

> "All sorted — 5 tasks in your Compass, 2 entries in your Log, 1 insight in your Keel, and a reminder set for your mom's birthday. The hold is clear. How do you feel?"

This gentle check-in gives the user a chance to process the experience. The conversation can continue naturally from here if they want, or they can close it.

---

## Screens

### Screen 1: The Triage Review

Opened from the "Review & Route" button in the Helm conversation. Full-screen modal that overlays the Helm (user can dismiss to return to conversation).

**Header:**
- "Unload the Hold — Review"
- "[X] items to route"

**Each extracted item shows:**
- The extracted text (cleaned up / clarified from the raw dump)
- **Category badge** (tappable to change destination):
  - **Task** → routes to Compass
  - **Journal** → routes to Log
  - **Insight** → routes to Keel
  - **Principle** → routes to Mast
  - **Person Note** → routes to Crew (stub until Crew is built)
  - **Reminder** → routes to Reminders (stub until Reminders is built)
  - **List Item** → routes to Lists (user picks which list)
  - **Discard** → skip this item
- **Editable text** → user can tap to edit before routing
- **Swipe to discard** or tap the discard icon

**Additional metadata (shown as optional editable chips):**
- For Tasks: suggested life area tag, suggested due date ("today", "this week", "no date")
- For Journal entries: suggested entry type (reflection, quick_note, gratitude)
- For Insights: suggested Keel category
- For Principles: suggested Mast entry type (value, declaration, vision)
- For List Items: suggested list (or "New List")
- For Person Notes: matched person name from Crew (or "Unknown person")
- For Reminders: suggested date/trigger

**Bottom actions:**
- **"Route all" button** (primary) — confirms and routes all non-discarded items to their destinations in batch
- **"Back to conversation"** — returns to Helm to continue discussing
- Item count: "Routing X items · Discarding Y"

---

## Guided Mode Specification

### Helm Integration

Unload the Hold is implemented as a Helm guided mode:

- `guided_mode = 'unload_the_hold'`
- `guided_mode_reference_id` = null initially (no pre-existing entity)
- After triage is generated, `guided_mode_reference_id` updates to point to the `bilge_dumps.id` record

### System Prompt Addition for Guided Mode

Add to `systemPrompt.ts` `getGuidedModeInstructions()`:

```
case 'unload_the_hold':
  return `\n\nGUIDED MODE: UNLOAD THE HOLD (Brain Dump)
You are helping the user dump everything on their mind. Your role:

PHASE 1 — THE DUMP:
- Your primary job is to LISTEN. Let the user pour it all out.
- Give very short acknowledgments: "Got it." / "Keep going." / "What else?"
- Do NOT interrupt their flow. If they send multiple messages quickly, wait.
- READ THE ROOM and adapt your engagement level:
  - Straightforward dumps (task lists, errands, concrete items): Just receive. Minimal acknowledgments. Don't slow them down.
  - Messy or emotional dumps (tangled feelings, unclear priorities, ambiguous items): You may OFFER to ask clarifying questions. Always offer, never impose: "There's a lot tangled up here. I can just sort it all, or I can ask a couple questions to make sure things land in the right place. Up to you."
  - Mixed dumps: Receive the concrete stuff silently, offer engagement on the ambiguous parts.
- If the user says "just sort it" or signals they want you to just listen, respect that immediately.
- Keep clarifying questions brief and specific: "Is the budget thing a task or more of a worry?" NOT "Tell me more about how that makes you feel."
- Do NOT coach, advise, or apply frameworks during the dump. No unsolicited wisdom.
- After the user slows down, gently check: "Anything else, or is that everything?"
- When the user signals they're done, move to Phase 2.

PHASE 2 — THE SORT:
- Say "Let me sort through everything you've put on deck." then call the triage function.
- Present a warm, conversational summary of extracted items grouped by category.
- Show counts per category and list key items by name.
- Ask if the summary looks right. Offer to adjust anything.
- Include the "Review & Route" action for the structured triage screen.
- If the user wants to adjust in conversation, update the triage and re-present.

PHASE 3 — AFTER ROUTING:
- Confirm what was routed where with brief counts.
- Gentle check-in: "The hold is clear. How do you feel?"
- Conversation can continue naturally from here.

RULES:
- Never guilt the user about the volume of their dump. More is better.
- Never prioritize for the user unless they ask. Sorting is your job, prioritizing is theirs.
- If something feels heavy (grief, anxiety, relationship pain), acknowledge it warmly before categorizing.
- "Journal" is the merciful default — if unsure, suggest journal rather than discard.`;
```

### Context Loading

When the Helm is in `unload_the_hold` mode, the context loader should include:
- **Mast entries** (always loaded anyway) — helps identify principles
- **Active Compass tasks** — helps AI avoid suggesting duplicate tasks
- **Keel categories** — helps categorize insights
- **People names from Crew** (lightweight query) — helps match person_note items

This is the same context loading pattern as other guided modes, just with a broader scope since the dump could touch any life area.

---

## AI Behavior

### The Triage Extraction

When the user signals they're done dumping, the Helm calls the **`unload-the-hold` Edge Function** with:

1. The full conversation transcript (user messages only, or user + AI for context)
2. Optional context (Mast, active tasks, Keel categories, people names)
3. The specialized extraction prompt

### Edge Function: `unload-the-hold`

**Pattern:** Same as `chat` and `auto-tag` — CORS, user API key resolution, OpenRouter.

**Input:**
```typescript
{
  conversation_text: string;   // The dump content (user messages concatenated, or full transcript)
  user_id: string;
  context?: {
    mast_entries?: string;
    active_tasks?: string[];   // Current task titles for dedup awareness
    keel_categories?: string;
    people_names?: string[];
  };
}
```

**System Prompt for Extraction:**
```
You are processing a brain dump conversation from a user of StewardShip, a personal growth app. The user has poured out unstructured thoughts across multiple messages. Your job is to extract individual actionable items and categorize each one.

For each item, determine the best destination:
- "task": Something the user needs to DO. An action, errand, commitment, or to-do.
- "journal": A reflection, feeling, observation, or experience worth recording. Not actionable.
- "insight": A self-discovery — something the user learned about themselves, a pattern they noticed, a strength or growth area.
- "principle": A value, declaration, or guiding belief the user is articulating.
- "person_note": Information about a specific person in the user's life — an observation, need, or context about someone.
- "reminder": Something time-sensitive the user wants to remember. Has a specific date/time or trigger.
- "list_item": An item that belongs on a list (shopping, wishlist, etc.) — not a task.
- "discard": Venting already resolved in the conversation, pure filler, or not meaningful to save.

Return ONLY a JSON array of objects. Each object must have:
- "text": The cleaned-up, clarified version of the extracted item (fix grammar, complete fragments, but preserve the user's voice)
- "category": One of the categories above
- "metadata": An object with optional fields depending on category:
  - For tasks: { "life_area_tag": string|null, "due_suggestion": "today"|"this_week"|"no_date"|null }
  - For journal: { "entry_type": "reflection"|"quick_note"|"gratitude"|null }
  - For insight: { "keel_category": "personality_assessment"|"trait_tendency"|"strength"|"growth_area"|"general"|null }
  - For principle: { "mast_type": "value"|"declaration"|"faith_foundation"|"scripture_quote"|"vision"|null }
  - For person_note: { "person_name": string|null }
  - For reminder: { "reminder_text": string|null }
  - For list_item: { "suggested_list": string|null }
  - For discard: {}

Be generous with extraction — if in doubt, include it as a "journal" entry rather than discarding. The user can always change the category.

Split compound thoughts into separate items when they have different destinations. For example, "I need to call mom and I've been feeling anxious about work" becomes two items: a task (call mom) and a journal entry (work anxiety).

If the user mentioned something that sounds like an existing task from their active tasks list, note it but still include it — let the user decide if it's a duplicate.
```

**Output:**
```typescript
{
  items: Array<{
    text: string;
    category: 'task' | 'journal' | 'insight' | 'principle' | 'person_note' | 'reminder' | 'list_item' | 'discard';
    metadata: {
      life_area_tag?: string;
      due_suggestion?: 'today' | 'this_week' | 'no_date';
      entry_type?: string;
      keel_category?: string;
      mast_type?: string;
      person_name?: string;
      reminder_text?: string;
      suggested_list?: string;
    };
  }>;
}
```

### Merciful Defaults

- If the AI can't determine a category, default to "journal" (save to Log). Better to capture than lose.
- Never discard something the user clearly spent effort articulating. Only "discard" for obvious filler, things already resolved in the conversation, or pure repetition.
- The AI should lean toward extracting MORE items rather than fewer. The user can discard during triage.
- If something heavy surfaced (grief, anxiety, conflict), acknowledge it in the conversation before categorizing it clinically.

---

## Data Schema

### New Table: `hold_dumps`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| conversation_id | UUID | | NOT NULL | FK → helm_conversations |
| items_extracted | INTEGER | 0 | NOT NULL | Count of items AI extracted |
| items_routed | INTEGER | 0 | NOT NULL | Count of items user confirmed |
| items_discarded | INTEGER | 0 | NOT NULL | Count of items user discarded |
| triage_result | JSONB | '[]' | NOT NULL | Full AI triage response |
| status | TEXT | 'dumping' | NOT NULL | Enum: 'dumping', 'sorting', 'triaging', 'routed', 'cancelled' |
| log_entry_id | UUID | null | NULL | FK → log_entries (archived copy saved to Log) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own dumps only.

**Indexes:**
- `user_id, created_at DESC` (history)
- `user_id, status` (active dumps)
- `conversation_id` (link to Helm conversation)

**Note:** The raw text is NOT stored separately — it lives in the `helm_messages` table as part of the conversation. The `conversation_id` links to the full conversation record. This avoids data duplication and preserves the conversational context (including AI clarifications).

### Log Entry Type Addition

Add `'brain_dump'` to the `log_entries.entry_type` enum. Archive entries use:
- `entry_type = 'brain_dump'`
- `source = 'unload_the_hold'`
- `source_reference_id` → points to `hold_dumps.id`
- Text = concatenation of user messages from the conversation (the dump content)

### Guided Mode Addition

Add `'unload_the_hold'` to the `helm_conversations.guided_mode` enum.

### Source Enum Updates

Add `'unload_the_hold'` to:
- `compass_tasks.source` enum
- `keel_entries.source_type` enum
- `mast_entries.source` enum
- `log_entries.source` enum

---

## Routing Logic

When the user confirms "Route all" on the triage screen, the app creates records in batch:

| Category | Destination | How |
|----------|-------------|-----|
| task | `compass_tasks` | Creates task with `source = 'unload_the_hold'`, `source_reference_id = hold_dumps.id`, AI-suggested `life_area_tag` and `due_date` |
| journal | `log_entries` | Creates entry with AI-suggested `entry_type`, `source = 'unload_the_hold'` |
| insight | `keel_entries` | Creates entry with AI-suggested `category`, `source_type = 'unload_the_hold'` |
| principle | `mast_entries` | Creates entry with AI-suggested `type`, `source = 'unload_the_hold'` |
| person_note | `crew_notes` | Stub: saves as Log entry with person name tag until Crew is built. When Crew exists: creates `crew_notes` record matched to person |
| reminder | `reminders` | Stub: saves as Compass task with "(reminder)" note until Reminders is built. When Reminders exists: creates reminder record |
| list_item | `list_items` | Adds item to selected list. If "New List" → creates list first |
| discard | nowhere | Item is skipped. Count tracked in `hold_dumps.items_discarded` |

**After routing:**
- `hold_dumps.status` → `'routed'`
- `hold_dumps.items_routed` and `items_discarded` updated
- Raw dump content (user messages concatenated) saved to Log as `brain_dump` entry type
- Return to Helm conversation where AI confirms what was routed

---

## What "Done" Looks Like

### MVP (Phase 4D)
- Unload the Hold opens as Helm guided mode conversation
- AI listens adaptively — receives straightforward items silently, offers clarifying questions for ambiguous or emotional content
- AI triage via dedicated Edge Function after user signals completion
- Conversational summary presented in Helm with "Review & Route" action button
- Structured triage screen with category badges, editable text, changeable categories
- Batch routing to: Compass (tasks), Log (journal entries), Keel (insights), Mast (principles), Lists (items)
- Stub routing for: Crew (person notes → saved as Log entries), Reminders (→ saved as tasks)
- Raw dump archived to Log as `brain_dump` entry type
- `hold_dumps` table tracking dump history and stats
- Accessible from FAB expansion and More menu
- RLS on all data

### MVP When Dependency Is Ready
- Person notes route to `crew_notes` (requires Phase 8: Crew)
- Reminders route to `reminders` table (requires Phase 10: Reminders)
- Voice messages in conversation (requires Whisper integration)

### Post-MVP
- AI learns user's categorization patterns over time
- Recurring "scheduled dump" — reminder to unload the hold at user-set cadence
- Dump history — view past dumps, what was routed, link to original conversation
- Mid-conversation detection: AI suggests "Want to unload the hold?" when it senses overwhelm
- Batch undo: "Undo last dump" reverses all routed items
- Priority coaching: after dump, AI can optionally help user prioritize the extracted tasks ("Of these 8 tasks, which 3 matter most this week?")

---

## CLAUDE.md Additions from This PRD

- [ ] Unload the Hold conventions: Helm guided mode brain dump, AI listens → sorts → user confirms routing
- [ ] Guided mode: `'unload_the_hold'` added to Helm guided modes
- [ ] AI behavior during dump: adaptive engagement — just listen for straightforward dumps, offer clarifying questions for messy/emotional content, never impose, always let user control the pace
- [ ] Triage categories: task, journal, insight, principle, person_note, reminder, list_item, discard
- [ ] Merciful defaults: if uncertain → journal. Never discard something with effort. Extract more rather than fewer.
- [ ] Source tracking: all routed items use `source = 'unload_the_hold'` with reference back to `hold_dumps.id`
- [ ] Raw dump archived to Log as `entry_type = 'brain_dump'`, `source = 'unload_the_hold'`
- [ ] `hold_dumps` table schema added to DATABASE_SCHEMA.md
- [ ] Source enum updates: `'unload_the_hold'` added to compass_tasks.source, keel_entries.source_type, mast_entries.source, log_entries.source
- [ ] Guided mode enum: `'unload_the_hold'` added to helm_conversations.guided_mode
- [ ] Log entry_type enum: add `'brain_dump'`
- [ ] Edge Function: `unload-the-hold` (same pattern as chat/auto-tag)
- [ ] Nautical naming: "Unload the Hold" added to naming map
- [ ] FAB expansion pattern: long-press or expand FAB to reveal secondary actions
- [ ] Conversation-to-triage flow: AI presents summary in Helm, "Review & Route" button opens structured screen

---

## Cross-Feature Rule Addition

### Rule 17: Unload the Hold Routing
When Unload the Hold routes items to their destinations, all standard rules for those destinations apply:
- Tasks created from dumps get AI auto-tagged (same as manual tasks)
- Journal entries from dumps get AI life area tags (same as manual entries)
- Insights routed to Keel follow the same category structure
- Principles routed to Mast follow declaration language rules (Rule 1) if applicable
- The user always confirms before any routing occurs — nothing is created silently
- The original conversation is preserved in the Helm and the raw dump is archived to Log

---

*End of PRD-20*
