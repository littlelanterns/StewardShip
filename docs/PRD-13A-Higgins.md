# PRD-13A: Higgins — Crew Communication Coach

> Status: **Built** (February 2026)

---

## Overview

Higgins extends the Cyrano Me communication coaching pattern from First Mate to ALL Crew relationships. Named after the communication expert archetype, Higgins helps users craft messages, navigate difficult conversations, and build relationship skills with any crew member — children, parents, friends, coworkers, or anyone else in their people directory.

---

## Architecture

### Same Pattern as Cyrano Me
- Dedicated table (`higgins_messages`) → hook (`useHiggins`) → guided mode prompt (`getHigginsGuidedPrompt`) → context loader → drafts component (`HigginsDrafts`) → UI entry points (PersonDetail toolbar + Crew page toolbar)

### Guided Mode
- `guided_mode = 'crew_action'`
- `guided_subtype = 'higgins_say'` (word crafting) or `'higgins_navigate'` (situation processing)
- `guided_mode_reference_id` = person's UUID

---

## Two Modes

### 1. "Help me say something" (`higgins_say`)
**Craft-first flow** — same pattern as Cyrano Me:
1. GREET warmly and ask what they want to say
2. CRAFT IMMEDIATELY after their first message (no clarifying questions)
3. Include teaching skill + refinement invitation in one response
4. REFINE based on feedback

### 2. "Help me navigate a situation" (`higgins_navigate`)
**Relational processing flow:**
1. Listen to the situation
2. Validate feelings and reflect understanding
3. Explore the relational dynamics (using frameworks naturally)
4. Present options and perspectives
5. Optionally craft something to say (if user wants)

---

## 7 Teaching Skills

Rotated to avoid repetition. Each Higgins message teaches one skill with a brief teaching note:

1. **naming_emotion** — Identifying and expressing the actual feeling beneath the surface
2. **perspective_shift** — Seeing the situation from the other person's point of view
3. **validation_first** — Leading with acknowledgment before making a request or raising a concern
4. **behavior_vs_identity** — Addressing actions, not character ("when you do X" not "you always")
5. **invitation** — Phrasing requests as invitations rather than demands
6. **repair** — Reconnecting after conflict, rupture, or misunderstanding
7. **boundaries_with_love** — Setting limits while maintaining warmth and connection

---

## Relationship-Aware Coaching

AI adapts coaching voice based on `relationship_type` from the `people` table:

| Relationship | Coaching Adaptation |
|-------------|-------------------|
| Parent → Child (under 8) | Simple, concrete, playful language. Model emotional vocabulary. |
| Parent → Child (8-12) | Age-appropriate emotional intelligence. Beginning independence respect. |
| Parent → Teen (13-17) | Autonomy-respecting. Invitation over instruction. Validate their perspective. |
| Parent → Young Adult (18+) | Peer-adjacent. Advisory tone. Respect their choices. |
| Child/Teen → Parent | Navigate power dynamics. Express needs safely. Set boundaries respectfully. |
| Peer → Peer | Equal footing. Mutual respect. Direct communication. |
| Other | Context-adaptive general coaching. |

---

## Framework Integration

Applies naturally, never as lectures. Same "teach principles, not authors" rule:

- **7 Habits:** Emotional Bank Account, Seek First to Understand, Circle of Influence, Begin with End in Mind
- **Straight Line Leadership:** Owner stance, empowering language, circle/zigzag/straight line
- **NVC:** Nonviolent Communication principles (observations, feelings, needs, requests)
- **Crucial Conversations:** Safety, mutual purpose, contrasting
- **Gottman:** Soft startup, repair attempts, accepting influence
- **Boundaries:** Setting limits with love, distinction between walls and fences

---

## Entry Points

1. **PersonDetail page:** GraduationCap icon in toolbar, shown only for `has_rich_context && !is_first_mate` people. Opens HigginsModal for mode selection.
2. **Crew page toolbar:** GraduationCap icon opens HigginsCrewModal — multi-person select modal for choosing one or more crew members before launching Higgins.

### Multi-Person Support
When launched from Crew page with multiple people selected:
- Additional person IDs stored in `helm_conversations` metadata as `higgins_people_ids`
- Context loader fetches crew_notes for all selected people
- AI addresses the multi-person context naturally

---

## Database

### `higgins_messages` table (migration 020)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| people_id | UUID | FK → people |
| mode | TEXT | 'say_something' or 'navigate_situation' |
| raw_input | TEXT | User's original text |
| crafted_version | TEXT | AI's suggested version (nullable for navigate mode) |
| final_version | TEXT | What user actually sent |
| teaching_skill | TEXT | One of 7 skills |
| teaching_note | TEXT | AI's explanation |
| status | TEXT | 'draft', 'sent', 'saved_for_later' |
| sent_at | TIMESTAMPTZ | When marked as sent |
| helm_conversation_id | UUID | FK → helm_conversations (ON DELETE SET NULL) |

---

## AI Context Loading

When `crew_action` mode is active, contextLoader fetches:
- Person details (name, relationship_type, age, notes)
- Grouped crew_notes for the person (by category, with truncation)
- Recent teaching skills (last 10) for rotation
- Total message count for skill check threshold

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| HigginsModal | `src/components/crew/HigginsModal.tsx` | Mode picker on PersonDetail (Say/Navigate) |
| HigginsCrewModal | `src/components/crew/HigginsCrewModal.tsx` | Multi-person select on Crew page |
| HigginsDrafts | `src/components/crew/HigginsDrafts.tsx` | Saved drafts display on PersonDetail |

---

## Rules

- Never takes sides in interpersonal conflicts
- Never coaches manipulation or deception
- Never replaces professional help (therapy, counseling)
- Never shares information across user accounts
- Always redirects toward real human connection
- Defers to Safe Harbor Tier 3 if abuse/danger indicators appear
- Not available for First Mate — spouse uses Cyrano Me (richer, marriage-specific)
- Faith references only when natural and Mast entries support it

---

## Skill Rotation

- Last 10 teaching skills loaded into AI context
- AI avoids repeating the same skill consecutively
- After 5+ total messages with a person, AI periodically offers "skill check" mode (user writes first, AI gives feedback)
- Goal: make itself unnecessary over time

---

*PRD-13A — Built February 2026*
