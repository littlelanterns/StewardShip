# PRD-25: Manifest Browsing & Extraction UX Overhaul

> **Status:** Planning
> **Priority:** High
> **Created:** 2026-03-18
> **Scope:** Manifest page, ExtractionsView, ExtractionTabs, ManifestItemDetail, HeartedItemsView
> **Breaking Changes:** None — all changes are additive or cosmetic. Existing functionality preserved.

---

## Problem Statement

The Manifest feature has strong extraction capabilities but significant friction in **browsing and consuming** extracted content:

1. **Finding books is slow.** No "recently viewed" sort, no engagement-based ordering, deprecated UI elements still visible.
2. **Getting to extractions requires too many clicks.** Book detail page buries extractions below metadata. No direct path from library to a specific chapter/tab.
3. **No way to save your place.** All view state (selected book, active tab, scroll position, collapsed sections) is lost on page navigation or refresh.
4. **Cross-book browsing is underpowered.** ExtractionsView exists but has no search, no content-type tags, and limited filtering.
5. **Long extraction lists are hard to navigate.** No sticky headers, no chapter jump, no item preview collapse.
6. **Visual inconsistencies** between views create cognitive friction.

This PRD addresses all of these as a unified upgrade, organized into 6 phases that can be built and tested independently.

---

## Design Principles

- **Content first.** The thing the user came for (extracted content) should be the first thing they see, not the last.
- **Remember the user.** Persist meaningful state so returning feels like reopening a book, not starting over.
- **Reduce clicks-to-content.** Every navigation step that can be eliminated, should be.
- **Don't break what works.** Every phase is additive. Existing handlers, props, and data flows are preserved.
- **v2-ready patterns.** Build state persistence, navigation, and filtering patterns that transfer directly to MyAIM.
- **Theme-safe CSS.** ALL colors, backgrounds, borders, and shadows MUST use CSS custom properties (`var(--color-*)`, `var(--spacing-*)`, etc.). Zero hardcoded hex values, rgba values, or color names anywhere in new or modified CSS. This is a hard rule across all 6 phases.
- **Full text always visible on extraction items.** No line-clamping or truncation on extracted content (summaries, frameworks, action steps, declarations, questions). The user wants to see all text on each card at once without clicking to expand.

---

## Phase 1: State Persistence & "Continue Where You Left Off"

### What It Does
Persists the user's Manifest browsing state so they can leave and return without losing their place. Adds a "Continue" banner on the Manifest landing page.

### Changes

#### 1A. localStorage Persistence for UI Preferences
**Files:** `Manifest.tsx`

Persist these values to localStorage (using the ThemeContext try-catch pattern):
- `libraryLayout` → key `manifest-layout`
- `groupMode` → key `manifest-group-mode`
- `sortOption` → key `manifest-sort`
- `viewMode` → key `manifest-view-mode` (only persist 'list' — don't persist 'detail' since item may not exist)

Initialize each `useState` from localStorage with fallback to current defaults.

#### 1B. Session State Persistence for Browsing Context
**Files:** `Manifest.tsx`, `ExtractionsView.tsx`, `ExtractionTabs.tsx`

Persist to sessionStorage (survives refresh, clears on tab close):
- `selectedItem.id` → key `manifest-selected-item`
- Active extraction tab → key `manifest-active-tab`
- Extraction view mode (tabs/chapters/notes) → key `manifest-extraction-view`
- Extraction filter mode (all/hearted) → key `manifest-filter-mode`
- Collapsed sections Set → key `manifest-collapsed-sections` (JSON array)
- Collapsed books Set → key `manifest-collapsed-books` (JSON array)

On mount, if `manifest-selected-item` exists, fetch that item and restore to detail view with the persisted tab/view/filter state.

#### 1C. "Continue Where You Left Off" Banner
**Files:** `Manifest.tsx` (new section in list view render)

When the user returns to Manifest and there is a persisted `selectedItem` + `activeTab`:
- Show a banner at the top of the list view: **"Continue: [Book Title] — [Tab Name], [View Mode]"**
- Single tap jumps directly to that book's detail view with the right tab selected.
- Small "×" to dismiss the banner (clears sessionStorage keys).
- Banner is a simple card component, not a modal or toast.

#### 1D. Scroll Position Persistence
**Files:** `ExtractionsView.tsx`, `ExtractionTabs.tsx`, `ManifestItemDetail.tsx`

Save scroll position to sessionStorage on:
- Tab switch (save outgoing tab's scroll, restore incoming tab's scroll)
- Navigation away from detail view
- Component unmount

Restore on:
- Component mount (if returning to same book/tab)
- Tab switch (restore incoming tab's saved position)

Key format: `manifest-scroll-${itemId}-${tab}-${viewMode}`

Use a `useRef` for the scrollable container + `useEffect` cleanup for save.

### Requirements (Phase 1)

| # | Requirement | How to Test |
|---|------------|-------------|
| 1A-1 | Library layout preference (compact/grid) persists across page refresh | Set to grid → refresh → should still be grid |
| 1A-2 | Group mode (by_folder/all_books) persists across page refresh | Set to all_books → refresh → should still be all_books |
| 1A-3 | Sort option persists across page refresh | Set to name_asc → refresh → should still be name_asc |
| 1B-1 | Navigating to another page and back restores the selected book detail view | Open a book → go to Journal → come back → same book should be showing |
| 1B-2 | Active extraction tab persists across page navigation | Be on "Action Steps" tab → navigate away → return → still on Action Steps |
| 1B-3 | Extraction view mode (tabs/chapters/notes) persists | Be in chapters view → navigate away → return → still in chapters view |
| 1B-4 | Filter mode (all/hearted) persists | Set to hearted → navigate away → return → still hearted |
| 1B-5 | Collapsed section state persists across page navigation | Collapse chapters 1, 3, 5 → navigate away → return → same chapters collapsed |
| 1C-1 | "Continue" banner appears when returning to Manifest with a previously-viewed book | Open book → navigate away → return to Manifest list → banner shows with book title |
| 1C-2 | Tapping the banner restores the full browsing state | Tap banner → should jump to book detail with correct tab, view mode, and filter |
| 1C-3 | Dismissing the banner clears the persisted state | Tap "×" → banner gone, sessionStorage keys cleared |
| 1C-4 | Banner does not appear on first visit or when no book was previously viewed | Fresh session → no banner |
| 1D-1 | Scroll position saved when switching tabs | Scroll down on Summary → switch to Frameworks → switch back → scroll position restored |
| 1D-2 | Scroll position saved when navigating away from detail view | Scroll deep into chapter → go to Journal → return → scroll position restored |
| 1D-3 | Scroll position is per-tab and per-view-mode | Scroll positions for Summary-tabs and Summary-chapters are independent |
| 1-SAFE-1 | All existing Manifest functionality still works (upload, extract, heart, delete, edit, note, send-to-mast/compass/prompts) | Full manual regression |
| 1-SAFE-2 | localStorage errors (private browsing, storage full) are caught silently | Test in incognito — app should work fine with defaults |

---

## Phase 2: Content-First Layout & Reduced Navigation Depth

### What It Does
Reorganizes ManifestItemDetail so extracted content is front-and-center. Reduces the number of sections a user must scroll past to reach what they came for.

### Changes

#### 2A. Reorder ManifestItemDetail Sections
**Files:** `ManifestItemDetail.tsx`, `ManifestItemDetail.css`

Current order (top to bottom):
1. Header (title, author, metadata)
2. Tags
3. Genres
4. Usage designations (DEPRECATED)
5. Folder group
6. Content preview
7. About This Book
8. Parts section
9. Actions (reprocess, archive, delete)
10. Extraction discovery/checklist
11. **ExtractionTabs** ← the thing the user wants
12. Apply section (discuss, generate goals, etc.)

New order:
1. Header (title, author, metadata) — compact, one line where possible
2. **ExtractionTabs** ← moved to position 2
3. Apply section (discuss, generate goals, etc.)
4. Collapsible "Book Info" section containing:
   - About This Book (summary + TOC)
   - Tags
   - Genres
   - Folder group
   - Content preview
   - Parts section
   - Actions (reprocess, archive, delete)
5. Extraction discovery/checklist (only shown when extraction_status !== 'completed')

#### 2B. Remove Deprecated Usage Designations from UI
**Files:** `ManifestItemDetail.tsx`, `ManifestItemCard.tsx`

Remove the usage designations display from both detail and card views. The column stays in the database (backward compatible) but nothing renders it. This was already documented as DEPRECATED in CLAUDE.md.

#### 2C. Compact Header
**Files:** `ManifestItemDetail.tsx`, `ManifestItemDetail.css`

Condense the header:
- Back button + title + author on one row (title truncates with ellipsis on mobile)
- File type icon, status badge, and date as small inline metadata below
- ISBN moves into the "Book Info" collapsible section

### Requirements (Phase 2)

| # | Requirement | How to Test |
|---|------------|-------------|
| 2A-1 | ExtractionTabs is the first content section visible below the header | Open an extracted book → extractions should be immediately visible without scrolling |
| 2A-2 | "Book Info" section is collapsible and defaults to collapsed | Open book → Book Info section shows as collapsed accordion |
| 2A-3 | All Book Info contents (summary, TOC, tags, genres, folder, content preview, parts, actions) are accessible in the collapsed section | Expand Book Info → all sections present and functional |
| 2A-4 | Extraction discovery/checklist only appears when extraction_status is not 'completed' | Book with completed extraction → no discovery UI visible. Book without → discovery UI shows above extractions area |
| 2B-1 | Usage designations no longer display on ManifestItemCard | Check all book cards — no usage designation badges |
| 2B-2 | Usage designations no longer display on ManifestItemDetail | Check book detail — no usage designation section |
| 2C-1 | Header fits on one line on mobile (320px width) | Resize browser → title truncates, no line wrap for metadata |
| 2C-2 | All header info (title, author, status, date) still accessible | All metadata visible, just more compact |
| 2-SAFE-1 | Editing title/author/tags/genres/folder still works from Book Info section | Edit each field → saves correctly |
| 2-SAFE-2 | Reprocess, archive, delete still work from Book Info section | Test each action → works as before |
| 2-SAFE-3 | ExtractionTabs receives all the same props and handlers as before | All tab actions (heart, delete, edit, note, go deeper, re-run, send-to) work |

---

## Phase 3: Sticky Headers & Chapter Jump Navigation

### What It Does
Adds sticky section headers during scroll and a quick-jump chapter overlay for navigating long extraction lists.

### Changes

#### 3A. Sticky Section Headers
**Files:** `ExtractionTabs.css`, `ExtractionsView.css`

Add `position: sticky; top: 0; z-index: 5;` to section headers (`.extraction-tab__section-header` and `.extractions-view__chapter-heading`).

- Background color uses `var(--color-cream)` or page background variable (prevents text bleed-through)
- Subtle bottom border using `var(--color-slate-gray)` at low opacity when stuck (no hardcoded rgba)
- On mobile, max height ~40px to minimize viewport consumption
- `scroll-margin-top` on section content to account for sticky header height when using anchor links

#### 3B. Chapter Jump Overlay (TOC Drawer)
**Files:** New component `src/components/manifest/ChapterJumpOverlay.tsx` + CSS, wire into `ExtractionTabs.tsx` and `ExtractionsView.tsx`

A floating button (bottom-right, above the Discuss FAB if present) that opens a bottom sheet listing all chapters/sections for the current book.

**Bottom sheet contents:**
- Book title at top (small, gray)
- List of chapter titles with item counts per chapter
- Current chapter highlighted (determined by scroll position via IntersectionObserver)
- Tapping a chapter: sheet dismisses, smooth scroll to that section
- "Back to top" at the bottom of the list

**Trigger button:**
- Only visible when the book has 3+ sections
- Small circular button with a list/TOC icon
- Position: fixed, bottom-right, z-index 15 (above content, below modals)

**Scroll spy:**
- Use IntersectionObserver on section headers to track which section is currently visible
- Update the highlighted chapter in the overlay accordingly
- Lightweight — one observer with multiple entries, not one per section

#### 3C. Lateral Part Navigation
**Files:** `ManifestItemDetail.tsx`, `ManifestItemDetail.css`

When viewing a part of a multi-part book:
- Add Previous/Next part buttons in the header (← Part 2 of 5 →)
- Buttons navigate directly to adjacent part without going through parent
- At first part: Previous disabled. At last part: Next disabled.
- Part number and total shown between buttons

### Requirements (Phase 3)

| # | Requirement | How to Test |
|---|------------|-------------|
| 3A-1 | Section headers stick to the top when scrolling through extraction content | Scroll within a tab with multiple chapters → header sticks |
| 3A-2 | Sticky header shows correct chapter name as user scrolls | Scroll past Chapter 1 into Chapter 2 → Chapter 2 header sticks |
| 3A-3 | Sticky header has background color (no content bleed-through) | Scroll so items pass behind header → text not visible through it |
| 3A-4 | Sticky header is ≤40px tall on mobile | Inspect on 375px width — header fits without consuming too much viewport |
| 3B-1 | Chapter jump button appears for books with 3+ sections | Book with 5 chapters → button visible. Book with 1 section → no button |
| 3B-2 | Tapping chapter jump button opens bottom sheet with chapter list | Tap → sheet slides up with chapter titles and counts |
| 3B-3 | Current chapter is highlighted in the overlay | Scroll to Chapter 4 → open overlay → Chapter 4 highlighted |
| 3B-4 | Tapping a chapter in the overlay scrolls to it | Tap Chapter 7 → sheet closes, page smooth-scrolls to Chapter 7 |
| 3B-5 | "Back to top" scrolls to the start | Tap → scrolls to top of extraction content |
| 3B-6 | Chapter jump button doesn't overlap the Discuss FAB | Both visible → no overlap, stacked vertically with gap |
| 3C-1 | Previous/Next buttons appear on part detail view | View Part 3 of 5 → "← Part 2 of 5 →" in header |
| 3C-2 | Tapping Next navigates to the next part | Tap → Part 4 loads directly |
| 3C-3 | Tapping Previous navigates to the previous part | Tap → Part 2 loads directly |
| 3C-4 | Previous disabled on Part 1, Next disabled on last part | Correct disabled states at boundaries |
| 3-SAFE-1 | Section collapse/expand still works with sticky headers | Tap collapsed header → expands, scroll continues normally |
| 3-SAFE-2 | Go Deeper and Re-run buttons still accessible below sections | Scroll to section bottom → buttons present and functional |
| 3-SAFE-3 | Existing ManifestItemDetail back navigation unaffected | Back button returns to parent or list as before |

---

## Phase 4: Content Type Visual Differentiation & Content Preview Improvements

### What It Does
Makes content types instantly distinguishable via visual cues. Adds content clamping to the raw book content preview section (the messy raw text dump), NOT to extraction items. Extraction items always show full text.

### Changes

#### 4A. Content Type Visual System
**Files:** `ExtractionTabs.tsx`, `ExtractionTabs.css`, `ExtractionsView.tsx`

Define a visual identity for each major content type. **All colors must use CSS custom properties.**

| Content Type | Left Border Color | Icon | Badge Background |
|-------------|------------------|------|-----------------|
| Key Concept / Insight / Theme | `var(--color-mid-teal)` | Lightbulb | `var(--color-mid-teal)` at 10% opacity |
| Story / Metaphor / Character | `var(--color-cognac)` | BookOpen | `var(--color-cognac)` at 10% opacity |
| Lesson / Principle / Exercise | `var(--color-dark-teal)` | Compass | `var(--color-dark-teal)` at 10% opacity |
| Quote | `var(--color-slate-gray)` | Quote | `var(--color-slate-gray)` at 10% opacity |
| Declaration (all styles) | `var(--color-cognac)` | Anchor | `var(--color-cognac)` at 10% opacity |
| Reflection / Self-Examination | `var(--color-mid-teal)` | Eye | `var(--color-mid-teal)` at 10% opacity |
| Implementation / Scenario | `var(--color-dark-teal)` | Wrench | `var(--color-dark-teal)` at 10% opacity |
| Discussion | `var(--color-slate-gray)` | Users | `var(--color-slate-gray)` at 10% opacity |
| Practice / Habit / Action | `var(--color-dark-teal)` | CheckCircle | `var(--color-dark-teal)` at 10% opacity |

Implementation:
- 3px left border on each `.extraction-item` colored by content type (via CSS variable)
- Small icon (16px, lucide-react) before the type badge label
- Badge background uses the corresponding CSS variable color at 10% opacity
- Existing "Go Deeper" cognac left border moves to a top-right sparkle icon instead (avoids conflict)

#### 4B. Raw Book Content Preview Clamping
**Files:** `ManifestItemDetail.tsx`, `ManifestItemDetail.css`

The raw book content preview section (where the full PDF/TXT/DOCX text dump is shown) is messy and too long to scroll past. Apply clamping ONLY to this section:
- Default: Show first ~10 lines of raw content with a gradient fade at bottom
- "Show full content" / "Collapse" toggle button below
- EPUB content previews are already clean — leave those unchanged
- File types affected: PDF, TXT, DOCX, MD (the raw extracted text dump)
- This section is already inside the "Book Info" collapsible from Phase 2, so it's double-gated (collapsed by default, and clamped when expanded)

**IMPORTANT: This does NOT apply to extraction items.** Extraction items (summaries, frameworks, action steps, declarations, questions) always display their full text. No line-clamping, no truncation, no "click to expand" on extraction content.

#### 4C. Hearted Item Visual Emphasis
**Files:** `ExtractionTabs.css`

Hearted items get a subtle visual distinction in the "All" filter view:
- Very light warm background using `var(--color-cream)` or theme equivalent
- The heart icon is already cognac/filled — add a thin cognac left accent using `var(--color-cognac)`
- This makes hearted items pop when scanning, without being garish
- **All colors via CSS custom properties** — must work on all three themes

### Requirements (Phase 4)

| # | Requirement | How to Test |
|---|------------|-------------|
| 4A-1 | Each content type has a distinct left border color using CSS variables | Open Summary tab → key concepts have teal border, stories have cognac, etc. Inspect CSS → all colors use var() |
| 4A-2 | Each content type has a small icon before the badge label | Inspect items → icon + label present for each type |
| 4A-3 | Visual distinction is clear in chapters view where types are interleaved | Open chapters view → can quickly scan and identify type by color/icon |
| 4A-4 | Go Deeper items still distinguishable (sparkle icon) | Go Deeper items show sparkle icon at top-right, no border conflict |
| 4A-5 | All visual styling works correctly on all three themes (Captain's Quarters, Deep Waters, Hearthstone) | Switch themes → colors adapt, contrast is readable, no hardcoded values |
| 4B-1 | Raw PDF/TXT/DOCX content preview shows clamped (~10 lines) with gradient fade | Open a PDF book → Book Info → content preview is short with fade |
| 4B-2 | "Show full content" button expands to full raw text | Tap → all raw text visible |
| 4B-3 | "Collapse" button returns to clamped view | Tap → back to ~10 lines |
| 4B-4 | EPUB content preview is unchanged (no clamping) | Open an EPUB book → content preview renders as before |
| 4B-5 | Extraction items (all 5 tabs) always show full text — no truncation | Scroll through all tabs → every item shows complete text, no "click to expand" |
| 4C-1 | Hearted items have subtle visual distinction in "All" view | Scroll list → hearted items stand out with warm background |
| 4C-2 | Hearted items in "Hearted" filter view look normal (no double-emphasis) | Switch to hearted filter → items look standard, not over-styled |
| 4C-3 | Hearted emphasis uses CSS variables and works on all themes | Switch to Deep Waters → emphasis still visible and readable |
| 4-SAFE-1 | All inline actions still work (heart, delete, edit, note, send-to) | Test each action on extraction items |
| 4-SAFE-2 | Animations (heart pulse, delete fade) still work | Heart an item → pulse animation plays. Delete → fade-out |
| 4-SAFE-3 | Export still captures full text | Export → exported text is complete |
| 4-CSS-1 | Zero hardcoded hex/rgba/color values in any new or modified CSS | Grep all changed CSS files for hex codes → none found |

---

## Phase 5: Cross-Book Search & Enhanced Filtering

### What It Does
Adds text and semantic search within extractions, and extends tag-based filtering across all content types.

### Changes

#### 5A. Extraction Text Search (Local)
**Files:** `ExtractionsView.tsx`, `ExtractionsView.css`

Add a search bar at the top of the content area (below tabs, above items):
- Text input with search icon and clear button
- Scope toggle: "This Book" (when one book selected) / "All Selected Books"
- Filters items in real-time as user types (debounced 300ms)
- Matches against item text AND user notes
- Highlighted matching text in results (bold or background highlight)
- Shows result count: "12 items match"
- Empty results: "No extractions match '[query]'"

#### 5B. Semantic Search (AI-Powered Cross-Library Search)
**Files:** `ExtractionsView.tsx`, `ExtractionsView.css`, new utility in `src/lib/rag.ts`

A powerful semantic search mode that uses the existing embedding infrastructure to find content by **meaning**, not just keywords. This is the core differentiator from simple text search.

**Search flow:**
1. User types a natural language query: "goal setting", "my kids won't stop fighting, what would help", "conversations, marriage, children"
2. User selects which content tabs to search across (checkboxes: Frameworks, Action Steps, Questions, Summaries, Declarations — any combination)
3. User selects a **search mode** (see below)
4. Results display in a dedicated results view, organized by **relevance** (default) or **by book** (toggle)

**Three search modes (user selectable):**

| Mode | Label | Behavior | Best For |
|------|-------|----------|----------|
| **Any** (default) | "Any of these" | Splits multi-term input (comma or newline separated) into individual queries, runs each through `generateSearchEmbedding()` + `match_manifest_content()` independently, merges and deduplicates results. Items matching multiple terms rank higher. | Broad exploration: "marriage, kids, relationships" → everything about any of these topics |
| **Together** | "All together" | Embeds the entire input as one phrase. Results must be semantically close to the combined meaning. | Focused queries: "my kids won't stop fighting, what would help" → content about the specific combined concept |
| **Separate** | "Show each separately" | Splits multi-term input, runs each independently, displays results **grouped by search term** with term headers. Each group shows its own results, no merging. | Comparative browsing: see "marriage" results, then "kids" results, then "relationships" results side by side |

**Mode selection UI:**
- Three small pill buttons below the search bar: `Any` | `Together` | `Separate`
- Default: "Any" (broadest, most results)
- Single-term queries behave identically in all three modes (no splitting needed)
- Mode selection persists in sessionStorage for the current browsing session

**Term splitting rules (for "Any" and "Separate" modes):**
- Split on commas, newlines, or semicolons
- Trim whitespace from each term
- Ignore empty terms
- Display parsed terms as removable chips below the search bar so the user can see how their input was interpreted and remove unwanted terms

**Results display:**
- Each result shows: content type icon + badge, full item text, book title + chapter in italic below
- **Any mode:** Results sorted by relevance. Items matching multiple terms show a "matches: marriage, kids" indicator
- **Together mode:** Results sorted by single relevance score
- **Separate mode:** Results grouped under term headers ("marriage", "kids", "relationships"), each group sorted by relevance
- All modes support toggle to reorganize by book instead of relevance/term
- Heart/note/send-to actions available inline on each result (same as normal extraction items)
- Result count: "23 results across 5 books" (Any/Together) or "8 for marriage, 12 for kids, 6 for relationships" (Separate)
- **Export button:** Export filtered results to .md/.txt/.docx (reuses existing `exportExtractions.ts` pipeline). User can export exactly what the search returned — respects current mode and grouping.

**Examples by mode:**

*"marriage, kids, relationships" in Any mode:*
> Returns all content about marriage OR kids OR relationships, merged by relevance. An item about "family communication during conflict" scores high because it's relevant to all three.

*"marriage, kids, relationships" in Together mode:*
> Returns content closest to the combined concept of "marriage, kids, relationships as a whole." Heavily favors items about family dynamics that touch all three.

*"marriage, kids, relationships" in Separate mode:*
> Shows three sections: "marriage" (15 results), "kids" (12 results), "relationships" (9 results). Each section is independent. User can scan each topic and compare.

*"my kids won't stop fighting" in any mode:*
> Single phrase, no splitting. All modes return the same results: conflict resolution frameworks, sibling rivalry action steps, parenting principles, relevant discussion questions.

**Scope:** Always searches the user's entire library (all extracted books). Tab checkboxes filter which content types appear in results.

**"Find Related" per-item action:**
- On any extraction item, a "Find Related" link icon
- Calls `searchManifestContent()` with that item's text as the query
- Shows up to 10 semantically similar items across all books inline
- Each related item shows: book title (italic), chapter, content type badge, text

#### 5C. "Recently Viewed" and "Most Annotated" Sort Options
**Files:** `Manifest.tsx`

Add two new sort options to the book list:
- **Recently Viewed:** Sort by `last_viewed_at` timestamp (new column, see migration)
- **Most Annotated:** Sort by count of items with `user_note` IS NOT NULL + `is_hearted = true` (computed client-side from extraction data, or denormalized count)

Update `last_viewed_at` on `manifest_items` whenever the user opens a book's detail view.

#### 5D. Cross-Content Tagging on Extraction Items
**Files:** `useManifestExtraction.ts`, `ExtractionTabs.tsx`, `ExtractionsView.tsx`

Currently only `ai_framework_principles` have tags. Extend the concept:
- Add `tags TEXT[]` to `manifest_summaries`, `manifest_declarations`, `manifest_action_steps`, `manifest_questions` (migration)
- Auto-generate tags during extraction (extend `manifest-extract` prompts to include 2-3 topic tags per item)
- Display as small chip pills below each item
- Tappable to filter current view to that tag
- User can add/remove tags inline (same pattern as book-level tags)
- ExtractionsView tag filter bar aggregates tags from all selected content types, not just frameworks

### Requirements (Phase 5)

| # | Requirement | How to Test |
|---|------------|-------------|
| 5A-1 | Text search bar appears in ExtractionsView | Open extractions → search bar visible below tabs |
| 5A-2 | Typing filters items in real-time (local text match) | Type "leadership" → only items containing "leadership" shown |
| 5A-3 | Search matches against both text and user notes | Add note with "important" on item → search "important" → item appears |
| 5A-4 | Matching text is highlighted in results | Search "patience" → word highlighted in matching items |
| 5A-5 | Result count shown | "12 items match 'patience'" displayed |
| 5A-6 | Clear button resets search | Tap × → all items visible again |
| 5B-1 | Semantic search mode available (distinct from text search) | Toggle or button switches to semantic/AI search mode |
| 5B-2 | User can select which content tabs to search (checkboxes for Frameworks, Action Steps, Questions, Summaries, Declarations) | Check Frameworks + Questions → search only returns those types |
| 5B-3 | Three search mode pills visible: "Any", "Together", "Separate" | Pills appear below search bar, "Any" selected by default |
| 5B-4 | "Any" mode: multi-term input split and searched independently, results merged | Type "marriage, kids, relationships" → returns items about any of those topics, best matches first |
| 5B-5 | "Any" mode: items matching multiple terms rank higher | Item about "family communication" (matches all 3) appears above item about only "kids" |
| 5B-6 | "Any" mode: multi-match indicator shown on results | Items show "matches: marriage, kids" chip when relevant to multiple terms |
| 5B-7 | "Together" mode: entire input searched as one phrase | Type "marriage, kids, relationships" → results favor items about the combined family dynamics concept |
| 5B-8 | "Separate" mode: results grouped by search term with headers | Type "marriage, kids, relationships" → three sections with counts: "marriage (15)", "kids (12)", "relationships (9)" |
| 5B-9 | Parsed terms shown as removable chips below search bar (Any/Separate modes) | Type "marriage, kids" → two chips appear, each removable |
| 5B-10 | Removing a term chip updates results immediately | Remove "kids" chip → results refresh without kids-related items |
| 5B-11 | Single-term queries behave identically in all modes | Type "goal setting" → same results regardless of mode |
| 5B-12 | All modes support toggle to organize by book | Toggle "By Book" → results grouped under book headers |
| 5B-13 | Results are exportable (.md/.txt/.docx) respecting current mode/grouping | Tap export in Separate mode → exported file has term-grouped sections |
| 5B-14 | Heart/note/send-to actions work on search results | Heart an item in results → it's hearted. Send to Compass → task created |
| 5B-15 | Search mode persists in sessionStorage | Select "Separate" → navigate away → return → still "Separate" |
| 5B-16 | Natural language query returns semantically relevant results | Search "my kids won't stop fighting" → returns parenting/conflict content |
| 5B-17 | "Find Related" action on individual extraction items | Tap "Find Related" on any item → shows semantically similar items from other books |
| 5B-18 | Related items show book title, chapter, and content type | Each related item attributed correctly |
| 5C-1 | "Recently Viewed" sort option available in book list | Sort dropdown → "Recently Viewed" option present |
| 5C-2 | Books sorted by last viewed time (most recent first) | View 3 books in order A, B, C → sort by recently viewed → C, B, A |
| 5C-3 | "Most Annotated" sort option available | Sort dropdown → "Most Annotated" option present |
| 5C-4 | Books with more notes/hearts appear first in "Most Annotated" | Book with 10 notes above book with 2 notes |
| 5D-1 | Extraction items show auto-generated topic tags | After extraction → items have 2-3 topic tag chips |
| 5D-2 | Tapping a tag filters the view to that tag | Tap "leadership" tag → only items tagged "leadership" shown |
| 5D-3 | User can add/remove tags on extraction items | Add "personal" tag → saves. Remove tag → saves |
| 5D-4 | Tag filter bar aggregates tags from all content types | Tags from summaries, frameworks, action steps, declarations, questions all appear |
| 5-SAFE-1 | Existing framework tag filtering still works | Framework tab → tag chips → filter → works as before |
| 5-SAFE-2 | Existing book-level tag filtering still works | ManifestFilterBar → tag filter → works as before |
| 5-SAFE-3 | Search doesn't interfere with filter mode (all/hearted) | Search + hearted filter → shows only hearted items matching query |

---

## Phase 6: Desktop Sidebar Navigation & Spaced Resurfacing

### What It Does
Adds a persistent book/chapter sidebar on desktop and integrates extracted content into the daily rhythm for spaced resurfacing.

### Changes

#### 6A. Desktop Sidebar (Book + Chapter Tree)
**Files:** New component `src/components/manifest/ManifestSidebar.tsx` + CSS, wire into `Manifest.tsx`

On screens ≥768px wide, when viewing a book's detail:
- Left sidebar (280px wide, collapsible) showing:
  - "Library" link at top (returns to list view)
  - **Recently Viewed** section (last 5 books, most recent first)
  - **Current Book** section with chapter tree (expandable)
    - Each chapter shows extraction tab counts
    - Tapping a chapter scrolls the right-side content to that chapter
    - Current chapter highlighted (via scroll spy, reusing the IntersectionObserver from Phase 3)
  - **Hearted Books** section (books with any hearted items)
- Sidebar is a fixed panel; content area scrolls independently
- On screens <768px: sidebar hidden, chapter jump overlay (Phase 3B) serves the same purpose
- Toggle button at top-left of content area to collapse/expand sidebar

#### 6B. Spaced Resurfacing in Reveille
**Files:** `src/hooks/useRhythms.ts`, `src/components/reveille/ManifestResurfacingCard.tsx` + CSS

Add a "From Your Library" card to Reveille that surfaces 1-3 hearted extraction items:

**Selection algorithm:**
1. Query all `is_hearted = true` items across summaries, declarations, action_steps, questions, framework_principles
2. Exclude items shown in the last 3 days (tracked via `manifest_resurfacing_log` or a simple JSONB array on user_settings)
3. Prefer items from books the user has viewed recently (weighted random)
4. Mix content types (don't show 3 frameworks — show 1 framework + 1 declaration + 1 question)

**Card display:**
- "From Your Library" header
- 1-3 items, each showing:
  - Content type icon + badge
  - Item text (full, not truncated)
  - Book title + chapter in small italic below
  - Heart icon (already hearted, shown filled)
- "See more" link → opens HeartedItemsView
- Dismissable like other Reveille cards

#### 6C. "Manifest Resurfacing" in Reckoning
**Files:** `src/hooks/useRhythms.ts`, Reckoning page

Add a "Library Reflection" section to Reckoning (evening):
- Shows 1-2 different hearted items (not the same as Reveille)
- Warm framing: "Something from your reading to sit with tonight"
- "Save reflection" action → creates journal entry with the item text + user's reflection

### Requirements (Phase 6)

| # | Requirement | How to Test |
|---|------------|-------------|
| 6A-1 | Desktop sidebar appears on screens ≥768px when viewing book detail | Open book on desktop → sidebar visible with library link and chapter tree |
| 6A-2 | Sidebar is hidden on mobile (<768px) | Open book on phone → no sidebar, chapter jump button instead |
| 6A-3 | Recently Viewed section shows last 5 books | View 6 books → sidebar shows most recent 5 |
| 6A-4 | Tapping a chapter in sidebar scrolls content to that chapter | Tap Chapter 5 → content scrolls to Chapter 5 |
| 6A-5 | Current chapter highlighted in sidebar during scroll | Scroll through content → sidebar highlight follows |
| 6A-6 | Sidebar is collapsible | Tap toggle → sidebar collapses, content area expands |
| 6A-7 | Sidebar collapse state persists in session | Collapse → navigate away → return → still collapsed |
| 6B-1 | "From Your Library" card appears in Reveille when hearted items exist | Have hearted items → card appears in morning briefing |
| 6B-2 | Card shows 1-3 items with content type, text, and book attribution | Card displays items correctly |
| 6B-3 | Items are not repeated within 3 days | Check 3 consecutive days → different items each day |
| 6B-4 | Card does not appear when no hearted items exist | No hearted items → no card |
| 6B-5 | "See more" opens HeartedItemsView | Tap → navigates to hearted items |
| 6C-1 | "Library Reflection" appears in Reckoning with different items than Reveille | Morning and evening items are different |
| 6C-2 | "Save reflection" creates a journal entry | Write reflection → save → journal_entries record created |
| 6-SAFE-1 | Existing Reveille cards unaffected | All other Reveille sections still render and function |
| 6-SAFE-2 | Existing Reckoning flow unaffected | All other Reckoning sections still render and function |
| 6-SAFE-3 | Chapter jump overlay (Phase 3B) still works on mobile | Mobile → chapter jump button visible and functional |

---

## Migration Plan

### Migration A (Phase 1): No migration needed
All persistence is localStorage/sessionStorage.

### Migration B (Phase 5): `manifest_browsing_enhancements`
```sql
-- Add last_viewed_at to manifest_items for "Recently Viewed" sort
ALTER TABLE manifest_items ADD COLUMN last_viewed_at TIMESTAMPTZ;
CREATE INDEX idx_manifest_items_last_viewed ON manifest_items (user_id, last_viewed_at DESC NULLS LAST);

-- Add tags to extraction tables for cross-content tagging
ALTER TABLE manifest_summaries ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_declarations ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_action_steps ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE manifest_questions ADD COLUMN tags TEXT[] DEFAULT '{}';

-- GIN indexes for tag queries
CREATE INDEX idx_manifest_summaries_tags ON manifest_summaries USING GIN (tags);
CREATE INDEX idx_manifest_declarations_tags ON manifest_declarations USING GIN (tags);
CREATE INDEX idx_manifest_action_steps_tags ON manifest_action_steps USING GIN (tags);
CREATE INDEX idx_manifest_questions_tags ON manifest_questions USING GIN (tags);
```

### Migration C (Phase 6): `manifest_resurfacing`
```sql
-- Track resurfaced items to avoid repetition
ALTER TABLE user_settings ADD COLUMN manifest_resurfaced_ids JSONB DEFAULT '[]';
-- Format: [{ id: string, table: string, shown_at: string }]
-- Cleanup: remove entries older than 7 days on each query
```

---

## Implementation Order

```
Phase 1 (State Persistence)          ← No migration, no new components, lowest risk
  ↓
Phase 2 (Content-First Layout)       ← Reorder existing sections, no new data
  ↓
Phase 3 (Sticky Headers + Jump)      ← CSS changes + 1 new small component
  ↓
Phase 4 (Visual Differentiation)     ← CSS + minor render logic changes
  ↓
Phase 5 (Search + Tagging)           ← Migration B, new functionality
  ↓
Phase 6 (Sidebar + Resurfacing)      ← Migration C, new components, integrates with Reveille/Reckoning
```

Each phase is independently testable and deployable. Later phases build on earlier ones but don't modify earlier work.

---

## Files Modified Per Phase

### Phase 1
- `src/pages/Manifest.tsx` (state initialization, sessionStorage save/restore, banner component)
- `src/components/manifest/ExtractionsView.tsx` (sessionStorage for tab/view/filter/collapse)
- `src/components/manifest/ExtractionTabs.tsx` (sessionStorage for collapse, scroll save/restore)
- `src/components/manifest/ManifestItemDetail.tsx` (scroll save/restore)

### Phase 2
- `src/components/manifest/ManifestItemDetail.tsx` (section reorder, Book Info collapsible)
- `src/components/manifest/ManifestItemDetail.css` (layout changes)
- `src/components/manifest/ManifestItemCard.tsx` (remove usage designation display)

### Phase 3
- `src/components/manifest/ExtractionTabs.css` (sticky headers)
- `src/components/manifest/ExtractionsView.css` (sticky headers)
- New: `src/components/manifest/ChapterJumpOverlay.tsx` + `.css`
- `src/components/manifest/ExtractionTabs.tsx` (wire chapter jump)
- `src/components/manifest/ExtractionsView.tsx` (wire chapter jump)
- `src/components/manifest/ManifestItemDetail.tsx` (lateral part navigation)

### Phase 4
- `src/components/manifest/ExtractionTabs.tsx` (content type icons + badges)
- `src/components/manifest/ExtractionTabs.css` (left borders, badge colors, hearted emphasis — all via CSS variables)
- `src/components/manifest/ExtractionsView.tsx` (same content type visual system)
- `src/components/manifest/ManifestItemDetail.tsx` (raw content preview clamping for PDF/TXT/DOCX/MD)
- `src/components/manifest/ManifestItemDetail.css` (content clamp styles)

### Phase 5
- `src/components/manifest/ExtractionsView.tsx` (search bar, tag filter expansion)
- `src/components/manifest/ExtractionsView.css` (search bar styles)
- `src/hooks/useManifestExtraction.ts` (tag CRUD on extraction items)
- `src/lib/rag.ts` (Find Related utility)
- `src/pages/Manifest.tsx` (new sort options, last_viewed_at update)
- `supabase/migrations/` (Migration B)
- Edge Function: `manifest-extract` (add tag generation to prompts)

### Phase 6
- New: `src/components/manifest/ManifestSidebar.tsx` + `.css`
- `src/pages/Manifest.tsx` (wire sidebar on desktop)
- New: `src/components/reveille/ManifestResurfacingCard.tsx` + `.css`
- `src/hooks/useRhythms.ts` (resurfacing query)
- `src/pages/Reveille.tsx` (wire resurfacing card)
- `src/pages/Reckoning.tsx` (wire reflection section)
- `supabase/migrations/` (Migration C)

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Phase 2 section reorder breaks extraction handler props | All handlers defined in ManifestItemDetail — just moving JSX, not changing data flow |
| Sticky headers interfere with existing collapse animation | Test collapse within sticky context. Use `z-index: 5` (below modals at 200) |
| sessionStorage limits (~5MB) exceeded by collapse state | Collapse state is small (Set of strings). Monitor size. |
| Scroll restoration fails on dynamic content (lazy load) | Only restore after extraction data has loaded (guard with `useEffect` dependency) |
| Content type icon imports increase bundle size | lucide-react icons are tree-shaken. ~200 bytes per icon. Negligible. |
| Phase 5 migration on active tables | ALTER TABLE ADD COLUMN with DEFAULT is safe on PostgreSQL — no table rewrite |
| Spaced resurfacing query performance | Query is bounded (hearted items only, user-scoped RLS, 3-item limit) |

---

## Pre-Phase: PWA Library Shortcut (COMPLETED)

Separate home screen icon for direct Manifest access.

### What Was Done
- **New app icons:** White nautical S logo (main StewardShip app) and black nautical S logo (Library shortcut), generated at 96/192/512px sizes
- **`manifest.json` updated:** Added `shortcuts` array with "My Library" entry pointing to `/manifest` with black S icon. Long-press on Android shows the shortcut.
- **`manifest-library.json` created:** Standalone PWA manifest with `start_url: "/manifest"` and black S icons. When user navigates to `/manifest` in browser and taps "Add to Home Screen," they get a separate "My Library" icon.
- **Dynamic manifest swap:** `Manifest.tsx` swaps the `<link rel="manifest">` to `manifest-library.json` on mount, reverts on unmount. This makes the browser's "Add to Home Screen" use the library manifest when on the Manifest page.

### Files Changed
- `public/manifest.json` — added shortcuts array
- `public/manifest-library.json` — new file
- `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png` — replaced with white S logo
- `public/icons/manifest-shortcut-96.png`, `manifest-shortcut-192.png`, `manifest-shortcut-512.png` — new black S icons
- `src/pages/Manifest.tsx` — manifest swap useEffect

### Requirements (Pre-Phase)

| # | Requirement | How to Test |
|---|------------|-------------|
| PWA-1 | Main StewardShip app icon uses the white nautical S logo | Install PWA → home screen shows white S |
| PWA-2 | Long-press on Android StewardShip icon shows "My Library" shortcut | Long-press → shortcut appears with black S icon |
| PWA-3 | Tapping the "My Library" shortcut opens directly to /manifest | Tap → Manifest page loads |
| PWA-4 | "Add to Home Screen" while on /manifest creates a separate "My Library" icon with black S | Navigate to /manifest in browser → Add to Home Screen → separate icon appears |
| PWA-5 | Navigating away from /manifest restores the main manifest.json | Go to /manifest → navigate to another page → manifest link reverts |

---

## Non-Goals (Explicitly Out of Scope)

- Full-text search via PostgreSQL `tsvector` on extraction tables (semantic search is sufficient)
- Drag-to-reorder extraction items (content order comes from AI extraction)
- Collaborative / multi-user extraction sharing (post-MVP)
- Print/PDF export of individual chapters (existing export covers this)
- AI-powered "quiz me on this book" (different feature)
- Readwise-style SRS with configurable half-lives (too complex for this phase)
- Mobile sidebar (chapter jump overlay serves this role)

---

*End of PRD-25*
