# PRD-06: The Compass + Task Breaker + Lists

## Overview

The Compass is the daily action hub. It answers the question: "What should I do right now to stay on course?" It manages tasks, habits, and to-dos with the unique ability to view the same tasks through multiple prioritization frameworks via a toggle at the top of the page.

Task Breaker is an AI tool within The Compass that decomposes any task into substeps at the user's chosen level of detail.

Lists is a lightweight, flexible list system for things that aren't tracked goals or habits — shopping lists, wishlists, expense tracking, and custom lists. Lists are shareable and designed for future MyAIM connection.

---

## Part 1: The Compass

### User Stories

#### Task Management
- As a user, I want to add tasks quickly so I capture things before I forget them.
- As a user, I want to check off tasks so I can see my progress throughout the day.
- As a user, I want the AI to auto-tag my tasks by life area so I don't have to think about categorization.
- As a user, I want to set a task as recurring so I don't have to re-create daily habits.
- As a user, I want to carry forward incomplete tasks to tomorrow so nothing falls through the cracks.

#### Prioritization Views
- As a user, I want to toggle between different ways of viewing my tasks so I can use the framework that fits my energy and situation.
- As a user, I want the AI to suggest which view might help me today based on my context.
- As a user, I want to see a brief description of each view so I understand what it does before I try it.
- As a user, I want the AI to suggest where each task fits in a given view so I don't have to manually sort everything.

#### Task Context
- As a user, I want tasks linked to goals so I can see how daily work connects to bigger ambitions.
- As a user, I want tasks linked to Wheels so my change commitments show up in my daily list.
- As a user, I want tasks created from Helm conversations, Log entries, meeting action items, and Rigging plans to appear automatically.

---

### Screens

#### Screen 1: Compass Main Page

**What the user sees:**
- Page title: "The Compass"
- Brief contextual line: "What to do right now to stay on course."
- **View toggle bar** at top — a horizontal row of tappable text labels:
  - Simple List | Eisenhower | Frog | 1/3/9 | Big Rocks | Ivy Lee | By Category
  - Active view is highlighted (bold + underline or background color shift)
  - Scrollable horizontally if needed on small screens
- **Hover/long-press description:** When the user hovers (desktop) or long-presses (mobile) on any view label, a small tooltip/modal appears explaining the framework (see View Descriptions below)
- Current view's task layout (varies by view — see View Layouts below)
- "Add Task" floating action button
- Task count summary: "4 of 9 tasks completed today"
- Helm drawer accessible from this page

**Interactions:**
- Tap a view label → switches to that view instantly. Tasks are the same, layout changes.
- First time switching to a new view: AI suggests placement for each task. "I've suggested where each task fits in this view. Tap any task to adjust." User can accept all, adjust individually, or dismiss suggestions.
- Tap a task checkbox → marks complete. Brief completion animation (subtle, not distracting). If the task is linked to a goal, progress updates. Prompt appears: "Is this a victory worth recording?" (small, dismissible, not blocking)
- Tap a task title → opens task detail (Screen 3)
- Tap "Add Task" → opens Screen 2
- Swipe left on a task → reveals: Carry Forward, Delete
- Swipe right on a task → reveals: Edit, Break Down (Task Breaker)

---

#### View Layouts

**Simple List**
- Plain vertical list with checkboxes
- Tasks in user-defined order (drag to reorder)
- No framework applied

**Eisenhower Matrix**
- Four-quadrant grid:
  - Top-left: "Do Now" (urgent + important) — background: warm cognac tint
  - Top-right: "Schedule" (important, not urgent) — background: teal tint
  - Bottom-left: "Delegate" (urgent, not important) — background: slate tint
  - Bottom-right: "Eliminate" (neither) — background: light gray
- Tasks appear as compact cards within their quadrant
- Drag tasks between quadrants to reclassify

**Eat the Frog**
- Vertical list with the "frog" task visually prominent at top (larger card, slight cognac border)
- Remaining tasks below in priority order
- AI suggests which task is the "frog" (hardest/most dreaded). User confirms or picks a different one.

**1/3/9**
- Three visual sections:
  - "1 Critical" — single prominent task card at top
  - "3 Important" — three task cards in a row or column
  - "9 Small" — compact list of up to 9 quick tasks
- If user has fewer than 13 tasks, sections adjust. If more than 13, AI helps decide which to include and which to defer.

**Big Rocks**
- Two sections:
  - "Big Rocks" — 2-3 major priorities displayed as larger cards
  - "Gravel" — everything else in a compact list
- Visual metaphor: Big Rocks are prominent and clearly separated from the smaller items

**Ivy Lee**
- Numbered list of exactly 6 tasks in priority order
- Task #1 is visually prominent
- Instruction text at top: "Work only on #1 until finished. Then move to #2."
- If user has more than 6 tasks, AI helps select the top 6. Remaining tasks are visible in a "Not today" collapsed section.

**By Category**
- Tasks grouped under life area headers:
  - Spouse/Marriage
  - Family
  - Career/Work
  - Home
  - Spiritual
  - Health/Physical
  - Social
  - Financial
  - Personal
  - Custom
- Each section collapsible
- Tasks within sections in user-defined order
- Categories with no tasks are hidden
- AI auto-assigns categories based on task content (same auto-tag pattern as Log)

---

#### View Descriptions (Hover/Long-Press Tooltips)

| View | Description |
|------|-------------|
| Simple List | Plain checkboxes. No framework — just check things off. |
| Eisenhower | Four quadrants: Do Now (urgent + important), Schedule (important, not urgent), Delegate (urgent, not important), Eliminate (neither). Focus on what matters, not just what's loud. |
| Eat the Frog | Your hardest or most dreaded task goes to the top. Do it first — everything else feels easier after. |
| 1/3/9 | Limits your day: 1 critical task, 3 important tasks, 9 small tasks. Keeps you focused without being overwhelmed. |
| Big Rocks | Identify your 2-3 major priorities. Everything else is gravel that fits around them. If the big rocks don't go in first, they won't fit at all. |
| Ivy Lee | Your top 6 tasks, strictly ordered. Work only on #1 until it's done. Then #2. Simple, powerful, no multitasking. |
| By Category | Tasks grouped by life area: marriage, family, work, spiritual, etc. See at a glance what each role in your life needs from you today. |

---

#### Screen 2: Add Task

**What the user sees:**
- Task title field (required — this is the primary input, large and inviting)
- Description field (optional, expandable)
- Due date picker (optional — "Today" is default, can change to specific date or "No date")
- Recurring toggle: Off, Daily, Weekdays, Weekly, Custom
- Life area tag: AI auto-suggests after title is entered, displayed as removable chip. User can change or add.
- Link to Goal (optional picker — shows active goals)
- Link to Wheel (optional picker — shows active Wheels)
- "Save" button

**Interactions:**
- Type a task title → AI auto-suggests life area tag after a brief pause (debounced)
- Tap "Save" → task created, appears in current view. AI suggests placement within the active view if it's a framework view.
- Quick-add mode: If user just types a title and taps Save without touching anything else, the task is created with today's date, AI-suggested tag, and no other metadata. Minimal friction.

---

#### Screen 3: Task Detail

**What the user sees:**
- Task title (editable)
- Description (editable)
- Status: Pending / Completed (with timestamp if completed)
- Due date (editable)
- Recurring rule (editable)
- Life area tag (editable — removable chip + add)
- Priority metadata for current view (e.g., which Eisenhower quadrant, frog status, etc.)
- Linked goal (tappable to navigate)
- Linked Wheel (tappable to navigate)
- Linked Rigging plan (tappable to navigate)
- Source info (if created from Log, Helm, Meeting, Rigging — shows where it came from, tappable)
- Subtasks (if Task Breaker has been used — nested checkbox list)
- "Break Down" button (opens Task Breaker — see Part 2)
- "Delete" button
- "Mark as Victory" button (creates a Victory linked to this task)

---

#### Screen 4: Carry Forward

**At end of day (triggered by Reckoning) or when user manually initiates:**

Incomplete tasks are shown with options per task:
- "Move to tomorrow" — due date shifts to tomorrow
- "Reschedule" — date picker opens
- "I'm done with this" — marks as cancelled (not deleted — kept in history)
- "Still working on it" — keeps current date

This can also happen inline when viewing tasks from a past date.

---

### Data Schema

#### Table: `compass_tasks`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | Task title |
| description | TEXT | null | NULL | Optional longer description |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'completed', 'carried_forward', 'cancelled' |
| due_date | DATE | CURRENT_DATE | NULL | Null = no specific date |
| recurrence_rule | TEXT | null | NULL | Enum: 'daily', 'weekdays', 'weekly', 'custom', null. Custom stores iCal RRULE. |
| life_area_tag | TEXT | null | NULL | AI auto-assigned. Single primary tag. |
| eisenhower_quadrant | TEXT | null | NULL | Enum: 'do_now', 'schedule', 'delegate', 'eliminate' |
| frog_rank | INTEGER | null | NULL | 1 = the frog. Higher = lower priority in Frog view. |
| importance_level | TEXT | null | NULL | Enum: 'critical_1', 'important_3', 'small_9' for 1/3/9 view |
| big_rock | BOOLEAN | false | NOT NULL | Whether this is a "big rock" in Big Rocks view |
| ivy_lee_rank | INTEGER | null | NULL | 1-6 ranking for Ivy Lee view. Null = not in top 6. |
| sort_order | INTEGER | 0 | NOT NULL | Order within Simple List and By Category views |
| parent_task_id | UUID | null | NULL | FK → compass_tasks (self-referential for Task Breaker subtasks) |
| task_breaker_level | TEXT | null | NULL | Enum: 'quick', 'detailed', 'granular', null |
| related_goal_id | UUID | null | NULL | FK → goals |
| related_wheel_id | UUID | null | NULL | FK → wheel_instances |
| related_meeting_id | UUID | null | NULL | FK → meetings |
| related_rigging_plan_id | UUID | null | NULL | FK → rigging_plans |
| source | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'helm_conversation', 'log_routed', 'meeting_action', 'rigging_output', 'wheel_commitment', 'recurring_generated' |
| source_reference_id | UUID | null | NULL | FK → source record |
| victory_flagged | BOOLEAN | false | NOT NULL | Whether this task was recorded as a victory on completion |
| completed_at | TIMESTAMPTZ | null | NULL | When the task was completed |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own tasks only.

**Indexes:**
- `user_id, due_date, status` (today's tasks — primary query)
- `user_id, status, archived_at` (active tasks)
- `user_id, life_area_tag` (By Category view)
- `parent_task_id` (loading subtasks)
- `user_id, related_goal_id` (tasks by goal)
- `user_id, related_wheel_id` (tasks by Wheel)

---

### AI Behavior for The Compass

#### View Suggestions
When the user opens The Compass, the AI can suggest a view based on context (detected from recent Helm conversations, Log entries, or time of day):
- "You mentioned feeling overwhelmed this morning. The 1/3/9 view might help you focus on just one critical thing."
- "You have a lot of small tasks today. Simple List might be the way to go — just check them off."
- "Several of your tasks are competing for attention. Try the Eisenhower Matrix to sort out what's really urgent vs. what just feels urgent."

This suggestion appears as a subtle banner at the top of the page, dismissible. Not shown every time — only when the AI has a relevant insight.

#### Task Placement Suggestions
When the user switches to a framework view, the AI suggests placement for each task:
- Eisenhower: suggests which quadrant
- Frog: suggests which task is the frog
- 1/3/9: suggests the 1 critical, 3 important, 9 small
- Big Rocks: suggests which 2-3 are the big rocks
- Ivy Lee: suggests the top 6 and their order

Suggestions are applied automatically but every placement is user-adjustable. The user sees a brief "AI suggested" indicator on each task that can be tapped to change.

#### Auto-Tagging
Same pattern as Log: when a task is created, the AI auto-assigns a life area tag based on the title and description. Tag appears as a removable chip. User can change or add.

#### Victory Prompt
When a task is checked off, a subtle prompt appears: "Is this a victory worth recording?" with "Yes" and "Dismiss" options. If "Yes," opens the Victory creation flow with task details pre-filled.

---

## Part 2: Task Breaker

### User Stories
- As a user, I want to break a big task into smaller steps so I can see a clear path forward.
- As a user, I want to choose how detailed the breakdown is because sometimes I need just a few steps and sometimes I need very small concrete actions.

### How It Works

Task Breaker is accessed from:
- Swipe right on any task → "Break Down" option
- Task detail screen → "Break Down" button
- The Helm conversation → AI suggests breaking down a task mid-discussion

**Flow:**
1. User selects a task to break down
2. Detail level selector appears:
   - **Quick** — 3-5 high-level steps
   - **Detailed** — substeps within steps
   - **Granular** — very small, very concrete first actions ("Open laptop. Create new document. Title it [X].")
3. AI generates the breakdown based on the task title, description, and any context from Helm/Keel
4. Subtasks appear as a preview — user can edit, delete, reorder, or add more before saving
5. On save: subtasks are created as `compass_tasks` records with `parent_task_id` pointing to the original task

**In the Compass view:**
- Parent tasks with subtasks show an expandable arrow
- Tap to expand → shows nested subtasks with their own checkboxes
- Checking off all subtasks does NOT auto-complete the parent (user must explicitly check off the parent — the work might have additional steps not captured)
- Subtasks inherit the parent's due date, life area tag, and goal/Wheel links unless overridden

---

### Data Notes for Task Breaker

Task Breaker does not need its own table. Subtasks are regular `compass_tasks` records with:
- `parent_task_id` set to the parent task's ID
- `task_breaker_level` recording which detail level was used
- `source` = 'manual' (since the user initiated the breakdown)
- Their own `sort_order` for ordering within the parent

---

## Part 3: Lists

### User Stories
- As a user, I want to create quick lists for things that aren't tasks (shopping, wishlists, expenses).
- As a user, I want different list types so they can be organized.
- As a user, I want the AI to help me decide what to do with a list (remind me, schedule it, just store it).
- As a user, I want to share a list via link for future spouse collaboration.

### Screens

#### Screen 5: Lists Main Page

**What the user sees:**
- Page title: "Lists"
- Accessible from The Compass page (tab or toggle at top: "Tasks | Lists") or from the More menu
- All lists displayed as cards with:
  - List title
  - List type badge (Shopping, Wishlist, Expenses, To-Do, Custom)
  - Item count and checked count (e.g., "3 of 7 checked")
  - Last updated date
- "New List" floating action button
- Tap a list card → opens Screen 6 (list detail)

---

#### Screen 6: List Detail

**What the user sees:**
- List title (editable)
- List type badge (editable)
- Items as checkable rows:
  - Checkbox + item text
  - Swipe left to delete item
  - Drag handle to reorder
- "Add Item" input field at bottom (type and press enter to add quickly)
- List actions menu (three-dot or gear):
  - Share List (generates shareable link — placeholder for future multi-user)
  - Export List (copy to clipboard as text)
  - Delete List (confirmation prompt)
  - "What should I do with this?" → opens Helm with list context

---

#### Screen 7: Create New List

**What the user sees:**
- List title field
- Type selector: Shopping, Wishlist, Expenses, To-Do, Custom
- "What should I do with this?" selector (AI-assisted):
  - "Just store it" — list exists, no automation
  - "Remind me about it" — creates a reminder linked to the list (date picker)
  - "Help me schedule it" — opens Helm to discuss timing
  - "Help me prioritize it" — opens Helm to discuss order
- "Create" button

After creating, immediately opens the List Detail to start adding items.

---

### Data Schema

#### Table: `lists`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| title | TEXT | | NOT NULL | List title |
| list_type | TEXT | 'custom' | NOT NULL | Enum: 'shopping', 'wishlist', 'expenses', 'todo', 'custom' |
| ai_action | TEXT | 'store_only' | NOT NULL | Enum: 'store_only', 'remind', 'schedule', 'prioritize' |
| share_token | TEXT | null | NULL | Unique token for shareable link. Null = not shared. |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own lists. Shared lists accessible via share_token (future implementation).

**Indexes:**
- `user_id, archived_at` (active lists)
- `share_token` (unique, for shared access)

---

#### Table: `list_items`

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| list_id | UUID | | NOT NULL | FK → lists |
| user_id | UUID | | NOT NULL | FK → auth.users |
| text | TEXT | | NOT NULL | Item text |
| checked | BOOLEAN | false | NOT NULL | Whether item is checked off |
| sort_order | INTEGER | 0 | NOT NULL | Order within list |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own items. Future: shared list items accessible via parent list's share_token.

**Indexes:**
- `list_id, sort_order` (loading items in order)

---

## Incoming Flows (How Tasks Get INTO The Compass)

| Source | How It Works |
|--------|-------------|
| Direct entry | User taps "Add Task" on Compass page |
| The Helm | AI creates task from conversation. source = 'helm_conversation' |
| The Log | User routes a Log entry as a task. source = 'log_routed' |
| The Wheel | Spoke 6 action commitments become tasks. source = 'wheel_commitment' |
| Meeting Frameworks | Action items from meetings. source = 'meeting_action' |
| Rigging | Planning output creates tasks. source = 'rigging_output' |
| Recurring | System generates next instance of recurring tasks. source = 'recurring_generated' |
| Task Breaker | AI creates subtasks under a parent task. parent_task_id set. |
| Reveille | User edits today's priorities (modifies existing, doesn't create new) |
| Reckoning | User sets tomorrow's top 3-5 (may create new or carry forward) |

---

## Outgoing Flows (How Tasks Feed Other Features)

| Destination | How It Works |
|-------------|-------------|
| Victory Recorder | Task completed → "Is this a victory?" → creates Victory record |
| Charts | Task completion rates tracked by day/week/month. Streak data for recurring tasks. |
| Crow's Nest | Today's task summary displayed on dashboard |
| Reveille | Today's priorities displayed in morning briefing |
| Reckoning | Today's completions and carryovers displayed in evening review |
| The Helm | Today's tasks loaded as context when task-related conversation detected |

---

## Edge Cases

### No Tasks Today
- Compass shows a clean empty state: "No tasks for today. Add one, or ask the Helm what you should focus on."
- "Ask the Helm" opens the drawer with a prompt for the AI to suggest priorities based on goals, Wheels, and recent context

### Too Many Tasks
- If user has 20+ tasks for a day, AI gently suggests: "You have [X] tasks today. That's a lot. Want me to help you identify the 3 most important ones?" Opens Helm for prioritization discussion.

### Recurring Task Generation
- Recurring tasks generate the next instance when the current one is completed or when the next date arrives
- If a recurring task is not completed, it does NOT generate duplicates — it stays as the current instance until dealt with
- User can skip a recurring instance (marks as cancelled for that date, next instance generates normally)

### Tasks from Multiple Sources
- A task should clearly show where it came from (source indicator on the task card and in detail view)
- Tasks from Wheels and Rigging plans maintain their links — completing them updates the source

### View-Specific Metadata Persistence
- When the user categorizes a task in one view (e.g., puts it in "Do Now" quadrant in Eisenhower), that categorization persists even when they switch to a different view
- Switching views does not lose framework-specific metadata
- A single task can have Eisenhower quadrant AND frog rank AND importance level — all stored independently

### Subtask Ordering
- Subtasks display in sort_order within their parent
- Subtasks are only visible when parent is expanded
- In framework views (Eisenhower, etc.), subtasks are NOT individually categorized — they inherit the parent's placement

---

## What "Done" Looks Like

### MVP
- Compass main page with all 7 view toggles
- Hover/long-press descriptions for each view
- Simple List, Eisenhower, and By Category views fully functional
- Add task with quick-add mode (title only → auto-tag → save)
- AI auto-tag on task creation
- Task completion with victory prompt
- Task detail view with editing
- Task Breaker (all three levels: quick, detailed, granular)
- Subtask display (expandable under parent)
- Carry forward flow
- Recurring tasks (daily, weekdays, weekly)
- Receive tasks from Helm, Log routing, and direct entry
- Task completion feeds Charts data
- Lists: create, add items, check items, edit, delete
- Lists accessible from Compass page
- Helm drawer from Compass loads today's tasks as context
- RLS on all data

### MVP When Dependency Is Ready
- Eat the Frog, 1/3/9, Big Rocks, Ivy Lee views (require AI suggestion infrastructure to be useful — build after core AI is solid)
- AI view suggestions based on user context
- Tasks from Wheels (requires PRD-11)
- Tasks from Meetings (requires PRD-17)
- Tasks from Rigging (requires PRD-16)
- List sharing via link (requires share infrastructure)

### Post-MVP
- Custom recurrence rules (iCal RRULE)
- Drag-and-drop between Eisenhower quadrants
- AI learning which views the user prefers at different times
- Batch task operations (select multiple, bulk carry forward/delete)
- List item reminders (individual item notification)
- Expense list with amount tracking

---

## CLAUDE.md Additions from This PRD

- [ ] View toggle pattern: same tasks, multiple layouts, framework metadata stored independently per view
- [ ] AI auto-tagging on tasks (same pattern as Log)
- [ ] AI view suggestion: subtle banner, not every time, only when relevant context exists
- [ ] AI task placement suggestion: applied automatically, every placement user-adjustable
- [ ] Task Breaker: subtasks are regular compass_tasks with parent_task_id, not a separate table
- [ ] Recurring tasks: next instance generated on completion or date arrival, never duplicates
- [ ] Victory prompt on task completion: subtle, dismissible, not blocking
- [ ] `compass_tasks` and `lists` and `list_items` table schemas
- [ ] Tasks/Lists navigation: Lists accessible from Compass page (tab or toggle)

---

*End of PRD-06*
