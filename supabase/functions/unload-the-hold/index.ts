import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are processing a brain dump conversation from a user of StewardShip, a personal growth app. The user has poured out unstructured thoughts across multiple messages. Your job is to extract individual actionable items and categorize each one.

For each item, determine the best destination:
- "task": Something the user needs to DO. An action, errand, commitment, or to-do.
- "journal": A reflection, feeling, observation, or experience worth recording. Not actionable.
- "insight": A self-discovery — something the user learned about themselves, a pattern they noticed, a strength or growth area.
- "principle": A value, declaration, or guiding belief the user is articulating.
- "person_note": Information about a specific person in the user's life — an observation, need, or context about someone.
- "reminder": Something time-sensitive the user wants to remember. Has a specific date/time or trigger.
- "list_item": An item that belongs on a list (shopping, wishlist, etc.) — not a task.
- "discard": Venting already resolved in the conversation, pure filler, or not meaningful to save.

Return ONLY a JSON array of objects. Each object must have:
- "text": The cleaned-up, clarified version of the extracted item (fix grammar, complete fragments, but preserve the user's voice)
- "category": One of the categories above
- "metadata": An object with optional fields depending on category:
  - For tasks: { "life_area_tag": string|null, "due_suggestion": "today"|"this_week"|"no_date"|null }
  - For journal: { "entry_type": "reflection"|"quick_note"|"gratitude"|null }
  - For insight: { "keel_category": "personality_assessment"|"trait_tendency"|"strength"|"growth_area"|"general"|null }
  - For principle: { "mast_type": "value"|"declaration"|"faith_foundation"|"scripture_quote"|"vision"|null }
  - For person_note: { "person_name": string|null }
  - For reminder: { "reminder_text": string|null }
  - For list_item: { "suggested_list": string|null }
  - For discard: {}

Be generous with extraction — if in doubt, include it as a "journal" entry rather than discarding. The user can always change the category.

Split compound thoughts into separate items when they have different destinations. For example, "I need to call mom and I've been feeling anxious about work" becomes two items: a task (call mom) and a journal entry (work anxiety).

If the user mentioned something that sounds like an existing task from their active tasks list, note it but still include it — let the user decide if it's a duplicate.`;

const VALID_CATEGORIES = ['task', 'journal', 'insight', 'principle', 'person_note', 'reminder', 'list_item', 'discard'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversation_text, user_id, context } = await req.json();

    if (!conversation_text || !user_id) {
      return new Response(
        JSON.stringify({ items: [], error: 'Missing required fields: conversation_text, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get API key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_api_key_encrypted, ai_model')
      .eq('user_id', user_id)
      .maybeSingle();

    let apiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
    if (settings?.ai_api_key_encrypted) {
      apiKey = settings.ai_api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ items: [], error: 'No API key configured. Set one in Settings or contact the administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';

    // Build user message with optional context
    let userMessage = `Here is the brain dump conversation to process:\n\n${conversation_text}`;

    if (context) {
      userMessage += '\n\n--- ADDITIONAL CONTEXT ---';
      if (context.mast_entries) {
        userMessage += `\n\nUser's guiding principles (The Mast):\n${context.mast_entries}`;
      }
      if (context.active_tasks && context.active_tasks.length > 0) {
        userMessage += `\n\nUser's current active tasks:\n${context.active_tasks.join('\n')}`;
      }
      if (context.keel_categories) {
        userMessage += `\n\nUser's self-knowledge categories (The Keel):\n${context.keel_categories}`;
      }
      if (context.people_names && context.people_names.length > 0) {
        userMessage += `\n\nKnown people in user's life:\n${context.people_names.join(', ')}`;
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
        max_tokens: 2048,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text();
      const status = openRouterResponse.status;

      if (status === 401) {
        return new Response(
          JSON.stringify({ items: [], error: 'Invalid API key. Check your AI configuration in Settings.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ items: [], error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ items: [], error: 'Failed to parse AI response', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawItems = JSON.parse(jsonMatch[0]);

    // Validate and sanitize each item
    const items = rawItems.map(
      (item: { text: string; category: string; metadata?: Record<string, unknown> }) => ({
        text: String(item.text || '').trim(),
        category: VALID_CATEGORIES.includes(item.category) ? item.category : 'journal',
        metadata: item.metadata || {},
      }),
    ).filter((item: { text: string }) => item.text.length > 0);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ items: [], error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
