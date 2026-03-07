import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { framework_id, framework_name, principles, user_id } = await req.json();

    if (!framework_id || !framework_name || !principles) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: framework_id, framework_name, principles' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const principleTexts = (principles as string[]).slice(0, 20);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 128,
        messages: [
          {
            role: 'system',
            content: `You generate concise topic tags for personal growth frameworks extracted from books and resources.

Return a JSON object: { "tags": ["tag1", "tag2", ...] }

Rules:
- Return 3–6 tags maximum
- Tags are lowercase, single words or hyphenated (e.g., "emotional-health", "teens")
- Prefer from this vocabulary when applicable:
  parenting, teens, marriage, leadership, faith, habits, productivity, communication,
  emotional-health, boundaries, identity, family, disability, grief, anxiety, finance,
  relationships, self-compassion, resilience, confidence, purpose, spirituality, health
- Add topic-specific tags not in the list when clearly appropriate (e.g., "adhd", "divorce")
- Do not add generic tags like "book", "framework", "principles", "self-help"
- Return ONLY the JSON object. No explanation, no markdown backticks.`,
          },
          {
            role: 'user',
            content: `Framework name: ${framework_name}\nPrinciples:\n${principleTexts.join('\n')}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(
        JSON.stringify({ error: `Tag generation failed: ${errBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let tags: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.tags)) {
        tags = parsed.tags;
      }
    } catch {
      // Try cleaning markdown wrapping
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      try {
        const reParsed = JSON.parse(cleaned);
        if (Array.isArray(reParsed.tags)) {
          tags = reParsed.tags;
        }
      } catch {
        // Return empty tags rather than erroring
        tags = [];
      }
    }

    // Update the framework's tags in the database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from('ai_frameworks')
      .update({ tags })
      .eq('id', framework_id)
      .eq('user_id', user_id || userId);

    return new Response(
      JSON.stringify({ tags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Tag generation failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
