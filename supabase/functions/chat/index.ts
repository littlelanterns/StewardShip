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
    const { messages, system_prompt, max_tokens, user_id, guided_mode, file_attachment } = await req.json();

    if (!messages || !system_prompt || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages, system_prompt, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get user's AI settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_provider, ai_api_key_encrypted, ai_model, max_tokens')
      .eq('user_id', user_id)
      .maybeSingle();

    // Determine API key: user's key if set, otherwise developer fallback
    let apiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
    if (settings?.ai_api_key_encrypted) {
      // For MVP, the "encrypted" key is stored as-is (encryption TBD)
      apiKey = settings.ai_api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured. Set one in Settings or contact the administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Determine model: user override > guided mode routing > default
    let model: string;
    const userModel = settings?.ai_model;
    const isUserOverride = userModel && userModel !== 'auto';

    if (isUserOverride) {
      model = userModel;
    } else if (guided_mode) {
      // Guided modes use Sonnet for depth
      model = 'anthropic/claude-sonnet-4';
    } else {
      // Regular chat uses Haiku for cost efficiency
      model = 'anthropic/claude-haiku-4.5';
    }

    // Smart max_tokens: guided modes need more room
    const smartMaxTokens = guided_mode ? 1024 : 512;
    const tokens = max_tokens || settings?.max_tokens || smartMaxTokens;

    // Process file attachment if present
    let processedMessages = [...messages];
    if (file_attachment) {
      const { storage_path, file_type, file_name } = file_attachment;
      const isImage = file_type.startsWith('image/');
      const isText = file_type === 'text/plain' || file_type === 'text/markdown' ||
                     file_name.endsWith('.txt') || file_name.endsWith('.md');
      const isPdf = file_type === 'application/pdf' || file_name.endsWith('.pdf');

      if (isImage) {
        // For images, get a signed URL and use OpenRouter vision format
        const { data: signedData } = await supabase.storage
          .from('helm-attachments')
          .createSignedUrl(storage_path, 600); // 10 min expiry

        if (signedData?.signedUrl) {
          // Find the last user message and convert to multimodal format
          const lastIdx = processedMessages.length - 1;
          if (lastIdx >= 0 && processedMessages[lastIdx].role === 'user') {
            const textContent = processedMessages[lastIdx].content;
            processedMessages[lastIdx] = {
              role: 'user',
              content: [
                { type: 'text', text: textContent },
                { type: 'image_url', image_url: { url: signedData.signedUrl } },
              ],
            };
          }
        }
      } else if (isText) {
        // For text files, download and inline the content
        const { data: fileData } = await supabase.storage
          .from('helm-attachments')
          .download(storage_path);

        if (fileData) {
          const textContent = await fileData.text();
          const truncated = textContent.length > 8000
            ? textContent.slice(0, 8000) + '\n\n[Content truncated — full file available in storage]'
            : textContent;

          // Append to the last user message
          const lastIdx = processedMessages.length - 1;
          if (lastIdx >= 0 && processedMessages[lastIdx].role === 'user') {
            processedMessages[lastIdx] = {
              ...processedMessages[lastIdx],
              content: `${processedMessages[lastIdx].content}\n\n--- Attached file: ${file_name} ---\n${truncated}`,
            };
          }
        }
      } else if (isPdf) {
        // For PDFs, note the attachment — full extraction requires manifest-process pipeline
        const lastIdx = processedMessages.length - 1;
        if (lastIdx >= 0 && processedMessages[lastIdx].role === 'user') {
          processedMessages[lastIdx] = {
            ...processedMessages[lastIdx],
            content: `${processedMessages[lastIdx].content}\n\n[Attached PDF: ${file_name}. PDF text extraction is available through the Manifest. For now, I can see the filename but not the PDF content. You can upload this to the Manifest for full processing, or describe what you'd like to discuss from it.]`,
          };
        }
      }
    }

    // Call OpenRouter
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
        max_tokens: tokens,
        messages: [
          { role: 'system', content: system_prompt },
          ...processedMessages,
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
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
