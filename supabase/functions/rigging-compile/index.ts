import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(context: {
  hub_text?: string;
  mast_connections?: string[];
  active_tasks?: string[];
  life_area?: string;
}): string {
  let prompt = `You are compiling a structured plan from a planning conversation.

Extract a complete, actionable plan from the conversation. The user has been describing what they want to accomplish and you've been helping them think through it.

Return a JSON object with this exact structure:
{
  "title": "short plan title",
  "description": "1-2 sentence description",
  "planning_framework": "moscow|backward|milestone|premortem|ten_ten_ten|mixed",
  "frameworks_used": ["array of frameworks discussed"],
  "milestones": [
    {
      "title": "milestone title",
      "description": "what needs to happen",
      "target_date": "YYYY-MM-DD or null"
    }
  ],
  "obstacles": [
    {
      "risk": "what could go wrong",
      "mitigation": "how to handle it"
    }
  ]`;

  prompt += `,
  "moscow": {
    "must": ["must-have items"],
    "should": ["should-have items"],
    "could": ["could-have items"],
    "wont": ["won't-have items"]
  },
  "ten_ten_ten": {
    "ten_min": "how will I feel in 10 minutes",
    "ten_mo": "how will I feel in 10 months",
    "ten_yr": "how will I feel in 10 years",
    "decision": "the decision",
    "conclusion": "what's clear from this analysis"
  },
  "mast_connections": ["connections to guiding principles"]
}

Include moscow and ten_ten_ten ONLY if those frameworks were actually discussed. Otherwise set them to null.`;

  if (context.hub_text) {
    prompt += `\n\nThis plan may be connected to a Change Wheel with hub: "${context.hub_text}"`;
  }
  if (context.mast_connections?.length) {
    prompt += `\n\nThe user's guiding principles include: ${context.mast_connections.join(', ')}`;
  }

  prompt += '\n\nReturn ONLY valid JSON. No markdown, no code fences, no explanation text.';

  return prompt;
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
        JSON.stringify({ plan: null, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // Supabase validates JWT before Edge Function runs — decode for user_id
    const jwt = authHeader.replace('Bearer ', '');
    const jwtPayload = JSON.parse(atob(jwt.split('.')[1]));
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ plan: null, error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const { plan_id, conversation_messages, context } = await req.json();

    if (!conversation_messages) {
      return new Response(
        JSON.stringify({ plan: null, error: 'Missing required fields' }),
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
        JSON.stringify({ plan: null, error: 'No API key configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';
    const systemPrompt = getSystemPrompt(context || {});

    const conversationText = conversation_messages
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n\n');

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
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the planning conversation to compile:\n\n${conversationText}` },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text();
      const status = openRouterResponse.status;

      if (status === 401) {
        return new Response(
          JSON.stringify({ plan: null, error: 'Invalid API key.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ plan: null, error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the response
    let plan = null;
    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      plan = JSON.parse(cleaned);
    } catch {
      plan = { title: 'Untitled Plan', description: rawText.trim(), milestones: [], obstacles: [] };
    }

    return new Response(
      JSON.stringify({ plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ plan: null, error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
