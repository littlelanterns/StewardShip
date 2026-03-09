# Documentation Corrections Plan

> **Created:** March 2026
> **Status:** In Progress — some corrections already applied, others pending.
> **Purpose:** Track all documentation gaps uncovered during extraction item audit and bring docs to full accuracy.

---

## Already Completed (This Session)

### DATABASE_SCHEMA.md
- [x] Added `user_note` TEXT column to `manifest_summaries` table
- [x] Added `user_note` TEXT column to `manifest_declarations` table
- [x] Added `user_note` TEXT column to `ai_framework_principles` table
- [x] Added full `manifest_action_steps` table definition (was entirely missing)

### CLAUDE.md — Manifest Conventions
- [x] Fixed extraction pipeline: "three tabs" → "four tabs" (added Action Steps tab)
- [x] Added Action Steps tab description with content_type enum and Compass integration
- [x] Added `user_note` annotation feature mention alongside inline editing
- [x] Added extraction views documentation (tabs/chapters/notes view modes)
- [x] Added notes-only export mention to Extraction exports bullet
- [x] Added Manifest-to-Compass convention (action steps → Compass tasks)
- [x] Added reference to `docs/REFACTOR-Extraction-Items.md` for ideal architecture

### New Documents Created
- [x] `docs/REFACTOR-Extraction-Items.md` — Detailed refactor guide for shared extraction item component architecture (for MyAIM rebuild)

---

## Remaining Corrections Needed

### ~~1. DATABASE_SCHEMA.md — Missing Columns~~ DONE

#### ~~`manifest_items` table — Missing `source_manifest_item_id`~~ DONE
Added `source_manifest_item_id` to manifest_items table in DATABASE_SCHEMA.md.

#### `manifest_items` table — Verify all columns present
**What:** Columns added across multiple migrations (035-045) may not all be reflected.
**Fix:** Cross-reference manifest_items columns in DATABASE_SCHEMA.md against migrations 035 (`ai_summary`, `toc`), 037 (`processing_detail`), 039 (`genres`, `extraction_status`), 041 (`source_manifest_item_id`). Ensure all are listed.

### 2. DATABASE_SCHEMA.md — Missing Triggers

#### `book_discussions` auto-trigger for `updated_at`
**What:** Trigger exists in migration 039 but schema doc doesn't mention it.
**Fix:** Add trigger documentation:
```sql
CREATE TRIGGER update_book_discussions_updated_at
  BEFORE UPDATE ON book_discussions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3. DATABASE_SCHEMA.md — Migration Registry

#### Migrations 041-052 not documented
**What:** DATABASE_SCHEMA.md has a migration registry section. Migrations after 039 are likely missing.
**Fix:** Add entries for:
- 041: source_manifest_item_id on manifest_items + match_manifest_chunks update
- 045: manifest_action_steps table
- 049: user_note columns on extraction tables
- 050: Delete all cloned manifest items
- 051: Wipe non-uploader manifest data (attempted)
- 052: Diagnostic and nuke non-original-uploader data

### ~~4. CLAUDE.md — Missing Manifest Conventions~~ PARTIALLY DONE

#### ~~Book cloning mechanism~~ DONE
Added book cloning convention to CLAUDE.md Manifest Conventions section.

#### Extraction content types not enumerated
**What:** CLAUDE.md mentions summary tab content types inline but doesn't list the action_steps content_type enum values explicitly.
**Fix:** Already partially addressed — the Action Steps description mentions content types. Consider adding the full enum list to the Action Steps tab bullet.

### 5. System Overview PRD — Manifest Section

#### Action Steps tab missing
**What:** The System Overview PRD's Manifest section doesn't mention the Action Steps extraction type.
**Fix:** Update the extraction description to list all 4 tabs (Summary, Frameworks, Action Steps, Mast Content).

#### User notes feature missing
**What:** No mention of personal annotation capability.
**Fix:** Add brief mention of user notes on extracted items.

### 6. PRD-24 — Not Updated for Post-PRD Features

#### Action Steps not in PRD-24
**What:** PRD-24 was written before Action Steps (migration 045) and user notes (migration 049) were added. The PRD describes 3 extraction types.
**Fix:** Either:
- (a) Add an addendum section to PRD-24, or
- (b) Create a brief PRD-24A document covering Action Steps + User Notes

### ~~7. Edge Function Inventory — Verify Completeness~~ DONE

#### ~~manifest-extract description~~ DONE
Updated to include action_steps in the extraction type list.

### 8. `useManifestExtraction` Hook — Not Documented

**What:** The hook `src/hooks/useManifestExtraction.ts` manages all extraction state (summaries, declarations, action steps, frameworks) and provides fetchSummaries/fetchDeclarations/fetchActionSteps/goDeeper/reRun/heart/delete/note/sendToMast/sendToCompass. Not mentioned in CLAUDE.md's hook inventory or anywhere in docs.
**Fix:** Add to the hooks section in CLAUDE.md project structure, or add a note in Manifest Conventions referencing the hook.

---

## Verification Checklist

After all corrections are applied, verify:

- [ ] DATABASE_SCHEMA.md `manifest_items` table has ALL columns including `source_manifest_item_id`, `ai_summary`, `toc`, `processing_detail`, `genres`, `extraction_status`
- [ ] DATABASE_SCHEMA.md has all 4 extraction tables: `manifest_summaries`, `manifest_declarations`, `manifest_action_steps`, `ai_framework_principles` — each with `user_note`
- [ ] DATABASE_SCHEMA.md `book_discussions` shows `is_active` column and `updated_at` trigger
- [ ] DATABASE_SCHEMA.md migration registry includes migrations 041-052
- [ ] CLAUDE.md Manifest Conventions mentions 4 extraction tabs
- [ ] CLAUDE.md Manifest Conventions documents book cloning
- [ ] CLAUDE.md Manifest Conventions documents user notes
- [ ] CLAUDE.md Manifest Conventions documents extraction view modes
- [ ] CLAUDE.md Edge Function Inventory: manifest-extract includes action_steps
- [ ] CLAUDE.md hooks inventory includes `useManifestExtraction`
- [ ] System Overview PRD Manifest section lists 4 extraction types
- [ ] PRD-24 has addendum for Action Steps + User Notes
- [ ] `docs/REFACTOR-Extraction-Items.md` exists with shared-component architecture guide

---

## Priority Order

1. **HIGH — DATABASE_SCHEMA.md manifest_items columns** (developers reference this for migrations)
2. **HIGH — Migration registry** (prevents duplicate migrations)
3. **MEDIUM — CLAUDE.md book cloning** (affects multi-user features)
4. **MEDIUM — System Overview PRD** (affects high-level understanding)
5. **LOW — PRD-24 addendum** (historical document, less frequently referenced)
6. **LOW — Edge Function description tweak** (minor wording fix)
