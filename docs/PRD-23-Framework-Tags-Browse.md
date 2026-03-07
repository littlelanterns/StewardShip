# PRD-23: Framework Tags & Browse Frameworks

## Overview

Frameworks extracted from books and resources become more valuable as the library grows. This PRD adds topic tagging to frameworks and introduces a **Browse Frameworks** view — a library-style reading experience that lets users explore, filter, and read principles by topic without leaving the app.

This is distinct from FrameworkManager, which remains focused on activate/deactivate. Browse Frameworks is a discovery and reading experience.

---

## Problem Being Solved

As users build a library of 5–15+ frameworks, FrameworkManager becomes a long flat list. There's no way to:
- Find all frameworks related to a topic (e.g., "parenting", "leadership")
- Read principles across multiple frameworks on a theme
- Browse what's available before deciding what to activate

---

## User Stories

- "I uploaded four parenting books. I want to read all the principles about handling tantrums across all of them."
- "I'm prepping for a hard conversation with my teenager. Let me pull up everything tagged 'teens'."
- "I want to see what I have on marriage before I activate new frameworks."
- "I just extracted a new book — I want to tag it so I can find it with my other faith-based resources."

---

## Feature Scope

### 1. Framework Tags

**Source:** AI auto-generates 3–6 topic tags when a framework is saved. User can add/remove tags from the FrameworkPrinciples detail view.

**Storage:** New `tags TEXT[] DEFAULT '{}'` column on `ai_frameworks` table. Requires a migration.

**Auto-tagging on save:** Triggered automatically when `saveFramework` completes (client-side, after the save resolves). Non-blocking — tags appear a moment after save without interrupting the flow.

**Backfill for existing frameworks:** A **"Tag All"** button appears in FrameworkManager when any frameworks have empty tags. Tapping it runs `tagFramework` sequentially on every untagged framework. A simple inline progress indicator shows how many have been processed ("Tagging 2 of 5..."). Button disappears once all frameworks have tags. No bulk API call — each framework is tagged individually so partial completion is handled gracefully if the user navigates away. A new lightweight Edge Function `manifest-tag-framework` receives the framework id + framework name + first 20 principles (text only) and returns a JSON array of tag strings. Uses **Haiku** for cost efficiency. Tags are written back to the `ai_frameworks` row.

**Tag vocabulary:** AI is guided toward a consistent set of common tags. The prompt suggests: `parenting`, `teens`, `marriage`, `leadership`, `faith`, `habits`, `productivity`, `communication`, `emotional-health`, `boundaries`, `identity`, `family`, `disability`, `grief`, `anxiety`, `finance`, `relationships`. The AI may add others when appropriate but is instructed to prefer existing vocabulary over inventing new tags.

**User editing:** Tags appear in the FrameworkPrinciples detail view (below the framework name, above the source line). Same `+ Add Tag` / tap-to-remove chip pattern used in ManifestItemDetail. Updates saved immediately via `supabase.from('ai_frameworks').update({ tags })`.

**FrameworkManager cards:** Each card shows its tags as small read-only chips below the framework name, for at-a-glance browsing.

---

### 2. Browse Frameworks View

A new view accessible from FrameworkManager via a **"Browse by Topic →"** button at the top of the page.

#### Navigation path
Manifest → Your Frameworks (FrameworkManager) → Browse by Topic → [optionally filtered by tag]

#### Layout

**Tag filter bar (top):**
- Horizontally scrollable row of pill chips
- "All" chip selected by default (shows all frameworks)
- Chips are generated from the union of all tags across the user's frameworks — only tags that actually exist appear
- Chips sorted: most-used tags first, then alphabetical
- Active chip is filled teal; others are outlined
- Single-select: tapping a tag shows only frameworks with that tag; tapping "All" resets

**Framework accordion list (below tag bar):**
- One accordion card per framework
- Card header: framework name + source book title (from ManifestItem) + principle count + tags as small chips
- Expand: shows numbered list of included principles
- Principles are read-only, numbered, displayed as a plain list
- Only `is_included = true` principles shown
- "Edit Framework →" button navigates to FrameworkPrinciples for that item (reuses existing `onSelectFramework` flow)
- Max one card expanded at a time (expanding a new card collapses the previous one) — OR allow multiple open, based on what feels better during implementation. Start with single-open.

**Export button (top right of Browse view):**
- Exports currently-visible frameworks (i.e., whatever the active tag filter shows)
- Same three-format dropdown as elsewhere (md, docx, txt)
- Uses `exportAggregatedAs*` functions from `exportFramework.ts`
- Label: "Export [Tag]" when a tag is active, "Export All" when "All" is selected
- Disabled if no frameworks are visible

**Back button:** Returns to FrameworkManager

---

## Data Schema Changes

### Migration: add tags to ai_frameworks

```sql
ALTER TABLE ai_frameworks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_frameworks_tags ON ai_frameworks USING GIN (tags);

COMMENT ON COLUMN ai_frameworks.tags IS 'Topic tags auto-generated by AI on extraction, user-editable.';
```

No RLS changes needed — existing user-scoped policy covers the new column.

---

## New Edge Function: `manifest-tag-framework`

**Purpose:** Generate topic tags for a saved framework based on its name and principles.

**Trigger:** Called client-side from `useFrameworks.saveFramework()` after the framework and principles are saved. Fire-and-forget (non-blocking — tags appearing a moment after save is fine).

**Request body:**
```typescript
{
  framework_id: string;
  framework_name: string;
  principles: string[]; // text only, first 20 max
  user_id: string;
}
```

**Response:**
```typescript
{ tags: string[] } // 3–6 tags
```

**Model:** `anthropic/claude-haiku-4-5` via OpenRouter

**System prompt:**
```
You generate concise topic tags for personal growth frameworks extracted from books and resources.

Return a JSON object: { "tags": ["tag1", "tag2", ...] }

Rules:
- Return 3–6 tags maximum
- Tags are lowercase, single words or hyphenated (e.g., "emotional-health", "teens")
- Prefer from this vocabulary when applicable:
  parenting, teens, marriage, leadership, faith, habits, productivity, communication,
  emotional-health, boundaries, identity, family, disability, grief, anxiety, finance,
  relationships, self-compassion, resilience, confidence, purpose, spirituality, health
- Add topic-specific tags not in the list when clearly appropriate (e.g., "adhd", "divorce")
- Do not add generic tags like "book", "framework", "principles", "self-help"
- Return ONLY the JSON object. No explanation, no markdown.
```

**User message:**
```
Framework name: {framework_name}
Principles: {principles joined with newlines, max 20}
```

**After response:** Update `ai_frameworks.tags` for the given `framework_id`.

---

## Component Changes

### `useFrameworks.ts`

**New function: `tagFramework`**
```typescript
const tagFramework = useCallback(async (
  frameworkId: string,
  frameworkName: string,
  principles: string[],
): Promise<void> => {
  // Invoke manifest-tag-framework edge function
  // On success, update local frameworks state to include new tags
  // Silent failure — log error but don't surface to user
}, [user]);
```

**Update `saveFramework`:** After successfully saving, call `tagFramework` in the background (don't await in the main flow):
```typescript
// After save succeeds:
tagFramework(frameworkId, name, principles.slice(0, 20).map(p => p.text))
  .catch(err => console.error('Auto-tagging failed (non-blocking):', err));
```

**New function: `updateFrameworkTags`**
```typescript
const updateFrameworkTags = useCallback(async (
  frameworkId: string,
  tags: string[],
): Promise<boolean> => {
  // supabase.from('ai_frameworks').update({ tags }).eq('id', frameworkId)
  // Update local state on success
}, [user]);
```

---

### `FrameworkPrinciples.tsx`

**New prop:** `onUpdateTags: (frameworkId: string, tags: string[]) => Promise<boolean>`

**New UI section** (below framework name input, above source line):

```tsx
<div className="framework-principles__tags-row">
  <span className="framework-principles__label">Topics</span>
  <div className="framework-principles__tags">
    {tags.map((tag) => (
      <span key={tag} className="framework-principles__tag">
        {tag}
        <button onClick={() => removeTag(tag)}>×</button>
      </span>
    ))}
    {addingTag ? (
      <input
        autoFocus
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onBlur={handleAddTag}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
        placeholder="Add topic..."
        className="framework-principles__tag-input"
      />
    ) : (
      <button onClick={() => setAddingTag(true)} className="framework-principles__tag-add">
        + Add Topic
      </button>
    )}
  </div>
</div>
```

Tags are saved immediately on add/remove (no need to wait for the main Save button). If `framework` prop has an `id`, call `onUpdateTags` directly. If no saved framework yet (new extraction not yet saved), store tag changes in local state and include them in the `onSave` call.

**Note:** `ai_frameworks` doesn't have a `tags` field in the current TypeScript type. Update `AIFramework` in `src/lib/types.ts` to add `tags: string[]`.

---

### `FrameworkManager.tsx`

**Add "Browse by Topic →" button** at the top of the page, above the intro text. Secondary/subtle styling — text link with arrow icon, not a full button.

**Add "Tag All" button** when any frameworks have empty tags. Appears as a small secondary button near the top of the list, below the intro text. Shows progress while running:

```typescript
const [taggingAll, setTaggingAll] = useState(false);
const [tagProgress, setTagProgress] = useState<{ done: number; total: number } | null>(null);

const untaggedFrameworks = frameworks.filter(
  (fw) => !fw.archived_at && (!fw.tags || fw.tags.length === 0)
);

const handleTagAll = useCallback(async () => {
  if (untaggedFrameworks.length === 0) return;
  setTaggingAll(true);
  setTagProgress({ done: 0, total: untaggedFrameworks.length });
  for (let i = 0; i < untaggedFrameworks.length; i++) {
    const fw = untaggedFrameworks[i];
    await onTagFramework(
      fw.id,
      fw.name,
      (fw.principles || []).slice(0, 20).map((p) => p.text),
    ).catch((err) => console.error('Tagging failed for', fw.id, err));
    setTagProgress({ done: i + 1, total: untaggedFrameworks.length });
  }
  setTaggingAll(false);
  setTagProgress(null);
}, [untaggedFrameworks, onTagFramework]);
```

Button label: `"Tag All"` when idle, `"Tagging {done} of {total}..."` while running. Disabled while running. Hidden when `untaggedFrameworks.length === 0`.

**Update framework cards** to show tags as small read-only chips below the principles count line.

**New props:**
- `onBrowse: () => void` — navigates to Browse view
- `onTagFramework: (id: string, name: string, principles: string[]) => Promise<void>` — passed from `useFrameworks.tagFramework`

---

### New Component: `BrowseFrameworks.tsx`

**Location:** `src/components/manifest/BrowseFrameworks.tsx`

**Props:**
```typescript
interface BrowseFrameworksProps {
  frameworks: AIFramework[];
  items: ManifestItem[]; // for source titles
  onSelectFramework: (fw: AIFramework) => void; // navigate to edit
  onBack: () => void;
}
```

**Internal state:**
```typescript
const [activeTag, setActiveTag] = useState<string | null>(null); // null = "All"
const [expandedId, setExpandedId] = useState<string | null>(null);
const [exportMenuOpen, setExportMenuOpen] = useState(false);
const [exporting, setExporting] = useState(false);
```

**Tag list derivation:**
```typescript
const allTags = useMemo(() => {
  const tagCounts: Record<string, number> = {};
  frameworks.forEach((fw) => {
    (fw.tags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}, [frameworks]);
```

**Filtered frameworks:**
```typescript
const visibleFrameworks = useMemo(() =>
  activeTag
    ? frameworks.filter((fw) => (fw.tags || []).includes(activeTag))
    : frameworks,
[frameworks, activeTag]);
```

**Export handler:** Uses `exportAggregatedAs*` from `exportFramework.ts` with `visibleFrameworks` as input.

---

### `Manifest.tsx`

**Add `'browse'` to `ViewMode` type.**

**Add handler:**
```typescript
const handleBrowseFrameworks = useCallback(() => {
  setViewMode('browse');
}, []);
```

**Add render block:**
```typescript
if (viewMode === 'browse') {
  return (
    <div className="page manifest-page">
      <BrowseFrameworks
        frameworks={frameworks}
        items={items}
        onSelectFramework={handleSelectFrameworkForEdit}
        onBack={() => setViewMode('frameworks')}
      />
    </div>
  );
}
```

**Pass `onBrowse` and `onTagFramework` to FrameworkManager:**
```typescript
<FrameworkManager
  frameworks={frameworks}
  items={items}
  onToggleFrameworks={batchToggleFrameworks}
  onSelectFramework={handleSelectFrameworkForEdit}
  onBrowse={handleBrowseFrameworks}
  onTagFramework={tagFramework}
  onBack={handleBack}
/>
```

**Pass `onUpdateTags` to FrameworkPrinciples:**
```typescript
<FrameworkPrinciples
  ...existing props...
  onUpdateTags={updateFrameworkTags}
/>
```

---

## Styling Notes

**Tag chips (shared pattern)** — use existing tag chip patterns from ManifestItemDetail. Consistent sizing and color across all tag contexts.

**Browse Frameworks page:**
- White background, clean reading feel
- Tag filter bar: horizontal scroll, no wrapping, `overflow-x: auto`, `-webkit-overflow-scrolling: touch`
- Accordion cards: `border: 1px solid var(--color-border)`, `border-radius: var(--radius-md)`, `background: var(--color-surface)`
- Expand/collapse chevron icon (ChevronRight → ChevronDown)
- Principles list: simple numbered list, `font-size: var(--font-size-sm)`, `line-height: 1.7`, generous spacing
- "Edit Framework →" link: right-aligned, teal text, small size

---

## What "Done" Looks Like

- [ ] Migration deployed: `ai_frameworks.tags` column exists
- [ ] `AIFramework` TypeScript type includes `tags: string[]`
- [ ] `manifest-tag-framework` Edge Function deployed
- [ ] `saveFramework` triggers auto-tagging (non-blocking) after save
- [ ] Tags appear on framework cards in FrameworkManager
- [ ] Tags editable from FrameworkPrinciples detail view
- [ ] "Browse by Topic →" button in FrameworkManager navigates to Browse view
- [ ] Browse view shows tag filter bar with tags derived from real data
- [ ] "All" filter shows all frameworks; tag filter shows only matching ones
- [ ] Accordion expand/collapse works; only one card open at a time
- [ ] Principles visible in expanded state (read-only, is_included only)
- [ ] "Edit Framework →" navigates to FrameworkPrinciples for that framework
- [ ] Export button in Browse view exports visible frameworks in chosen format
- [ ] Empty state when no frameworks match active tag
- [ ] Empty state when user has no frameworks at all
- [ ] "Tag All" button appears in FrameworkManager when any frameworks have empty tags
- [ ] "Tag All" shows progress ("Tagging 2 of 5...") while running and disappears when all frameworks are tagged
- [ ] No regressions to FrameworkManager activate/deactivate flow
- [ ] No regressions to FrameworkPrinciples save/extract flow

---

## CLAUDE.md Additions

- **Framework tags:** `ai_frameworks` has a `tags TEXT[]` column. Auto-generated by `manifest-tag-framework` Edge Function (Haiku) after save. User-editable from FrameworkPrinciples. Displayed on cards in FrameworkManager.
- **Browse Frameworks:** Library-style reading experience accessible from FrameworkManager. Tag filter bar + accordion list with read-only principles. Export filtered sets. Distinct from FrameworkManager (which manages activate/deactivate).
- **Edge Function:** `manifest-tag-framework` — lightweight Haiku call that generates 3–6 topic tags for a framework based on its name and principles.
