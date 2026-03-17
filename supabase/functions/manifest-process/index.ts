import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractCleanTextFromPDF, extractPDFMetadata } from '../_shared/pdf-utils.ts';

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

    // Helper to update processing_detail for real-time progress
    const setDetail = (detail: string) =>
      supabase.from('manifest_items').update({ processing_detail: detail }).eq('id', manifest_item_id);

    // 2. Update status to processing
    await supabase
      .from('manifest_items')
      .update({ processing_status: 'processing', processing_detail: 'Downloading file...' })
      .eq('id', manifest_item_id);

    let fullText = item.text_content || '';

    // 3. Extract text based on file type
    if (item.file_type === 'pdf' && item.storage_path) {
      try {
        await setDetail('Downloading PDF...');
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download PDF: ${downloadErr?.message}`);
        }

        await setDetail('Extracting text from PDF...');
        const arrayBuffer = await fileData.arrayBuffer();
        fullText = await extractCleanTextFromPDF(new Uint8Array(arrayBuffer));

        // Vision fallback for scanned/image-only PDFs
        if (!fullText || fullText.trim().length < 50) {
          console.log(`PDF text extraction yielded ${fullText.trim().length} chars — trying vision fallback`);
          const visionText = await extractViaVision(supabase, item.storage_path, 'manifest-files');
          if (visionText) {
            fullText = visionText;
          }
        }

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);

        // TOC extraction (non-fatal)
        try {
          await setDetail('Extracting table of contents...');
          const toc = await extractTOCFromPDF(new Uint8Array(arrayBuffer));
          if (toc && toc.length > 0) {
            await supabase.from('manifest_items').update({ toc }).eq('id', manifest_item_id);
          }
        } catch (tocErr) {
          console.error('PDF TOC save failed (non-fatal):', tocErr);
        }

        // Metadata extraction — author, title (non-fatal)
        try {
          const pdfMeta = await extractPDFMetadata(new Uint8Array(arrayBuffer));
          const metaUpdate: Record<string, unknown> = {};
          if (pdfMeta.author) metaUpdate.author = pdfMeta.author;
          // Only override title if current title is still the filename default AND metadata title isn't garbled
          const pdfTitleGarbled = pdfMeta.title && (
            (!/\s/.test(pdfMeta.title) && /[!@#$%^&]|^[A-Z0-9]{20,}/.test(pdfMeta.title)) ||
            /^CR![A-Z0-9]+/i.test(pdfMeta.title) ||
            /\.(azw|mobi|azw3)$/i.test(pdfMeta.title)
          );
          const currentTitleLooksGood = item.title && /\s/.test(item.title) && !/^CR![A-Z0-9]+/i.test(item.title) && !/\.(azw|mobi|azw3)$/i.test(item.title);
          const filenameTitle = item.file_name ? item.file_name.replace(/\.[^.]+$/, '') : '';
          if (pdfMeta.title && !pdfTitleGarbled && !currentTitleLooksGood && item.title === filenameTitle) {
            metaUpdate.title = pdfMeta.title;
          }
          if (Object.keys(metaUpdate).length > 0) {
            await supabase.from('manifest_items').update(metaUpdate).eq('id', manifest_item_id);
          }
        } catch (metaErr) {
          console.error('PDF metadata extraction failed (non-fatal):', metaErr);
        }
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
        await setDetail('Downloading file...');
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

        // MD TOC extraction (non-fatal) — only for .md files
        if (item.file_type === 'md' && fullText) {
          try {
            const toc = extractTOCFromMarkdown(fullText);
            if (toc && toc.length > 0) {
              await supabase.from('manifest_items').update({ toc }).eq('id', manifest_item_id);
            }
          } catch (tocErr) {
            console.error('MD TOC save failed (non-fatal):', tocErr);
          }
        }
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
        await setDetail('Downloading EPUB...');
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download EPUB: ${downloadErr?.message}`);
        }

        await setDetail('Extracting text from EPUB...');
        const arrayBuffer = await fileData.arrayBuffer();

        // Unzip ONCE with a content-only filter (skip images, fonts, media, CSS).
        // Prevents memory exhaustion on large EPUBs with map images, illustrations, etc.
        const epubFiles = await unzipEPUBContentOnly(new Uint8Array(arrayBuffer));

        fullText = extractTextFromEPUBFiles(epubFiles);

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);

        // TOC extraction (non-fatal) — reuses already-unzipped files
        try {
          await setDetail('Extracting table of contents...');
          const toc = extractTOCFromEPUBFiles(epubFiles);
          if (toc && toc.length > 0) {
            await supabase.from('manifest_items').update({ toc }).eq('id', manifest_item_id);
          }
        } catch (tocErr) {
          console.error('EPUB TOC save failed (non-fatal):', tocErr);
        }

        // Metadata extraction — author, title, ISBN from OPF (non-fatal)
        try {
          const epubMeta = extractMetadataFromEPUBFiles(epubFiles);
          const metaUpdate: Record<string, unknown> = {};
          if (epubMeta.author) metaUpdate.author = epubMeta.author;
          if (epubMeta.isbn) metaUpdate.isbn = epubMeta.isbn;
          // Only override title if:
          // 1. The current title is EXACTLY the filename (sans extension) — meaning no one has set a proper title yet
          // 2. The metadata title isn't garbled (Kindle IDs, .azw extensions, etc.)
          // 3. The current title itself looks garbled
          // NEVER override a title that already has spaces/looks like a real book title
          const epubTitleGarbled = epubMeta.title && (
            (!/\s/.test(epubMeta.title) && /[!@#$%^&]|^[A-Z0-9]{20,}/.test(epubMeta.title)) ||
            /^CR![A-Z0-9]+/i.test(epubMeta.title) ||
            /\.(azw|mobi|azw3)$/i.test(epubMeta.title)
          );
          const currentTitleLooksGood = item.title && /\s/.test(item.title) && !/^CR![A-Z0-9]+/i.test(item.title) && !/\.(azw|mobi|azw3)$/i.test(item.title);
          const filenameTitle = item.file_name ? item.file_name.replace(/\.[^.]+$/, '') : '';
          if (epubMeta.title && !epubTitleGarbled && !currentTitleLooksGood && item.title === filenameTitle) {
            metaUpdate.title = epubMeta.title;
          }
          if (Object.keys(metaUpdate).length > 0) {
            await supabase.from('manifest_items').update(metaUpdate).eq('id', manifest_item_id);
          }
        } catch (metaErr) {
          console.error('EPUB metadata extraction failed (non-fatal):', metaErr);
        }
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
        await setDetail('Downloading DOCX...');
        const { data: fileData, error: downloadErr } = await supabase
          .storage
          .from('manifest-files')
          .download(item.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`Failed to download DOCX: ${downloadErr?.message}`);
        }

        await setDetail('Extracting text from DOCX...');
        const arrayBuffer = await fileData.arrayBuffer();

        // Unzip ONCE with content-only filter (skip embedded images, media, etc.)
        const docxFiles = await unzipDOCXContentOnly(new Uint8Array(arrayBuffer));

        fullText = extractTextFromDOCXFiles(docxFiles);

        await supabase
          .from('manifest_items')
          .update({ text_content: fullText })
          .eq('id', manifest_item_id);

        // TOC extraction (non-fatal) — reuses already-unzipped files
        try {
          await setDetail('Extracting table of contents...');
          const toc = extractTOCFromDOCXFiles(docxFiles);
          if (toc && toc.length > 0) {
            await supabase.from('manifest_items').update({ toc }).eq('id', manifest_item_id);
          }
        } catch (tocErr) {
          console.error('DOCX TOC save failed (non-fatal):', tocErr);
        }

        // Metadata extraction — author, title from core.xml (non-fatal)
        try {
          const docxMeta = extractMetadataFromDOCXFiles(docxFiles);
          const metaUpdate: Record<string, unknown> = {};
          if (docxMeta.author) metaUpdate.author = docxMeta.author;
          // Only override title if it still matches the filename default
          if (docxMeta.title && item.file_name && item.title === item.file_name.replace(/\.[^.]+$/, '')) {
            metaUpdate.title = docxMeta.title;
          }
          if (Object.keys(metaUpdate).length > 0) {
            await supabase.from('manifest_items').update(metaUpdate).eq('id', manifest_item_id);
          }
        } catch (metaErr) {
          console.error('DOCX metadata extraction failed (non-fatal):', metaErr);
        }
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
    } else if (item.file_type === 'image' && item.storage_path) {
      // Images: AI vision extraction for charts, screenshots, etc.
      try {
        await setDetail('Analyzing image with AI vision...');
        const visionText = await extractViaVision(supabase, item.storage_path, 'manifest-files');
        if (visionText) {
          fullText = visionText;
          await supabase
            .from('manifest_items')
            .update({ text_content: fullText })
            .eq('id', manifest_item_id);
        }
      } catch (imgErr) {
        console.error('Image vision extraction failed:', imgErr);
        await supabase
          .from('manifest_items')
          .update({ processing_status: 'failed' })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `Image processing failed: ${(imgErr as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
    // text_note: fullText already populated from item.text_content
    // audio: TODO — Whisper transcription (post-MVP)

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

    // 4. Chunk the text and filter out garbage
    await setDetail('Chunking content...');
    const rawChunks = chunkText(fullText);
    let chunks = rawChunks.filter((c) => isQualityChunk(c.text));
    console.log(`Chunking: ${rawChunks.length} raw → ${chunks.length} quality chunks (filtered ${rawChunks.length - chunks.length})`);

    // Cap chunks for very large books to stay within Edge Function memory/timeout
    const MAX_CHUNKS = 500;
    if (chunks.length > MAX_CHUNKS) {
      console.log(`Capping ${chunks.length} chunks to ${MAX_CHUNKS} (evenly sampled)`);
      const step = chunks.length / MAX_CHUNKS;
      const sampled: typeof chunks = [];
      for (let s = 0; s < MAX_CHUNKS; s++) {
        sampled.push(chunks[Math.floor(s * step)]);
      }
      // Re-index so chunk_index is sequential
      chunks = sampled.map((c, idx) => ({ ...c, index: idx }));
    }

    await setDetail(`Chunked into ${chunks.length} segments`);

    if (chunks.length === 0) {
      await supabase
        .from('manifest_items')
        .update({ processing_status: 'failed' })
        .eq('id', manifest_item_id);
      return new Response(
        JSON.stringify({ error: 'No usable text content found after quality filtering. The file may contain only images or non-text data.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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

    // Release text extraction memory before starting embeddings
    fullText = '';

    // Delete any existing chunks FIRST (in case of re-processing)
    await supabase
      .from('manifest_chunks')
      .delete()
      .eq('manifest_item_id', manifest_item_id);

    // Embed and insert batch-by-batch to keep peak memory low.
    // Each batch: embed → build records → insert → release.
    // Smaller batches (100) use less memory than accumulating 500+ embeddings.
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
    let totalChunksInserted = 0;
    let totalTokens = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      await setDetail(`Embedding & saving (batch ${batchNum} of ${totalBatches})...`);
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
        // Partial progress is still saved — don't delete what we've inserted
        await supabase
          .from('manifest_items')
          .update({
            processing_status: totalChunksInserted > 0 ? 'completed' : 'failed',
            chunk_count: totalChunksInserted,
            processing_detail: totalChunksInserted > 0
              ? `Partial: ${totalChunksInserted} of ${chunks.length} chunks (embedding failed at batch ${batchNum})`
              : null,
          })
          .eq('id', manifest_item_id);
        return new Response(
          JSON.stringify({ error: `Embedding failed at batch ${batchNum}: ${errBody}`, partial_chunks: totalChunksInserted }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const embData = await embResponse.json();

      // Build records for this batch only
      const batchRecords = batch.map((chunk, j) => ({
        user_id: userId,
        manifest_item_id,
        chunk_index: chunk.index,
        chunk_text: chunk.text,
        token_count: chunk.tokenCount,
        embedding: embData.data[j].embedding,
        metadata: {},
      }));

      // Insert immediately — don't accumulate
      const { error: insertErr } = await supabase
        .from('manifest_chunks')
        .insert(batchRecords);

      if (insertErr) {
        console.error(`Chunk insert failed (batch ${batchNum}):`, insertErr);
      } else {
        totalChunksInserted += batchRecords.length;
        totalTokens += batchRecords.reduce((sum, c) => sum + c.token_count, 0);
      }
      // batchRecords and embData go out of scope → GC can reclaim
    }

    // 6. Update manifest item status (clear processing_detail on completion)
    await supabase
      .from('manifest_items')
      .update({
        processing_status: 'completed',
        chunk_count: totalChunksInserted,
        processing_detail: null,
      })
      .eq('id', manifest_item_id);

    // 7. Auto-clone to admin if uploader is not admin
    const uploaderEmail = jwtPayload.email as string;
    await autoCloneToAdmin(supabase, manifest_item_id, userId, uploaderEmail, totalChunksInserted);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: totalChunksInserted,
        total_tokens: totalTokens,
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

// --- TOC Types ---

interface TocEntry {
  title: string;
  level: number;
}

// --- Helper Functions ---

/**
 * Filter out garbage chunks — PDF metadata, ICC color profiles, binary artifacts.
 * Quality text has mostly letters/spaces and forms coherent sentences.
 */
function isQualityChunk(text: string): boolean {
  // Skip very short chunks
  if (text.length < 50) return false;

  // Calculate letter/space ratio — quality text is mostly letters and spaces
  const letters = text.replace(/[^a-zA-Z\s]/g, '').length;
  const ratio = letters / text.length;
  if (ratio < 0.5) return false;

  // Check for known PDF metadata / binary artifact patterns
  const garbagePatterns = [
    /ICCBased|ColorSpace|\/Filter/i,
    /Hewlett-Packard|Copyright.*HP/i,
    /IEC\s*61966/i,
    /Reference Viewing Condition/i,
    /\/Type\s*\/\w+/,
    /obj\s*<<|endobj|xref|trailer/,
    /stream\r?\nendstream/,
    /\/Length\s+\d+\s*\/Filter/,
    /\/FontDescriptor|\/BaseFont|\/Encoding/,
    /sRGB\s*IEC/i,
  ];
  for (const pattern of garbagePatterns) {
    if (pattern.test(text)) return false;
  }

  // Must have at least some real words (5+)
  const words = text.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 5) return false;

  return true;
}

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

// --- Metadata Extraction Helpers ---

interface FileMetadata {
  title: string | null;
  author: string | null;
  isbn?: string | null;
}

/**
 * Extract metadata (title, author, ISBN) from pre-unzipped EPUB OPF file.
 * Parses dc:creator, dc:title, and dc:identifier elements.
 */
function extractMetadataFromEPUBFiles(files: Record<string, Uint8Array>): FileMetadata & { isbn: string | null } {
  try {
    const containerBytes = files['META-INF/container.xml'];
    if (!containerBytes) return { title: null, author: null, isbn: null };

    const containerXml = new TextDecoder().decode(containerBytes);
    const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
    const opfPath = opfPathMatch?.[1] || '';
    if (!opfPath || !files[opfPath]) return { title: null, author: null, isbn: null };

    const opfContent = new TextDecoder().decode(files[opfPath]);

    // Extract dc:title
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    const title = titleMatch?.[1]?.trim() || null;

    // Extract dc:creator (may be multiple)
    const authorRegex = /<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi;
    const authors: string[] = [];
    let authorMatch;
    while ((authorMatch = authorRegex.exec(opfContent)) !== null) {
      const a = authorMatch[1].trim();
      if (a) authors.push(a);
    }
    const author = authors.length > 0 ? authors.join(', ') : null;

    // Extract ISBN from dc:identifier
    const identifierRegex = /<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/gi;
    let isbn: string | null = null;
    let idMatch;
    while ((idMatch = identifierRegex.exec(opfContent)) !== null) {
      const fullTag = opfContent.substring(
        opfContent.lastIndexOf('<dc:identifier', idMatch.index),
        idMatch.index + idMatch[0].length,
      );
      const value = idMatch[1].trim();

      // Check for explicit ISBN scheme attribute
      if (/scheme\s*=\s*["']ISBN["']/i.test(fullTag) || /opf:scheme\s*=\s*["']ISBN["']/i.test(fullTag)) {
        isbn = value.replace(/^urn:isbn:/i, '').replace(/[^0-9X-]/gi, '');
        break;
      }
      // Check if value looks like an ISBN
      const cleaned = value.replace(/^urn:isbn:/i, '').replace(/[^0-9X]/gi, '');
      if (/^(\d{10}|\d{13}|\d{9}X)$/i.test(cleaned)) {
        isbn = cleaned;
      }
    }

    if (title || author || isbn) {
      console.log(`[EPUB] Metadata — title: ${title || '(none)'}, author: ${author || '(none)'}, isbn: ${isbn || '(none)'}`);
    }

    return { title, author, isbn };
  } catch (err) {
    console.error('[EPUB] Metadata extraction failed (non-fatal):', err);
    return { title: null, author: null, isbn: null };
  }
}

/**
 * Extract metadata (title, author) from pre-unzipped DOCX docProps/core.xml.
 * Parses dc:creator and dc:title elements.
 */
function extractMetadataFromDOCXFiles(files: Record<string, Uint8Array>): FileMetadata {
  try {
    // Try both casing variants — ZIP entry names may vary
    const coreXml = files['docProps/core.xml'] || files['docprops/core.xml'];
    if (!coreXml) return { title: null, author: null };

    const xml = new TextDecoder().decode(coreXml);

    const titleMatch = xml.match(/<dc:title>([^<]+)<\/dc:title>/i);
    const rawTitle = titleMatch?.[1]?.trim() || null;

    const creatorMatch = xml.match(/<dc:creator>([^<]+)<\/dc:creator>/i);
    const rawAuthor = creatorMatch?.[1]?.trim() || null;

    // Filter out generic DOCX author values
    const author = rawAuthor && !/^(Microsoft Office User|Unknown|Author)$/i.test(rawAuthor) ? rawAuthor : null;
    const title = rawTitle && rawTitle.length > 1 ? rawTitle : null;

    if (title || author) {
      console.log(`[DOCX] Metadata — title: ${title || '(none)'}, author: ${author || '(none)'}`);
    }

    return { title, author };
  } catch (err) {
    console.error('[DOCX] Metadata extraction failed (non-fatal):', err);
    return { title: null, author: null };
  }
}

/**
 * Unzip an EPUB file, filtering out binary assets (images, fonts, media, CSS).
 * Only decompresses text/XML content files to minimize memory usage.
 * A large EPUB with illustrations/maps can have 50-100MB of decompressed binary data;
 * this filter keeps only the ~1-5MB of text content we actually need.
 */
async function unzipEPUBContentOnly(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import('https://esm.sh/fflate@0.8.2');

  // Content extensions we need for text extraction and TOC
  const CONTENT_EXTENSIONS = [
    '.xml', '.xhtml', '.html', '.htm', '.opf', '.ncx',
  ];
  // Binary extensions to skip (images, fonts, media, styles)
  const SKIP_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.tiff', '.ico',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.css', '.js',
    '.mp3', '.mp4', '.ogg', '.wav', '.m4a',
    '.pdf',
  ];

  const files = unzipSync(bytes, {
    filter(file) {
      const name = file.name.toLowerCase();
      // Always include META-INF for container.xml
      if (name.startsWith('meta-inf/')) return true;
      // Skip known binary extensions
      if (SKIP_EXTENSIONS.some((ext) => name.endsWith(ext))) return false;
      // Include known content extensions
      if (CONTENT_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
      // Skip directories
      if (name.endsWith('/')) return false;
      // Default: skip unknown files (likely binary assets)
      return false;
    },
  });

  const totalFiles = Object.keys(files).length;
  console.log(`[EPUB] Unzipped ${totalFiles} content files (filtered binary assets)`);
  return files;
}

/**
 * Extract text from pre-unzipped EPUB files.
 * Reads the OPF manifest/spine to extract content in reading order.
 */
function extractTextFromEPUBFiles(files: Record<string, Uint8Array>): string {
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
 * Unzip a DOCX file, filtering out embedded images, media, and other binary assets.
 * Only decompresses XML content files needed for text and TOC extraction.
 */
async function unzipDOCXContentOnly(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import('https://esm.sh/fflate@0.8.2');

  const files = unzipSync(bytes, {
    filter(file) {
      const name = file.name.toLowerCase();
      // We only need XML files from the word/ directory + [Content_Types].xml
      if (name.endsWith('.xml') || name.endsWith('.rels')) return true;
      // Skip everything else (images, fonts, media, etc.)
      return false;
    },
  });

  const totalFiles = Object.keys(files).length;
  console.log(`[DOCX] Unzipped ${totalFiles} content files (filtered binary assets)`);
  return files;
}

/**
 * Extract text from pre-unzipped DOCX files.
 * Reads word/document.xml and extracts text from <w:t> tags, preserving paragraph structure.
 */
function extractTextFromDOCXFiles(files: Record<string, Uint8Array>): string {
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

/**
 * AI vision extraction fallback.
 * Creates a signed URL for the file, sends to OpenRouter Haiku for text extraction.
 * Used for scanned PDFs and image files (charts, screenshots, etc.).
 */
async function extractViaVision(
  supabase: ReturnType<typeof createClient>,
  storagePath: string,
  bucket: string,
): Promise<string | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('No OPENROUTER_API_KEY — cannot use vision fallback');
    return null;
  }

  try {
    const { data: signedData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 600); // 10 min expiry

    if (!signedData?.signedUrl) {
      console.error('Failed to create signed URL for vision fallback');
      return null;
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
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text, data, and information from this image. If it contains a chart or graph, describe the data points, axes, labels, values, and trends in structured plain text. If it contains a table, reproduce the table data. If it contains handwritten or printed text, transcribe it. Return only the extracted content as plain text, structured for readability. Do not add commentary or interpretation.',
              },
              { type: 'image_url', image_url: { url: signedData.signedUrl } },
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

// --- TOC Extraction Functions ---

/**
 * Extract table of contents from pre-unzipped EPUB files.
 * Tries EPUB3 nav document first, falls back to EPUB2 NCX.
 * Returns null if no TOC can be extracted.
 */
function extractTOCFromEPUBFiles(files: Record<string, Uint8Array>): TocEntry[] | null {
  try {
    const containerBytes = files['META-INF/container.xml'];
    if (!containerBytes) return null;

    const containerXml = new TextDecoder().decode(containerBytes);
    const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
    const opfPath = opfPathMatch?.[1] || '';
    if (!opfPath || !files[opfPath]) return null;

    const opfContent = new TextDecoder().decode(files[opfPath]);
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // Try EPUB3 nav document first
    const navItemMatch = opfContent.match(/<item[^>]+properties="[^"]*nav[^"]*"[^>]+href="([^"]+)"/);
    if (navItemMatch) {
      const navPath = opfDir + decodeURIComponent(navItemMatch[1]);
      const navBytes = files[navPath];
      if (navBytes) {
        const entries = parseEPUB3Nav(new TextDecoder().decode(navBytes));
        if (entries.length > 0) return entries;
      }
    }

    // Fall back to EPUB2 NCX
    const ncxItemMatch = opfContent.match(/<item[^>]+media-type="application\/x-dtbncx\+xml"[^>]+href="([^"]+)"/);
    if (ncxItemMatch) {
      const ncxPath = opfDir + decodeURIComponent(ncxItemMatch[1]);
      const ncxBytes = files[ncxPath];
      if (ncxBytes) {
        const entries = parseNCX(new TextDecoder().decode(ncxBytes));
        if (entries.length > 0) return entries;
      }
    }

    return null;
  } catch (err) {
    console.error('EPUB TOC extraction failed (non-fatal):', err);
    return null;
  }
}

function parseEPUB3Nav(html: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const tocNavMatch = html.match(/<nav[^>]+epub:type="[^"]*toc[^"]*"[^>]*>([\s\S]*?)<\/nav>/i);
  if (!tocNavMatch) return entries;
  parseNavOl(tocNavMatch[1], entries, 1);
  return entries;
}

function parseNavOl(html: string, entries: TocEntry[], level: number): void {
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const liContent = match[1];
    const aMatch = liContent.match(/<a[^>]*>([^<]+)<\/a>/i);
    if (aMatch) {
      const title = aMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (title) entries.push({ title, level });
    }
    const nestedOlMatch = liContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
    if (nestedOlMatch) parseNavOl(nestedOlMatch[1], entries, level + 1);
  }
}

function parseNCX(xml: string): TocEntry[] {
  const entries: TocEntry[] = [];
  parseNavPoints(xml, entries, 1);
  return entries;
}

function parseNavPoints(xml: string, entries: TocEntry[], level: number): void {
  const navPointRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi;
  let match;
  while ((match = navPointRegex.exec(xml)) !== null) {
    const content = match[1];
    const labelMatch = content.match(/<text>([^<]+)<\/text>/i);
    if (labelMatch) {
      const title = labelMatch[1].replace(/&amp;/g, '&').trim();
      if (title) entries.push({ title, level });
    }
    const nestedContent = content
      .replace(/<navLabel>[\s\S]*?<\/navLabel>/gi, '')
      .replace(/<content[^>]*\/>/gi, '');
    if (nestedContent.includes('<navPoint')) {
      parseNavPoints(nestedContent, entries, level + 1);
    }
  }
}

/**
 * Extract outline/bookmarks from a PDF file using unpdf/PDF.js.
 * Returns null if the PDF has no outline or extraction fails.
 */
async function extractTOCFromPDF(bytes: Uint8Array): Promise<TocEntry[] | null> {
  try {
    const { getDocumentProxy } = await import('https://esm.sh/unpdf@1.4.0');
    const pdf = await getDocumentProxy(bytes);
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) return null;

    const entries: TocEntry[] = [];
    flattenOutline(outline, entries, 1);
    return entries.length > 0 ? entries : null;
  } catch (err) {
    console.error('PDF TOC extraction failed (non-fatal):', err);
    return null;
  }
}

function flattenOutline(
  items: Array<{ title: string; items?: unknown[] }>,
  entries: TocEntry[],
  level: number,
): void {
  for (const item of items) {
    if (item.title?.trim()) {
      entries.push({ title: item.title.trim(), level });
    }
    if (item.items && item.items.length > 0) {
      flattenOutline(item.items as Array<{ title: string; items?: unknown[] }>, entries, level + 1);
    }
  }
}

/**
 * Extract headings from pre-unzipped DOCX files as a pseudo-TOC.
 * Looks for paragraphs with Heading1-Heading3 styles in word/document.xml.
 * Returns null if no headings found.
 */
function extractTOCFromDOCXFiles(files: Record<string, Uint8Array>): TocEntry[] | null {
  try {
    const documentXml = files['word/document.xml'];
    if (!documentXml) return null;

    const xml = new TextDecoder().decode(documentXml);
    const entries: TocEntry[] = [];

    // Split by paragraphs and check for heading styles
    const paragraphs = xml.split(/<w:p[ >]/);
    for (const para of paragraphs) {
      const styleMatch = para.match(/<w:pStyle\s+w:val="Heading(\d)"/i);
      if (!styleMatch) continue;

      const level = parseInt(styleMatch[1], 10);
      if (level > 3) continue; // only H1-H3

      // Extract text runs
      const textRunRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let runMatch;
      const parts: string[] = [];
      while ((runMatch = textRunRegex.exec(para)) !== null) {
        parts.push(runMatch[1]);
      }
      const title = parts.join('').trim();
      if (title) entries.push({ title, level });
    }

    return entries.length > 0 ? entries : null;
  } catch (err) {
    console.error('DOCX TOC extraction failed (non-fatal):', err);
    return null;
  }
}

/**
 * Extract headings from Markdown text as a TOC.
 * Returns null if no headings found.
 */
function extractTOCFromMarkdown(text: string): TocEntry[] | null {
  const entries: TocEntry[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      entries.push({ title: match[2].trim(), level: match[1].length });
    }
  }
  return entries.length > 0 ? entries : null;
}

// --- Auto-Clone to Admin ---

const ADMIN_EMAIL = 'tenisewertman@gmail.com';

/**
 * After processing a book uploaded by a non-admin user, auto-clone it to the admin
 * with independent chunks. This gives the admin full control over the book even if
 * the original uploader deletes it. Also handles multi-part books by linking
 * parent-child relationships on the admin's clones.
 *
 * Duplicate prevention: skips if admin already has a clone of this exact item
 * (by source_manifest_item_id) OR a book with the same title+file_type (fuzzy match).
 */
async function autoCloneToAdmin(
  supabase: ReturnType<typeof createClient>,
  manifestItemId: string,
  userId: string,
  uploaderEmail: string,
  totalChunksInserted: number,
): Promise<void> {
  try {
    // Skip if uploader IS the admin
    if (uploaderEmail === ADMIN_EMAIL) return;

    // Find admin user
    const { data: adminListData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const adminUser = adminListData?.users?.find((u: { email?: string }) => u.email === ADMIN_EMAIL);
    if (!adminUser) {
      console.log('Auto-clone: admin user not found, skipping');
      return;
    }
    const adminId = adminUser.id;

    // Check if admin already has a clone of this exact item
    const { data: existingClone } = await supabase
      .from('manifest_items')
      .select('id')
      .eq('user_id', adminId)
      .eq('source_manifest_item_id', manifestItemId)
      .is('archived_at', null)
      .maybeSingle();

    if (existingClone) {
      console.log(`Auto-clone: admin already has clone of ${manifestItemId}, skipping`);
      return;
    }

    // Re-fetch item to get latest metadata (toc, ai_summary may have been updated)
    const { data: latestItem } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('id', manifestItemId)
      .single();

    if (!latestItem) return;

    // Duplicate prevention: check if admin already has a book with same title + file_type
    const { data: titleDup } = await supabase
      .from('manifest_items')
      .select('id, title')
      .eq('user_id', adminId)
      .eq('title', latestItem.title)
      .eq('file_type', latestItem.file_type)
      .is('archived_at', null)
      .is('parent_manifest_item_id', null) // only check top-level items
      .maybeSingle();

    if (titleDup) {
      console.log(`Auto-clone: admin already has "${latestItem.title}" (${titleDup.id}), skipping duplicate`);
      return;
    }

    // Handle multi-part: if this is a child part, find/create admin's parent clone
    let adminParentId: string | null = null;
    if (latestItem.parent_manifest_item_id) {
      const { data: adminParent } = await supabase
        .from('manifest_items')
        .select('id')
        .eq('user_id', adminId)
        .eq('source_manifest_item_id', latestItem.parent_manifest_item_id)
        .is('archived_at', null)
        .maybeSingle();

      if (adminParent) {
        adminParentId = adminParent.id;
      }
      // If parent clone doesn't exist yet, it will be created when the parent processes
    }

    // Create clone for admin
    const { data: clone, error: cloneErr } = await supabase
      .from('manifest_items')
      .insert({
        user_id: adminId,
        title: latestItem.title,
        file_type: latestItem.file_type,
        file_name: latestItem.file_name,
        storage_path: latestItem.storage_path,
        text_content: latestItem.text_content,
        file_size_bytes: latestItem.file_size_bytes,
        tags: latestItem.tags || [],
        folder_group: latestItem.folder_group,
        genres: latestItem.genres || [],
        ai_summary: latestItem.ai_summary,
        toc: latestItem.toc,
        chunk_count: totalChunksInserted,
        processing_status: 'completed',
        intake_completed: true,
        source_manifest_item_id: manifestItemId,
        parent_manifest_item_id: adminParentId,
        part_number: latestItem.part_number,
        part_count: latestItem.part_count,
        usage_designations: latestItem.usage_designations || ['general_reference'],
      })
      .select('id')
      .single();

    if (cloneErr || !clone) {
      console.error('Auto-clone to admin failed:', cloneErr);
      return;
    }

    // Copy chunks to admin's clone in batches
    const { data: chunks } = await supabase
      .from('manifest_chunks')
      .select('chunk_index, chunk_text, token_count, embedding, metadata')
      .eq('manifest_item_id', manifestItemId);

    if (chunks && chunks.length > 0) {
      const CLONE_BATCH = 100;
      for (let i = 0; i < chunks.length; i += CLONE_BATCH) {
        const batch = chunks.slice(i, i + CLONE_BATCH).map((c: {
          chunk_index: number; chunk_text: string; token_count: number;
          embedding: number[]; metadata: Record<string, unknown>;
        }) => ({
          user_id: adminId,
          manifest_item_id: clone.id,
          chunk_index: c.chunk_index,
          chunk_text: c.chunk_text,
          token_count: c.token_count,
          embedding: c.embedding,
          metadata: c.metadata || {},
        }));
        const { error: insertErr } = await supabase.from('manifest_chunks').insert(batch);
        if (insertErr) {
          console.error(`Auto-clone chunk batch failed:`, insertErr);
        }
      }
    }

    // If this is a parent item with part_count, update the clone's part_count
    // (child parts will link to this clone when they process)
    if (latestItem.part_count && latestItem.part_count > 0) {
      console.log(`Auto-cloned parent ${manifestItemId} to admin as ${clone.id} (${latestItem.part_count} parts expected)`);
    } else {
      console.log(`Auto-cloned ${manifestItemId} to admin as ${clone.id} with ${chunks?.length || 0} chunks`);
    }
  } catch (err) {
    // Non-fatal — don't break the user's processing
    console.error('Auto-clone to admin error (non-fatal):', err);
  }
}
