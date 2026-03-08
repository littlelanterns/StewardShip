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
    fiction: 'This is fiction. Focus on character development, thematic insights, narrative arcs, allegorical meaning, and lessons embedded in the story.',
    biography_memoir: 'This is biography/memoir. Focus on pivotal life moments, character-defining decisions, relationship lessons, and wisdom earned through experience.',
    scriptures_sacred: 'This is scripture or sacred text. Focus on spiritual principles, doctrinal points, devotional insights, promises, and commandments. Treat the text with reverence.',
    workbook: 'This is a workbook or practical guide. Focus on exercises, self-assessment frameworks, action steps, and structured processes the reader is meant to apply.',
    poetry_essays: 'This is poetry or essay collection. Focus on imagery, emotional resonance, philosophical insights, and the distinctive voice/perspective of the author.',
    allegory_parable: 'This is allegory or parable. Focus on the symbolic meanings beneath the surface narrative, moral lessons, and teaching metaphors that illuminate truth.',
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
- Extract 5-20 principles depending on content richness (more for richer content, fewer for shorter sections)
- Default principle length: 1-3 complete sentences. Never cut off mid-thought.
- EXCEPTION — Processes, systems, and step-by-step methods: When content describes a multi-step process, a system, or a sequential method, extract it as a structured principle with numbered steps. These may be 3-8 sentences to capture the full process.
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
- Extract 5-20 items depending on content richness
- Each item should STAND ALONE — someone reading just that item should understand it without having read the book
- Capture diverse content types: key concepts, memorable stories, powerful metaphors, character insights, practical lessons, notable quotes, thematic observations
- Preserve the author's distinctive language when it captures something uniquely well
- For stories and examples, capture enough context to understand the point (2-4 sentences)
- For concepts and principles, be precise and complete (1-3 sentences)
- Label each item with its content_type so the user can see what kind of content it is
- Do NOT extract trivial filler content — each item should be genuinely worth remembering

Return ONLY a JSON object:
{
  "items": [
    { "content_type": "key_concept", "text": "Clear explanation of the concept...", "sort_order": 0 },
    { "content_type": "story", "text": "Brief but complete retelling of the key story and its lesson...", "sort_order": 1 },
    { "content_type": "metaphor", "text": "The author's metaphor and what it illuminates...", "sort_order": 2 },
    { "content_type": "lesson", "text": "A practical lesson drawn from the content...", "sort_order": 3 },
    { "content_type": "quote", "text": "A notable quote from the text...", "sort_order": 4 },
    { "content_type": "insight", "text": "A deeper insight or observation...", "sort_order": 5 }
  ]
}

Valid content_type values: "key_concept", "story", "metaphor", "lesson", "quote", "insight", "theme", "character_insight", "exercise", "principle"
No markdown backticks, no preamble.`;

const MAST_CONTENT_EXTRACTION_PROMPT = `You are helping someone distill the wisdom from a book into personal declarations — honest commitment statements they can live by.

FIVE DECLARATION STYLES (use the style that best fits each insight):
1. "choosing_committing" — Active choice: "I choose to..." / "I am committed to..." / "When I feel X, I will Y"
2. "recognizing_awakening" — New awareness: "I now see that..." / "I recognize that..." / "I am awakening to..."
3. "claiming_stepping_into" — Identity claim: "I am someone who..." / "I am stepping into..." / "I claim..."
4. "learning_striving" — Growth posture: "I am learning to..." / "I strive to..." / "I am growing in..."
5. "resolute_unashamed" — Bold commitment: "I will not apologize for..." / "I refuse to..." / "I unapologetically..."

CRITICAL RULES:
- STANDALONE RULE: Each declaration must make complete sense on its own, without having read the book. Someone reading just the declaration should understand what it means and why it matters.
- HONESTY TEST: "If someone who knows me well read this, would they see it as honest, or as performance?" Prefer honest aspiration over performative confidence.
- Extract 3-10 declarations depending on content richness
- Each declaration should connect to a genuine value or insight from the content
- Include an optional value_name (1-3 words) that names the underlying value: e.g., "Patience", "Courage Under Pressure", "Active Listening"
- Use DIFFERENT styles across your extractions — don't default to just one style
- Faith-connected declarations are appropriate when the source material has spiritual depth

Return ONLY a JSON object:
{
  "items": [
    { "value_name": "Intentional Presence", "declaration_text": "I choose to be fully present in conversations, putting down my phone and making eye contact, because the people in front of me deserve my attention.", "declaration_style": "choosing_committing", "sort_order": 0 },
    { "value_name": "Embracing Discomfort", "declaration_text": "I am learning to sit with discomfort instead of rushing to fix it, trusting that growth happens in the tension.", "declaration_style": "learning_striving", "sort_order": 1 }
  ]
}

No markdown backticks, no preamble.`;

const SECTION_DISCOVERY_PROMPT = `You are analyzing a document to identify its natural sections or chapters for principle extraction.

Given the text below, identify the major sections, chapters, or topic boundaries.

CRITICAL RULES:
- Sections must cover the ENTIRE document with NO GAPS. Every character must belong to a section.
- Section boundaries must be contiguous: section 1 ends where section 2 begins, section 2 ends where section 3 begins, etc.
- The first section must start at character 0. The last section must end at the final character of the document.
- Identify 3-15 sections depending on document length and structure
- Use chapter headings if they exist in the text
- If no clear chapter structure, identify major topic shifts
- Each section should be substantial enough to contain extractable principles (at least 2000 characters)
- Section titles should be descriptive of the CONTENT, not just "Chapter 1"
- Include ALL content — introductions, conclusions, and all chapters. The user will choose which to skip.

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

  // Try 3: Extract JSON array [ ... ]
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return { parsed: JSON.parse(arrMatch[0]) };
    } catch { /* fall through */ }
  }

  return { parsed: null, error: 'Could not parse JSON from AI response' };
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
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('text_content, title')
      .eq('id', manifest_item_id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !item?.text_content) {
      return new Response(
        JSON.stringify({ error: 'Item not found or no text content' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
      // For discovery we need structural markers, not full content.
      // Haiku context ~200K tokens. Keep text under 150K chars (~37K tokens)
      // to leave room for system prompt + response. For larger docs, sample head + tail.
      const MAX_DISCOVERY_CHARS = 150_000;
      let discoveryText = item.text_content;
      console.log(`[manifest-extract] discover_sections: doc length=${discoveryText.length} chars`);
      if (discoveryText.length > MAX_DISCOVERY_CHARS) {
        const headSize = 120_000;
        const tailSize = 25_000;
        discoveryText = discoveryText.substring(0, headSize)
          + `\n\n[... ${discoveryText.length - headSize - tailSize} characters omitted for section discovery ...]\n\n`
          + discoveryText.substring(discoveryText.length - tailSize);
        console.log(`[manifest-extract] discover_sections: truncated to ${discoveryText.length} chars`);
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4.5',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: SECTION_DISCOVERY_PROMPT },
            { role: 'user', content: `Document (${item.text_content.length} characters total):\n\n${discoveryText}` },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[manifest-extract] discover_sections AI error:', response.status, errBody.substring(0, 800));
        return new Response(
          JSON.stringify({ error: `Section discovery failed (AI ${response.status}): ${errBody.substring(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log('[manifest-extract] discover_sections raw response length:', content.length);

      const { parsed, error: parseErr } = safeParseJSON(content);
      if (!parsed || !Array.isArray(parsed)) {
        console.error('[manifest-extract] discover_sections parse failed:', parseErr, 'raw:', content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: parseErr || 'Failed to parse section discovery result' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      let sections = parsed as Array<Record<string, unknown>>;
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

    // --- Per-Section extraction types (framework_section, summary_section, mast_content_section) ---
    const sectionTypes = ['framework_section', 'summary_section', 'mast_content_section'];
    if (sectionTypes.includes(extraction_type)) {
      if (section_start == null || section_end == null) {
        return new Response(
          JSON.stringify({ error: 'section_start and section_end required for section extraction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let sectionText = item.text_content.substring(section_start, section_end);

      // Truncate very large sections to avoid exceeding token limits (~80K chars ≈ 20K tokens)
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
      } else {
        basePrompt = MAST_CONTENT_EXTRACTION_PROMPT;
      }

      const fullPrompt = basePrompt + genreContext + goDeeperAddendum;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid extraction_type. Must be: framework, mast, summary, mast_content, discover_sections, framework_section, summary_section, mast_content_section' }),
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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
