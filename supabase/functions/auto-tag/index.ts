import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOG_VALID_TAGS = [
  'spiritual', 'marriage', 'family', 'physical', 'emotional',
  'social', 'professional', 'financial', 'personal_development', 'service',
];

const LOG_TAG_PROMPT =
  'You are a tag classifier. Given a journal entry, suggest 1-3 life area tags from this list: spiritual, marriage, family, physical, emotional, social, professional, financial, personal_development, service. Respond with ONLY the tag names, comma-separated, nothing else.';

const COMPASS_VALID_TAGS = [
  'spouse_marriage', 'family', 'career_work', 'home', 'spiritual',
  'health_physical', 'social', 'financial', 'personal', 'custom',
];

const COMPASS_TAG_PROMPT =
  'You are a tag classifier. Given a task title and optional description, suggest exactly 1 life area tag from this list: spouse_marriage, family, career_work, home, spiritual, health_physical, social, financial, personal, custom. Respond with ONLY the tag name, nothing else.';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const userId = authUser.id;

    const { text, tag_type } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        JSON.stringify({ tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';

    const isCompass = tag_type === 'compass';
    const systemPrompt = isCompass ? COMPASS_TAG_PROMPT : LOG_TAG_PROMPT;
    const validTags = isCompass ? COMPASS_VALID_TAGS : LOG_VALID_TAGS;

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
        max_tokens: 50,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      return new Response(
        JSON.stringify({ tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse comma-separated tags, validate against allowed list
    const tags = content
      .split(',')
      .map((t: string) => t.trim().toLowerCase().replace(/\s+/g, '_'))
      .filter((t: string) => validTags.includes(t));

    return new Response(
      JSON.stringify({ tags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ tags: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
