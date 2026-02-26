import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTAKE_PROMPT = `You are an intelligent librarian organizing a personal knowledge base. Given the text content of a document, analyze it and return a JSON object with:

1. "summary": A concise 2-3 sentence summary of what this document is about.
2. "suggested_tags": An array of 2-4 relevant topic tags (lowercase, no spaces — use underscores). Focus on the core themes. Examples: "leadership", "habit_formation", "faith", "marriage", "parenting", "business", "scripture", "personal_development".
3. "suggested_folder": One folder grouping name that best fits this content. Use title case. Common folders: "Faith & Scripture", "Personal Development", "Leadership", "Relationships", "Business & Career", "Health & Fitness", "Reference", "Meeting Transcripts", "Uncategorized". Create a new folder name if none fit.
4. "suggested_usage": The most likely primary usage for this content. One of: "general_reference", "framework_source", "mast_extraction", "keel_info", "goal_specific", "store_only". Most content is "general_reference". Use "framework_source" only if the content contains actionable principles or mental models the user would want as always-available guidance. Use "mast_extraction" if it contains value statements or personal declarations. Use "keel_info" if it contains personality assessments or self-knowledge data.

Return ONLY valid JSON, no markdown backticks, no preamble.`;

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const userId = authUser.id;

    const { text_content, file_name, existing_tags, existing_folders } = await req.json();

    if (!text_content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Send first ~3000 tokens of content for analysis
    const contentPreview = text_content.substring(0, 12000);

    let userMessage = `Document filename: ${file_name || 'Unknown'}\n\nContent:\n${contentPreview}`;

    if (existing_tags && existing_tags.length > 0) {
      userMessage += `\n\nExisting tags in user's library (prefer reusing these when appropriate): ${existing_tags.join(', ')}`;
    }
    if (existing_folders && existing_folders.length > 0) {
      userMessage += `\nExisting folders: ${existing_folders.join(', ')}`;
    }

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
        max_tokens: 512,
        messages: [
          { role: 'system', content: INTAKE_PROMPT },
          { role: 'user', content: userMessage },
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          summary: 'Unable to analyze this content automatically.',
          suggested_tags: [],
          suggested_folder: 'Uncategorized',
          suggested_usage: 'general_reference',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Intake failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
