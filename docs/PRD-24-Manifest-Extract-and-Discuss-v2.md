# PRD-24: Manifest Extract & Discuss

**Status:** Draft
**Author:** Tenise
**Created:** March 2026
**Depends on:** PRD-15 (Manifest), PRD-23 (Framework Tags & Browse)
**Migration:** TBD (039+)

---

## Problem

The Manifest currently has three separate extraction flows (Framework, Mast, Keel) triggered by usage designation chips on each book's detail page. This creates several issues:

1. **Keel extraction is redundant.** Keel extraction already lives on the Keel page. Having it on Manifest is confusing.
2. **Extraction is fragmented.** Users must toggle usage designations, then click separate extraction buttons for each type. There's no unified "extract everything useful from this book" action.
3. **Book discussions don't work.** The current "Discuss This" button opens the Helm in `manifest_discuss` mode, but the AI often can't find content even when the book is in the Manifest. RAG retrieval is unreliable — keyword detection is brittle, similarity thresholds miss valid content, and the AI claims ignorance of books the user has uploaded.
4. **No Summary extraction.** Users can't get chapter-by-chapter summaries of stories, studies, metaphors, notable concepts, or character development.
5. **Genre blindness.** The current extraction treats every book like non-fiction. Fiction, biography, scriptures, poetry, allegory, and workbooks all need different extraction approaches.
6. **No "Go Deeper" capability.** Once extraction runs, there's no way to get additional content from a specific chapter without re-running the entire extraction.
7. **No curation system.** Extracted items are either checked or unchecked. There's no way to mark favorites, delete irrelevant ones, or aggregate the best content across books.
8. **No action pathway.** After extraction, there's no structured way to generate goals, discussion questions, tasks, or trackers from what you've learned.

---

## Solution

Replace the fragmented extraction system with a unified, genre-aware extraction pipeline, a heart-based curation system, a dedicated book discussion system, and an Apply section that turns extracted wisdom into action.

---

## What Gets Removed

1. **Keel extraction from Manifest** — lives on the Keel page already.
2. **All usage designations** — `general_reference`, `framework_source`, `mast_extraction`, `keel_info`, `goal_specific`, `store_only` are all dropped. Every book is simply a book in the Manifest. Value flows through extraction and the Apply actions, not through designation labels.
3. **Separate extraction buttons** — the individual "Extract Framework Principles," "Extract for Mast," and "Extract for Keel" buttons are replaced by a single Extract action.
4. **Usage designation chips** on the book detail page — removed entirely.
5. **RAG search from Helm context loading** — `shouldLoadManifest`, `searchManifest`, and `formatManifestContext` are disconnected from the Helm context pipeline. Books no longer passively inject into Helm conversations. Instead, the Helm accesses book knowledge through extracted/applied/hearted content based on user settings.
6. **Current "Discuss This" Helm integration** — replaced by the dedicated Book Discussion system.

---

## Genre System

When the user clicks Extract, they select one or more genres via tag-style chips (multi-select). The combination of genres shapes all extraction prompts. Genre selections are saved on the `manifest_items` record as a `TEXT[]` array.

### Eight Genres

| Genre | Description |
|-------|-------------|
| **Non-Fiction** | Teaching, research, strategy, self-help, how-to |
| **Fiction** | Novels, short stories, narrative-driven works |
| **Biography / Memoir** | Personal accounts, life stories, autobiographies |
| **Scriptures / Sacred** | Biblical text, theological works, sacred writings |
| **Workbook** | Assessment results, guided exercises, structured programs |
| **Poetry / Essays** | Poetry collections, essay compilations, philosophical writing |
| **Allegory / Parable** | Fiction with embedded teachings — The Alchemist, Richest Man in Babylon, Screwtape Letters |
| **Devotional / Spiritual Memoir** | Near-death experiences, faith journeys, missionary accounts, preacher testimonies, spiritual encounters |

### Multi-Select Examples

| Book | Genres |
|------|--------|
| A House United (Nicholeen Peck) | Non-Fiction |
| StrengthsFinder results | Workbook |
| The Alchemist | Allegory / Parable |
| Screwtape Letters | Allegory / Parable + Scriptures / Sacred |
| Swedenborg | Scriptures / Sacred + Allegory / Parable |
| 90 Minutes in Heaven | Devotional / Spiritual Memoir |
| Mere Christianity | Non-Fiction + Scriptures / Sacred |
| The Pastor (Eugene Peterson) | Biography / Memoir + Devotional / Spiritual Memoir |
| Rumi collection | Poetry / Essays + Scriptures / Sacred |
| A leadership CEO memoir | Biography / Memoir + Non-Fiction |

When multiple genres are selected, the AI blends the extraction lenses. For example, Scriptures/Sacred + Allegory/Parable means the AI extracts both the story/narrative elements AND processes insights through a faith framework.

---

## Heart-Based Curation System

Every extracted item — summaries, framework principles, and declarations — has three possible states:

### Three States

| State | Icon | Meaning | Visibility |
|-------|------|---------|------------|
| **Deleted** | 🗑 | "I don't want this at all" | Soft-deleted, hidden from all views |
| **Neutral** | (none) | "This exists, I haven't decided yet" | Visible in "All" view |
| **Hearted** | ❤️ | "This resonates with me" | Visible in all views, prioritized, available for AI, exportable |

### Heart vs. Routing

Hearting and routing are independent actions:
- **Heart** = "I love this, I want to keep seeing it." Curation.
- **Route** = "Send this somewhere specific." Action (Send to Mast, Send to Rigging, Send to Compass, Send to Lists).

You can heart without routing (meaningful but not actionable yet). You can route without hearting (practical but not personally significant). You can do both.

### Views Per Book

On each book's extraction tabs, the user can toggle:
- **Hearted only** — shows just the ❤️ items for that book
- **All** — shows hearted items at top, then neutral items below

### Aggregated Hearted View

Accessible from the Manifest list page — a "My Hearted Items" section or button that shows all hearted summaries, principles, and declarations across ALL books, grouped by book. This becomes a personal commonplace book of the user's favorite wisdom from their entire library.

Exportable as md, docx, or txt.

### AI Access Settings

In Settings, the user chooses what book knowledge the AI has access to at the Helm:

**"Book knowledge available to AI:"**
- **Hearted items only** (default) — curated, intentional, high-signal
- **All extracted items** — hearted + neutral (everything that wasn't deleted)
- **Framework principles only** — current behavior, just active frameworks
- **None** — book discussions only, AI at Helm has no book context

This replaces the old usage designation system entirely. The user controls AI access through one clear setting, not per-book labels.

---

## Extraction Pipeline

### User Flow

1. User navigates to a book's detail page
2. Clicks the **Extract** button (nautical name TBD)
3. Selects one or more genres via tag-style chips
4. Genres are saved to the book's record
5. All three extractions fire (Summary, Frameworks, Mast Content)
6. **Progress bars** show per-tab extraction progress
7. Results appear in three tabs, grouped under chapter/section headings
8. User curates: ❤️ heart, 🗑 delete, or leave neutral
9. User can route items: Send to Mast, etc.
10. **Save button** visible on each tab + auto-save with visible indicator

### Size-Based Processing Strategy

- **Small books** (under ~50k tokens): Full text sent in one pass per tab. AI identifies chapter boundaries from the text and tags results by section.
- **Large books** (over ~50k tokens): Chapter-by-chapter processing using existing RAG chunks grouped by section metadata. Results accumulate progressively.

The threshold is determined server-side. The user sees the same experience either way.

### Separate Calls Per Tab

Each tab uses a separate edge function call with genre-specific prompts:
- Each tab gets a **specialized prompt** optimized for its extraction type
- If one tab fails, only that tab needs re-running
- Results appear tab by tab as each completes (progressive UX)
- "Go Deeper" targets a specific tab + chapter

### Architecture for Future Cost Tiers

The extraction edge function accepts `model` and `tabs_to_extract` parameters. For MVP: always Sonnet, always all three tabs. For future v2 at scale: Budget tier (Haiku) vs Premium tier (Sonnet, BYOK).

---

## Tab 1: Summary

Chapter-by-chapter extraction of the book's key content, sub-nested under collapsible section headings.

### What Gets Extracted (by genre)

| Genre | Summary Focus |
|-------|--------------|
| **Non-Fiction** | Key concepts, studies, stories, metaphors, notable quotes (paraphrased), research findings, practical examples |
| **Fiction** | Chapter-level plot summary, character introductions and development, key scenes, turning points, themes, notable dialogue, world-building |
| **Biography / Memoir** | Key life events, turning points, relationships, achievements, struggles, character-revealing moments |
| **Scriptures / Sacred** | Passage context, theological themes, cross-references, application points, historical/cultural background |
| **Workbook** | Teaching points per section, exercise descriptions and purposes, key definitions, assessment explanations |
| **Poetry / Essays** | Thematic analysis, imagery and symbolism, emotional progression, philosophical arguments, cultural context |
| **Allegory / Parable** | Story elements AND embedded teachings, symbolic meanings, the lesson within the narrative, real-world applications |
| **Devotional / Spiritual Memoir** | Spiritual encounters, transformative moments, testimony highlights, faith-tested-by-fire moments, revelations |

### Display

- Collapsible chapter/section headers showing title and item count
- Each item has a type label (e.g., "Key Concept," "Study," "Character Development," "Theme," "Testimony")
- **Inline editable:** Tap any extracted text to edit it in place — reword, add personal insights, add backstory, clarify. The AI extracts, the user owns the final words.
- Each item has ❤️ heart button and 🗑 delete button
- "Go Deeper ↓" button at bottom of each chapter section
- Save button + auto-save indicator

---

## Tab 2: Frameworks

Builds on the existing `ai_frameworks` / `ai_framework_principles` system (with `section_title` from migration 038), now genre-aware and with heart/delete curation.

### Genre-Aware Extraction

| Genre | Framework Focus |
|-------|----------------|
| **Non-Fiction** | Actionable principles, strategies, systems, mental models (current behavior) |
| **Fiction** | Character traits worth emulating, moral lessons, relational wisdom, leadership patterns exhibited by characters, principles revealed through conflict |
| **Biography / Memoir** | Leadership principles, decision-making patterns, resilience strategies, relationship approaches |
| **Scriptures / Sacred** | Spiritual disciplines, wisdom principles, relational guidance, character formation (faith lens) |
| **Workbook** | Step-by-step processes, tools and techniques, frameworks being taught with application contexts |
| **Poetry / Essays** | Philosophical principles, worldview frameworks, aesthetic values, ways of seeing |
| **Allegory / Parable** | Principles extracted from both the narrative layer and the teaching layer — what the story illustrates |
| **Devotional / Spiritual Memoir** | Spiritual practices discovered through experience, faith principles learned through living, trust frameworks |

### Storage

Reuses existing `ai_frameworks` and `ai_framework_principles` tables. Adds `is_hearted` and soft-delete fields. Genre-aware prompts produce richer principles — no structural schema changes needed.

**Inline editable:** Tap any principle to edit it in place — reword in your own language, add nuance, add personal context. Same pattern as existing FrameworkPrinciples editor.

---

## Tab 3: Mast Content

Extracts declarations, values, and identity statements the user might adopt into their personal Mast.

### Declaration Philosophy

Declarations are honest commitments — statements your whole being can stand behind without flinching. The test: *Can every part of you — mind, spirit, gut — say "yes, that's true" right now?* Not about a future self. About the choosing, claiming, recognizing, standing firm happening in this moment.

The AI generates declarations across **five styles**, choosing whichever fits the content naturally. Not every declaration needs a named value. Some will have one ("Stewardship: ..."), some will just be the declaration itself. Some will be value statements ("I prioritize my spirituality"). The AI does not force every declaration into a template.

### Five Declaration Styles

**1. Choosing & Committing** — the declaration lives in the decision itself:
- "I choose courage over comfort."
- "I have chosen to build a home where vulnerability is safe."
- "I am committed to becoming someone my children feel safe with."

**2. Recognizing & Awakening** — honoring growth you can actually see happening:
- "I notice I am becoming someone who listens before reacting."
- "More and more, I'm recognizing a hunger for depth over distraction."
- "I am discovering strengths I didn't know I had."

**3. Claiming & Stepping Into** — declaring with boldness what you are ready to own:
- "I carry dignity with calm strength."
- "I hold fast to hope, a light that endures even when shadows fall."

**4. Learning & Striving** — respecting the messy middle:
- "I am learning to sit with discomfort instead of running from it."
- "I am striving to lead my family with both tenderness and conviction."
- "I pursue wisdom like a hidden treasure."

**5. Resolute & Unashamed** — the line-in-the-sand declarations where the fierceness IS the honesty:
- "I won't look back, let up, slow down, or be still."
- "I cannot be bought, compromised, detoured, or delayed."
- "I am finished with low living, small planning, colorless dreams, and dwarfed goals."

### Declarations Stand Alone

The book inspires the declaration, but the declaration does not reference the book or its characters. "If Don Piper survived that, I can survive this" becomes "I choose to trust through seasons I don't understand." The source is tracked in metadata, but the declaration is pure — the user's words, the user's commitment, standing independently.

The AI prompt instructs: "Generate declarations that stand independently. The reader's commitment should not depend on or reference the author's experience. The book is the inspiration, not the content of the declaration."

### Genre-Aware Mast Extraction

| Genre | Mast Focus |
|-------|-----------|
| **Non-Fiction** | Values the author champions, commitments the content inspires, identity statements from principles |
| **Fiction** | Character qualities to aspire to, declarations inspired by character journeys, values revealed through conflict |
| **Biography / Memoir** | Values the subject embodied, commitments inspired by their choices, identity statements modeled on their character |
| **Scriptures / Sacred** | Identity rooted in faith, promises to claim, commitments of faith, values grounded in scripture |
| **Workbook** | Self-discoveries from exercises, commitments made during the program, identity statements from prompts |
| **Poetry / Essays** | Declarations inspired by themes, identity drawn from the author's voice and vision |
| **Allegory / Parable** | Declarations from the embedded teachings, values revealed by the story's resolution |
| **Devotional / Spiritual Memoir** | Declarations of trust, faith commitments, spiritual identity statements — drawn from the testimony but standing on their own |

### Display

- Sub-nested under chapter/section headings
- Each declaration shows:
  - Optional value name in bold (only when natural, not forced)
  - Declaration style label (Choosing & Committing, Recognizing & Awakening, etc.)
  - The declaration text
  - **Inline editable:** Tap the declaration text, value name, or style label to edit in place — reword to make it truly yours, add personal backstory, adjust the style
  - ❤️ heart button
  - 🗑 delete button
  - **"Send to Mast"** button (individual, not bulk)
- Sent declarations tracked with "✓ In Mast" indicator
- Save button + auto-save indicator

### Why Declarations Persist on the Book

Extracted declarations stay on the book's Mast Content tab even after some are sent to the Mast. The book becomes a wellspring the user revisits — a declaration that didn't resonate six months ago might be exactly right in a new season.

---

## Go Deeper & Re-run

### Go Deeper (Per Chapter, Per Tab)

Button on each chapter section within each tab. When clicked:

1. Re-runs extraction for just that chapter's content
2. Includes already-extracted items as context: "Find additional content not already captured. Do not duplicate these: [list]."
3. **Appends** new results to the existing section
4. New items marked with a subtle indicator (e.g., ✦) so user can see what's new
5. Progress bar shown within that chapter section

### Re-run (Per Whole Tab)

Button on each tab header. When clicked:

1. Confirmation dialog: "This will replace all [Summary/Framework/Mast] content for this book. Continue?"
2. Re-runs full extraction for that tab across all chapters
3. **Replaces** existing content entirely
4. Useful when genre selection changes or user wants fresh extraction

---

## Apply Section

Below the three extraction tabs, an "Apply This" section with action buttons. Each button opens the Book Discussion modal with different AI steering. All conversations save to the Book Discussion archive.

### Apply Buttons

| Button | AI Steering | Output Destination |
|--------|------------|-------------------|
| **Discuss Book** | Warm acknowledgment + "what's on your mind?" User leads. | Conversation saved to archive |
| **Generate Goals** | AI suggests goals based on extractions, conversational refinement | User reviews → Send to Rigging |
| **Generate Discussion Questions** | AI generates questions with audience selector (Personal, Family, Teen, Spouse, Children) | User reviews → Send to Lists |
| **Generate Tasks** | AI suggests actionable next steps from frameworks/principles | User reviews → Send to Compass |
| **Generate Tracker** | AI suggests what to track based on content | **Post-MVP** — conversation saves, routing to Charts later |

### Flow

1. User clicks an Apply button
2. Discussion modal opens with that button's AI steering
3. Conversational back-and-forth to shape the output
4. When ready, user clicks **"Send to..."** which auto-formats and routes to the destination
5. Entire conversation stored in Book Discussion archive

---

## Book Discussions

### Architecture

Book discussions happen in a **modal on the Manifest page**, not at the Helm. They have dedicated storage and their own archive.

### Two Entry Points from Manifest List Page

1. **"Discuss Books" button** in the header — opens book selector with checkboxes, then launches multi-book discussion
2. **Discussion Archive** — collapsible section showing past discussions with date, books involved, message count, preview

### Entry Points from Book Detail Page

1. **"Discuss Book"** in the Apply section — single-book discussion
2. **Other Apply buttons** (Generate Goals, Questions, Tasks, Tracker) — each opens a discussion with different steering
3. **Floating chat button** (mobile) / chat panel trigger — contextual conversation about what user is currently viewing on the extraction tabs. Opens the discussion modal with the question pre-loaded.

### Context Available to All Discussions

- AI's training knowledge about the book/author
- RAG chunks from the book's processed content
- All extracted content (Summary, Frameworks, Mast Content) — hearted items prioritized
- User's personal context (Mast, Keel, active frameworks, current season)

### Single-Book Discussion Opening

The AI gives a warm acknowledgment of the user's context with the book, then asks "what's on your mind?" The user leads.

> You've been digging into [Book Title] — I can see you've pulled some rich content from it. What's on your mind?

No interrogation. No barrage of questions. The user directs the conversation.

### Multi-Book Discussion Opening

The AI opens with cross-book synthesis — finding the thread that connects the selected books, then offering thought-provoking questions:

- **Thought-provoking:** Challenge assumptions across books
- **Context-altering:** Reframe situations through combined lenses
- **Action-inspiring:** Connect principles to the user's life
- **Character-improving:** Character development from multiple perspectives
- **Soul-stirring:** Deeper meaning questions
- **Heart-warming:** Connecting themes to relationships

### Audience Selector

Available on all discussions. Can be changed mid-conversation. Options:

- **Personal** (default) — reflective, individual
- **Family** — age-appropriate for the whole family
- **Teen** — questions that engage teenage thinking
- **Spouse** — questions for couples
- **Children** — simplified, wonder-driven

When switched, the AI adjusts its next response to match the new audience without losing conversation context.

### Discussion Archive

Accessible from the Manifest list page. Shows all past discussions:
- Date, which book(s), message count, first few lines as preview
- Tap to re-open and continue
- "Copy All" button to copy entire conversation to clipboard (for pasting into Helm if desired)
- Save button visible + auto-save with indicator

---

## Save Indicators

**Every** screen that creates or modifies data shows either:
- A visible **Save button** (always available, even if auto-save is active)
- An **auto-save indicator** ("Saved ✓" or "Saving..." or "Auto-saved at 10:42 PM")

Both can coexist. The principle: the user should never wonder whether their work has been saved.

This applies to:
- Extraction tab content (heart/delete changes)
- Discussion conversations
- Genre selections
- Declaration edits
- Framework principle edits
- Any generated content before routing

---

## Progress Indicators

All extraction operations show **per-tab progress bars**:
- Summary tab: progress bar during summary extraction
- Frameworks tab: progress bar during framework extraction
- Mast Content tab: progress bar during declaration extraction
- Go Deeper: progress bar within the specific chapter section
- Apply section generation: progress indicator in the discussion modal

Progress bars are visual (not just spinners) and give a sense of how far along the extraction is.

---

## Data Schema Changes

### Modified: `manifest_items`

| Column | Change | Notes |
|--------|--------|-------|
| `genres` | **ADD** TEXT[] DEFAULT '{}' | Array of genre tags. One or more of: 'non_fiction', 'fiction', 'biography_memoir', 'scriptures_sacred', 'workbook', 'poetry_essays', 'allegory_parable', 'devotional_spiritual_memoir' |
| `extraction_status` | **ADD** TEXT DEFAULT 'none' | One of: 'none', 'extracting', 'completed', 'failed' |
| `usage_designations` | **DEPRECATE** | No longer read by any feature. Existing values ignored. Column left in place to avoid migration risk; can be dropped in a future cleanup. |

### New: `manifest_summaries`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items |
| section_title | TEXT | | NULL | Chapter/section name |
| section_index | INTEGER | 0 | NOT NULL | Order within the book |
| content_type | TEXT | | NOT NULL | e.g. 'key_concept', 'study', 'story', 'metaphor', 'character_dev', 'theme', 'plot_point', 'testimony', 'turning_point' |
| text | TEXT | | NOT NULL | The extracted summary content |
| sort_order | INTEGER | 0 | NOT NULL | Order within section |
| is_hearted | BOOLEAN | false | NOT NULL | User favorited this item |
| is_deleted | BOOLEAN | false | NOT NULL | Soft delete — hidden from all views |
| is_from_go_deeper | BOOLEAN | false | NOT NULL | Added by "Go Deeper" |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own summaries only.
**Indexes:** `manifest_item_id, section_index, sort_order` ; `user_id, is_hearted, is_deleted` (aggregated hearted view)

### New: `manifest_declarations`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items |
| section_title | TEXT | | NULL | Chapter/section name |
| section_index | INTEGER | 0 | NOT NULL | Order within the book |
| value_name | TEXT | | NULL | Optional — only when a value naturally fits (e.g., "Courage", "Stewardship"). Not forced. |
| declaration_text | TEXT | | NOT NULL | The full declaration |
| declaration_style | TEXT | | NOT NULL | One of: 'choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed' |
| is_hearted | BOOLEAN | false | NOT NULL | User favorited |
| is_deleted | BOOLEAN | false | NOT NULL | Soft delete |
| sent_to_mast | BOOLEAN | false | NOT NULL | Whether sent to Mast |
| mast_entry_id | UUID | | NULL | FK → mast_entries (if sent) |
| sort_order | INTEGER | 0 | NOT NULL | Order within section |
| is_from_go_deeper | BOOLEAN | false | NOT NULL | Added by "Go Deeper" |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own declarations only.
**Indexes:** `manifest_item_id, section_index, sort_order` ; `user_id, is_hearted, is_deleted`

### Modified: `ai_framework_principles`

| Column | Change | Notes |
|--------|--------|-------|
| `is_hearted` | **ADD** BOOLEAN DEFAULT false | User favorited |
| `is_deleted` | **ADD** BOOLEAN DEFAULT false | Soft delete (replaces archived_at for this use case) |
| `is_from_go_deeper` | **ADD** BOOLEAN DEFAULT false | Added by "Go Deeper" |

(The `section_title` column already exists from migration 038.)

### New: `book_discussions`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NULL | Auto-generated or user-editable |
| manifest_item_ids | UUID[] | | NOT NULL | Which books are included |
| discussion_type | TEXT | 'discuss' | NOT NULL | 'discuss', 'generate_goals', 'generate_questions', 'generate_tasks', 'generate_tracker' |
| audience | TEXT | 'personal' | NOT NULL | 'personal', 'family', 'teen', 'spouse', 'children' |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own discussions only.
**Indexes:** `user_id, updated_at DESC`

### New: `book_discussion_messages`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| discussion_id | UUID | | NOT NULL | FK → book_discussions |
| role | TEXT | | NOT NULL | 'user' or 'assistant' |
| content | TEXT | | NOT NULL | Message text |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own messages only.
**Indexes:** `discussion_id, created_at ASC`

### Settings Addition

Add to `user_settings`:

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `book_knowledge_access` | TEXT | 'hearted_only' | One of: 'hearted_only', 'all_extracted', 'frameworks_only', 'none' |

---

## Edge Functions

### Modified: `manifest-extract`

Currently handles framework/mast/keel extraction. Refactored to:

- Accept `extraction_type`: 'summary', 'framework', 'mast_content'
- Accept `genres` array that shapes the prompt (multi-genre blending)
- Accept `go_deeper` boolean + `existing_items` array for non-duplicate extraction
- Accept optional `section_title` + `section_start`/`section_end` for chapter-targeted extraction
- Accept `model` parameter (for future cost tiers, default Sonnet)
- Remove keel extraction mode
- Summary and Mast Content extraction are new prompt sets
- Declaration prompts encode the five-style philosophy and standalone-declaration rule

### New: `manifest-discuss`

Handles book discussion AI responses. Separate from Helm `chat` because:

- Loads all extracted content (summaries, frameworks, declarations) alongside RAG chunks
- Hearted items are prioritized in context
- Generates questions and responses based on genre, audience, discussion type, and user context
- For multi-book discussions, loads context from all selected books
- Uses Sonnet
- Accepts `discussion_type` to shape opening and steering behavior

---

## Helm Context Changes

### What Gets Removed

- `shouldLoadManifest` — no longer called from Helm context pipeline
- `searchManifest` (RAG similarity search) — no longer called from Helm
- `formatManifestContext` — no longer called from Helm
- The `match_manifest_chunks` SQL function remains (used by Book Discussions), but is not invoked from Helm context loading

### What Gets Added

Based on the user's `book_knowledge_access` setting:

- **'hearted_only'**: Load all hearted summaries, principles, and declarations across all books. Format as a "Book Wisdom" context section.
- **'all_extracted'**: Load all non-deleted summaries, principles, and declarations. Larger context load.
- **'frameworks_only'**: Current behavior — only active framework principles loaded.
- **'none'**: No book content loaded into Helm at all.

This is a query against the three extraction tables (`manifest_summaries`, `ai_framework_principles`, `manifest_declarations`) filtered by `is_deleted = false` and optionally `is_hearted = true`. Much simpler and more reliable than RAG similarity search.

---

## UI Changes

### Book Detail Page (ManifestItemDetail)

**Remove:**
- Usage designation chips (entire section)
- Separate extraction buttons
- "Discuss This" button (Helm integration)

**Add:**
- **Genre chips** (tag-style, multi-select, shown after first extraction, editable)
- **Extract button** — prominent, triggers genre picker on first use
- **Three-tab view**: Summary | Frameworks | Mast Content
  - Per-tab progress bars during extraction
  - Content grouped under collapsible chapter/section headers
  - Each item: ❤️ heart, 🗑 delete, and routing actions where applicable
  - "Go Deeper ↓" per chapter section
  - "Re-run" per tab header
  - Save button + auto-save indicator per tab
  - Filter toggle: Hearted Only / All
- **Apply section** below tabs: Discuss Book, Generate Goals, Generate Questions, Generate Tasks, Generate Tracker (post-MVP)
- **Floating chat button** (mobile) for contextual discussion entry

### Manifest List Page

**Add:**
- **"Discuss Books"** button in header (multi-book discussion launcher)
- **"My Hearted Items"** section or button (aggregated hearts across all books, exportable)
- **Discussion Archive** section (past discussions, tap to reopen)

### Discussion Modal

Full-screen or large modal:
- Header: book title(s) being discussed
- Discussion type indicator (Discuss, Goals, Questions, Tasks, Tracker)
- Audience selector (Personal, Family, Teen, Spouse, Children)
- Chat-style conversation
- "Send to..." button for routing generated items to destinations
- "Copy All" button for clipboard export
- Save button + auto-save indicator
- Close button (conversation persists)

---

## UX Walkthrough

See companion document: **PRD-24-UX-Walkthrough-v2.md**

---

## What "Done" Looks Like

### MVP

- Genre selection (8 genres, multi-select tag chips, saved to manifest_items)
- Single Extract action → three tabs (Summary, Frameworks, Mast Content)
- Genre-aware extraction prompts (blended for multi-genre)
- Five declaration styles, standalone declarations, no forced templates
- Heart / delete / neutral three-state curation on all extracted items
- Send to Mast (individual declarations)
- Go Deeper per chapter per tab (appends)
- Re-run per tab (replaces with confirmation)
- Progress bars per tab
- Save button + auto-save indicator everywhere
- Apply section: Discuss Book, Generate Goals, Generate Questions, Generate Tasks
- Generate Tracker conversation (post-MVP routing, conversation saves now)
- All Apply buttons → discussion modal with type-specific AI steering
- Generated items route: Goals → Rigging, Questions → Lists, Tasks → Compass
- Book Discussion modal (single-book and multi-book)
- Single-book: warm acknowledgment, user leads
- Multi-book: AI opens with cross-book synthesis
- Audience selector (switchable mid-conversation)
- Discussion archive on Manifest page
- Floating chat button on mobile for contextual discussion
- Copy All to clipboard
- Aggregated Hearted Items view (across all books, exportable)
- Hearted Only / All filter per book
- Settings: book_knowledge_access (hearted_only, all_extracted, frameworks_only, none)
- Helm context: loads hearted/extracted content based on setting (no RAG search)
- Usage designations deprecated (column left, nothing reads it)
- Keel extraction removed from Manifest
- Dedicated book_discussions / book_discussion_messages tables
- All existing books work without re-uploading
- RLS on all new tables

### Post-MVP

- Generate Tracker → route to Charts
- Discussion search across all book discussions
- Export extracted content (md, docx) per tab or per book
- "Discuss with Family" printable discussion guide
- Reading plans (suggested order for a book stack)
- Cross-book theme mapping (visual connections)
- Budget / Premium extraction tiers
- BYOK for power users
- Drop `usage_designations` column from manifest_items

---

## CLAUDE.md Additions from This PRD

- [ ] Manifest Extract: Single Extract action per book, genre-aware (8 genres, multi-select), produces three tabs (Summary, Frameworks, Mast Content). All content sub-nested under chapter/section headings.
- [ ] Genres: non_fiction, fiction, biography_memoir, scriptures_sacred, workbook, poetry_essays, allegory_parable, devotional_spiritual_memoir. Multi-select stored as TEXT[] on manifest_items.genres.
- [ ] Heart-based curation: Three states (hearted, neutral, deleted) on all extracted items. Independent from routing. Aggregated hearted view across all books, exportable. All extracted text (summaries, principles, declarations) is inline-editable — tap to edit in place.
- [ ] Declaration philosophy: Five styles (Choosing & Committing, Recognizing & Awakening, Claiming & Stepping Into, Learning & Striving, Resolute & Unashamed). Declarations stand alone — no references to the source book or its characters. Optional value names. Honesty test: "Can every part of you say yes right now?"
- [ ] Apply section: Discuss Book, Generate Goals, Generate Questions, Generate Tasks, Generate Tracker (post-MVP routing). All open discussion modal with type-specific AI steering. Generated items route to Rigging (goals), Lists (questions), Compass (tasks).
- [ ] Book Discussions: Dedicated modal on Manifest page. Own tables (book_discussions, book_discussion_messages). Single-book: warm acknowledgment, user leads. Multi-book: AI opens with cross-book synthesis. Audience selector (personal, family, teen, spouse, children). Copy to clipboard.
- [ ] Go Deeper: Per chapter, per tab. Appends non-duplicate content. Re-run: Per tab, replaces with confirmation.
- [ ] Helm context change: RAG search removed from Helm. Books serve Helm through extracted/applied/hearted content based on user setting (book_knowledge_access in user_settings).
- [ ] Usage designations deprecated: Column left on manifest_items, nothing reads it. No per-book AI labels.
- [ ] Keel extraction removed from Manifest entirely.
- [ ] Save indicators: Visible save button + auto-save indicator on every editable screen.

---

## DATABASE_SCHEMA.md Additions from This PRD

- [ ] `manifest_items.genres` — TEXT[], array of genre tags
- [ ] `manifest_items.extraction_status` — TEXT, default 'none'
- [ ] `manifest_items.usage_designations` — DEPRECATED, no longer read
- [ ] `manifest_summaries` — chapter-by-chapter summaries with section_title, content_type, is_hearted, is_deleted
- [ ] `manifest_declarations` — declarations with value_name (nullable), declaration_style, is_hearted, is_deleted, sent_to_mast tracking
- [ ] `ai_framework_principles.is_hearted` — BOOLEAN default false
- [ ] `ai_framework_principles.is_deleted` — BOOLEAN default false
- [ ] `ai_framework_principles.is_from_go_deeper` — BOOLEAN default false
- [ ] `book_discussions` — discussion metadata with manifest_item_ids, discussion_type, audience
- [ ] `book_discussion_messages` — messages (role, content)
- [ ] `user_settings.book_knowledge_access` — TEXT default 'hearted_only'
- [ ] `match_manifest_chunks` — still exists, used by Book Discussion system only (not Helm)
