import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'webp']);

const VISION_OCR_PROMPT = `Extract all text, data, and information from this image. If it contains a chart or graph, describe the data points, axes, labels, values, and trends in structured plain text. If it contains a table, reproduce the table data. If it contains handwritten or printed text, transcribe it. Return only the extracted content as plain text, structured for readability. Do not add commentary or interpretation.`;

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

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No file provided.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const fileName = file.name || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Determine file category
    const isImage = IMAGE_TYPES.has(ext) || file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx';
    const isPlainText = ext === 'txt' || ext === 'md' || file.type === 'text/plain' || file.type === 'text/markdown';

    const fileType = isImage ? ext
      : isPdf ? 'pdf'
        : isDocx ? 'docx'
          : ext === 'md' ? 'md'
            : 'txt';

    let text = '';
    let usedVision = false;

    // Path 1: Images — go straight to AI vision
    if (isImage) {
      const visionText = await extractViaVision(file);
      if (visionText) {
        text = visionText;
        usedVision = true;
      }
    }
    // Path 2: Plain text — direct read
    else if (isPlainText) {
      text = await file.text();
    }
    // Path 3: PDF — try text extraction, fall back to vision
    else if (isPdf) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      text = await extractTextFromPDF(bytes);

      // Check quality: if extraction yielded very little usable text, try vision
      if (!text || text.trim().length < 50) {
        console.log(`PDF text extraction yielded ${text.trim().length} chars — falling back to vision`);
        const visionText = await extractViaVision(file);
        if (visionText) {
          text = visionText;
          usedVision = true;
        }
      }
    }
    // Path 4: DOCX — text extraction only (DOCX always has extractable text if valid)
    else if (isDocx) {
      const arrayBuffer = await file.arrayBuffer();
      text = await extractTextFromDOCX(new Uint8Array(arrayBuffer));
    }

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No text content could be extracted from this file.',
          file_type: fileType,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ text: text.trim(), file_type: fileType, used_vision: usedVision }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Extraction failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// --- AI Vision Extraction ---

async function extractViaVision(file: File): Promise<string | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('No OPENROUTER_API_KEY — cannot use vision fallback');
    return null;
  }

  try {
    // Convert file to base64 data URI
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...bytes));

    // Determine MIME type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
    };
    const mimeType = file.type || mimeMap[ext] || 'application/octet-stream';
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Use Haiku for cost efficiency — it handles vision well
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
              { type: 'text', text: VISION_OCR_PROMPT },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Vision API error (${response.status}):`, errorBody);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content.trim() || null;
  } catch (err) {
    console.error('Vision extraction failed:', err);
    return null;
  }
}

// --- PDF Extraction ---

async function extractTextFromPDF(bytes: Uint8Array): Promise<string> {
  const { inflateSync } = await import('https://esm.sh/fflate@0.8.2');
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  const streamContents: string[] = [];
  const allStreamRegex = /stream\r?\n/g;
  let streamMatch;

  while ((streamMatch = allStreamRegex.exec(raw)) !== null) {
    const streamStart = streamMatch.index + streamMatch[0].length;
    const endIdx = raw.indexOf('endstream', streamStart);
    if (endIdx === -1) continue;

    const dictStart = Math.max(0, streamMatch.index - 500);
    const dictText = raw.substring(dictStart, streamMatch.index);
    const isCompressed = dictText.includes('/FlateDecode');
    const streamData = raw.substring(streamStart, endIdx);

    if (isCompressed) {
      try {
        const streamBytes = new Uint8Array(streamData.length);
        for (let i = 0; i < streamData.length; i++) {
          streamBytes[i] = streamData.charCodeAt(i);
        }
        const decompressed = inflateSync(streamBytes);
        const decompressedText = new TextDecoder('latin1').decode(decompressed);
        streamContents.push(decompressedText);
      } catch {
        // Not all streams decompress — skip
      }
    } else {
      streamContents.push(streamData);
    }
  }

  const textParts: string[] = [];

  for (const content of streamContents) {
    extractTextFromPDFContent(content, textParts);
  }

  if (textParts.length === 0) {
    extractTextFromPDFContent(raw, textParts);
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

function extractTextFromPDFContent(content: string, textParts: string[]): void {
  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btRegex.exec(content)) !== null) {
    const block = match[1];

    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = decodePDFString(tjMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    const tjHexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let tjHexMatch;
    while ((tjHexMatch = tjHexRegex.exec(block)) !== null) {
      const decoded = decodeHexPDFString(tjHexMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];

      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        const decoded = decodePDFString(strMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }

      const hexRegex = /<([0-9A-Fa-f]+)>/g;
      let hexMatch;
      while ((hexMatch = hexRegex.exec(arrContent)) !== null) {
        const decoded = decodeHexPDFString(hexMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }
    }
  }
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

function decodeHexPDFString(hex: string): string {
  if (hex.length % 2 !== 0) hex += '0';

  if (hex.length % 4 === 0) {
    let utf16 = '';
    let isReadable = true;
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.substring(i, i + 4), 16);
      if (code === 0) { isReadable = false; break; }
      utf16 += String.fromCharCode(code);
    }
    if (isReadable && utf16.length > 0 && /[a-zA-Z]/.test(utf16)) {
      return utf16;
    }
  }

  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (code >= 32 && code < 127) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

// --- DOCX Extraction ---

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
