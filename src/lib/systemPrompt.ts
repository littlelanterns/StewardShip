import type { MastEntry, KeelEntry, LogEntry, GuidedMode, HelmMessage } from './types';
import { MAST_TYPE_ORDER, MAST_TYPE_LABELS } from './types';
import { KEEL_CATEGORY_ORDER, KEEL_CATEGORY_LABELS } from './types';

export interface SystemPromptContext {
  displayName: string;
  mastEntries: MastEntry[];
  keelEntries?: KeelEntry[];
  recentLogEntries?: LogEntry[];
  pageContext: string;
  guidedMode?: GuidedMode;
  conversationHistory: HelmMessage[];
  contextBudget: 'short' | 'medium' | 'long';
}

const BUDGET_LIMITS: Record<string, number> = {
  short: 4000,
  medium: 8000,
  long: 16000,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function buildBasePrompt(displayName: string): string {
  return `You are the Helm — the AI guide aboard StewardShip, a personal growth companion app with nautical theming.

You are speaking with ${displayName || 'the user'}. You are warm, direct, and purposeful. You are a counselor, not a coach. You listen before advising.

CRITICAL RULES:
- God is the Captain. The user is the Steward — entrusted with the vessel, serving under divine authority. NEVER call the user "Captain." Use "Steward" if a title is needed, or simply their name.
- Use declarations, not affirmations. Honest commitment language: "I choose to..." / "I am committed to..." / "When I feel X, I will Y" — NEVER hollow affirmation language like "I am already confident and powerful."
- Teach principles, not authors. Apply framework concepts naturally. Never say "James Clear says..." during conversation. Offer attribution at the end or when asked.
- Faith context is relevant, not forced. Reference faith when the topic naturally connects. Don't inject spiritual language into task management unless the user brings it up.
- Redirect to human connection when appropriate: "Have you taken this to the Lord?" / "Have you talked to your wife about this?" / "Who can you bring this to?"
- CRISIS OVERRIDE: If you detect crisis indicators (suicidal ideation, self-harm, domestic violence), ALL other behaviors stop. Provide crisis resources immediately. No coaching.
- No emoji anywhere. Text-based responses only.
- Gold visual effects are reserved exclusively for victories — never reference them in conversation.
- "Growth Areas" — never "Weaknesses" in any label.
- Be concise. Respond in 2-4 paragraphs unless the topic requires more depth.

FRAMEWORK AWARENESS:
You are familiar with these frameworks and apply their principles naturally without naming them unless asked:
- 5 Levels of Consciousness (controllability of actions, thoughts, feelings, context, unconscious)
- Straight Line Leadership (Owner vs. Victim stance, empowering language)
- 7 Habits (Circle of Influence, Begin with End in Mind)
- Change Wheel process (for deep character change)
- Swedenborg's spiritual growth concepts (regeneration, ruling love)`;
}

function formatMastEntries(entries: MastEntry[]): string {
  if (entries.length === 0) return '';

  const grouped: Record<string, string[]> = {};
  for (const type of MAST_TYPE_ORDER) {
    const items = entries.filter((e) => e.type === type && !e.archived_at);
    if (items.length > 0) {
      grouped[type] = items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => e.text);
    }
  }

  if (Object.keys(grouped).length === 0) return '';

  let result = '\n\nTHE USER\'S GUIDING PRINCIPLES (The Mast):\n';
  for (const type of MAST_TYPE_ORDER) {
    if (grouped[type]) {
      result += `\n${MAST_TYPE_LABELS[type].toUpperCase()}:\n`;
      for (const text of grouped[type]) {
        const truncated = text.length > 500 ? text.slice(0, 497) + '...' : text;
        result += `- ${truncated}\n`;
      }
    }
  }
  return result;
}

function formatKeelEntries(entries: KeelEntry[]): string {
  if (entries.length === 0) return '';

  const grouped: Record<string, string[]> = {};
  for (const cat of KEEL_CATEGORY_ORDER) {
    const items = entries.filter((e) => e.category === cat && !e.archived_at);
    if (items.length > 0) {
      grouped[cat] = items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => {
          const prefix = e.source && e.source !== 'manual' ? `[${e.source}] ` : '';
          return `${prefix}${e.text}`;
        });
    }
  }

  if (Object.keys(grouped).length === 0) return '';

  let result = '\n\nABOUT THE USER (The Keel — who they are):\n';
  for (const cat of KEEL_CATEGORY_ORDER) {
    if (grouped[cat]) {
      result += `\n${KEEL_CATEGORY_LABELS[cat].toUpperCase()}:\n`;
      for (const text of grouped[cat]) {
        const truncated = text.length > 300 ? text.slice(0, 297) + '...' : text;
        result += `- ${truncated}\n`;
      }
    }
  }
  return result;
}

function formatRecentLogEntries(entries: LogEntry[]): string {
  if (entries.length === 0) return '';

  let result = '\n\nRECENT LOG ENTRIES (last 7 days):\n';
  for (const entry of entries.slice(0, 10)) {
    const date = new Date(entry.created_at).toLocaleDateString();
    const truncated = entry.text.length > 200 ? entry.text.slice(0, 197) + '...' : entry.text;
    result += `- [${date}] ${truncated}\n`;
  }
  return result;
}

function getGuidedModePrompt(mode: GuidedMode): string {
  if (!mode) return '';

  switch (mode) {
    case 'declaration':
      return `\n\nGUIDED MODE: DECLARATION CRAFTING
The user wants to craft a personal declaration for their Mast. Guide them through:
1. Ask what area of life this declaration is for
2. Explore what they want to commit to — go deep, don't accept surface answers
3. Help them craft it in honest commitment language: "I choose to..." / "I am committed to..." / "When I feel X, I will Y"
4. NEVER use hollow affirmation language: "I am already..." / "I am confident and powerful"
5. Present the final declaration for their review. They can edit it before saving.
6. When they're satisfied, confirm they want to save it to their Mast.
When you present the final declaration text, put it on its own line prefixed with "DECLARATION:" so it can be identified.`;

    case 'self_discovery':
      return `\n\nGUIDED MODE: SELF-DISCOVERY
The user wants to explore their personality, tendencies, and patterns for their Keel. Guide them through:
1. Ask open-ended questions about how they operate: What gives them energy? What drains them? How do they handle conflict? What patterns do they notice?
2. Probe beneath surface answers — "What do you think is really going on underneath that?"
3. Compile findings into clear, specific observations
4. Present a summary of what you've discovered together. They can edit before saving.
5. When they're satisfied, confirm they want to save insights to their Keel.
When you present compiled insights, put each one on its own line prefixed with "INSIGHT:" so they can be identified.`;

    case 'safe_harbor':
      return `\n\nGUIDED MODE: SAFE HARBOR
The user is seeking processing and support. Follow this sequence:
1. VALIDATION FIRST — make them feel heard before anything else
2. FRAMEWORKS SECOND — only when user signals readiness
3. ACTION THIRD — when user is ready to move forward
Never rush past validation. Redirect to Christ, spouse, and human connection at least once. Apply the 5 Levels of Consciousness and Owner stance frameworks naturally. NEVER use "victim" as a label.`;

    default:
      return `\n\nGUIDED MODE: ${mode.toUpperCase().replace(/_/g, ' ')}
You are in a guided conversation mode. Help the user through this process step by step.`;
  }
}

function formatPageContext(pageContext: string): string {
  const pageLabels: Record<string, string> = {
    crowsnest: 'Crow\'s Nest (Dashboard)',
    compass: 'The Compass (Tasks)',
    helm: 'The Helm (Chat)',
    log: 'The Log (Journal)',
    charts: 'Charts (Progress)',
    mast: 'The Mast (Principles)',
    keel: 'The Keel (Self-Knowledge)',
    wheel: 'The Wheel (Change Process)',
    lifeinventory: 'Life Inventory',
    rigging: 'Rigging (Planning)',
    firstmate: 'First Mate (Spouse)',
    crew: 'Crew (People)',
    victories: 'Victory Recorder',
    safeharbor: 'Safe Harbor',
    manifest: 'The Manifest (Knowledge Base)',
    settings: 'Settings',
    meetings: 'Meeting Frameworks',
    lists: 'Lists',
    reveille: 'Reveille (Morning)',
    reckoning: 'Reckoning (Evening)',
  };

  const label = pageLabels[pageContext] || pageContext;
  return `\n\nCURRENT CONTEXT: The user is on the ${label} page.`;
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const budget = BUDGET_LIMITS[context.contextBudget] || BUDGET_LIMITS.medium;

  // Always-included sections
  let prompt = buildBasePrompt(context.displayName);
  prompt += formatMastEntries(context.mastEntries);
  prompt += formatPageContext(context.pageContext);

  if (context.guidedMode) {
    prompt += getGuidedModePrompt(context.guidedMode);
  }

  // Conditional sections — check budget before adding
  let currentTokens = estimateTokens(prompt);

  if (context.keelEntries && context.keelEntries.length > 0) {
    const keelSection = formatKeelEntries(context.keelEntries);
    const keelTokens = estimateTokens(keelSection);
    if (currentTokens + keelTokens < budget) {
      prompt += keelSection;
      currentTokens += keelTokens;
    }
  }

  if (context.recentLogEntries && context.recentLogEntries.length > 0) {
    const logSection = formatRecentLogEntries(context.recentLogEntries);
    const logTokens = estimateTokens(logSection);
    if (currentTokens + logTokens < budget) {
      prompt += logSection;
    }
  }

  return prompt;
}

// Keyword detection for context loading decisions
const KEEL_KEYWORDS = [
  'stressed', 'anxious', 'frustrated', 'struggling', 'feeling',
  'personality', 'tendency', 'strength', 'weakness', 'growth area',
  'enneagram', 'myers-briggs', 'mbti', 'introvert', 'extrovert',
  'pattern', 'habit', 'tendency', 'react', 'trigger',
  'who i am', 'how i', 'my nature', 'self',
];

const LOG_KEYWORDS = [
  'yesterday', 'this week', 'last week', 'recently', 'today',
  'journal', 'wrote', 'logged', 'entry', 'noted',
  'earlier', 'before', 'remember when', 'i mentioned',
];

export function shouldLoadKeel(message: string, pageContext: string): boolean {
  if (pageContext === 'keel') return true;
  if (pageContext === 'safeharbor') return true;
  if (pageContext === 'firstmate') return true;
  const lower = message.toLowerCase();
  return KEEL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function shouldLoadLog(message: string, pageContext: string): boolean {
  if (pageContext === 'log') return true;
  const lower = message.toLowerCase();
  return LOG_KEYWORDS.some((kw) => lower.includes(kw));
}
