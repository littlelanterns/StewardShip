# PRD-02: The Mast — Guiding Principles System

## Overview

The Mast is the structural center of StewardShip. Everything else in the app hangs from what the user places on their Mast. It contains core values, faith foundations, life declarations, key scriptures/principles, and vision statements. Every AI interaction references the Mast for context and alignment.

The Mast is not a static page set once and forgotten. It is a living document that the user revisits and refines, especially during quarterly Life Inventory check-ins and as they deepen their understanding of who they are becoming.

---

## User Stories

### Viewing
- As a user, I want to see all my guiding principles in one place so I can orient myself.
- As a user, I want my principles organized by type (values, declarations, scriptures, vision) so I can find what I need.

### Creating
- As a user, I want to add a new principle by typing it directly so I can capture something quickly.
- As a user, I want to craft a declaration through conversation at The Helm so the AI can help me use honest commitment language.
- As a user, I want to add a principle extracted from something I uploaded to The Manifest so my readings inform my values.

### Editing
- As a user, I want to edit any principle at any time because my understanding deepens and my language improves.
- As a user, I want to reorder my principles so the most important ones are at the top.

### Archiving
- As a user, I want to archive a principle I've outgrown without deleting it, because it was part of my journey.
- As a user, I want to view archived principles to see how my values have evolved.

### AI Integration
- As a user, I want the AI to reference my Mast naturally in conversation when it's relevant, not forced.
- As a user, I want the AI to help me refine a principle if I'm struggling with the wording.
- As a user, I want the AI to notice when my actions (from Log, Compass, Helm conversations) seem misaligned with my Mast and gently reflect that back.

---

## Screens

### Screen 1: Mast Main Page

**What the user sees:**
- Page title: "The Mast"
- Brief contextual line beneath title: "What holds everything up." (subtle, muted text, not a full paragraph)
- Principles grouped by type, each group collapsible:
  - **Values** — core character values (integrity, patience, faith, etc.)
  - **Declarations** — honest commitments about who the user is choosing to become
  - **Faith Foundations** — spiritual beliefs, key doctrines, relationship with God
  - **Scriptures & Quotes** — anchoring texts
  - **Vision** — what the user wants their life to look like
- Each principle displayed as a card with:
  - The text of the principle
  - Small type indicator tag (value, declaration, etc.)
  - Edit button (pencil icon or "Edit" text)
  - Drag handle for reordering within its group
- "Add Principle" button at the bottom of each group AND a floating action button at bottom of page
- "View Archived" link at bottom of page
- The Helm drawer is accessible from this page (pulling up loads Mast context)

**Interactions:**
- Tap a principle card → expands to show full text if truncated, plus edit/archive options
- Tap "Edit" → opens inline editor (see Screen 2)
- Long-press or drag handle → reorder within group
- Tap "Add Principle" → opens Screen 3 (add new)
- Tap "View Archived" → shows archived principles with option to restore
- Pull up Helm drawer → AI has Mast context loaded, can help refine or discuss principles

---

### Screen 2: Edit Principle (Inline)

**What the user sees:**
- The principle card expands into an editable text area
- Type selector dropdown: Value, Declaration, Faith Foundation, Scripture/Quote, Vision
- Category field (optional, freeform text — e.g., "Marriage," "Parenting," "Work")
- "Save" and "Cancel" buttons
- "Archive" button (muted, bottom of edit area)

**Interactions:**
- Edit text directly in the text area
- Change type via dropdown
- Add or change category
- Tap "Save" → validates (text cannot be empty), saves, collapses back to card view
- Tap "Cancel" → discards changes, collapses
- Tap "Archive" → confirmation prompt: "Archive this principle? You can restore it later." → moves to archived

**Data updated:**
- `mast_entries` record: text, type, category, updated_at
- For archive: sets `archived_at` timestamp

---

### Screen 3: Add New Principle

**What the user sees:**
- Two options presented clearly:
  - "Write it myself" — opens a simple form
  - "Craft it at The Helm" — opens the Helm with a guided prompt

**Option A: Write It Myself**
- Text area for the principle
- Type selector: Value, Declaration, Faith Foundation, Scripture/Quote, Vision
- Category field (optional)
- "Save" button

**Option B: Craft It at The Helm**
- Opens the Helm (drawer or full page)
- AI begins with: "What area of your life is this principle about?" and then guides the user through articulating it
- For declarations specifically, the AI ensures honest commitment language:
  - If user writes "I am patient" → AI gently redirects: "That sounds like where you want to be. How about framing it as a commitment? Something like 'I choose to respond with patience, especially when my children test my limits.' That honors where you are while declaring where you're heading."
- When the user and AI have crafted the principle, AI offers: "Here's what we've crafted: [principle text]. Would you like to save this to your Mast?"
- User confirms → saved to mast_entries with appropriate type

---

### Screen 4: Archived Principles

**What the user sees:**
- List of archived principles with their original type tags
- Archived date shown
- "Restore" button on each

**Interactions:**
- Tap "Restore" → moves principle back to active, removes archived_at timestamp
- No permanent delete option in the UI (data is soft-deleted only)

---

## Data Schema

### Table: `mast_entries`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | gen_random_uuid() | Primary key |
| user_id | UUID | | Foreign key → auth.users |
| type | TEXT | | Enum: 'value', 'declaration', 'faith_foundation', 'scripture_quote', 'vision' |
| text | TEXT | | The principle content. Cannot be empty. |
| category | TEXT | null | Optional freeform category (e.g., "Marriage", "Work") |
| sort_order | INTEGER | 0 | Order within its type group. Lower = higher. |
| source | TEXT | 'manual' | Enum: 'manual', 'helm_conversation', 'manifest_extraction', 'log_routed' |
| source_reference_id | UUID | null | If from Manifest or Log, the ID of the source entry |
| archived_at | TIMESTAMPTZ | null | Null = active. Set = archived. |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | Auto-updated via trigger |

**RLS Policy:** Users can only CRUD their own mast entries.

**Indexes:**
- `user_id, type, archived_at` (for grouped display of active entries)
- `user_id, archived_at` (for archived view)

---

## AI Behavior

### How the AI Uses the Mast

**Always loaded:** All active (non-archived) Mast entries are included in the AI system prompt for every conversation, regardless of which page the Helm is opened from. They are formatted as:

```
The user's guiding principles (The Mast):

VALUES:
- [text]
- [text]

DECLARATIONS:
- [text]

FAITH FOUNDATIONS:
- [text]

SCRIPTURES & QUOTES:
- [text]

VISION:
- [text]
```

**Natural reference:** The AI references Mast entries when they are relevant to the conversation. It does not list them or quote them mechanically. Example:
- User: "I lost my temper with the kids again tonight."
- AI (knowing the Mast includes a declaration about patience): "That's frustrating, especially since you've committed to responding with patience. What happened right before you lost your temper? Let's figure out what the trigger was, because the man who wrote that declaration is still in there — he just got ambushed."

**Misalignment reflection:** When the AI notices patterns in the Log, Helm conversations, or Compass data that seem misaligned with Mast principles, it can gently reflect this — but ONLY when the user is in a receptive context (processing at The Helm or during a review session), not as an unsolicited accusation.

### Declarations: Language Guidance

When helping craft declarations (in The Helm or during onboarding), the AI follows these rules:

**Honest commitment language (YES):**
- "I choose to become a man who responds with patience."
- "When I feel anger rising, I will pause before I speak."
- "I am committed to becoming someone my children feel safe with."
- "I choose to put my wife's needs alongside my own in every decision."

**Hollow affirmation language (NO):**
- "I am patient." (when he clearly struggles with patience)
- "I am a great father." (when he's actively working on becoming one)
- "I am confident and powerful." (generic, dishonest if not felt)

**The distinction:** Declarations commit to what you are CHOOSING to become. Affirmations claim you ARE something you're not. Declarations are honest about the journey. Affirmations skip over it.

### Faith Integration for Initial User

When the initial user is crafting Faith Foundations, the AI draws on:
- LDS doctrine and Swedenborg's theological writings
- The sacred triangle: husband, wife, Lord
- "Think Celestial" (President Nelson) and "Let God Prevail" (President Nelson)
- Becoming through love, wisdom, and use (Swedenborg)
- Ruling love determining eternal character
- God as the Captain of the soul (Whitney's response to Invictus)
- The user as steward, not owner — entrusted with a vessel, navigating by celestial light

For future multi-user support, the AI adapts to whatever faith tradition or secular framework the user defines. It never assumes, imposes, or gatekeeps.

---

## Manifest-to-Mast Flow

When a user uploads content to The Manifest and selects "Extract principles for The Mast" in the intake flow:

1. AI reads the uploaded content via RAG
2. AI identifies candidate principles, values, or quotes
3. AI presents them to the user: "I found several ideas in this material that might belong on your Mast. Here are the ones that stood out: [list]. Which of these resonate with you?"
4. User selects which ones to keep
5. For each selected item, AI asks: "What type is this? A value, declaration, faith foundation, scripture/quote, or vision?"
6. User confirms type → entry created in `mast_entries` with source = 'manifest_extraction' and source_reference_id pointing to the Manifest item

---

## Log-to-Mast Flow

When a user captures something in The Log and routes it to the Mast:

1. User writes or captures an entry in The Log
2. User selects "Save to Mast" from the routing options
3. App asks for type (value, declaration, etc.) and optional category
4. Entry is created in `mast_entries` with source = 'log_routed' and source_reference_id pointing to the Log entry
5. The original Log entry remains in The Log (it is not moved, it is copied)

---

## Onboarding Integration

During onboarding (Step 3 in the onboarding flow), the user sets up their initial Mast through a guided conversation at The Helm. The AI walks through:

1. "What are the core values you want your life built around?" → Creates value entries
2. "Is there a faith tradition or spiritual framework that guides you?" → Creates faith foundation entries
3. "What kind of man/person are you choosing to become?" → Creates declaration entries
4. "Are there any scriptures, quotes, or principles that anchor you?" → Creates scripture/quote entries
5. "What does your ideal life look like?" → Creates vision entries

This does not need to be exhaustive on day one. The AI should say: "This is a starting point. Your Mast will grow and deepen as you use StewardShip. You can always come back and add more."

---

## Edge Cases

### Empty Mast
- If the user has no Mast entries (skipped onboarding or deleted everything), the AI still functions but may periodically suggest: "I notice your Mast doesn't have any guiding principles yet. Would you like to set some up? It helps me give you better advice."
- This suggestion should be gentle, not nagging. Maximum once per week.

### Very Long Principles
- Text field has no hard character limit, but the AI context window is finite
- If total Mast text exceeds a reasonable context budget (e.g., 2000 tokens), the system should include all entries but truncate very long individual entries with a note: "[truncated — full text available on Mast page]"
- In practice this is unlikely to be an issue for most users

### Duplicate Principles
- No technical prevention of duplicates (user might want similar principles in different categories)
- AI can notice near-duplicates and suggest consolidation: "I notice you have two similar principles about patience. Would you like to combine them?"

---

## What "Done" Looks Like

### MVP
- Mast page displays all active principles grouped by type
- User can add a principle directly (write it myself)
- User can edit any principle inline
- User can archive and restore principles
- User can reorder within groups
- "Craft at Helm" guided declaration flow (AI helps write in honest commitment language)
- Onboarding Mast setup conversation (guided walk-through of values, faith, declarations, vision)
- Helm drawer from Mast page loads Mast context
- All active Mast entries included in AI system prompt
- RLS prevents cross-user access

### MVP When Dependency Is Ready
- Manifest-to-Mast extraction flow (requires The Manifest to be built first)
- Log-to-Mast routing (requires The Log routing system to be built first)

### Post-MVP
- AI misalignment reflection (needs accumulated data from Log, Compass, Helm to be useful)
- AI near-duplicate detection

---

## CLAUDE.md Additions from This PRD

- [ ] Mast entries always loaded in AI system prompt — format defined above
- [ ] Declaration language rules (honest commitments, not affirmations) — specific examples
- [ ] Manifest-to-Mast and Log-to-Mast flow patterns
- [ ] Convention: soft delete via `archived_at` timestamp (no hard deletes in user-facing features)
- [ ] Convention: source tracking on entries (`source` + `source_reference_id`) for traceability
- [ ] Convention: `sort_order` integer for user-controlled ordering

---

*End of PRD-02*
