---
name: extract-book
description: Extract summaries, frameworks, declarations, action steps, and questions from books in the Manifest database. Spawns Sonnet workers to process book text in parallel, verifies quality, and writes results to Supabase. Use when the user wants to extract a book or batch of books without using OpenRouter API credits.
argument-hint: <book title or search term> [--batch to process multiple]
---

# Book Extraction Orchestrator

You are the Opus lead of a book extraction team. You manage the queue, assign books to Sonnet workers, verify quality, and write results to the database.

## Environment Setup

```
SUPABASE_URL = https://dkcyaklyqxhkhcnpdtwf.supabase.co
SUPABASE_SERVICE_KEY = (read from .env.local — SUPABASE_SERVICE_ROLE_KEY)
USER_ID = (look up from auth admin API using the user's email, or ask)
WORK_DIR = C:\Users\tenis\AppData\Local\Temp\extraction_work
```

Read the service role key from `.env.local` at the start. Create the work directory if needed.

## Step 1: Find the Book

Search `manifest_items` by title (ilike) for the user's search term. Show matches with:
- ID, title, author, extraction_status, text_content length

If `extraction_status = 'completed'`, warn the user and ask if they want to re-extract (which deletes existing data first).

If text_content is empty or < 1000 chars, tell the user the book needs reprocessing (upload as EPUB).

If text_content is raw PDF binary (low printable char ratio), tell the user it needs EPUB conversion.

## Step 2: Fetch Text

Use a Python script to fetch `text_content` from Supabase REST API and save to a temp file:

```python
# Template: /tmp/extraction_work/fetch_text.py
import urllib.request, json, sys
SB_URL = "..."
SB_KEY = "..."
HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}
book_id, output_path = sys.argv[1], sys.argv[2]
req = urllib.request.Request(f"{SB_URL}/rest/v1/manifest_items?select=text_content&id=eq.{book_id}", headers=HEADERS)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())
if data and data[0].get("text_content"):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(data[0]["text_content"])
```

## Step 3: Spawn Sonnet Worker

Spawn an Agent with `model: sonnet` to read the text file and generate extractions. Use this worker prompt template:

### Worker Prompt Template

```
You are a book extraction specialist. Read the book text and generate high-quality extractions in 5 categories.

## YOUR TASK
1. Read: [TEXT_FILE_PATH]
2. Book: "[TITLE]" by [AUTHOR]. Genre: [GENRES].
3. Identify chapter/section breaks. For EACH section, generate all 5 types.
4. Write results to: [RESULTS_FILE_PATH]

## OUTPUT FORMAT
{"sections": [{"section_title": "...", "summaries": [{"content_type": "narrative_summary", "text": "...", "sort_order": 0}], "frameworks": [{"text": "...", "content_type": "principle", "sort_order": 0}], "declarations": [{"declaration_text": "...", "declaration_style": "choosing_committing", "value_name": "Name", "sort_order": 0}], "action_steps": [{"content_type": "exercise", "text": "...", "sort_order": 0}], "questions": [{"content_type": "reflection", "text": "...", "sort_order": 0}]}]}

## FRAMEWORKS: Punchy flash cards, 1-2 sentences. Types: principle, framework, mental_model, process, strategy.

## DECLARATIONS: [Include full declaration guidance from DECLARATIONS.md]

## SUMMARIES: narrative_summary first. ~1 per 2-3K chars. Standalone.
## ACTION STEPS: Specific actions, not questions. 3-8 per section.
## QUESTIONS: Open-ended, timeless, personal, not reading quizzes. 3-8 per section.
```

For genre context, include the appropriate genre guidance (see GENRES.md).

### Parallelism
- For a single book: 1 Sonnet worker
- For batch mode (--batch): up to 3 Sonnet workers in parallel, each processing a different book
- For very large books (>500K chars): consider using split parts if available

## Step 4: Verify Results

After the worker completes, verify:
1. JSON is valid
2. Each section has all 5 extraction types
3. Count items per type
4. Spot-check: declarations have `declaration_text` and `declaration_style` (or `text`/`content` and `style`/`type` variants)

## Step 5: Write to Database

Use the write_to_db.py script pattern. Key details:

### Table Column Names (actual DB columns)
- **ai_frameworks**: id, user_id, manifest_item_id, name, is_active, tags
- **ai_framework_principles**: id, user_id, framework_id, text, section_title, sort_order, is_from_go_deeper
- **manifest_summaries**: id, user_id, manifest_item_id, text, section_title, section_index, content_type, sort_order, is_from_go_deeper
- **manifest_declarations**: id, user_id, manifest_item_id, declaration_text, declaration_style, value_name, section_title, section_index, sort_order, is_from_go_deeper
- **manifest_action_steps**: id, user_id, manifest_item_id, text, section_title, section_index, content_type, sort_order, is_from_go_deeper
- **manifest_questions**: id, user_id, manifest_item_id, text, section_title, section_index, content_type, sort_order, is_from_go_deeper

### Field Name Normalization
Workers may use different field names. Always normalize:
- `text` OR `content` → DB column `text`
- `content_type` OR `type` → DB column `content_type`
- `declaration_text` OR `text` OR `content` → DB column `declaration_text`
- `declaration_style` OR `style` → DB column `declaration_style`

### Write Process
1. Set `extraction_status = 'extracting'`
2. Create `ai_frameworks` parent record (name = book title, is_active = true, tags = ['extracted'])
3. Insert all items with batch POSTs per section
4. Set `extraction_status = 'completed'`

### Valid Content Types
- **Summaries**: narrative_summary, key_concept, story, metaphor, lesson, quote, insight, theme, character_insight, exercise, principle
- **Action Steps**: exercise, practice, habit, conversation_starter, project, daily_action, weekly_practice
- **Questions**: reflection, implementation, recognition, self_examination, discussion, scenario
- **Declaration Styles**: choosing_committing, recognizing_awakening, claiming_stepping_into, learning_striving, resolute_unashamed

## Step 6: Clean Up Before Re-Extract

If re-extracting a book that already has data:
1. Get framework IDs → delete ai_framework_principles → delete ai_frameworks
2. Delete from manifest_summaries, manifest_declarations, manifest_action_steps, manifest_questions
3. Reset extraction_status to 'none'

## Important Rules
- NEVER call OpenRouter or any external AI API
- NEVER use the manifest-extract Edge Function
- Sonnet workers ARE the AI doing the extraction (via Agent tool)
- Always verify text_content is real text (high printable ratio), not PDF binary
- If a book has both a full version and parts, prefer parts for books > 500K chars
- Set is_from_go_deeper = false for all items
- Report final counts to the user after each book
