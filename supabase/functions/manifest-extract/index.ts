import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Genre context block injected into prompts when genres are specified ---
function buildGenreContext(genres: string[]): string {
  if (!genres || genres.length === 0) return '';

  const genreGuidance: Record<string, string> = {
    non_fiction: 'This is non-fiction. Focus on key concepts, frameworks, actionable insights, and mental models the author teaches.',
    fiction: 'This is fiction. Focus on character development, thematic insights, allegorical meaning, lessons embedded in the story, and memorable quotes — lines of dialogue or narration that capture something profound, beautiful, or true. Fiction often carries its deepest wisdom in its most quotable lines.',
    biography_memoir: 'This is biography/memoir. Focus on pivotal life moments, character-defining decisions, relationship lessons, and wisdom earned through experience.',
    scriptures_sacred: 'This is scripture or sacred text. Focus on spiritual principles, doctrinal points, devotional insights, promises, and commandments. Treat the text with reverence.',
    workbook: 'This is a workbook or practical guide. Focus on exercises, self-assessment frameworks, action steps, and structured processes the reader is meant to apply.',
    textbook: 'This is a textbook or educational text. Focus on key definitions and terminology, core concepts and theories with their explanations, systematic knowledge progression, illustrative examples, and structured principles the author teaches. Extract the foundational ideas that build upon each other chapter by chapter.',
    poetry_essays: 'This is poetry or essay collection. Focus on imagery, emotional resonance, philosophical insights, and the distinctive voice/perspective of the author.',
    allegory_parable: 'This is allegory or parable. For the narrative_summary, cover both the surface events and hint at the symbolic layer beneath. Then extract: symbolic meanings beneath the surface narrative, moral lessons, teaching metaphors that illuminate truth, and memorable quotes — lines that distill the allegory\'s deeper meaning into words worth remembering.',
    devotional_spiritual_memoir: 'This is devotional or spiritual memoir. Focus on the spiritual growth journey, faith formation moments, personal revelation, and the intersection of lived experience with divine purpose.',
  };

  const lines = genres.map((g) => genreGuidance[g]).filter(Boolean);
  if (lines.length === 0) return '';

  if (lines.length === 1) {
    return `\n\nGENRE CONTEXT:\n${lines[0]}`;
  }
  return `\n\nGENRE CONTEXT (this content blends multiple genres — let all of these lenses inform your extraction):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// --- Go Deeper addendum appended when extracting additional content ---
function buildGoDeeperAddendum(existingItems: string[]): string {
  if (!existingItems || existingItems.length === 0) return '';
  const itemList = existingItems.map((item, i) => `${i + 1}. ${item}`).join('\n');
  return `\n\nGO DEEPER — ADDITIONAL EXTRACTION:
You are finding ADDITIONAL content not already captured. The following items have already been extracted. Do NOT duplicate or rephrase these — find genuinely new insights, principles, or content:

Already extracted:
${itemList}

Look for: overlooked nuances, secondary insights, supporting evidence, contrasting viewpoints, practical applications, and deeper implications not yet captured.`;
}

const FRAMEWORK_EXTRACTION_PROMPT = `You are an expert at distilling books and content into concise, actionable principles. Given the text of a book section or document, extract the key principles, mental models, and actionable frameworks.

Rules:
- COHESION RULE: A named process, technique, or system is ONE principle — never split its steps across multiple principles. But distinct standalone insights should each be their own principle even if they relate to a common theme.
- Be thorough — extract generously. Use section length as a rough guide: ~1 principle per 1,000-2,000 characters of input. A short section may produce 3-8 principles, a long one 10-20. It is better to capture a principle that turns out to be minor than to miss one that matters. Never pad with generic filler, but do not hold back on distinct, actionable content.
- Default principle length: 1-3 complete sentences. Never cut off mid-thought.
- EXCEPTION — Processes, systems, and step-by-step methods: When content describes a multi-step process, a system, or a sequential method, extract it as a structured principle with numbered steps. These may be 3-8 sentences to capture the full process.
- NEVER skip a named process, technique, step sequence, or method. If the content describes a specific procedure with steps (e.g., "The Rule of 3," "The 5-Step Correction Process," "How to disagree appropriately"), extract the COMPLETE process with all steps. These are often the most valuable content in the source material.
- Focus on ACTIONABLE insights — things that can guide decisions and behavior
- Include the source's unique language/metaphors when they capture concepts well
- Don't just summarize — extract the tools and models
- Avoid generic self-help platitudes. Extract what makes THIS source distinctive
- Include contrasts the author draws (e.g., "X vs Y" distinctions that help frame thinking)
- Every principle must be a COMPLETE thought. If you cannot fit it in 3 sentences, use more. A complete principle is always better than a truncated one.

Return ONLY a JSON object:
{
  "framework_name": "Suggested name for this framework",
  "principles": [
    { "text": "Principle statement here — complete thought, 1-3 sentences.", "sort_order": 0 },
    { "text": "Process-type principle: (1) First step. (2) Second step. (3) Third step. This captures the full method.", "sort_order": 1 }
  ]
}

No markdown backticks, no preamble.`;

const MAST_EXTRACTION_PROMPT = `You are helping someone identify personal principles and value statements from a document. Extract statements that could become guiding declarations — things someone would want to live by.

Rules:
- Extract 3-8 potential principles
- Frame as identity statements when possible: "I choose to...", "I am committed to...", "I believe..."
- Focus on VALUE statements, not information or tips
- These should feel personal and aspirational
- Include faith-related principles if the content has spiritual dimension

Return ONLY a JSON array:
[
  { "text": "I choose to...", "entry_type": "declaration" },
  { "text": "Value statement here", "entry_type": "value" }
]

Valid entry_type values: "value", "declaration", "faith_foundation", "scripture_quote", "vision"
No markdown backticks, no preamble.`;

const SUMMARY_EXTRACTION_PROMPT = `You are an expert at extracting the essential content from books and documents. Given the text, extract the key concepts, stories, metaphors, lessons, and insights that capture the essence of this content.

Rules:
- SECTION SYNOPSIS: ALWAYS begin with a "narrative_summary" item — a 3-6 sentence overview of what this section covers and its key takeaways. For fiction/allegory, summarize the plot events, character actions, and how the story advances. For non-fiction, summarize the chapter's argument, main points, and what the reader should take away. This anchors all the detailed extractions that follow.
- COHESION RULE: Group related ideas into a single item. A multi-step process, a complete story arc, or a cluster of related points from the same concept should be ONE item, not split across several. Prefer fewer, richer items over more granular ones.
- Use section length as a rough guide: ~1 item per 2,000-3,000 characters of input (not counting the narrative_summary). A short section should produce 2-5 items, a long one 8-15. Exceed this for genuinely dense content, but never pad with thin extractions to fill a quota.
- Each item should STAND ALONE — someone reading just that item should understand it without having read the book
- Capture diverse content types: key concepts, memorable stories, powerful metaphors, character insights, practical lessons, notable quotes, thematic observations
- Preserve the author's distinctive language when it captures something uniquely well
- For stories and examples, capture enough context to understand the point (2-4 sentences)
- For concepts and principles, be precise and complete (1-3 sentences)
- For quotes: extract the EXACT words from the text — do not paraphrase. Include the speaker or context in a brief note (e.g., "Aslan says: '...'"). Prioritize lines that are profound, beautiful, moving, or capture deep truth. These are lines someone would want to highlight and return to.
- Label each item with its content_type so the user can see what kind of content it is
- Do NOT extract trivial filler content — each item should be genuinely worth remembering

Return ONLY a JSON object:
{
  "items": [
    { "content_type": "narrative_summary", "text": "Synopsis of what this section covers and its key takeaways...", "sort_order": 0 },
    { "content_type": "key_concept", "text": "Clear explanation of the concept...", "sort_order": 1 },
    { "content_type": "story", "text": "Brief but complete retelling of the key story and its lesson...", "sort_order": 2 },
    { "content_type": "metaphor", "text": "The author's metaphor and what it illuminates...", "sort_order": 3 },
    { "content_type": "lesson", "text": "A practical lesson drawn from the content...", "sort_order": 4 },
    { "content_type": "quote", "text": "\"Exact quote from the text.\" — Speaker or context", "sort_order": 5 },
    { "content_type": "insight", "text": "A deeper insight or observation...", "sort_order": 6 }
  ]
}

Valid content_type values: "narrative_summary", "key_concept", "story", "metaphor", "lesson", "quote", "insight", "theme", "character_insight", "exercise", "principle"
No markdown backticks, no preamble.`;

const MAST_CONTENT_EXTRACTION_PROMPT = `You are helping someone distill the wisdom from a book into personal declarations — honest commitment statements they can live by.

Declarations are NOT affirmations. An affirmation claims a finished state ("I am patient"). A declaration claims a present truth ("I choose to respond with patience, even when it's hard"). The difference: every part of someone — mind, spirit, gut — can say "yes, that's true" about a declaration, right now, in the act of declaring it. No honesty gap. No inner friction.

THE HONESTY TEST: Can every part of the reader say "yes, that's true" RIGHT NOW? Not about some future self. Not if they squint. True in the act of declaring it. "I am patient" fails on a hard day. "I choose to respond with patience, even when everything in me wants to react" — the choosing is immediately true.

FIVE DECLARATION STYLES (use the style that best fits each insight — mix them freely):
1. "choosing_committing" — The truth is in the decision. "I choose courage over comfort, knowing that brave hearts change the world." / "I am committed to becoming someone my children feel safe with." / "When I feel anger rising, I will pause before I speak."
2. "recognizing_awakening" — Honors growth already happening. "I notice I am becoming someone who listens before reacting." / "I recognize that something in me is awakening — a hunger for depth over distraction." / "I see myself growing, even when the progress feels invisible."
3. "claiming_stepping_into" — Bold identity claims that become true the moment you decide to own them. "I carry dignity with calm strength." / "I hold fast to hope, a light that endures even when shadows fall." / "I claim the courage that has always been in me, waiting for permission to rise."
4. "learning_striving" — Respects the messy middle. "I am learning to sit with discomfort instead of running from it." / "I pursue wisdom like a hidden treasure, listening for truth in story, in study, and in stillness." / "I take steps to become a wise financial steward."
5. "resolute_unashamed" — Burns with conviction. A vow, a battle cry. "I will not look back, let up, slow down, or be still." / "I cannot be bought, compromised, detoured, or delayed." / "I do hard things until hard things become easy."

CRITICAL RULES:
- AVOID THE "I AM + FINISHED STATE" TRAP: Never produce declarations like "I am patient" or "I am confident" that claim an arrived state. The truth must live in the choosing, the claiming, the recognizing, the learning, or the resolve — not in a performance claim the reader's discernment will reject.
- STANDALONE RULE: Each declaration must make complete sense on its own, without having read the book. Someone reading just the declaration should understand what it means and why it matters.
- PERSONALITY RULE: Declarations should sound like a real person wrote them — not a self-help template. Include details, imagery, and language that give each one its own rhythm and voice. "I choose courage over comfort" has more soul than "I am brave."
- VARIETY RULE: Use DIFFERENT styles across your extractions. Don't default to just one style. The most powerful creeds draw from all five voices — a mix of gentle and fierce, choosing and standing firm.
- COHESION RULE: Don't create multiple declarations about the same idea from different angles — but distinct values or insights each deserve their own declaration.
- Extract 3-10 declarations depending on content richness. It is better to offer a declaration the user can delete than to miss one that would have resonated.
- Each declaration should connect to a genuine value or insight from the content
- Include an optional value_name (1-3 words) that names the underlying value: e.g., "Patience", "Courage Under Pressure", "Active Listening"
- Faith-connected declarations are appropriate when the source material has spiritual depth

Return ONLY a JSON object:
{
  "items": [
    { "value_name": "Intentional Presence", "declaration_text": "I choose to be fully present in conversations, putting down my phone and making eye contact, because the people in front of me deserve my attention.", "declaration_style": "choosing_committing", "sort_order": 0 },
    { "value_name": "Embracing Discomfort", "declaration_text": "I am learning to sit with discomfort instead of rushing to fix it, trusting that growth happens in the tension.", "declaration_style": "learning_striving", "sort_order": 1 }
  ]
}

No markdown backticks, no preamble.`;

const ACTION_STEPS_EXTRACTION_PROMPT = `You are an expert at translating book wisdom into concrete, actionable steps. Given a section of text, extract specific actions, exercises, practices, and steps that a reader can carry out to apply what they've learned.

Rules:
- Every action step must be SPECIFIC and ACTIONABLE — something someone can do today or this week. Not "be more mindful" but "Set a daily 5-minute timer and practice noticing three things you're grateful for."
- COHESION RULE: A multi-step exercise or practice is ONE item, not split across several. Include all steps together.
- Use section length as a rough guide: ~1 action step per 2,000-3,000 characters of input. A short section may produce 2-5 steps, a long one 8-15.
- Steps should STAND ALONE — someone reading just that step should understand what to do without having read the book.
- For exercises explicitly described in the text, preserve the author's method faithfully.
- For concepts without explicit exercises, CREATE practical action steps that embody the principle. These should be concrete, not generic.
- Include brief CONTEXT for why this action matters (1 sentence before or after the action).
- Label each with its content_type:
  - "exercise" — A structured activity described in the text
  - "practice" — An ongoing behavioral discipline to adopt
  - "habit" — A repeatable daily/weekly routine to build
  - "reflection_prompt" — A question or journaling prompt for self-reflection
  - "conversation_starter" — Something to discuss with a spouse, friend, or mentor
  - "project" — A larger undertaking (multi-day or multi-week)
  - "daily_action" — Something small to do each day
  - "weekly_practice" — Something to do weekly
- Avoid generic self-help platitudes. Every step should trace back to a SPECIFIC insight from this content.
- For fiction/allegory/memoir, derive action steps from the character's lessons, mistakes, or growth moments.

Return ONLY a JSON object:
{
  "items": [
    { "content_type": "exercise", "text": "Concrete exercise description with all steps...", "sort_order": 0 },
    { "content_type": "daily_action", "text": "Each morning, before checking your phone...", "sort_order": 1 }
  ]
}

Valid content_type values: "exercise", "practice", "habit", "reflection_prompt", "conversation_starter", "project", "daily_action", "weekly_practice"
No markdown backticks, no preamble.`;

const COMBINED_SECTION_PROMPT = `You are an expert at extracting the essential content from books and documents. Given a section of text, perform FOUR extraction tasks simultaneously and return all results in a single JSON response.

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
FIVE DECLARATION STYLES (mix freely — don't default to just one):
1. "choosing_committing" — The truth is in the decision: "I choose courage over comfort, knowing that brave hearts change the world." / "I am committed to becoming someone my children feel safe with."
2. "recognizing_awakening" — Honors growth happening: "I notice I am becoming someone who listens before reacting." / "I recognize that something in me is awakening."
3. "claiming_stepping_into" — Bold identity claims true the moment you own them: "I carry dignity with calm strength." / "I hold fast to hope, a light that endures even when shadows fall."
4. "learning_striving" — Respects the messy middle: "I am learning to sit with discomfort instead of running from it." / "I pursue wisdom like a hidden treasure."
5. "resolute_unashamed" — Burns with conviction, a vow: "I will not look back, let up, slow down, or be still." / "I do hard things until hard things become easy."
- AVOID THE "I AM + FINISHED STATE" TRAP: Never produce "I am patient" or "I am confident" — these claim an arrived state the reader's discernment will reject.
- PERSONALITY RULE: Each declaration should sound like a real person wrote it — details, imagery, its own rhythm. Not a self-help template.
- COHESION RULE: Don't create multiple declarations about the same idea from different angles — but distinct values or insights each deserve their own declaration.
- Extract 3-10 declarations depending on content richness. It is better to offer a declaration the user can delete than to miss one that would have resonated.
- STANDALONE RULE: Each declaration must make complete sense on its own
- Include an optional value_name (1-3 words) that names the underlying value
- Faith-connected declarations are appropriate when the source material has spiritual depth

=== TASK 4: ACTION STEPS ===
Extract concrete, actionable steps, exercises, practices, and activities that a reader can carry out to apply what they've learned from this section.
- Every action step must be SPECIFIC and ACTIONABLE — not "be more mindful" but "Set a daily 5-minute timer and practice noticing three things you're grateful for."
- COHESION RULE: A multi-step exercise or practice is ONE item. Include all steps together.
- Extract 3-8 action steps depending on content richness.
- Steps should STAND ALONE — understandable without having read the book.
- For exercises explicitly described in the text, preserve the author's method faithfully.
- For concepts without explicit exercises, CREATE practical action steps that embody the principle.
- Include brief context for why the action matters (1 sentence).
- For fiction/allegory/memoir, derive steps from the character's lessons, mistakes, or growth moments.
- Label each with its content_type: "exercise", "practice", "habit", "reflection_prompt", "conversation_starter", "project", "daily_action", "weekly_practice"
- Avoid generic self-help platitudes. Every step should trace back to a SPECIFIC insight from this section.

Return ONLY a JSON object with all four sections:
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
  ]
}

No markdown backticks, no preamble.`;

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

// Safely extract JSON from AI response — handles markdown fences and malformed output
function safeParseJSON(raw: string): { parsed: unknown; error?: string } {
  if (!raw || !raw.trim()) return { parsed: null, error: 'Empty AI response' };

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  // Try 1: Direct parse of cleaned content
  try {
    return { parsed: JSON.parse(cleaned) };
  } catch { /* fall through */ }

  // Try 2: Extract JSON object { ... }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return { parsed: JSON.parse(objMatch[0]) };
    } catch { /* fall through */ }
  }

  // Try 3: Extract JSON array starting with [{ (object array — most specific)
  const arrObjMatch = cleaned.match(/\[\s*\{[\s\S]*\}/);
  if (arrObjMatch) {
    // Find the matching close bracket for this array
    let candidate = arrObjMatch[0];
    // If there's a ] after the last }, grab it
    const afterMatch = cleaned.substring(cleaned.indexOf(candidate) + candidate.length);
    const closeBracket = afterMatch.match(/^\s*\]/);
    if (closeBracket) {
      candidate = candidate + closeBracket[0];
    } else {
      candidate = candidate + '\n]'; // Close truncated array
    }
    try {
      return { parsed: JSON.parse(candidate) };
    } catch { /* fall through */ }
  }

  // Try 3b: Extract any JSON array [ ... ]
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return { parsed: JSON.parse(arrMatch[0]) };
    } catch { /* fall through */ }
  }

  // Try 4: Truncated JSON array recovery — AI hit max_tokens and JSON was cut off
  // Find the JSON array start ([{) and recover from truncation
  const jsonArrayStart = cleaned.search(/\[\s*\{/);
  if (jsonArrayStart >= 0) {
    const fromArray = cleaned.substring(jsonArrayStart);
    const lastCompleteObj = fromArray.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      const truncated = fromArray.substring(0, lastCompleteObj + 1) + '\n]';
      try {
        const result = JSON.parse(truncated);
        if (Array.isArray(result) && result.length > 0) {
          console.log(`[safeParseJSON] Recovered truncated JSON array with ${result.length} items`);
          return { parsed: result };
        }
      } catch { /* fall through */ }
    }
  }

  // Try 5: Truncated JSON object recovery — for combined extraction responses
  // If the object was cut off mid-way, try to close open arrays and the object
  if (cleaned.startsWith('{')) {
    // Walk backwards from the end to find a salvageable point
    // Strategy: find the last complete value (after a complete string, number, ], or })
    // and close any open arrays/objects
    let attempt = cleaned;
    // Remove any trailing incomplete string (unclosed quote)
    const lastQuote = attempt.lastIndexOf('"');
    const quotesBefore = (attempt.substring(0, lastQuote).match(/"/g) || []).length;
    if (quotesBefore % 2 === 0) {
      // Even quotes before the last one means the last quote opens an unclosed string
      attempt = attempt.substring(0, lastQuote);
    }
    // Find the last clean break point (end of a complete value)
    const lastCleanBreak = Math.max(
      attempt.lastIndexOf('}'),
      attempt.lastIndexOf(']'),
      attempt.lastIndexOf('"'),
    );
    if (lastCleanBreak > 0) {
      let truncated = attempt.substring(0, lastCleanBreak + 1);
      // Count open vs close brackets to figure out what needs closing
      const openBraces = (truncated.match(/\{/g) || []).length;
      const closeBraces = (truncated.match(/\}/g) || []).length;
      const openBrackets = (truncated.match(/\[/g) || []).length;
      const closeBrackets = (truncated.match(/\]/g) || []).length;
      // Close any open arrays then objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) truncated += '}';
      try {
        const result = JSON.parse(truncated);
        if (result && typeof result === 'object') {
          console.log(`[safeParseJSON] Recovered truncated JSON object with keys: ${Object.keys(result).join(', ')}`);
          return { parsed: result };
        }
      } catch { /* fall through */ }
    }
  }

  return { parsed: null, error: 'Could not parse JSON from AI response' };
}

// Retry helper for transient API errors (429 rate limit, 502/503 gateway errors)
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    if (response.ok || attempt === maxRetries) return response;

    const status = response.status;
    // Only retry on transient errors
    if (status !== 429 && status !== 502 && status !== 503) return response;

    // Exponential backoff: 2s, 4s, 8s
    const delay = Math.pow(2, attempt + 1) * 1000;
    const retryAfter = response.headers.get('retry-after');
    const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 15000) : delay;
    console.log(`[manifest-extract] Retry ${attempt + 1}/${maxRetries} after ${status}, waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  // Should never reach here, but TypeScript needs it
  throw new Error('fetchWithRetry exhausted retries');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const jwt = authHeader.replace('Bearer ', '');
    const payloadB64 = jwt.split('.')[1];
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const jwtPayload = JSON.parse(atob(b64));
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const requestBody = await req.json();
    const {
      manifest_item_id,
      extraction_type,
      genres,
      go_deeper,
      existing_items,
      section_start,
      section_end,
      section_title,
    } = requestBody;

    if (!manifest_item_id || !extraction_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: manifest_item_id, extraction_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the item's text content
    console.log(`[manifest-extract] Fetching item ${manifest_item_id} for user ${userId}, type=${extraction_type}`);
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('text_content, title')
      .eq('id', manifest_item_id)
      .eq('user_id', userId)
      .single();

    if (fetchErr) {
      console.error(`[manifest-extract] Fetch error:`, fetchErr.message, fetchErr.code);
      // Check if the item exists at all (might belong to a different user)
      const { data: anyItem } = await supabase
        .from('manifest_items')
        .select('user_id, title, processing_status')
        .eq('id', manifest_item_id)
        .maybeSingle();
      if (anyItem) {
        console.error(`[manifest-extract] Item exists but belongs to user ${anyItem.user_id} (caller: ${userId}), status=${anyItem.processing_status}, title="${anyItem.title}"`);
      } else {
        console.error(`[manifest-extract] Item ${manifest_item_id} does not exist in database at all`);
      }
      return new Response(
        JSON.stringify({ error: `Item fetch failed: ${fetchErr.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!item?.text_content) {
      console.error(`[manifest-extract] Item found but no text_content. title="${item?.title}", has text_content=${!!item?.text_content}`);
      return new Response(
        JSON.stringify({ error: 'Item has no text content. Try reprocessing the file.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.log(`[manifest-extract] Loaded item "${item.title}", text_content length=${item.text_content.length} chars`);

    // Get API key
    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_api_key_encrypted')
      .eq('user_id', userId)
      .maybeSingle();

    let apiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
    if (settings?.ai_api_key_encrypted) {
      apiKey = settings.ai_api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openRouterHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
      'X-Title': 'StewardShip',
    };

    const genreContext = buildGenreContext(genres || []);
    const goDeeperAddendum = go_deeper ? buildGoDeeperAddendum(existing_items || []) : '';

    // --- Section Discovery (Haiku — cheap structural classification) ---
    if (extraction_type === 'discover_sections') {
      // Haiku 4.5 context = 200K tokens. Reserve ~5K for system prompt + response.
      // Real-world token:char ratio varies (3.5-4.2 chars/token depending on content).
      // Use conservative 600K chars (~150-170K tokens) to stay safely within limits.
      const MAX_DISCOVERY_CHARS = 600_000;
      let discoveryText = item.text_content;
      console.log(`[manifest-extract] discover_sections: doc length=${discoveryText.length} chars`);
      if (discoveryText.length > MAX_DISCOVERY_CHARS) {
        // Take evenly-spaced samples across the full document to capture all chapter headings.
        // Reserve one sample slot for the document tail to ensure we never miss final chapters.
        const sampleSize = 15_000;    // chars per sample window
        const totalSamples = Math.floor(MAX_DISCOVERY_CHARS / sampleSize); // ~40 samples
        const numMiddleSamples = totalSamples - 1; // reserve 1 for the tail
        const step = Math.floor(discoveryText.length / numMiddleSamples);
        const samples: string[] = [];
        for (let i = 0; i < numMiddleSamples; i++) {
          const start = i * step;
          const end = Math.min(start + sampleSize, discoveryText.length);
          samples.push(
            `[POSITION: chars ${start}-${end} of ${discoveryText.length}]\n`
            + discoveryText.substring(start, end)
          );
        }
        // Always include the tail of the document so the last chapter(s) are visible
        const tailStart = Math.max(0, discoveryText.length - sampleSize);
        // Only add tail if it doesn't overlap significantly with the last middle sample
        const lastMiddleEnd = (numMiddleSamples - 1) * step + sampleSize;
        if (tailStart > lastMiddleEnd - sampleSize / 2) {
          samples.push(
            `[POSITION: chars ${tailStart}-${discoveryText.length} of ${discoveryText.length} — DOCUMENT END]\n`
            + discoveryText.substring(tailStart)
          );
        }
        discoveryText = samples.join('\n\n---\n\n');
        console.log(`[manifest-extract] discover_sections: sampled ${samples.length} windows (${discoveryText.length} chars) from ${item.text_content.length} char doc`);
      }

      const discoveryPayload = JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 8192,
        messages: [
          { role: 'system', content: SECTION_DISCOVERY_PROMPT },
          { role: 'user', content: `Document (${item.text_content.length} characters total):\n\n${discoveryText}` },
        ],
      });
      console.log(`[manifest-extract] discover_sections: sending ${discoveryPayload.length} byte payload (${discoveryText.length} chars of text)`);

      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: discoveryPayload,
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[manifest-extract] discover_sections AI error:', response.status, errBody.substring(0, 800));
        // Return 200 with error field so Supabase client doesn't swallow the details
        let detail = '';
        try { detail = JSON.parse(errBody)?.error?.message || errBody.substring(0, 300); } catch { detail = errBody.substring(0, 300); }
        return new Response(
          JSON.stringify({ error: `Section discovery failed (AI ${response.status}): ${detail}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log('[manifest-extract] discover_sections raw response length:', content.length);

      const { parsed, error: parseErr } = safeParseJSON(content);
      // Unwrap if AI returned { sections: [...] } instead of bare array
      let sectionsRaw = parsed;
      if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as Record<string, unknown>).sections)) {
        console.log('[manifest-extract] discover_sections: unwrapping { sections: [...] } wrapper');
        sectionsRaw = (parsed as Record<string, unknown>).sections;
      }
      if (!sectionsRaw || !Array.isArray(sectionsRaw)) {
        console.error('[manifest-extract] discover_sections parse failed:', parseErr, 'raw:', content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: parseErr || 'Failed to parse section discovery result' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      let sections = sectionsRaw as Array<Record<string, unknown>>;
      const docLength = item.text_content.length;

      // Validate: force full coverage with no gaps
      if (sections.length > 0) {
        sections[0].start_char = 0;
        sections[sections.length - 1].end_char = docLength;
        for (let i = 1; i < sections.length; i++) {
          sections[i].start_char = sections[i - 1].end_char;
        }
      }

      return new Response(
        JSON.stringify({ extraction_type: 'discover_sections', sections, total_chars: docLength }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Combined per-section extraction (all 3 types in one API call) ---
    if (extraction_type === 'combined_section') {
      if (section_start == null || section_end == null) {
        return new Response(
          JSON.stringify({ error: 'section_start and section_end required for section extraction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let sectionText = item.text_content.substring(section_start, section_end);

      const MAX_SECTION_CHARS = 80_000;
      if (sectionText.length > MAX_SECTION_CHARS) {
        console.log(`[manifest-extract] combined_section section="${section_title}" truncated from ${sectionText.length} to ${MAX_SECTION_CHARS} chars`);
        sectionText = sectionText.substring(0, MAX_SECTION_CHARS)
          + `\n\n[... ${sectionText.length - MAX_SECTION_CHARS} characters truncated ...]`;
      }

      const fullPrompt = COMBINED_SECTION_PROMPT + genreContext;

      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          max_tokens: 16384,
          messages: [
            { role: 'system', content: fullPrompt },
            {
              role: 'user',
              content: `Document title: "${item.title}"\nSection: "${section_title || 'Untitled'}"\n\nContent:\n${sectionText}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[manifest-extract] combined_section AI error:', response.status, errBody.substring(0, 800));
        return new Response(
          JSON.stringify({ error: `AI error (${response.status}): ${errBody.substring(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
      console.log(`[manifest-extract] combined_section section="${section_title}" raw response length: ${content.length}, finish_reason: ${finishReason}`);
      if (finishReason === 'length') {
        console.warn(`[manifest-extract] combined_section TRUNCATED for section="${section_title}" — response hit max_tokens limit. JSON may be incomplete.`);
      }

      const { parsed: result, error: parseErr } = safeParseJSON(content);
      if (!result) {
        console.error('[manifest-extract] combined_section parse failed:', parseErr, 'raw:', content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: parseErr || 'Failed to parse combined extraction result' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Sanitize declaration_style on declarations
      const resultObj = result as Record<string, unknown>;
      const declarations = resultObj?.declarations as Array<Record<string, unknown>> | undefined;
      if (declarations && Array.isArray(declarations)) {
        const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
        for (const decl of declarations) {
          if (!decl.declaration_style || !VALID_STYLES.includes(decl.declaration_style as string)) {
            decl.declaration_style = 'choosing_committing';
          }
        }
      }

      return new Response(
        JSON.stringify({ extraction_type: 'combined_section', result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Per-Section extraction types (framework_section, summary_section, mast_content_section) ---
    // Used for Go Deeper and Re-run (single tab at a time)
    const sectionTypes = ['framework_section', 'summary_section', 'mast_content_section', 'action_steps_section'];
    if (sectionTypes.includes(extraction_type)) {
      if (section_start == null || section_end == null) {
        return new Response(
          JSON.stringify({ error: 'section_start and section_end required for section extraction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let sectionText = item.text_content.substring(section_start, section_end);

      const MAX_SECTION_CHARS = 80_000;
      if (sectionText.length > MAX_SECTION_CHARS) {
        console.log(`[manifest-extract] ${extraction_type} section="${section_title}" truncated from ${sectionText.length} to ${MAX_SECTION_CHARS} chars`);
        sectionText = sectionText.substring(0, MAX_SECTION_CHARS)
          + `\n\n[... ${sectionText.length - MAX_SECTION_CHARS} characters truncated ...]`;
      }

      let basePrompt: string;
      if (extraction_type === 'framework_section') {
        basePrompt = FRAMEWORK_EXTRACTION_PROMPT;
      } else if (extraction_type === 'summary_section') {
        basePrompt = SUMMARY_EXTRACTION_PROMPT;
      } else if (extraction_type === 'action_steps_section') {
        basePrompt = ACTION_STEPS_EXTRACTION_PROMPT;
      } else {
        basePrompt = MAST_CONTENT_EXTRACTION_PROMPT;
      }

      const fullPrompt = basePrompt + genreContext + goDeeperAddendum;

      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: fullPrompt },
            {
              role: 'user',
              content: `Document title: "${item.title}"\nSection: "${section_title || 'Untitled'}"\n\nContent:\n${sectionText}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return new Response(
          JSON.stringify({ error: `AI error: ${errBody}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log(`[manifest-extract] ${extraction_type} section="${section_title}" raw response length:`, content.length);

      const { parsed: result, error: parseErr } = safeParseJSON(content);
      if (!result) {
        console.error(`[manifest-extract] ${extraction_type} parse failed:`, parseErr, 'raw:', content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: parseErr || 'Failed to parse extraction result' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Sanitize mast_content results: ensure declaration_style is always present
      if (extraction_type === 'mast_content_section') {
        const resultObj = result as { items?: Array<Record<string, unknown>> };
        if (resultObj?.items && Array.isArray(resultObj.items)) {
          const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
          for (const item of resultObj.items) {
            if (!item.declaration_style || !VALID_STYLES.includes(item.declaration_style as string)) {
              item.declaration_style = 'choosing_committing';
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ extraction_type, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Standard extraction types (framework, mast, summary, mast_content) ---
    let systemPrompt: string;
    switch (extraction_type) {
      case 'framework':
        systemPrompt = FRAMEWORK_EXTRACTION_PROMPT;
        break;
      case 'mast':
        // Legacy Mast extraction (values/declarations for The Mast page)
        systemPrompt = MAST_EXTRACTION_PROMPT;
        break;
      case 'summary':
        systemPrompt = SUMMARY_EXTRACTION_PROMPT;
        break;
      case 'mast_content':
        systemPrompt = MAST_CONTENT_EXTRACTION_PROMPT;
        break;
      case 'action_steps':
        systemPrompt = ACTION_STEPS_EXTRACTION_PROMPT;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid extraction_type. Must be: framework, mast, summary, mast_content, action_steps, discover_sections, framework_section, summary_section, mast_content_section, action_steps_section, combined_section' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    const fullPrompt = systemPrompt + genreContext + goDeeperAddendum;

    // Truncate very large documents for whole-document extraction
    let contentToSend = item.text_content;
    const MAX_WHOLE_DOC_CHARS = 120_000;
    if (contentToSend.length > MAX_WHOLE_DOC_CHARS) {
      console.log(`[manifest-extract] ${extraction_type} whole-doc truncated from ${contentToSend.length} to ${MAX_WHOLE_DOC_CHARS} chars`);
      contentToSend = contentToSend.substring(0, MAX_WHOLE_DOC_CHARS)
        + `\n\n[... ${contentToSend.length - MAX_WHOLE_DOC_CHARS} characters truncated ...]`;
    }

    // Use Sonnet for extraction — deep reasoning work
    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders,
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: `Document title: "${item.title}"\n\nContent:\n${contentToSend}` },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(
        JSON.stringify({ error: `AI error: ${errBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`[manifest-extract] ${extraction_type} raw response length:`, content.length);

    const { parsed: result, error: parseErr } = safeParseJSON(content);
    if (!result) {
      console.error(`[manifest-extract] ${extraction_type} parse failed:`, parseErr, 'raw:', content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: parseErr || 'Failed to parse extraction result' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Sanitize mast_content results: ensure declaration_style is always present
    if (extraction_type === 'mast_content') {
      const resultObj = result as { items?: Array<Record<string, unknown>> };
      if (resultObj?.items && Array.isArray(resultObj.items)) {
        const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
        for (const item of resultObj.items) {
          if (!item.declaration_style || !VALID_STYLES.includes(item.declaration_style as string)) {
            item.declaration_style = 'choosing_committing';
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ extraction_type, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Extraction failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
