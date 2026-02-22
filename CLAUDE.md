# CLAUDE.md — StewardShip Project Instructions

> This is a living document. It grows as PRDs are written and development progresses.
> Last updated: February 2026 — All PRDs complete (PRD-01 through PRD-19)

---

## Project Overview

StewardShip is an AI-powered personal growth companion app with nautical theming. It combines journaling, goal tracking, habit formation, relationship tools, spiritual reflection, therapeutic frameworks, and planning into a chat-first interface.

**Read the System Overview PRD** (`docs/StewardShip_System_Overview_PRD_v2.md`) for the complete feature map, data flows, and cross-feature rules before working on any feature.

---

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, pgvector)
- **Hosting:** Vercel
- **AI:** Claude Sonnet via OpenRouter (initial), BYOK planned
- **Transcription:** OpenAI Whisper API
- **Embeddings:** Supabase pgvector

---

## Project Structure

```
stewardship/
├── public/                    PWA assets
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   ├── theme.css          CSS variables (colors, fonts, spacing) — default theme
│   │   ├── global.css         Reset, base styles
│   │   └── themes/            Additional theme overrides
│   │       └── [theme-name].css
│   ├── contexts/
│   │   └── ThemeContext.tsx    Theme provider and switching logic
│   ├── lib/
│   │   ├── supabase.ts        Supabase client
│   │   ├── ai.ts              AI provider adapter
│   │   ├── rag.ts             RAG utilities
│   │   ├── whisper.ts         Transcription
│   │   └── types.ts           ALL shared TypeScript interfaces
│   ├── hooks/                 One hook per feature
│   ├── components/            One folder per feature
│   │   ├── shared/            Reusable themed UI components (Button, Card, Input, Modal, etc.)
│   │   └── [feature]/         Feature-specific components
│   └── pages/                 One page per route
├── supabase/
│   ├── migrations/            SQL migrations
│   └── functions/             Edge Functions
├── docs/                      PRDs, System Overview, and Database Schema
├── CLAUDE.md                  THIS FILE — project root, read by Claude Code
└── package.json
```

---

## Design System

### Colors (use CSS variables, never hardcode)

```css
--color-deep-teal: #12403A;      /* Primary dark, headers, nav */
--color-dark-teal: #1F514E;      /* Secondary dark, active states */
--color-mid-teal: #3B6E67;       /* Buttons, interactive elements */
--color-slate-gray: #879E9D;     /* Secondary text, borders */
--color-cognac: #A46A3C;         /* Warm accents, highlights */
--color-deep-brown: #733C0C;     /* Rich accent */
--color-gold: #C9A84C;           /* ONLY for victories and celebrations */
--color-cream: #F5F0E8;          /* Backgrounds, cards */
--color-warm-sand: #E8DFD0;      /* Alt background */
--color-navy: #2C3E50;           /* Body text */
--color-white: #FFFFFF;
--color-light-gray: #F2F2F2;
```

### Typography
- **Headings:** Georgia (serif, literary feel)
- **Body text:** Arial or system sans-serif
- **No emoji** anywhere on adult interfaces. Text-based buttons only.
- **Gold effects** (shimmer, sparkle) reserved EXCLUSIVELY for victory celebrations

### Aesthetic
"Captain's quarters" — warm wood tones, brass, deep teal water, leather-bound logbooks. Masculine, contemplative, purposeful. Nautical without being cartoonish or kitschy.

### Theme System
- **Infrastructure-first:** All styling uses CSS custom properties. Every component must use `var(--color-*)`, `var(--font-*)`, `var(--spacing-*)` etc. — never hardcoded values.
- **ThemeProvider:** React context (`src/contexts/ThemeContext.tsx`) manages active theme, persists to `user_settings.theme` column, and applies theme class to document root.
- **Theme files:** Each theme is a CSS file in `src/styles/themes/` that overrides the CSS custom properties. Only one theme active at a time.
- **Default theme:** `captains-quarters` — the deep teal/cognac/cream palette defined above.
- **Additional themes added during development.** The infrastructure supports unlimited themes. Each theme file only needs to redefine the CSS custom properties.
- **Theme switching:** Instant via Settings page. No page reload required.
- **Gold effects rule still applies across all themes:** Gold visual accents reserved exclusively for victories and celebrations, regardless of theme.
- **Shared component library:** `src/components/shared/` contains themed base components (Button, Card, Input, Modal, Tooltip, etc.) that all features import. These components consume CSS variables so they automatically adapt to any theme.

### Mobile-First
- Design for phone screens first, scale up for tablet/desktop
- PWA installable from browser
- Touch targets minimum 44px
- Bottom navigation bar on mobile, sidebar on desktop

---

## Nautical Naming Map

Every feature has a nautical name. Use these consistently in code, UI, and comments.

| Name | What It Is | Component Folder |
|------|-----------|-----------------|
| The Helm | Chat interface (drawer + full page) | `helm/` |
| The Log | Journal / commonplace book / universal inbox | `log/` |
| The Compass | Task management + prioritization views | `compass/` |
| Charts | Progress tracking, visualizations | `charts/` |
| Crow's Nest | Dashboard / command center | `crowsnest/` |
| The Mast | Guiding principles, values, declarations | `mast/` |
| The Keel | Personality, self-knowledge | `keel/` |
| First Mate | Spouse profile + relationship tools | `firstmate/` |
| Crew | People profiles + categories | `crew/` |
| Sphere of Influence | Relationship influence visualization (within Crew) | `sphere/` |
| Victory Recorder | Accomplishment tracking | `victories/` |
| Safe Harbor | Stress relief, advice | `safeharbor/` |
| The Manifest | PDF knowledge base, RAG | `manifest/` |
| Rigging | Planning tool for projects/goals | `rigging/` |
| Meeting Frameworks | Structured recurring meetings | `meetings/` |
| Reminders + Rhythms | Notifications and periodic cadences | `reminders/` |
| Settings | Configuration panel | `settings/` |
| The Wheel | Change process tool | `wheel/` |
| Life Inventory | Life assessment tool | `lifeinventory/` |
| Task Breaker | AI task decomposition (within Compass) | `compass/` |
| Lists | Shareable flexible lists | `lists/` |
| Reveille | Morning briefing | `reveille/` |
| Reckoning | Evening review | `reckoning/` |
| Reminders | Nudges and prompts | `reminders/` |
| Settings | Configuration | `settings/` |

---

## Critical Cross-Feature Rules

These rules apply to EVERY feature. Violating them is a bug.

### 1. Declarations, Not Affirmations
When helping users write personal statements, use honest commitment language:
- YES: "I choose to become..." / "I am committed to..." / "When I feel X, I will Y"
- NO: "I am already..." / "I am confident and powerful" (when they clearly aren't)

### 2. Teach Principles, Not Authors
In AI conversations, apply framework concepts naturally. Never say "James Clear says..." or "According to Covey..." during the conversation. Offer attribution at the end or when asked.

### 3. AI Suggests, User Confirms
For task categorization, victory flagging, Compass view placement, Sphere suggestions, Log routing, Wheel recommendations, and Manifest intake — AI suggests, user confirms. Never auto-save AI-generated categorizations without user awareness.

### 4. Human Override / Edit on ALL Saved Data
Every piece of AI-generated content must be editable by the user. Nothing is locked. This includes celebration text, gap analysis, Keel summaries, Spoke data, meeting notes, and everything else.

### 5. Faith Context — Relevant, Not Forced
Faith references only when the topic naturally connects. Don't inject spiritual language into task management or scheduling unless the user brings it up or it connects to their Mast.

### 6. Redirect to Human Connection
When the user would benefit from a real person: suggest it. For spiritual matters: "Have you taken this to the Lord?" For relationship issues: "Have you talked to your wife about this?"

### 7. Crisis Override
If crisis indicators detected (suicidal ideation, self-harm, domestic violence), ALL other behaviors stop. Provide crisis resources immediately. No coaching. This supersedes everything.

### 8. No Emoji
Zero emoji in UI, AI responses, or generated content. Text-based buttons. Gold visual effects only for victories.

### 9. Steward, Not Captain
God is the Captain. The user is the steward — entrusted with the vessel, responsible for navigating faithfully, but serving under divine authority. NEVER call the user "Captain." Use "Steward" if a title is needed, or simply their name. The AI should frame the nautical metaphor as stewardship, not ownership or mastery.
- YES: "You're navigating well." / "How do you want to steer today?" / "Welcome aboard, [name]."
- NO: "You're the captain of your destiny." / "Welcome, Captain." / "You're in command."
This distinction is theologically critical to the app's identity and comes from the user's faith framework. (Reference: Orson F. Whitney's response to Invictus — "See in Him and Him alone, the Captain of thy soul.")

---

## The Helm: Persistent Drawer Pattern

The Helm exists in two forms:

1. **Drawer:** Pull-up from bottom of every page. Persists across page navigation. Context-aware of which page user is on.
2. **Full Page:** Dedicated chat page for longer conversations. Accessible from nav bar and "expand" button on drawer.

When building any page, assume the Helm drawer can be opened from it. The page should pass its context type to the Helm so the AI knows where the user is.

```typescript
// Example: every page provides its context to the Helm
type HelmPageContext = 
  | { page: 'compass'; activeView?: string }
  | { page: 'firstmate' }
  | { page: 'crew'; personId?: string }
  | { page: 'mast' }
  | { page: 'wheel'; wheelId?: string }
  | { page: 'charts' }
  | { page: 'log' }
  | { page: 'rigging'; planId?: string }
  | { page: 'meetings'; meetingType?: string; personId?: string }
  | { page: 'crowsnest' }
  | { page: 'safeharbor' }
  | { page: 'manifest' }
  | { page: 'settings' }
  | { page: 'lifeinventory' }
  | { page: 'victories' }
  | { page: 'lists' };
```

---

## The Log: Universal Inbox Pattern

The Log accepts any input. After capture, entries can be routed:
- Stay in Log (default)
- Create task → Compass
- Add to list → Lists
- Set reminder → Reminders
- Save to Mast or Keel
- Save to First Mate → spouse_insights
- Save to Crew → crew_notes (for people with rich context)
- Flag as victory → Victory Recorder

Build the routing selector as a shared component that can be reused.

---

## View + Work Page Pattern

Several features follow this pattern:
- **Page:** View, manage, edit, archive saved data
- **Work:** Guided conversational process at The Helm

Features using this pattern: The Wheel, Life Inventory, Rigging.

The page should have a clear CTA ("Create New Wheel" / "Start New Plan" / "Begin Assessment") that opens the Helm with the appropriate guided mode active.

---

## Component Portability

All features should be built as self-contained modules. These components are planned for future sharing with Inner Oracle and MyAIM-Central:
- The Wheel, The Log, Meeting Frameworks, Victory Recorder, Life Inventory, Task Breaker, Prioritization View Toggles, Safe Harbor, Lists, Sphere of Influence, Rigging

**Rules for portability:**
- Use CSS variables for all colors/theme values (no hardcoded colors)
- Define clear TypeScript interfaces in `lib/types.ts`
- Supabase-compatible data schemas
- Hooks should encapsulate all data access (swap Supabase for another backend later)
- Minimize cross-component dependencies

---

## TypeScript Conventions

- All data entities defined in `src/lib/types.ts`
- Use interfaces, not types, for data objects
- All IDs are `string` (UUID from Supabase)
- All timestamps are `string` (ISO 8601 from Supabase)
- Nullable fields use `field: string | null` not `field?: string`
- Enums as union types: `type LifeArea = 'spiritual' | 'marriage' | 'family' | ...`

---

## Supabase Conventions

- Table names: snake_case plural (`mast_entries`, `log_entries`, `compass_tasks`)
- Column names: snake_case (`created_at`, `life_area`, `parent_task_id`)
- All tables have: `id` (UUID, primary key), `user_id` (UUID, foreign key to auth.users), `created_at`, `updated_at`
- Row-Level Security on every table: users can only access their own data
- Soft delete where appropriate: `archived_at` timestamp instead of actual deletion

**See `docs/DATABASE_SCHEMA.md` for the complete, current table definitions, indexes, triggers, and foreign key map. That file is updated after each PRD and is the authoritative source for database structure.**

---

## AI Integration Notes

- All AI calls go through `src/lib/ai.ts` adapter
- API keys are NEVER in frontend code — use Supabase Edge Functions as proxy
- System prompt assembled dynamically based on context needed
- Mast entries always included in system prompt
- Other context (Keel, Wheel, First Mate, etc.) included based on conversation topic
- Max tokens configurable via user settings
- Cost tracking: log token usage per request

---

## Conventions Discovered During PRD Writing

### Error Messages
- All error messages displayed inline below the relevant field, never as toasts or popups
- Auth error messages are security-conscious: never reveal whether an email exists in the system

### Data Patterns
- **Soft delete:** Use `archived_at` TIMESTAMPTZ column (null = active, set = archived). No hard deletes in user-facing features.
- **Source tracking:** Entries that can come from multiple sources include `source` (freeform label) and `source_type` enum ('manual', 'uploaded_file', 'helm_conversation', 'manifest_extraction', 'log_routed') and `source_reference_id` (UUID, nullable) for traceability.
- **User-controlled ordering:** `sort_order` INTEGER column for drag-to-reorder within groups. Lower = higher position.
- **Auto-updated timestamps:** All tables with `updated_at` column use a Supabase trigger to auto-set on update.

### AI Context Loading
- **Mast entries:** ALWAYS loaded in every AI system prompt. They are small and everything references them.
- **Keel entries:** Loaded SELECTIVELY when personality context would improve the response (relationship topics, self-inventory, career advice, stress processing).
- **First Mate (spouse_insights):** Loaded SELECTIVELY when conversation touches on marriage, spouse, relationship, family dynamics, or user mentions wife by name. When loaded, Keel is also loaded for relationship dynamics context. Small/medium insights loaded as direct context; large file insights retrieved via Manifest RAG.
- **Other context:** Loaded based on conversation topic and which page the Helm drawer was opened from.

### AI Content Rules
- All AI-generated content (summaries, celebration text, gap analysis, compiled personality data) is fully editable by the user before AND after saving.
- AI-generated file summaries: the summary is stored in the entry, the original file is stored in Supabase Storage. Never discard the original.
- "Growth Areas" never "Weaknesses" in UI labels.
- Sensitive Keel content (mental health, trauma, shame) treated with care, never used judgmentally or thrown back at user.

### Love Language Logic
- The user's love language is stored in The Keel (self-knowledge).
- The spouse's love language is stored in First Mate profile.
- Relationship nudges and suggestions use the SPOUSE'S love language, not the user's. The AI bridges the gap between how the user naturally expresses love and how the spouse needs to receive it.
- **All five languages matter:** While the AI prioritizes the spouse's primary love language, it also encourages expressions across all five. A person may prefer Acts of Service, but still needs words of affirmation, quality time, thoughtful gifts, and physical affection. The AI varies suggestions and occasionally nudges outside the primary language.

### Auth & API Keys
- Default timezone: 'America/Chicago' (set from browser on account creation)
- AI API keys encrypted before storage. Never sent to frontend. All AI calls go through Supabase Edge Functions.
- Key priority: User key (if set in Settings) → Developer key (fallback from environment variable)

### 5 Levels of Consciousness
The AI applies this framework naturally when it helps the user understand why change is hard or why patterns persist. It never lectures about "levels" — it uses the concepts to set realistic expectations and prevent discouragement.
- Level 1 (Actions): Fully controllable, immediate
- Level 2 (Thoughts): Partially controllable, 2-5 min to shift
- Level 3 (Feelings): Not controllable, 30 min to 6 hours
- Level 4 (Context): Changed through sustained repetitive action, 10 days to 2 years
- Level 5 (Unconscious): Changed when made aware, otherwise automatic

### Cross-Device Persistence
- ALL user data is stored in Supabase, never only in device local storage or browser cache
- Local state (React state) is used for UI responsiveness only — database is the source of truth
- Conversations, messages, guided mode progress, and all feature data persist across devices signed into the same account
- Messages saved to database as sent/received (not batched or deferred)

### Message-Level User Actions
- Long-press (mobile) or right-click (desktop) on any message: copy text, save to Log, create task
- AI messages also offer: regenerate, shorter/longer
- Conversation-level: save entire conversation to Log, export as text, share

### Attachments in Chat
- Paperclip button in Helm input bar accepts PDF, PNG, JPG, WEBP, TXT, MD
- Files stored in Supabase Storage, path saved on the message record
- AI processes inline (vision for images, text extraction for PDFs)
- User can route attachments after discussion (to Manifest, Keel, etc.)

### Guided Mode Progress Persistence
- Each step of a guided process (Wheel spokes, Life Inventory areas, Rigging milestones) saves to the database as completed
- Progress is never lost — user can close app, switch devices, resume days later
- On return, AI detects in-progress guided mode and offers to resume with a summary of what's been completed

### Log Routing Pattern
- When a Log entry is routed to another feature (Compass, Mast, Keel, Victory, etc.), the original entry STAYS in the Log — routing creates a copy/link, never moves
- Multiple routings from a single entry are allowed (e.g., route to Mast AND create a task)
- Editing a Log entry does NOT update routed copies — they are independent after routing
- `routed_to` TEXT[] array tracks where entries went (for display), `routed_reference_ids` JSONB maps route types to created record IDs

### Array Columns and Search
- Life area tags stored as TEXT[] arrays with GIN indexes for containment queries
- **AI auto-tagging:** When a Log entry is saved, the AI automatically suggests and applies life area tags. Tags appear as removable chips — user can delete or add, but never needs to make tagging decisions themselves. This pattern should be used anywhere tags are applied (Log entries, Compass tasks, Victories, etc.).
- Full-text search on content columns uses PostgreSQL built-in full-text search, not external services
- AI context from Log: last 7 days, top 10 entries, ~200 char truncation per entry

### Compass View Toggle Pattern
- Same tasks viewed through multiple frameworks. Switching views changes layout, not data.
- Framework-specific metadata (eisenhower_quadrant, frog_rank, importance_level, big_rock, ivy_lee_rank) stored as independent columns — a task can have metadata for ALL views simultaneously.
- AI suggests placement when user switches to a framework view. Applied automatically, every placement user-adjustable.
- View descriptions shown on hover (desktop) or long-press (mobile) as tooltips.

### Task Breaker Pattern
- Subtasks are regular `compass_tasks` records with `parent_task_id` set — NOT a separate table.
- Completing all subtasks does NOT auto-complete the parent. User must explicitly check off the parent.
- Subtasks inherit parent's due date, life area, and goal/Wheel links unless overridden.

### Victory Prompt Pattern
- When a task is completed, a subtle dismissible prompt asks "Is this a victory worth recording?"
- Never blocking, never forced. User can dismiss with no consequence.

### Charts & Progress Conventions
- **Streaks:** Calculated on-the-fly from task data, never stored in a separate table. Weekday-only habits skip weekends. Weekly habits = one completion per week maintains the streak.
- **Broken streaks:** AI does NOT mention unless the user brings it up. When they do, be merciful: "Streaks break. It doesn't erase the days you showed up."
- **Milestone celebrations:** Connect to identity, not generic praise. Gold accent on chart card. Celebration text appears in Reckoning or next Helm interaction, never as a popup.
- **Empty chart states:** Show friendly encouragement message or hide the card entirely. Never display empty graphs or zero-data charts.
- **Custom tracker missed days:** Empty does NOT equal no/zero. Empty = not logged. This distinction matters for streak calculations.

### Victory Conventions
- **Gold visual effects:** ONLY on Victory Recorder cards/save animation and streak milestones on Charts. Gold appears nowhere else in the entire app.
- **Celebration text rules:** Identity-based, not performance-based. 1-3 sentences max. Connect to Mast principles and/or active Wheels when possible. Never generic ("Great job!"), never parental ("I'm so proud!").
- **Victory identification in conversations:** Suggest when genuine accomplishment detected. Do not suggest for trivial routine tasks. Maximum one suggestion per accomplishment. Accept "no" gracefully and move on.
- **Victories as encouragement:** When user is discouraged, acknowledge the difficulty FIRST, then offer victory evidence. Never dismissive ("But look at all these wins!"). Always validating before redirecting.
- **Victory from deleted source:** Victory record persists. Source link becomes inactive with "Original source no longer available."
- **Victory Review:** Conversational AI narrative reflecting on victories for a time period (today/week/month). Not a list — a warm personal reflection connecting victories to identity, Mast, Wheels, and each other. Embedded in Reckoning for daily review. Saveable to Log. If no victories for the period, skip the section entirely rather than showing empty state.

### Dashboard (Crow's Nest) Conventions
- Crow's Nest is purely read-only — it creates no data, only aggregates and navigates.
- Dashboard cards only appear when they have content. Empty cards are hidden, never shown blank.
- No AI-generated content on the dashboard — all text comes from stored data. Keeps page load fast with zero API calls.
- New user welcome message: warm and orienting ("Your voyage starts here"), never guilt-inducing about empty features.
- Time-of-day greeting based on user's timezone from `user_profiles`.

### Daily Rhythms (Reveille + Reckoning)
- Time-triggered experiences, not standard navigable pages (though Reckoning also accessible manually from Crow's Nest).
- Show once per day, tracked via `daily_rhythm_status` table. After dismissal, do not reappear until next day.
- Sections with no data are hidden — the experience contracts gracefully, never shows blank or empty sections.
- **No guilt language:** "Some days are like that" not "You didn't complete anything." Never punitive.
- **Morning/Evening Reading — three-source system:**
  - **Mast Thought:** User's own principles reflected back. Rotated by user's chosen frequency (every open, daily, weekly, manual).
  - **Manifest Devotional:** AI-summarized content from user's uploaded library via RAG. Always includes source reference (book + chapter, scripture reference, section title). May synthesize across multiple Manifest sources when connections exist.
  - **Log Breakthrough:** Past journal entries with insights/breakthroughs relevant to current situation. Framed with date and context ("Three months ago you wrote this...").
  - Morning and evening readings are always different from each other.
  - User configures which sources are enabled in Settings (`morning_reading_sources`).
- Prompted entries (gratitude/joy/anticipation) are simple capture moments in Reckoning, not conversation starters. Save to Log quietly.
- Victory Review (from PRD-08) embedded in Reckoning evening flow.

### Wheel Conventions
- **Framework:** From the user's therapist (Change Wheel). For big character/identity changes, not small habits or tasks.
- **Structure:** Hub (core change) + 6 Spokes + Rim (periodic check-in). Each spoke saves incrementally.
- **Spoke names and always-answers:**
  - Spoke 1 (Why): Always "to increase self-worth and belonging for myself or others." AI tells user upfront, then explores specifics.
  - Spoke 2 (When): Always "as soon as possible." Set start date (after support in place) and checkpoint date (to evaluate progress). Merciful, not rigid.
  - Spoke 3 (Self-Inventory): Always "I need a self-inventory." Two parts, each compiled into an essay the user reviews/edits.
    - Part 1: Honest assessment of current trait/behavior. Should be genuinely uncomfortable. If it doesn't cause discomfort, it's not big enough for a Wheel.
    - Part 2: Vision — role models (at least 2, ideally 3-4, specific traits not whole people) + what success looks like. Rich, detailed picture of who they want to become.
    - Essays can be exported (download/email). AI offers to send insights to Keel and vision to Mast (user decides).
  - Spoke 4 (Support): Three specific roles with boundaries:
    - Supporter: cheerleader, never judges/nags. Spouse CAN be.
    - Reminder: given explicit permission, agree on HOW. Spouse NEVER. Ideally proximate to change environment.
    - Observer: watches progress, honest feedback. Spouse NEVER (but spouse can share observations WITH observer). Ideally able to see user in context.
    - AI drafts conversation scripts for each role. AI serves supplementally in all three roles but pushes toward human connection.
    - "Ideally" not "must" for proximity — imperfect something beats perfect nothing.
  - Spoke 5 (Evidence): Three sources defined upfront, reviewed during Rim: self-observation, observer feedback, blind test (strongest — people who don't know notice anyway). Plus fruits.
  - Spoke 6 (Becoming): "I do what the person I want to be would do." AI suggests Compass tasks, user decides. Not automatic.
- **Rim:** ~2 week default, user adjustable. Reviews all spokes. At checkpoint date, user evaluates and decides: complete, continue, adjust, or archive.
- **Limits:** No hard limit on active Wheels, but AI suggests 1-2.
- **AI style during Wheel building:** Thorough, not rushed. Probes beneath surface answers. Connects spokes to each other and to Keel/Crew data. Presents always-answer before exploring specifics. Never nags about Wheels in regular conversation.

### Life Inventory Conventions
- **Conversational, not clinical.** No 1-10 scales. No forced categories. AI asks warm, approachable questions and organizes responses into life areas behind the scenes.
- **Default areas:** Spiritual/Faith, Marriage/Partnership, Family/Parenting, Physical Health, Emotional/Mental Health, Social/Friendships, Professional/Career, Financial, Personal Development/Learning, Service/Contribution. Plus custom areas.
- **Three-column view per area:** Where I was (baseline), Where I am (current), Where I'm wanting to end up (vision). All user-editable.
- **Seeding:** Onboarding conversation seeds it. User doesn't see the organized page until later.
- **Updates from Helm:** AI notices relevant info in regular conversations and asks "Would you like me to add that to your Life Inventory for context?" Never silently updates.
- **Incremental save:** Each area saves as the AI reflects back and user confirms.
- **Living document:** AI tracks movement over time. Recognizes when user is living what they previously described as their dream and points it out.
- **No forced schedule.** AI may suggest refresh if 3+ months since last, but only once and easily dismissed.

### First Mate Conventions
- **Flexible input:** Spouse profile built through conversation at the Helm, file uploads (PDF, .md, .txt, images), pasted text, or direct entry. No rigid form fields. Same flexible-input philosophy as the Keel.
- **spouse_insights table:** Central store for all knowledge about the spouse. Each record is one categorized insight, tagged by category and source. AI auto-categorizes on save, user can adjust (same pattern as Log tagging).
- **Categories:** personality, love_appreciation, communication, dreams_goals, challenges_needs, her_world, observation, her_response, gratitude, general.
- **File handling:** Small/medium files → content extracted into spouse_insights as direct AI context. Large files → sent to Manifest RAG pipeline, `is_rag_indexed` flag set on the insight. Threshold: ~3000 tokens.
- **Sacred triangle framing (initial user):** Becoming a better husband = drawing closer to God. Swedenborg's conjugial love: deepening spiritual union as both draw closer to the Lord. Applied when natural, never forced. For future multi-user: adapts to user's Mast faith context, omitted for secular users.
- **Relationship safety — three-tier:**
  - Tier 1 (Capacity Building): Normal relationship challenges. Communication tools, talking points, perspective-taking.
  - Tier 2 (Professional Referral): Complex/entrenched patterns. Help prepare for therapy, encourage professional help.
  - Tier 3 (Safety Assessment): Red flags (fear, control, isolation, escalation). Crisis resources immediately. NO "work on it" advice. Crisis Override (Rule 7) applies.
- **Pattern recognition:** AI notices relationship patterns across Helm conversations, Log entries, and First Mate data. Reflects in conversation when user is in receptive context. No visible tracker, no health score, no rating on the page.
- **Helm-to-First-Mate flow:** When user mentions something substantive about spouse in Helm conversation, AI offers to save to spouse_insights. Not after every mention — only when something worth saving emerges.

### Marriage Toolbox (First Mate Guided Modes)
Five guided conversation modes accessible from the First Mate page, each opening the Helm with First Mate + Keel context:
- **Quality Time:** Date planning using spouse insights. Produces Compass tasks.
- **Gifts:** Gift brainstorming connected to who she is. Produces Compass tasks.
- **Observe and Serve:** Service based on her current reality. Nudges awareness of repeated frustrations, put-off requests, overlooked needs. Produces Compass tasks.
- **Words of Affirmation:** Helps user see and articulate what's incredible about his wife. Draws from full First Mate profile AND gratitude entries. Includes **21 Compliments Practice**: structured generation of 21 (default, user adjustable) thoughtful compliments through conversation. All editable. Saved as a List (PRD-06) for delivery tracking throughout the week.
- **Gratitude:** Quick capture (simple text entry, saves to BOTH Log with marriage life area AND spouse_insights with gratitude category) plus deeper Helm conversation. AI occasionally offers to go deeper when quick capture entry has depth potential.
- All modes use `guided_mode = 'first_mate_action'` with `guided_subtype` on helm_conversations.
- All modes can produce Compass tasks (user confirms which to create, life_area = 'spouse_marriage').

### Spouse Prompt System
- Three user-initiated buttons on the First Mate page: **Ask Her**, **Reflect**, **Express**.
- User taps the button they're in the mood for → AI generates a prompt of that type.
- Prompt generation considers: gaps in spouse knowledge (gap-filling), current relationship context from recent conversations/Log entries (contextual), variety in prompt types, and depth over breadth as the profile grows.
- Actions: "Done — Record Response" (Ask Her), "Done" (Reflect/Express), "Skip" (any).
- Responses auto-saved as spouse_insights in appropriate category.
- Past prompts viewable with full history.

### Crew Conventions
- **Shared `people` table** with First Mate. Spouse (`is_first_mate = true`) appears in Crew's Immediate Family section but tapping navigates to First Mate page. No duplicate context system.
- **Rich context for children:** Children automatically get `has_rich_context = true` and use the `crew_notes` table for categorized context (personality, interests, challenges, growth, observations). Other relationship types can be upgraded to rich context by the user.
- **Basic context for others:** Freeform `notes` field on the `people` record. Sufficient for coworkers, acquaintances, casual friends.
- **Helm-to-Crew flow:** AI recognizes names from people table. Offers to add unknown people when they seem significant (emotional weight, advice-seeking, conflict processing, repeated mentions). Does NOT offer for casual or transactional mentions. Offers to save substantive insights to crew_notes (rich context) or freeform notes (basic).
- **Name disambiguation:** If multiple people share a name, AI uses relationship type and conversation context. If uncertain: "Are you talking about [name] your son or [name] from work?"

### Sphere of Influence Conventions
- **Atwater framework (inward):** What you ALLOW to influence you. Distinct from Covey's Circle of Influence (outward — what you CAN influence). Both frameworks available conversationally at the Helm.
- **Six spheres (center outward):** Focus, Family, Friends, Acquaintances, Community, Geo-Political.
- **Focus center:** Self, Spouse, God — fixed for married users, cannot be moved.
- **Each person has two sphere assignments:** desired (where you WANT their influence) and current (where they actually ARE). Current is optional.
- **Gap coaching:** Only in relevant conversation context, never unsolicited. Inward = strengthen relationship (suggest actions, Compass tasks). Outward = boundary calibration, NOT cutting off (reframe influence weight).
- **Misalignment detection:** AI notices when behavioral patterns (journal, conversation) don't match sphere placement. Reflects curiously, never accusatorily.
- **Non-person entities:** `sphere_entities` table for social media, news, politics, entertainment, ideology. Same sphere assignment system.
- **MVP:** List-based Sphere View. Post-MVP: interactive concentric circles visualization.

### Safe Harbor Conventions
- **AI behavioral mode, not a data feature.** No new tables. Conversations stored in `helm_conversations` with `guided_mode = 'safe_harbor'`. Processing notes → Log. Actions → Compass. Self-insights → Keel.
- **AI sequence:** Validation FIRST (make them feel heard), frameworks SECOND (only when user signals readiness), action THIRD (when user is ready to move forward). Never rush past validation.
- **Context loading:** Mast + Keel + recent Log always loaded. First Mate, Crew, Wheel, Life Inventory, Manifest loaded when topically relevant.
- **Frameworks applied:** 5 Levels of Consciousness (controllability sorting), Owner vs. Victim stance and Circle/Zigzag/Straight Line and empowering vs. disempowering language (all Straight Line Leadership), Circle of Influence vs. Circle of Concern and Begin with the End in Mind and Divine Center (7 Habits), Swedenborg regeneration/ruling love/influx, LDS "Think Celestial" eternal perspective, active Wheel connection (Spoke 6), Mast principle grounding, Manifest wisdom via RAG. All applied naturally, never as lectures.
- **Redirects to Christ, spouse, and human connection:** The destination, not afterthoughts. AI redirects at least once per Safe Harbor conversation. "Have you taken this to the Lord?" / "Have you talked to your wife?" / "Who can you bring this to?" Never forced, always offered when natural.
- **Owner vs. Victim:** NEVER use "victim" as a label or accusation. Framework is about inner stance, not character judgment. Model the shift, don't correct the user's language.
- **Three-tier safety:** Tier 1 (capacity building — normal stress), Tier 2 (professional referral — complex/entrenched patterns), Tier 3 (crisis override — ALL coaching stops, immediate resources). Consistent with Faith Ethics Framework.
- **Light-touch auto-detection:** In regular Helm conversations, AI can mention Safe Harbor exists when stress detected. Max once per conversation. Not a mode shift — just a mention.
- **Crisis Override applies everywhere.** Not limited to Safe Harbor. If crisis indicators appear in ANY conversation in ANY mode, resources provided immediately. Supersedes all other rules.
- **Repeat visits:** AI gently reflects pattern after 2-3 visits on same topic. Redirects to human connection or action. Does not refuse to engage.
- **Faith crisis:** Validate, don't fix. Redirect to spiritual community.
- **Manifest-to-Framework pipeline:** Users can expand the AI's framework toolkit by uploading books/resources to the Manifest and choosing "Extract as AI Framework." Extracted principles stored in `ai_frameworks` table, loaded alongside Mast. Full source stays in Manifest for RAG. Detailed in PRD-15.

### Manifest Conventions
- **Central knowledge base and file processing pipeline.** RAG retrieval via pgvector similarity search on `manifest_chunks`.
- **Intake flow:** User designates how each upload is used (general reference, framework source, Mast extraction, Keel info, goal/wheel specific, store only). Multiple designations allowed.
- **RAG retrieval:** Top-k similar chunks (typically 3-5) injected into AI context with source attribution. AI paraphrases, attributes source ("There's a concept from [title] that applies here..."), never quotes at length.
- **ai_frameworks:** Extracted principles from framework-designated items, loaded alongside Mast in every AI interaction. Not retrieved via RAG — always present. User controls which frameworks are active.
- **Auto-organization:** AI suggests tags and folder groupings on upload. User can override. Custom tags tracked and reused for future suggestions.
- **Processing pipeline:** Upload → background chunking → embedding → indexed. User doesn't wait. Processing status visible on cards.
- **Cross-feature file routing:** Large files from First Mate/Crew (>~3000 tokens) route to Manifest RAG pipeline with `is_rag_indexed` flag.
- **Manifest-to-Mast extraction:** AI proposes principles from uploaded material, user reviews and confirms which become Mast entries (source_type = 'manifest_extraction').
- **Manifest-to-Keel extraction:** AI proposes personality/self-knowledge data, user reviews and confirms (source_type = 'manifest_extraction').
- **Content sources for Reveille:** Manifest is one of three sources for morning/evening readings (alongside Mast and Log). AI selects, attributes source.

### Rigging Conventions
- **Rigging is the planning tool** for goals, projects, and aspirations bigger than a single task. Plans are created conversationally at The Helm (`guided_mode = 'rigging'`) and managed from the Rigging page.
- **AI selects planning frameworks** based on what the user describes. Five frameworks available: MoSCoW, Backward Planning, Milestone Mapping, Obstacle Pre-mortem, 10-10-10. Frameworks can be combined ("mixed"). AI uses plain language — no jargon unless the user asks.
- **Per-plan nudge preferences:** approaching milestones (Reveille/Reckoning), related conversation connections (Helm), overdue milestone nudges (default off). User sets during creation, editable anytime.
- **Nudge tone:** merciful, informational, never guilt-inducing. Overdue nudges back off after 2 mentions if ignored.
- **Task Breaker integration:** milestones broken into Compass tasks at quick/detailed/granular levels. Tasks created with `related_rigging_plan_id` and `source = 'rigging_output'`.
- **Rigging/Compass boundary is soft:** AI suggests Rigging when something is too big for a task, but user decides. No gatekeeping.
- **Manual plan creation available** — no AI conversation required. AI can help later via "Continue Planning."
- **Faith integration:** relevant, not forced. Plans connecting to family, stewardship, or values naturally reference Mast principles with faith elements. Kitchen renovations don't get scripture.
- **Three tables:** `rigging_plans` (plan metadata, framework data, MoSCoW arrays, 10-10-10 analysis, nudge preferences, Mast/Goal connections), `rigging_milestones` (ordered milestones per plan, target dates, status, Task Breaker level), `rigging_obstacles` (pre-mortem risk/mitigation entries with status tracking: watching, triggered, resolved).
- **Context loading for Rigging guided mode:** Mast + active Rigging plans always loaded. Keel, Life Inventory, Goals, Manifest RAG, active Wheels loaded when relevant.
- **Plan revision:** Plans are living documents. Inline editing on Plan Detail page. "Continue Planning" reopens at Helm for deeper revision. Additional frameworks can be applied to existing plans.
- **Plan completion:** When all milestones complete or user manually marks complete → AI offers identity-based reflection + victory prompt. Completed plans viewable under collapsed section on Rigging page.

### Meeting Frameworks Conventions
- **Meeting Frameworks provides structured, recurring meeting templates** guided by AI at The Helm (`guided_mode = 'meeting'`). Four built-in types: Couple, Parent-Child Mentor, Personal Review (weekly/monthly/quarterly), Business Review. Plus user-created custom templates.
- **Eight core elements** in every meeting: opening prayer/centering, review previous commitments, current state assessment, vision alignment, goal setting, action planning, recording impressions, closing prayer/reflection. Faith elements adaptive to user's Mast context.
- **Two entry modes:** Live Mode (AI walks through agenda in real-time) and Record After (condensed capture after the meeting already happened). Record After is lighter — captures essence, not full walkthrough.
- **Parent-Child meetings are age-adaptive:** Core Phase (0-8) focuses on simple habits and fun goals, Love of Learning (8-12) explores interests, Scholar Phase (12+) sets structured goals across areas. AI adapts based on child's age from Crew profile.
- **Couple Meeting loads full First Mate + Keel context.** State of the Union section uses empathetic listening (validate first). Three-tier relationship safety applies.
- **Business Review loads Mast work/stewardship principles.** Frames work as meaningful service. Manifest RAG available for business framework content.
- **Personal Reviews pull real data:** Compass task completion, Chart streaks, Victory summaries, Log themes. Weekly = tactical (roles-based Quadrant II planning). Monthly = strategic (mini Life Inventory, Mast review).
- **Quarterly Inventory** = scheduled cadence that opens Life Inventory guided mode (PRD-11), not a separate meeting flow. Meeting record created for scheduling continuity.
- **Meeting schedules surface in Reveille.** Overdue meetings mentioned once, gently, then not again for 7 days. No guilt, no nagging.
- **Pattern recognition after 5+ meetings.** AI notices recurring themes, carry-forward goals, growth trends. Reflects in conversation, never assigns scores.
- **Custom meeting templates:** create via AI conversation, manual form, or uploaded agenda file. Templates stored with ordered JSONB agenda sections.
- **Convention:** Meeting notes → Log (`entry_type = 'meeting_notes'`, `source = 'meeting_framework'`). Action items → Compass (`source = 'meeting_action'`). Insights → First Mate / Crew / Keel as appropriate.
- **Three tables:** `meetings` (individual records), `meeting_schedules` (recurring config), `meeting_templates` (custom templates with JSONB agenda sections).

### Reminders + Rhythms Conventions
- **Reminders is the notification infrastructure** — every time-sensitive behavior in the app flows through it. Delivery methods: Reveille batch (default, non-urgent), Reckoning batch (evening reflective), push notification (time-critical only), in-app alert (contextual while app is open).
- **Reminder lifecycle:** pending → delivered → acted_on / dismissed / snoozed / archived. Snooze presets: 1 hour, later today, tomorrow, next week. Auto-dismiss after 3 snoozes. Auto-archive delivered reminders after 30 days.
- **Merciful defaults:** Rigging overdue milestones max 2 mentions then stops. Wheel Rim mentioned once. Streaks only in Reckoning, never push. No guilt language ever. StewardShip should never feel like a noisy productivity app.
- **Frequency capping:** max 5 push notifications per day. Quiet hours (default 10 PM to reveille_time). Excess batched into next Reveille. Push never interrupts an active Helm conversation.
- **Rhythms beyond daily Reveille/Reckoning:** Friday Overview (week summary card), Sunday Reflection (spiritual renewal card), Monthly Review prompt (links to PRD-17), Quarterly Inventory prompt (links to PRD-11). All configurable day/time, all disableable.
- **Friday Overview:** week stats, Log themes, next-week preview, reflection prompt. **Sunday Reflection:** spiritual reading, four-dimension renewal prompt (physical/spiritual/mental/social rotating), intention setting. Both are lightweight cards, not full meeting sessions.
- **Reminder sources:** Compass tasks, Meeting schedules, Important dates (First Mate + Crew), Wheel Rim, Rigging milestones, Spouse prompts, Streaks, Lists, Log-routed, Custom user, Rhythms, Journal export.
- **Push notifications** require Web Push API subscription via `push_subscriptions` table. If not granted, all reminders fall back to Reveille/Reckoning batch. App works fully without push.
- **Deduplication:** Before creating any reminder, check for existing pending/delivered/snoozed reminder with same `related_entity_type` + `related_entity_id` + `reminder_type`.
- **Convention:** Most reminders batch into Reveille/Reckoning. Push reserved for: important dates (day of), custom time-specific reminders, meeting day-of (if user chose push), rhythm triggers.
- **Three tables:** `reminders` (individual records with lifecycle), `push_subscriptions` (Web Push API device registrations), `rhythm_status` (tracks weekly/monthly/quarterly rhythm dismissals).
- **New `user_settings` columns:** rhythm enable/disable and timing, quiet hours start/end, per-type notification delivery preferences (tasks, meetings, people, growth, streaks, rhythms, custom), important dates advance notice days, max daily push cap.

### Settings Conventions
- **Settings is the configuration panel** — no new tables, no new features. It surfaces controls for `user_profiles` and `user_settings` columns defined across PRDs 01-18, plus `meeting_schedules` from PRD-17.
- **Nine sections:** Account, AI Configuration, Daily Rhythms, Notifications, Rhythms, Meeting Schedules, Compass, Data & Privacy, About. Collapsible sections with progressive disclosure.
- **Appearance/Theme setting:** Lives in Account section. Switches active theme instantly via ThemeProvider context. Persists to `user_settings.theme` column.
- **Plain language labels** everywhere — "Response Length" not "max_tokens", "Context Depth" not "context_window_size", friendly labels not technical terms.
- **Deep linking:** other features can link directly to a specific Settings section expanded (e.g., "Notification Settings" from a reminder, "Meeting Schedules" from Meeting Frameworks).
- **Immediate effect:** all changes take effect instantly — no global Save button. Optimistic updates with periodic sync.
- **Delete account:** irreversible, two-step confirmation (warning + type "DELETE"). Cascade delete on auth.users removes all related records.
- **API key:** encrypted storage, "Test Connection" before saving, "Clear" button to revert to developer key.
- **Data export:** ZIP of JSON files per table, background generation, 24-hour download link expiry.

---

## TODO: Items to Add as PRDs Are Written

_This section collects things still needed. Check items off as they're addressed._

- [x] Supabase table schemas → moved to `docs/DATABASE_SCHEMA.md`
- [x] AI system prompt template → defined in PRD-04
- [x] Helm drawer implementation → defined in PRD-04
- [x] Declaration language rules → defined in PRD-02
- [x] Onboarding steps 3-4 → defined in PRD-02 (Mast) and PRD-03 (Keel)
- [x] First Mate conventions → defined in PRD-12
- [x] Marriage Toolbox guided modes → defined in PRD-12
- [x] Spouse prompt system → defined in PRD-12
- [x] Crew conventions → defined in PRD-13
- [x] Sphere of Influence conventions → defined in PRD-13
- [x] Safe Harbor conventions → defined in PRD-14
- [x] Manifest conventions → defined in PRD-15
- [x] Rigging conventions → defined in PRD-16
- [x] Meeting Frameworks conventions → defined in PRD-17
- [x] Reminders + Rhythms conventions → defined in PRD-18
- [x] Settings conventions → defined in PRD-19
- [ ] Edge Function specifications
- [ ] PWA manifest and service worker configuration
- [ ] Remaining onboarding steps (1-2, 5-7)
- [ ] Notification/push infrastructure details
- [ ] Google Calendar OAuth flow (post-launch)
- [ ] Printable journal export implementation details
- [ ] RAG pipeline specifics (chunk size, embedding model, top-K)

---

*End of CLAUDE.md starter. This document grows with the project.*
