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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse optional batch_size from request body
    let batchSize = 5;
    try {
      const body = await req.json();
      if (body.batch_size && typeof body.batch_size === 'number') {
        batchSize = Math.min(body.batch_size, 20);
      }
    } catch { /* empty body is fine */ }

    // Fetch IDs and titles only — limited batch to avoid Edge Function timeout
    const { data: items, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, user_id, title, file_name')
      .eq('processing_status', 'completed')
      .is('author', null)
      .is('archived_at', null)
      .neq('file_type', 'text_note')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: `Query failed: ${fetchErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No books need author backfill', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[backfill-authors] Processing ${items.length} books...`);
    const results: Array<{ id: string; title: string; author?: string; isbn?: string; newTitle?: string; error?: string }> = [];

    for (const item of items) {
      // Fetch text_content for this item only (avoid memory issues)
      const { data: fullItem } = await supabase
        .from('manifest_items')
        .select('text_content')
        .eq('id', item.id)
        .single();

      const textContent = fullItem?.text_content;
      if (!textContent || textContent.trim().length === 0) {
        // Mark as Unknown so it won't be re-queried
        await supabase
          .from('manifest_items')
          .update({ author: 'Unknown' })
          .eq('id', item.id);
        results.push({ id: item.id, title: item.title, error: 'No text content' });
        continue;
      }

      const contentPreview = textContent.substring(0, 2000);

      try {
        const metadataResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
            'X-Title': 'StewardShip',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-haiku-4.5',
            max_tokens: 128,
            messages: [
              {
                role: 'system',
                content: 'Extract the author name, book title, and ISBN from this text. Return a JSON object: { "author": "...", "title": "...", "isbn": "..." }. If any field cannot be determined, use null. For multiple authors, comma-separate them. Return ONLY the JSON object.',
              },
              {
                role: 'user',
                content: `Current title: ${item.title}\n\nFirst ~2000 characters:\n${contentPreview}`,
              },
            ],
          }),
        });

        if (!metadataResponse.ok) {
          const errText = await metadataResponse.text();
          results.push({ id: item.id, title: item.title, error: `AI error: ${errText.substring(0, 100)}` });
          continue;
        }

        const metaData = await metadataResponse.json();
        const metaText = (metaData.choices?.[0]?.message?.content || '').trim();

        const updateData: Record<string, unknown> = {};
        const resultEntry: { id: string; title: string; author?: string; isbn?: string; newTitle?: string } = { id: item.id, title: item.title };

        try {
          const cleaned = metaText.replace(/```json\n?|\n?```/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (parsed.author && typeof parsed.author === 'string') {
            updateData.author = parsed.author;
            resultEntry.author = parsed.author;
          }
          if (parsed.isbn && typeof parsed.isbn === 'string') {
            const isbnCleaned = parsed.isbn.replace(/[^0-9X-]/gi, '');
            if (isbnCleaned.length >= 10) {
              updateData.isbn = isbnCleaned;
              resultEntry.isbn = isbnCleaned;
            }
          }
          // Update title if still equals filename default or looks garbled
          if (parsed.title && typeof parsed.title === 'string' && parsed.title.length > 3) {
            const filenameTitle = item.file_name ? item.file_name.replace(/\.[^.]+$/, '') : '';
            const looksGarbled = item.title && !/\s/.test(item.title) && /[!@#$%^&]|^[A-Z0-9]{20,}/.test(item.title);
            if (item.title === filenameTitle || looksGarbled) {
              updateData.title = parsed.title;
              resultEntry.newTitle = parsed.title;
            }
          }
        } catch {
          results.push({ id: item.id, title: item.title, error: `Parse failed: ${metaText.substring(0, 80)}` });
          continue;
        }

        // If no author found, set to 'Unknown' so this item won't be re-queried
        if (!updateData.author) {
          updateData.author = 'Unknown';
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('manifest_items')
            .update(updateData)
            .eq('id', item.id);
        }

        results.push(resultEntry);
        console.log(`[backfill-authors] "${item.title}" → author: ${updateData.author || '(none)'}`);
      } catch (err) {
        results.push({ id: item.id, title: item.title, error: (err as Error).message });
      }

      // Rate limit: 1 second between API calls
      await new Promise((r) => setTimeout(r, 1000));
    }

    const withAuthor = results.filter((r) => r.author);
    const withISBN = results.filter((r) => r.isbn);
    const errors = results.filter((r) => 'error' in r);

    // Check how many items still need processing
    const { count: remaining } = await supabase
      .from('manifest_items')
      .select('id', { count: 'exact', head: true })
      .eq('processing_status', 'completed')
      .is('author', null)
      .is('archived_at', null)
      .neq('file_type', 'text_note');

    return new Response(
      JSON.stringify({
        processed: items.length,
        authorsFound: withAuthor.length,
        isbnsFound: withISBN.length,
        errors: errors.length,
        remaining: remaining || 0,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Backfill failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
