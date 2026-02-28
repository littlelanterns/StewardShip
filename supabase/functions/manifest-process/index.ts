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

    const { manifest_item_id } = await req.json();

    if (!manifest_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch the manifest item
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('id', manifest_item_id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: 'Manifest item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Update status to processing
    await supabase
      .from('manifest_items')
      .update({ processing_status: 'processing' })
      .eq('id', manifest_item_id);

    let fullText = item.text_content || '';

    // 3. Extract text based on file type
    if (item.file_type === 'pdf' && item.storage_path) {
      try {
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download PDF: ${downloadErr?.message}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        fullText = await extractTextFromPDF(new Uint8Array(arrayBuffer));

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);
      } catch (pdfErr) {
        console.error('PDF extraction failed:', pdfErr);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `PDF processing failed: ${(pdfErr as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else if ((item.file_type === 'txt' || item.file_type === 'md') && item.storage_path) {
      // TXT and MD: direct text read
      try {
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download file: ${downloadErr?.message}`);
        }

        fullText = await fileData.text();

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);
      } catch (txtErr) {
        console.error('Text extraction failed:', txtErr);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `Text processing failed: ${(txtErr as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else if (item.file_type === 'epub' && item.storage_path) {
      // EPUB: ZIP → OPF spine order → XHTML content → stripped HTML
      try {
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download EPUB: ${downloadErr?.message}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        fullText = await extractTextFromEPUB(new Uint8Array(arrayBuffer));

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);
      } catch (epubErr) {
        console.error('EPUB extraction failed:', epubErr);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `EPUB processing failed: ${(epubErr as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else if (item.file_type === 'docx' && item.storage_path) {
      // DOCX: ZIP → word/document.xml → w:t text runs
      try {
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download DOCX: ${downloadErr?.message}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        fullText = await extractTextFromDOCX(new Uint8Array(arrayBuffer));

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);
      } catch (docxErr) {
        console.error('DOCX extraction failed:', docxErr);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `DOCX processing failed: ${(docxErr as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
    // text_note: fullText already populated from item.text_content
    // audio: TODO — Whisper transcription (post-MVP)
    // image: TODO — OCR (post-MVP)

    if (!fullText || fullText.trim().length === 0) {
      console.error('Empty text extraction:', {
        manifest_item_id,
        file_type: item.file_type,
        storage_path: item.storage_path,
        has_text_content: !!item.text_content,
      });
      await supabase
        .from('manifest_items')
        .update({ processing_status: 'failed' })
        .eq('id', manifest_item_id);
      return new Response(
        JSON.stringify({
          error: 'No text content could be extracted from this file. It may be a scanned/image-only PDF, or use an unsupported encoding.',
          file_type: item.file_type,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Chunk the text
    const chunks = chunkText(fullText);

    // 5. Generate embeddings for each chunk
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      await supabase
        .from('manifest_items')
        .update({ processing_status: 'failed' })
        .eq('id', manifest_item_id);
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Batch embed (OpenAI supports up to 2048 inputs per request)
    const BATCH_SIZE = 100;
    const allChunkRecords: Array<{
      user_id: string;
      manifest_item_id: string;
      chunk_index: number;
      chunk_text: string;
      token_count: number;
      embedding: number[];
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.text);

      const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: texts,
        }),
      });

      if (!embResponse.ok) {
        const errBody = await embResponse.text();
        console.error('Embedding batch failed:', errBody);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `Embedding failed: ${errBody}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const embData = await embResponse.json();

      for (let j = 0; j < batch.length; j++) {
        allChunkRecords.push({
          user_id: userId,
          manifest_item_id,
          chunk_index: batch[j].index,
          chunk_text: batch[j].text,
          token_count: batch[j].tokenCount,
          embedding: embData.data[j].embedding,
          metadata: {},
        });
      }
    }

    // 6. Delete any existing chunks (in case of re-processing)
    await supabase
      .from('manifest_chunks')
      .delete()
      .eq('manifest_item_id', manifest_item_id);

    // 7. Insert chunks in batches
    const INSERT_BATCH = 50;
    for (let i = 0; i < allChunkRecords.length; i += INSERT_BATCH) {
      const batch = allChunkRecords.slice(i, i + INSERT_BATCH);
      const { error: insertErr } = await supabase
        .from('manifest_chunks')
        .insert(batch);

      if (insertErr) {
        console.error('Chunk insert failed:', insertErr);
      }
    }

    // 8. Update manifest item status
    await supabase
      .from('manifest_items')
      .update({
        processing_status: 'completed',
        chunk_count: allChunkRecords.length,
      })
      .eq('id', manifest_item_id);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: allChunkRecords.length,
        total_tokens: allChunkRecords.reduce((sum, c) => sum + c.token_count, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Processing failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// --- Helper Functions ---

function chunkText(
  text: string,
  targetTokens = 750,
  overlapTokens = 100,
): Array<{ text: string; tokenCount: number; index: number }> {
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks: Array<{ text: string; tokenCount: number; index: number }> = [];

  if (text.length <= targetChars) {
    return [{ text, tokenCount: Math.ceil(text.length / 4), index: 0 }];
  }

  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);

    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      if (paraBreak > start + targetChars * 0.5) {
        end = paraBreak + 2;
      } else {
        const sentBreak = text.lastIndexOf('. ', end);
        if (sentBreak > start + targetChars * 0.5) {
          end = sentBreak + 2;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ text: chunk, tokenCount: Math.ceil(chunk.length / 4), index });
      index++;
    }

    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

/**
 * PDF text extraction for Deno.
 * Handles both uncompressed and FlateDecode-compressed content streams.
 * Extracts text from PDF text operators (BT...ET blocks with Tj/TJ).
 * Also handles hex-encoded strings (<...>) used by CIDFont PDFs.
 * Scanned/image-only PDFs still need OCR (post-MVP).
 */
async function extractTextFromPDF(bytes: Uint8Array): Promise<string> {
  const { inflateSync } = await import('https://esm.sh/fflate@0.8.2');
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  // Step 1: Find ALL stream/endstream blocks and try to decompress them
  const streamContents: string[] = [];
  let decompressedCount = 0;
  let streamCount = 0;

  // Find all stream blocks — match "stream\r\n" or "stream\n" followed by data until "endstream"
  const allStreamRegex = /stream\r?\n/g;
  let streamMatch;

  while ((streamMatch = allStreamRegex.exec(raw)) !== null) {
    streamCount++;
    const streamStart = streamMatch.index + streamMatch[0].length;

    // Find the matching endstream
    const endIdx = raw.indexOf('endstream', streamStart);
    if (endIdx === -1) continue;

    // Check if preceding dictionary contains /FlateDecode (look back up to 500 chars)
    const dictStart = Math.max(0, streamMatch.index - 500);
    const dictText = raw.substring(dictStart, streamMatch.index);
    const isCompressed = dictText.includes('/FlateDecode');

    const streamData = raw.substring(streamStart, endIdx);

    if (isCompressed) {
      try {
        // Convert latin1 string back to bytes for decompression
        const streamBytes = new Uint8Array(streamData.length);
        for (let i = 0; i < streamData.length; i++) {
          streamBytes[i] = streamData.charCodeAt(i);
        }
        const decompressed = inflateSync(streamBytes);
        const decompressedText = new TextDecoder('latin1').decode(decompressed);
        streamContents.push(decompressedText);
        decompressedCount++;
      } catch {
        // Not all streams decompress successfully — skip
      }
    } else {
      // Uncompressed stream — use directly
      streamContents.push(streamData);
    }
  }

  console.log(`PDF streams: ${streamCount} total, ${decompressedCount} decompressed, ${streamContents.length} usable`);

  const textParts: string[] = [];

  for (const content of streamContents) {
    extractTextFromPDFContent(content, textParts);
  }

  // If no text from streams, try the raw content (uncompressed PDF)
  if (textParts.length === 0) {
    extractTextFromPDFContent(raw, textParts);
  }

  // Fallback: look for readable text patterns in raw content
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

  console.log(`PDF extraction result: ${textParts.length} text parts, ${textParts.join(' ').length} chars`);

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract text from a single PDF content stream.
 * Handles both parenthesized strings (...) and hex strings <...> in Tj/TJ operators.
 */
function extractTextFromPDFContent(content: string, textParts: string[]): void {
  // Find text between BT...ET blocks (PDF text objects)
  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btRegex.exec(content)) !== null) {
    const block = match[1];

    // Extract text from Tj operator with parenthesized strings: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = decodePDFString(tjMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    // Extract text from Tj operator with hex strings: <hex> Tj
    const tjHexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let tjHexMatch;
    while ((tjHexMatch = tjHexRegex.exec(block)) !== null) {
      const decoded = decodeHexPDFString(tjHexMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    // TJ arrays: [(text) kerning (text) ...] TJ or [<hex> kerning <hex> ...] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];

      // Parenthesized strings in array
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        const decoded = decodePDFString(strMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }

      // Hex strings in array
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

/**
 * Decode a hex-encoded PDF string.
 * Tries UTF-16BE first (2-byte pairs), falls back to single-byte.
 */
function decodeHexPDFString(hex: string): string {
  // Pad to even length
  if (hex.length % 2 !== 0) hex += '0';

  // Try UTF-16BE first (common for CIDFont PDFs — 4 hex chars per character)
  if (hex.length % 4 === 0) {
    let utf16 = '';
    let isReadable = true;
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.substring(i, i + 4), 16);
      if (code === 0) { isReadable = false; break; }
      utf16 += String.fromCharCode(code);
    }
    // If UTF-16BE produced readable text (has at least one letter), use it
    if (isReadable && utf16.length > 0 && /[a-zA-Z]/.test(utf16)) {
      return utf16;
    }
  }

  // Fallback: single-byte interpretation
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (code >= 32 && code < 127) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

/**
 * Extract text from EPUB files.
 * EPUBs are ZIP archives containing XHTML content files.
 * Reads the OPF manifest/spine to extract content in reading order.
 */
async function extractTextFromEPUB(bytes: Uint8Array): Promise<string> {
  const { unzipSync } = await import('https://esm.sh/fflate@0.8.2');
  const files = unzipSync(bytes);

  // Find the container.xml to locate the OPF file
  const containerBytes = files['META-INF/container.xml'];
  if (!containerBytes) {
    throw new Error('Invalid EPUB: no META-INF/container.xml');
  }

  const containerXml = new TextDecoder().decode(containerBytes);
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  const opfPath = opfPathMatch?.[1] || '';

  if (!opfPath || !files[opfPath]) {
    throw new Error('Invalid EPUB: cannot locate OPF file');
  }

  // Read the OPF to find content files in reading order
  const opfContent = new TextDecoder().decode(files[opfPath]);
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // Extract manifest items (id → href mapping for XHTML content)
  const manifestItems = new Map<string, string>();
  const itemRegex = /<item\s+([^>]*)\/?\s*>/g;
  let match;

  while ((match = itemRegex.exec(opfContent)) !== null) {
    const attrs = match[1];
    const idMatch = attrs.match(/id="([^"]+)"/);
    const hrefMatch = attrs.match(/href="([^"]+)"/);
    const typeMatch = attrs.match(/media-type="([^"]+)"/);

    if (idMatch && hrefMatch && typeMatch) {
      const mediaType = typeMatch[1];
      if (mediaType === 'application/xhtml+xml' || mediaType === 'text/html') {
        manifestItems.set(idMatch[1], hrefMatch[1]);
      }
    }
  }

  // Extract spine order (reading order)
  const spineRegex = /<itemref\s+idref="([^"]+)"[^>]*\/?>/g;
  const spineOrder: string[] = [];
  while ((match = spineRegex.exec(opfContent)) !== null) {
    spineOrder.push(match[1]);
  }

  // Read each content file in spine order, extract text
  const textParts: string[] = [];

  for (const itemId of spineOrder) {
    const href = manifestItems.get(itemId);
    if (!href) continue;

    // Resolve href relative to OPF directory, handling URL-encoded paths
    const filePath = opfDir + decodeURIComponent(href);
    const fileBytes = files[filePath];
    if (!fileBytes) continue;

    const html = new TextDecoder().decode(fileBytes);
    const text = stripHtmlTags(html);
    if (text.trim().length > 0) {
      textParts.push(text.trim());
    }
  }

  // Fallback: if spine parsing failed, read all XHTML files alphabetically
  if (textParts.length === 0) {
    const xhtmlPaths = Object.keys(files)
      .filter((p) => p.endsWith('.xhtml') || p.endsWith('.html') || p.endsWith('.htm'))
      .sort();

    for (const path of xhtmlPaths) {
      const html = new TextDecoder().decode(files[path]);
      const text = stripHtmlTags(html);
      if (text.trim().length > 50) {
        textParts.push(text.trim());
      }
    }
  }

  return textParts.join('\n\n---\n\n');
}

/**
 * Extract text from DOCX files.
 * DOCX files are ZIP archives. Main content is in word/document.xml.
 * Extracts text from <w:t> tags (Word text runs), preserving paragraph structure.
 */
async function extractTextFromDOCX(bytes: Uint8Array): Promise<string> {
  const { unzipSync } = await import('https://esm.sh/fflate@0.8.2');
  const files = unzipSync(bytes);

  const documentXml = files['word/document.xml'];
  if (!documentXml) {
    throw new Error('Invalid DOCX: no word/document.xml found');
  }

  const xml = new TextDecoder().decode(documentXml);

  // Extract text from <w:t> tags within <w:p> paragraphs
  const textParts: string[] = [];

  // Split by paragraphs (<w:p> elements)
  const paragraphs = xml.split(/<w:p[ >]/);

  for (const para of paragraphs) {
    // Extract all text runs within this paragraph
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

/**
 * Strip HTML tags from content, preserving basic text structure.
 * Used for EPUB XHTML content extraction.
 */
function stripHtmlTags(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Convert paragraphs and headings to newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
