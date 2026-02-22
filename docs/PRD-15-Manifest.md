# PRD-15: The Manifest — Knowledge Base & RAG

## Overview

The Manifest is the ship's cargo hold — everything the vessel carries. In StewardShip, it's the user's personal knowledge base: books, articles, transcripts, notes, and any reference material that should inform the AI's thinking. When the user uploads Atomic Habits, the AI doesn't just know about habit formation in the abstract — it knows the specific frameworks, language, and examples from that book because it can retrieve relevant passages in real time.

The Manifest uses RAG (Retrieval Augmented Generation) to make uploaded content searchable and available to the AI without including entire books in every conversation. PDFs are chunked into segments, embedded as vectors, and stored in Supabase pgvector. When the AI needs to reference a concept, it performs a similarity search, retrieves the most relevant passages, and includes them in the conversation context.

The Manifest also serves as the entry point for the **Manifest-to-Framework pipeline** — when the user uploads a book or resource that should shape how the AI thinks and advises (not just what it references), the AI extracts key principles and stores them as always-loaded framework entries.

**Initial content for the first user:**
- Atomic Habits by James Clear
- Straight Line Leadership by Dusan Djukich
- BYU Church Citation Index (large reference file)
- Additional materials as uploaded over time

---

## User Stories

### Uploading Content
- As a user, I want to upload PDFs so the AI can reference specific books and materials in conversation.
- As a user, I want to upload audio recordings so they're transcribed and searchable.
- As a user, I want to add text notes directly when I don't have a file to upload.
- As a user, I want the upload process to be quick — I upload, the system handles the rest in the background.

### Intake Flow
- As a user, I want the AI to ask me how I want a new upload used so it goes to the right place.
- As a user, I want to be able to change an item's usage designation later if I change my mind.
- As a user, I want to mark a book as a framework source so the AI extracts principles and uses them to guide its advice.

### Organization
- As a user, I want the AI to auto-organize my uploads with tags and folder groupings so I don't have to do it myself.
- As a user, I want to add my own tags and override the AI's organization when something makes more sense to me.
- As a user, I want to browse my library visually and see what's there at a glance.

### AI Usage
- As a user, I want the AI to pull relevant passages from my uploaded books when I'm processing something at the Helm.
- As a user, I want the AI to draw from my Manifest for Reveille devotional content.
- As a user, I want the AI to reference my uploaded materials in Safe Harbor when relevant wisdom applies.

### Framework Extraction
- As a user, I want to upload a book and have the AI extract the key principles I should live by.
- As a user, I want to review and edit extracted framework principles before they become active.
- As a user, I want to activate or deactivate framework sources so I control what shapes the AI's advice.

---

## Screens

### Screen 1: Manifest Main Page

**What the user sees:**

**Page Header:**
- "The Manifest"
- "Your library of wisdom. The AI draws from these materials when helping you."

**Action Buttons (Top):**
- "Upload" — primary action, opens file picker (PDF, audio, image)
- "Add Note" — secondary action, opens text entry for direct note creation

**Filter Bar:**
- Filter by type: All, PDF, Audio, Text Note
- Filter by tag: shows all tags (auto-generated and custom), tap to filter
- Filter by usage: All, Reference, Framework Source, Mast Source, Keel Source, Goal-Specific, Stored

**Card Grid:**
Items displayed as cards in a responsive grid. AI auto-sorts into folder groupings based on content and tags. Folder groupings are collapsible sections with header labels (e.g., "Faith & Scripture," "Personal Development," "Leadership," etc.).

Each card shows:
- Title (filename for uploads, user title for notes)
- File type icon (PDF, audio waveform, text)
- Tags (shown as small chips)
- Usage designation label
- Upload date
- Processing status indicator (if still being chunked/embedded: "Processing...")
- If framework source: small indicator showing active/inactive

User can:
- Tap card to open detail view (Screen 2)
- Long-press or tap menu to move between folders, edit tags, archive
- Override AI folder assignments by dragging cards between sections or via menu

**Folder Groupings:**
- AI auto-generates folder groupings based on content analysis and tags
- User can rename folders, create new ones, delete empty ones
- Items can belong to one folder grouping (for visual organization) and multiple tags (for filtering)
- Default groupings might be: "Faith & Scripture," "Personal Development," "Reference," "Meeting Transcripts," "Uncategorized"

**Empty State:**
- "Your Manifest is empty. Upload books, articles, audio recordings, or add notes — anything you want the AI to know about and draw from."

---

### Screen 2: Item Detail View

**What the user sees:**

**Header:**
- Title (editable)
- File type and size
- Upload date
- Processing status (processed, processing, failed)

**Tags Section:**
- Auto-generated tags shown as chips (removable)
- "Add Tag" option for custom tags
- Tags are searchable across all items

**Usage Designation:**
- Current designation shown with option to change
- Dropdown: General Reference, Framework Source, Mast Extraction, Keel Info, Goal/Wheel Specific, Store for Later
- Changing designation triggers appropriate follow-up (e.g., switching to Framework Source triggers extraction flow)

**If Framework Source:**
- "View Extracted Principles" button → opens Screen 4
- Active/Inactive toggle for the framework

**If Goal/Wheel Specific:**
- Which Wheel or goal this is linked to (selector)

**Content Preview:**
- For PDFs: first page preview or text excerpt
- For audio: duration, transcript preview (expandable to full transcript)
- For text notes: full content (editable)

**Actions:**
- "Re-process" — re-runs chunking/embedding (useful if processing failed or if improvements are made to the pipeline)
- "Change Usage" — re-runs intake flow
- "Archive" — soft delete, removes from RAG index
- "Delete Permanently" — removes file, chunks, and embeddings

---

### Screen 3: Intake Flow (After Upload)

When a file is uploaded or a note is created, the AI presents the intake flow. This can happen immediately (if the user stays on the page) or as a pending task the user completes later.

**What the user sees:**

**AI-generated summary:**
"I've looked at this file. Here's what I found: [brief 2-3 sentence summary of the content]."

**Usage options:**
- "General Reference" — stays in Manifest, available via RAG when relevant topics come up in conversation
- "Extract as AI Framework" — AI extracts key principles, contrasts, and tools that should guide how it advises you. Principles are always loaded (like your Mast).
- "Extract Principles for The Mast" — AI identifies value statements and principles that could become personal declarations
- "Inform The Keel" — AI extracts personality-relevant data (test results, self-knowledge)
- "Reference for a Specific Goal or Wheel" — links this material to an active goal or Wheel for targeted retrieval
- "Store for Later" — saved but not processed for RAG yet. Can be activated later.

**Tag suggestions:**
AI suggests 2-4 tags based on content analysis. User can accept, modify, add custom.

**Folder suggestion:**
AI suggests which folder grouping this belongs in. User can accept or choose differently.

User selects options and confirms. Multiple designations are allowed (e.g., both General Reference AND Framework Source). Background processing begins immediately.

**If "Extract as AI Framework" is selected:**
AI processes the material and presents extracted principles on Screen 4 before activating.

**If "Extract Principles for The Mast" is selected:**
AI presents extracted principles as potential Mast entries. User reviews, edits, and confirms which to add. Added entries appear on the Mast page with `source_type = 'manifest_extraction'`.

**If "Inform The Keel" is selected:**
AI presents extracted self-knowledge. User reviews, edits, and confirms. Added entries appear on the Keel page with `source_type = 'manifest_extraction'`.

---

### Screen 4: Framework Principles View

When a Manifest item has been designated as a Framework Source, this view shows the extracted principles.

**What the user sees:**

**Framework Header:**
- Framework name (editable — defaults to file title)
- Source: [original file name]
- Status: Active / Inactive (toggle)

**Extracted Principles List:**
Each principle is a concise statement the AI can reference. Displayed as an editable list.

Example for Straight Line Leadership:
- "Circle people revisit the same problems endlessly. Zigzag people progress erratically. Straight-line people identify A and B and take the most direct path."
- "Owner stance creates circumstances. Victim stance reacts to them. The shift is internal, not external."
- "Wanting reinforces the identity of not having. Creating is active and present."
- "People rarely do what they 'should.' They always do what they feel they must."
- "Knowledge without action is performance, not transformation. What you live matters more than what you know."
- [etc.]

User can:
- Edit any principle (put it in their own words, add nuance)
- Delete principles that don't resonate
- Add principles manually that the AI missed
- Reorder principles by importance

**"Add More Principles" button:**
AI re-scans the source material for additional principles not yet extracted.

**"Save and Activate" / "Save" buttons**

---

### Screen 5: Direct Text Note Entry

**What the user sees:**
- Title field
- Large text area for content
- Same tag and folder suggestion flow as file uploads
- Same usage designation options (but Framework Source and Mast Extraction are less common for notes)
- "Save" button

Notes are chunked and embedded the same way files are, just with shorter content.

---

## Data Schema

### Table: `manifest_items`

Metadata for each uploaded file, transcript, or text note.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Display title (default: filename, user-editable) |
| file_type | TEXT | | NOT NULL | Enum: 'pdf', 'audio', 'image', 'text_note' |
| file_name | TEXT | null | NULL | Original filename (null for text notes) |
| storage_path | TEXT | null | NULL | Supabase Storage path (null for text notes) |
| text_content | TEXT | null | NULL | Full extracted text (for text notes: the note itself; for PDFs/audio: extracted/transcribed text) |
| file_size_bytes | INTEGER | null | NULL | |
| usage_designations | TEXT[] | '{}' | NOT NULL | Array: 'general_reference', 'framework_source', 'mast_extraction', 'keel_info', 'goal_specific', 'store_only' |
| tags | TEXT[] | '{}' | NOT NULL | Auto-generated and user-added tags |
| folder_group | TEXT | 'uncategorized' | NOT NULL | AI-assigned or user-overridden folder grouping |
| related_wheel_id | UUID | null | NULL | FK → wheels (if goal/wheel specific) |
| related_goal_id | UUID | null | NULL | FK → goals (if goal specific) |
| processing_status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'processing', 'completed', 'failed' |
| chunk_count | INTEGER | 0 | NOT NULL | Number of chunks generated |
| intake_completed | BOOLEAN | false | NOT NULL | Whether user has completed intake flow |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own items only.
**Indexes:**
- `user_id, archived_at` (active items list)
- `user_id, folder_group, archived_at` (folder view)
- `user_id, processing_status` (pending/failed items)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON manifest_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

### Table: `manifest_chunks`

Chunked and embedded segments for RAG retrieval.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items |
| chunk_index | INTEGER | | NOT NULL | Order within the source document |
| chunk_text | TEXT | | NOT NULL | The text content of this chunk |
| token_count | INTEGER | | NOT NULL | Approximate token count |
| embedding | vector(1536) | | NOT NULL | pgvector embedding |
| metadata | JSONB | '{}' | NOT NULL | Chapter, page number, section heading if extractable |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |

**RLS:** Users access own chunks only.
**Indexes:**
- `manifest_item_id` (all chunks for an item)
- HNSW or IVFFlat index on `embedding` for similarity search (pgvector)

**Note:** The embedding dimension (1536) assumes OpenAI text-embedding-ada-002 or equivalent. If using a different embedding model, dimension adjusts accordingly.

---

### Table: `ai_frameworks`

Framework-level metadata. Each framework corresponds to one Manifest item designated as a framework source.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| manifest_item_id | UUID | | NOT NULL | FK → manifest_items (the source material) |
| name | TEXT | | NOT NULL | Framework display name (default: source title, user-editable) |
| is_active | BOOLEAN | true | NOT NULL | Whether loaded into AI context |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own frameworks only.
**Indexes:**
- `user_id, is_active, archived_at` (active frameworks for context loading)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

### Table: `ai_framework_principles`

Individual principles extracted from a framework source. Each is a concise statement the AI references.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| framework_id | UUID | | NOT NULL | FK → ai_frameworks |
| text | TEXT | | NOT NULL | The principle statement |
| sort_order | INTEGER | 0 | NOT NULL | User-controllable ordering |
| is_user_added | BOOLEAN | false | NOT NULL | Whether manually added vs. AI-extracted |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own principles only.
**Indexes:**
- `framework_id, sort_order, archived_at` (ordered principles per framework)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_framework_principles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## RAG Pipeline

### Upload Flow

1. **User uploads file** → stored in Supabase Storage, `manifest_items` record created with `processing_status = 'pending'`
2. **Background job triggered** (Supabase Edge Function or database webhook):
   a. **PDF:** Extract text using pdf-parse or similar. Store full text in `text_content`.
   b. **Audio:** Transcribe via OpenAI Whisper API ($0.006/min). Store transcript in `text_content`.
   c. **Image:** OCR if text-heavy, or store as-is for non-text images.
   d. **Text Note:** `text_content` already populated from user input.
3. **Chunking:** Split `text_content` into segments of 500-1000 tokens with ~100 token overlap for context continuity. Preserve chapter/section metadata where extractable.
4. **Embedding:** Generate vector embeddings for each chunk (OpenAI text-embedding-ada-002 or equivalent via OpenRouter).
5. **Storage:** Save chunks and embeddings to `manifest_chunks`.
6. **Update status:** Set `processing_status = 'completed'`, update `chunk_count`.
7. **Intake flow:** If user is still on the page, present intake flow (Screen 3). Otherwise, mark `intake_completed = false` — user completes it next time they visit the Manifest.

### Retrieval Flow

When the AI needs to reference Manifest content:

1. **Query formation:** The current conversation topic or user question is converted to an embedding.
2. **Similarity search:** `manifest_chunks` table searched for the top-k most similar chunks (typically k=3-5), filtered by:
   - `user_id` matches
   - `manifest_item_id` belongs to an active (non-archived) item
   - If goal/wheel specific: filtered to relevant items when the conversation is about that goal/wheel
   - Similarity threshold (typically cosine similarity > 0.7)
3. **Context injection:** Retrieved chunks are included in the AI's system prompt under a "Reference Material" section with source attribution.
4. **In conversation:** AI paraphrases and attributes: "There's a concept from [source title] that applies here..."

### Similarity Search Function

```sql
CREATE OR REPLACE FUNCTION match_manifest_chunks(
  query_embedding vector(1536),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  manifest_item_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.manifest_item_id,
    mc.chunk_text,
    mc.metadata,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM manifest_chunks mc
  JOIN manifest_items mi ON mc.manifest_item_id = mi.id
  WHERE mc.user_id = p_user_id
    AND mi.archived_at IS NULL
    AND mi.processing_status = 'completed'
    AND mi.usage_designations && ARRAY['general_reference', 'framework_source', 'goal_specific']
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

## AI Behavior

### How the AI Uses Manifest Content

**At The Helm (General Conversation):**
- When the user asks about a topic that matches uploaded content, AI retrieves relevant chunks
- AI paraphrases, never quotes directly at length. Attributes the source: "There's something in [title] about this..."
- Manifest content supplements the AI's general knowledge, doesn't replace it

**In Safe Harbor:**
- Manifest searched for wisdom relevant to the user's current stress/processing topic
- Particularly valuable for faith-based resources, leadership books, and therapeutic frameworks
- "There's a concept from one of your uploaded books that might help here..."

**In Reveille (Morning Devotional):**
- Manifest is one of the three sources for morning/evening readings (alongside Mast and Log)
- AI selects a passage from the user's uploaded spiritual/motivational materials
- Always includes source reference (book title, chapter/section if available)
- May synthesize across multiple Manifest sources when connections exist

**For The Wheel:**
- If material is linked to a specific Wheel, it's prioritized in retrieval during Wheel conversations
- Framework concepts from uploaded books inform how the AI guides the Wheel process

**For Rigging:**
- Planning conversations can draw from reference material (business books, frameworks, etc.)

### Manifest-to-Framework Pipeline

When the user selects "Extract as AI Framework" during intake:

1. **AI reads the full text** (or enough to identify key frameworks)
2. **AI extracts principles:** Concise, actionable statements that capture the book's core tools and insights. Not summaries — principles the AI can apply in conversation.
3. **AI presents principles** to the user on Screen 4 for review and editing
4. **User confirms** → `ai_frameworks` record created, `ai_framework_principles` entries saved
5. **Framework activated** → principles loaded into AI system prompt alongside Mast entries

**Format in system prompt:**
```
ACTIVE FRAMEWORKS:
[Framework: Straight Line Leadership]
- Circle people revisit the same problems. Zigzag people progress erratically. Straight-line people take the most direct path from A to B.
- Owner stance creates circumstances. Victim stance reacts to them.
- "Want to" is disempowering. "Choose to" is empowering. "Should" rarely leads to action. "Must" does.
- Knowledge without action is performance. What you live matters more than what you know.
[...]

[Framework: Atomic Habits]
- Tiny changes compound. 1% better every day.
- Identity-based habits: "I am the type of person who..." is more powerful than outcome goals.
- Four Laws: Make it obvious, attractive, easy, satisfying.
- Habit stacking: link new behavior to existing routine.
[...]
```

Frameworks are loaded with the same priority as Mast entries — always available, not retrieved via RAG. This is the key distinction: **RAG retrieves specific passages on demand. Frameworks are always present as guiding principles.**

### Auto-Organization

On upload, the AI:
- **Suggests 2-4 tags** based on content analysis (faith, leadership, habits, marriage, parenting, business, etc.)
- **Suggests a folder grouping** based on content similarity to existing items
- **Creates new folder groupings** when content doesn't fit existing ones
- User can override all suggestions

When the user adds custom tags, the AI learns from them and may suggest them for future uploads if content is similar.

### Cross-Feature File Routing

The Manifest serves as the central file processing pipeline for other features:

**From First Mate (PRD-12):**
- Large files uploaded to spouse profile (>~3000 tokens) are routed to Manifest for RAG processing
- `spouse_insights` record gets `is_rag_indexed = true` and a reference to the `manifest_item_id`
- Retrieval is filtered to spouse-related items when First Mate context is loaded

**From Crew (PRD-13):**
- Same pattern for large files uploaded to crew member profiles (when file upload is available)

**From The Log:**
- Log entries don't route to Manifest (they stay in the Log), but voice recordings attached to Log entries use the same transcription pipeline

---

## Cross-Feature Connections

### → The Mast (Extraction)
Intake flow option extracts principles from uploaded material as potential Mast entries. User reviews and confirms.

### → The Keel (Extraction)
Intake flow option extracts personality-relevant data (test results, self-knowledge) for the Keel. User reviews and confirms.

### → The Helm (RAG)
Primary consumer. Relevant passages retrieved by similarity search and included in conversation context.

### → Safe Harbor (RAG + Frameworks)
Both RAG passages and active framework principles available during stress processing.

### → Reveille / Reckoning (Content Source)
Morning/evening readings can draw from Manifest content. AI selects and attributes.

### → The Wheel (Targeted Retrieval)
Materials linked to a specific Wheel are prioritized in Wheel-related conversations.

### → Rigging (Reference Material)
Planning conversations can reference uploaded business, strategy, or framework content.

### → First Mate / Crew (File Pipeline)
Large uploaded files from relationship profiles processed through Manifest RAG pipeline.

### → ai_frameworks (Extraction)
Framework principles extracted from Manifest items, stored separately, loaded like the Mast.

---

## Edge Cases

### Processing Failure
- If chunking or embedding fails: `processing_status = 'failed'`, user sees an indicator on the card
- "Re-process" button available on the detail view
- File is still stored in Supabase Storage — data is not lost
- Intake flow can still be completed (designations, tags, folder) even if processing failed

### Very Large Files
- BYU Church Citation Index may be extremely large
- Chunking handles this naturally — more chunks, longer processing time
- User sees "Processing..." indicator, can continue using the app
- Estimated processing time shown if possible

### Duplicate Uploads
- AI detects if a file with the same name and size already exists
- Warns the user: "You already have [title] in your Manifest. Upload anyway?"
- Does not block — user may have different editions or versions

### Audio Quality
- Whisper handles most audio quality levels well
- If transcription quality is poor, user can edit the transcript directly
- Edited transcript replaces the auto-generated one, and re-chunking is triggered

### Copyright Considerations
- The Manifest stores the user's own copies of materials for personal use
- RAG retrieves passages for the AI's context, not for display to third parties
- The AI paraphrases rather than quoting directly when referencing Manifest content in conversation
- This is functionally equivalent to a person reading a book and discussing it

### Intake Flow Skipped
- If the user uploads and navigates away before completing intake
- `intake_completed = false` — item still processes for RAG in the background
- Default designation: 'general_reference' until the user completes intake
- Manifest page shows a subtle indicator on items with incomplete intake

### Framework Extraction Quality
- AI may miss principles or extract low-quality ones
- User can always edit, delete, or add principles manually
- "Add More Principles" button re-scans source for additional extraction
- User's manual additions are marked `is_user_added = true` so re-extraction doesn't overwrite them

---

## What "Done" Looks Like

### MVP
- Manifest page with card grid, AI auto-sorted folder groupings, tag filtering
- Upload PDFs with background chunking, embedding, and RAG indexing
- Direct text note creation (secondary option)
- Intake flow with all usage designation options
- AI auto-suggests tags and folder groupings on upload; user can override
- Custom tags supported
- Item detail view with metadata, tag management, usage designation
- RAG retrieval: similarity search function, context injection into Helm conversations
- Manifest-to-Framework pipeline: extract principles, user review/edit, activate/deactivate
- ai_frameworks and ai_framework_principles tables with active toggle
- Framework principles loaded into AI system prompt alongside Mast
- Mast extraction flow: AI presents potential principles, user confirms
- Keel extraction flow: AI presents personality data, user confirms
- Processing status indicators (pending, processing, completed, failed)
- Re-process option for failed items
- Archive and delete
- RLS on all tables

### MVP When Dependency Is Ready
- Audio upload with Whisper transcription (requires Whisper API integration)
- Large file routing from First Mate and Crew (requires file upload on those features)
- Goal/Wheel-specific linking (requires Wheel and Goals to be built)
- Reveille/Reckoning Manifest devotional source (requires PRD-10)

### Post-MVP
- Image OCR for text-heavy images
- Highlighted/annotated passages (user marks key sections)
- Smart chunk relevance weighting (learn which chunks the user references most)
- Manifest search (user can search their own library)
- Bulk upload
- Export framework principles as a shareable document
- Usage analytics: which Manifest items are referenced most by the AI

---

## CLAUDE.md Additions from This PRD

- [ ] Manifest is the central knowledge base and file processing pipeline. RAG retrieval via pgvector similarity search.
- [ ] Intake flow: user designates how each upload is used (general reference, framework source, Mast extraction, Keel info, goal/wheel specific, store only). Multiple designations allowed.
- [ ] RAG retrieval: top-k similar chunks injected into AI context with source attribution. AI paraphrases, attributes source, never quotes at length.
- [ ] ai_frameworks: extracted principles from framework source items, loaded alongside Mast in every AI interaction. User controls which frameworks are active.
- [ ] Auto-organization: AI suggests tags and folder groupings on upload. User can override. Custom tags tracked and suggested for future uploads.
- [ ] Processing pipeline: upload → background chunking → embedding → indexed. User doesn't wait.
- [ ] Cross-feature file routing: large files from First Mate/Crew (>~3000 tokens) route to Manifest RAG pipeline.
- [ ] Manifest-to-Mast extraction: AI proposes principles, user confirms additions.
- [ ] Manifest-to-Keel extraction: AI proposes personality/self-knowledge data, user confirms additions.

---

## DATABASE_SCHEMA Additions from This PRD

Tables added:
- `manifest_items` — file/note metadata, tags, folder grouping, usage designations, processing status
- `manifest_chunks` — chunked text with pgvector embeddings for RAG
- `ai_frameworks` — framework-level metadata with active toggle
- `ai_framework_principles` — individual principle statements per framework

SQL functions added:
- `match_manifest_chunks` — pgvector similarity search for RAG retrieval

Update "Tables Not Yet Defined" section:
- ~~manifest_items | PRD-15~~ → DONE
- ~~manifest_chunks | PRD-15~~ → DONE (note: was listed as "Embedding chunks for RAG (pgvector)")
- ~~ai_frameworks | PRD-15~~ → DONE
- ai_framework_principles | PRD-15 | DONE (new)

Update Foreign Key map:
- auth.users → manifest_items, manifest_chunks, ai_frameworks, ai_framework_principles
- manifest_items → manifest_chunks (manifest_item_id)
- manifest_items → ai_frameworks (manifest_item_id)
- ai_frameworks → ai_framework_principles (framework_id)

---

*End of PRD-15*
