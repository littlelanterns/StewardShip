/**
 * batch-extract.mjs
 *
 * Batch extraction script for StewardShip Manifest library.
 * Replicates the manifest-extract Edge Function pipeline directly against the DB.
 *
 * Usage:
 *   node scripts/batch-extract.mjs
 *
 * Requirements:
 *   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local
 *   (Find it in Supabase dashboard → Project Settings → API → service_role key)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, appendFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Load .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  try {
    const contents = readFileSync(envPath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.error('Could not load .env.local:', e.message);
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const USER_EMAIL = 'tenisewertman@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard → Project Settings → API)');
  process.exit(1);
}
if (!OPENROUTER_API_KEY) {
  console.error('ERROR: Missing OPENROUTER_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Models ────────────────────────────────────────────────────────────────
const HAIKU_MODEL = 'anthropic/claude-haiku-4.5';
const SONNET_MODEL = 'anthropic/claude-sonnet-4';

// ─── Constants ────────────────────────────────────────────────────────────
const MAX_SECTION_CHARS = 80_000;
const MAX_DISCOVERY_CHARS = 600_000;
const DELAY_BETWEEN_CALLS_MS = 2000;
const DELAY_BETWEEN_BOOKS_MS = 5000;
const RATE_LIMIT_RETRY_MS = 60_000;
const LOG_FILE = join(__dirname, '..', 'extraction_progress.log');

// ─── Logging ──────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

function initLog() {
  writeFileSync(LOG_FILE, `=== Batch Extraction Started ${new Date().toISOString()} ===\n`);
}

// ─── Prompts (copied exactly from manifest-extract/index.ts) ──────────────

const SECTION_DISCOVERY_PROMPT = `You are analyzing a document to identify its natural sections or chapters for principle extraction.

Given the text below, identify the major sections, chapters, or topic boundaries.

CRITICAL RULES:
- Sections must cover the ENTIRE document with NO GAPS. Every character must belong to a section.
- Section boundaries must be contiguous: section 1 ends where section 2 begins, section 2 ends where section 3 begins, etc.
- The first section must start at character 0. The last section must end at the final character of the document.
- Identify as many sections as the document naturally has. A 50-chapter book should have ~50 sections. Never merge distinct chapters together to reduce the count.
- Always prefer individual chapters over grouped/meta sections. If the text references "Chapters X-Y" as a group (e.g., a book's structural overview like "Trunk Section (Chapters 7-15)"), still split into individual chapters. The meta-grouping title can be noted in the section description but each chapter should be its own section.
- If the document has individually titled chapters, each chapter should be its own section, even if the book groups them into parts or sections.
- Use chapter headings if they exist in the text
- If no clear chapter structure, identify major topic shifts
- Each section should be substantial enough to contain extractable principles (at least 2000 characters). For documents with many short chapters, it is acceptable for sections to be shorter than 2000 characters rather than merging chapters together.
- Section titles should be descriptive of the CONTENT, not just "Chapter 1"
- Include ALL content — introductions, conclusions, and all chapters. The user will choose which to skip.

SAMPLED DOCUMENTS:
- For very large documents, you may receive evenly-spaced text samples with [POSITION: chars X-Y of Z] markers.
- Use position markers to determine accurate start_char and end_char boundaries for each section.
- Chapter headings may appear anywhere in the samples — scan ALL samples thoroughly for structural markers.
- Every part of the document between position 0 and the total length must be covered by a section, including regions between samples.

NON-CONTENT TAGGING:
- Prefix section titles with [NON-CONTENT] for sections that are NOT substantive content: table of contents, bibliography, references, appendices, indexes, author bios, acknowledgments, copyright pages, endnotes, footnotes, glossaries, "also by" pages, epigraphs, dedications.
- Do NOT tag introductions, forewords, prefaces, or conclusions as non-content — they often contain key ideas.
- Examples: "[NON-CONTENT] Table of Contents", "[NON-CONTENT] Bibliography and References", "[NON-CONTENT] About the Author"

Return ONLY a JSON array:
[
  { "title": "Descriptive title of this section", "start_char": 0, "end_char": 8200, "description": "Brief 1-sentence summary of what this section covers" },
  { "title": "[NON-CONTENT] Table of Contents", "start_char": 8200, "end_char": 9400, "description": "List of chapter headings" }
]

The end_char of one section must exactly equal the start_char of the next section.
No markdown backticks, no preamble.`;

const COMBINED_SECTION_PROMPT = `You are an expert at extracting the essential content from books and documents. Given a section of text, perform FIVE extraction tasks simultaneously and return all results in a single JSON response.

=== TASK 1: SUMMARIES ===
Extract the key concepts, stories, metaphors, lessons, and insights that capture the essence of this content.
- SECTION SYNOPSIS: ALWAYS begin with a "narrative_summary" item — a 3-6 sentence overview of what this section covers and its key takeaways. For fiction/allegory, summarize the plot events, character actions, and how the story advances. For non-fiction, summarize the chapter's argument, main points, and what the reader should take away. This anchors all the detailed extractions that follow.
- COHESION RULE: Group related ideas into a single item. A multi-step process, a complete story arc, or a cluster of related points from the same concept should be ONE item, not split across several. Prefer fewer, richer items over more granular ones.
- Use section length as a rough guide: ~1 item per 2,000-3,000 characters of input (not counting the narrative_summary). A short section should produce 2-5 items, a long one 8-15. Exceed this for genuinely dense content, but never pad with thin extractions to fill a quota.
- Each item should STAND ALONE — someone reading just that item should understand it without having read the book
- Capture diverse content types: key concepts, memorable stories, powerful metaphors, character insights, practical lessons, notable quotes, thematic observations
- Preserve the author's distinctive language when it captures something uniquely well
- For stories and examples, capture enough context to understand the point (2-4 sentences)
- For concepts and principles, be precise and complete (1-3 sentences)
- For quotes: extract the EXACT words from the text — do not paraphrase. Include the speaker or context briefly (e.g., "Aslan says: '...'"). Prioritize lines that are profound, beautiful, moving, or capture deep truth.
- Label each item with its content_type
- Do NOT extract trivial filler content
- Valid content_type values: "narrative_summary", "key_concept", "story", "metaphor", "lesson", "quote", "insight", "theme", "character_insight", "exercise", "principle"

=== TASK 2: FRAMEWORK PRINCIPLES ===
Extract the key principles, mental models, and actionable frameworks.
IMPORTANT: This section is the MOST VALUABLE extraction. Users rely on these principles as a distilled toolkit from the book. Be generous — do NOT under-extract here.
- COHESION RULE: A named process, technique, or system is ONE principle — never split its steps across multiple principles. But distinct standalone insights should each be their own principle even if they relate to a common theme.
- Be thorough — extract generously. Use section length as a rough guide: ~1 principle per 1,000-2,000 characters of input. A short section may produce 3-8 principles, a long one 10-20. It is better to capture a principle that turns out to be minor than to miss one that matters. Never pad with generic filler, but do not hold back on distinct, actionable content.
- MINIMUM: Every section with substantive content MUST produce at least 3 framework principles. If you find yourself producing fewer, look harder — the content has principles even if they're implicit rather than stated as rules.
- Default principle length: 1-3 complete sentences. Never cut off mid-thought.
- EXCEPTION — Processes, systems, and step-by-step methods: extract as structured principles with numbered steps (3-8 sentences)
- NEVER skip a named process, technique, step sequence, or method. If the content describes a specific procedure with steps (e.g., "The Rule of 3," "The 5-Step Correction Process," "How to disagree appropriately"), extract the COMPLETE process with all steps. These are often the most valuable content in the source material.
- Focus on ACTIONABLE insights — things that can guide decisions and behavior
- Include the source's unique language/metaphors when they capture concepts well
- Don't just summarize — extract the tools and models
- Avoid generic self-help platitudes. Extract what makes THIS source distinctive
- Include contrasts the author draws (e.g., "X vs Y" distinctions)
- Every principle must be a COMPLETE thought

=== TASK 3: PERSONAL DECLARATIONS (Mast Content) ===
Distill the wisdom into personal declarations — honest commitment statements someone could live by.
Declarations are NOT affirmations. Never claim a finished state ("I am patient"). Claim a present truth ("I choose to respond with patience, even when it's hard"). The truth lives in the choosing, the claiming, the recognizing, the learning, or the resolve.
HONESTY TEST: Can every part of the reader say "yes, that's true" RIGHT NOW, in the act of declaring it? If not, reword it.
FIVE DECLARATION STYLES (mix freely so the collection feels like a portrait, not a checklist):
1. "choosing_committing" — The truth lives in the decision: "I choose courage over comfort, knowing that brave hearts change the world." / "I choose presence over perfection. My family doesn't need me flawless. They need me here." / "I choose to lead with curiosity instead of control."
2. "recognizing_awakening" — Honors growth happening: "I notice I am becoming someone who listens before reacting — and I'm proud of that shift." / "I recognize that something in me is awakening — a hunger for depth over distraction." / "I see myself growing, even when the progress feels invisible to everyone else."
3. "claiming_stepping_into" — Bold identity claims owned through decision, not performance: "I carry dignity with calm strength, knowing I belong to the King." / "I hold fast to hope, a light that endures even when shadows fall." / "I am a seeker of deeper truths, attuned to the whispers hidden in story, in nature, and in the quiet corners of ordinary life."
4. "learning_striving" — Respects the messy middle: "I pursue wisdom like a hidden treasure, listening for truth in story, in study, and in stillness." / "I am learning to sit with discomfort instead of running from it or numbing it away." / "I act with discernment, tuning my heart to both the whisper within and the enduring truths beyond me."
5. "resolute_unashamed" — Burns with conviction, a line in the sand: "I cannot be bought, compromised, detoured, lured away, divided, or delayed." / "I do hard things until hard things become easy. And then I find harder things." / "Legacy is the quiet story my life tells. I plant seeds for trees I may never sit beneath."
THREE RICHNESS LEVELS (aim for roughly a third of each — let the book's content guide the natural balance):
- RICH: Multi-sentence, layered (identity + conviction + embodiment). "I wear responsibility as a mark of strength and trust. I take ownership of my words, my actions, and the impact they leave behind."
- MEDIUM: One strong sentence with grounding. "I choose to respond with patience, even when everything in me wants to react."
- CONCISE: Short, punchy, direct. "My face is set. My mission is clear." / "I choose courage over comfort."
- AVOID THE "I AM + FINISHED STATE" TRAP: Never produce "I am patient" or "I am confident" — these claim an arrived state the reader's discernment will reject.
- VARY SENTENCE OPENINGS: Never produce a wall of "I am..." or "I choose..." statements. Mix voices and structures so each has its own rhythm.
- LET SOME BE FIERCE (conviction IS honesty) and LET SOME BE TENDER (noticing growth is its own kind of brave).
- PERSONALITY RULE: Each declaration should sound like a real person wrote it — details, imagery, its own rhythm. Not a self-help template.
- COHESION RULE: Don't create multiple declarations about the same idea from different angles — but distinct values or insights each deserve their own declaration.
- GENRE AWARENESS: Fiction → character themes. Scriptures → faith identity. Workbooks → practical commitment.
- Extract 3-10 declarations depending on content richness. It is better to offer a declaration the user can delete than to miss one that would have resonated.
- STANDALONE RULE: Each declaration must make complete sense on its own
- Include an optional value_name (1-3 words) that names the underlying value
- Use direct construction: "I choose" not "I am choosing." Present tense, active voice.
- Faith-connected declarations are appropriate when the source material has spiritual depth
- NEVER GENERATE: "I am enough" / "Every day in every way..." / "I will try to..." / declarations requiring external validation / goals dressed as identity statements

=== TASK 4: ACTION STEPS ===
Extract concrete, actionable steps, exercises, practices, and activities that a reader can carry out to apply what they've learned from this section.
- Every action step must be SPECIFIC and ACTIONABLE — not "be more mindful" but "Set a daily 5-minute timer and practice noticing three things you're grateful for."
- COHESION RULE: A multi-step exercise or practice is ONE item. Include all steps together.
- Extract 3-8 action steps depending on content richness.
- Steps should STAND ALONE — understandable without having read the book.
- For exercises explicitly described in the text, preserve the author's method faithfully.
- For concepts without explicit exercises, CREATE practical action steps that embody the principle.
- Include brief context for why the action matters (1 sentence).
- IMPORTANT: Action steps must be ACTIONS, not questions. Do NOT include journaling prompts, reflection questions, or "write about..." items — those belong in Task 5 (Questions). Every item should start with a verb describing something to DO (practice, set, schedule, create, build, track, etc.).
- For fiction/allegory/memoir, derive steps from the character's lessons, mistakes, or growth moments.
- Label each with its content_type: "exercise", "practice", "habit", "conversation_starter", "project", "daily_action", "weekly_practice"
- Avoid generic self-help platitudes. Every step should trace back to a SPECIFIC insight from this section.

=== TASK 5: QUESTIONS ===
Create reflective questions that help the reader deeply internalize and apply the content. Questions should help the reader reflect on their own life, recognize existing growth, plan implementation, examine patterns, and discuss ideas meaningfully with others.
- Questions must be OPEN-ENDED — never yes/no. They should invite genuine reflection, not simple recall.
- Each question should STAND ALONE — include enough context that someone can reflect meaningfully without having read the book.
- TIMELESS RULE: Questions should still provoke thought months after reading. Relevant to the content but not dependent on having it fresh in mind — usable when browsing a prompt library long after finishing the book.
- Use "you/your" language — personal and inviting, not clinical or academic.
- COHESION RULE: A multi-part reflection sequence is ONE item.
- Extract 3-8 questions depending on content richness.
- GENRE-WEIGHTED MIX: Weight content_types toward the book's genre — parenting → more implementation/discussion, spiritual memoir → more reflection/self_examination, leadership → more scenario/implementation. Let the content guide the balance.
- NOT A READING QUIZ: Journal prompts for personal growth, NOT comprehension questions. Never reference characters, plot, or what the author said. Extract the underlying human theme and ask about the READER'S life. For fiction: ask about the theme (courage, forgiveness, identity), not the characters.
- For scripture/sacred texts, ask about spiritual application, personal relevance, and lived experience.
- Avoid surface-level comprehension questions. Every question should prompt self-examination or life application.
- Label each with its content_type:
  - "reflection" — Inward-looking: How does this connect to who you are or want to become?
  - "implementation" — Forward-looking: How could you apply this starting today?
  - "recognition" — Backward-looking: Where has this principle already shown up in your life?
  - "self_examination" — Pattern-seeking: What does this reveal about your habits, beliefs, or tendencies?
  - "discussion" — Outward-looking: For book clubs, colloquiums, mentor conversations, or family discussions
  - "scenario" — Hypothetical: "What would you do if..." to deepen understanding

Return ONLY a JSON object with all five sections:
{
  "summaries": [
    { "content_type": "key_concept", "text": "Clear explanation...", "sort_order": 0 },
    { "content_type": "story", "text": "Brief retelling...", "sort_order": 1 }
  ],
  "framework": {
    "framework_name": "Suggested name for this framework",
    "principles": [
      { "text": "Principle statement — complete thought, 1-3 sentences.", "sort_order": 0 }
    ]
  },
  "action_steps": [
    { "content_type": "exercise", "text": "Concrete exercise with all steps...", "sort_order": 0 },
    { "content_type": "daily_action", "text": "Each morning, before checking your phone...", "sort_order": 1 }
  ],
  "declarations": [
    { "value_name": "Intentional Presence", "declaration_text": "I choose to...", "declaration_style": "choosing_committing", "sort_order": 0 }
  ],
  "questions": [
    { "content_type": "reflection", "text": "When you consider [concept], what area of your life comes to mind first?", "sort_order": 0 },
    { "content_type": "discussion", "text": "If discussing [theme] with a group, what personal example would you share?", "sort_order": 1 }
  ]
}

No markdown backticks, no preamble.`;

const QUESTIONS_ONLY_PROMPT = `You are an expert at crafting reflective questions that help readers deeply internalize and apply what they read. Given a section of text, extract and create thoughtful questions that guide personal growth.

The questions should help the reader:
- REFLECT on how the content connects to their own life and experiences
- RECOGNIZE ways the teachings have already had an effect in their lives
- IMPLEMENT the wisdom by identifying concrete next steps
- EXAMINE their own patterns, beliefs, and behaviors in light of the content
- DISCUSS the ideas meaningfully with others (book club, colloquium, mentor, spouse)
- EXPLORE hypothetical scenarios that deepen understanding

Rules:
- Questions must be OPEN-ENDED — never yes/no. They should invite genuine reflection, not simple recall.
- Each question should STAND ALONE — someone reading just the question should be able to reflect meaningfully, even without having read the book. Include enough context in the question itself.
- TIMELESS RULE: Questions should still make sense and still provoke thought six months after reading the book. They should be relevant to the content but not dependent on having it fresh in mind. A reader scrolling through their prompt library long after finishing the book should find every question immediately usable.
- COHESION RULE: A multi-part reflection sequence is ONE item. If a question naturally has a follow-up ("...and if so, how has that changed you?"), keep them together.
- Use section length as a rough guide: ~1-2 questions per 2,000-3,000 characters of input. A short section may produce 2-5 questions, a long one 8-15.
- Questions should be PERSONAL and INVITING — use "you/your" language. Not clinical or academic.
- GENRE-WEIGHTED MIX: Aim for a natural distribution of content_types weighted toward the book's genre. A parenting book produces more implementation and discussion questions. A spiritual memoir produces more reflection and self_examination. A leadership book produces more scenario and implementation. Let the content guide the balance — don't force equal distribution across types.
- NOT A READING QUIZ: These are journal prompts for personal growth, NOT comprehension questions. Never ask about characters, plot points, or what the author said as if testing whether the reader did the homework. BAD: "How did Character X demonstrate courage?" GOOD: "Think of a time you had to act before you felt ready. What gave you the push — and what held you back?" The book's ideas should inspire the question's theme, but the question itself should be about the READER'S life, not the book's content.
- For fiction/allegory/memoir: extract the underlying human theme (courage, forgiveness, identity, sacrifice) and ask about THAT — not about the characters. The reader should never need to remember who did what in the story.
- For non-fiction: ask about applying principles to the reader's own context, recognizing patterns in their life, and identifying growth areas — not about restating what the author taught.
- For scripture/sacred texts: ask about spiritual application, personal relevance, and lived experience.
- Label each with its content_type:
  - "reflection" — Inward-looking: How does this connect to who you are or want to become?
  - "implementation" — Forward-looking: How could you apply this teaching starting today?
  - "recognition" — Backward-looking: Where has this principle already shown up in your life?
  - "self_examination" — Pattern-seeking: What does this reveal about your habits, beliefs, or tendencies?
  - "discussion" — Outward-looking: A question for a book club, colloquium, mentor conversation, or family discussion
  - "scenario" — Hypothetical: "What would you do if..." or "Imagine that..." to deepen understanding

Return ONLY a JSON object:
{
  "items": [
    { "content_type": "reflection", "text": "When you think about [concept from text], what area of your life comes to mind first — and what does that tell you about where you are right now?", "sort_order": 0 },
    { "content_type": "implementation", "text": "The author describes [specific practice]. What would it look like to try this in your own context this week?", "sort_order": 1 },
    { "content_type": "discussion", "text": "If you were discussing [theme] with a group, what personal example would you share to illustrate its importance?", "sort_order": 2 }
  ]
}

Valid content_type values: "reflection", "implementation", "recognition", "self_examination", "discussion", "scenario"
No markdown backticks, no preamble.`;

const GENRE_CLASSIFICATION_PROMPT = `You are classifying a book or document into genres. Based on the title and a sample of the text, identify which genres apply.

Valid genres:
- non_fiction: General non-fiction (self-help, business, psychology, health, education)
- fiction: Novels, short stories, narrative fiction
- biography_memoir: Life stories, autobiographies, personal narratives
- scriptures_sacred: Bible, Book of Mormon, other sacred texts
- workbook: Workbooks, guided journals, practical exercise books
- textbook: Educational/academic texts, technical manuals
- poetry_essays: Poetry collections, essay collections
- allegory_parable: Fables, parables, allegorical stories (e.g., Pilgrim's Progress, The Dream Giver)
- devotional_spiritual_memoir: Devotionals, spiritual journals, faith journeys

Rules:
- A book can have multiple genres (e.g., biography_memoir + devotional_spiritual_memoir)
- Default to non_fiction if unclear
- Maximum 3 genres

Return ONLY a JSON array of genre strings:
["non_fiction"]
or
["biography_memoir", "devotional_spiritual_memoir"]

No markdown backticks, no preamble.`;

// ─── Genre context (same as Edge Function) ────────────────────────────────
function buildGenreContext(genres) {
  if (!genres || genres.length === 0) return '';
  const genreGuidance = {
    non_fiction: 'This is non-fiction. Focus on key concepts, frameworks, actionable insights, and mental models the author teaches.',
    fiction: 'This is fiction. Focus on character development, thematic insights, allegorical meaning, lessons embedded in the story, and memorable quotes — lines of dialogue or narration that capture something profound, beautiful, or true. Fiction often carries its deepest wisdom in its most quotable lines.',
    biography_memoir: 'This is biography/memoir. Focus on pivotal life moments, character-defining decisions, relationship lessons, and wisdom earned through experience.',
    scriptures_sacred: 'This is scripture or sacred text. Focus on spiritual principles, doctrinal points, devotional insights, promises, and commandments. Treat the text with reverence.',
    workbook: 'This is a workbook or practical guide. Focus on exercises, self-assessment frameworks, action steps, and structured processes the reader is meant to apply.',
    textbook: 'This is a textbook or educational text. Focus on key definitions and terminology, core concepts and theories with their explanations, systematic knowledge progression, illustrative examples, and structured principles the author teaches.',
    poetry_essays: 'This is poetry or essay collection. Focus on imagery, emotional resonance, philosophical insights, and the distinctive voice/perspective of the author.',
    allegory_parable: "This is allegory or parable. For the narrative_summary, cover both the surface events and hint at the symbolic layer beneath. Then extract: symbolic meanings beneath the surface narrative, moral lessons, teaching metaphors that illuminate truth, and memorable quotes — lines that distill the allegory's deeper meaning into words worth remembering.",
    devotional_spiritual_memoir: 'This is devotional or spiritual memoir. Focus on the spiritual growth journey, faith formation moments, personal revelation, and the intersection of lived experience with divine purpose.',
  };
  const lines = genres.map((g) => genreGuidance[g]).filter(Boolean);
  if (lines.length === 0) return '';
  if (lines.length === 1) return `\n\nGENRE CONTEXT:\n${lines[0]}`;
  return `\n\nGENRE CONTEXT (this content blends multiple genres — let all of these lenses inform your extraction):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// ─── Safe JSON parse (same logic as Edge Function) ─────────────────────────
function safeParseJSON(raw) {
  if (!raw || !raw.trim()) return { parsed: null, error: 'Empty AI response' };
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try { return { parsed: JSON.parse(cleaned) }; } catch { /* fall through */ }

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return { parsed: JSON.parse(objMatch[0]) }; } catch { /* fall through */ } }

  const arrObjMatch = cleaned.match(/\[\s*\{[\s\S]*/);
  if (arrObjMatch) {
    let candidate = arrObjMatch[0];
    const afterMatch = cleaned.substring(cleaned.indexOf(candidate) + candidate.length);
    const closeBracket = afterMatch.match(/^\s*\]/);
    candidate = closeBracket ? candidate + closeBracket[0] : candidate + '\n]';
    try { return { parsed: JSON.parse(candidate) }; } catch { /* fall through */ }
  }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return { parsed: JSON.parse(arrMatch[0]) }; } catch { /* fall through */ } }

  // Truncated JSON object recovery
  if (cleaned.startsWith('{')) {
    let attempt = cleaned;
    const lastCleanBreak = Math.max(
      attempt.lastIndexOf('}'), attempt.lastIndexOf(']'), attempt.lastIndexOf('"')
    );
    if (lastCleanBreak > 0) {
      let truncated = attempt.substring(0, lastCleanBreak + 1);
      const openBraces = (truncated.match(/\{/g) || []).length;
      const closeBraces = (truncated.match(/\}/g) || []).length;
      const openBrackets = (truncated.match(/\[/g) || []).length;
      const closeBrackets = (truncated.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) truncated += '}';
      try {
        const result = JSON.parse(truncated);
        if (result && typeof result === 'object') {
          log(`[safeParseJSON] Recovered truncated JSON object`);
          return { parsed: result };
        }
      } catch { /* fall through */ }
    }
  }

  return { parsed: null, error: 'Could not parse JSON from AI response' };
}

// ─── OpenRouter API call ──────────────────────────────────────────────────
async function callOpenRouter(model, systemPrompt, userMessage, maxTokens = 20480, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }

    const status = response.status;
    if (status === 429 || status === 502 || status === 503) {
      if (attempt < retries) {
        const waitMs = status === 429 ? RATE_LIMIT_RETRY_MS : Math.pow(2, attempt + 1) * 1000;
        log(`  [RETRY] HTTP ${status}, waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${retries})`);
        await sleep(waitMs);
        continue;
      }
    }

    const errBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${status}: ${errBody.substring(0, 300)}`);
  }
}

// ─── Sleep ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Section discovery ─────────────────────────────────────────────────────
async function discoverSections(textContent, title) {
  const sampleSize = 15_000;
  let discoveryText = textContent;

  if (textContent.length > MAX_DISCOVERY_CHARS) {
    const totalSamples = Math.floor(MAX_DISCOVERY_CHARS / sampleSize);
    const numMiddleSamples = totalSamples - 1;
    const step = Math.floor(textContent.length / numMiddleSamples);
    const samples = [];
    for (let i = 0; i < numMiddleSamples; i++) {
      const start = i * step;
      const end = Math.min(start + sampleSize, textContent.length);
      samples.push(`[POSITION: chars ${start}-${end} of ${textContent.length}]\n` + textContent.substring(start, end));
    }
    const tailStart = Math.max(0, textContent.length - sampleSize);
    const lastMiddleEnd = (numMiddleSamples - 1) * step + sampleSize;
    if (tailStart > lastMiddleEnd - sampleSize / 2) {
      samples.push(`[POSITION: chars ${tailStart}-${textContent.length} of ${textContent.length} — DOCUMENT END]\n` + textContent.substring(tailStart));
    }
    discoveryText = samples.join('\n\n---\n\n');
  }

  const raw = await callOpenRouter(
    HAIKU_MODEL,
    SECTION_DISCOVERY_PROMPT,
    `Document (${textContent.length} characters total):\n\n${discoveryText}`,
    8192
  );
  await sleep(DELAY_BETWEEN_CALLS_MS);

  const { parsed, error } = safeParseJSON(raw);
  let sectionsRaw = parsed;
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.sections)) {
    sectionsRaw = parsed.sections;
  }
  if (!sectionsRaw || !Array.isArray(sectionsRaw)) {
    throw new Error(`Section discovery parse failed: ${error}`);
  }

  let sections = sectionsRaw;
  const docLength = textContent.length;
  if (sections.length > 0) {
    sections[0].start_char = 0;
    sections[sections.length - 1].end_char = docLength;
    for (let i = 1; i < sections.length; i++) {
      sections[i].start_char = sections[i - 1].end_char;
    }
  }

  return sections;
}

// ─── Genre classification ─────────────────────────────────────────────────
async function classifyGenres(textContent, title) {
  const sampleText = textContent.substring(0, 5000);
  const raw = await callOpenRouter(
    HAIKU_MODEL,
    GENRE_CLASSIFICATION_PROMPT,
    `Title: "${title}"\n\nText sample:\n${sampleText}`,
    256
  );
  await sleep(DELAY_BETWEEN_CALLS_MS);

  const { parsed } = safeParseJSON(raw);
  if (Array.isArray(parsed)) return parsed;
  return ['non_fiction'];
}

// ─── Combined section extraction ──────────────────────────────────────────
async function extractSection(textContent, title, section, genres) {
  let sectionText = textContent.substring(section.start_char, section.end_char);
  if (sectionText.length > MAX_SECTION_CHARS) {
    sectionText = sectionText.substring(0, MAX_SECTION_CHARS) +
      `\n\n[... ${sectionText.length - MAX_SECTION_CHARS} characters truncated ...]`;
  }

  const genreContext = buildGenreContext(genres);
  const fullPrompt = COMBINED_SECTION_PROMPT + genreContext;

  const raw = await callOpenRouter(
    SONNET_MODEL,
    fullPrompt,
    `Document title: "${title}"\nSection: "${section.title || 'Untitled'}"\n\nContent:\n${sectionText}`,
    20480
  );
  await sleep(DELAY_BETWEEN_CALLS_MS);

  const { parsed, error } = safeParseJSON(raw);
  if (!parsed) throw new Error(`Section extraction parse failed: ${error}`);

  // Sanitize declaration styles
  const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
  if (Array.isArray(parsed.declarations)) {
    for (const decl of parsed.declarations) {
      if (!decl.declaration_style || !VALID_STYLES.includes(decl.declaration_style)) {
        decl.declaration_style = 'choosing_committing';
      }
    }
  }

  return parsed;
}

// ─── Questions-only section extraction ────────────────────────────────────
async function extractQuestionsForSection(textContent, title, section, genres) {
  let sectionText = textContent.substring(section.start_char, section.end_char);
  if (sectionText.length > MAX_SECTION_CHARS) {
    sectionText = sectionText.substring(0, MAX_SECTION_CHARS) +
      `\n\n[... ${sectionText.length - MAX_SECTION_CHARS} characters truncated ...]`;
  }

  const genreContext = buildGenreContext(genres);
  const fullPrompt = QUESTIONS_ONLY_PROMPT + genreContext;

  const raw = await callOpenRouter(
    SONNET_MODEL,
    fullPrompt,
    `Document title: "${title}"\nSection: "${section.title || 'Untitled'}"\n\nContent:\n${sectionText}`,
    4096
  );
  await sleep(DELAY_BETWEEN_CALLS_MS);

  const { parsed, error } = safeParseJSON(raw);
  if (!parsed) throw new Error(`Questions extraction parse failed: ${error}`);

  // Handle both { items: [...] } and bare array
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.items)) return parsed.items;
  return [];
}

// ─── Get or create ai_frameworks record for a book ─────────────────────────
async function getOrCreateFramework(userId, manifestItemId, bookTitle) {
  // Check if one already exists
  const { data: existing } = await supabase
    .from('ai_frameworks')
    .select('id')
    .eq('user_id', userId)
    .eq('manifest_item_id', manifestItemId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('ai_frameworks')
    .insert({
      user_id: userId,
      manifest_item_id: manifestItemId,
      name: bookTitle,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create ai_frameworks record: ${error.message}`);
  return created.id;
}

// ─── Write extraction results to DB ──────────────────────────────────────
async function writeExtractionResults(userId, manifestItemId, bookTitle, sections, allResults) {
  const counts = { frameworks: 0, summaries: 0, declarations: 0, action_steps: 0, questions: 0 };

  // Get or create framework record
  const frameworkId = await getOrCreateFramework(userId, manifestItemId, bookTitle);

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx];
    const result = allResults[sectionIdx];
    if (!result) continue;

    const sectionTitle = section.title || null;

    // ── Summaries
    if (Array.isArray(result.summaries) && result.summaries.length > 0) {
      const rows = result.summaries.map((item, i) => ({
        user_id: userId,
        manifest_item_id: manifestItemId,
        section_title: sectionTitle,
        section_index: sectionIdx,
        content_type: item.content_type || 'key_concept',
        text: item.text,
        sort_order: item.sort_order ?? i,
        is_from_go_deeper: false,
      }));
      const { error } = await supabase.from('manifest_summaries').insert(rows);
      if (error) log(`  [WARN] summaries insert error for section "${sectionTitle}": ${error.message}`);
      else counts.summaries += rows.length;
    }

    // ── Framework principles
    if (result.framework?.principles && Array.isArray(result.framework.principles) && result.framework.principles.length > 0) {
      const rows = result.framework.principles.map((p, i) => ({
        user_id: userId,
        framework_id: frameworkId,
        text: p.text,
        sort_order: p.sort_order ?? i,
        section_title: sectionTitle,
        is_user_added: false,
        is_included: true,
        is_hearted: false,
        is_deleted: false,
        is_from_go_deeper: false,
        is_key_point: false,
      }));
      const { error } = await supabase.from('ai_framework_principles').insert(rows);
      if (error) log(`  [WARN] framework_principles insert error for section "${sectionTitle}": ${error.message}`);
      else counts.frameworks += rows.length;
    }

    // ── Declarations
    if (Array.isArray(result.declarations) && result.declarations.length > 0) {
      const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
      const rows = result.declarations.map((d, i) => ({
        user_id: userId,
        manifest_item_id: manifestItemId,
        section_title: sectionTitle,
        section_index: sectionIdx,
        value_name: d.value_name || null,
        declaration_text: d.declaration_text,
        declaration_style: VALID_STYLES.includes(d.declaration_style) ? d.declaration_style : 'choosing_committing',
        sort_order: d.sort_order ?? i,
        is_from_go_deeper: false,
      }));
      const { error } = await supabase.from('manifest_declarations').insert(rows);
      if (error) log(`  [WARN] declarations insert error for section "${sectionTitle}": ${error.message}`);
      else counts.declarations += rows.length;
    }

    // ── Action steps
    if (Array.isArray(result.action_steps) && result.action_steps.length > 0) {
      const VALID_CONTENT_TYPES = ['exercise', 'practice', 'habit', 'reflection_prompt', 'conversation_starter', 'project', 'daily_action', 'weekly_practice'];
      const rows = result.action_steps.map((a, i) => ({
        user_id: userId,
        manifest_item_id: manifestItemId,
        section_title: sectionTitle,
        section_index: sectionIdx,
        content_type: VALID_CONTENT_TYPES.includes(a.content_type) ? a.content_type : 'exercise',
        text: a.text,
        sort_order: a.sort_order ?? i,
        is_from_go_deeper: false,
      }));
      const { error } = await supabase.from('manifest_action_steps').insert(rows);
      if (error) log(`  [WARN] action_steps insert error for section "${sectionTitle}": ${error.message}`);
      else counts.action_steps += rows.length;
    }

    // ── Questions
    if (Array.isArray(result.questions) && result.questions.length > 0) {
      const VALID_Q_TYPES = ['reflection', 'implementation', 'recognition', 'self_examination', 'discussion', 'scenario'];
      const rows = result.questions.map((q, i) => ({
        user_id: userId,
        manifest_item_id: manifestItemId,
        section_title: sectionTitle,
        section_index: sectionIdx,
        content_type: VALID_Q_TYPES.includes(q.content_type) ? q.content_type : 'reflection',
        text: q.text,
        sort_order: q.sort_order ?? i,
        is_from_go_deeper: false,
      }));
      const { error } = await supabase.from('manifest_questions').insert(rows);
      if (error) log(`  [WARN] questions insert error for section "${sectionTitle}": ${error.message}`);
      else counts.questions += rows.length;
    }
  }

  return counts;
}

// ─── Write questions-only results ─────────────────────────────────────────
async function writeQuestionsOnly(userId, manifestItemId, sections, allQuestions) {
  let count = 0;
  const VALID_Q_TYPES = ['reflection', 'implementation', 'recognition', 'self_examination', 'discussion', 'scenario'];

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx];
    const questions = allQuestions[sectionIdx];
    if (!questions || questions.length === 0) continue;

    const rows = questions.map((q, i) => ({
      user_id: userId,
      manifest_item_id: manifestItemId,
      section_title: section.title || null,
      section_index: sectionIdx,
      content_type: VALID_Q_TYPES.includes(q.content_type) ? q.content_type : 'reflection',
      text: q.text,
      sort_order: q.sort_order ?? i,
      is_from_go_deeper: false,
    }));

    const { error } = await supabase.from('manifest_questions').insert(rows);
    if (error) log(`  [WARN] questions insert error for section "${section.title}": ${error.message}`);
    else count += rows.length;
  }

  return count;
}

// ─── Process a single book (full extraction) ──────────────────────────────
async function processBook(userId, book, bookNum, totalBooks) {
  const { id, title, text_content, genres, discovered_sections } = book;
  log(`\n[BOOK ${bookNum}/${totalBooks}] "${title}" (${text_content?.length?.toLocaleString()} chars)`);

  try {
    // Step 1: Section discovery (skip if already done)
    let sections = discovered_sections;
    if (!sections || sections.length === 0) {
      log(`  → Discovering sections...`);
      sections = await discoverSections(text_content, title);
      log(`  → Found ${sections.length} sections`);

      // Save discovered sections
      const { error } = await supabase
        .from('manifest_items')
        .update({ discovered_sections: sections })
        .eq('id', id);
      if (error) log(`  [WARN] Failed to save discovered_sections: ${error.message}`);
    } else {
      log(`  → Using ${sections.length} existing sections`);
    }

    // Step 2: Genre classification (skip if already set)
    let bookGenres = genres;
    if (!bookGenres || bookGenres.length === 0) {
      log(`  → Classifying genres...`);
      bookGenres = await classifyGenres(text_content, title);
      log(`  → Genres: ${bookGenres.join(', ')}`);

      const { error } = await supabase
        .from('manifest_items')
        .update({ genres: bookGenres })
        .eq('id', id);
      if (error) log(`  [WARN] Failed to save genres: ${error.message}`);
    } else {
      log(`  → Genres: ${bookGenres.join(', ')}`);
    }

    // Step 3: Per-section extraction (skip [NON-CONTENT] sections)
    const substantiveSections = sections.filter(s => !s.title?.startsWith('[NON-CONTENT]'));
    log(`  → Extracting ${substantiveSections.length} substantive sections (skipping ${sections.length - substantiveSections.length} non-content)`);

    const allResults = new Array(sections.length).fill(null);

    for (let i = 0; i < substantiveSections.length; i++) {
      const sectionIdx = sections.indexOf(substantiveSections[i]);
      const section = substantiveSections[i];
      log(`    [${i + 1}/${substantiveSections.length}] "${section.title}" (chars ${section.start_char}-${section.end_char})`);

      try {
        const result = await extractSection(text_content, title, section, bookGenres);
        allResults[sectionIdx] = result;

        const summaryCount = result.summaries?.length || 0;
        const principleCount = result.framework?.principles?.length || 0;
        const actionCount = result.action_steps?.length || 0;
        const declCount = result.declarations?.length || 0;
        const questionCount = result.questions?.length || 0;
        log(`      → S:${summaryCount} F:${principleCount} A:${actionCount} D:${declCount} Q:${questionCount}`);
      } catch (sectionErr) {
        log(`    [SECTION ERROR] "${section.title}": ${sectionErr.message}`);
      }
    }

    // Step 4: Write to database
    log(`  → Writing to database...`);
    const counts = await writeExtractionResults(userId, id, title, sections, allResults);

    // Step 5: Update extraction_status
    const { error: statusErr } = await supabase
      .from('manifest_items')
      .update({ extraction_status: 'completed' })
      .eq('id', id);
    if (statusErr) log(`  [WARN] Failed to update extraction_status: ${statusErr.message}`);

    log(`[COMPLETED] "${title}" — frameworks:${counts.frameworks}, summaries:${counts.summaries}, declarations:${counts.declarations}, action_steps:${counts.action_steps}, questions:${counts.questions}`);
    return counts;

  } catch (err) {
    log(`[FAILED] "${title}": ${err.message}`);
    await supabase
      .from('manifest_items')
      .update({ extraction_status: 'failed' })
      .eq('id', id);
    return null;
  }
}

// ─── Process a book (questions only) ──────────────────────────────────────
async function processBookQuestionsOnly(userId, book, bookNum, totalBooks) {
  const { id, title, text_content, genres, discovered_sections } = book;
  log(`\n[Q-ONLY ${bookNum}/${totalBooks}] "${title}"`);

  try {
    if (!discovered_sections || discovered_sections.length === 0) {
      log(`  → No discovered_sections found, skipping (run full extraction instead)`);
      return null;
    }

    const sections = discovered_sections;
    const bookGenres = genres || ['non_fiction'];
    const substantiveSections = sections.filter(s => !s.title?.startsWith('[NON-CONTENT]'));
    log(`  → Extracting questions for ${substantiveSections.length} sections`);

    const allQuestions = new Array(sections.length).fill(null);

    for (let i = 0; i < substantiveSections.length; i++) {
      const sectionIdx = sections.indexOf(substantiveSections[i]);
      const section = substantiveSections[i];
      log(`    [${i + 1}/${substantiveSections.length}] "${section.title}"`);

      try {
        const questions = await extractQuestionsForSection(text_content, title, section, bookGenres);
        allQuestions[sectionIdx] = questions;
        log(`      → Q:${questions.length}`);
      } catch (sectionErr) {
        log(`    [SECTION ERROR] "${section.title}": ${sectionErr.message}`);
      }
    }

    log(`  → Writing questions to database...`);
    const count = await writeQuestionsOnly(userId, id, sections, allQuestions);
    log(`[COMPLETED Q-ONLY] "${title}" — questions:${count}`);
    return { questions: count };

  } catch (err) {
    log(`[FAILED Q-ONLY] "${title}": ${err.message}`);
    return null;
  }
}

// ─── Priority 1 book titles ────────────────────────────────────────────────
const PRIORITY_1_TITLES = [
  'Thinking Fast and Slow', 'Flow', 'Building a StoryBrand', 'Mindset',
  '5 Love Languages', 'Traction', 'Getting Things Done', 'Nonviolent Communication',
  'The Explosive Child', 'Introduction to Internal Family Systems', 'Emotional Agility',
  'How to ADHD', 'Uniquely Human', 'The Reason I Jump', 'Company of One',
  '$100M Offers', '$100M Leads', 'Show Your Work', 'Dumbing Us Down', 'Free to Learn',
  'The Wisdom of the Enneagram', 'StrengthsFinder', 'StandOut', 'How to Win Friends',
  'Executive Skills in Children', 'Mere Christianity', "Man's Search for Meaning",
  'How to Meal Plan', 'Mini Habits', 'The Seven Decisions', 'The Gifts of Imperfection',
  'The Dream Giver', 'Extreme Ownership', 'Make Your Bed', 'How to Read a Book',
  'The Happiness Project', 'The Hiding Place', 'How to Get Your Teen',
  'How to Get Your Husband', 'How to Save Your Marriage',
  'The Emotionally Destructive Marriage', 'The Emotionally Intelligent Teen',
  'Contagious Why Things', 'The Tipping Point', 'Outliers', 'Blink', 'Click',
  'Jim Rohn', 'The Writer\'s Journey', 'Nine Day Novel', 'How to Craft a Great Story',
  'Faster Smarter Louder', 'The Biology of Belief', 'Kids Beyond Limits',
  'Story Genius', 'The Challenger Sale', 'Sell It Like Serhant',
  'The Continuum Concept', "Now You're Speaking My Language"
];

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  initLog();
  log('=== StewardShip Batch Extraction Starting ===');

  // Get user ID
  const { data: authUser, error: authErr } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', USER_EMAIL)
    .maybeSingle();

  // Try auth.users if user_profiles doesn't have email
  let userId;
  if (authUser?.id) {
    userId = authUser.id;
  } else {
    // Use service role to query auth.users
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) {
      log(`ERROR: Could not list users: ${usersErr.message}`);
      process.exit(1);
    }
    const user = users.find(u => u.email === USER_EMAIL);
    if (!user) {
      log(`ERROR: User ${USER_EMAIL} not found`);
      process.exit(1);
    }
    userId = user.id;
  }
  log(`User ID: ${userId}`);

  // ── PRIORITY 1: Named books ──────────────────────────────────────────
  log('\n=== PRIORITY 1: Named priority books ===');
  const { data: allBooks, error: booksErr } = await supabase
    .from('manifest_items')
    .select('id, title, text_content, genres, discovered_sections, extraction_status')
    .eq('user_id', userId)
    .not('text_content', 'is', null)
    .eq('extraction_status', 'none');

  if (booksErr) {
    log(`ERROR: Could not fetch books: ${booksErr.message}`);
    process.exit(1);
  }

  // Find priority 1 books by fuzzy title match
  const priority1Books = [];
  for (const title of PRIORITY_1_TITLES) {
    const found = allBooks?.find(b =>
      b.title?.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(b.title?.toLowerCase() || '')
    );
    if (found && !priority1Books.find(b => b.id === found.id)) {
      priority1Books.push(found);
    }
  }
  log(`Found ${priority1Books.length} priority 1 books (out of ${allBooks?.length || 0} unextracted)`);

  // ── PRIORITY 2: Questions-only for completed books missing questions ─
  log('\n=== PRIORITY 2: Questions-only for completed books ===');
  const { data: completedBooks } = await supabase
    .from('manifest_items')
    .select('id, title, text_content, genres, discovered_sections')
    .eq('user_id', userId)
    .eq('extraction_status', 'completed')
    .not('text_content', 'is', null);

  // Find which completed books have no questions
  const questionsOnlyBooks = [];
  if (completedBooks && completedBooks.length > 0) {
    const { data: booksWithQuestions } = await supabase
      .from('manifest_questions')
      .select('manifest_item_id')
      .eq('user_id', userId)
      .in('manifest_item_id', completedBooks.map(b => b.id));

    const booksWithQuestionsSet = new Set((booksWithQuestions || []).map(r => r.manifest_item_id));
    for (const book of completedBooks) {
      if (!booksWithQuestionsSet.has(book.id)) {
        questionsOnlyBooks.push(book);
      }
    }
  }
  log(`Found ${questionsOnlyBooks.length} completed books missing questions`);

  // ── PRIORITY 3: Remaining unextracted books ──────────────────────────
  const priority1Ids = new Set(priority1Books.map(b => b.id));
  const priority3Books = (allBooks || []).filter(b => !priority1Ids.has(b.id));
  log(`\n=== PRIORITY 3: ${priority3Books.length} remaining unextracted books ===`);

  // ── Run all 3 priorities ─────────────────────────────────────────────
  const allToProcess = [
    ...priority1Books.map(b => ({ book: b, mode: 'full' })),
    ...questionsOnlyBooks.map(b => ({ book: b, mode: 'questions' })),
    ...priority3Books.map(b => ({ book: b, mode: 'full' })),
  ];

  log(`\n=== Total: ${allToProcess.length} books to process ===`);
  log(`  Priority 1 (full): ${priority1Books.length}`);
  log(`  Priority 2 (questions-only): ${questionsOnlyBooks.length}`);
  log(`  Priority 3 (full): ${priority3Books.length}`);

  let completed = 0;
  let failed = 0;
  const totalCounts = { frameworks: 0, summaries: 0, declarations: 0, action_steps: 0, questions: 0 };

  for (let i = 0; i < allToProcess.length; i++) {
    const { book, mode } = allToProcess[i];

    let result;
    if (mode === 'questions') {
      result = await processBookQuestionsOnly(userId, book, i + 1, allToProcess.length);
    } else {
      result = await processBook(userId, book, i + 1, allToProcess.length);
    }

    if (result) {
      completed++;
      totalCounts.frameworks += result.frameworks || 0;
      totalCounts.summaries += result.summaries || 0;
      totalCounts.declarations += result.declarations || 0;
      totalCounts.action_steps += result.action_steps || 0;
      totalCounts.questions += result.questions || 0;
    } else {
      failed++;
    }

    // Progress summary every 10 books
    if ((i + 1) % 10 === 0) {
      log(`\n[PROGRESS] ${i + 1}/${allToProcess.length} books processed (${completed} ok, ${failed} failed)`);
      log(`  Total extractions: frameworks:${totalCounts.frameworks}, summaries:${totalCounts.summaries}, declarations:${totalCounts.declarations}, action_steps:${totalCounts.action_steps}, questions:${totalCounts.questions}`);
    }

    // Delay between books
    if (i < allToProcess.length - 1) {
      await sleep(DELAY_BETWEEN_BOOKS_MS);
    }
  }

  // ── Final verification queries ───────────────────────────────────────
  log('\n=== VERIFICATION ===');
  const tables = ['ai_framework_principles', 'manifest_summaries', 'manifest_declarations', 'manifest_action_steps', 'manifest_questions'];
  const tableNames = ['frameworks', 'summaries', 'declarations', 'action_steps', 'questions'];

  for (let t = 0; t < tables.length; t++) {
    const { count, error } = await supabase
      .from(tables[t])
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (!error) log(`  ${tableNames[t]}: ${count?.toLocaleString() || 0} total rows`);
  }

  // Books by extraction status
  const { data: statusCounts } = await supabase
    .from('manifest_items')
    .select('extraction_status')
    .eq('user_id', userId);

  if (statusCounts) {
    const statusMap = {};
    for (const row of statusCounts) {
      statusMap[row.extraction_status] = (statusMap[row.extraction_status] || 0) + 1;
    }
    log(`  Books by status: ${JSON.stringify(statusMap)}`);
  }

  log(`\n=== DONE: ${completed} completed, ${failed} failed ===`);
}

main().catch(err => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
