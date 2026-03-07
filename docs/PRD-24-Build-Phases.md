# PRD-24: Suggested Build Phases

**For Claude Code:** Read PRD-24-Manifest-Extract-and-Discuss-v2.md and PRD-24-UX-Walkthrough-v2.md first. Then read CLAUDE.md, DATABASE_SCHEMA.md, and the current Manifest-related files in the repo. Use this phasing as a starting point — adjust based on what you find in the codebase.

**Latest migration:** 038 (section_title on ai_framework_principles)
**Next migration:** 039+

---

## Phase A: Database + Schema + Cleanup

The foundation. No UI changes yet — just data layer.

**Migration 039:**
- Add `genres TEXT[] DEFAULT '{}'` to `manifest_items`
- Add `extraction_status TEXT DEFAULT 'none'` to `manifest_items`
- Create `manifest_summaries` table (see PRD for full schema)
- Create `manifest_declarations` table (see PRD for full schema)
- Add `is_hearted BOOLEAN DEFAULT false` to `ai_framework_principles`
- Add `is_deleted BOOLEAN DEFAULT false` to `ai_framework_principles`
- Add `is_from_go_deeper BOOLEAN DEFAULT false` to `ai_framework_principles`
- Create `book_discussions` table
- Create `book_discussion_messages` table
- Add `book_knowledge_access TEXT DEFAULT 'hearted_only'` to `user_settings`
- RLS policies on all new tables
- Indexes per PRD spec

**Types updates (src/lib/types.ts):**
- Add types for `ManifestSummary`, `ManifestDeclaration`, `BookDiscussion`, `BookDiscussionMessage`
- Add `DeclarationStyle` type: 'choosing_committing' | 'recognizing_awakening' | 'claiming_stepping_into' | 'learning_striving' | 'resolute_unashamed'
- Add `BookGenre` type with all 8 genres
- Add `DiscussionType`: 'discuss' | 'generate_goals' | 'generate_questions' | 'generate_tasks' | 'generate_tracker'
- Add `DiscussionAudience`: 'personal' | 'family' | 'teen' | 'spouse' | 'children'
- Deprecate `ManifestUsageDesignation` (or remove — check for remaining references)

**Cleanup:**
- Remove `onExtractKeel` from ManifestItemDetail props and all references
- Remove Keel extraction view mode from Manifest.tsx
- Remove `keel_info` extraction from `useFrameworks` hook (`extractKeel` function)
- Audit usage_designations references — anything still reading them should be disconnected

---

## Phase B: Extraction Pipeline (Edge Functions + Hooks)

The AI extraction backend. Three extraction types, genre-aware prompts, Go Deeper support.

**Refactor `manifest-extract` edge function:**
- Add `extraction_type` parameter: 'summary' | 'framework' | 'mast_content'
- Add `genres` array parameter (multi-genre prompt blending)
- Add `go_deeper` boolean + `existing_items` JSON for non-duplicate extraction
- Add `model` parameter (default Sonnet, for future cost tiers)
- Remove keel extraction mode entirely
- New prompt sets for Summary extraction (genre-specific)
- New prompt sets for Mast Content / declaration extraction (five styles, standalone rule, honesty test, genre-specific)
- Existing framework extraction prompts updated with genre awareness
- All prompts must handle multi-genre blending (e.g., Scriptures/Sacred + Allegory/Parable)
- Size-based strategy: full text if under ~50k tokens, chapter-by-chapter if over

**New hook or extend `useFrameworks`:**
- `extractSummary(manifestItemId, genres, sectionTitle?, sectionStart?, sectionEnd?)` 
- `extractDeclarations(manifestItemId, genres, sectionTitle?, sectionStart?, sectionEnd?)`
- `goDeeper(manifestItemId, tabType, sectionTitle, existingItems)`
- `reRunTab(manifestItemId, tabType, genres)`
- CRUD for `manifest_summaries` (fetch, update/edit, heart, delete)
- CRUD for `manifest_declarations` (fetch, update/edit, heart, delete, sendToMast)
- Add heart/delete to existing framework principles CRUD
- `fetchHeartedItems(userId)` — aggregated across all books

**Helm context changes:**
- Disconnect `shouldLoadManifest` / `searchManifest` / `formatManifestContext` from Helm context pipeline in `contextLoader.ts`
- Add new context loader based on `book_knowledge_access` setting:
  - 'hearted_only': query hearted summaries + principles + declarations
  - 'all_extracted': query all non-deleted items
  - 'frameworks_only': current behavior (just active framework principles)
  - 'none': skip entirely
- Update `systemPrompt.ts` to format the new book knowledge context section

---

## Phase C: Extraction UI

The book detail page transformation — tabs, hearts, inline editing, progress bars, Go Deeper, Apply section.

**ManifestItemDetail overhaul:**
- Remove usage designation chips section
- Remove separate extraction buttons (onExtractFramework, onExtractMast, onExtractKeel)
- Remove "Discuss This" Helm integration button
- Add genre chips (tag-style, multi-select, editable after first extraction)
- Add Extract button → genre picker flow
- Add three-tab view: Summary | Frameworks | Mast Content
  - Per-tab progress bars during extraction
  - Content grouped under collapsible chapter/section headers with item counts
  - Each item: ❤️ heart button, 🗑 delete button, inline-editable text (tap to edit)
  - Hearted Only / All filter toggle per tab
  - Go Deeper button per chapter section
  - Re-run button per tab header (with confirmation dialog)
  - Save button + auto-save indicator
- Declarations additionally show: optional value name, style label, Send to Mast button
- Apply section below tabs: Discuss Book, Generate Goals, Generate Questions, Generate Tasks, Generate Tracker (greyed/coming soon)

**Manifest.tsx updates:**
- Remove keel extraction view mode and state
- Remove `keelExtractionResults` state
- Remove keel-related handlers
- Update view modes for new tab-based detail page
- Wire new extraction flow

**Settings:**
- Add `book_knowledge_access` option to Settings page (dropdown or radio: Hearted only, All extracted, Frameworks only, None)

---

## Phase D: Book Discussions + Apply Routing

The discussion modal, conversation system, archive, and routing.

**New edge function: `manifest-discuss`**
- Accepts: manifest_item_ids[], discussion_type, audience, user message, conversation history
- Loads: RAG chunks + all extracted content (hearted prioritized) + user context (Mast, Keel, frameworks)
- Genre and audience shape the system prompt
- Discussion type shapes opening and steering:
  - 'discuss': warm acknowledgment, user leads
  - 'generate_goals': AI suggests goals from extractions
  - 'generate_questions': AI generates discussion questions with audience awareness
  - 'generate_tasks': AI suggests actionable tasks
  - 'generate_tracker': AI suggests what to track (post-MVP routing)
- Multi-book: AI opens with cross-book synthesis
- Single-book: AI acknowledges context, asks "what's on your mind?"

**New hook: `useBookDiscussions`**
- CRUD for book_discussions and book_discussion_messages
- Start discussion (create discussion record, send first message)
- Send message (append to conversation, call manifest-discuss)
- Fetch discussions (for archive)
- Copy discussion to clipboard

**New components:**
- `BookDiscussionModal` — full-screen/large modal with:
  - Header (book titles, discussion type)
  - Audience selector (switchable mid-conversation)
  - Chat-style message list
  - Text input
  - "Send to..." routing button (context-aware: Goals → Rigging, Questions → Lists, Tasks → Compass)
  - "Copy All" clipboard button
  - Save button + auto-save indicator
- `BookSelector` — checkbox list of processed books for multi-book discussions
- `DiscussionArchive` — collapsible section on Manifest list page showing past discussions

**Manifest list page additions:**
- "Discuss Books" button in header
- "My Hearted Items" button/section (aggregated view, export)
- Discussion Archive section

**Mobile:**
- Floating chat button on book detail page (opens discussion modal with extraction context)

**Routing integration:**
- Send to Rigging: auto-format goals as rigging items
- Send to Lists: auto-format questions as list items
- Send to Compass: auto-format tasks as compass tasks
- Each routing shows confirmation toast

---

## Phase E: Polish + Docs

- Progress bar animations and transitions
- Heart animations (fill effect)
- Delete animations (fade out)
- Inline edit UX polish (focus handling, save on blur, escape to cancel)
- Mobile responsiveness for tabs, modals, floating chat button
- Export hearted items (md, docx, txt)
- Update CLAUDE.md per PRD checklist
- Update DATABASE_SCHEMA.md per PRD checklist
- Update System Overview
- PRD-24 saved to docs/

---

## Key Architectural Notes for Claude Code

1. **Modal render rule:** Never use early-return render patterns on pages with modals. Single return with ternary conditional content, modals rendered outside the conditional block. (Established architectural rule — see CLAUDE.md.)

2. **Edge function patterns:** Follow existing `manifest-extract` patterns for CORS headers, auth, error handling. Use `_shared/` imports for PDF utils, OpenRouter wrapper, etc.

3. **The declaration prompts are critical.** Read the PRD's declaration philosophy section carefully. Five styles, standalone rule, honesty test, no "I am [finished result]" patterns. The Guiding Star examples in the PRD are the gold standard.

4. **Existing framework extraction works well.** Don't break what works — extend it. The section-by-section discovery (Haiku) → extraction (Sonnet) pattern is proven. Summary and Mast Content extraction should follow the same pattern.

5. **Genre blending in prompts:** When multiple genres are selected, the prompt should explicitly instruct the AI to blend lenses. Example: "This book is tagged as both Scriptures/Sacred and Allegory/Parable. Extract through both a faith framework lens AND a narrative/symbolic teaching lens."

6. **RAG chunks stay.** Don't touch the existing `manifest_chunks` or `manifest_process` pipeline. Book discussions USE those chunks. We're just disconnecting them from Helm context loading.

7. **Hearts are persistent.** When a user hearts an item, that persists across sessions. It's a column on the record, not client-side state.

8. **Inline editing saves the edited text back to the database.** The original AI-generated text is not preserved separately (the user's edit IS the canonical version).
