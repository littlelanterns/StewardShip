import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DETAIL_PROMPTS: Record<string, string> = {
  quick: `You are a task decomposition assistant. Break the given task into 3-5 high-level steps.
Return ONLY a JSON array of objects with "title" and optional "description" fields.
Example: [{"title": "Step 1 title"}, {"title": "Step 2 title", "description": "More detail"}]`,

  detailed: `You are a task decomposition assistant. Break the given task into detailed steps with substeps where appropriate.
Each step should be clear and actionable. Include descriptions for complex steps.
Return ONLY a JSON array of objects with "title" and optional "description" fields.
Example: [{"title": "Research options", "description": "Look into at least 3 alternatives"}, {"title": "Create outline"}]`,

  granular: `You are a task decomposition assistant. Break the given task into very small, very concrete first actions.
Think at the level of: "Open laptop. Create new document. Title it X. Write the first paragraph about Y."
Each step should be immediately doable with zero ambiguity.
Return ONLY a JSON array of objects with "title" fields.
Example: [{"title": "Open laptop and log in"}, {"title": "Open browser and navigate to X"}, {"title": "Click Create New button"}]`,
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

    const { task_title, task_description, detail_level, context } = await req.json();

    if (!task_title || !detail_level) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: task_title, detail_level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = DETAIL_PROMPTS[detail_level];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: 'Invalid detail_level. Must be: quick, detailed, or granular' }),
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
        JSON.stringify({ error: 'No API key configured. Set one in Settings or contact the administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';

    // Build user message
    let userMessage = `Task: ${task_title}`;
    if (task_description) {
      userMessage += `\nDescription: ${task_description}`;
    }
    if (context) {
      userMessage += `\n\nAdditional context:\n${context}`;
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
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text();
      const status = openRouterResponse.status;

      if (status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key. Check your AI configuration in Settings.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const subtasks = JSON.parse(jsonMatch[0]).map(
      (item: { title: string; description?: string }, index: number) => ({
        title: item.title,
        description: item.description || null,
        sort_order: index,
      }),
    );

    return new Response(
      JSON.stringify({ subtasks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
