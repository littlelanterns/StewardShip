import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPLIT_THRESHOLD = 780_000; // chars — matches section discovery model ceiling
const MAX_PART_CHARS = 700_000;  // safety: ensure each part fits comfortably in discovery

const BOOK_SPLIT_PROMPT = `You are analyzing a very large document to identify the best way to split it into independently readable parts for extraction and analysis. Each part should be a logical division of the content that makes sense on its own.

CRITICAL RULES:
- Target 2-8 parts. Each part should be substantial (at least 50,000 characters).
- Prefer NATURAL divisions: book parts, major divisions, testament boundaries, thematic clusters of chapters.
- For sacred texts (Bible, Book of Mormon, scriptures): use traditional major divisions.
  For example, the Bible might split into: Pentateuch, Historical Books, Wisdom Literature, Prophets, Gospels & Acts, Epistles, Revelation.
  The Book of Mormon might split into: Small Plates (1 Nephi–Omni), Words of Mormon & Mosiah, Alma, Helaman–3 Nephi, 4 Nephi–Moroni.
- For textbooks: split at part/unit boundaries or major topic divisions.
- For long novels: split at book/part boundaries or major act breaks.
- For collections/anthologies: group related works together.
- Each part needs a SHORT descriptive title (the parent book title will be prepended).
- Parts must cover the ENTIRE document with NO GAPS. Every character must belong to a part.
- Part boundaries must be contiguous: part 1 ends where part 2 begins.
- The first part must start at character 0. The last part must end at the final character.
- Try to split at chapter or section boundaries, not mid-paragraph.

Return ONLY a JSON array:
[
  { "title": "Descriptive Title for This Part", "start_char": 0, "end_char": 250000, "description": "Brief description of what this part contains" }
]

No markdown backticks, no preamble.`;

function safeParseJSON(raw: string): { parsed: unknown; error?: string } {
  if (!raw || !raw.trim()) return { parsed: null, error: 'Empty AI response' };
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();
  try { return { parsed: JSON.parse(cleaned) }; } catch { /* fall through */ }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return { parsed: JSON.parse(arrMatch[0]) }; } catch { /* fall through */ }
  }
  return { parsed: null, error: `Could not parse JSON from response: ${cleaned.substring(0, 200)}` };
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const response = await fetch(url, options);
    if (response.ok || i === retries) return response;
    if (response.status === 429 || response.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    } else {
      return response;
    }
  }
  throw new Error('Unreachable');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { manifest_item_id } = await req.json();
    if (!manifest_item_id) {
      return new Response(
        JSON.stringify({ error: 'manifest_item_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the parent item
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, user_id, title, file_type, tags, folder_group, genres, text_content, parent_manifest_item_id, part_count')
      .eq('id', manifest_item_id)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: 'Item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Guard: don't split parts, already-split items, or small items
    if (item.parent_manifest_item_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Item is already a part' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (item.part_count && item.part_count > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Item already has parts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const textContent = item.text_content || '';
    if (textContent.length < SPLIT_THRESHOLD) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Text length ${textContent.length} below threshold ${SPLIT_THRESHOLD}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[manifest-split] Splitting item "${item.title}" (${textContent.length} chars)`);

    // Build sampled text for AI analysis (same pattern as section discovery)
    let discoveryText = textContent;
    const MAX_DISCOVERY_CHARS = 600_000;
    if (discoveryText.length > MAX_DISCOVERY_CHARS) {
      const sampleSize = 15_000;
      const numSamples = Math.floor(MAX_DISCOVERY_CHARS / sampleSize);
      const step = Math.floor(discoveryText.length / numSamples);
      const samples: string[] = [];
      for (let i = 0; i < numSamples; i++) {
        const start = i * step;
        const end = Math.min(start + sampleSize, discoveryText.length);
        samples.push(
          `[POSITION: chars ${start}-${end} of ${discoveryText.length}]\n`
          + discoveryText.substring(start, end),
        );
      }
      discoveryText = samples.join('\n\n---\n\n');
      console.log(`[manifest-split] Sampled ${numSamples} windows (${discoveryText.length} chars) from ${textContent.length} char doc`);
    }

    // Get API key
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openRouterHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
      'X-Title': 'StewardShip',
    };

    // Call Haiku to identify natural split points
    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders,
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: BOOK_SPLIT_PROMPT },
          { role: 'user', content: `Document title: "${item.title}"\nDocument (${textContent.length} characters total):\n\n${discoveryText}` },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[manifest-split] AI error:', response.status, errBody.substring(0, 800));
      return new Response(
        JSON.stringify({ error: `Split analysis failed (AI ${response.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[manifest-split] AI response length:', content.length);

    const { parsed, error: parseErr } = safeParseJSON(content);
    if (!parsed || !Array.isArray(parsed) || parsed.length < 2) {
      console.error('[manifest-split] Parse failed or <2 parts:', parseErr, content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: parseErr || 'Failed to parse split result or insufficient parts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let parts = parsed as Array<{ title: string; start_char: number; end_char: number; description: string }>;
    const docLength = textContent.length;

    // Fix boundaries: ensure contiguous coverage
    parts[0].start_char = 0;
    parts[parts.length - 1].end_char = docLength;
    for (let i = 1; i < parts.length; i++) {
      parts[i].start_char = parts[i - 1].end_char;
    }

    // Safety: if any part exceeds MAX_PART_CHARS, we need more granular splitting
    // For now, just subdivide oversized parts evenly
    const finalParts: typeof parts = [];
    for (const part of parts) {
      const partLen = part.end_char - part.start_char;
      if (partLen > MAX_PART_CHARS) {
        const subCount = Math.ceil(partLen / MAX_PART_CHARS);
        const subSize = Math.ceil(partLen / subCount);
        for (let s = 0; s < subCount; s++) {
          const subStart = part.start_char + s * subSize;
          const subEnd = Math.min(part.start_char + (s + 1) * subSize, part.end_char);
          finalParts.push({
            title: subCount > 1 ? `${part.title} (${s + 1}/${subCount})` : part.title,
            start_char: subStart,
            end_char: subEnd,
            description: part.description,
          });
        }
      } else {
        finalParts.push(part);
      }
    }

    console.log(`[manifest-split] Creating ${finalParts.length} parts for "${item.title}"`);

    // Create child manifest_items
    const partIds: string[] = [];
    for (let i = 0; i < finalParts.length; i++) {
      const part = finalParts[i];
      const partText = textContent.substring(part.start_char, part.end_char);

      const { data: newPart, error: insertErr } = await supabase
        .from('manifest_items')
        .insert({
          user_id: item.user_id,
          title: `${item.title} — ${part.title}`,
          file_type: item.file_type,
          file_name: null,
          storage_path: null,
          text_content: partText,
          processing_status: 'pending',
          parent_manifest_item_id: item.id,
          part_number: i + 1,
          tags: item.tags || [],
          folder_group: item.folder_group || 'Uncategorized',
          genres: item.genres || [],
          intake_completed: true,
        })
        .select('id')
        .single();

      if (insertErr || !newPart) {
        console.error(`[manifest-split] Failed to create part ${i + 1}:`, insertErr);
        continue;
      }

      partIds.push(newPart.id);
      console.log(`[manifest-split] Created part ${i + 1}: "${part.title}" (${partText.length} chars) → ${newPart.id}`);

      // Trigger manifest-process for chunking + embedding (fire-and-forget)
      supabase.functions
        .invoke('manifest-process', {
          body: { manifest_item_id: newPart.id, user_id: item.user_id },
        })
        .catch((err: unknown) => console.error(`[manifest-split] Process trigger failed for part ${i + 1}:`, err));

      // Small delay between part creations
      if (i < finalParts.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Update parent with part_count
    await supabase
      .from('manifest_items')
      .update({ part_count: partIds.length })
      .eq('id', item.id);

    console.log(`[manifest-split] Done. ${partIds.length} parts created for "${item.title}"`);

    return new Response(
      JSON.stringify({
        success: true,
        parts_created: partIds.length,
        part_ids: partIds,
        parts: finalParts.map((p, i) => ({
          id: partIds[i],
          title: p.title,
          chars: p.end_char - p.start_char,
          description: p.description,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[manifest-split] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
