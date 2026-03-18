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
    // Supabase validates JWT before Edge Function runs — auth verified

    const body = await req.json();
    const { text, model: requestedModel, manifest_item_id } = body;

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured for embeddings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Support both ada-002 (default, for manifest_chunks RAG) and
    // text-embedding-3-small (for semantic search on extracted content)
    const ALLOWED_MODELS = ['text-embedding-ada-002', 'text-embedding-3-small'];
    const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : 'text-embedding-ada-002';

    // --- Batch mode: embed all chunks for a specific manifest_item_id ---
    if (manifest_item_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch all chunks without embeddings for this item
      const { data: chunks, error: fetchErr } = await supabase
        .from('manifest_chunks')
        .select('id, chunk_text')
        .eq('manifest_item_id', manifest_item_id)
        .is('embedding', null)
        .order('chunk_index', { ascending: true });

      if (fetchErr || !chunks || chunks.length === 0) {
        return new Response(
          JSON.stringify({ embedded: 0, message: fetchErr?.message || 'No chunks need embedding' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log(`[manifest-embed] Batch embedding ${chunks.length} chunks for item ${manifest_item_id}`);

      const BATCH_SIZE = 100;
      let totalEmbedded = 0;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c: { chunk_text: string }) => c.chunk_text);

        const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, input: texts }),
        });

        if (!embResponse.ok) {
          const errBody = await embResponse.text();
          console.error(`[manifest-embed] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errBody);
          continue; // Skip failed batch, try next
        }

        const embData = await embResponse.json();

        // Update each chunk with its embedding
        for (let j = 0; j < batch.length; j++) {
          const embedding = embData.data?.[j]?.embedding;
          if (embedding) {
            await supabase
              .from('manifest_chunks')
              .update({ embedding })
              .eq('id', batch[j].id);
            totalEmbedded++;
          }
        }
      }

      console.log(`[manifest-embed] Completed: ${totalEmbedded}/${chunks.length} chunks embedded`);

      return new Response(
        JSON.stringify({ embedded: totalEmbedded, total: chunks.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Single text mode (original behavior) ---
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text or manifest_item_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI embedding error: ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding) {
      return new Response(
        JSON.stringify({ error: 'No embedding returned from OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ embedding }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
