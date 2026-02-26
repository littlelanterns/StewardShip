import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPOUSE_PROMPT = `You are analyzing a document about someone's spouse or partner. Extract individual insights about the spouse and categorize each one. Return ONLY valid JSON — no markdown, no explanation.

Return a JSON array: [{ "text": "...", "category": "...", "confidence": 0.0-1.0 }]

Valid categories: personality, love_appreciation, communication, dreams_goals, challenges_needs, their_world, observation, gratitude, general

Extract specific, actionable insights. Each insight should be a single fact or observation, not a paragraph. If the document contains personality assessment results, break them into individual traits rather than one large summary.`;

const KEEL_PROMPT = `You are analyzing a document about the user's personality, self-knowledge, or personal assessment results. Extract individual insights and categorize each one. Return ONLY valid JSON — no markdown, no explanation.

Return a JSON array: [{ "text": "...", "category": "...", "confidence": 0.0-1.0, "source_label": "..." }]

Valid categories: personality_assessment, trait_tendency, strength, growth_area, you_inc, general

The source_label should identify the assessment or source (e.g., "Enneagram Type 3", "MBTI ENFP", "StrengthsFinder"). Extract specific individual traits/insights, not one large summary.`;

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

    const { file_storage_path, file_type, extraction_target } = await req.json();

    if (!file_storage_path || !extraction_target) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file_storage_path, extraction_target' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key
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
        JSON.stringify({ error: 'No API key configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Download the file from storage
    const { data: fileData, error: downloadErr } = await supabase
      .storage
      .from('manifest-files')
      .download(file_storage_path);

    if (downloadErr || !fileData) {
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${downloadErr?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = extraction_target === 'spouse' ? SPOUSE_PROMPT : KEEL_PROMPT;
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes((file_type || '').toLowerCase());
    let extractedTextLength = 0;

    // Build the AI request based on file type
    let messages: unknown[];

    if (isImage) {
      // Vision request — encode image as base64
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const base64Data = btoa(String.fromCharCode(...bytes));

      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      };
      const mimeType = mimeMap[file_type.toLowerCase()] || 'image/png';

      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Data}` },
            },
            { type: 'text', text: 'Extract insights from this image.' },
          ],
        },
      ];
      extractedTextLength = 0; // Images don't have extractable text length
    } else {
      // Text-based extraction
      let fullText = '';
      const lowerType = (file_type || '').toLowerCase();

      if (lowerType === 'pdf') {
        const arrayBuffer = await fileData.arrayBuffer();
        fullText = extractTextFromPDF(new Uint8Array(arrayBuffer));
      } else if (lowerType === 'docx') {
        const arrayBuffer = await fileData.arrayBuffer();
        fullText = await extractTextFromDOCX(new Uint8Array(arrayBuffer));
      } else {
        // txt, md — read as text
        fullText = await fileData.text();
      }

      if (!fullText || fullText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Could not extract text from the file. It may be scanned or image-based.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      extractedTextLength = fullText.length;

      // Send up to ~4000 tokens of content for analysis
      const contentPreview = fullText.substring(0, 16000);

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract insights from this document:\n\n${contentPreview}` },
      ];
    }

    // Call OpenRouter with Sonnet for quality extraction
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 2048,
        messages,
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

    // Parse JSON from response — strip markdown fencing if present
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          insights: [],
          extracted_text_length: extractedTextLength,
          error: 'Could not parse AI response as JSON array.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawInsights = JSON.parse(jsonMatch[0]);

    // Validate and clean insights
    const insights = (rawInsights as Array<Record<string, unknown>>)
      .filter((item) => item.text && typeof item.text === 'string' && (item.text as string).trim().length > 0)
      .map((item) => ({
        text: (item.text as string).trim(),
        category: (item.category as string) || 'general',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
        source_label: item.source_label ? (item.source_label as string) : undefined,
      }));

    return new Response(
      JSON.stringify({ insights, extracted_text_length: extractedTextLength }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Extraction failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// --- Text Extraction Helpers (copied from manifest-process) ---

function extractTextFromPDF(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);
  const textParts: string[] = [];

  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btRegex.exec(raw)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(decodePDFString(tjMatch[1]));
    }

    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        textParts.push(decodePDFString(strMatch[1]));
      }
    }
  }

  if (textParts.length === 0) {
    const readableRegex = /[\x20-\x7E]{20,}/g;
    let readableMatch;
    while ((readableMatch = readableRegex.exec(raw)) !== null) {
      const text = readableMatch[0].trim();
      if (text.length > 30 && /[a-zA-Z]/.test(text)) {
        textParts.push(text);
      }
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

function decodePDFString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

async function extractTextFromDOCX(bytes: Uint8Array): Promise<string> {
  const { unzipSync } = await import('https://esm.sh/fflate@0.8.2');
  const files = unzipSync(bytes);

  const documentXml = files['word/document.xml'];
  if (!documentXml) {
    throw new Error('Invalid DOCX: no word/document.xml found');
  }

  const xml = new TextDecoder().decode(documentXml);
  const textParts: string[] = [];
  const paragraphs = xml.split(/<w:p[ >]/);

  for (const para of paragraphs) {
    const textRunRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let runMatch;
    const paraText: string[] = [];

    while ((runMatch = textRunRegex.exec(para)) !== null) {
      paraText.push(runMatch[1]);
    }

    if (paraText.length > 0) {
      textParts.push(paraText.join(''));
    }
  }

  return textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
