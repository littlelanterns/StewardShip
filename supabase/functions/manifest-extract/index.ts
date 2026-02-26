import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRAMEWORK_EXTRACTION_PROMPT = `You are an expert at distilling books and content into concise, actionable principles. Given the text of a book or document, extract the key principles, mental models, and actionable frameworks.

Rules:
- Extract 8-15 principles (more for longer/richer content, fewer for shorter)
- Each principle should be a concise statement (1-3 sentences max)
- Focus on ACTIONABLE insights — things that can guide decisions and behavior
- Include the book's unique language/metaphors when they capture concepts well
- Don't just summarize — extract the tools and models
- Avoid generic self-help platitudes. Extract what makes THIS source distinctive
- Include contrasts the author draws (e.g., "X vs Y" distinctions that help frame thinking)

Return ONLY a JSON object:
{
  "framework_name": "Suggested name for this framework (usually the book title)",
  "principles": [
    { "text": "Principle statement here", "sort_order": 0 },
    { "text": "Another principle", "sort_order": 1 }
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
    const jwtPayload = JSON.parse(atob(jwt.split('.')[1]));
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const { manifest_item_id, extraction_type } = await req.json();

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

    // Select prompt based on extraction type
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
          JSON.stringify({ error: 'Invalid extraction_type. Must be: framework, mast, keel' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    // For very long content, send strategic portions:
    // First ~30K chars (beginning) + last ~10K chars (conclusion/summary)
    let contentToSend = item.text_content;
    if (contentToSend.length > 40000) {
      const beginning = contentToSend.substring(0, 30000);
      const ending = contentToSend.substring(contentToSend.length - 10000);
      contentToSend = `${beginning}\n\n[...middle content omitted for length...]\n\n${ending}`;
    }

    // Use Sonnet for extraction — deep reasoning work
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 2048,
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
