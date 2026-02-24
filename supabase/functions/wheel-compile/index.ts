import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CompileType = 'spoke_3_who_i_am' | 'spoke_3_who_i_want_to_be' | 'spoke_4_script';

function getSystemPrompt(
  compileType: CompileType,
  hubText: string,
  supportRole?: string,
  personName?: string,
): string {
  switch (compileType) {
    case 'spoke_3_who_i_am':
      return `You are compiling a first-person essay from a therapeutic change conversation.

The user is working on a deep character change: "${hubText}"

Compile a first-person essay that is an honest, vulnerable self-assessment of the person's current state regarding this change. Write in the user's voice. This should feel uncomfortable to read — that's the point. Don't soften the hard parts. The honesty is what makes it powerful.

Rules:
- Write in first person ("I am..." / "I tend to..." / "When I'm honest with myself...")
- Well-structured paragraphs, not a list
- Pull specific examples and patterns from the conversation
- Don't add anything the user didn't share — only synthesize what they said
- 3-5 paragraphs
- No clinical language — this should sound like the user talking to themselves in a mirror`;

    case 'spoke_3_who_i_want_to_be':
      return `You are compiling a first-person vision essay from a therapeutic change conversation.

The user is working on a deep character change: "${hubText}"

Compile a first-person vision essay. Include the specific role models discussed (focus on their specific traits, not the whole person) and paint a rich, detailed picture of who the user wants to become regarding this change. Aspirational but grounded — not fantasy.

Rules:
- Write in first person ("I want to become someone who..." / "I see myself...")
- Include the role models mentioned and the specific traits the user admires
- Paint a vivid picture of what success looks like in daily life
- Well-structured paragraphs, not a list
- 3-5 paragraphs
- Grounded in reality — connected to the user's actual life circumstances`;

    case 'spoke_4_script':
      return `You are drafting a conversation script for someone going through a therapeutic change process.

The user is working on: "${hubText}"
They want to ask ${personName || 'someone'} to serve as their ${supportRole || 'support person'}.

Draft a natural-sounding conversation script they can use. Include:
1. How to bring up the topic naturally
2. What to say about what they're working on (brief, honest, not oversharing)
3. What the ${supportRole || 'role'} specifically involves
4. What boundaries to set (what the role IS and ISN'T)
5. How to handle if the person says no or needs time

Rules:
- Natural tone, not scripted-sounding
- Include actual suggested phrases, not just "say something about..."
- Keep it under 300 words
- The user should feel prepared, not rehearsed
${supportRole === 'supporter' ? '- Supporter role: cheerleader. Never judges or nags. Just encouragement.' : ''}
${supportRole === 'reminder' ? '- Reminder role: given explicit permission to remind. Must agree on HOW (text, weekly check-in, etc.).' : ''}
${supportRole === 'observer' ? '- Observer role: watches progress, gives honest feedback. Not cheerleading — truth-telling.' : ''}`;

    default:
      return 'Compile the conversation into a clear, well-structured summary.';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, wheel_id, compile_type, conversation_messages, hub_text, support_role, person_context } =
      await req.json();

    if (!user_id || !compile_type || !conversation_messages || !hub_text) {
      return new Response(
        JSON.stringify({ compiled_text: '', error: 'Missing required fields' }),
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
        JSON.stringify({ compiled_text: '', error: 'No API key configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = settings?.ai_model || 'anthropic/claude-sonnet-4';
    const personName = person_context?.name || undefined;

    const systemPrompt = getSystemPrompt(compile_type, hub_text, support_role, personName);

    // Format conversation as user message
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
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the conversation to compile:\n\n${conversationText}` },
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text();
      const status = openRouterResponse.status;

      if (status === 401) {
        return new Response(
          JSON.stringify({ compiled_text: '', error: 'Invalid API key.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ compiled_text: '', error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const compiledText = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ compiled_text: compiledText.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ compiled_text: '', error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
