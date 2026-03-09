# Extraction Item Rendering — Refactor Guide

> **Status:** Future work. This documents the ideal architecture for MyAIM rebuild.
> Current implementation works but has significant code duplication across views.

---

## The Problem

Three views render extraction items with nearly identical JSX, state, and handlers:

| File | Lines | What It Does |
|------|-------|-------------|
| `ExtractionTabs.tsx` | ~800 | Per-book extraction tabs (Summary, Frameworks, Action Steps, Mast Content) |
| `ExtractionsView.tsx` | ~1650 | Aggregated browser with 3 view modes (tabs, chapters, notes) |
| `HeartedItemsView.tsx` | ~630 | Aggregated hearted items across all books |

**Each file independently implements:**
- Inline text editing (textarea toggle, blur-save, Escape-cancel)
- User note editing (same pattern)
- Heart toggling (4 separate handlers in ExtractionsView)
- Delete with fade animation (300ms CSS + state filter)
- Send to Mast (declaration → mast_entries insert + flag update)
- Send to Compass (action step → compass_tasks insert + auto-tag)
- Content type badge rendering
- Go Deeper sparkle icon

**Duplication count:** 4 item types × 3+ render locations = 12+ near-identical JSX blocks.

---

## Ideal Architecture (5 Layers)

### Layer 1: Pure Action Functions — `src/lib/extractionActions.ts`

Move database operations into pure async functions. No React state, no UI concerns.

```typescript
type ExtractionTable = 'manifest_summaries' | 'manifest_declarations'
  | 'manifest_action_steps' | 'ai_framework_principles';

// Each function takes userId + item data, performs DB operation, returns result
export async function updateExtractionField(
  table: ExtractionTable, id: string, userId: string,
  field: string, value: string
): Promise<boolean>;

export async function updateExtractionNote(
  table: ExtractionTable, id: string, userId: string,
  note: string | null
): Promise<boolean>;

export async function softDeleteExtractionItem(
  table: ExtractionTable, id: string, userId: string
): Promise<boolean>;

export async function toggleExtractionHeart(
  table: ExtractionTable, id: string, userId: string,
  hearted: boolean
): Promise<boolean>;

export async function sendDeclarationToMast(
  declId: string, declData: ManifestDeclaration, userId: string
): Promise<{ mastEntryId: string } | null>;

export async function sendActionStepToCompass(
  stepId: string, stepData: ManifestActionStep, userId: string
): Promise<{ taskId: string } | null>;
```

**Benefits:** Testable independently. Reusable from hook, component, or any future context.

### Layer 2: Shared State Hook — `src/hooks/useExtractionItemActions.ts`

Manages all UI state for item-level interactions. Views pass callbacks to update their own data structures.

```typescript
interface ExtractionActionCallbacks {
  onItemEdited?: (table: ExtractionTable, id: string, field: string, value: string) => void;
  onItemNoted?: (table: ExtractionTable, id: string, note: string | null) => void;
  onItemDeleted?: (table: ExtractionTable, id: string) => void;
  onItemHearted?: (table: ExtractionTable, id: string, hearted: boolean) => void;
  onSentToMast?: (declId: string, mastEntryId: string) => void;
  onSentToCompass?: (stepId: string, taskId: string) => void;
}

export function useExtractionItemActions(callbacks?: ExtractionActionCallbacks) {
  // Owns: editingId, editingText, notingId, noteDraft, deletingIds,
  //       sendingToMastIds, sendingToCompassIds
  // Exposes: startEditing, cancelEditing, saveEdit, startNoting, saveNote,
  //          deleteItem, toggleHeart, sendToMast, sendToCompass
  // Calls extractionActions.ts functions internally
  // Calls callbacks to let parent update its data structure
}
```

**Key design:** The hook does NOT manage the item data itself. It manages interaction state (which item is being edited, which is being noted, which is animating deletion). Parent views own their data arrays/maps and update them via callbacks.

### Layer 3: Base Component — `src/components/manifest/ExtractionItem.tsx`

Generic wrapper handling the common shell: edit textarea, note textarea, deletion animation, Go Deeper icon.

```typescript
interface ExtractionItemProps {
  id: string;
  table: ExtractionTable;
  editField: string;           // 'text' or 'declaration_text'
  text: string;
  userNote: string | null;
  isHearted: boolean;
  isFromGoDeeper?: boolean;

  // From useExtractionItemActions
  editingId: string | null;
  editingText: string;
  notingId: string | null;
  noteDraft: string;
  isDeleting: boolean;

  onStartEdit: (id: string, text: string) => void;
  onSaveEdit: (table: ExtractionTable, id: string, field: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onStartNote: (id: string, note: string | null) => void;
  onSaveNote: (table: ExtractionTable, id: string) => void;
  onNoteDraftChange: (text: string) => void;

  // Slots
  renderMeta?: () => ReactNode;       // type badge, declaration style, etc.
  renderText?: () => ReactNode;       // custom text rendering (e.g., quotes for declarations)
  renderExtraActions?: () => ReactNode; // Send to Mast, Send to Compass, etc.

  // Common actions (heart + note + delete always present)
  onToggleHeart: () => void;
  onDelete: () => void;

  className?: string;
}
```

**Benefits:** All views get identical edit/note/delete UX. One place to fix bugs. Slot pattern keeps it flexible.

### Layer 4: Specialized Components

Small components (~50-80 lines each) that wrap ExtractionItem with type-specific rendering:

```
src/components/manifest/items/
  SummaryItem.tsx          — adds content_type badge
  FrameworkPrincipleItem.tsx — adds framework_name context
  ActionStepItem.tsx       — adds content_type badge + Send to Compass button
  DeclarationItem.tsx      — adds value_name + style label + quoted text + Send to Mast button
```

Each one provides `renderMeta`, `renderText`, and `renderExtraActions` to ExtractionItem.

### Layer 5: View Components (Thin Presentational)

Views become thin layout shells that:
1. Fetch/manage their data (arrays, maps, grouped structures)
2. Instantiate `useExtractionItemActions` with callbacks
3. Render specialized item components in their chosen layout

```
ExtractionsView.tsx    — manages book groups, 3 view modes (tabs/chapters/notes)
ExtractionTabs.tsx     — manages single-book tabs with Go Deeper / Re-run
HeartedItemsView.tsx   — manages hearted-only filtered groups
```

---

## Expected Outcome

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| ExtractionsView.tsx | ~1650 lines | ~500 lines | -70% |
| ExtractionTabs.tsx | ~800 lines | ~300 lines | -62% |
| HeartedItemsView.tsx | ~630 lines | ~200 lines | -68% |
| Total extraction rendering | ~3080 lines | ~1300 lines | **-58%** |
| Unique item rendering | 12+ copies | 4 components | **-67%** |

---

## Implementation Sequence

1. Create `extractionActions.ts` (pure functions)
2. Create `useExtractionItemActions.ts` (shared hook)
3. Create `ExtractionItem.tsx` (base component)
4. Create 4 specialized item components
5. Refactor HeartedItemsView (smallest, good test)
6. Refactor ExtractionsView
7. Refactor ExtractionTabs
8. Delete all old inline rendering code

---

## Notes

- The `ExtractionItem` base component handles: inline edit textarea, user note textarea, deletion fade animation, Go Deeper sparkle icon, heart/note/delete buttons
- Specialized components handle: type-specific metadata badges, text formatting (declarations get quotes), extra action buttons (Send to Mast, Send to Compass)
- The hook is view-agnostic — it doesn't know about data structures, just item IDs and table names
- Views own their data. The hook notifies them of changes via callbacks. This keeps each view's data management independent while eliminating handler duplication.
