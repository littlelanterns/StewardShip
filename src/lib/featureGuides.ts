export interface FeatureGuideContent {
  featureKey: string;
  title: string;
  description: string;
  tips?: string[];
}

export const FEATURE_GUIDES: Record<string, FeatureGuideContent> = {
  crowsnest: {
    featureKey: 'crowsnest',
    title: "The Crow's Nest \u2014 Your Command Center",
    description: "This is your daily overview. Everything happening across your voyage surfaces here \u2014 tasks, victories, active goals, and upcoming commitments. Cards appear as you use features and disappear when empty.",
    tips: ["Tap any card to jump to that feature", "The greeting adapts to your time of day"],
  },
  mast: {
    featureKey: 'mast',
    title: "The Mast \u2014 Your Guiding Principles",
    description: "The Mast holds what you stand for \u2014 your values, declarations, faith foundations, and vision. These aren't affirmations. They're honest commitments about who you're choosing to become. The AI references your Mast in every conversation.",
    tips: ["Drag entries to reorder what matters most", "Use 'Craft at Helm' for AI-guided declaration writing"],
  },
  keel: {
    featureKey: 'keel',
    title: "The Keel \u2014 Know Yourself",
    description: "The Keel is your self-knowledge center \u2014 personality insights, strengths, growth areas, and anything that helps you understand who you are. Upload test results, journal reflections, or let the AI help you discover patterns.",
    tips: ["Contradictions are welcome \u2014 people are complex", "The AI uses your Keel to personalize every conversation"],
  },
  helm: {
    featureKey: 'helm',
    title: "The Helm \u2014 Your AI Companion",
    description: "The Helm is where you talk through anything \u2014 plans, decisions, struggles, celebrations. The AI knows your principles, personality, goals, and relationships. It's also the engine behind guided processes throughout the app.",
    tips: ["The drawer pulls up from any page", "Try voice input for hands-free journaling"],
  },
  log: {
    featureKey: 'log',
    title: "The Log \u2014 A Record of the Voyage",
    description: "Capture anything \u2014 journal entries, gratitude, reflections, quick notes. After saving, route entries to other features: create a task, flag a victory, save a principle. The Log is your universal inbox.",
    tips: ["AI auto-tags your life areas", "Route entries to Compass, Mast, or Victory Recorder after saving"],
  },
  compass: {
    featureKey: 'compass',
    title: "The Compass \u2014 Navigate Your Tasks",
    description: "Your task management system with seven different ways to view the same tasks. Toggle between Simple List, Eisenhower Matrix, Eat the Frog, and more. Each view applies a different prioritization philosophy.",
    tips: ["Long-press any view toggle for a quick explanation", "Use Task Breaker to decompose big tasks with AI"],
  },
  compass_views: {
    featureKey: 'compass_views',
    title: "Try different views throughout the day",
    description: "Your tasks stay the same \u2014 views are just different lenses for organizing them. Eisenhower sorts by urgency vs importance. Eat the Frog puts your hardest task first. 1/3/9 helps you focus on just one critical thing. Try switching views to find what works for your energy level right now.",
  },
  charts: {
    featureKey: 'charts',
    title: "Charts \u2014 Track Your Progress",
    description: "Set goals, create custom trackers, and watch your progress over time. Charts connects to your tasks and habits so you can see the bigger picture of your growth.",
    tips: ["Goals can link to Mast principles and Rigging plans", "Custom trackers work for anything \u2014 exercise, reading, practice"],
  },
  victories: {
    featureKey: 'victories',
    title: "Accomplishments \u2014 Evidence of Who You're Becoming",
    description: "Every completed task is an accomplishment. Record extra victories manually for wins that aren't on your task list. Use 'Celebrate this!' to generate an AI narrative for any time period's collection of accomplishments.",
    tips: ["Gold sparkle fires on every task completion across the app", "Filter by period and life area to see patterns in your progress"],
  },
  wheel: {
    featureKey: 'wheel',
    title: "The Wheel \u2014 Your Change Process",
    description: "When you're ready to make a real change, The Wheel walks you through six spokes: what you want to change, why it matters, who can help, what to practice, how to measure progress, and who you're becoming. It's thorough by design.",
    tips: ["Start with one Wheel \u2014 the AI recommends 1-2 at a time", "The Rim check-in reviews all spokes after ~2 weeks"],
  },
  lifeinventory: {
    featureKey: 'lifeinventory',
    title: "Life Inventory \u2014 Where You Stand",
    description: "An honest assessment of where you are across every area of life. No ratings or scales \u2014 just three columns: where you were, where you are, and where you're heading. The AI helps you explore each area through conversation.",
    tips: ["Areas update naturally from your Helm conversations", "The AI notices when you're living your vision and points it out"],
  },
  rigging: {
    featureKey: 'rigging',
    title: "Rigging \u2014 Plan Your Projects",
    description: "For goals and projects that need real planning. The AI helps you choose the right framework \u2014 milestones, prioritization, obstacle mapping, or decision analysis \u2014 then breaks the plan into actionable steps for your Compass.",
    tips: ["Five planning frameworks adapt to what you're building", "Milestones can be broken into tasks with Task Breaker"],
  },
  firstmate: {
    featureKey: 'firstmate',
    title: "First Mate \u2014 Your Relationship Partner",
    description: "Build a profile of your spouse through conversation, uploads, and observations. The AI uses this to help you love better \u2014 planning dates, writing encouragement, noticing patterns, and preparing for important conversations.",
    tips: ["The Marriage Toolbox has guided modes for different relationship goals", "Quick-capture gratitude saves to both your Log and spouse profile"],
  },
  crew: {
    featureKey: 'crew',
    title: "Crew \u2014 Your People",
    description: "Profiles for the important people in your life. Add context the AI can use when you're discussing someone. Use Higgins (the GraduationCap icon) for help communicating with crew members \u2014 whether you need help finding the right words or navigating a tricky situation.",
    tips: ["Higgins adapts its coaching based on who you're talking to \u2014 parent, child, friend, or coworker", "Important dates generate automatic reminders"],
  },
  safeharbor: {
    featureKey: 'safeharbor',
    title: "Safe Harbor \u2014 When Seas Get Rough",
    description: "A specialized space for processing stress, difficult emotions, or hard seasons. The AI shifts its approach here \u2014 validating first, offering perspective second, and always redirecting toward human connection and faith when appropriate.",
    tips: ["Safe Harbor uses a three-tier safety system", "The AI will always suggest talking to a real person when it matters"],
  },
  manifest: {
    featureKey: 'manifest',
    title: "The Manifest \u2014 Your Knowledge Base",
    description: "Upload books, articles, notes, and documents. The AI processes and indexes them so it can draw on your personal library during conversations. Extract frameworks to teach the AI new principles.",
    tips: ["Supported formats: PDF, EPUB, DOCX, TXT, MD", "Use 'Ask Your Library' to search across everything you've uploaded"],
  },
  meetings: {
    featureKey: 'meetings',
    title: "Meeting Frameworks \u2014 Structured Conversations",
    description: "Recurring meeting templates for your most important relationships \u2014 couple meetings, parent-child mentoring, weekly reviews, and custom meetings. The AI guides each session through a purposeful agenda and captures action items.",
    tips: ["Meeting notes auto-save to your Log", "Action items become Compass tasks"],
  },
  lists: {
    featureKey: 'lists',
    title: "Lists \u2014 Flexible and Shareable",
    description: "For anything that doesn't fit in tasks \u2014 shopping lists, book recommendations, gift ideas, bucket lists. Check items off, reorder, and share with others via link.",
  },
  settings: {
    featureKey: 'settings',
    title: "Settings \u2014 Make It Yours",
    description: "Configure your AI, daily rhythms, notifications, meeting schedules, and more. Every setting has a sensible default \u2014 you never need to visit here unless you want to customize something.",
    tips: ["Changes take effect immediately", "Deep links bring you here from other features when relevant"],
  },
  reflections: {
    featureKey: 'reflections',
    title: "Reflections \u2014 Daily Questions to Guide Your Thinking",
    description: "Answer a rotating set of questions each day to build self-awareness and track your growth over time. Route any response to your Log or flag it as a Victory. Add your own questions or use the defaults.",
    tips: ["Manage your question list on the Manage tab", "Past reflections are grouped by date for easy review"],
  },
  reports: {
    featureKey: 'reports',
    title: "Reports \u2014 See the Full Picture",
    description: "Generate progress reports across any time period. Choose which sections to include \u2014 tasks, journal entries, victories, goals, streaks, and more \u2014 then preview and export as PDF or Markdown.",
    tips: ["Use custom date ranges for quarterly or annual reviews", "Download as PDF to share or archive your progress"],
  },
};
