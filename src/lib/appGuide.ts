export function getAppGuideContext(): string {
  return `
APP NAVIGATION GUIDE — Use this to help the user find and use features.

NAVIGATION: The bottom tab bar has 5 icons (left to right):
- Crow's Nest (dashboard icon) — Your daily overview dashboard. Cards appear for active features (tasks, victories, streaks, goals, journal snapshots). Cards only show when they have data. Tap any card to jump to that feature.
- Compass (compass icon) — Your task manager. Tap + to add tasks. Multiple task views available via the view toggle: Simple List, By Category, Eisenhower Matrix, Eat the Frog, One-Three-Nine, Big Rocks, Ivy Lee. Each view organizes the same tasks differently. A "View Lists" link navigates to the standalone Lists page. Swipe or use task detail to complete, edit, or archive tasks.
- Library (center, with arc menu) — Expands to show three shortcuts: Manifest (book management and uploads), Extractions (browse all extracted content across books), and Favorites (your hearted highlights).
- Journal (book icon) — Your journal and universal inbox. Tap + to create an entry. Supports journal entries, gratitude, reflections, quick notes, commonplace book observations, kid quips, meeting notes, and voice recordings (tap the microphone icon). After saving, you can route entries to other features (create a task, save to Mast, flag as an accomplishment, etc.). Search entries with the search icon. Filter by type or life area.
- More (menu icon) — Opens the full feature menu organized by category.

FEATURES IN THE MORE MENU (organized by section):

Identity section:
- Mast — Your guiding principles, values, declarations, faith foundations, scriptures/quotes, and vision statements. The AI references these in every conversation. Tap + to add, or use "Craft at Helm" for AI-guided writing. Drag to reorder. Bulk add supported.
- Keel — Your self-knowledge: personality assessments, traits, strengths, growth areas, and professional self-knowledge. Three ways to add: write manually, upload a file (like personality test results), or discover through AI conversation. Bulk add supported.
- Wheel — A structured 6-spoke change process for deep character/identity transformation. Start by describing what you want to change, then work through spokes: Why, When, Self-Inventory, Support, Evidence, Becoming. Periodic Rim check-ins assess progress. Start from the Wheel page or via guided conversation at the Helm.
- Life Inventory — Assess where you are across life areas (spiritual, marriage, family, health, career, financial, etc.). Each area tracks baseline, current state, and vision. Start an assessment conversation at the Helm.

Relationships section:
- First Mate — Your spouse/partner profile (only visible if relationship status is married or dating). Store insights about your partner by category. Includes the Marriage Toolbox with 6 guided modes: Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude, and Cyrano Me (communication coaching). Spouse prompts (Ask Them, Reflect, Express) generate AI-tailored prompts for connecting with your partner. Bulk add supported.
- Crew — Your people directory. Add important people with relationship type, notes, and optional rich context. The AI recognizes crew member names in conversation and loads their context automatically. Use Higgins (the GraduationCap icon) on any crew member's detail page for communication coaching — choose "Help me say something" for word crafting or "Help me navigate a situation" for relational processing. You can also tap the GraduationCap icon on the main Crew page toolbar to select one or more people and launch Higgins. Toggle "By Sphere" view to see your Sphere of Influence. Bulk add supported.

Planning section:
- The Hatch — Universal capture tool. A right-side drawer where you can jot down or voice-record anything without deciding where it goes first. Create multiple tabs to work on different thoughts. When ready, tap "Send to..." to route content to any feature: Journal, Compass, Lists, Victory, Keel, Mast, Note, Meeting Agenda, or Charts. Tap "Review & Route" for AI-powered extraction that scans your content and presents individual items as cards with suggested destinations. "Edit in Hatch" is available on Helm conversations — send AI content to The Hatch for editing before it enters your permanent record. Voice capture uses the same microphone button as the Helm and Journal. Full-page mode available at /hatch for longer editing. History tracks all routed and archived tabs. Configurable in Settings > The Hatch.
- Unload the Hold — Brain dump tool. Pour out everything on your mind, then the AI sorts and triages items into tasks, journal entries, insights, reminders, etc. Review and route each item to the right place.
- Rigging — Planning tool for goals and projects bigger than a single task. Two tabs: Plans and Priorities. Plans: Create plans conversationally at the Helm — the AI selects from 5 planning frameworks (MoSCoW, Backward Planning, Milestone Mapping, Obstacle Pre-mortem, 10-10-10). Plans have milestones that can be broken into Compass tasks. You can also create plans manually or use Sprint Import for bulk milestone entry. Priorities: Organize your commitments into tiers — Committed Now (max 7), Committed Later, Interested, and Achieved. Keeps you focused on what matters most.
- Lists — Standalone page for lightweight collections. List types: shopping, wishlist, expenses, to-do, someday (mental parking lot), custom, and routine (checklists that auto-reset on a schedule). Features include: sub-items (one level deep), bulk add with AI sorting, drag reorder, per-item "Send to Compass" action, and optional victory-on-complete (sparkle animation when checking off items). Routine lists track streaks and can be assigned to appear as cards in Compass views. Accessible from the More menu or the "View Lists" link on Compass.
- Meetings — Structured recurring meeting frameworks guided by AI. Types: Couple, Parent-Child, Family Council, Mentor, Weekly Review, Monthly Review, Quarterly Inventory, Business Review, and custom templates. The AI walks through an agenda and captures action items. Features include: agenda items between meetings (jot down topics to discuss next time), customizable agenda sections per meeting type, and mentor meetings with person-specific custom titles.

Progress section:
- Charts — Track progress with task completion rates, active streaks, goal progress, victory summaries, and journal activity. Create custom trackers (count, yes/no, or scale type) to track anything daily.
- Victories — Record and celebrate accomplishments. Every completed task is an accomplishment. Record extra victories manually for wins outside your task list. Use "Celebrate this!" to generate an AI narrative for any time period's collection of accomplishments. Bulk add supported.

Daily Rhythms section:
- Reveille — Morning briefing. Shows today's tasks, upcoming deadlines, active streaks, a Mast thought, and gentle prompts. Set your preferred time in Settings.
- Reckoning — Evening review. Reflects on the day's accomplishments, carries forward incomplete tasks, celebrates milestones, and offers gratitude/reflection prompts. Set your preferred time in Settings.

Library section:
- Manifest — Your personal library. Upload books, articles, and documents (PDF, EPUB, DOCX, TXT, MD). The system processes, chunks, and embeds content for AI retrieval. Assign genres to guide extraction. Use "Extract" to produce four tabs of curated content: Summary (key concepts, stories, quotes), Frameworks (actionable principles for the AI), Action Steps (exercises and practices), and Mast Content (honest commitment declarations). Heart your favorites across all tabs. Discuss books with the AI via "Discuss Book" — supports multi-book synthesis and audience adaptation (personal, family, teen, spouse, children). Apply section lets you generate goals, questions, tasks, or trackers from any book.
- Extractions — Browse all extracted content across your books. Three view modes: by tab (content type), by chapter, or notes only (items you've annotated). Heart, edit inline, add personal notes, and send items to Compass or Mast.
- Favorites — Everything you've hearted across all books in one place. Export as .md, .docx, or .txt.

Resources section:
- Safe Harbor — A supportive AI mode for processing stress, overwhelm, or difficult emotions. The AI focuses on validation first, frameworks second, action third. Accessible from the Safe Harbor page or by telling the Helm you're struggling.
- Reflect — Daily reflection practice with rotating questions. Answer a question each day to build self-awareness. Route responses to Journal or flag as accomplishments. Manage your question list, add custom questions, and review past reflections by date. Integrations with Reckoning, Crow's Nest, and Life Inventory.
- Helm — Full-page AI conversation. Same as the pull-up drawer but in full screen for longer sessions.
- Reports — Generate progress reports across any time period: today, this week, this month, last month, or custom date range. Choose which sections to include (tasks, journal entries, victories, goals, streaks, routines, reflections). Preview inline, then export as PDF or Markdown.
- Activity Log — A read-only timeline of everything that happens across your voyage. Tasks completed, victories recorded, journal entries created, meetings held — all in one chronological feed. Tap any event to jump to its source.

Settings (bottom of menu):
- Account: Display name, email, password, gender, relationship status, appearance (theme switching between Captain's Quarters, Deep Waters, and Hearthstone themes, plus font scale for accessibility).
- Daily Rhythms: Enable/disable and set times for Reveille and Reckoning.
- Notifications: Push notification preferences and quiet hours.
- Rhythms: Enable/disable Friday Overview, Sunday Reflection, Monthly Review, Quarterly Inventory cadences.
- Meeting Schedules: Manage recurring meeting schedules.
- The Hatch: Configure Hatch behavior and preferences.
- Compass: Set default task view.
- Data & Privacy: Export all data (ZIP), export journal as PDF, delete account.
- BYOK (Bring Your Own Key): AI API key configuration and model selection.

COMMON QUESTIONS:
- "How do I start a plan?" — Go to More menu > Rigging, then tap + to create a plan with AI guidance, or tap the manual option to build one yourself.
- "How do I set priorities?" — Go to More menu > Rigging, switch to the Priorities tab, then add what you're committed to or interested in pursuing.
- "How do I track a habit?" — Go to More menu > Charts, tap "Add Tracker", choose a type (count, yes/no, or scale), and name your habit.
- "Where are my journal entries?" — Tap the Journal icon (book) in the bottom nav. Use the search icon and filters to find specific entries.
- "How do I change my AI model?" — Settings > BYOK (Bring Your Own Key).
- "Can I use the app without AI?" — Yes. Tasks, journaling, principles, tracking, planning, and people management all work without AI. The Helm conversations and guided processes need an AI API key.
- "How do I add my spouse?" — Go to More menu > First Mate. Follow the setup flow. (Only appears if your relationship status is married or dating — set this in Settings > Account.)
- "What's the difference between Compass and Rigging?" — Compass is for individual tasks and daily to-dos. Rigging is for larger projects with milestones over time. Rigging milestones can be broken into Compass tasks via Task Breaker.
- "How do I upload a book?" — Go to Library > Manifest (via bottom nav center button or More menu), tap + to upload. Supports PDF, EPUB, DOCX, TXT, and MD files. After processing, use "Extract" to pull out summaries, frameworks, action steps, and declarations.
- "How do I discuss a book with the AI?" — Open a book in the Manifest, then tap "Discuss Book." You can also select multiple books from the Manifest page and discuss them together. Choose an audience (personal, family, teen, etc.) to adapt the conversation.
- "What's the difference between Journal, Helm, and Unload the Hold?" — The Journal is for journaling and capturing thoughts. The Helm is for AI conversations about anything. Unload the Hold is specifically for brain dumps — pour everything out, then the AI sorts it into actionable categories.
- "How do all these features connect?" — Your Mast (principles) informs every AI conversation. Your Keel (self-knowledge) personalizes advice. Tasks live in Compass, plans and priorities in Rigging. The Wheel tracks deep change. The Journal captures everything. Charts visualize progress. The Helm ties it all together through conversation.
- "What should I do first?" — Start with the Mast — write a few guiding principles. Then try adding some tasks to the Compass. Journal in the Journal. The features build on each other over time.
- "How do I record a voice entry?" — In the Journal or the Helm, tap the microphone icon. Record your message, and it will be transcribed to text for you to review before saving/sending.
- "How do I get the Sphere of Influence view?" — Go to More menu > Crew, then toggle to "By Sphere" view at the top of the page. Assign people to spheres from their detail page.
- "How do I use Higgins?" — Go to More menu > Crew, open a crew member's profile, then tap the GraduationCap icon. Choose "Help me say something" or "Help me navigate a situation." You can also tap the GraduationCap icon on the main Crew page toolbar to select multiple people.
- "Do my settings save automatically?" — Yes. All settings save instantly when changed. You'll see a brief "Saved" confirmation appear next to each field.
- "How do I change the app's appearance?" — Settings > Account > Appearance. Choose from three themes (Captain's Quarters, Deep Waters, Hearthstone) and three font sizes (Default, Large, Extra Large).
- "What are Lists vs Tasks?" — Tasks (in Compass) are tracked items with due dates, priorities, and framework views. Lists (standalone page) are lightweight collections — shopping, wishlists, routines, someday items — not tracked in Charts or goals.
- "How do I create a routine?" — Go to Lists (More menu > Lists), create a new list, choose "Routine" as the type, set a reset schedule (daily, weekdays, weekly, custom). The routine auto-resets and tracks streaks.
`;
}
