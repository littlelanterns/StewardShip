export function getAppGuideContext(): string {
  return `
APP NAVIGATION GUIDE — Use this to help the user find and use features.

NAVIGATION: The bottom tab bar has 5 icons (left to right):
- Crow's Nest (grid/dashboard icon) — Your daily overview dashboard. Cards appear for active features (tasks, victories, streaks, goals, journal snapshots). Cards only show when they have data. Tap any card to jump to that feature.
- Compass (compass icon) — Your task manager. Tap + to add tasks. Toggle between "Tasks" and "Lists" tabs at the top. Multiple task views available via the view toggle: Simple List, By Category, Eisenhower Matrix, Eat the Frog, One-Three-Nine, Big Rocks, Ivy Lee. Each view organizes the same tasks differently. Swipe or use task detail to complete, edit, or archive tasks.
- Helm (message/chat icon, center) — Your AI conversation partner. Tap to open the chat drawer from any page. The AI knows your principles, personality, tasks, journal, relationships, and more — it loads relevant context automatically based on what you're discussing. You can also open the full Helm page for longer conversations.
- Log (book icon) — Your journal and universal inbox. Tap + to create an entry. Supports journal entries, gratitude, reflections, quick notes, meeting notes, and voice recordings (tap the microphone icon). After saving, you can route entries to other features (create a task, save to Mast, flag as victory, etc.). Search entries with the search icon. Filter by type or life area.
- More (menu/three-lines icon) — Opens the full feature menu organized by category.

FEATURES IN THE MORE MENU:

Progress section:
- Charts — Track progress with task completion rates, active streaks, goal progress, victory summaries, and journal activity. Create custom trackers (count, yes/no, or scale type) to track anything daily.
- Victories — Record and celebrate accomplishments. The AI generates identity-based celebration text connecting your wins to your principles.

Identity section:
- Mast — Your guiding principles, values, declarations, faith foundations, scriptures/quotes, and vision statements. The AI references these in every conversation. Tap + to add, or use "Craft at Helm" for AI-guided writing. Drag to reorder.
- Keel — Your self-knowledge: personality assessments, traits, strengths, growth areas, and professional self-knowledge. Three ways to add: write manually, upload a file (like personality test results), or discover through AI conversation.
- Wheel — A structured 6-spoke change process for deep character/identity transformation. Start by describing what you want to change, then work through spokes: Why, When, Self-Inventory, Support, Evidence, Becoming. Periodic Rim check-ins assess progress. Start from the Wheel page or via guided conversation at the Helm.
- Life Inventory — Assess where you are across life areas (spiritual, marriage, family, health, career, financial, etc.). Each area tracks baseline, current state, and vision. Start an assessment conversation at the Helm.

Planning section:
- Unload the Hold — Brain dump tool. Pour out everything on your mind, then the AI sorts and triages items into tasks, journal entries, insights, reminders, etc. Review and route each item to the right place.
- Rigging — Planning tool for goals and projects bigger than a single task. Create plans conversationally at the Helm — the AI selects from 5 planning frameworks (MoSCoW, Backward Planning, Milestone Mapping, Obstacle Pre-mortem, 10-10-10). Plans have milestones that can be broken into Compass tasks. You can also create plans manually.
- Lists — Lightweight collections (shopping, wishlists, expenses, to-do, custom). Not tracked in Charts or goals. Also accessible via the Tasks/Lists toggle on Compass.
- Meetings — Structured recurring meeting frameworks guided by AI. Types: Couple, Parent-Child Mentor, Weekly Review, Monthly Review, Business Review, and custom templates. The AI walks through an agenda and captures action items.

Relationships section:
- First Mate — Your spouse/partner profile (only visible if relationship status is married or dating). Store insights about your partner by category. Includes the Marriage Toolbox with 6 guided modes: Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude, and Cyrano Me (communication coaching). Spouse prompts appear as gentle reminders.
- Crew — Your people directory. Add important people with relationship type, notes, and optional rich context. The AI recognizes crew member names in conversation and loads their context automatically. Use Higgins (the GraduationCap icon) on any crew member's detail page for communication coaching — choose "Help me say something" for word crafting or "Help me navigate a situation" for relational processing. You can also tap the GraduationCap icon on the main Crew page toolbar to select one or more people and launch Higgins.

Daily Rhythms section:
- Reveille — Morning briefing. Shows today's tasks, upcoming deadlines, active streaks, a Mast thought, and gentle prompts. Set your preferred time in Settings.
- Reckoning — Evening review. Reflects on the day's accomplishments, carries forward incomplete tasks, celebrates milestones, and offers gratitude/reflection prompts. Set your preferred time in Settings.

Resources section:
- Safe Harbor — A supportive AI mode for processing stress, overwhelm, or difficult emotions. The AI focuses on validation first, frameworks second, action third. Accessible from the Safe Harbor page or by telling the Helm you're struggling.
- Manifest — Your personal knowledge base. Upload books, articles, notes (PDF, EPUB, DOCX, TXT, MD). The system chunks and embeds content for AI retrieval. When you discuss topics at the Helm, relevant passages from your uploads are automatically surfaced. Use "Discuss This" for deep item exploration or "Ask Your Library" for cross-source queries.

Settings (bottom of menu):
- Account: Display name, email, password, gender, relationship status, appearance/theme switching.
- AI Configuration: API key, model selection, response length ("Response Length" slider), context depth.
- Daily Rhythms: Enable/disable and set times for Reveille and Reckoning.
- Notifications: Push notification preferences and quiet hours.
- Rhythms: Enable/disable Friday Overview, Sunday Reflection, Monthly Review, Quarterly Inventory cadences.
- Meeting Schedules: Manage recurring meeting schedules.
- Compass: Set default task view.
- Data & Privacy: Export all data (ZIP), export journal as PDF, delete account.
- Feature Guides: Toggle the helpful tips on each feature page, or reset dismissed guides.

COMMON QUESTIONS:
- "How do I start a plan?" — Go to More menu > Rigging, then tap + to create a plan with AI guidance, or tap the manual option to build one yourself.
- "How do I track a habit?" — Go to More menu > Charts, tap "Add Tracker", choose a type (count, yes/no, or scale), and name your habit.
- "Where are my journal entries?" — Tap the Log icon (book) in the bottom nav. Use the search icon and filters to find specific entries.
- "How do I change my AI model?" — Settings > AI Configuration > Model selector.
- "Can I use the app without AI?" — Yes. Tasks, journaling, principles, tracking, planning, and people management all work without AI. The Helm conversations and guided processes need an AI API key.
- "How do I add my spouse?" — Go to More menu > First Mate. Follow the setup flow. (Only appears if your relationship status is married or dating — set this in Settings > Account.)
- "What's the difference between Compass and Rigging?" — Compass is for individual tasks and daily to-dos. Rigging is for larger projects with milestones over time. Rigging milestones can be broken into Compass tasks via Task Breaker.
- "How do I upload a book?" — Go to More menu > Manifest, tap + to upload. Supports PDF, EPUB, DOCX, TXT, and MD files.
- "What's the difference between Log, Helm, and Unload the Hold?" — The Log is for journaling and capturing thoughts. The Helm is for AI conversations about anything. Unload the Hold is specifically for brain dumps — pour everything out, then the AI sorts it into actionable categories.
- "How do all these features connect?" — Your Mast (principles) informs every AI conversation. Your Keel (self-knowledge) personalizes advice. Tasks live in Compass, plans in Rigging. The Wheel tracks deep change. The Log captures everything. Charts visualize progress. The Helm ties it all together through conversation.
- "What should I do first?" — Start with the Mast — write a few guiding principles. Then try adding some tasks to the Compass. Journal in the Log. The features build on each other over time.
- "How do I record a voice entry?" — In the Log or the Helm, tap the microphone icon. Record your message, and it will be transcribed to text for you to review before saving/sending.
- "How do I get the Sphere of Influence view?" — Go to More menu > Crew, then toggle to "By Sphere" view at the top of the page. Assign people to spheres from their detail page.
- "How do I use Higgins?" — Go to More menu > Crew, open a crew member's profile, then tap the GraduationCap icon. Choose "Help me say something" or "Help me navigate a situation." You can also tap the GraduationCap icon on the main Crew page toolbar to select multiple people.
- "Do my settings save automatically?" — Yes. All settings save instantly when changed. You'll see a brief "Saved" confirmation appear next to each field.
`;
}
