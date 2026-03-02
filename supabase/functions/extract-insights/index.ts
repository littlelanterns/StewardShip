import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractCleanTextFromPDF } from '../_shared/pdf-utils.ts';

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

const MAST_PROMPT = `You are analyzing a document to extract guiding principles, values, declarations, scriptures, quotes, and vision statements. Extract individual principles and categorize each one. Return ONLY valid JSON — no markdown, no explanation.

Return a JSON array: [{ "text": "...", "category": "...", "confidence": 0.0-1.0 }]

Valid categories: value (core values and beliefs), declaration (commitment statements about who the user is choosing to become — use honest commitment language like "I choose to..." or "I am committed to..."), faith_foundation (faith or spiritual beliefs and foundations), scripture_quote (scriptures, quotes, or meaningful sayings), vision (vision statements about the future or who they want to become)

Extract each principle as a standalone statement. Keep the original wording where possible. If the document contains lists, extract each list item individually.`;

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

    const systemPrompt = extraction_target === 'spouse'
      ? SPOUSE_PROMPT
      : extraction_target === 'mast'
        ? MAST_PROMPT
        : KEEL_PROMPT;
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes((file_type || '').toLowerCase());
    const lowerType = (file_type || '').toLowerCase();
    let extractedTextLength = 0;

    // Build the AI request based on file type
    let messages: unknown[];
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (isImage) {
      // Vision request — encode image as base64
      messages = buildVisionMessages(systemPrompt, bytes, file_type);
      extractedTextLength = 0;
    } else if (lowerType === 'pdf') {
      // Try text extraction first, fall back to vision for chart-heavy/scanned PDFs
      let fullText = '';
      try {
        fullText = await extractCleanTextFromPDF(bytes);
      } catch (e) {
        console.log('PDF text extraction error:', (e as Error).message);
      }

      if (fullText && fullText.trim().length > 100) {
        // Successful text extraction
        extractedTextLength = fullText.length;
        const contentPreview = fullText.substring(0, 16000);
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract insights from this document:\n\n${contentPreview}` },
        ];
      } else {
        // Text extraction failed or yielded very little — use vision as fallback
        // PDFs with charts, images, or custom fonts often can't be text-extracted
        console.log(`PDF text extraction yielded only ${fullText.length} chars, falling back to vision mode`);
        messages = buildVisionMessages(systemPrompt, bytes, 'pdf');
        extractedTextLength = 0;
      }
    } else {
      // Text-based extraction (docx, txt, md)
      let fullText = '';

      if (lowerType === 'docx') {
        fullText = await extractTextFromDOCX(bytes);
      } else {
        fullText = await fileData.text();
      }

      if (!fullText || fullText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Could not extract text from the file. Try uploading screenshots of the key pages as images instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      extractedTextLength = fullText.length;
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

// --- Helper: Build vision messages for image/PDF analysis ---

function buildVisionMessages(systemPrompt: string, bytes: Uint8Array, fileType: string): unknown[] {
  // For large files, we need to chunk the base64 encoding to avoid stack overflow
  const chunks: string[] = [];
  const CHUNK_SIZE = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    chunks.push(String.fromCharCode(...slice));
  }
  const base64Data = btoa(chunks.join(''));

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  const mimeType = mimeMap[fileType.toLowerCase()] || 'application/octet-stream';

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
        { type: 'text', text: 'Extract insights from this document. Look at all pages, charts, tables, and text content.' },
      ],
    },
  ];
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
