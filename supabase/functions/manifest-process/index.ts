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
    const { manifest_item_id, user_id } = await req.json();

    if (!manifest_item_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch the manifest item
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('id', manifest_item_id)
      .eq('user_id', user_id)
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
        fullText = extractTextFromPDF(new Uint8Array(arrayBuffer));

        // Save extracted text back to manifest_items
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
    }
    // text_note: fullText already populated from item.text_content
    // audio: TODO — Whisper transcription (post-MVP)
    // image: TODO — OCR (post-MVP)

    if (!fullText || fullText.trim().length === 0) {
      await supabase
        .from('manifest_items')
        .update({ processing_status: 'failed' })
        .eq('id', manifest_item_id);
      return new Response(
        JSON.stringify({ error: 'No text content to process' }),
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
          user_id,
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
 * Basic PDF text extraction for Deno.
 * Extracts text from PDF content streams by finding text operators (BT...ET blocks).
 * Works for most text-based PDFs. Scanned/image PDFs need OCR (post-MVP).
 */
function extractTextFromPDF(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  const textParts: string[] = [];

  // Find text between BT...ET blocks (PDF text objects)
  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(decodePDFString(tjMatch[1]));
    }

    // TJ arrays: [(text) kerning (text) ...]
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

  // Fallback: look for readable text patterns
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
