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

    const { manifest_item_id, regenerate_tags } = await req.json();

    if (!manifest_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing manifest_item_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the manifest item
    const { data: item, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('title, text_content, file_type, tags, file_name, author')
      .eq('id', manifest_item_id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: 'Manifest item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!item.text_content || item.text_content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text content available for enrichment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const contentPreview = item.text_content.substring(0, 3000);

    // Generate summary
    const summaryResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 256,
        messages: [
          {
            role: 'system',
            content: `You generate concise summaries of books and documents for a personal knowledge management app.

Return a JSON object: { "summary": "..." }

Rules:
- 2-4 sentences maximum
- Plain language — no jargon, no marketing speak
- Focus on: what the book is about, who it's for, and the core idea or framework it teaches
- Do not start with "This book..." — vary the opening
- Return ONLY the JSON object. No explanation, no markdown.`,
          },
          {
            role: 'user',
            content: `Title: ${item.title}\nContent preview:\n${contentPreview}`,
          },
        ],
      }),
    });

    if (!summaryResponse.ok) {
      const errBody = await summaryResponse.text();
      return new Response(
        JSON.stringify({ error: `Summary generation failed: ${errBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const summaryData = await summaryResponse.json();
    const summaryText = summaryData.choices?.[0]?.message?.content || '';

    let summary = '';
    try {
      const parsed = JSON.parse(summaryText);
      summary = parsed.summary || '';
    } catch {
      // If not valid JSON, use the raw text (AI sometimes wraps in markdown)
      summary = summaryText.replace(/```json\n?|\n?```/g, '').trim();
      try {
        const reParsed = JSON.parse(summary);
        summary = reParsed.summary || summary;
      } catch {
        // Use raw text as summary
      }
    }

    const updateData: Record<string, unknown> = { ai_summary: summary };
    const result: Record<string, unknown> = { summary };

    // Optionally regenerate tags
    if (regenerate_tags) {
      const tagResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
          'X-Title': 'StewardShip',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4.5',
          max_tokens: 256,
          messages: [
            {
              role: 'system',
              content: `You suggest topic tags for books and documents in a personal growth app.

Return a JSON object: { "tags": ["tag1", "tag2", ...] }

Rules:
- 3-6 tags maximum
- Lowercase, single words or hyphenated
- Prefer from this vocabulary when applicable:
  parenting, teens, marriage, leadership, faith, habits, productivity, communication,
  emotional-health, boundaries, identity, family, disability, grief, anxiety, finance,
  relationships, self-compassion, resilience, confidence, purpose, spirituality, health
- Add specific tags when clearly appropriate (e.g., "adhd", "divorce", "homeschool")
- Do not use generic tags like "book", "self-help", "nonfiction", "guide"
- Return ONLY the JSON object, no markdown wrapping.`,
            },
            {
              role: 'user',
              content: `Title: ${item.title}\nContent preview:\n${contentPreview}`,
            },
          ],
        }),
      });

      if (tagResponse.ok) {
        const tagData = await tagResponse.json();
        const tagText = (tagData.choices?.[0]?.message?.content || '').trim();
        let parsedTags: string[] | null = null;

        // Strategy 1: Direct JSON parse
        try {
          const parsed = JSON.parse(tagText);
          if (Array.isArray(parsed.tags)) parsedTags = parsed.tags;
          else if (Array.isArray(parsed)) parsedTags = parsed;
        } catch {
          // Strategy 2: Strip markdown code fences
          const cleaned = tagText.replace(/```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
          try {
            const reParsed = JSON.parse(cleaned);
            if (Array.isArray(reParsed.tags)) parsedTags = reParsed.tags;
            else if (Array.isArray(reParsed)) parsedTags = reParsed;
          } catch {
            // Strategy 3: Extract JSON object from surrounding text
            const jsonMatch = tagText.match(/\{[\s\S]*"tags"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
            if (jsonMatch) {
              try {
                const extracted = JSON.parse(jsonMatch[0]);
                if (Array.isArray(extracted.tags)) parsedTags = extracted.tags;
              } catch {
                // Strategy 4: Extract bare array
                const arrayMatch = tagText.match(/\[[\s\S]*?\]/);
                if (arrayMatch) {
                  try {
                    const arr = JSON.parse(arrayMatch[0]);
                    if (Array.isArray(arr)) parsedTags = arr;
                  } catch { /* exhausted strategies */ }
                }
              }
            }
          }
        }

        if (parsedTags && parsedTags.length > 0) {
          // Ensure all tags are lowercase strings
          const cleanTags = parsedTags
            .filter((t): t is string => typeof t === 'string')
            .map((t) => t.toLowerCase().trim().replace(/\s+/g, '-'))
            .filter((t) => t.length > 0);
          if (cleanTags.length > 0) {
            updateData.tags = cleanTags;
            result.tags = cleanTags;
          }
        }
      }
    }

    // Extract author/title/ISBN via AI if author is not yet set
    if (!item.author) {
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
                content: `Current title: ${item.title}\n\nFirst ~2000 characters:\n${item.text_content.substring(0, 2000)}`,
              },
            ],
          }),
        });

        if (metadataResponse.ok) {
          const metaData = await metadataResponse.json();
          const metaText = (metaData.choices?.[0]?.message?.content || '').trim();
          try {
            const cleaned = metaText.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.author && typeof parsed.author === 'string') {
              updateData.author = parsed.author;
              result.author = parsed.author;
            }
            if (parsed.isbn && typeof parsed.isbn === 'string') {
              const isbnCleaned = parsed.isbn.replace(/[^0-9X-]/gi, '');
              if (isbnCleaned.length >= 10) {
                updateData.isbn = isbnCleaned;
                result.isbn = isbnCleaned;
              }
            }
            // Only update title if still set to filename default
            if (parsed.title && typeof parsed.title === 'string' && item.file_name) {
              const filenameTitle = item.file_name.replace(/\.[^.]+$/, '');
              if (item.title === filenameTitle && parsed.title.length > 3) {
                updateData.title = parsed.title;
                result.title = parsed.title;
              }
            }
          } catch { /* JSON parse failed — skip metadata */ }
        }
      } catch (metaErr) {
        console.error('AI metadata extraction failed (non-fatal):', metaErr);
      }
    }

    // Save to database
    await supabase
      .from('manifest_items')
      .update(updateData)
      .eq('id', manifest_item_id)
      .eq('user_id', userId);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Enrichment failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
