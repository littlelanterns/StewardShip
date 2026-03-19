# MyAIM Family — Feature & Component Glossary
## Quick Reference for Every Feature, How It Connects, and What Supports It

**Created:** March 19, 2026
**Purpose:** A plain-language reference for every feature and system component in MyAIM Family v2, organized by category, with key data flow connections noted.
**Companion to:** Build Order Source of Truth v2, Remaining PRDs Ordered, Pre-Build Setup Checklist

---

## How to Read This Document

Each entry follows this pattern:

- **Feature Name** — One-sentence description of what it is and what it does.
- *Connects to:* Which features it talks to, with arrows showing the most important data flows.

Arrows mean: `→` feeds data into, `←` receives data from, `↔` two-way exchange.

---

## FOUNDATION

**PRD-01 · Auth & Family Setup** — Account creation, family structure, and member onboarding; mom creates the family, adds members, and controls the subscription. Everything depends on this — it's the identity layer the entire platform builds on. Every table in the system references `families` and `family_members` defined here.

*Connects to:* Every feature. Specifically provides identity to PRD-02 (Permissions), seeds system defaults like Backburner lists (PRD-09B), and defines the subscription tier that PRD-31 will activate.

---

**PRD-02 · Permissions & Access Control** — The rule engine that determines who can see and do what, including role-based access (mom, dad/additional adult, independent teen, guided child, play child, special adult/caregiver), View As mode, per-feature sharing controls, and the teen privacy/transparency model. Every feature checks permissions through `useCanAccess()` and wraps member-scoped UI in `PermissionGate`.

*Connects to:* Every feature consumes permissions from here. PRD-04 (Shell Routing) uses it to determine navigation visibility. PRD-14C (Family Overview) uses it for dad's access scope. PRD-27 (Caregiver Tools) is built almost entirely on its permission-based view system.

---

**PRD-03 · Design System & Themes** — All visual tokens (colors, fonts, spacing, border radii, shadows), theme/vibe combinations, dark mode, gradient toggle, and the core component library (Button, Card, Input, Modal, Tooltip, Toast, Badge, EmptyState, LoadingSpinner, MemberPillSelector, FeatureGuide, etc.). Zero hardcoded colors — every component uses semantic CSS variables.

*Connects to:* Every UI component consumes these tokens. PRD-04 (Shell Routing) applies shell-specific token overrides on top of themes. PRD-24B (Gamification Visuals) uses the animation and color systems.

---

**PRD-04 · Shell Routing & Layouts** — Defines the four "shells" (Mom/Adult, Independent Teen, Guided Child, Play Child) that determine how navigation, layout zones, sidebar, and drawers behave for each member type. Also defines the LiLa chat drawer (three states: collapsed/peek/full), Smart Notepad drawer, floating buttons (Li, La, Settings), the Hub layout (family shared screen), the perspective switcher (mom-only: My Dashboard / Family Overview / Hub / View As), mobile responsiveness, and PWA entry points.

*Connects to:* Wraps everything — it's the physical container all features render inside. Consumes PRD-03 tokens. PRD-14 (Dashboard) renders within its zones. PRD-25/26 (Guided/Play Dashboards) use its simplified shell layouts. PRD-33 (Offline/PWA) extends its PWA manifest.

---

## AI SYSTEM

**PRD-05 · LiLa Core AI System** — The AI assistant engine: conversation management, guided mode registration and routing, context assembly pipeline (pulling from Archives, InnerWorkings, family relationships, and semantic search across all embedded tables), multi-model routing via OpenRouter, and the Human-in-the-Mix pattern (Edit/Approve/Regenerate/Reject on every AI output before it saves anywhere). Defines the core guided modes (Help, Assist, General Chat) and the pattern all other PRDs follow when registering their own guided modes.

*Connects to:* The brain powering every AI interaction. ← Receives context from PRD-13 (Archives), PRD-07 (InnerWorkings), PRD-19 (Family Context & Relationships), and semantic search across all embedded tables. → Powers guided modes registered by PRD-07, PRD-12A, PRD-12B, PRD-14B, PRD-16, PRD-19, PRD-20, PRD-23, PRD-34, and others. Uses AI Cost Optimization Patterns P1–P9 throughout.

---

**PRD-05C · LiLa Optimizer** — A specific LiLa mode where mom pastes any AI prompt and LiLa enhances it using her family's context from Archives. Generates a prompt card only — explainers, teaching notes, and extras are on-demand via action chips (never auto-generated). This is a key teaching tool for the AI Vault experience.

*Connects to:* ← Pulls family context from PRD-13 (Archives). → Outputs improved prompts that can be saved to user's prompt collection. Central to PRD-21A (AI Vault) content experience — demonstrates the "I Go First" teaching philosophy by showing what personalized AI looks like.

---

## PERSONAL GROWTH

**PRD-06 · Guiding Stars & Best Intentions** — Guiding Stars are long-horizon life aspirations and identity declarations; Best Intentions are the daily/weekly actions that serve them. Together they answer "what matters most to me right now?" Follows the Honest Declarations philosophy — every declaration must be something every fiber of a person's being can affirm as true in the present moment.

*Connects to:* → Feeds into PRD-14 (Dashboard display), PRD-14C (Family Overview columns), PRD-18 (Rhythms content), PRD-11 (Victory Recorder context). ← Receives declarations from PRD-23 (BookShelf extractions) and PRD-12A (LifeLantern). ↔ LiLa uses Guiding Stars as context for coaching across all guided modes.

---

**PRD-07 · InnerWorkings** — A self-knowledge profile built through guided LiLa conversations — communication style, love languages, conflict patterns, strengths, values, personality insights. Stored as structured self-knowledge records with embeddings for semantic retrieval.

*Connects to:* → Feeds deep personal context into LiLa for personalized coaching across all modes. → PRD-34 (ThoughtSift) Perspective Shifter uses real InnerWorkings data for family-context lenses. ← Receives insights from PRD-23 (BookShelf content extractions, `source_type = 'content_extraction'`).

---

**PRD-08 · Journal + Smart Notepad** — Two distinct tools sharing a drawer. Journal is private reflective writing with optional LiLa prompts and mood tracking. Smart Notepad is the universal capture surface — quick text/voice input with a RoutingStrip that sends items to Tasks, Lists, Calendar, MindSweep, Backburner, or any other destination. Notepad supports drag-to-rearrange, voice capture via Web Speech API, and Review & Route batch processing.

*Connects to:* Smart Notepad is a major intake funnel — nearly every feature receives items from it via the RoutingStrip (PRD-17). → Routes to PRD-09A (Tasks), PRD-09B (Lists), PRD-14B (Calendar), PRD-17B (MindSweep), Backburner, and more. ← Journal receives reflection prompts from PRD-23 (BookShelf) and content from PRD-18 (Rhythms). Journal entries are embedded for semantic search by LiLa.

---

**PRD-09A · Tasks, Routines & Opportunities** — The task engine: one-time tasks, recurring routines with sectioned step tracking, sequential collections (ordered curriculum/lesson progressions with OCR image intake, per-student progress tracking, and deploy-to-new-student reuse — homeschool families will live in this feature), claimable opportunities (chore-board style with claim locks and timers), capped opportunities, assignments to multiple members, completion approval workflows, and rewards. Includes 13 task view frameworks (Simple List, Eisenhower Matrix, Eat the Frog, Kanban, and 9 more) auto-sorted by personal usage frequency. Task Breaker AI decomposes tasks into subtasks at three detail levels (including image input). Focus Timer (Pomodoro) logs time to Activity Log.

*Connects to:* Central workhorse of the platform. ← Receives from PRD-08 (Notepad routing), PRD-17B (MindSweep auto-routing), PRD-16 (Meeting action items), PRD-23 (BookShelf action steps), PRD-09B (List item promotion), PRD-15 (Member requests). → Feeds completions into PRD-11 (Victory Recorder), PRD-14/14C (Dashboard/Family Overview), PRD-28 (Allowance calculations), PRD-24 (Gamification XP). → Sequential collection progress feeds into PRD-28B (Compliance Reporting).

---

**PRD-09B · Lists, Studio & Templates** — Six list types (shopping with quantities/sections, wishlist with URLs/prices, packing with progress bars, expenses, to-do, custom) plus Randomizer lists (draw items with animation, assign to child as task) and SODAS guided decision forms (mom fills Situation, assigns to child, child completes Options-Disadvantages-Advantages-Solution sections with optional LiLa assistance). Studio is the template workshop — browse blank template formats across every category, customize, and deploy. Templates span tasks, routines, opportunities, sequential collections, lists, and future categories (trackers, widgets, gamification).

*Connects to:* ← Receives items from PRD-08 (Notepad "Send to Lists" routing). → List items promote to PRD-09A (Tasks) via promotion button. → Studio templates deploy into PRD-09A (Tasks) and Lists. → Completed lists can trigger PRD-11 (Victory Recorder). Also houses the Backburner (see below).

---

**Backburner (Feature Addendum, lives on PRD-09B schema)** — A system-provided "not now, but not never" parking lot list, one per member, auto-created on account setup. Cannot be deleted or renamed. AI auto-categorizes incoming items into six dynamic sections (goals & growth, projects & plans, tasks & todos, ideas & inspiration, family & relationships, unsorted) using Haiku with 70% confidence threshold. Monthly review integration via Rhythms provides the forcing function that prevents it from becoming an ideas graveyard. Release celebrations frame letting go as clarity, not failure.

*Connects to:* ← Receives from PRD-08 (Notepad RoutingStrip), PRD-17B (MindSweep auto-routes "someday/maybe" items here), PRD-16 (Meeting routing). → Activation paths route items to PRD-09A (Tasks), PRD-06 (Best Intentions/Guiding Stars), Studio Queue, or any RoutingStrip destination. ↔ PRD-18 (Rhythms) includes Backburner Review as a monthly section type with Sonnet-powered relevance highlighting.

---

**PRD-10 · Widgets, Trackers & Dashboard Layout** — Configurable dashboard widgets (weather, quick actions, streaks, countdowns, clock, and extensible widget types) and personal trackers (habit tracking, mood, custom metrics with flexible data types including boolean, numeric, scale, text, multi-select). Track This feature in QuickTasks strip for instant tracker creation. Cozy Journal vibe adds a decorative scrapbook layer. Dashboard layout engine: section/grid hybrid with drag-and-drop, visibility toggles, and folder grouping.

*Connects to:* → Tracker data feeds into PRD-14/14C (Dashboard/Family Overview display), PRD-18 (Rhythms content), PRD-11 (Victory Recorder — streak milestones). ← Widget templates come from PRD-09B (Studio). Layout engine consumed by PRD-14, PRD-25, PRD-26.

---

**PRD-11 · Victory Recorder & Daily Celebration** — The "ta-da list" — a celebration-only surface that records what was accomplished today. Never shows what wasn't done. The list is evidence; the celebration is the meaning layer. LiLa writes a daily celebration narrative that varies in tone and explicitly honors small steps for users with all-or-nothing thinking patterns (sincerity over enthusiasm).

*Connects to:* ← Receives completions from PRD-09A (Tasks), PRD-10 (Trackers — streak milestones), PRD-09B (Lists — list completion), PRD-23 (BookShelf — book completion), and manual entries. → Feeds into PRD-14 (Dashboard display), PRD-14C (Family Overview "Victories Recorded Today" row), PRD-11B (Family Celebration aggregation), PRD-37 (Family Feeds).

---

**PRD-11B · Family Celebration** — Extends Victory Recorder to the family level — shared celebrations, family milestones, and group acknowledgment moments. Trigger from Family Hub with celebration button.

*Connects to:* ← Aggregates from individual PRD-11 (Victory Recorders). → Surfaces in PRD-14D (Family Hub), PRD-37 (Family Feeds).

---

**PRD-12A · Personal LifeLantern** — A guided LiLa experience for articulating your personal vision, values, and life direction. Produces a living document that evolves over time through periodic revisiting. Follows the Honest Declarations philosophy.

*Connects to:* → Feeds declarations into PRD-06 (Guiding Stars). → Provides deep personal context to PRD-05 (LiLa) for coaching. → Reports pull from LifeLantern goals (PRD-28B).

---

**PRD-12B · Family Vision Quest** — The family-level version of LifeLantern — a LiLa-facilitated process for creating shared family vision, values, and identity statements.

*Connects to:* → Produces family-level Guiding Stars. → Family context feeds into PRD-05 (LiLa), PRD-14D (Family Hub display), PRD-13 (Archives).

---

## FAMILY COORDINATION

**PRD-13 · Archives** — The family knowledge base: structured master folders (Family Members, Projects, Recipes, Medical, etc.) plus user-created custom folders with subfolders and individual context items. Each item has a three-tier AI inclusion toggle (full/partial/excluded). LiLa Interview mode helps populate Archives through guided conversation. This is LiLa's long-term memory — the Optimizer, coaching modes, and personalization all pull from here via semantic search.

*Connects to:* → Primary context source for PRD-05 (LiLa) and PRD-05C (Optimizer). All features with AI integration pull from Archives during context assembly. ← Receives structured data from PRD-12B (Family Vision Quest), PRD-19 (Family Context interviews). Explicitly excludes PRD-20 (Safe Harbor) content.

---

**PRD-14 · Personal Dashboard** — Each member's home screen. Mom, Dad, and Independent Teens all get the full five-zone layout (PRD-04) with drag-and-drop section reorder, full widget CRUD, configurable layout, and a greeting with Guiding Stars declaration rotation. Mom additionally gets the perspective switcher (My Dashboard → Family Overview → Hub → View As). Day-one onboarding shows a warm welcome card and a single Victory widget so the space feels ready, not empty.

*Connects to:* Consumes data from nearly every feature: PRD-09A (Tasks), PRD-06 (Best Intentions), PRD-14B (Calendar), PRD-10 (Widgets/Trackers), PRD-11 (Victory Recorder). Layout engine from PRD-10. Shell-specific rendering from PRD-04.

---

**PRD-14B · Calendar** — Family calendar with per-member color coding, event creation (including LiLa-assisted natural language parsing), recurring events, and a shared family view with member filter pills.

*Connects to:* ← Receives events from PRD-08 (Notepad routing), PRD-17B (MindSweep auto-detection of dates), PRD-16 (Meeting scheduling), PRD-09A (Task due dates). → Displays in PRD-14 (Dashboard), PRD-14C (Family Overview "Today's Events" row). PRD-35 (Universal Scheduler) unifies its recurrence engine.

---

**PRD-14C · Family Overview** — Mom's bird's-eye view of selected family members in side-by-side columns — today's events, tasks, Best Intentions with tally, active trackers, weekly completion percentage, opportunities claimed, and victories recorded today. Mark-complete from this view writes to `task_completions` with `approved_by` set. Configurable: which members appear, column order, section order, per-section collapse states.

*Connects to:* ← Reads from PRD-09A (Tasks), PRD-14B (Calendar), PRD-06 (Best Intentions), PRD-10 (Trackers), PRD-11 (Victory Recorder). Uses PRD-03 (MemberPillSelector) shared component. PRD-02 (Permissions) controls dad's access scope.

---

**PRD-14D · Family Hub** — The shared family screen designed for a kitchen tablet or always-on display: announcements, today's schedule, family Best Intentions with tally buttons, celebration trigger, countdown widgets, and member quick-access (tap name → PIN → personal shell modal). Hub content is shell-independent — renders identically regardless of who's viewing.

*Connects to:* ← Aggregates from PRD-14B (Calendar), PRD-09A (Tasks), PRD-15 (Messages/announcements), PRD-11B (Family Celebration). → PRD-14E (TV Mode) displays the same data in a passive format.

---

**PRD-14E · Family Hub TV Mode** — Display-optimized version of the Hub for casting to a TV — large text, auto-rotating content sections, ambient family dashboard for passive viewing.

*Connects to:* ← Reads the same data as PRD-14D (Family Hub), formatted for large-screen passive display.

---

**PRD-15 · Messages, Requests & Notifications** — In-app messaging between family members, task/permission requests from kids (with accept/decline/snooze), and the unified notification system that alerts members about activity across all features. Every feature that involves cross-member interaction sends notifications through here.

*Connects to:* ← Every feature with cross-member interaction registers notification types here: PRD-09A (task assignments), PRD-17B (MindSweep cross-member routing), PRD-21C (comment replies), PRD-11B (celebrations), and many more. → Notifications surface in PRD-14 (Dashboard) and push to devices (PRD-33 post-MVP).

---

**PRD-16 · Meetings** — Structured family meeting facilitation with agenda templates, LiLa-guided discussion modes, action item capture during meetings, and meeting notes. Action items route through the Universal Queue to their destination features.

*Connects to:* → Action items route to PRD-09A (Tasks) via PRD-17 (Universal Queue). → Scheduled meetings create PRD-14B (Calendar) events. → Meeting notes can feed into PRD-13 (Archives). ← Agenda content can pull from PRD-06 (Best Intentions review) and Backburner.

---

**PRD-17 · Universal Queue & Routing System** — The central routing infrastructure: items from any source land in `studio_queue` with a destination flag, confidence level, and source metadata, then get processed into their target feature (Tasks, Lists, Calendar, Backburner, etc.). The RoutingStrip UI is the user-facing routing interface — a grid of destination tiles that appears in Notepad, Meeting action items, Review & Route, and other routing contexts. Each destination is a registered tile with an icon, label, and handler.

*Connects to:* The nervous system connecting all intake sources to all destination features. ← Receives from PRD-08 (Notepad), PRD-17B (MindSweep), PRD-16 (Meetings), PRD-05 (LiLa conversations). → Routes to PRD-09A (Tasks), PRD-09B (Lists), PRD-14B (Calendar), Backburner, and every other registered destination.

---

**PRD-17B · MindSweep** — AI-powered auto-sort mode layered on the Universal Queue. Dump everything on your mind (text, voice, forwarded emails, share-to-app), and LiLa classifies and routes items automatically. Three aggressiveness modes: "Always Ask" (suggest destinations, user confirms all), "Trust the Obvious" (auto-route high-confidence items, queue the rest), "Full Autopilot" (auto-route everything, user reviews after). Embedding-first intelligence via pgvector handles ~90% of routine items for near-free before any LLM call. Dedicated `/sweep` PWA entry point with home screen shortcut. Per-family email forwarding address for external intake. Projected cost ~$0.33/month typical family.

*Connects to:* ← Receives from PRD-08 (Notepad content), email forwarding, share-to-app (Web Share Target API). → Routes to PRD-09A (Tasks), PRD-09B (Lists), PRD-14B (Calendar), PRD-08 (Journal), Backburner, and everything in the RoutingStrip catalog. → PRD-18 (Rhythms) includes MindSweep Digest as a section type. Wires PRD-17's post-MVP "LiLa auto-routing" and "Smart defaults" stubs.

---

**PRD-18 · Rhythms & Reflections** — Structured morning, evening, weekly, monthly, and custom check-in flows built from a library of 28+ section types (gratitude prompt, task preview, victory summary, MindSweep digest, Backburner review, scripture/inspiration, journal prompt, weather, mood check-in, family prayer, and many more). Each rhythm is a configurable sequence of sections. Mom can build custom rhythms from the section library.

*Connects to:* ← Pulls content from nearly every feature for its sections: PRD-09A (Tasks — task preview), PRD-11 (Victories — victory summary), PRD-17B (MindSweep — digest), Backburner (monthly review), PRD-06 (Best Intentions), PRD-10 (Trackers), PRD-23 (BookShelf — reading prompts), PRD-14B (Calendar — today's events). → Reflections feed into PRD-08 (Journal entries).

---

**PRD-19 · Family Context & Relationships** — The relationship intelligence layer: tracks relationship dynamics between family members, monthly context aggregation and freshness review, LiLa-guided Family Context Interview mode for structured family knowledge gathering, and Full Picture Mediation mode for conflict resolution (invites curiosity about the other person's perspective — except when safety concerns are present). Safety concern protocol hands off to PRD-20 (Safe Harbor).

*Connects to:* → Feeds relationship context into PRD-05 (LiLa coaching). → Safety concerns route to PRD-20 (Safe Harbor). ← Receives interaction pattern data from across the platform. PRD-34 (ThoughtSift) Mediator extends this mediation beyond family relationships. Explicitly excludes Safe Harbor data from aggregation.

---

**PRD-20 · Safe Harbor** — A protected emotional space for teens and children to process difficult feelings with LiLa. Completely isolated by design: excluded from all aggregation, reporting, parent visibility, Archives, and context assembly (except safety concern protocol for immediate danger — Tier 3 crisis resources provided directly). Requires orientation completion and literacy assessment before access. Four guided modes: Safe Harbor, Safe Harbor Guided (child), Safe Harbor Orientation, Safe Harbor Literacy.

*Connects to:* Isolated by design — does NOT feed into any other feature. ← Receives handoffs from PRD-19 (relationship mediation safety concerns) and PRD-21 (Higgins coaching safety detection). → Connects to external crisis resources only. Content routed to Journal from Safe Harbor does NOT carry Safe Harbor exclusion flags — once in Journal, it's Journal content.

---

## COMMUNICATION & CONTENT

**PRD-21 · Communication & Relationship Tools** — Cyrano Me (LiLa helps draft messages to family members using relationship context and InnerWorkings), Higgins coaching (two modes: "Help Me Say Something" for drafting difficult conversations, "Help Me Navigate" for real-time relationship guidance), and the lean communication toolkit. Ethics auto-reject: force, coercion, manipulation, shame-based control, withholding affection.

*Connects to:* ← Feeds from PRD-07 (InnerWorkings) and PRD-19 (relationship context) for personalized coaching. Part of the PRD-21A (AI Vault) content offering. Safety concerns detected during coaching hand off to PRD-20 (Safe Harbor).

---

**PRD-21A · AI Vault: Browse & Content Delivery** — The member-facing AI tutorial and tool library: Netflix-style browsable categories, searchable, content cards with try-it-now functionality, progressive skill paths, bookmarks, progress tracking, and "Optimize with LiLa" integration. This is the front door — what attracts subscribers. The product IS the curriculum: the platform itself demonstrates what AI can do, and the Vault teaches moms how to do it themselves.

*Connects to:* → Content experience drives subscriptions (PRD-31). → Completed tutorials offered as PRD-11 (Victory Recorder) entries. → Personalized prompts can be shared to family member AI Toolboxes (PRD-21). ← PRD-05C (Optimizer) enhances prompts using family context. ← PRD-21B provides content. ← PRD-21C layers engagement on top.

---

**PRD-21B · AI Vault: Admin Content Management** — The backend for creating, organizing, publishing, and analyzing AI Vault content: rich content editor, tagging/categorization, scheduling, per-item analytics (views, hearts, satisfaction scores, session depth), and the content moderation pipeline stub (fully defined in PRD-21C).

*Connects to:* → Feeds published content into PRD-21A (Browse). → Moderation tab wired by PRD-21C. → Platform-level analytics feed into PRD-32 (Admin Console). Admin-only access via `staff_permissions`.

---

**PRD-21C · AI Vault: Engagement & Community** — The human layer on the Vault. Hearts (not likes — single engagement action with denormalized counts), threaded discussions on content items (unlimited thread depth, newest-first default, "@author" prefix threading), Haiku-based server-side comment moderation (approve/flag/reject pipeline), satisfaction signals ("Was this helpful?" after 60+ seconds of engagement), My Vault Activity (history, progress, most-used), recommendations engine (Recently Viewed, Popular in Category, Because You Liked X, New Since Last Visit), external sharing (formatted copy-to-clipboard pointing to landing page), and admin moderation dashboard (Flagged/Hidden/Reported/History tabs with Content Policy configuration). Community philosophy: "warm library, not social network" — no user profiles, no follower counts, no public activity feeds. Moms see display names in threads and heart counts on cards. Everything else lives behind the admin wall.

*Connects to:* ← Layers on top of PRD-21A (content cards and detail views). → Engagement data feeds into Platform Intelligence Pipeline. → Moderation dashboard lives in PRD-32 (Admin Console) shell. → Comment reply notifications through PRD-15.

> **Note:** PRD-21C currently specifies max thread depth of 3. This is overridden — threads should have unlimited depth. Flag during pre-build audit for PRD correction.

---

**Family+ Add-On (Future Tier Concept)** — ~$5/month add-on that gives teens (13+) access to AI Vault content that is not LiLa-related. Full Vault browse access by default; mom can restrict specific content. Teens can browse and use Vault content but do not participate in community discussions or conversations (those stay mom-only). Tier structure (own tier vs. add-on) deferred to post-beta.

*Connects to:* Extends PRD-21A (Vault Browse) access to teen accounts. Gated by PRD-02 (Permissions) and PRD-31 (Subscription Tier System). Strengthens ESA "educational software" positioning alongside PRD-28B (Compliance Reporting).

---

## KNOWLEDGE & THINKING

**PRD-23 · BookShelf** — Upload your own books (PDF/EPUB), and LiLa extracts summaries, principles & frameworks, declarations, action steps, and discussion questions across four extraction tabs. All extracted content is AI-paraphrased (never verbatim) except short attributed quotations in the Summaries tab. Three-layer ethics filter (Haiku gate → Sonnet scan → admin review). Discussion mode lets you talk through a book with LiLa. Book Knowledge Library uses extraction caching (user must upload their own copy). Five export formats: Markdown, plain text, DOCX, EPUB, PDF.

*Connects to:* → Declarations route to PRD-06 (Guiding Stars) with `source = 'bookshelf'`. → Insights feed into PRD-07 (InnerWorkings) as `source_type = 'content_extraction'`. → Action steps route to PRD-09A (Tasks). → Journal prompts ("Write About This") route to PRD-08 (Smart Notepad/Journal). → Book completion triggers PRD-11 (Victory Recorder). → Discussion insights available in PRD-18 (Rhythms) via semantic search. ← Wires Platform Intelligence Pipeline Channel E (Book Knowledge Library).

---

**PRD-34 · ThoughtSift — Decision & Thinking Tools** — A suite of five tools: Board of Directors (multi-persona advice panel with a shared three-tier persona library and Prayer Seat pattern — deities blocked as speaking personas), Perspective Shifter (archetypal lenses + family-context hypotheticals using real InnerWorkings data), Decision Guide (SODAS framework, pros/cons, weighted matrix, coin flip insight), Mediator (extends PRD-19's relationship mediation beyond family to any interpersonal situation), and Translator (fun rewrites: formal, pirate, Gen Z, medieval, etc.).

*Connects to:* ← Board of Directors and Perspective Shifter pull from PRD-07 (InnerWorkings), PRD-13 (Archives), PRD-19 (relationship context). ← Persona library infrastructure uses Platform Intelligence Pipeline v2 (Channel D). → Mediator extends PRD-19's `relationship_mediation` guided mode. Five new guided modes registered in PRD-05 (LiLa).

---

## GAMIFICATION

**PRD-24 · Gamification Overview & Foundation** — The gamification architecture: XP system, levels, badges, streaks, rewards framework, and the rules engine that ties game mechanics to real family activity. Celebration-only philosophy — no punishment mechanics, no shame, no guilt. XP accumulates but never decreases.

*Connects to:* ← Wraps around PRD-09A (Tasks — completion XP), PRD-10 (Trackers — streak XP), PRD-11 (Victory Recorder — celebration triggers). → Feeds into PRD-25/26 (Guided/Play Dashboards for prominent display). → PRD-28 (Allowance) can connect rewards to financial incentives.

---

**PRD-24A · Overlay Engine & Gamification Visuals** — The rendering system for gamification: how XP gains, level-ups, badge unlocks, and celebrations are visually displayed as overlays on top of any screen. Defines the overlay lifecycle (trigger → animate → dismiss) and game modes. Overlays sit above all content zones except modals.

*Connects to:* ← Consumes PRD-24 (Gamification) event data. → Renders across all shells with shell-appropriate styling. → Uses PRD-24B (Visual components) for reveal animations.

---

**PRD-24B · Gamification Visuals & Interactions** — The animation bible: eight Flat Reveal types organized as standalone interchangeable peer components (not hierarchically ordered). Four video-based reveals: treasure chest, gift box, cracking egg, slot machine. Four CSS/SVG interactive reveals: spinner wheel, three doors, card flip, scratch-off (Canvas with 60% auto-reveal threshold). Plus CSS flipbook with gold shimmer for evolution celebrations and Color-Reveal supporting 3–100 zones. Running PRD-24 family total: 17 new tables, 5 modified tables.

*Connects to:* Standalone visual components consumed by PRD-24A (Overlay Engine). Content pipeline: Nano Banana Pro for grid-based image generation, Hugging Face Image Cutter for slicing. Four open research tasks flagged before build (video AI tool for reveal containers, Color-Reveal SVG zone maps, matching line art versions, cracking egg flipbook frames).

---

## DASHBOARDS & SPECIALIZED VIEWS

**PRD-25 · Guided Dashboard** — Simplified dashboard for the Guided Child shell: larger touch targets, collapsible calendar (self-only filter), active tasks in two views only (Simple List and Now/Next/Optional), mom-arranged widget grid (child can reorder but not resize/delete/create), gamification progress indicator in header, warmer greeting tone with larger font, and bottom nav always visible. Section order and widget arrangement locked by mom.

*Connects to:* ← Consumes the same underlying data as PRD-14 (Personal Dashboard), presented through PRD-04's Guided shell layout. PRD-24/24A (Gamification) elements prominently featured.

---

**PRD-26 · Play Dashboard** — The most visual/game-like task surface for the Play Child shell: large colorful tiles instead of standard sections, icon-rich calendar with minimal text, tasks as one-tap-completion tiles with celebration animations, avatar-based greeting ("Hi [Name]!" with animated sparkle), "Today you have [X] things to do!" instead of declarations. Everything locked by mom — no edit mode.

*Connects to:* ← Same underlying data model (`dashboard_configs` table) as PRD-14, maximum gamification presentation via PRD-24/24A. PRD-04's Play shell layout with largest touch targets.

---

**PRD-27 · Caregiver Tools** — Limited-scope views for babysitters, grandparents, and other special adults: see assigned kids' schedules and tasks, mark tasks complete, add caregiver notes, view emergency info from Archives, record activity during shift. Mainly permission-based views built on PRD-02's special adult access model, not heavy new architecture.

*Connects to:* ← Reads from PRD-09A (Tasks — assigned kids' tasks), PRD-14B (Calendar — kids' schedules), PRD-13 (Archives — emergency info). → Writes caregiver notes and task completions. Shift tracking via PRD-02 (Permissions) special adult time-bounded access.

---

## TRACKING & COMPLIANCE

**PRD-28 · Tracking, Allowance & Financial** — Allowance pools per child, payment tracking, chore-to-payment linkage (percentage completion = percentage earned formula), and homeschool hour/subject tracking.

*Connects to:* ← Receives completion data from PRD-09A (Tasks — chore completions drive allowance calculations). ← PRD-24 (Gamification) rewards can connect to financial incentives. → Feeds into PRD-28B (Compliance Reporting — hours/subjects tracked).

---

**PRD-28B · Compliance & Progress Reporting** — Universal template-based reporting engine. Homeschool templates: 6 basic data export formats + 6 AI-enhanced report formats at Full Magic tier. SDS/disability monthly summary fully designed from founder's existing skill — configurable ISP goals, support needs, program language per family. Reports pull ISP goals + personal goals (Guiding Stars, Best Intentions, LifeLantern). ESA invoicing at ALL tiers. Standards Portfolio as a living view. Family Newsletter template. Templates stored as data in `report_templates` table (not code) — new templates added without deployment.

*Connects to:* ← Pulls from PRD-09A (Tasks — completion data), PRD-14B (Calendar — schedule data), PRD-10 (Trackers — progress data), PRD-06 (Guiding Stars/Best Intentions — goal data), PRD-12A (LifeLantern — personal goals), PRD-28 (hours/subjects tracked). Hybrid delivery for SDS: free AI Vault tool as community gift (pre-launch marketing) + seamless in-house reporting at Full Magic tier.

---

**PRD-37 · Family Feeds** — Private family social media: Family Life Feed (shared moments, photos, text updates across all families) + Homeschool Portfolio Feed tab (educational documentation, defaults to portfolio-only with opt-in to Family Feed). Out of Nest members (adult children who left home + their spouses/kids — NOT extended family) get a feed-first shell as their primary entry point. No stored video or audio — voice transcribed via Whisper with 30-day download window. Mom Bulk Summary: voice dump → LiLa sorts entries per-kid. Social media training ground for kids — safe family context for learning social sharing norms.

*Connects to:* ← Receives from all family activity. → Portfolio content feeds into PRD-28B (Compliance Reporting — evidence documentation). Build PRD-37 before PRD-28B (established dependency).

---

## PLATFORM & SCALE

**PRD-22 · Settings** — All user and family configuration: account management, notification preferences, theme/vibe selection, privacy controls, LiLa preferences, MindSweep settings (aggressiveness mode, always-review rules, email forwarding, allowed senders, share-to-app toggle, digest preferences), and per-feature configuration sections.

*Connects to:* Touches every feature that has configurable behavior. ← PRD-17B (MindSweep) adds its settings section. ← PRD-21C adds analytics opt-in. Configuration changes propagate to all consuming features.

---

**PRD-29 · Project Planner** — Long-term goal and project management with milestones, phases, progress tracking, and decomposition into actionable tasks. References StewardShip's Rigging pattern as logic reference.

*Connects to:* → Decomposes into PRD-09A (Tasks) via `related_plan_id` foreign key. → Milestones can create PRD-14B (Calendar) events.

---

**PRD-30 · Safety Monitoring** — Invisible monitoring tools for concerning online or behavioral patterns. Not visible to monitored members. Mom-only alerts and reporting.

*Connects to:* ← Reads from platform activity patterns. → Alerts mom via PRD-15 (Notifications). Separate from PRD-20 (Safe Harbor), which is user-initiated.

---

**PRD-31 · Subscription Tier System** — Stripe integration, tier gating configuration that activates the `useCanAccess()` hooks every feature already has wired (all return true during beta), Founding Families beta program with lifetime special pricing, and tier management UI.

*Connects to:* Activates the gate hooks in every feature. ← PRD-02 (Permissions) provides the `feature_access` infrastructure. → PRD-21A (AI Vault) is the front-door revenue driver. Family+ add-on (future) layers on top.

---

**PRD-32 · Admin Console (System/Platform)** — System-level administration: user/family management, platform analytics, content moderation (wired from PRD-21C), and the Feedback & Bug Reporting system with three user-facing channels (Request a Feature, Report a Glitch with screenshot/diagnostics, Tell Us Something Nice) plus admin dashboard with auto-triage, Claude Code diagnostic pipeline, solution routing back to LiLa Help, and sentiment filter on abusive submissions.

*Connects to:* ← PRD-21B/21C (Vault admin and moderation). ← Platform Intelligence Pipeline feeds analytics. ← All features feed usage data. → Bug solutions route back to PRD-05 (LiLa Help mode).

---

**PRD-33 · Offline / PWA** — IndexedDB sync engine, service worker, offline capture queue (handles voice blobs, text, and image attachments with sync-on-connectivity), and progressive web app configuration. Includes MindSweep's `/sweep` PWA entry point with its own web manifest, and Web Share Target API registration for share-to-app functionality.

*Connects to:* Infrastructure layer enabling offline use of PRD-09A (Tasks), PRD-08 (Notepad), PRD-17B (MindSweep capture), and other key features. ← PRD-17B defines the `/sweep` manifest requirements.

---

**PRD-35 · Universal Scheduler** — Cross-feature scheduling engine that unifies recurring tasks, routine timing, calendar event recurrence, and rhythm scheduling into a single system rather than each feature implementing its own recurrence logic.

*Connects to:* ← Serves PRD-09A (Tasks — recurring tasks/routines), PRD-14B (Calendar — event recurrence), PRD-18 (Rhythms — rhythm scheduling).

---

**PRD-36 · Universal Timer** — Shared timer component usable across features: focus/Pomodoro timers, cooking timers, task timers, meeting timers, with configurable alerts and session logging.

*Connects to:* Available in PRD-09A (Tasks — Focus Timer/Pomodoro), PRD-16 (Meetings — meeting timer), and as a PRD-10 (Dashboard widget).

---

## INTELLIGENCE INFRASTRUCTURE (Cross-Cutting Systems)

These are not standalone PRDs but documented architectural systems that multiple features depend on.

**Semantic Context Infrastructure** — pgvector with halfvec(1536) embeddings on five core tables (`archive_context_items`, `best_intentions`, `self_knowledge`, `guiding_stars`, `journal_entries`), async pgmq queue for background embedding generation, and the embedding pipeline (OpenAI text-embedding-3-small). Embedding triggers fire on content column changes only (not metadata). HNSW indexes for fast similarity search. Cost: <$0.01/family/month, saves ~$0.21/month by enabling near-free semantic classification before any LLM call. Additional embeddable tables added by BookShelf (`bookshelf_chunks` + five extraction tables) and MindSweep.

*Connects to:* Consumed by PRD-05 (LiLa context assembly), PRD-17B (MindSweep embedding-first classification), PRD-17 (Universal Queue smart routing), and any feature performing semantic search or auto-classification.

---

**AI Cost Optimization Patterns (P1–P9)** — Nine documented patterns applied across all AI-touching features: P1 (embedding-based semantic context assembly), P2 (embedding-based auto-tagging replacing Haiku calls — saves ~$0.45/mo), P3–P4 (tiered model routing), P5 (on-demand secondary output via action chips — never auto-generate extras), P6–P8 (caching and deduplication), P9 (per-turn semantic context refresh for guided modes). Total estimated savings ~$1.30/family/month → AI costs ~$0.20/family.

*Connects to:* Applied inside every feature with AI integration. Referenced in every PRD's AI Integration section.

---

**Platform Intelligence Pipeline v2** — Twelve capture channels (A–L) feeding a self-improving flywheel in the `platform_intelligence` schema: content effectiveness signals, AI quality feedback, usage patterns, engagement metrics, persona library data, and more. Each feature PRD notes which channels it wires during build. Replaces v1.

*Connects to:* ← Every feature feeds usage data into its assigned channels. → Feeds into PRD-32 (Admin Console analytics), PRD-21C (content recommendations), and PRD-34 (ThoughtSift persona library — Channel D).

---

## QUALITY ASSURANCE & BUILD PROCESS

**Testing & QA Architecture (Four-Layer Strategy)** — The complete quality assurance system ensuring nothing breaks as the platform is built:

- **Layer 1: TDD Test Suite (Every Build Phase)** — Automated tests generated from PRDs using Vitest + Supabase test helpers, grown with every build phase. Tests are the spec expressed as code — written before or alongside implementation, never after. Covers regressions, permission violations, routing errors, convention drift (no hardcoded colors, missing PermissionGate, wrong icons), and wiring breaks. The Opus audit generates the foundational test suite from PRDs before any application code exists.
- **Layer 2: Playwright Integration Tests (Milestone Builds)** — Real browser tests running as each role (mom, dad, teen, guided child, play child, caregiver, Hub), navigating features, verifying permission gates in live UI, shell rendering, responsive behavior at all breakpoints, and accessibility. Runs every 5–8 build phases. Screenshot comparison for visual regression.
- **Layer 3: Agent Teams QA (Major Milestones)** — AI agents roleplaying each shell, cross-checking wiring and logic at a reasoning level automated tests can't reach. One team lead + shell-specific teammates, each seeded with their shell's specs from QA-SHELLS.md. Catches subtle integration issues, cross-shell inconsistencies, and logic gaps. Runs 3–4 times during the entire build (after foundation, mid-build, pre-beta). Token-expensive (3–4x normal session cost).
- **Layer 4: Human Testing (Tenise)** — Focuses entirely on experience quality: theme aesthetics, vibe feel, UX flow, emotional tone, content quality, dark mode aesthetics, mobile feel, and gamification delight. Layers 1–3 handle all mechanical verification so human testing time is spent on judgment calls only a human can make.

*Connects to:* QA-SHELLS.md manifest tracks per-shell verification checks for every feature, growing with each build phase. Build Phase Test Mapping table generated during Opus audit keys specific tests to specific build phases.

---

**Pre-Build Setup Checklist (12-Step Bridge)** — Everything that happens between "all PRDs done" and "first line of code":

1. **PRD Consistency Audit** — Load all PRDs + addenda into VS Code with Claude Code Opus at 1M context. Comprehensive sweep for database column conflicts, RLS pattern consistency, stub registry completeness, circular dependencies, shell behavior table completeness, feature key registration, tier gating consistency, naming convention compliance, embedding column completeness, AI optimization pattern references, Platform Intelligence channel wiring, and Cross-PRD Impact Addendum completeness. Edit PRD files directly — fix issues, don't just list them. Also generates foundational test suite (Layer 1), Playwright scaffolds (Layer 2), and QA-SHELLS.md (Layer 3).
2. **Install Developer Tools** — AURI security scanner (Endor Labs MCP) + mgrep for fast codebase search.
3. **Initialize Repository** — Vite + React 19 + TypeScript + Supabase scaffolding.
4. **Scaffolding** — Project structure, Vitest/Playwright configuration, test scripts in package.json.
5. **Compile CLAUDE.md** — Merge all PRD-specific CLAUDE.md additions into the master conventions file.
6. **Generate DATABASE_SCHEMA.md** — Master schema document from all PRD table definitions.
7. **Create QA-SHELLS.md** — Per-shell verification manifest from Opus audit output.
8. **Generate Build Phase Test Mapping** — Which tests belong to which build phase.
9. **Create BUILD_STATUS.md** — Phase tracking document.
10. **Update System Overview** — PRD index with build phase assignments.
11. **Git Commit** — Clean baseline before any feature code.
12. **Final Verification** — All tools installed, all docs generated, all tests runnable (failing against empty app is expected and correct — this IS TDD).

*Connects to:* Consumes every PRD and addendum. Produces the foundational documents that every build phase references: CLAUDE.md, DATABASE_SCHEMA.md, QA-SHELLS.md, Build Phase Test Mapping, BUILD_STATUS.md.

---

## CROSS-CUTTING DESIGN PHILOSOPHIES

These aren't features but documented principles that shape how every feature behaves.

**The Art of Honest Declarations** — Declarations must be statements every fiber of a person's being can affirm as true in the present moment. Five honest declaration categories: Choosing and Committing, Recognizing and Awakening, Claiming and Stepping Into, Learning and Striving, Resolute and Unashamed. Direct constructions preferred ("I choose" not "I am choosing"). Applied in PRD-06 (Guiding Stars), PRD-12A (LifeLantern), PRD-12B (Family Vision Quest), and PRD-23 (BookShelf declaration extraction).

**External Tool Generation & Context Update Loop** — The pattern for generating content with external AI tools (Manus, Midjourney, etc.) and feeding results back into the MyAIM context. Defines the handoff protocol: Claude prepares prompts and batch specs → external tool executes → results upload to VS Code via Claude Code → context updated. Used for gamification visual assets, AI Vault content generation, and marketing materials.

**Human-in-the-Mix** — Every AI output goes through Edit/Approve/Regenerate/Reject before saving anywhere. This is both a UX principle (users review before committing) and a legal liability shield (accuracy responsibility rests with the user, not the AI). Applied universally across all LiLa interactions.

**Celebration-Only Philosophy** — Victory Recorder never shows what wasn't done. Gamification never punishes. Release celebrations frame letting go as clarity. Sincerity over enthusiasm in celebration narratives.

**Values-Aware Processing** — LiLa reflects the family's established faith and values framework (configured in Archives). FaithAware system uses each tradition's own terminology and self-definitions. Never conflates traditions. Processing partner, not companion.

---

## SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| **PRDs Written** | 45 | Complete |
| **Addenda Written** | 24+ | Complete |
| **Remaining PRDs** | 5 | PRD-29, 30, 31, 32, 33 |
| **Side Quests** | ~11 | Deferred |
| **Cross-Cutting Docs** | 6+ | Complete |
| **Pre-Build Audit** | Planned | After remaining PRDs |
| **Target Launch** | Mid-June 2026 | |

---

*This glossary reflects all decisions made through March 19, 2026. When this document conflicts with individual PRDs, the PRDs are authoritative for implementation details. This document is for orientation and quick reference.*
