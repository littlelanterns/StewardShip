# PRD-20 Document Updates
## Additions to CLAUDE.md, DATABASE_SCHEMA.md, and System Overview

---

## 1. DATABASE_SCHEMA.md Additions

### Add as PRD-20 section:

```markdown
### PRD-20: Unload the Hold

#### `hold_dumps`

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
| log_entry_id | UUID | null | NULL | FK → log_entries (archived copy) |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own dumps only.
**Indexes:**
- `user_id, created_at DESC` (history)
- `user_id, status` (active dumps)
- `conversation_id` (link to Helm conversation)
```

### Enum updates to existing tables:

- `compass_tasks.source`: Add `'unload_the_hold'` to enum
- `keel_entries.source_type`: Add `'unload_the_hold'` to enum
- `mast_entries.source`: Add `'unload_the_hold'` to enum
- `log_entries.source`: Add `'unload_the_hold'` to enum
- `log_entries.entry_type`: Add `'brain_dump'` to enum
- `helm_conversations.guided_mode`: Add `'unload_the_hold'` to enum

### Table count update:

Update the total table count from 37 to 38 (adding `hold_dumps`).

---

## 2. CLAUDE.md Additions

### Add to Nautical Naming Map:

```
| Unload the Hold | Brain dump → Helm conversation → AI triage → batch routing | Global action (FAB, More menu) → Helm guided mode |
```

### Add to Helm Conventions — Guided Modes list:

```markdown
- **Unload the Hold mode** (`guided_mode = 'unload_the_hold'`): Brain dump conversation. AI adapts engagement to the dump — just listens for straightforward items, offers clarifying questions for messy/emotional content (always offers, never imposes). When user signals completion, AI calls the triage Edge Function, presents a conversational summary, then "Review & Route" button opens structured triage screen. After routing, AI confirms and checks in warmly.
```

### Add new section: Unload the Hold Conventions

```markdown
### Unload the Hold Conventions
- **Helm guided mode, not a standalone page.** Always flows through a Helm conversation. Accessible globally from FAB expansion and More menu.
- **AI behavior during dump: adaptive engagement.** Default is to listen with short acknowledgments. For straightforward dumps (task lists, errands), just receive — don't slow the user down. For messy or emotional dumps (tangled feelings, unclear priorities), the AI may OFFER to ask clarifying questions — always offer, never impose. "I can just sort this, or I can ask a couple questions to make sure things land right. Up to you." If the user says "just sort it," respect that immediately. Never coach, advise, or apply frameworks during the dump.
- **Completeness check:** After the user slows down, gently ask: "Anything else, or is that everything?" Wait for explicit signal before sorting.
- **Conversational summary first, structured triage second.** AI presents sorted items as a warm conversation message with counts and key items. "Review & Route" action button opens the structured triage screen for final adjustments.
- **Eight triage categories:** task (→ Compass), journal (→ Log), insight (→ Keel), principle (→ Mast), person_note (→ Crew, stub until built), reminder (→ Reminders, stub until built), list_item (→ Lists), discard (→ skip).
- **Merciful defaults:** If AI can't categorize, default to "journal." Never discard something the user put effort into. Extract MORE rather than fewer. Acknowledge heavy content warmly before categorizing.
- **Compound splitting:** AI splits multi-topic sentences into separate items when destinations differ.
- **Source tracking:** All routed items use `source = 'unload_the_hold'` with `source_reference_id` → `hold_dumps.id`. Raw dump archived to Log as `entry_type = 'brain_dump'`.
- **No data duplication:** Raw dump text lives in `helm_messages` via the conversation. `hold_dumps` links to the conversation rather than storing text separately.
- **Edge Function:** `unload-the-hold` — takes conversation text + optional context (Mast, active tasks, Keel categories, people names). Returns JSON array of categorized items.
- **FAB expansion pattern:** On pages with a FAB, long-press or expand reveals secondary actions including "Unload the Hold." This pattern can be reused for other global actions.
```

### Add to Stub Registry:

```
| Unload the Hold → Crew person_note routing | Phase 4D (Unload the Hold) | Phase 8 (Crew) | STUB |
| Unload the Hold → Reminder routing | Phase 4D (Unload the Hold) | Phase 10 (Reminders) | STUB |
| Unload the Hold → Voice messages in conversation | Phase 4D (Unload the Hold) | TBD (Whisper integration) | STUB |
```

### Add to TODO checklist:

```
- [ ] Unload the Hold conventions → added to CLAUDE.md
- [ ] hold_dumps table schema → added to DATABASE_SCHEMA.md
- [ ] Source enum updates for unload_the_hold
- [ ] Guided mode enum update for unload_the_hold
- [ ] FAB expansion pattern documented
```

---

## 3. System Overview PRD Updates

### Build Order — Add Phase 4D:

```markdown
### Phase 4D: Unload the Hold
19. Helm guided mode conversation flow (dump → sort → triage)
20. Unload-the-hold Edge Function for AI triage extraction
21. Structured triage review screen with batch routing to Compass/Log/Keel/Mast/Lists
22. Stub routing for Crew and Reminders
```

### PRD Index — Add row:

```
| PRD-20: Unload the Hold (Brain Dump) | PRD Written |
```

### Feature List — Add entry:

"**Unload the Hold** — Helm-based brain dump. User opens a guided conversation, pours out unstructured thoughts. AI listens with light clarification, then sorts everything into categorized items. User reviews on a structured triage screen and confirms batch routing to Compass, Log, Keel, Mast, Lists, and future features."

### Data Model Summary — Add:

```
### Hold Dumps
- Conversation ID (links to Helm conversation — raw text lives there)
- Items extracted/routed/discarded counts
- Full triage result (JSONB)
- Status: dumping, sorting, triaging, routed, cancelled
- Link to archived Log entry
```

### Cross-Feature Rules — Add Rule 17:

```markdown
### Rule 17: Unload the Hold Routing
When Unload the Hold routes items to their destinations, all standard rules for those destinations apply:
- Tasks get AI auto-tagged (same as Compass)
- Journal entries get AI life area tags (same as Log)
- Principles follow declaration language rules (Rule 1) if applicable
- The user always confirms before any routing occurs
- The original conversation is preserved in the Helm
```

Update the cross-feature rules count from 16 to 17 everywhere referenced.

### Helm Section — Update guided modes list:

```
| Unload the Hold | Brain dump processing — AI listens, sorts, user confirms routing | PRD-20 |
```

---

*End of PRD-20 Document Updates*
