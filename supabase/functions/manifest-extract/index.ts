import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRAMEWORK_EXTRACTION_PROMPT = `You are an expert at distilling books and content into concise, actionable principles. Given the text of a book section or document, extract the key principles, mental models, and actionable frameworks.

Rules:
- Extract 5-15 principles (more for richer content, fewer for shorter sections)
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

const KEEL_EXTRACTION_PROMPT = `You are helping someone extract self-knowledge from a document. This might be personality test results, therapy insights, self-assessments, or any content that reveals things about who they are.

Rules:
- Extract factual self-knowledge statements
- Frame objectively: "Tends to...", "Strength in...", "Growth area:..."
- Include personality traits, cognitive patterns, communication styles, triggers, strengths, growth areas
- Respect the source framework's language (e.g., Enneagram types, DISC profiles, StrengthsFinder themes)

Return ONLY a JSON array:
[
  { "category": "personality_assessment", "text": "Detailed description" }
]

Valid categories: "personality_assessment", "trait_tendency", "strength", "growth_area", "you_inc", "general"
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
    // Supabase validates JWT before Edge Function runs — decode for user_id
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
    const { manifest_item_id, extraction_type } = requestBody;

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

    // --- Section Discovery (Haiku — cheap structural classification) ---
    if (extraction_type === 'discover_sections') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4.5',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: SECTION_DISCOVERY_PROMPT },
            { role: 'user', content: `Document (${item.text_content.length} characters):\n\n${item.text_content}` },
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

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: 'Failed to parse section discovery result', raw: content }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const sections = JSON.parse(jsonMatch[0]);
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

    // --- Per-Section Framework Extraction (Sonnet) ---
    if (extraction_type === 'framework_section') {
      const { section_start, section_end, section_title } = requestBody;

      if (section_start == null || section_end == null) {
        return new Response(
          JSON.stringify({ error: 'section_start and section_end required for framework_section' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const sectionText = item.text_content.substring(section_start, section_end);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: FRAMEWORK_EXTRACTION_PROMPT },
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

      const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: 'Failed to parse extraction result', raw: content }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const result = JSON.parse(jsonMatch[0]);

      return new Response(
        JSON.stringify({ extraction_type: 'framework_section', result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Standard extraction types (framework, mast, keel) ---

    let systemPrompt: string;
    switch (extraction_type) {
      case 'framework':
        systemPrompt = FRAMEWORK_EXTRACTION_PROMPT;
        break;
      case 'mast':
        systemPrompt = MAST_EXTRACTION_PROMPT;
        break;
      case 'keel':
        systemPrompt = KEEL_EXTRACTION_PROMPT;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid extraction_type. Must be: framework, mast, keel, discover_sections, framework_section' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    // Send full content for single-pass extraction (no truncation)
    const contentToSend = item.text_content;

    // Use Sonnet for extraction — deep reasoning work
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders,
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
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

    // Parse JSON from response
    const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse extraction result', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = JSON.parse(jsonMatch[0]);

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
