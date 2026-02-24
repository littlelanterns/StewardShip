# Build Prompt: Phase 8B — Sphere of Influence

> Paste this entire prompt into a fresh Claude Code session. It contains all context needed to build Phase 8B.

---

## Project Context

StewardShip is a personal growth PWA (Vite + React + TypeScript + Supabase) with nautical theming. Phases 1–7 and Phase 8A are complete. Read `CLAUDE.md` for all conventions before writing code.

**Phase 8A (just completed) built:**
- First Mate (spouse profile, insights, prompts, Marriage Toolbox guided modes)
- Crew (people profiles, categories, crew_notes)
- Types: Person, SpouseInsight, SpousePrompt, CrewNote, SphereLevel, RelationshipType, etc.
- Hooks: `useFirstMate`, `useCrew`
- AI context: `shouldLoadFirstMate`, `shouldLoadCrew`, `formatFirstMateContext`, `formatCrewContext`
- Stubs wired: Unload the Hold person_note routing, Safe Harbor context, Wheel Spoke 4 Crew references

**Phase 8B builds Sphere of Influence** (from PRD-13):
- Sphere assignment UI on people records
- Sphere View on Crew page (list-based MVP)
- Non-person sphere entities (social media, news, etc.)
- Focus sphere special rendering
- Gap indicators (desired vs current mismatch)

**Key PRD doc:** `docs/PRD-13-Crew-Sphere.md` (Sphere section)

---

## Pre-Build Verification

1. **Verify TypeScript compiles:** Run `npx tsc --noEmit` and fix any issues first.
2. **Verify Phase 8A is complete:** Check that `src/hooks/useFirstMate.ts`, `src/hooks/useCrew.ts`, `src/components/firstmate/`, `src/components/crew/` all exist and the dev server runs.
3. **Read existing code:**
   - `src/lib/types.ts` — `SphereLevel` type should already exist from Phase 8A
   - `src/hooks/useCrew.ts` — you'll extend this or create a separate `useSphere` hook
   - `src/pages/Crew.tsx` — has a "By Sphere" toggle stub to implement
   - `src/components/crew/` — existing components you may extend

---

## Step 1: TypeScript Types (`src/lib/types.ts`)

Add these types (some may already exist from Phase 8A — check first):

```typescript
// --- Sphere Entities ---

export type SphereEntityCategory = 'social_media' | 'news_media' | 'politics' | 'entertainment' | 'ideology' | 'custom';

export interface SphereEntity {
  id: string;
  user_id: string;
  name: string;
  entity_category: SphereEntityCategory;
  desired_sphere: SphereLevel;
  current_sphere: SphereLevel | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Sphere Labels ---

export const SPHERE_LEVEL_LABELS: Record<SphereLevel, string> = {
  focus: 'Focus',
  family: 'Family',
  friends: 'Friends',
  acquaintances: 'Acquaintances',
  community: 'Community',
  geo_political: 'Geo-Political',
};

export const SPHERE_LEVEL_ORDER: SphereLevel[] = [
  'focus', 'family', 'friends', 'acquaintances', 'community', 'geo_political',
];

export const SPHERE_ENTITY_CATEGORY_LABELS: Record<SphereEntityCategory, string> = {
  social_media: 'Social Media',
  news_media: 'News & Media',
  politics: 'Politics',
  entertainment: 'Entertainment',
  ideology: 'Ideology',
  custom: 'Custom',
};
```

---

## Step 2: Hook — `src/hooks/useSphere.ts`

Create this hook following existing patterns.

**State:**
- `sphereEntities: SphereEntity[]` — all active sphere entities
- `loading: boolean`
- `error: string | null`

**Functions:**

1. `fetchSphereEntities()` — Query `sphere_entities` where `archived_at IS NULL`, ordered by `desired_sphere, name`.

2. `createSphereEntity(data: { name: string; entity_category: SphereEntityCategory; desired_sphere: SphereLevel; current_sphere?: SphereLevel; notes?: string })` — Insert into `sphere_entities`.

3. `updateSphereEntity(id: string, updates: Partial<SphereEntity>)` — Update.

4. `archiveSphereEntity(id: string)` — Set `archived_at`.

5. `updatePersonSphere(personId: string, desired_sphere: SphereLevel | null, current_sphere?: SphereLevel | null)` — Update `desired_sphere` and `current_sphere` on a `people` record. This delegates to `useCrew.updatePerson` or makes a direct Supabase call.

6. `getSphereData()` — Returns a structured view of all sphere assignments:
   ```typescript
   interface SphereData {
     levels: Record<SphereLevel, {
       people: Person[];
       entities: SphereEntity[];
     }>;
     unassigned: {
       people: Person[];
       entities: SphereEntity[];
     };
     focusCenter: {
       self: true;
       spouse: Person | null;  // If married
       god: boolean;           // If faith Mast entries exist
     };
   }
   ```

   Fetches all people + sphere entities, groups them by `desired_sphere`. People with no `desired_sphere` go into `unassigned`. The Focus center has special fixed items:
   - **Self** — always present (not a DB record, just a display concept)
   - **Spouse** — present if `relationship_status` is `'married'` and First Mate record exists
   - **God** — present if user has Mast entries with `type === 'faith_foundation'` (check if any exist)

7. `getGapIndicator(person: Person | SphereEntity)` — Returns gap info:
   ```typescript
   interface GapIndicator {
     hasGap: boolean;
     direction: 'inward' | 'outward' | null;  // current is closer to center vs further from center
     description: string;
   }
   ```
   Compare `desired_sphere` position vs `current_sphere` position (using SPHERE_LEVEL_ORDER index). If `current_sphere` is null, no gap shown. If positions differ:
   - Inward gap = current sphere is closer to Focus than desired (stronger influence than intended)
   - Outward gap = current sphere is further from Focus than desired (weaker influence than intended)

---

## Step 3: Components

### `src/components/sphere/` — Create this directory

**`SphereView.tsx`**
- The main Sphere of Influence view, rendered when "By Sphere" toggle is active on the Crew page
- Renders six sections (Focus through Geo-Political), each as a collapsible group
- Focus section has special rendering for the fixed center (Self, Spouse, God) before listing other Focus-level people/entities
- Each section shows people cards and entity cards with gap indicators
- Empty sections show subtle placeholder: "No one in this sphere yet"
- Unassigned section at the bottom with different styling

**`SphereSectionHeader.tsx`**
- Section header showing sphere level name, count of items, and a subtle description:
  - Focus: "Your innermost circle — who you invest in most deeply"
  - Family: "Family relationships and family-like bonds"
  - Friends: "Close friendships and trusted companions"
  - Acquaintances: "People you know and interact with regularly"
  - Community: "Community connections and networks"
  - Geo-Political: "Broader societal and political influences"

**`SpherePersonCard.tsx`**
- Compact person card for sphere view context
- Shows: name, relationship type, gap indicator (colored dot or arrow if gap exists)
- Tap opens person detail (or navigates to First Mate for spouse)
- Long press or "..." menu: "Change Sphere Assignment" opens sphere picker

**`SphereEntityCard.tsx`**
- Card for non-person entities (social media, news, etc.)
- Shows: name, entity category badge, gap indicator
- Tap opens inline edit (name, category, sphere assignment, notes)
- Long press or "..." menu: "Edit", "Archive"

**`SphereAssignment.tsx`**
- Reusable component for assigning spheres (used in PersonDetail and SphereEntityCard)
- Two selectors:
  - "Where do you want their influence?" → desired_sphere (required)
  - "Where is their influence right now?" → current_sphere (optional)
- Visual gap indicator shown between the two if they differ
- Clear, non-judgmental language — "This isn't about cutting anyone off. It's about being intentional with influence."

**`AddSphereEntityModal.tsx`**
- Modal form: name, entity category (selector), desired sphere, current sphere (optional), notes
- Save creates via `useSphere.createSphereEntity`

**`FocusCenterCard.tsx`**
- Special rendering for the fixed Focus center items
- Self: simple text "You" with a visual indicator
- Spouse: name from First Mate record (if married), tappable → First Mate page
- God: "The Lord" or "God" — only shown if user has `faith_foundation` Mast entries
- These items are not editable or removable from Focus — they're fixed
- Styled distinctly from regular person/entity cards (perhaps with a subtle border or background)

---

## Step 4: Crew Page Update (`src/pages/Crew.tsx`)

Update the existing Crew page to implement the "By Sphere" toggle that was stubbed in Phase 8A:

```
Page Layout (updated):
├── usePageContext({ page: 'crew' })
├── View toggle: "By Category" (default) | "By Sphere"
├── If "By Category": <CrewCategoryView /> (existing from Phase 8A)
├── If "By Sphere": <SphereView />
├── FAB → context-aware:
│   ├── If "By Category": "Add Crewmate"
│   └── If "By Sphere": expandable → "Add Person" + "Add Non-Person Influence"
└── Person detail unchanged
```

**View toggle behavior:**
- Simple text toggle or tab at top of page (use the same pattern as Compass Tasks/Lists toggle)
- View state stored in React state (not persisted — user picks each time)
- When switching to "By Sphere", load sphere data via `useSphere.getSphereData()`

**FAB in Sphere view:**
- Primary action: "Add to Sphere" (expandable)
  - "Add Person" → AddCrewmateModal (same as category view, but with sphere assignment pre-filled based on which section they tapped from)
  - "Add Non-Person Influence" → AddSphereEntityModal

---

## Step 5: Sphere Assignment in Person Detail

Update `PersonDetail.tsx` (from Phase 8A) to include sphere assignment:

- Add a "Sphere Placement" section after the basic info section
- Use the `SphereAssignment` component
- Show current assignment if set, or "Not assigned to a sphere yet" with an "Assign" button
- Saving updates the person record via `useCrew.updatePerson`

---

## Step 6: AI Integration

### 6A: Context Loader Updates

In `src/lib/contextLoader.ts`, update the crew context loading to include sphere data when on the crew page with sphere view:

The `formatCrewContext` function (from Phase 8A) can be extended to optionally include sphere assignments:

```typescript
// When Sphere context is relevant, add sphere information
function formatSphereContext(people: Person[], entities: SphereEntity[]): string {
  let result = '\n\nSPHERE OF INFLUENCE (who the user allows to influence them):\n';

  for (const level of SPHERE_LEVEL_ORDER) {
    const levelPeople = people.filter(p => p.desired_sphere === level);
    const levelEntities = entities.filter(e => e.desired_sphere === level);

    if (levelPeople.length === 0 && levelEntities.length === 0) continue;

    result += `\n${SPHERE_LEVEL_LABELS[level]}:\n`;
    for (const p of levelPeople) {
      result += `- ${p.name} (${p.relationship_type})`;
      if (p.current_sphere && p.current_sphere !== p.desired_sphere) {
        result += ` [gap: currently at ${SPHERE_LEVEL_LABELS[p.current_sphere]} level]`;
      }
      result += '\n';
    }
    for (const e of levelEntities) {
      result += `- ${e.name} (${SPHERE_ENTITY_CATEGORY_LABELS[e.entity_category]})`;
      if (e.current_sphere && e.current_sphere !== e.desired_sphere) {
        result += ` [gap: currently at ${SPHERE_LEVEL_LABELS[e.current_sphere]} level]`;
      }
      result += '\n';
    }
  }

  const unassignedPeople = people.filter(p => !p.desired_sphere);
  if (unassignedPeople.length > 0) {
    result += `\nUnassigned: ${unassignedPeople.map(p => p.name).join(', ')}\n`;
  }

  return result;
}
```

### 6B: System Prompt Addition

Add a `shouldLoadSphere` function:

```typescript
const SPHERE_KEYWORDS = [
  'sphere', 'influence', 'boundary', 'boundaries', 'distance',
  'too close', 'too involved', 'toxic', 'energy drain',
  'inner circle', 'close friend', 'acquaintance',
];

export function shouldLoadSphere(message: string, pageContext: string): boolean {
  if (pageContext === 'crew') return true;  // Always load for Crew page
  const lower = message.toLowerCase();
  return SPHERE_KEYWORDS.some(kw => lower.includes(kw));
}
```

Add `sphereContext?: string` to the `SystemPromptContext` interface and wire it through `buildSystemPrompt` the same way as other conditional contexts.

In `contextLoader.ts`, add sphere entity fetching:
```typescript
const needSphere = shouldLoadSphere(message, pageContext);

const sphereEntitiesPromise = needSphere
  ? supabase
      .from('sphere_entities')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('desired_sphere, name')
  : null;
```

When building context, if sphere data is needed and crew data was also loaded:
```typescript
if (sphereEntitiesResult?.data && crewResult?.data) {
  sphereContext = formatSphereContext(
    crewResult.data as Person[],
    sphereEntitiesResult.data as SphereEntity[]
  );
}
```

---

## Step 7: CSS Styling

Create `src/components/sphere/Sphere.css` (or individual component CSS files).

Key styling:
- Sphere sections ordered from innermost (Focus) to outermost (Geo-Political)
- Focus section: slightly different background — `color-mix(in srgb, var(--color-deep-teal) 8%, var(--color-cream))` to suggest depth/intimacy
- Outer sections: progressively lighter or more neutral background
- Gap indicators:
  - No gap: no indicator (or subtle green dot using `var(--color-mid-teal)`)
  - Inward gap (stronger than intended): indicator using `var(--color-cognac)` — warm but attention-drawing
  - Outward gap (weaker than intended): indicator using `var(--color-slate-gray)` — neutral, not alarming
- Fixed Focus center items (Self, Spouse, God): smaller, pill-shaped cards with `var(--color-deep-teal)` background, `var(--color-cream)` text
- Non-person entity cards: visually distinct from person cards (perhaps dashed border or icon indicating non-person)
- Unassigned section: lighter styling, subtle call to action

Mobile-first, 44px touch targets, no emoji, no gold effects. All colors via CSS variables.

---

## Step 8: Doc Updates

### 8A: `CLAUDE.md` Stub Registry

Add new stubs if any emerge. Phase 8B shouldn't create many new stubs since Sphere is relatively self-contained.

Potential new stubs:
```
| Sphere → AI gap coaching in Helm conversations | Phase 8B (Sphere) | Enhancement (AI context) | STUB |
| Sphere → Interactive concentric circles visualization | Phase 8B (Sphere) | Post-MVP | POST-MVP |
```

### 8B: `CLAUDE.md` Project State

Add to the `## Project State` section (or wherever Phase state is tracked):
```
- Phase 8A (First Mate + Crew) built: [component list]
- Phase 8B (Sphere of Influence) built: [component list]
```

### 8C: `docs/StewardShip_System_Overview_PRD_v2.md`

Update Phase 8 build order:
```
Phase 8: Relationships
21. First Mate — BUILT (Phase 8A)
22. Crew — BUILT (Phase 8A)
23. Sphere of Influence — BUILT (Phase 8B)
```

### 8D: Memory Update

Update the project memory to reflect Phase 8 completion.

---

## What Done Looks Like

### TypeScript
- [ ] `SphereEntity` interface and `SphereEntityCategory` type in types.ts
- [ ] `SPHERE_LEVEL_LABELS`, `SPHERE_LEVEL_ORDER`, `SPHERE_ENTITY_CATEGORY_LABELS` label maps
- [ ] All types compile without errors

### Hook
- [ ] `useSphere` — full CRUD for sphere_entities, sphere assignment updates on people, structured sphere data query, gap indicator calculation

### Components
- [ ] `src/components/sphere/` directory with: SphereView, SphereSectionHeader, SpherePersonCard, SphereEntityCard, SphereAssignment, AddSphereEntityModal, FocusCenterCard

### Pages
- [ ] Crew page "By Sphere" toggle fully functional
- [ ] Sphere view renders six sections with people and entities
- [ ] Focus center shows Self + Spouse (if married) + God (if faith entries)
- [ ] Unassigned section at bottom
- [ ] FAB adapts to sphere view context
- [ ] PersonDetail includes sphere assignment section

### AI Integration
- [ ] `shouldLoadSphere` keyword function
- [ ] `formatSphereContext` function
- [ ] `sphereContext` in SystemPromptContext and buildSystemPrompt
- [ ] Context loader fetches sphere_entities when relevant

### Styling
- [ ] Progressive visual depth from Focus to Geo-Political
- [ ] Gap indicators with appropriate colors
- [ ] Fixed Focus center styled distinctly
- [ ] Non-person entities visually distinguishable
- [ ] All CSS via variables, mobile-first, no emoji, no gold

### Docs
- [ ] Stub Registry updated
- [ ] System Overview build order updated
- [ ] Memory updated
