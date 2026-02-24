# Build Prompt: Phase 8A — First Mate + Crew

> Paste this entire prompt into a fresh Claude Code session. It contains all context needed to build Phase 8A.

---

## Project Context

StewardShip is a personal growth PWA (Vite + React + TypeScript + Supabase) with nautical theming. Phases 1–7 are complete. Read `CLAUDE.md` for all conventions before writing code.

**Phase 8A builds two relationship features:**
- **First Mate** (PRD-12): Spouse/partner profile, insights, prompt system, Marriage Toolbox guided modes
- **Crew** (PRD-13): People profiles, categories, crew_notes for children/rich-context people
- **User Flexibility** (ADDENDUM): Gender/relationship-status adaptive language throughout

**Key PRD docs to reference during implementation:**
- `docs/PRD-12-First-Mate.md`
- `docs/PRD-13-Crew-Sphere.md`
- `docs/ADDENDUM-User-Flexibility.md`
- `docs/DATABASE_SCHEMA.md`

---

## Pre-Build Verification

Before writing any code:

1. **Verify TypeScript compiles:** Run `npx tsc --noEmit` and fix any existing errors first.
2. **Verify dev server runs:** Run `npm run dev` briefly to confirm no build errors.
3. **Read the existing patterns in these files** (you'll extend them all):
   - `src/lib/types.ts` — follow existing interface style
   - `src/lib/systemPrompt.ts` — follow the `shouldLoad*` + keyword pattern
   - `src/lib/contextLoader.ts` — follow the parallel-fetch-then-format pattern
   - `src/contexts/HelmContext.tsx` — see how `startGuidedConversation` works
   - `src/hooks/useWheel.ts` or `src/hooks/useRigging.ts` — follow existing hook patterns (useState, useCallback, supabase queries)
   - `src/pages/Wheel.tsx` or `src/pages/Rigging.tsx` — follow existing page patterns (page context, FAB, guided mode CTA)
   - `src/hooks/useUnloadTheHold.ts` lines 242-255 — the person_note stub to wire

---

## Step 1: TypeScript Types (`src/lib/types.ts`)

Add these interfaces and types to the existing types file. Follow the file's existing conventions (interfaces for data objects, union types for enums, all IDs as `string`, all timestamps as `string`, nullable fields as `field: string | null`).

### New Types to Add

```typescript
// --- Relationship Types ---

export type RelationshipType = 'spouse' | 'child' | 'parent' | 'sibling' | 'coworker' | 'friend' | 'mentor' | 'other';

export type SphereLevel = 'focus' | 'family' | 'friends' | 'acquaintances' | 'community' | 'geo_political';

export type SpouseInsightCategory =
  | 'personality'
  | 'love_appreciation'
  | 'communication'
  | 'dreams_goals'
  | 'challenges_needs'
  | 'their_world'
  | 'observation'
  | 'their_response'
  | 'gratitude'
  | 'general';

export type SpouseInsightSourceType = 'manual' | 'uploaded_file' | 'helm_conversation' | 'spouse_prompt' | 'log_routed';

export type SpousePromptType = 'ask_them' | 'reflect' | 'express';

export type SpousePromptStatus = 'pending' | 'acted_on' | 'skipped';

export type CrewNoteCategory = 'personality' | 'interests' | 'challenges' | 'growth' | 'observation' | 'general';

export type CrewNoteSourceType = 'manual' | 'uploaded_file' | 'helm_conversation' | 'meeting_notes' | 'log_routed';

export interface ImportantDate {
  label: string;
  date: string;
  recurring: boolean;
}

// --- People (shared between First Mate and Crew) ---

export interface Person {
  id: string;
  user_id: string;
  name: string;
  relationship_type: RelationshipType;
  is_first_mate: boolean;
  categories: string[];
  notes: string | null;
  age: number | null;
  personality_summary: string | null;
  love_language: string | null;
  important_dates: ImportantDate[] | null;
  desired_sphere: SphereLevel | null;
  current_sphere: SphereLevel | null;
  has_rich_context: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Spouse Insights ---

export interface SpouseInsight {
  id: string;
  user_id: string;
  person_id: string;
  category: SpouseInsightCategory;
  text: string;
  source_type: SpouseInsightSourceType;
  source_label: string | null;
  source_reference_id: string | null;
  file_storage_path: string | null;
  is_rag_indexed: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Spouse Prompts ---

export interface SpousePrompt {
  id: string;
  user_id: string;
  person_id: string;
  prompt_type: SpousePromptType;
  prompt_text: string;
  status: SpousePromptStatus;
  response_text: string | null;
  response_saved_as_insight: boolean;
  insight_id: string | null;
  generation_context: string | null;
  created_at: string;
  acted_on_at: string | null;
}

// --- Crew Notes ---

export interface CrewNote {
  id: string;
  user_id: string;
  person_id: string;
  category: CrewNoteCategory;
  text: string;
  source_type: CrewNoteSourceType;
  source_label: string | null;
  source_reference_id: string | null;
  file_storage_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Label Maps to Add

```typescript
export const SPOUSE_INSIGHT_CATEGORY_LABELS: Record<SpouseInsightCategory, string> = {
  personality: 'Personality & Wiring',
  love_appreciation: 'Love & Appreciation',
  communication: 'Communication',
  dreams_goals: 'Dreams & Goals',
  challenges_needs: 'Challenges & Needs',
  their_world: 'Their World',
  observation: 'Observations',
  their_response: 'Their Responses',
  gratitude: 'Gratitude',
  general: 'General',
};

export const SPOUSE_INSIGHT_CATEGORY_ORDER: SpouseInsightCategory[] = [
  'personality', 'love_appreciation', 'communication', 'dreams_goals',
  'challenges_needs', 'their_world', 'gratitude', 'observation', 'their_response', 'general',
];

export const SPOUSE_PROMPT_TYPE_LABELS: Record<SpousePromptType, string> = {
  ask_them: 'Ask',
  reflect: 'Reflect',
  express: 'Express',
};

export const CREW_NOTE_CATEGORY_LABELS: Record<CrewNoteCategory, string> = {
  personality: 'Personality',
  interests: 'Interests',
  challenges: 'Challenges',
  growth: 'Growth',
  observation: 'Observations',
  general: 'General',
};

export const CREW_NOTE_CATEGORY_ORDER: CrewNoteCategory[] = [
  'personality', 'interests', 'challenges', 'growth', 'observation', 'general',
];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
  coworker: 'Coworker',
  friend: 'Friend',
  mentor: 'Mentor',
  other: 'Other',
};

// Crew display sections — people grouped by these categories
export const CREW_SECTIONS = [
  { key: 'immediate_family', label: 'Immediate Family', types: ['spouse', 'child'] as RelationshipType[] },
  { key: 'extended_family', label: 'Extended Family', types: ['parent', 'sibling'] as RelationshipType[] },
  { key: 'professional', label: 'Professional', types: ['coworker', 'mentor'] as RelationshipType[] },
  { key: 'social', label: 'Social & Friends', types: ['friend'] as RelationshipType[] },
  { key: 'other', label: 'Other', types: ['other'] as RelationshipType[] },
];
```

**Note:** Both `their_world` and `their_response` use gender-neutral DB values (renamed via migrations 003 and 008). The UI labels display as "Their World" / "Their Responses" by default. When the user has spouse gender context, the page can dynamically substitute "His World" / "Her World" / "Their World" and "His Responses" / "Her Responses" / "Their Responses" — implement this in the component, not the label map.

---

## Step 2: Hooks

### 2A: `src/hooks/useFirstMate.ts`

Create this hook following the pattern of `useWheel.ts` / `useRigging.ts`. It manages:

**State:**
- `spouse: Person | null` — the First Mate record
- `insights: SpouseInsight[]` — all active insights
- `prompts: SpousePrompt[]` — prompt history (last 20)
- `activePrompt: SpousePrompt | null` — current pending prompt
- `loading: boolean`
- `error: string | null`

**Functions:**

1. `fetchSpouse()` — Query `people` where `is_first_mate = true` and `archived_at IS NULL` for the current user. Returns one or null.

2. `createSpouse(data: { name: string; relationship_type?: RelationshipType; age?: number; personality_summary?: string; love_language?: string; important_dates?: ImportantDate[] })` — Insert into `people` with `is_first_mate: true`. Auto-set `categories: ['immediate_family']`. Return the created Person.

3. `updateSpouse(updates: Partial<Person>)` — Update the First Mate record. Prevent changing `is_first_mate` or `user_id`.

4. `fetchInsights(category?: SpouseInsightCategory)` — Query `spouse_insights` for the spouse's `person_id`, ordered by `created_at DESC`. Optional category filter.

5. `createInsight(data: { text: string; category: SpouseInsightCategory; source_type?: SpouseInsightSourceType; source_label?: string; source_reference_id?: string })` — Insert into `spouse_insights` with `person_id` from current spouse.

6. `updateInsight(id: string, updates: { text?: string; category?: SpouseInsightCategory })` — Update a specific insight.

7. `archiveInsight(id: string)` — Set `archived_at` to now.

8. `fetchPrompts(limit?: number)` — Query `spouse_prompts` ordered by `created_at DESC`, default limit 20.

9. `fetchActivePrompt()` — Query `spouse_prompts` where `status = 'pending'`, limit 1, most recent.

10. `generatePrompt(promptType: SpousePromptType)` — Call the AI Edge Function (`helm-chat`) with a focused prompt that takes the spouse insights as context and generates a prompt of the specified type. The system prompt should include: spouse name, available insights by category, any Mast principles about marriage, and instructions specific to the prompt type:
    - `ask_them`: Generate a thoughtful question to ask the spouse. Should be specific to what's known/unknown about them. Prioritize gap-filling (areas with few insights) and depth (areas with surface-level entries).
    - `reflect`: Generate a reflection prompt about the user's relationship. Something to consider, remember, or meditate on about their spouse.
    - `express`: Generate a prompt for expressing love/appreciation. Could be words to say, an action to take, or something to write.

    Save the result to `spouse_prompts` with `status: 'pending'`. Return the prompt.

11. `respondToPrompt(id: string, response: { response_text: string; saveAsInsight: boolean; insightCategory?: SpouseInsightCategory })` — Update the prompt with `status: 'acted_on'`, `response_text`, `acted_on_at: new Date().toISOString()`. If `saveAsInsight` is true, also create a `spouse_insights` record with the response text and set `response_saved_as_insight: true` and `insight_id` on the prompt.

12. `skipPrompt(id: string)` — Update the prompt with `status: 'skipped'`.

13. `saveGratitude(text: string)` — Dual save: (1) Create a `log_entries` record with `entry_type: 'gratitude'`, `life_area_tags: ['marriage']`, `source: 'first_mate'`, (2) Create a `spouse_insights` record with `category: 'gratitude'`, `source_type: 'manual'`. Return both IDs.

**For prompt generation (#10):** Use the existing `supabase.functions.invoke('helm-chat', ...)` pattern. Construct a mini system prompt:
```
Generate a single ${promptType} prompt for the user about their spouse ${spouseName}.
Context about the spouse: [formatted insights by category]
Rules: Be specific and personal based on what you know. No generic prompts. No emoji.
For ask_them: A question to ask them in person. Should reveal something meaningful.
For reflect: Something to reflect on about their relationship or their spouse.
For express: A specific way to express love or appreciation today.
Respond with ONLY the prompt text, nothing else.
```

### 2B: `src/hooks/useCrew.ts`

Create this hook. It manages:

**State:**
- `people: Person[]` — all active non-archived crew members (including spouse)
- `selectedPerson: Person | null`
- `crewNotes: CrewNote[]` — notes for selected person
- `loading: boolean`
- `error: string | null`

**Functions:**

1. `fetchPeople()` — Query `people` where `archived_at IS NULL`, ordered by `is_first_mate DESC, name ASC`. Include the spouse in the result set (they'll be rendered differently in the UI).

2. `fetchPerson(id: string)` — Fetch a single person by ID.

3. `createPerson(data: { name: string; relationship_type: RelationshipType; categories?: string[]; notes?: string; age?: number; personality_summary?: string; love_language?: string; important_dates?: ImportantDate[] })` — Insert into `people`. If `relationship_type === 'child'`, auto-set `has_rich_context: true`. Default `categories` to an empty array.

4. `updatePerson(id: string, updates: Partial<Person>)` — Update. Prevent changing `user_id`.

5. `archivePerson(id: string)` — Set `archived_at`. If this is the First Mate (`is_first_mate = true`), warn in the UI before proceeding (handled at the component level, not here — just do the archive).

6. `fetchCrewNotes(personId: string, category?: CrewNoteCategory)` — Query `crew_notes` for a person, ordered by `created_at DESC`.

7. `createCrewNote(personId: string, data: { text: string; category: CrewNoteCategory; source_type?: CrewNoteSourceType; source_label?: string; source_reference_id?: string })` — Insert into `crew_notes`.

8. `updateCrewNote(id: string, updates: { text?: string; category?: CrewNoteCategory })` — Update a crew note.

9. `archiveCrewNote(id: string)` — Set `archived_at`.

10. `searchPeopleByName(query: string)` — Simple search: query `people` where `name ILIKE %query%` and `archived_at IS NULL`. Used for AI name matching and Unload the Hold routing.

---

## Step 3: Components

### 3A: First Mate Components (`src/components/firstmate/`)

Create this directory with these components:

**`FirstMateProfile.tsx`**
- Displays spouse name (large, Georgia font), personality summary, love language, important dates
- Edit button opens inline editing mode (same pattern as Mast/Keel entry editing)
- If no spouse exists yet, show a "Set Up First Mate" CTA that opens a creation form
- Uses Card from shared components

**`PromptCard.tsx`**
- Card with three buttons: dynamic labels based on spouse gender context
  - Default: "Ask Them" / "Reflect" / "Express"
  - With male spouse context: "Ask Him" / "Reflect" / "Express"
  - With female spouse context: "Ask Her" / "Reflect" / "Express"
- If there's an active prompt (status = 'pending'), show it prominently with response input
- Response actions: text area + "Done — Record Response" (opens category picker if saving as insight) + "Skip"
- After acting, show option to generate a new prompt

**`MarriageToolbox.tsx`**
- Five buttons, each launching a guided conversation at the Helm:
  - Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude
- Each button calls `startGuidedConversation('first_mate_action', subtypeHere, spouse.id)` then `expandDrawer()` or `navigate('/helm')`
- Only visible when `relationship_status === 'married'`
- For `relationship_status === 'dating'`, show as "Relationship Toolbox" with adapted labels (see Addendum)

**`InsightCard.tsx`**
- Displays a single insight: text, source label, date
- Edit button for inline editing (text + category)
- Archive action (with confirmation)

**`InsightCategorySection.tsx`**
- Collapsible section (use `CollapsibleGroup` from shared) for a category
- Lists InsightCards within
- "Add" button at section level

**`AddInsightModal.tsx`**
- Modal with text area + category selector (default to the category of the section user clicked "Add" from)
- "Save" creates insight, "Discuss at The Helm" opens Helm with First Mate context
- Source type defaults to 'manual'

**`GratitudeCapture.tsx`**
- Simple text input + "Save" button
- Calls `useFirstMate().saveGratitude(text)` which dual-saves to Log and spouse_insights
- Shows brief confirmation after save

**`PastPrompts.tsx`**
- Reverse-chronological list of past prompts with their responses
- Each shows: prompt type badge, prompt text, response (if any), date
- Filter by prompt type

### 3B: Crew Components (`src/components/crew/`)

Create this directory with these components:

**`CrewCategoryView.tsx`**
- Groups people by `CREW_SECTIONS` (Immediate Family, Extended Family, Professional, Social, Other)
- Each section is collapsible (use `CollapsibleGroup`)
- Spouse card in "Immediate Family" — tapping navigates to `/first-mate` instead of person detail
- Empty sections hidden (not shown blank)

**`PersonCard.tsx`**
- Card showing: name, relationship type badge, age (if set and is child), sphere indicator (small dot if `desired_sphere` set)
- Tap opens person detail (except spouse → navigates to First Mate)
- Compact layout for list view

**`PersonDetail.tsx`**
- Full detail view for a person (page or full-screen modal)
- Header: name (editable), relationship type, age, categories, personality summary, love language
- Important dates section (add/edit/remove dates)
- If `has_rich_context` (children, or user-upgraded): Show categorized crew_notes sections (like InsightCategorySection pattern)
- If basic context: Show freeform notes text area
- Actions: "Discuss at The Helm" (opens Helm with crew context and `personId`), "Upgrade to Rich Context" button (sets `has_rich_context: true`), "Archive" (with confirmation)
- "Upgrade to Rich Context" only visible for people where `has_rich_context` is false

**`AddCrewmateModal.tsx`**
- Form: name (required), relationship type (required), age (optional), categories (multi-select checkboxes), notes (optional)
- If relationship_type = 'child', auto-set `has_rich_context: true` in the hook

**`CrewNoteCard.tsx`**
- Similar to InsightCard: text, category badge, source label, date, edit/archive actions

**`AddCrewNoteModal.tsx`**
- Modal: text area + category selector (defaults to 'general')
- Save creates crew_note

### 3C: Shared Updates

**No new shared components needed** — reuse `Card`, `CollapsibleGroup`, `EmptyState`, `FloatingActionButton`, `Button`, `Input`, `TagChips`, `AddEntryModal` patterns from existing shared components.

---

## Step 4: Pages

### 4A: `src/pages/FirstMate.tsx` — Full Rebuild

Replace the current stub with a full page. Structure:

```
Page Layout:
├── usePageContext({ page: 'firstmate' })
├── Visibility gate: if relationship_status is 'single' or undefined, show EmptyState with message
├── FirstMateProfile (spouse card at top)
│   └── If no spouse: "Set up your First Mate" CTA → creation form
├── PromptCard (Ask/Reflect/Express)
├── MarriageToolbox (5 guided mode buttons) — only if married
├── GratitudeCapture (quick gratitude input)
├── Insight sections (one CollapsibleGroup per category with insights)
├── FAB → AddInsightModal
└── "Past Prompts" link/button → PastPrompts view
```

**Visibility rules (from Addendum):**
- `relationship_status === 'single'` or `null/undefined`: Page hidden from nav. If accessed directly, show redirect message.
- `relationship_status === 'dating'`: Available but adapted. "First Mate" label stays. Marriage Toolbox becomes "Relationship Toolbox". No sacred triangle language.
- `relationship_status === 'married'`: Full features.
- `relationship_status === 'divorced'` or `'widowed'`: Available if they have or want to add a First Mate record. Sensitivity in language.

**Read `user_profiles.relationship_status` via a query or from the auth context.** If the auth context doesn't have it, fetch it.

### 4B: `src/pages/Crew.tsx` — Full Rebuild

Replace the current stub. Structure:

```
Page Layout:
├── usePageContext({ page: 'crew' })
├── View toggle: "By Category" (default) | "By Sphere" (Phase 8B — stub with message)
├── CrewCategoryView (default view)
│   └── Sections: Immediate Family, Extended Family, Professional, Social, Other
│   └── Person cards in each section
│   └── Spouse card → navigates to /first-mate
├── FAB → AddCrewmateModal
├── Person detail (when person selected) → either inline panel or separate route
└── Empty state when no crew members
```

**For Phase 8A:** The "By Sphere" toggle should be visible but show a placeholder message "Sphere view coming soon" or similar. It will be implemented in Phase 8B.

**Person detail routing:** Either use a sub-route like `/crew/:personId` or an in-page panel/modal. Follow the pattern used by Rigging's PlanDetail (check how that works — it may use a selected state with a detail panel). Whichever pattern is more consistent with the codebase.

---

## Step 5: AI Integration

### 5A: System Prompt Updates (`src/lib/systemPrompt.ts`)

**Add to `SystemPromptContext` interface:**
```typescript
firstMateContext?: string;
crewContext?: string;
```

**Add keyword arrays:**
```typescript
const FIRSTMATE_KEYWORDS = [
  'wife', 'husband', 'spouse', 'partner', 'marriage', 'married',
  'relationship', 'love language', 'date night', 'anniversary',
  'compliment', 'appreciate', 'grateful for her', 'grateful for him',
  'quality time', 'gifts', 'acts of service', 'words of affirmation',
  'physical touch', 'affection', 'romantic', 'couple',
];

const CREW_KEYWORDS = [
  'friend', 'coworker', 'boss', 'parent', 'mother', 'father',
  'son', 'daughter', 'brother', 'sister', 'child', 'kids',
  'family', 'mentor', 'colleague', 'team', 'neighbor',
];
```

**Add `shouldLoadFirstMate` function:**
```typescript
export function shouldLoadFirstMate(message: string, pageContext: string, guidedMode?: GuidedMode): boolean {
  if (pageContext === 'firstmate') return true;
  if (guidedMode === 'first_mate_action') return true;
  const lower = message.toLowerCase();
  return FIRSTMATE_KEYWORDS.some(kw => lower.includes(kw));
}
```

**Add `shouldLoadCrew` function:**
```typescript
export function shouldLoadCrew(message: string, pageContext: string): boolean {
  if (pageContext === 'crew') return true;
  if (pageContext === 'firstmate') return true;
  const lower = message.toLowerCase();
  return CREW_KEYWORDS.some(kw => lower.includes(kw));
}
```

**Add guided mode prompt for `first_mate_action`** in the `getGuidedModePrompt` switch:

```typescript
case 'first_mate_action':
  // The subtype is not passed to this function directly,
  // but the guided_subtype is on the conversation record.
  // Add a general first_mate_action prompt:
  return `\n\nGUIDED MODE: FIRST MATE — MARRIAGE TOOLBOX

You are guiding the user through a relationship-focused conversation about their spouse/partner.

CONTEXT LOADED: Spouse insights, Keel personality data, and Mast principles are available to you.

RELATIONSHIP SAFETY — THREE TIERS:
- Tier 1 (Capacity Building): Normal relationship challenges. Provide communication tools, talking points, perspective-taking exercises.
- Tier 2 (Professional Referral): Complex or entrenched patterns. Help prepare for therapy, encourage professional help. "This might be worth exploring with a counselor."
- Tier 3 (Safety Assessment): If red flags appear (fear, control, isolation, escalation), Crisis Override activates immediately. No "work on it" advice.

SUBTYPES (the specific toolbox mode will be indicated in the conversation):
- Quality Time: Help plan dates and quality time based on who the spouse is. Produce specific, actionable date ideas as Compass tasks.
- Gifts: Brainstorm meaningful gifts connected to who the spouse is, not generic suggestions. Produce task ideas.
- Observe and Serve: Help the user notice and serve. Nudge awareness of repeated frustrations, put-off requests, overlooked needs. Produce task ideas.
- Words of Affirmation: Help the user see and articulate what's incredible about their spouse. Can include the 21 Compliments Practice.
- Gratitude: Go deeper on gratitude for the spouse. Build on quick capture entries.

SACRED TRIANGLE (for married users with faith Mast entries):
Becoming a better spouse = drawing closer to God. Frame growth as stewardship of the marriage, not performance optimization.

RULES:
- Use the SPOUSE'S love language for suggestions, not the user's.
- All five love languages matter — vary suggestions, don't only suggest the primary one.
- Produce Compass tasks when the conversation reaches actionable items. Confirm with user before creating.
- Be warm, not clinical. This is about love, not project management.
- Never generic ("Buy her flowers"). Always specific to what you know about this particular spouse.
- Redirect to human connection: "Have you told her that?" / "Maybe say that to him tonight."`;
```

**Add context formatting functions:**

```typescript
function formatFirstMateContext(spouseName: string, insights: SpouseInsight[]): string {
  if (insights.length === 0) {
    return `\n\nFIRST MATE: ${spouseName} (no detailed insights recorded yet).\n`;
  }

  let result = `\n\nABOUT THE USER'S SPOUSE — ${spouseName}:\n`;

  // Group by category
  const byCategory: Record<string, SpouseInsight[]> = {};
  for (const insight of insights) {
    if (!byCategory[insight.category]) byCategory[insight.category] = [];
    byCategory[insight.category].push(insight);
  }

  for (const [category, items] of Object.entries(byCategory)) {
    const label = SPOUSE_INSIGHT_CATEGORY_LABELS[category as SpouseInsightCategory] || category;
    result += `\n${label.toUpperCase()}:\n`;
    for (const item of items.slice(0, 5)) {
      const truncated = item.text.length > 200 ? item.text.slice(0, 197) + '...' : item.text;
      result += `- ${truncated}\n`;
    }
    if (items.length > 5) {
      result += `  (${items.length - 5} more entries)\n`;
    }
  }

  return result;
}

function formatCrewContext(people: Person[], notes?: CrewNote[]): string {
  if (people.length === 0) return '';

  let result = '\n\nCREW (People in the user\'s life):\n';
  for (const p of people.slice(0, 15)) {
    result += `- ${p.name} (${p.relationship_type})`;
    if (p.age) result += `, age ${p.age}`;
    if (p.personality_summary) {
      const truncated = p.personality_summary.length > 80 ? p.personality_summary.slice(0, 77) + '...' : p.personality_summary;
      result += ` — ${truncated}`;
    }
    result += '\n';
  }
  if (people.length > 15) {
    result += `  ...and ${people.length - 15} more\n`;
  }

  // If notes provided (for a specific person in context), add them
  if (notes && notes.length > 0) {
    result += '\nDetailed notes for this person:\n';
    for (const n of notes.slice(0, 10)) {
      const truncated = n.text.length > 150 ? n.text.slice(0, 147) + '...' : n.text;
      result += `- [${CREW_NOTE_CATEGORY_LABELS[n.category] || n.category}] ${truncated}\n`;
    }
  }

  return result;
}
```

**Update `buildSystemPrompt`** to include the new contexts in the conditional section (after the existing context blocks, before the return):

```typescript
if (context.firstMateContext) {
  const fmTokens = estimateTokens(context.firstMateContext);
  if (currentTokens + fmTokens < budget) {
    prompt += context.firstMateContext;
    currentTokens += fmTokens;
  }
}

if (context.crewContext) {
  const crewTokens = estimateTokens(context.crewContext);
  if (currentTokens + crewTokens < budget) {
    prompt += context.crewContext;
    currentTokens += crewTokens;
  }
}
```

### 5B: Context Loader Updates (`src/lib/contextLoader.ts`)

**Import the new types and functions.** Add to the imports:
```typescript
import type { Person, SpouseInsight, CrewNote } from './types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS, CREW_NOTE_CATEGORY_LABELS } from './types';
import { shouldLoadFirstMate, shouldLoadCrew } from './systemPrompt';
```

**Add to LoadContextOptions:** No changes needed — `message`, `pageContext`, `guidedMode` already provide what's needed.

**Add loading logic in `loadContext()`:**

After the existing `needRigging` line, add:
```typescript
const needFirstMate = shouldLoadFirstMate(message, pageContext, guidedMode);
const needCrew = shouldLoadCrew(message, pageContext);
```

Add variables:
```typescript
let firstMateContext: string | undefined;
let crewContext: string | undefined;
```

Add Supabase queries in the parallel fetch (add to the existing Promise.all or create a second batch):

```typescript
// First Mate: fetch spouse + insights
const firstMatePromise = needFirstMate
  ? supabase
      .from('people')
      .select('*')
      .eq('user_id', userId)
      .eq('is_first_mate', true)
      .is('archived_at', null)
      .maybeSingle()
  : null;

const spouseInsightsPromise = needFirstMate
  ? supabase
      .from('spouse_insights')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
  : null;

// Crew: fetch all people
const crewPromise = needCrew
  ? supabase
      .from('people')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('name')
      .limit(50)
  : null;
```

Process results:
```typescript
if (firstMateResult?.data && spouseInsightsResult?.data) {
  const spouse = firstMateResult.data as Person;
  const insights = (spouseInsightsResult.data as SpouseInsight[]) || [];
  firstMateContext = formatFirstMateContext(spouse.name, insights);
}

if (crewResult?.data && crewResult.data.length > 0) {
  crewContext = formatCrewContext(crewResult.data as Person[]);
}
```

Add to the return object:
```typescript
firstMateContext,
crewContext,
```

**Also update `shouldLoadKeel`** — it already returns true for `pageContext === 'firstmate'`. Also add `guidedMode === 'first_mate_action'`:
```typescript
export function shouldLoadKeel(message: string, pageContext: string, guidedMode?: GuidedMode): boolean {
  if (pageContext === 'keel') return true;
  if (pageContext === 'safeharbor') return true;
  if (pageContext === 'firstmate') return true;
  if (guidedMode === 'first_mate_action') return true;
  const lower = message.toLowerCase();
  return KEEL_KEYWORDS.some((kw) => lower.includes(kw));
}
```

(Note: Check if `shouldLoadKeel` currently accepts `guidedMode` parameter. If not, add it and update the call site in `loadContext`.)

---

## Step 6: Stub Wiring

### 6A: Wire `Unload the Hold → Crew person_note routing`

In `src/hooks/useUnloadTheHold.ts`, find the `case 'person_note'` block (around line 242). Replace the stub with real Crew routing:

```typescript
case 'person_note': {
  // Wire to Crew: try to match person_name to a people record, create crew_note
  const personName = item.metadata.person_name;
  let matchedPersonId: string | null = null;

  if (personName) {
    // Try to find matching person
    const { data: matchedPeople } = await supabase
      .from('people')
      .select('id, has_rich_context')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .ilike('name', `%${personName}%`)
      .limit(1);

    if (matchedPeople && matchedPeople.length > 0) {
      matchedPersonId = matchedPeople[0].id;
      const hasRichContext = matchedPeople[0].has_rich_context;

      if (hasRichContext) {
        // Create a crew_note for rich-context people
        const { error: cnErr } = await supabase
          .from('crew_notes')
          .insert({
            user_id: user.id,
            person_id: matchedPersonId,
            category: 'observation',
            text: item.text,
            source_type: 'log_routed',
            source_reference_id: holdDump.id,
          });
        if (!cnErr) counts.personNotesCreated = (counts.personNotesCreated || 0) + 1;
        break;
      } else {
        // For basic-context people, append to their notes field
        const { data: person } = await supabase
          .from('people')
          .select('notes')
          .eq('id', matchedPersonId)
          .single();

        const existingNotes = person?.notes || '';
        const updatedNotes = existingNotes
          ? `${existingNotes}\n\n[${new Date().toLocaleDateString()}] ${item.text}`
          : `[${new Date().toLocaleDateString()}] ${item.text}`;

        await supabase
          .from('people')
          .update({ notes: updatedNotes })
          .eq('id', matchedPersonId);

        counts.personNotesCreated = (counts.personNotesCreated || 0) + 1;
        break;
      }
    }
  }

  // Fallback: No person matched — save as Log entry (same as before)
  const { error: pnErr } = await supabase
    .from('log_entries')
    .insert({
      user_id: user.id,
      text: `[Person note${personName ? `: ${personName}` : ''}] ${item.text}`,
      entry_type: 'quick_note',
      source: 'unload_the_hold',
      source_reference_id: holdDump.id,
    });
  if (!pnErr) counts.personNotesStubbed = (counts.personNotesStubbed || 0) + 1;
  break;
}
```

Update the counts interface to include `personNotesCreated` alongside `personNotesStubbed`.

### 6B: Wire `Safe Harbor → First Mate/Crew context loading`

In `src/lib/systemPrompt.ts`, update `shouldLoadFirstMate` and `shouldLoadCrew` to also trigger for `safeharbor`:

```typescript
export function shouldLoadFirstMate(message: string, pageContext: string, guidedMode?: GuidedMode): boolean {
  if (pageContext === 'firstmate') return true;
  if (pageContext === 'safeharbor') return true; // <-- add this
  if (guidedMode === 'first_mate_action') return true;
  const lower = message.toLowerCase();
  return FIRSTMATE_KEYWORDS.some(kw => lower.includes(kw));
}

export function shouldLoadCrew(message: string, pageContext: string): boolean {
  if (pageContext === 'crew') return true;
  if (pageContext === 'firstmate') return true;
  if (pageContext === 'safeharbor') return true; // <-- add this
  const lower = message.toLowerCase();
  return CREW_KEYWORDS.some(kw => lower.includes(kw));
}
```

### 6C: Wire `Wheel → Crew/Sphere references in Spoke 4`

In `src/lib/systemPrompt.ts`, in the Wheel guided mode prompt (`case 'wheel'`), find the Spoke 4 section and add a note about Crew data:

Look for the spoke 4 text in the wheel guided mode prompt and append:
```
When discussing Spoke 4 (Support), if Crew data is available in context, suggest specific people from the user's Crew for the three roles (Supporter, Reminder, Observer). Reference what you know about each person to explain why they might be a good fit. If no Crew data is loaded, ask the user who comes to mind.
```

Also update the context loader: when `guidedMode === 'wheel'`, also load Crew data. In the `needCrew` check, add:
```typescript
const needCrew = shouldLoadCrew(message, pageContext) || guidedMode === 'wheel';
```

---

## Step 7: Navigation Updates

### 7A: First Mate Visibility

In the navigation components (check `src/components/navigation/`), the First Mate nav item should be conditionally visible:
- Fetch the user's `relationship_status` from `user_profiles`
- Show First Mate nav item only if `relationship_status` is `'married'`, `'dating'`, `'divorced'`, or `'widowed'` (i.e., not `'single'` and not `null`)
- If `null` (not set), default to showing it (let the page itself handle the empty state)

### 7B: User Profile Gender/Status Access

The `user_profiles` table already has `gender` and `relationship_status` columns (from migration 003). Ensure the auth context or a profile hook exposes these. Check if `useAuth` already fetches profile data. If not, the First Mate page and Crew page can query it directly.

---

## Step 8: CSS Styling

All components must use CSS variables from the design system. Create CSS files for new components following existing patterns:

- `src/components/firstmate/FirstMate.css` (or individual component CSS files)
- `src/components/crew/Crew.css`

Key styling rules:
- Card backgrounds: `var(--color-cream)`
- Section headers: Georgia font (`var(--font-heading, Georgia, serif)`)
- Badges/pills: `var(--color-mid-teal)` background with `var(--color-white)` text
- Borders: `var(--color-slate-gray)` at reduced opacity
- No gold effects anywhere (gold is reserved for victories only)
- Mobile-first: stack layout, minimum 44px touch targets
- Collapsible sections use the same chevron pattern as Mast/Keel groups

---

## Step 9: Doc Updates

After implementation is complete, update these docs:

### 9A: `CLAUDE.md` Stub Registry

Update the status of these stubs from `STUB` to `WIRED`:
```
| Unload the Hold → Crew person_note routing | Phase 4D | Phase 8 (Crew) | WIRED |
| Wheel → Crew/Sphere references in Spoke 4 | Phase 7A | Phase 8 (Crew) | WIRED |
| Safe Harbor → First Mate/Crew context loading | Phase 7C | Phase 8 (Crew) | WIRED |
```

Add these NEW stubs:
```
| First Mate → File upload (Manifest pipeline) | Phase 8A (First Mate) | Phase 9 (Manifest) | STUB |
| First Mate → Couple Meeting integration | Phase 8A (First Mate) | Phase 10 (Meetings) | STUB |
| First Mate → Spouse prompts in Reveille/Reckoning | Phase 8A (First Mate) | Phase 10 (Reminders) | STUB |
| Crew → Parent-Child Meeting Notes tab | Phase 8A (Crew) | Phase 10 (Meetings) | STUB |
| Crew → Important dates → Reminders | Phase 8A (Crew) | Phase 10 (Reminders) | STUB |
| Helm → AI name recognition from Crew in free-form chat | Phase 8A (Crew) | Enhancement (AI context) | STUB |
| Helm → Offer to save spouse insights from conversation | Phase 8A (First Mate) | Enhancement (AI context) | STUB |
```

### 9B: `docs/StewardShip_System_Overview_PRD_v2.md`

In the build order section, update Phase 8 status to show 8A as built:
```
Phase 8: Relationships
21. First Mate — BUILT (Phase 8A)
22. Crew — BUILT (Phase 8A)
23. Sphere of Influence — Phase 8B (next)
```

### 9C: Memory Update

Update the project memory (MEMORY.md or auto-memory) to reflect Phase 8A completion.

---

## What Done Looks Like

### TypeScript
- [ ] All new types compile without errors (`npx tsc --noEmit`)
- [ ] Person, SpouseInsight, SpousePrompt, CrewNote interfaces in types.ts
- [ ] Label maps and order arrays for all categories

### Hooks
- [ ] `useFirstMate` — full CRUD for spouse, insights, prompts; dual-save gratitude; prompt generation via AI
- [ ] `useCrew` — full CRUD for people and crew_notes; name search

### Components
- [ ] `src/components/firstmate/` — FirstMateProfile, PromptCard, MarriageToolbox, InsightCard, InsightCategorySection, AddInsightModal, GratitudeCapture, PastPrompts
- [ ] `src/components/crew/` — CrewCategoryView, PersonCard, PersonDetail, AddCrewmateModal, CrewNoteCard, AddCrewNoteModal

### Pages
- [ ] `FirstMate.tsx` — full page with profile, prompts, toolbox, insight sections, FAB; visibility gated on relationship_status
- [ ] `Crew.tsx` — full page with category view, person cards, FAB, person detail; sphere toggle visible but stubbed

### AI Integration
- [ ] `SystemPromptContext` extended with `firstMateContext` and `crewContext`
- [ ] `shouldLoadFirstMate` and `shouldLoadCrew` keyword functions
- [ ] `formatFirstMateContext` and `formatCrewContext` formatting functions
- [ ] `first_mate_action` guided mode prompt with Marriage Toolbox subtypes
- [ ] Context loader fetches spouse + insights + crew when triggered
- [ ] Keel also loads for `first_mate_action` guided mode

### Stubs Wired
- [ ] Unload the Hold `person_note` routes to `crew_notes` (matched person) or `people.notes` (basic context) or falls back to Log
- [ ] Safe Harbor loads First Mate + Crew context
- [ ] Wheel Spoke 4 loads Crew context and references people

### Navigation
- [ ] First Mate nav item visibility gated on relationship_status
- [ ] Spouse card in Crew navigates to First Mate page

### Styling
- [ ] All colors via CSS variables, no hardcoded values
- [ ] Mobile-first responsive layout
- [ ] Collapsible sections, card-based layout
- [ ] No emoji, no gold effects

### Docs
- [ ] Stub Registry updated (3 wired, 7 new)
- [ ] System Overview build order updated
- [ ] Memory updated
