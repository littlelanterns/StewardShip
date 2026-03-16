# StewardShip Manifest System — Complete Architecture Reference

> **Purpose:** Migration guide for recreating the Manifest system (Book Knowledge Library) in MyAIM Family.
> **Date:** March 15, 2026
> **Scope:** Everything related to book upload, processing, extraction, RAG, semantic search, discussions, collections, curation, export, and AI context integration.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [The Processing Pipeline](#2-the-processing-pipeline)
3. [The RAG Layer](#3-the-rag-layer)
4. [The Semantic Search Layer](#4-the-semantic-search-layer)
5. [The Extraction Pipeline](#5-the-extraction-pipeline)
6. [Heart-Based Curation & Favorites](#6-heart-based-curation--favorites)
7. [User Notes & Annotations](#7-user-notes--annotations)
8. [Book Discussions](#8-book-discussions)
9. [Collections](#9-collections)
10. [Export System](#10-export-system)
11. [AI Context Integration](#11-ai-context-integration)
12. [Cross-Feature Routing](#12-cross-feature-routing)
13. [Database Tables & Schema](#13-database-tables--schema)
14. [Edge Functions](#14-edge-functions)
15. [Frontend Files Reference](#15-frontend-files-reference)
16. [Key Architectural Patterns](#16-key-architectural-patterns)
17. [Migration Considerations for MyAIM](#17-migration-considerations-for-myaim)

---

## 1. System Overview

The Manifest is StewardShip's central knowledge base. Users upload books (PDF, EPUB, DOCX, TXT, MD, images) and the system:

1. **Processes** the file into full text
2. **Chunks** the text into ~750-token segments with 100-token overlap
3. **Embeds** each chunk using OpenAI ada-002 (1536-dimension vectors)
4. **Classifies** the book via AI (tags, folder, summary)
5. **Enriches** with an AI-generated summary and table of contents
6. **Extracts** structured content in four categories (summaries, frameworks, declarations, action steps) organized by chapter
7. **Embeds extracted content** using text-embedding-3-small for semantic search
8. **Enables discussions** — AI-powered conversations about one or more books
9. **Curates** via heart/delete system and personal annotations
10. **Exports** in Markdown, plain text, and DOCX formats
11. **Feeds the AI** — extracted content and RAG chunks load into Helm conversations contextually

### Data Flow Diagram

```
User Upload
    │
    ▼
┌─────────────────┐
│  manifest_items  │ ← metadata, genres, tags, folder, status
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌──────────────┐
│ Storage│  │manifest-process│ ← text extraction (PDF/EPUB/DOCX/TXT/MD/image)
│ Bucket │  │  Edge Function │
└────────┘  └───────┬──────┘
                    │
              ┌─────┴──────┐
              ▼            ▼
      ┌──────────────┐  ┌──────────────────┐
      │manifest_chunks│  │ manifest-intake   │ ← AI classification
      │  (RAG index)  │  │  (tags, folder)   │
      └──────────────┘  └──────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ manifest-enrich   │ ← AI summary + TOC
      └──────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ manifest-extract  │ ← genre-aware structured extraction
      └───────┬──────────┘
              │
    ┌─────────┼─────────┬──────────────┐
    ▼         ▼         ▼              ▼
┌────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐
│Summaries│ │Frame-  │ │Declarations│ │Action Steps│
│         │ │works   │ │(Mast)      │ │            │
└────────┘ └────────┘ └────────────┘ └────────────┘
    │         │         │              │
    └─────────┴─────────┴──────────────┘
              │
              ▼
      ┌──────────────────┐
      │  embed (batch)    │ ← text-embedding-3-small on all 4 tables
      └──────────────────┘
              │
              ▼
      ┌──────────────────────────────┐
      │ Semantic Search Functions     │
      │ match_manifest_content()      │
      │ match_personal_context()      │
      └──────────────────────────────┘
```

---

## 2. The Processing Pipeline

**What it does:** Takes a raw file and turns it into indexed, searchable text chunks.

### File Type Handling

| Format | Extraction Method | TOC Extraction |
|--------|------------------|----------------|
| PDF | Server-side text extraction + AI vision fallback for scanned pages | PDF outline/bookmarks (via unpdf) |
| EPUB | ZIP → OPF spine order → XHTML content → stripped HTML. Uses fflate for Deno-compatible unzipping. Best format for books. | NCX/nav table of contents |
| DOCX | ZIP → word/document.xml → w:t text runs | Heading1-3 styles |
| TXT | Direct read | None |
| MD | Direct read | # headings parsed |
| Images | AI vision extraction (Haiku) | None |

### Processing Stages (Real-Time Updates)

The `processing_detail` column on `manifest_items` provides live stage updates visible to the user:

1. `"Downloading..."` — Fetching file from Supabase Storage
2. `"Extracting text..."` — Format-specific text extraction
3. `"Chunking..."` — Splitting into overlapping segments
4. `"Embedding batch N of M"` — Generating ada-002 vectors
5. `"Saving..."` — Writing chunks to manifest_chunks
6. Cleared on completion

### Chunking Algorithm

```
Target: 750 tokens per chunk (~3000 characters)
Overlap: 100 tokens (~400 characters)
Break preference: paragraph breaks > sentence breaks > hard cut
Min progress: always advances at least one position to prevent infinite loops
```

### Relevant Files

| File | Purpose |
|------|---------|
| `supabase/functions/manifest-process/index.ts` | Main processing Edge Function |
| `supabase/functions/extract-text/index.ts` | Cascading text extraction (client → server → AI vision) |
| `supabase/functions/_shared/pdf-utils.ts` | PDF text + TOC extraction |
| `supabase/functions/_shared/epub-utils.ts` | EPUB spine-order parsing via fflate |
| `supabase/functions/_shared/docx-utils.ts` | DOCX w:t text extraction |
| `src/lib/rag.ts` → `chunkText()` | Client-side chunking utility (also used by Edge Function) |
| `src/hooks/useManifest.ts` | Upload flow, processing status polling, auto-intake |
| `src/components/manifest/UploadFlow.tsx` | Multi-file upload UI with progress |

---

## 3. The RAG Layer

**What it does:** Enables semantic similarity search across the full text of uploaded books. Used for "Discuss This Book" and "Ask Your Library" conversations.

### Embedding Model

- **Model:** OpenAI `text-embedding-ada-002`
- **Dimensions:** 1536
- **Purpose:** Full-text RAG on chunked book content
- **Storage:** `manifest_chunks.embedding` column (vector(1536))

### Search Function

```sql
match_manifest_chunks(
  query_embedding vector(1536),  -- From user's message
  p_user_id UUID,                -- RLS scoping
  match_threshold FLOAT = 0.7,   -- Minimum cosine similarity
  match_count INT = 5            -- Top-K results
)
```

Returns: `id`, `manifest_item_id`, `chunk_text`, `metadata`, `similarity`

### Search Modes

1. **"Discuss This"** (single book): 8 chunks from the specific book + 3 from other books (cross-reference)
2. **"Ask Your Library"** (all books): 10 chunks from entire library
3. **Book Discussion Modal** (manifest-discuss Edge Function): Dual search — RAG chunks + semantic search on extracted content

### Index

- HNSW index on `manifest_chunks.embedding` with `vector_cosine_ops` for fast approximate nearest-neighbor search

### Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/rag.ts` → `generateEmbedding()` | Generate ada-002 embedding via Edge Function |
| `src/lib/rag.ts` → `searchManifest()` | Search chunks by similarity with item-level filtering |
| `supabase/functions/manifest-embed/index.ts` | OpenAI embedding API wrapper (supports ada-002 and text-embedding-3-small) |
| `src/lib/contextLoader.ts` (lines 358-384) | Wires RAG into Helm context for manifest_discuss mode |
| Migration `009_manifest_storage.sql` | Creates manifest_chunks table + match_manifest_chunks function |

---

## 4. The Semantic Search Layer

**What it does:** Meaning-based search across extracted content (summaries, declarations, principles, action steps) AND personal context (Mast, Keel, Journal). Separate from RAG — searches structured, curated content rather than raw text chunks.

### Embedding Model

- **Model:** OpenAI `text-embedding-3-small`
- **Dimensions:** 1536
- **Purpose:** Cross-book and cross-context semantic similarity
- **Better semantic understanding** than ada-002 — used for the extracted/curated layer

### Tables with Semantic Embeddings

| Table | Content | Model |
|-------|---------|-------|
| `manifest_chunks` | Raw text chunks | ada-002 (RAG) |
| `manifest_summaries` | Key concepts, stories, quotes, etc. | text-embedding-3-small |
| `manifest_declarations` | Mast-style commitment statements | text-embedding-3-small |
| `ai_framework_principles` | Actionable principles | text-embedding-3-small |
| `manifest_action_steps` | Exercises, habits, prompts | text-embedding-3-small |
| `mast_entries` | User's guiding principles | text-embedding-3-small |
| `keel_entries` | User's self-knowledge | text-embedding-3-small |
| `journal_entries` | User's journal | text-embedding-3-small |

### Search Functions

**`match_manifest_content()`** — Searches across all 4 extraction tables:

```sql
match_manifest_content(
  query_embedding vector(1536),
  target_user_id UUID,
  match_threshold FLOAT = 0.3,   -- Lower threshold for broader results
  match_count INT = 15
)
RETURNS TABLE (
  source_table TEXT,      -- Which extraction table the match came from
  record_id UUID,
  manifest_item_id UUID,
  book_title TEXT,        -- Joined from manifest_items for attribution
  content_preview TEXT,
  similarity FLOAT
)
```

**`match_personal_context()`** — Searches Mast + Keel + Journal:

```sql
match_personal_context(
  query_embedding vector(1536),
  target_user_id UUID,
  match_threshold FLOAT = 0.3,
  match_count INT = 10
)
RETURNS TABLE (
  source_table TEXT,
  record_id UUID,
  content_preview TEXT,
  similarity FLOAT
)
```

Both are `SECURITY DEFINER` functions — they bypass RLS internally but scope by `target_user_id`.

### Batch Embedding Processor

The `embed` Edge Function processes rows with NULL embeddings across all 7 tables:

```
POST /embed
Body: { table?: string, batch_size?: number }
Returns: { processed: number, failed: number, remaining: { table_name: count } }
```

### How Semantic Search Enters Helm Context

In `contextLoader.ts`, for every user message longer than 15 characters (and not in manifest_discuss mode):

1. `searchManifestContent()` runs (threshold 0.35, count 8)
2. `searchPersonalContext()` runs (threshold 0.35, count 5)
3. Both run in parallel with all other context fetches
4. Results formatted into `semanticSearchContext` string
5. Added to system prompt as a budget-checked section (trimmed if budget exceeded)

The system prompt instructs the AI: *"Weave them in naturally — reference book titles and content types. Don't list them mechanically. If a match connects to their Mast principles or current goals, highlight that connection."*

### Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/rag.ts` → `generateSearchEmbedding()` | Generate text-embedding-3-small embedding |
| `src/lib/rag.ts` → `searchManifestContent()` | Search extracted content by semantic similarity |
| `src/lib/rag.ts` → `searchPersonalContext()` | Search personal context by semantic similarity |
| `src/lib/rag.ts` → `triggerEmbedding()` | Fire-and-forget call to embed Edge Function |
| `supabase/functions/embed/index.ts` | Batch processor for NULL embeddings across 7 tables |
| `supabase/functions/manifest-embed/index.ts` | OpenAI API wrapper (both models) |
| `src/lib/contextLoader.ts` (lines 429-466, 772-777) | Wires semantic search into Helm |
| `src/lib/systemPrompt.ts` (lines 900-906) | Formats semantic results into prompt |
| Migration `061_semantic_embeddings.sql` | Creates embedding columns, HNSW indexes, match functions |

---

## 5. The Extraction Pipeline

**What it does:** AI analyzes book content by chapter and extracts structured, actionable content in four categories.

### Extraction Flow

1. **Section Discovery** — AI (Haiku) analyzes document structure, identifies chapters/sections
2. **User Selection** — User checkmarks which sections to extract
3. **Merge Short Sections** (optional) — Toggle to combine small sections for extraction
4. **Per-Section Extraction** — AI (Sonnet) extracts 4 types of content from each selected section
5. **Embedding** — Fire-and-forget call to embed all new extractions
6. **Curation** — User hearts/deletes/annotates items

### Four Extraction Tabs

#### Tab 1: Summaries → `manifest_summaries`

AI extracts: key_concept, story, metaphor, lesson, quote, insight, theme, character_insight, exercise, principle

Each item is 1-3 sentences. Content type stored as enum for badge display.

#### Tab 2: Frameworks → `ai_framework_principles` (via `ai_frameworks` parent)

AI extracts actionable principles — statements that can guide behavior. Creates one `ai_frameworks` parent record per book, with individual `ai_framework_principles` rows.

Active frameworks are loaded into the AI system prompt in every Helm conversation.

#### Tab 3: Action Steps → `manifest_action_steps`

AI extracts: exercise, practice, habit, reflection_prompt, conversation_starter, project, daily_action, weekly_practice

These can be sent to Compass as tasks (tracked via `sent_to_compass` + `compass_task_id`).

#### Tab 4: Declarations (Mast Content) → `manifest_declarations`

AI generates honest commitment statements in 5 styles:
- **Choosing & Committing** — "I choose to..."
- **Recognizing & Awakening** — "I am becoming aware that..."
- **Claiming & Stepping Into** — "I am stepping into..."
- **Learning & Striving** — "I am learning to..."
- **Resolute & Unashamed** — "I will not apologize for..."

Each has an optional `value_name` (1-3 word underlying value like "Patience" or "Courage"). Can be sent to Mast via `sent_to_mast` + `mast_entry_id`.

### Genre-Aware Extraction

9 genres guide AI prompts for specialized results:

`non_fiction`, `fiction`, `biography_memoir`, `scriptures_sacred`, `workbook`, `textbook`, `poetry_essays`, `allegory_parable`, `devotional_spiritual_memoir`

### Go Deeper

Per chapter, per tab. Sends existing items to AI so it extracts non-duplicate content. New items marked `is_from_go_deeper = true` (displayed with cognac border + sparkle icon).

### Re-Run

Per tab. Replaces all content for that tab with fresh extraction after user confirmation.

### Extraction Status Tracking

`manifest_items.extraction_status`: `none` → `extracting` → `completed` / `failed`

### Relevant Files

| File | Purpose |
|------|---------|
| `supabase/functions/manifest-extract/index.ts` | Main extraction Edge Function (Sonnet). Handles all 4 types + section discovery + go_deeper. |
| `src/hooks/useManifestExtraction.ts` | Orchestrates extraction flow — section discovery, parallel extraction, go deeper, re-run, heart/delete, CRUD for all 4 tables |
| `src/hooks/useFrameworks.ts` | Framework-specific operations (save, tag, toggle active, get for item) |
| `src/components/manifest/ExtractionsView.tsx` | Primary extraction UI (3 view modes: tabs, chapters, notes) |
| `src/components/manifest/ExtractionTabs.tsx` | Renders individual extraction tab content |
| `src/components/manifest/FrameworkPrinciples.tsx` | Framework principles display + editing + tagging |
| `src/components/manifest/FrameworkManager.tsx` | Grid of all frameworks with export |
| `src/components/manifest/BrowseFrameworks.tsx` | Tag-filtered accordion view |
| `src/components/manifest/GenrePicker.tsx` | Genre multi-select UI |
| `src/lib/mergeSections.ts` | Utilities for merging short sections |
| `supabase/functions/manifest-tag-framework/index.ts` | Auto-generate topic tags for frameworks (Haiku) |
| Migration `039_manifest_extract_discuss.sql` | Creates manifest_summaries, manifest_declarations tables, extends ai_framework_principles |
| Migration `045_manifest_action_steps.sql` | Creates manifest_action_steps table |

---

## 6. Heart-Based Curation & Favorites

**What it does:** Users mark items as "hearted" (favorited) across all 4 extraction types. Hearted items form a personal collection viewable across all books.

### Columns (on all 4 extraction tables)

- `is_hearted` BOOLEAN (default false) — User-favorited
- `is_deleted` BOOLEAN (default false) — Soft delete (hidden from UI, retained in DB)

### Aggregated Hearted Items View

The `HeartedItemsView` component displays all hearted items across all books, grouped by book with collapsible sections. Supports 3 view modes (tabs, chapters, notes) and export in all formats.

### How Hearts Affect AI Context

The `user_settings.book_knowledge_access` setting controls what loads into Helm:

| Setting | What Loads |
|---------|-----------|
| `hearted_only` (default) | Only is_hearted=true summaries + declarations + principles |
| `all_extracted` | All non-deleted summaries + declarations + principles |
| `framework_only` | Only active ai_frameworks principles (ignoring hearts) |
| `none` | Nothing from Manifest loads into Helm |

### UI Animations

- Heart: fill-pulse animation on toggle
- Delete: fade-out animation on soft delete

### Relevant Files

| File | Purpose |
|------|---------|
| `src/hooks/useManifestExtraction.ts` → `heartItem()` / `deleteItem()` | Toggle heart/delete on any extraction item |
| `src/hooks/useManifestExtraction.ts` → `fetchHeartedItems()` | Fetch all hearted items across books |
| `src/components/manifest/HeartedItemsView.tsx` | Aggregated hearted items display + export |
| `src/lib/contextLoader.ts` (lines 386-427) | Fetches hearted/extracted content for Helm |
| `src/lib/systemPrompt.ts` → `formatBookKnowledgeContext()` | Formats into AI prompt |

---

## 7. User Notes & Annotations

**What it does:** Users can add personal annotations to any extracted item. Notes are inline-editable and exportable.

### Column

`user_note` TEXT (nullable) — on `manifest_summaries`, `manifest_declarations`, `ai_framework_principles`, `manifest_action_steps`

### UI

Click text → textarea appears → save on blur, Escape cancels. Note appears below the extracted text with a distinct visual style.

### Notes-Only Export

Dedicated export mode that shows only items with user notes, with the note displayed prominently.

### Notes View Mode

ExtractionsView has a "Notes" view mode that filters to items with annotations, displaying notes prominently alongside the source content.

### Relevant Files

| File | Purpose |
|------|---------|
| `src/components/manifest/ExtractionsView.tsx` | Notes view mode |
| `src/lib/exportExtractions.ts` → `exportNotesMd/Txt/Docx()` | Notes-only export |
| Migration `049_user_notes.sql` | Adds user_note column to all 4 extraction tables |

---

## 8. Book Discussions

**What it does:** AI-powered conversations about books, separate from the main Helm chat. Supports single-book and multi-book discussions with audience adaptation.

### Discussion Types

| Type | Purpose | Routes To |
|------|---------|-----------|
| `discuss` | General book discussion | — |
| `generate_goals` | Goal generation from book content | Rigging (plans) |
| `generate_questions` | Discussion/study questions | Lists |
| `generate_tasks` | Actionable tasks from book content | Compass |
| `generate_tracker` | Tracking habits from book content | Coming Soon |

### Audience Adaptation

| Audience | AI Tone |
|----------|---------|
| `personal` | Direct, reflective, connects to user's Mast/Keel |
| `family` | Family-appropriate, practical application |
| `teen` | Age-appropriate, engaging, less formal |
| `spouse` | Relationship-focused, connects to First Mate context |
| `children` | Simple language, story-focused |

### Context Building (manifest-discuss Edge Function)

The manifest-discuss Edge Function builds rich per-book context:

1. **RAG chunks** (ada-002) — Full text similarity search on the book's chunks
2. **Extracted summaries** — Structured key concepts from manifest_summaries
3. **Extracted frameworks** — Principles from ai_framework_principles
4. **Extracted declarations** — Mast content from manifest_declarations
5. **Action steps** — From manifest_action_steps
6. **Cross-book semantic search** (text-embedding-3-small) — Related content from other books
7. **User's Mast + Keel** — Personal context for grounded advice

For multi-book discussions, the AI opens with cross-book synthesis.

### Relevant Files

| File | Purpose |
|------|---------|
| `supabase/functions/manifest-discuss/index.ts` | Book discussion AI Edge Function (Sonnet) |
| `src/hooks/useBookDiscussions.ts` | Discussion CRUD, message sending, audience updates |
| `src/components/manifest/BookDiscussionModal.tsx` | Full-screen chat UI with audience switcher + routing buttons |
| `src/components/manifest/BookSelector.tsx` | Multi-book selection + audience picker |
| Migration `039_manifest_extract_discuss.sql` | Creates book_discussions + book_discussion_messages tables |

---

## 9. Collections

**What it does:** Named groupings of books (many-to-many). Users organize books into themed collections like "Parenting Library" or "Leadership Reading."

### Tables

- `manifest_collections` — Collection metadata (name, description, sort_order)
- `manifest_collection_items` — Junction table (collection_id + manifest_item_id, unique constraint)

### Features

- Drag-to-reorder collections in sidebar
- Add/remove books from collections
- Clone support (source_collection_id for shared collections)
- Sidebar navigation with collection filtering

### Relevant Files

| File | Purpose |
|------|---------|
| `src/hooks/useManifestCollections.ts` | Collection CRUD, item management, reordering |
| `src/components/manifest/CollectionModal.tsx` | Create/edit collection dialog |
| `src/components/manifest/CollectionSidebar.tsx` | Sidebar navigation with drag-reorder |
| Migration `059_manifest_collections.sql` | Creates both collection tables |

---

## 10. Export System

**What it does:** Export extracted book content in professional document formats with flexible filtering.

### Three Export Utilities

#### 1. Extraction Export (`exportExtractions.ts`)

Exports extracted content from a single book or aggregated across books.

**Functions:**
- `exportExtractionsMd()` / `exportExtractionsTxt()` / `exportExtractionsDocx()` — Full extraction export
- `exportHeartedMd()` / `exportHeartedTxt()` / `exportHeartedDocx()` — Hearted items only
- `exportNotesMd()` / `exportNotesTxt()` / `exportNotesDocx()` — User notes only

**Features:**
- Chapter-first organization with section headings
- Content-type labels (KEY CONCEPT, STORY, QUOTE, etc.)
- Declaration style display in italics
- Hearted indicators
- User notes formatted distinctly
- Tab filtering (choose which content types to include)
- Professional DOCX via JSZip OOXML generation

#### 2. Framework Export (`exportFramework.ts`)

Exports framework principles (single framework or aggregated across multiple).

**Functions:**
- `exportAsMarkdown()` / `exportAsTxt()` / `exportAsDocx()` — Single framework
- `exportAggregatedAsMarkdown()` / `exportAggregatedAsTxt()` / `exportAggregatedAsDocx()` — Multiple frameworks

#### 3. Text Extraction (`extractText.ts`)

Client-side file text extraction with cascading fallback:
1. Client-side instant read for TXT/MD
2. Server extraction via extract-text Edge Function for PDF/DOCX
3. AI vision fallback for images or scanned documents

### Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/exportExtractions.ts` | All extraction export functions (811 lines) |
| `src/lib/exportFramework.ts` | Framework export functions (449 lines) |
| `src/lib/extractText.ts` | File text extraction utility (93 lines) |
| `src/components/manifest/ExportDialog.tsx` | Export options UI (format, mode, tab selection) |

---

## 11. AI Context Integration

**What it does:** Connects Manifest data to the Helm AI chat so the AI can reference book knowledge in conversations.

### Three Context Pathways

#### Pathway 1: RAG Chunks (manifest_discuss mode only)

When `guidedMode === 'manifest_discuss'`:
- "Discuss This" → 8 chunks from specific book + 3 cross-reference chunks
- "Ask Your Library" → 10 chunks from entire library
- Formatted via `formatManifestContext()` into system prompt

#### Pathway 2: Book Knowledge (extracted content)

For regular Helm conversations (not manifest_discuss):
- Controlled by `user_settings.book_knowledge_access` setting
- Fetches summaries, declarations, and hearted principles
- Formatted via `formatBookKnowledgeContext()` into system prompt
- Budget-checked and trimmed if context too large

#### Pathway 3: Semantic Search (automatic)

For every message >15 characters (not in manifest_discuss mode):
- `searchManifestContent()` — finds semantically related extracted content (threshold 0.35, count 8)
- `searchPersonalContext()` — finds semantically related personal entries (threshold 0.35, count 5)
- Both run in parallel with all other context fetches
- Formatted via `formatSemanticSearchContext()` into system prompt
- Budget-checked section — trimmed if context exceeds user's budget

#### Pathway 4: Active Frameworks (always loaded when relevant)

When `shouldLoadFrameworks()` returns true:
- All active (`is_active = true`) frameworks with their principles are fetched
- Formatted via `formatFrameworksContext()` into system prompt
- Loaded alongside Mast entries for principle-based guidance

### Keyword Detection

```typescript
// shouldLoadManifest — triggers RAG search
['manifest', 'book', 'reading', 'author', 'chapter', 'uploaded', 'that book', 'that article', 'library']

// shouldLoadBookKnowledge — triggers extracted content loading
['principle', 'framework', 'what did', 'book says', 'book said', 'reading', 'author', 'what I learned',
 'remember from', 'that concept', 'that idea', 'teach', 'apply', 'practice', 'declaration', 'summary', 'extract']

// shouldLoadFrameworks — triggers active framework loading
Page is manifest OR topic includes certain keywords
```

### Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/contextLoader.ts` | Central context assembly — all 4 pathways orchestrated here |
| `src/lib/systemPrompt.ts` | Keyword detection functions + formatting functions + budget checking |
| `src/lib/rag.ts` | All search functions (RAG, semantic content, semantic personal) |

---

## 12. Cross-Feature Routing

**What it does:** Extracted content can be sent to other StewardShip features.

### Routing Destinations

| Source | Destination | Tracked By |
|--------|------------|------------|
| Declarations → Mast | Creates mast_entries record | `manifest_declarations.sent_to_mast` + `mast_entry_id` |
| Action Steps → Compass | Creates compass_tasks record | `manifest_action_steps.sent_to_compass` + `compass_task_id` |
| Discussion → Rigging | Opens Rigging plan creation with book context | Discussion type `generate_goals` |
| Discussion → Lists | Creates list with discussion questions | Discussion type `generate_questions` |
| Discussion → Compass | Creates tasks from discussion | Discussion type `generate_tasks` |
| Large files → Manifest RAG | First Mate/Keel files >3000 tokens route to Manifest for chunking | `is_rag_indexed` flag on spouse_insights/keel_entries |

### Reveille/Reckoning Integration

Manifest is one of three sources for morning/evening readings:
- **Manifest Devotional:** AI-selected content from user's library via RAG search
- Always includes source attribution (book title + chapter)
- May synthesize across multiple sources when connections exist

---

## 13. Database Tables & Schema

### Core Tables

#### `manifest_items`
**Purpose:** Metadata for every uploaded file or text note.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users, CASCADE |
| title | TEXT | Display name (default: filename) |
| file_type | TEXT | 'pdf', 'epub', 'docx', 'txt', 'md', 'audio', 'image', 'text_note' |
| file_name | TEXT | Original filename |
| storage_path | TEXT | Supabase Storage path: `manifest-files/{user_id}/{filename}` |
| text_content | TEXT | Full extracted text |
| file_size_bytes | INTEGER | |
| genres | TEXT[] | Multi-select book genres (9 options) |
| extraction_status | TEXT | 'none', 'extracting', 'completed', 'failed' |
| tags | TEXT[] | GIN-indexed topic tags |
| folder_group | TEXT | AI-assigned or user-overridden folder |
| processing_status | TEXT | 'pending', 'processing', 'completed', 'failed' |
| processing_detail | TEXT | Real-time stage updates (cleared on completion) |
| chunk_count | INTEGER | Number of chunks created |
| intake_completed | BOOLEAN | Whether AI classification was applied |
| ai_summary | TEXT | AI-generated 2-4 sentence summary |
| toc | JSONB | Table of contents as `[{title, level}]` |
| source_manifest_item_id | UUID | FK self → for cloned books |
| parent_manifest_item_id | UUID | FK self → for split books |
| part_number / part_count | INTEGER | For split books |
| archived_at | TIMESTAMPTZ | Soft delete |
| created_at / updated_at | TIMESTAMPTZ | Auto-managed |

#### `manifest_chunks`
**Purpose:** RAG-indexed text segments with ada-002 embeddings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users, CASCADE |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| chunk_index | INTEGER | 0-based order |
| chunk_text | TEXT | ~750 tokens |
| token_count | INTEGER | |
| embedding | vector(1536) | ada-002 embedding |
| metadata | JSONB | {chapter, page, section_heading} |
| created_at | TIMESTAMPTZ | |

**Append-only:** No UPDATE or DELETE RLS policies.

#### `ai_frameworks`
**Purpose:** Parent record for framework extraction. One per book.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| name | TEXT | Framework display name |
| is_active | BOOLEAN | Whether loaded into AI context |
| tags | TEXT[] | GIN-indexed topic tags (auto-generated by Haiku) |
| archived_at | TIMESTAMPTZ | Soft delete |

#### `ai_framework_principles`
**Purpose:** Individual principles within a framework.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| framework_id | UUID | FK → ai_frameworks, CASCADE |
| text | TEXT | The principle statement |
| section_title | TEXT | Chapter grouping |
| sort_order | INTEGER | |
| is_user_added | BOOLEAN | Manual vs AI-extracted |
| is_hearted | BOOLEAN | User-favorited |
| is_deleted | BOOLEAN | Soft delete |
| is_from_go_deeper | BOOLEAN | From Go Deeper extraction |
| user_note | TEXT | Personal annotation |
| embedding | vector(1536) | text-embedding-3-small |

#### `manifest_summaries`
**Purpose:** Extracted summary items (10 content types).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| section_title | TEXT | Chapter grouping |
| section_index | INTEGER | Section order |
| content_type | TEXT | key_concept, story, metaphor, lesson, quote, insight, theme, character_insight, exercise, principle |
| text | TEXT | 1-3 sentences |
| sort_order | INTEGER | |
| is_hearted / is_deleted / is_from_go_deeper | BOOLEAN | |
| user_note | TEXT | Personal annotation |
| embedding | vector(1536) | text-embedding-3-small |

#### `manifest_declarations`
**Purpose:** Mast-style commitment statements extracted from books.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| section_title / section_index | TEXT / INTEGER | Chapter grouping |
| value_name | TEXT | Optional 1-3 word value label |
| declaration_text | TEXT | Full commitment statement |
| declaration_style | TEXT | 5 styles (see Extraction Pipeline) |
| is_hearted / is_deleted | BOOLEAN | |
| sent_to_mast | BOOLEAN | Whether sent to Mast |
| mast_entry_id | UUID | FK → mast_entries (SET NULL on delete) |
| sort_order | INTEGER | |
| is_from_go_deeper | BOOLEAN | |
| user_note | TEXT | |
| embedding | vector(1536) | text-embedding-3-small |

#### `manifest_action_steps`
**Purpose:** Actionable exercises, practices, habits extracted from books.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| section_title / section_index | TEXT / INTEGER | Chapter grouping |
| content_type | TEXT | exercise, practice, habit, reflection_prompt, conversation_starter, project, daily_action, weekly_practice |
| text | TEXT | |
| sort_order | INTEGER | |
| is_hearted / is_deleted / is_from_go_deeper | BOOLEAN | |
| sent_to_compass | BOOLEAN | Whether sent to Compass |
| compass_task_id | UUID | FK → compass_tasks |
| user_note | TEXT | |
| embedding | vector(1536) | text-embedding-3-small |

#### `book_discussions`
**Purpose:** Book discussion conversation metadata.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| manifest_item_ids | UUID[] | Array of book IDs (single or multi-book) |
| discussion_type | TEXT | discuss, generate_goals, generate_questions, generate_tasks, generate_tracker |
| audience | TEXT | personal, family, teen, spouse, children |
| title | TEXT | |
| created_at / updated_at | TIMESTAMPTZ | |

#### `book_discussion_messages`
**Purpose:** Individual messages within a book discussion.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| discussion_id | UUID | FK → book_discussions, CASCADE |
| role | TEXT | 'user', 'assistant' |
| content | TEXT | |
| created_at | TIMESTAMPTZ | |

#### `manifest_collections`
**Purpose:** Named book groupings (albums).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| name | TEXT | |
| description | TEXT | |
| sort_order | INTEGER | |
| source_collection_id | UUID | For cloned collections |
| archived_at | TIMESTAMPTZ | |

#### `manifest_collection_items`
**Purpose:** Junction table for books ↔ collections.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| collection_id | UUID | FK → manifest_collections, CASCADE |
| manifest_item_id | UUID | FK → manifest_items, CASCADE |
| user_id | UUID | FK |
| sort_order | INTEGER | |
| UNIQUE | | (collection_id, manifest_item_id) |

### Supabase Storage Bucket

- **Bucket:** `manifest-files` (private)
- **Size limit:** 50 MB
- **Path pattern:** `{user_id}/{filename}`
- **Allowed MIME types:** PDF, EPUB, DOCX, TXT, MD, audio (mpeg/wav/mp4/webm), images (png/jpeg)
- **RLS:** Path-based isolation by user_id

### PostgreSQL Functions

| Function | Purpose | Model |
|----------|---------|-------|
| `match_manifest_chunks()` | RAG search on raw chunks | ada-002 |
| `match_manifest_content()` | Semantic search on 4 extraction tables | text-embedding-3-small |
| `match_personal_context()` | Semantic search on mast + keel + journal | text-embedding-3-small |

### Migrations (in order)

| Migration | What It Creates |
|-----------|----------------|
| `009_manifest_storage.sql` | manifest_items, manifest_chunks, match_manifest_chunks, storage bucket |
| `010_manifest_formats.sql` | File type enum expansion (EPUB, DOCX, etc.) |
| `035_manifest_enrichment.sql` | ai_summary, toc columns on manifest_items |
| `036_framework_tags.sql` | tags TEXT[] on ai_frameworks |
| `037_manifest_processing_detail.sql` | processing_detail column |
| `039_manifest_extract_discuss.sql` | manifest_summaries, manifest_declarations, book_discussions, book_discussion_messages, genres, extraction_status, heart/delete/go_deeper on ai_framework_principles |
| `045_manifest_action_steps.sql` | manifest_action_steps table |
| `049_user_notes.sql` | user_note column on all 4 extraction tables |
| `053_manifest_book_splitting.sql` | parent_manifest_item_id, part_number, part_count |
| `059_manifest_collections.sql` | manifest_collections, manifest_collection_items |
| `061_semantic_embeddings.sql` | embedding columns + HNSW indexes on 7 tables, match_manifest_content + match_personal_context functions |

---

## 14. Edge Functions

### Manifest-Specific Edge Functions

| Function | Purpose | AI Model | Key Input | Key Output |
|----------|---------|----------|-----------|------------|
| `manifest-process` | File → text → chunks → embeddings | N/A (processing) + ada-002 (embedding) | file storage_path, manifest_item_id | Chunks in DB, processing_detail updates |
| `manifest-embed` | Generate embedding vectors | ada-002 or text-embedding-3-small (configurable) | text, model | embedding vector(1536) |
| `embed` | Batch background embedding for NULL rows | text-embedding-3-small | optional table filter, batch_size | processed/failed/remaining counts |
| `manifest-intake` | AI classification of uploaded items | Haiku | file text (first ~2000 chars) | summary, tags[], folder, usage |
| `manifest-enrich` | AI summary + optional tag re-suggestion | Haiku | manifest_item_id | ai_summary text, toc JSON |
| `manifest-extract` | Genre-aware structured extraction | Sonnet | text, extraction_type, genre, section_title, existing_items (for go_deeper) | Array of extracted items per type |
| `manifest-tag-framework` | Auto-generate topic tags for frameworks | Haiku | framework name + principle texts | tags[] |
| `manifest-discuss` | Book discussion AI with per-book context | Sonnet | message, discussion history, manifest_item_ids, audience, discussion_type | AI response text |
| `extract-text` | Cascading file text extraction | Haiku (vision fallback only) | file or storage_path | extracted text, file_type, used_vision flag |

### Shared Utilities Used by Edge Functions

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/pdf-utils.ts` | PDF text + TOC extraction |
| `supabase/functions/_shared/epub-utils.ts` | EPUB spine-order parsing (fflate) |
| `supabase/functions/_shared/docx-utils.ts` | DOCX w:t text extraction |

---

## 15. Frontend Files Reference

### Library / Utility Files (`src/lib/`)

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `rag.ts` | 283 | RAG + semantic search infrastructure | `generateEmbedding`, `generateSearchEmbedding`, `searchManifest`, `searchManifestContent`, `searchPersonalContext`, `triggerEmbedding`, `chunkText`, `approximateTokenCount` |
| `extractText.ts` | 93 | Cascading file text extraction | `extractTextFromFile`, `isSupportedFileType`, `isVisionFileType` |
| `exportExtractions.ts` | 811 | Export extracted book content | 9 export functions (3 formats × 3 modes) + helpers (`collectChapters`, `contentTypeLabel`, etc.) |
| `exportFramework.ts` | 449 | Export framework principles | 6 export functions (3 formats × single/aggregated) |
| `mergeSections.ts` | ~50 | Merge short sections for extraction | `computeMergeStats`, `mergeShortSections` |
| `contextLoader.ts` | 800+ | Central AI context assembly | `loadContext()` — orchestrates all manifest data fetching for Helm |
| `systemPrompt.ts` | 1600+ | System prompt building + keyword detection | `shouldLoadManifest`, `shouldLoadBookKnowledge`, `shouldLoadFrameworks`, `formatManifestContext`, `formatBookKnowledgeContext`, `formatFrameworksContext` |
| `types.ts` | 1800+ | Type definitions | All manifest-related interfaces, enums, constants |

### Hooks (`src/hooks/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `useManifest.ts` | Core manifest CRUD, upload, processing | `fetchItems`, `uploadFile`, `createTextNote`, `reprocessItem`, `runIntake`, `applyIntake`, `enrichItem`, `autoIntakeItem`, `checkDuplicate`, `pollProcessingStatus` |
| `useManifestExtraction.ts` | Extraction orchestration | `extractAll`, `discoverSections`, `goDeeper`, `reRunTab`, `heartItem`, `deleteItem`, `sendDeclarationToMast`, `fetchHeartedItems`, `triggerSemanticEmbeddings` |
| `useFrameworks.ts` | Framework management | `extractFramework`, `saveFramework`, `tagFramework`, `toggleFramework`, `getFrameworkForItem` |
| `useBookDiscussions.ts` | Book discussions | `startDiscussion`, `sendMessage`, `continueDiscussion`, `updateAudience`, `deleteDiscussion` |
| `useManifestCollections.ts` | Collection management | Collection CRUD, item management, reordering |

### Components (`src/components/manifest/`)

| File | Size | Purpose |
|------|------|---------|
| `ExtractionsView.tsx` | 105K | Primary extraction UI — 3 view modes (tabs, chapters, notes), per-section controls, heart/delete, inline editing, export |
| `ExtractionTabs.tsx` | 64K | Individual extraction tab rendering with section organization |
| `ManifestItemDetail.tsx` | 54K | Full book detail — About This Book, extractions, actions, metadata |
| `HeartedItemsView.tsx` | 29K | Aggregated hearted items across all books + export |
| `FrameworkPrinciples.tsx` | 30K | Framework principles display + tag editing + export |
| `BookDiscussionModal.tsx` | 18K | Full-screen book discussion chat |
| `UploadFlow.tsx` | 17K | Multi-file upload with progress |
| `AdminBookManager.tsx` | 14K | Admin utilities for book management |
| `FrameworkManager.tsx` | 12K | Framework grid with per-card export + Tag All |
| `CollectionSidebar.tsx` | 11K | Collection navigation + drag-reorder |
| `BrowseFrameworks.tsx` | 10K | Tag-filtered accordion framework browser |
| `ExportDialog.tsx` | 9.1K | Export options (format, mode, tab selection) |
| `IntakeFlow.tsx` | 8.9K | AI classification review dialog |
| `ManifestItemCard.tsx` | 8.1K | Compact book card with processing status |
| `CollectionModal.tsx` | 7.1K | Create/edit collection |
| `BookSelector.tsx` | 4.7K | Multi-book selection for discussions |
| `TextNoteModal.tsx` | 2.5K | Text-only note creation |
| `GenrePicker.tsx` | 1.4K | Genre multi-select |
| `ManifestFilterBar.tsx` | 1.1K | Search + filter controls |

### Page (`src/pages/`)

| File | Lines | Purpose |
|------|-------|---------|
| `Manifest.tsx` | 1474 | Main page — orchestrates all hooks and components, view mode routing, FAB, sidebar |

---

## 16. Key Architectural Patterns

### 1. Two-Tier Embedding Architecture

```
Layer 1: RAG (raw text chunks)
├── Model: ada-002
├── Table: manifest_chunks
├── Search: match_manifest_chunks()
├── Purpose: Full-text similarity on uploaded content
└── Used by: manifest_discuss mode, book discussions

Layer 2: Semantic (extracted + personal content)
├── Model: text-embedding-3-small
├── Tables: manifest_summaries, manifest_declarations, ai_framework_principles,
│           manifest_action_steps, mast_entries, keel_entries, journal_entries
├── Search: match_manifest_content() + match_personal_context()
├── Purpose: Cross-context intelligent suggestions
└── Used by: Every Helm message (>15 chars, auto)
```

### 2. Fire-and-Forget Pattern

Non-critical operations that shouldn't block the UI:
- `triggerSemanticEmbeddings()` — Background embedding after extraction
- `syncExtractionsToAdmin()` — Clone sync
- `autoIntakeItem()` — Background poll-then-intake after processing
- Framework tag generation after saving

### 3. Cascading Extraction

```
Client-side TXT/MD read
    ↓ (if not text)
Server-side PDF/DOCX/EPUB extraction
    ↓ (if fails or scanned)
AI Vision fallback (Haiku)
```

### 4. Heart-Based Curation (Not Folder-Based)

Users curate by hearting items they care about, not by organizing into folders. This creates natural aggregated views and controls what enters AI context. Hearts are a cross-cutting concern on all 4 extraction types.

### 5. Section-First Organization

All extractions tied to `section_title` + `section_index`. This preserves book structure and enables:
- Chapter-grouped display
- Per-chapter Go Deeper
- Per-chapter Re-Run
- Chapter headings in exports

### 6. Budget-Checked Context Loading

```
Never trimmed: Base prompt + Mast + active guided mode
Trimmed first: Conversation history (oldest first)
Then trimmed: Page context, topic data
Then trimmed: Semantic search, book knowledge, RAG
```

Token budgets: Short (~4K), Medium (~8K, default), Long (~16K)

### 7. Concurrent Processing Limits

`useManifest` limits concurrent processing to `MAX_CONCURRENT = 3` to prevent overloading the Edge Function queue. Multi-file uploads process sequentially with 1-second delays.

---

## 17. Migration Considerations for MyAIM

### What Changes for Multi-Family Architecture

1. **User-scoped → Family-scoped data.** RLS policies need `family_id` in addition to `user_id`. Extractions remain per-user (my hearts, my notes), but the underlying book and chunks can be shared.

2. **Book caching at platform level.** When a book is uploaded, check against `platform_intelligence.book_cache` before processing. Cache hit = clone extractions. Cache miss = fresh extraction + cache for future users.

3. **Book identification.** Fuzzy matching via title/author embedding similarity + ISBN matching. Users name files inconsistently ("WholebrainChild_scan.pdf" vs "The Whole-Brain Child.epub").

4. **Chunk sharing.** Current: `manifest_chunks` are per-user. Future: chunks can be shared across users for the same book (via `source_manifest_item_id` pattern, already partially implemented).

5. **Extraction cloning.** When a cached book is found, clone `manifest_summaries`, `manifest_declarations`, `ai_framework_principles`, `manifest_action_steps` to the new user — but all with `is_hearted = false`, `user_note = null`. User's curation is always their own.

6. **Platform intelligence pipeline.** New: ethics review queue, admin approval, principle synthesis across books. Feeds LiLa's advisory knowledge base.

7. **Family library sharing.** Parents can share books/collections with family members. Extractions clone per-member. Hearts and notes remain per-individual.

### What Ports Directly

- Entire processing pipeline (manifest-process, text extraction, chunking)
- Embedding infrastructure (both models, both search functions)
- Extraction Edge Function (manifest-extract) — genre-aware, section-based
- Heart/delete/note curation system
- Export utilities (all 3 format generators)
- Book discussion system (manifest-discuss)
- Collection system
- UI components (with CSS variable theming)

### Files to Reference for Recreation

**Start with these — they define the entire system:**

| Priority | File | Why |
|----------|------|-----|
| 1 | `src/lib/types.ts` | All type definitions — the data contract |
| 2 | `src/lib/rag.ts` | RAG + semantic search — the intelligence layer |
| 3 | `src/hooks/useManifest.ts` | Core CRUD + processing — the data lifecycle |
| 4 | `src/hooks/useManifestExtraction.ts` | Extraction orchestration — the value creation |
| 5 | `supabase/functions/manifest-process/index.ts` | Processing pipeline — the ingestion |
| 6 | `supabase/functions/manifest-extract/index.ts` | Extraction prompts — the AI intelligence |
| 7 | `supabase/functions/manifest-embed/index.ts` | Embedding wrapper — the vector layer |
| 8 | `supabase/functions/embed/index.ts` | Batch embedding — the backfill system |
| 9 | `supabase/functions/manifest-discuss/index.ts` | Book discussions — the interaction layer |
| 10 | `src/lib/contextLoader.ts` | AI context assembly — the integration point |
| 11 | `src/lib/systemPrompt.ts` | System prompt building — the AI personality |
| 12 | `src/lib/exportExtractions.ts` | Export engine — the output system |
| 13 | `src/lib/exportFramework.ts` | Framework export — the knowledge sharing |
| 14 | `src/components/manifest/ExtractionsView.tsx` | Primary UI — the user experience |
| 15 | `src/components/manifest/ManifestItemDetail.tsx` | Detail view — the book experience |
| 16 | All migration files listed in Section 13 | Database schema — the foundation |

### New MyAIM-Specific Components Needed

| Component | Purpose |
|-----------|---------|
| Book identification service | Fuzzy match uploads against platform cache |
| Platform book cache | Shared extraction storage across families |
| Ethics review queue | Admin approval pipeline for platform intelligence |
| Principle synthesis engine | Cross-book convergence detection |
| Family sharing layer | Book/collection sharing with per-member curation |
| LiLa knowledge integration | Synthesized principles → AI training context |

---

*End of Manifest System Architecture document.*
