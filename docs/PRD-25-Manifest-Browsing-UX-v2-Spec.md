# PRD-25: Manifest Browsing & Extraction UX — Complete Specification

> **Status:** Built (v1), reference specification for v2 rebuild
> **Last Updated:** 2026-03-19
> **Purpose:** Every component, button, route, and behavior documented for v2 recreation without separate-view inconsistencies.

---

## Core Rule: Feature Parity

**Any capability for reading/browsing books on the book detail page MUST also exist on the ExtractionsView page, and vice versa.** In v2, these should share rendering components rather than having parallel implementations.

---

## 1. Entry Points & Navigation

### 1.1 Manifest Library Page (`/manifest`)

**What it shows:** Grid or compact list of all uploaded books.

**Search bar** (top of list):
- Placeholder: "Search by title, author, or topic..."
- Matches: title, author, tags, AI summary, genres
- When no results: shows "Search inside all books for '[query]'" button → opens Semantic Search modal

**Sort options** (dropdown):
- Newest, Oldest, Name A-Z, Name Z-A, Has Extractions, Recently Viewed, Most Annotated
- Persisted to `user_settings` via Supabase

**Layout toggles:** Compact (rows) / Grid (cards)
**Group mode:** By Folder / All Books
**All persisted** to `user_settings`

**Action buttons** (row below header, shown when books with extractions exist):
- **Upload** — opens upload flow
- **Discuss Books** — opens BookSelector → BookDiscussionModal
- **Search Library** — opens SemanticSearch modal overlay
- **Refresh All Key Points** — loops through every extracted book, calls `manifest-key-points` Edge Function per book, shows progress "3 of 12: Book Title"

**"Continue Where You Left Off" banner:**
- Appears when returning to Manifest with a previously-viewed book in sessionStorage
- Shows book title, active tab, view mode
- One tap restores full browsing state
- Dismiss button (×) clears sessionStorage

**PWA shortcut:**
- `manifest.json` has `shortcuts` array with "My Library" entry
- `manifest-library.json` for standalone home screen icon (black S logo)
- Dynamic manifest swap in Manifest.tsx on mount/unmount

### 1.2 Book Detail Page (ManifestItemDetail)

**Accessed from:** Clicking a book on Manifest library page.

**Layout (desktop ≥768px):** Flex row — ManifestSidebar (left, sticky) + ManifestItemDetail (right, scrollable).
**Layout (mobile):** ManifestItemDetail only + ChapterJumpOverlay FAB (bottom-left).

**Section order (top to bottom):**
1. **Back button** + lateral part navigation (Previous/Next for multi-part books)
2. **Header:** Title (editable), author (editable), file type icon, status badge, date
3. **ExtractionTabs** (the main content — see Section 2)
4. **Apply This section** (see Section 3)
5. **Collapsible "Book Info"** (defaults collapsed):
   - Tags (add/remove chips)
   - Content preview (text files only, clamped)
   - About This Book (AI summary, TOC, ISBN)
   - Parts section (multi-part books)
   - Actions (reprocess, archive, delete, push to family)
6. **Extraction discovery/checklist** (only when extraction_status !== 'completed')
7. **Floating Discuss FAB** (right side, desktop only)

### 1.3 ExtractionsView Page (`/library/extractions`)

**Accessed from:** Collections, "My Hearted Items", or direct navigation.

**Header:**
- Back to Library button (left)
- Title ("Extractions" or collection name)
- **Discuss button** (top-right) — opens BookDiscussionModal with selected books

**Book selector** (collapsible panel):
- Checkbox list of extracted books
- Search by book title/tags
- Book tag filter chips
- Select All / Clear buttons

**Collection chips** (above book selector):
- Shows all collections as pill buttons
- Tap to select all books in that collection (toggle)
- Active collection highlighted

**Controls row:**
- All / Hearted filter toggle
- **Abridged / Full Content** toggle
- **Refresh Key Points** button
- View mode toggle: Tabs / Chapters / Notes

**Search bar:** "Search extractions..." — filters items by text + notes

**Desktop sidebar** (≥768px, left, sticky):
- Chapter tree for selected books
- Multi-book: book titles as headers with chapters nested
- Click chapter → scroll to that section

**Mobile:** ChapterJumpOverlay FAB (bottom-left) — bottom sheet with chapter list

---

## 2. ExtractionTabs — Content Browsing Component

**Used in:** Book detail page AND ExtractionsView (must have identical behavior in both).

### 2.1 Five Content Tabs

Horizontal scrollable tab bar:
- **Summary** (key concepts, stories, metaphors, lessons, quotes, insights, themes)
- **Frameworks** (principles extracted from content)
- **Action Steps** (exercises, practices, habits, prompts, projects)
- **Mast Content / Declarations** (5 declaration styles)
- **Questions** (reflection, implementation, recognition, self-examination, discussion, scenario)

Each tab shows item count badge. Counts reflect current filters (abridged, search, hearted).

### 2.2 Search Bar

"Search this book..." (book detail) / "Search extractions..." (ExtractionsView)
- Filters all 5 content types as you type
- Matches item text + user notes
- Tab counts update live
- Clear button (×)

### 2.3 Filter Controls

**All / Hearted toggle:** Show all items or only hearted items.

**Abridged / Full Content toggle:**
- **Default: Abridged** (on first visit)
- Abridged shows: items where `is_key_point = true` OR `is_hearted = true`
- Fallback: if no key points in a section, shows first 2 items
- "See N more" button per section to expand just that section
- "Key points only" button to collapse back
- Each section expands independently
- Persisted to sessionStorage (`manifest-abridged-v2`)

**View mode toggle:** Tabs / Chapters / Notes
- **Tabs:** Items grouped by section within the active tab
- **Chapters:** All content types grouped under chapter headings
- **Notes:** Only items with user annotations

### 2.4 Abridged Mode Behavior

**Chapters default expanded** in abridged mode (easy scroll, 2-3 items per section per type).
**Chapters default collapsed** in full content mode (pick your chapter).
Toggling between modes dynamically expands/collapses all sections.

**"See more" button** appears under each section (tabs view) or each content-type group within a chapter (chapters view):
- Shows count: "See 8 more"
- Tap → that section/type expands to show all items
- Changes to: "Key points only"
- Tap → collapses back to key points
- Each section independent

### 2.5 Content Type Visual System

Each extraction item has:
- **Left border color** by content type (teal for concepts, cognac for stories/declarations, dark teal for principles/actions, slate for quotes)
- **Type icon** (Lightbulb, BookOpen, Compass, Quote, Eye, Wrench, Users, CheckCircle, Anchor) — 16px before badge label
- **Type badge** (uppercase small label)
- **Tag chips** (if tags exist on the item)
- **Hearted emphasis** (subtle warm background when `is_hearted = true`)
- **Go Deeper indicator** (sparkle icon top-right for `is_from_go_deeper = true`)

### 2.6 Item Actions (identical in all views)

Every extraction item has these action buttons (icon-only, horizontal row):
- **Heart** (toggle `is_hearted`) — cognac when active, pulse animation
- **Note** (sticky note icon) — opens inline textarea for `user_note`
- **Delete** (trash icon) — sets `is_deleted = true`, fade-out animation
- **Send to Compass** (compass icon, action steps only) — creates `compass_tasks` record
- **Send to Mast** (anchor icon, declarations only) — creates `mast_entries` record
- **Send to Prompts** (book icon, questions only) — creates `journal_prompts` record

"Already sent" state shows subtle italic text ("In Compass", "In Mast", "In Prompts").

All action buttons use identical styling: `background: none; border: none; padding: 2px; display: flex; color: var(--color-slate-gray)`.

### 2.7 Section Headers

**Sticky** (`position: sticky; top: 0; z-index: 5`) with background color to prevent text bleed-through. Both in tabs view (section headers) and chapters view (chapter headers).

### 2.8 Scroll Position Persistence

Saved to sessionStorage on:
- Tab switch (saves outgoing, restores incoming)
- Navigation away from detail view
- Component unmount

Key format: `manifest-scroll-${itemId}-${tab}-${viewMode}`

Restored after data loads (guarded by `useEffect` with data dependency).

---

## 3. Apply This Section

**Shown on:** Book detail page (below ExtractionTabs) AND ExtractionsView (buttons distributed in controls row / header).

**Buttons:**
- **Discuss Book** — opens BookDiscussionModal (on book detail: in Apply section + floating FAB; on ExtractionsView: top-right header button)
- **Generate Goals** → opens BookDiscussionModal with type `generate_goals`
- **Generate Questions** → type `generate_questions`
- **Generate Tasks** → type `generate_tasks`
- **Generate Tracker** → type `generate_tracker` (post-MVP)
- **Refresh Key Points** — calls `manifest-key-points` Edge Function, re-fetches extractions (on book detail: in Apply section; on ExtractionsView: in controls row)

---

## 4. Key Points System

### 4.1 Database

`is_key_point BOOLEAN DEFAULT false` on all 5 extraction tables:
- `manifest_summaries`
- `manifest_declarations`
- `manifest_action_steps`
- `manifest_questions`
- `ai_framework_principles`

### 4.2 Setting Key Points

**On new extractions:** `triggerKeyPointsRefresh(manifestItemId)` fires automatically (fire-and-forget) after extraction completes in all 3 paths (extractAll, extractAllSections, extractSectionsForPart).

**On existing books:** "Refresh Key Points" button (per-book in Apply section, or "Refresh All Key Points" on library page for all books).

**Backfill heuristic:** Migration marks first 2 items per section by `sort_order` as key points.

### 4.3 Edge Function: `manifest-key-points`

- Model: Haiku (`anthropic/claude-haiku-4.5`)
- Input: All extracted items for a book, grouped by table + section
- For groups ≤2 items: marks all as key points
- For groups 3+: AI picks 2-3 most essential (returns JSON array of indices)
- Fallback on AI failure: first 2 items
- Cost: ~$0.01-0.02 per book
- Deployed with `--no-verify-jwt`

---

## 5. Semantic Search

### 5.1 SemanticSearch Component

**Accessed from:** "Search Library" button on Manifest page → opens as modal overlay (not full page replacement). Also accessible when book list search has no results ("Search inside all books for...").

**Three modes** (pill buttons):
- **Any of these** (default): splits comma/semicolon/newline terms, searches each independently, merges + deduplicates, items matching multiple terms rank higher
- **All together**: searches entire input as one phrase
- **Show each separately**: splits terms, groups results by term with headers

**Results display:**
- Organized by relevance (default) or by book (toggle)
- Each result: content type label, similarity %, content preview (500 chars), book title + chapter
- **Export button** → downloads `.md` file respecting current mode/grouping

**Uses:** `searchManifestContent()` from `rag.ts` → `match_manifest_content()` DB function (queries 5 tables via HNSW-indexed per-table CTEs).

### 5.2 Text Search

**In ExtractionTabs:** "Search this book..." — filters current book's items
**In ExtractionsView:** "Search extractions..." — filters across all selected books' items
Both match item text + user notes, debounced, with clear button.

---

## 6. Desktop Sidebar Navigation

### 6.1 ManifestSidebar (Book Detail Page)

**Visible:** ≥768px only. **Position:** sticky, left side, 240px wide.

**Contents:**
- "Library" link (returns to list)
- **Recently Viewed** section (last 5 books by `last_viewed_at`)
- **Current Book** chapter tree (expandable, click to scroll)
- **Extracted** books section (quick switch)
- Collapsible (state persisted to sessionStorage)

### 6.2 ExtractionsView Chapter Sidebar

**Visible:** ≥768px only. **Position:** sticky, left side, 220px wide.

**Contents:**
- Chapter tree for ALL selected books
- Multi-book: book titles as headers with chapters nested
- Item counts per chapter
- Click chapter → scroll to that section via `id` attribute on section headers

### 6.3 Mobile: ChapterJumpOverlay

**Visible:** <768px only. **Position:** fixed, bottom-left, 40px circle, teal.
**Trigger:** Tap opens bottom sheet.
**Bottom sheet:**
- Book title (if applicable)
- Chapter list with item counts
- Current chapter highlighted (via IntersectionObserver scroll spy)
- Tap chapter → smooth scroll + dismiss
- "Back to top" at bottom
- Desktop: sheet positioned as popover (400px max-width, bottom-right)
**Shows when:** 3+ sections exist. Shows in both abridged and full content modes. Shows on both book detail and ExtractionsView.

---

## 7. State Persistence

### 7.1 localStorage (survives browser close)

| Key | Value | Used by |
|-----|-------|---------|
| (none for Manifest — uses user_settings DB) | | |

### 7.2 sessionStorage (survives refresh, clears on tab close)

| Key | Value | Used by |
|-----|-------|---------|
| `manifest-selected-item` | Book UUID | Continue banner |
| `manifest-selected-title` | Book title | Continue banner |
| `manifest-active-tab` | Tab name | ExtractionTabs |
| `manifest-extraction-view` | tabs/chapters/notes | ExtractionTabs |
| `manifest-filter-mode` | all/hearted | ExtractionTabs |
| `manifest-abridged-v2` | true/false | ExtractionTabs |
| `manifest-scroll-${id}-${tab}-${view}` | scrollY number | Scroll restore |
| `manifest-sidebar-collapsed` | true/false | ManifestSidebar |
| `manifest-semantic-mode` | any/together/separate | SemanticSearch |
| `manifest-ev-active-tab` | Tab name | ExtractionsView |
| `manifest-ev-filter-mode` | all/hearted | ExtractionsView |
| `manifest-ev-extraction-view` | tabs/chapters/notes | ExtractionsView |
| `manifest-ev-abridged` | true/false | ExtractionsView |
| `manifest-ev-collapsed-sections` | JSON array | ExtractionsView |
| `manifest-ev-collapsed-books` | JSON array | ExtractionsView |

### 7.3 user_settings (DB, cross-device)

| Column | Type | Purpose |
|--------|------|---------|
| `manifest_group_mode` | TEXT | by_folder / all_books |
| `manifest_sort` | TEXT | Sort option |
| `manifest_layout` | TEXT | compact / grid |
| `book_knowledge_access` | TEXT | hearted_only / all_extracted / framework_only / none |
| `manifest_resurfaced_ids` | JSONB | Tracks shown resurfacing items |

### 7.4 manifest_items columns

| Column | Type | Purpose |
|--------|------|---------|
| `last_viewed_at` | TIMESTAMPTZ | "Recently Viewed" sort |

---

## 8. Reveille Integration

### ManifestResurfacingCard ("From Your Library")

**Shows in:** Reveille morning briefing, after existing Manifest devotional reading.
- 1-3 hearted extraction items (summaries, action steps, declarations)
- Mixes content types for variety
- Excludes items shown in last 3 days (tracked via `manifest_resurfaced_ids` JSONB on `user_settings`)
- Weighted random selection
- Shows: content type badge, full text, book title + chapter
- "See more" link → navigates to `/manifest`

---

## 9. Migrations (in order)

| # | File | What |
|---|------|------|
| 066 | `manifest_browsing_enhancements.sql` | `last_viewed_at` on manifest_items, `tags TEXT[]` on 4 extraction tables + GIN indexes |
| 067 | `manifest_resurfacing.sql` | `manifest_resurfaced_ids JSONB` on user_settings |
| 068 | `optimize_match_manifest_chunks.sql` | CTE + INNER JOIN + 8s timeout guard on match_manifest_chunks |
| 069 | `match_content_add_questions.sql` | manifest_questions added to match_manifest_content UNION |
| 070 | `fix_search_path_mutable.sql` | SET search_path on all 14 public functions |
| 071 | `fix_search_path_for_rpc.sql` | Use 'public, extensions' for RPC-callable functions |
| 072 | `fix_search_path_no_spaces.sql` | SET search_path TO (unquoted) for proper resolution |
| 073 | `optimize_match_manifest_content.sql` | Per-table CTE with ORDER BY + LIMIT for HNSW index usage |
| 074 | `increase_content_preview_length.sql` | content_preview 200→500 chars in match_manifest_content |
| 075 | `key_points.sql` | `is_key_point BOOLEAN` on 5 tables + backfill first 2 per section |

---

## 10. Edge Functions

| Function | Purpose | Model | Deploy flag |
|----------|---------|-------|-------------|
| `manifest-key-points` | AI selects 2-3 most important items per section per book | Haiku | `--no-verify-jwt` |

---

## 11. Components Inventory

| Component | File | Used in |
|-----------|------|---------|
| ExtractionTabs | `src/components/manifest/ExtractionTabs.tsx` | Book detail page |
| ExtractionsView | `src/components/manifest/ExtractionsView.tsx` | Multi-book browsing |
| ManifestItemDetail | `src/components/manifest/ManifestItemDetail.tsx` | Book detail page |
| ManifestSidebar | `src/components/manifest/ManifestSidebar.tsx` | Book detail (desktop) |
| ChapterJumpOverlay | `src/components/manifest/ChapterJumpOverlay.tsx` | Both (mobile) |
| SemanticSearch | `src/components/manifest/SemanticSearch.tsx` | Modal from library page |
| ManifestResurfacingCard | `src/components/reveille/ManifestResurfacingCard.tsx` | Reveille |
| ExportDialog | `src/components/manifest/ExportDialog.tsx` | ExtractionsView |
| ManifestItemCard | `src/components/manifest/ManifestItemCard.tsx` | Library list |
| ManifestFilterBar | `src/components/manifest/ManifestFilterBar.tsx` | Library list |

### v2 Recommendation: Shared Rendering

In v2, ExtractionTabs and ExtractionsView should share a single `ExtractionItemRenderer` component for rendering individual items, and a single `SectionRenderer` for rendering sections with collapse/expand/abridged/see-more logic. The current v1 has parallel implementations that required manual synchronization — the #1 source of bugs and inconsistency.

---

## 12. CSS Rules

- **ALL colors via CSS custom properties** (`var(--color-*)`) — zero hardcoded hex/rgba
- **All themes supported** (Captain's Quarters, Deep Waters, Hearthstone)
- **Sticky elements** use `position: sticky; top: 0; z-index: 5;` with background color
- **Animations:** heart-fill-pulse (0.3s), item-fade-out (0.3s), search-modal-in (0.2s), chapter-jump-slide-up (0.25s)
- **Mobile-first:** sidebar hidden <768px, chapter jump FAB shown <768px

---

## 13. Requirements Checklist

### Library Page

| # | Requirement | How to Test |
|---|------------|-------------|
| L-1 | Search matches title, author, tags, AI summary, genres | Search "goals" → finds books tagged/summarized with goals |
| L-2 | "Search inside all books" appears when no title matches | Search nonsense → dashed button appears → opens semantic search |
| L-3 | Sort by Recently Viewed works | View books A, B, C → sort → C, B, A order |
| L-4 | Sort by Most Annotated works | Extracted books appear above non-extracted |
| L-5 | last_viewed_at updated on book open | Open book → check DB → timestamp updated |
| L-6 | Layout preference persists | Set grid → refresh → still grid |
| L-7 | Group mode persists | Set all_books → refresh → still all_books |
| L-8 | Sort option persists | Set name_asc → refresh → still name_asc |
| L-9 | Continue banner appears after viewing a book | Open book → navigate away → return → banner shows |
| L-10 | Continue banner restores full state | Tap banner → correct book, tab, view mode |
| L-11 | Continue banner dismissable | Tap × → banner gone, doesn't return |
| L-12 | Refresh All Key Points processes all books | Tap → shows progress → completes |
| L-13 | Semantic search modal opens | Tap "Search Library" → modal overlay, page behind visible |
| L-14 | Usage designations not displayed | No usage designation badges on cards |
| L-15 | PWA shortcut "My Library" available | Long-press app icon on Android → shortcut appears |

### Book Detail Page

| # | Requirement | How to Test |
|---|------------|-------------|
| BD-1 | ExtractionTabs immediately visible below header | Open extracted book → extractions visible without scrolling |
| BD-2 | Book Info collapsed by default | Open book → "Book Info" shows as collapsed |
| BD-3 | All 5 tabs present with counts | Summary, Frameworks, Action Steps, Mast, Questions tabs visible |
| BD-4 | Search this book filters items | Type "leadership" → only matching items shown, counts update |
| BD-5 | Abridged defaults to on | First visit → "Abridged" button highlighted |
| BD-6 | Abridged shows key points + hearted | Toggle abridged → only key/hearted items visible |
| BD-7 | Sections fallback to first 2 when no key points | Section with no key points → still shows 2 items |
| BD-8 | "See more" button appears per section | Abridged → section with hidden items → "See N more" visible |
| BD-9 | See more expands just that section | Tap "See 8 more" → that section shows all, others stay abridged |
| BD-10 | "Key points only" collapses back | Tap → section returns to abridged |
| BD-11 | Chapters expanded in abridged mode | Abridged + tabs view → all sections expanded |
| BD-12 | Chapters collapsed in full content mode | Full Content → sections collapsed |
| BD-13 | Toggle dynamically expands/collapses | Switch abridged↔full → sections expand/collapse |
| BD-14 | Content type left borders by type | Key concepts = teal, stories = cognac, etc. |
| BD-15 | Content type icons in badge | Lightbulb before "key concept", etc. |
| BD-16 | Hearted items have warm background | Heart an item → subtle background change in "All" view |
| BD-17 | Sticky section headers | Scroll → current section header sticks to top |
| BD-18 | Heart/delete/note/send-to buttons on all items | All tabs, all views → buttons present and functional |
| BD-19 | Send-to buttons icon-only (no text labels) | Compass/Anchor/Book icons only, no "Send to..." text |
| BD-20 | Scroll position persists on tab switch | Scroll down → switch tab → switch back → scroll restored |
| BD-21 | Apply section: all 6 buttons present | Discuss, Goals, Questions, Tasks, Tracker, Refresh Key Points |
| BD-22 | Refresh Key Points calls Edge Function | Tap → spinner → success message → extractions re-fetched |
| BD-23 | Lateral part navigation | Multi-part book → Previous/Next buttons in header |
| BD-24 | Desktop sidebar visible ≥768px | Desktop → sidebar with library link + chapters + recent books |
| BD-25 | Sidebar sticky while scrolling | Scroll content → sidebar stays pinned |
| BD-26 | Mobile chapter jump FAB visible <768px | Phone → teal circle bottom-left |
| BD-27 | Chapter jump bottom sheet works | Tap FAB → sheet with chapters → tap chapter → scrolls |
| BD-28 | Chapter view: all 5 types have see more | Chapters view + abridged → Summary, Frameworks, etc. each have see more |

### ExtractionsView Page

| # | Requirement | How to Test |
|---|------------|-------------|
| EV-1 | Book selector with checkboxes | Select/deselect books |
| EV-2 | Collection chips above book selector | Collections shown as pill buttons |
| EV-3 | Tapping collection selects its books | Tap → books selected (toggle) |
| EV-4 | Discuss button in header (top-right) | Button visible → opens discussion modal |
| EV-5 | All/Hearted filter toggle | Toggle → filters items |
| EV-6 | Abridged/Full Content toggle | Same behavior as book detail |
| EV-7 | Refresh Key Points button | Processes selected books → re-fetches |
| EV-8 | View mode toggle (tabs/chapters/notes) | Switch between views |
| EV-9 | Search extractions bar | Type → filters across all selected books |
| EV-10 | Tabs view: sections with see more | Abridged → sections show key points + see more |
| EV-11 | Chapters view: chapters expanded in abridged | Abridged → all chapters open |
| EV-12 | Chapters view: see more per type per chapter | Each type group has see more button |
| EV-13 | Chapters view: chapters collapsed in full | Full Content → chapters collapse |
| EV-14 | Desktop chapter sidebar visible ≥768px | Sidebar with chapter tree for all selected books |
| EV-15 | Mobile chapter jump FAB visible <768px | Teal circle bottom-left |
| EV-16 | Export dialog includes Questions tab | 5 checkboxes: Summary, Frameworks, Action Steps, Questions, Declarations |
| EV-17 | Heart/delete/note/send-to on all items | Same actions as book detail |
| EV-18 | Send-to buttons icon-only | No text labels |
| EV-19 | Notes view shows annotated items | Only items with user_note |

### Semantic Search

| # | Requirement | How to Test |
|---|------------|-------------|
| SS-1 | Opens as modal overlay | Page behind still visible |
| SS-2 | Three mode pills (Any/Together/Separate) | All three visible, "Any" default |
| SS-3 | Natural language query works | "my kids won't stop fighting" → relevant results |
| SS-4 | Multi-term "Any" mode merges results | "marriage, kids" → results for both, multi-match items ranked higher |
| SS-5 | "Together" mode treats as one phrase | "marriage, kids" → family dynamics results |
| SS-6 | "Separate" mode groups by term | Two sections with counts |
| SS-7 | Term chips with remove | Chips appear for multi-term, removable |
| SS-8 | By relevance / By book toggle | Results regroup |
| SS-9 | Export results to .md | Download button → file with results |
| SS-10 | Mode persists in sessionStorage | Select "Separate" → return → still Separate |
| SS-11 | Content preview 500 chars | Results not cut off mid-sentence |

### Key Points

| # | Requirement | How to Test |
|---|------------|-------------|
| KP-1 | Auto-triggered after extraction | Extract book → key points set automatically |
| KP-2 | Per-book refresh works | Tap "Refresh Key Points" → spinner → done |
| KP-3 | All-books refresh works | Library → "Refresh All Key Points" → processes all books |
| KP-4 | Abridged view shows key points | Toggle abridged → only key point + hearted items |
| KP-5 | Fallback to first 2 when no key points | Section without key points → 2 items still visible |
| KP-6 | Hearts always visible in abridged | Heart a non-key-point item → still shows in abridged |

### Reveille Resurfacing

| # | Requirement | How to Test |
|---|------------|-------------|
| RV-1 | Card appears when hearted items exist | Have hearted items → "From Your Library" card in Reveille |
| RV-2 | 1-3 items with book attribution | Items show content type, text, book title |
| RV-3 | Items not repeated within 3 days | Check 3 days → different items |
| RV-4 | Card hidden when no hearted items | No hearts → no card |

---

## 14. v2 Architecture Recommendations

1. **Single rendering component** for extraction items — shared between book detail and multi-book views. Current dual implementation (ExtractionTabs + ExtractionsView) was the #1 source of inconsistency.

2. **State management consolidation** — extraction view state (abridged, collapsed, scroll, filter) should be in a shared context or hook, not duplicated across components.

3. **URL-based routing for book detail** — `/manifest/:bookId` instead of in-page state, enabling deep links and proper browser back.

4. **Extraction item as a standalone component** — `ExtractionItem` with all actions, visuals, and interactions. Consumed by both section renderers.

5. **Section renderer** — `ExtractionSection` with collapse/expand, sticky header, see more, and abridged logic. Consumed by both tab and chapter views.

---

*End of PRD-25 v2 Specification*
