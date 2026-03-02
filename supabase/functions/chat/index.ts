import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractCleanTextFromPDF } from '../_shared/pdf-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  console.log('=== CHAT FUNCTION HIT ===');
  console.log('Method:', req.method);
  console.log('Auth header present:', !!req.headers.get('Authorization'));
  console.log('Auth header prefix:', req.headers.get('Authorization')?.substring(0, 30));

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
    console.log('JWT length:', jwt.length);
    console.log('JWT parts:', jwt.split('.').length);
    let jwtPayload: Record<string, unknown>;
    try {
      const payloadB64 = jwt.split('.')[1];
      // Convert base64url to base64
      const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      jwtPayload = JSON.parse(atob(b64));
      console.log('JWT decoded successfully, sub:', jwtPayload.sub);
    } catch (decodeErr) {
      console.error('JWT decode failed:', decodeErr);
      return new Response(
        JSON.stringify({ error: 'Failed to decode token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const { messages, system_prompt, max_tokens, guided_mode, file_attachment } = await req.json();

    if (!messages || !system_prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages, system_prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get user's AI settings
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_provider, ai_api_key_encrypted, ai_model, max_tokens')
      .eq('user_id', userId)
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
        // For PDFs: try text extraction, fall back to vision for scanned/image PDFs
        const { data: fileData } = await supabase.storage
          .from('helm-attachments')
          .download(storage_path);

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          let pdfText = await extractCleanTextFromPDF(new Uint8Array(arrayBuffer));

          // If text extraction yielded very little, fall back to vision
          if (!pdfText || pdfText.trim().length < 50) {
            console.log(`PDF text extraction yielded ${pdfText.trim().length} chars — trying vision fallback`);
            const { data: signedData } = await supabase.storage
              .from('helm-attachments')
              .createSignedUrl(storage_path, 600);

            if (signedData?.signedUrl) {
              const visionText = await extractPdfViaVision(signedData.signedUrl, apiKey);
              if (visionText) {
                pdfText = visionText;
              }
            }
          }

          if (pdfText && pdfText.trim().length > 0) {
            const truncated = pdfText.length > 8000
              ? pdfText.slice(0, 8000) + '\n\n[Content truncated — full file available in storage]'
              : pdfText;

            const lastIdx = processedMessages.length - 1;
            if (lastIdx >= 0 && processedMessages[lastIdx].role === 'user') {
              processedMessages[lastIdx] = {
                ...processedMessages[lastIdx],
                content: `${processedMessages[lastIdx].content}\n\n--- Attached PDF: ${file_name} ---\n${truncated}`,
              };
            }
          } else {
            // Extraction failed entirely — inform user
            const lastIdx = processedMessages.length - 1;
            if (lastIdx >= 0 && processedMessages[lastIdx].role === 'user') {
              processedMessages[lastIdx] = {
                ...processedMessages[lastIdx],
                content: `${processedMessages[lastIdx].content}\n\n[Attached PDF: ${file_name}. Could not extract text — this may be an encrypted or corrupted PDF. You can describe the content to discuss it.]`,
              };
            }
          }
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

// --- PDF Vision Fallback ---

async function extractPdfViaVision(signedUrl: string, apiKey: string): Promise<string | null> {
  try {
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
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text content from this PDF page. If it contains charts or tables, describe the data. Return only the extracted content as plain text.' },
              { type: 'image_url', image_url: { url: signedUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('PDF vision fallback failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('PDF vision extraction error:', err);
    return null;
  }
}
