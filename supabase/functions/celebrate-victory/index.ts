import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIFE_AREA_TAGS = [
  'spiritual', 'marriage', 'family', 'physical', 'emotional',
  'social', 'professional', 'financial', 'personal_development', 'service',
];

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

    const { description, mast_entries, wheel_hubs, mode } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get API key
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_api_key_encrypted, ai_model')
      .eq('user_id', userId)
      .maybeSingle();

    let apiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
    if (settings?.ai_api_key_encrypted) {
      apiKey = settings.ai_api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ items: [{ celebration_text: null, life_area_tag: null, mast_connection_id: null, wheel_connection_id: null, description }] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';

    // Build system prompt based on mode
    let systemPrompt: string;
    let userMessage: string;

    if (mode === 'review') {
      systemPrompt = `You generate warm, identity-based victory review narratives. Rules:
- Write a conversational narrative reflecting on the victories, NOT a bulleted list.
- Connect victories to identity, principles, and growth themes when possible.
- Never generic ("Great job!"), never parental ("I'm so proud!").
- Warm but not gushing. 2-4 paragraphs.
- No emoji.
- If Mast principles are provided, reference them naturally when victories connect.
- Frame accomplishments as evidence of who the person is becoming.`;

      userMessage = `Write a warm reflective narrative about these victories:\n\n${description}`;

      if (mast_entries) {
        userMessage += `\n\nUser's guiding principles:\n${mast_entries}`;
      }
    } else if (mode === 'monthly') {
      systemPrompt = `You generate warm monthly victory summary narratives. Rules:
- Write a reflective overview of the month's accomplishments (2-3 paragraphs).
- Identity-based celebration, connect to growth themes.
- Highlight patterns and standout victories.
- Never generic, never parental.
- No emoji.`;

      userMessage = `Write a monthly victory summary:\n\n${description}`;

      if (mast_entries) {
        userMessage += `\n\nUser's guiding principles:\n${mast_entries}`;
      }
    } else {
      // Default: individual or multi-victory celebration
      // The AI detects whether the input contains multiple items
      systemPrompt = `You celebrate victories with identity-based text. The user may describe ONE victory or MULTIPLE victories in a single message.

MULTI-ITEM DETECTION:
- If the input contains commas, "and", line breaks, or numbered items listing separate accomplishments, treat each as a SEPARATE victory.
- Examples of multi-item input: "Got kids dressed, finished laundry, called the dentist" or "Ran 3 miles and meal prepped for the week"
- If it's clearly one accomplishment described in detail, treat it as a single item.

Respond with a JSON object containing an "items" array. Each item has:
- "description": the individual victory text (cleaned up, one accomplishment per item)
- "celebration_text": 1-3 sentences connecting the accomplishment to who the person is becoming. Never generic ("Great job!"), never parental ("I'm so proud!"). Warm but not gushing. No emoji.
- "life_area_tag": exactly one tag from this list: ${LIFE_AREA_TAGS.join(', ')}
- "mast_connection_id": the ID of a Mast entry this victory connects to (or null if no clear connection)
- "wheel_connection_id": the ID of a Wheel this victory connects to (or null if no clear connection)

Example single-item response:
{"items": [{"description": "Ran my first 5K", "celebration_text": "...", "life_area_tag": "physical", "mast_connection_id": null, "wheel_connection_id": null}]}

Example multi-item response:
{"items": [{"description": "Got kids dressed", ...}, {"description": "Finished laundry", ...}, {"description": "Called the dentist", ...}]}

Respond with ONLY valid JSON, nothing else.`;

      userMessage = `Victory: "${description}"`;

      if (mast_entries) {
        userMessage += `\n\nUser's Mast principles (with IDs):\n${mast_entries}`;
      }
      if (wheel_hubs) {
        userMessage += `\n\nActive Wheels (with IDs):\n${wheel_hubs}`;
      }
    }

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model,
        max_tokens: mode === 'review' || mode === 'monthly' ? 500 : 600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      return new Response(
        JSON.stringify({ items: [{ celebration_text: null, life_area_tag: null, mast_connection_id: null, wheel_connection_id: null, description }] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // For review/monthly modes, return the narrative directly
    if (mode === 'review' || mode === 'monthly') {
      return new Response(
        JSON.stringify({ narrative: content.trim() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Strip markdown code fences that LLMs often wrap around JSON
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Parse JSON response for victory celebration(s)
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Second attempt: extract first { ... } block
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          parsed = JSON.parse(braceMatch[0]);
        } catch {
          // Give up on JSON parsing
        }
      }
    }

    if (parsed) {
      // Handle the multi-item format
      if (parsed.items && Array.isArray(parsed.items)) {
        const items = (parsed.items as Array<Record<string, string | null | undefined>>).map((item) => ({
          description: item.description || description,
          celebration_text: item.celebration_text || null,
          life_area_tag: LIFE_AREA_TAGS.includes(item.life_area_tag || '') ? item.life_area_tag : null,
          mast_connection_id: item.mast_connection_id || null,
          wheel_connection_id: item.wheel_connection_id || null,
        }));

        return new Response(
          JSON.stringify({ items }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Single-item format (backwards-compatible)
      const lifeAreaTag = LIFE_AREA_TAGS.includes(parsed.life_area_tag as string) ? parsed.life_area_tag as string : null;
      return new Response(
        JSON.stringify({
          items: [{
            description,
            celebration_text: (parsed.celebration_text as string) || null,
            life_area_tag: lifeAreaTag,
            mast_connection_id: (parsed.mast_connection_id as string) || null,
            wheel_connection_id: (parsed.wheel_connection_id as string) || null,
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // JSON parsing completely failed — return raw text as single celebration
    // (only the text content, not any JSON structure)
    return new Response(
      JSON.stringify({
        items: [{
          description,
          celebration_text: content.trim().length > 0 && content.trim().length < 500 ? content.trim() : null,
          life_area_tag: null,
          mast_connection_id: null,
          wheel_connection_id: null,
        }],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
