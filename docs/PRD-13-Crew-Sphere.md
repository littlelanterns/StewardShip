# PRD-13: Crew + Sphere of Influence

## Overview

Crew is the people management system in StewardShip. It stores context about the important people in the user's life — children, parents, siblings, coworkers, friends, mentors — so the AI can be helpful when they come up in conversation. When the user says "I had a tough conversation with Jake," the AI should know whether Jake is his 14-year-old son or his coworker.

Crew shares the `people` table defined in PRD-12 (First Mate). The spouse (First Mate) is a special case with her own dedicated page and `spouse_insights` system. All other people live in Crew.

Children get a richer context system than other crew members — not as deep as the spouse's `spouse_insights`, but significantly more than freeform notes on a coworker. A `crew_notes` table provides categorized, searchable context that grows over time through direct entry, Helm conversations, and meeting notes.

The Crew page also includes the **Sphere of Influence** — an alternate view based on Seth Atwater's framework for understanding and intentionally managing who and what you allow to influence you. This is distinct from Covey's Circle of Influence (what you CAN influence outward) — the Sphere of Influence is about what you ALLOW to influence YOU (inward). Both are valuable, different tools.

---

## User Stories

### People Management
- As a user, I want to add people to my Crew so the AI knows who they are when I mention them.
- As a user, I want to see my people organized by category (family, work, friends, etc.) so I can find them quickly.
- As a user, I want to add notes about a person so the AI has context for better advice.
- As a user, I want to edit any person's details at any time because relationships and circumstances change.

### Children (Richer Context)
- As a user, I want to build deeper context about my children so the AI can help me be a better father to each one specifically.
- As a user, I want to see meeting notes from parent-child mentor meetings linked to each child's profile.
- As a user, I want to record observations about each child (personality, interests, challenges, what's going on in their lives) so the AI can reference them.

### Helm Integration
- As a user, I want the AI to know who someone is when I mention them by name so it can give contextualized advice.
- As a user, I want the AI to offer to add someone to my Crew if they seem significant and aren't already there.
- As a user, I want the AI to offer to save insights about a person when I share something meaningful in conversation.

### Sphere of Influence
- As a user, I want to assign people to influence spheres so I can be intentional about who shapes my thinking.
- As a user, I want to see where someone currently IS vs. where I WANT them to be in terms of influence.
- As a user, I want the AI to help me close gaps between current and desired influence levels.
- As a user, I want to place non-person entities (social media, news, politics) in spheres too.

---

## Screens

### Screen 1: Crew Main Page — Category View (Default)

**What the user sees:**

**View Toggle (Top of Page)**
- Two text buttons: "By Category" (active/default) | "By Sphere" 
- Switching views changes layout, not data

**People Grouped by Category, Each Collapsible:**
- **Immediate Family** — spouse (links to First Mate page), children, parents, siblings
- **Extended Family** — in-laws, cousins, grandparents, etc.
- **Professional** — coworkers, boss, business partners, clients
- **Social / Friends** — friends, neighbors
- **Church / Community** — church leaders, congregation, community contacts
- **Custom** — user-defined categories

Each person card shows:
- Name
- Relationship type label (child, coworker, friend, etc.)
- Age (if entered, shown for children)
- Sphere indicator (small dot or label showing desired sphere, if assigned)
- Tap to open person detail (Screen 2)

A person can appear in multiple category sections if they have multiple categories assigned.

**"Add Crewmate" Button (Floating Action)**

**Helm Drawer** accessible from this page. When opened, AI loads Crew context for the currently selected person (if any).

---

### Screen 2: Person Detail Page

**What the user sees:**

**Header**
- Name (editable)
- Relationship type
- Age (if entered)
- Categories (shown as chips, editable)
- Personality summary (if entered — AI-compiled shorthand)
- Love language (if entered)
- Important dates (birthdays, etc.)
- "Edit" text button for header fields

**Sphere Assignment (if assigned)**
- Desired sphere label
- Current sphere label (if set)
- Gap indicator if current ≠ desired
- "Edit Sphere" text button

**Notes Section**
For basic crew members (coworkers, friends, acquaintances, etc.):
- Freeform notes field (editable)
- Simple, not categorized

For children and close family (relationship_type = 'child', 'parent', 'sibling', or user-upgraded):
- **Crew Notes** — categorized context, similar in structure to spouse_insights but lighter:
  - **Personality & Wiring** — how they're wired, temperament, processing style
  - **Interests & Joys** — what they love, hobbies, passions
  - **Challenges & Needs** — what they're struggling with, what they need support with
  - **Growth & Development** — milestones, progress, things they're learning (especially relevant for children)
  - **Observations** — things the user has noticed
  - **General** — anything else
- Each note shows content, source indicator, date
- "Add Note" button with same three options as First Mate: write it myself, upload a file, discuss at The Helm

**Meeting Notes (Children Only)**
- Section showing recent Parent-Child Mentor meeting notes linked to this child
- Each links to the Log entry where the meeting notes were captured
- "View All" links to filtered Log view
- Meeting framework itself defined in PRD-17 — this is just the display of linked notes

**Wheel Roles**
- If this person serves a role in any active Wheel (Supporter, Reminder, Observer), shows which Wheel and which role
- Links to the relevant Wheel

**Action Buttons**
- "Discuss at The Helm" — opens Helm with this person's context loaded
- "Archive" — soft delete

---

### Screen 3: Add Crewmate

**What the user sees:**
- Name field (required)
- Relationship type selector: child, parent, sibling, coworker, friend, mentor, other
- Category selector (multi-select): immediate_family, extended_family, professional, social, church_community, custom
- Age field (optional)
- Notes field (optional freeform)
- "Save" button

After save, user lands on the person detail page where they can add more context, assign sphere, etc.

The AI does NOT auto-create crew members from conversation. It offers, and the user confirms and fills in at minimum a name and relationship type.

---

### Screen 4: Sphere View (Alternate View)

**MVP Version (List-Based):**

Since the interactive concentric circles visualization is post-MVP, the Sphere View in MVP is a structured list:

**Six sections, ordered center outward:**

1. **Focus** — Self, Spouse (links to First Mate), God. Fixed for married users. Not editable.
2. **Family** — People assigned to this sphere
3. **Friends** — People assigned to this sphere
4. **Acquaintances** — People assigned to this sphere
5. **Community** — People and entities assigned to this sphere
6. **Geo-Political** — People and entities assigned to this sphere

Each section shows:
- People with name, relationship type, and gap indicator (if current ≠ desired)
- Non-person entities (from `sphere_entities` table) with name and category
- "Add to this sphere" button per section

**Unassigned section at bottom:**
- People who haven't been placed in any sphere yet
- "Assign" button opens sphere selector

**For each person/entity in a sphere:**
- Tap opens detail view
- Shows both desired and current sphere
- If gap exists, shows gap direction (arrow inward or outward)

---

### Screen 5: Sphere Assignment (Inline)

When assigning or editing a sphere for a person:

**What the user sees:**
- Person's name
- "Where do you WANT this person's influence level to be?" — sphere selector (Focus, Family, Friends, Acquaintances, Community, Geo-Political)
- "Where are they actually RIGHT NOW?" — same selector, optional (can skip)
- If gap exists after both are set, brief text: "There's a gap between where [name] is and where you want them. The AI can help you close it."
- "Save" button

---

### Screen 6: Add Sphere Entity (Non-Person)

For placing non-person influences (social media, news, politics, etc.):

**What the user sees:**
- Name field (e.g., "Instagram," "Fox News," "Local politics")
- Category selector: social_media, news_media, politics, entertainment, ideology, custom
- Desired sphere selector
- Current sphere selector (optional)
- "Save" button

---

## Data Schema

### Table: `people` (Already Defined in PRD-12)

PRD-13 adds the following columns to the existing `people` table:

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| desired_sphere | TEXT | null | NULL | Enum: 'focus', 'family', 'friends', 'acquaintances', 'community', 'geo_political' |
| current_sphere | TEXT | null | NULL | Same enum, nullable. Where the person actually IS right now. |
| has_rich_context | BOOLEAN | false | NOT NULL | Whether this person uses crew_notes (auto-set true for children, user can upgrade others) |

**Additional Index:**
- `user_id, desired_sphere, archived_at` (sphere view grouping)

---

### Table: `crew_notes`

Categorized context for children and other close relationships. Lighter than `spouse_insights` — no prompt system, no Marriage Toolbox, but same flexible-input philosophy.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people |
| category | TEXT | | NOT NULL | Enum: 'personality', 'interests', 'challenges', 'growth', 'observation', 'general' |
| text | TEXT | | NOT NULL | The note content |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'meeting_notes', 'log_routed' |
| source_label | TEXT | null | NULL | Freeform (e.g., "parent-child meeting," "I noticed at practice") |
| source_reference_id | UUID | null | NULL | FK → source record if applicable |
| file_storage_path | TEXT | null | NULL | If from uploaded file |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own notes only.
**Indexes:**
- `user_id, person_id, category, archived_at` (category grouping)
- `user_id, person_id, archived_at` (all notes for a person)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crew_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

### Table: `sphere_entities`

Non-person influences placed in spheres (social media, news, politics, etc.).

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | e.g., "Instagram," "CNN," "Local politics" |
| entity_category | TEXT | | NOT NULL | Enum: 'social_media', 'news_media', 'politics', 'entertainment', 'ideology', 'custom' |
| desired_sphere | TEXT | | NOT NULL | Same sphere enum as people |
| current_sphere | TEXT | null | NULL | Optional |
| notes | TEXT | null | NULL | Optional freeform context |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own entities only.
**Indexes:**
- `user_id, desired_sphere, archived_at` (sphere view grouping)

**Trigger:**
```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sphere_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## AI Behavior

### How the AI Uses Crew Context

**Loaded when relevant:** Crew data is loaded into the AI context when:
- The user mentions someone by name in conversation
- The user is on the Crew page or a specific person's detail page
- Wheel Spoke 4 (support people identification)
- Meeting Framework conversations involving specific people
- Safe Harbor conversations involving interpersonal conflict

**Name matching:** The AI maintains a lightweight name lookup from the `people` table. When a name appears in conversation, the AI checks for matches and loads that person's context. If multiple people share a name, the AI uses conversation context to disambiguate, or asks: "Are you talking about Jake your son or Jake from work?"

**Format in system prompt (when a specific person is referenced):**

```
About [name] ([relationship_type]):
- Age: [if known]
- Categories: [categories]
- Personality: [personality_summary if known]
- Sphere: Desired [desired_sphere], Currently [current_sphere]
- Notes: [freeform notes]
[If has_rich_context and crew_notes exist:]
- Personality & Wiring: [notes]
- Interests: [notes]
- Challenges: [notes]
- Growth: [notes]
- Recent observations: [notes]
[If Wheel roles exist:]
- Serves as [role] for Wheel: [wheel hub description]
```

### Helm-to-Crew Flow

When the user mentions someone in conversation who seems significant:

**If the person IS in Crew:**
- AI references their context naturally (doesn't announce "I see Jake is your coworker")
- If something substantive and worth saving emerges about the person, AI offers to save it: "That's a useful insight about Jake. Want me to save that to his profile?"
- For people with `has_rich_context = true`: saved to `crew_notes` with appropriate category
- For basic crew members: appended to freeform `notes` field

**If the person is NOT in Crew:**
The AI offers to add them when they seem significant. Significance heuristics:
- The user is processing a conflict or emotional situation involving this person
- The user is asking for advice about how to interact with this person
- The person comes up with emotional weight (frustration, gratitude, concern)
- The person has been mentioned in multiple conversations (if detectable from recent Helm history)

The AI does NOT offer for:
- Casual mentions ("the barista was nice today")
- One-off transactional interactions
- People mentioned in passing without emotional or relational significance

When offering: "I don't have any context on [name]. Would you like to add them to your Crew so I can remember who they are?"
If user says yes: AI asks for relationship type and any quick context, creates the `people` record. User can flesh out the profile later.

### Sphere Gap Coaching

When the AI knows a person's desired and current spheres differ, it can help close the gap — but only when the user is in a relevant conversation, not as unsolicited advice.

**Moving someone INWARD (strengthening the relationship):**
- AI suggests specific actions: invite to dinner, send a text, initiate shared activity, schedule time together
- Tracks whether the user has mentioned interactions with this person recently
- Can produce Compass tasks

**Moving someone OUTWARD (protecting boundaries):**
- AI validates the boundary: "Their opinions carry the weight you'd give someone in the Community sphere, not a family authority."
- Helps reframe interactions when they happen: "When [name] said that, remember — you've placed them in Acquaintances for a reason. Their opinion doesn't need to carry Family-level weight."
- Does not suggest cutting people off — suggests appropriate influence calibration

**Detecting misalignment between behavior and intention:**
- If the user placed social media in Geo-Political but journal entries suggest it's operating at Friends-level influence, the AI can gently reflect this
- If a person is placed in Acquaintances but dominates Helm conversations with high emotional weight, the AI notices the discrepancy
- Reflection only — never accusatory, always curious: "I notice [name] comes up a lot in our conversations with a lot of emotional weight. You've placed them in Acquaintances. Is that still where you want their influence to be?"

### Covey's Circle of Influence vs. Atwater's Sphere

Both frameworks are available. They serve different purposes:

- **Atwater's Sphere of Influence** (this feature): What you ALLOW to influence YOU (inward). About managing inputs.
- **Covey's Circle of Influence**: What you CAN influence (outward). About managing energy and focus.

The AI can reference either framework naturally in conversation when relevant. If the user is spending energy worrying about things outside their control, Covey's framework applies. If the user is being disproportionately affected by someone who shouldn't have that much influence, Atwater's framework applies.

The Sphere visualization is Atwater's. Covey's framework is applied conversationally at the Helm, not as a separate visualization.

### Children-Specific AI Behavior

When the user is discussing a child who has rich context (`has_rich_context = true`):
- AI references the child's personality, interests, and challenges naturally
- AI can suggest age-appropriate parenting strategies
- AI references recent observations and growth notes to track development over time
- AI connects parenting approach to Mast principles (what kind of father does the user want to be?)
- AI can suggest conversation starters for Parent-Child Mentor meetings (PRD-17)
- Redirect to prayer and divine guidance for challenging parenting situations: "Have you taken this to the Lord? What kind of father do you feel called to be in this moment?"

---

## Cross-Feature Connections

### → The Wheel: Spoke 4 (Defined in PRD-11)
Crew provides the pool of people from which Spoke 4 support roles are assigned. The AI suggests people from appropriate spheres:
- Supporter: ideally from Family or Friends sphere
- Reminder: ideally proximate to the change environment
- Observer: ideally able to see the user in context

When a person is assigned a Wheel role, that role is displayed on their Crew profile page.

### → Meeting Frameworks (PRD-17)
- Parent-Child Mentor meetings link to specific children in Crew
- Meeting notes are stored in the Log with the child's `person_id` as a reference
- Crew page displays recent meeting notes per child
- Couple Meeting uses First Mate context (PRD-12), not Crew

### → Reminders (PRD-18)
Crew data feeds people-related nudges:
- Important dates (birthdays, etc.) trigger date-based reminders
- Sphere gap awareness can generate periodic check-in nudges
- Children's context can inform parenting-related prompts

### → The Keel
Sphere awareness informs self-knowledge about boundary patterns. If the AI notices the user consistently struggles with boundaries (from Helm conversations + sphere assignments), it can reflect this as a Keel-level pattern.

### → Log Routing
Log entries can be routed to a specific person's crew_notes (for people with rich context). Added as a routing option alongside Compass, Mast, Keel, First Mate, Victory, etc.

---

## Onboarding Integration

During onboarding (Step 7 — optional, same step as First Mate):

After the optional First Mate setup, the AI can ask:
1. "Would you like to add any other important people? Children, parents, close friends, coworkers — anyone you might mention in our conversations?"
2. For each person: name, relationship type, and one sentence of context
3. "You can always add more people and details later from the Crew page."

Sphere assignment is NOT part of onboarding. It's introduced later when the user discovers the Sphere View or when the AI suggests it in conversation.

---

## Edge Cases

### Empty Crew
- Crew page shows a friendly setup prompt: "Add the important people in your life so I can give you better advice when they come up."
- AI still functions for all other features. When user mentions unknown names, AI works with available context.
- No nagging about empty Crew.

### Duplicate Names
- Multiple people can share the same name (two Jakes, etc.)
- AI disambiguates by relationship type and conversation context
- If uncertain: "Are you talking about Jake your son or Jake from work?"

### Spouse Appears in Both First Mate and Crew
- The spouse record (`is_first_mate = true`) appears in the Immediate Family category section on the Crew page
- Tapping the spouse card navigates to the First Mate page, not a Crew detail page
- The spouse does not get a separate crew_notes system — all spouse context lives in `spouse_insights`

### Archived People
- Archived crew members stop appearing in category and sphere views
- Their context is no longer loaded into AI prompts
- They can be restored at any time
- Wheel roles referencing archived people show a note: "[name] (archived)"

### Sphere Focus — Fixed Center
- For married users: Focus sphere always contains Self, Spouse, God. These cannot be removed or moved.
- For unmarried future users: Focus contains Self and God (or just Self for secular users). Adapts to user's Mast.

### Non-Person Entity Gaps
- If a non-person entity (e.g., "Instagram") has a gap between desired and current sphere, the AI can help with practical strategies: screen time limits, unfollowing accounts, content curation, etc.
- These strategies are about managing the influence channel, not about the entity itself.

### Rich Context Upgrade
- Children automatically get `has_rich_context = true` when created with relationship_type = 'child'
- Other relationship types start with `has_rich_context = false` (basic notes only)
- User can upgrade any person to rich context from their detail page: "Enable detailed notes" button sets `has_rich_context = true` and shows the categorized crew_notes interface

---

## What "Done" Looks Like

### MVP
- Crew page with Category View (default): people grouped by category, collapsible sections
- Add Crewmate: name, relationship type, categories, age, notes
- Person detail page with header info, notes, and Wheel roles display
- Children get rich context (crew_notes with categories): personality, interests, challenges, growth, observations
- Rich context upgrade available for any person
- Add/edit/archive crew members and notes
- Sphere assignment on people: desired and current sphere, inline editor
- Sphere View (list-based): six sections ordered center outward, with gap indicators
- Non-person sphere entities (sphere_entities table)
- Helm-to-Crew flow: AI recognizes names, loads context, offers to add significant unknowns, offers to save insights
- AI auto-categorizes crew_notes on save (same pattern as Log tagging and spouse_insights)
- Spouse card in Crew links to First Mate page
- RLS on all tables

### MVP When Dependency Is Ready
- Meeting notes display per child (requires PRD-17 Meeting Frameworks)
- Log routing to crew_notes (requires Log routing extension)
- Sphere-informed Reminders nudges (requires PRD-18)
- File upload for crew_notes (requires file processing pipeline)

### Post-MVP
- Interactive concentric circles Sphere visualization (drag-and-drop on desktop, tap-to-assign on mobile)
- Sphere gap coaching integrated into regular Helm conversations
- AI detection of misalignment between sphere placement and behavioral patterns (journal + conversation analysis)
- Covey's Circle of Influence as a separate complementary visualization
- Color coding by category in Sphere visualization
- Relationship timeline per person (key events, meetings, notes over time)

---

## CLAUDE.md Additions from This PRD

- [ ] Crew context loaded selectively: when user mentions a name, on Crew page, during Wheel Spoke 4, Meeting Frameworks, and interpersonal Safe Harbor conversations
- [ ] Name matching: AI maintains lightweight lookup from people table, disambiguates by relationship type and context
- [ ] Helm-to-Crew flow: AI offers to add unknown people when they seem significant (emotional weight, advice-seeking, conflict processing, repeated mentions). Does NOT offer for casual/transactional mentions.
- [ ] Helm-to-Crew save: AI offers to save substantive insights about crew members to crew_notes (rich context) or freeform notes (basic)
- [ ] Children get rich context by default (has_rich_context = true). Other relationship types can be upgraded.
- [ ] Sphere of Influence: Atwater framework (inward — what you ALLOW to influence you). Distinct from Covey's Circle of Influence (outward — what you CAN influence). Both available conversationally.
- [ ] Sphere gap coaching: only in relevant conversation context, never unsolicited. Inward = strengthen, outward = boundary calibration (not cutting off).
- [ ] Non-person entities: lightweight sphere_entities table for social media, news, politics, etc.
- [ ] Spouse in Crew: appears in Immediate Family category, tapping navigates to First Mate page. No duplicate context system.
- [ ] Convention: Log entries routable to crew_notes for people with rich context
- [ ] Convention: crew_notes AI auto-categorized on save, user can adjust

---

## DATABASE_SCHEMA Additions from This PRD

Tables added/modified:
- `people`: added `desired_sphere`, `current_sphere`, `has_rich_context` columns
- `crew_notes`: new table (categorized context for children and close relationships)
- `sphere_entities`: new table (non-person influences in spheres)

Update `log_entries.routed_to` enum to include: `'crew_note'`

Update "Tables Not Yet Defined" section:
- ~~people_sphere | PRD-13~~ → REPLACED by columns on people table (desired_sphere, current_sphere)
- crew_notes | PRD-13 | DONE
- sphere_entities | PRD-13 | DONE

Update Foreign Key map:
- people → crew_notes (person_id → people.id)

---

*End of PRD-13*
