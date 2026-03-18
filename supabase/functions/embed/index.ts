import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Table configurations for embedding generation.
 * Each entry defines which text column(s) to embed and how to filter active rows.
 */
interface TableConfig {
  textColumns: string[];
  activeFilter: 'is_deleted' | 'archived_at';
}

const TABLE_CONFIG: Record<string, TableConfig> = {
  manifest_summaries: {
    textColumns: ['text'],
    activeFilter: 'is_deleted',
  },
  manifest_declarations: {
    textColumns: ['declaration_text'],
    activeFilter: 'is_deleted',
  },
  ai_framework_principles: {
    textColumns: ['text'],
    activeFilter: 'is_deleted',
  },
  manifest_action_steps: {
    textColumns: ['text'],
    activeFilter: 'is_deleted',
  },
  manifest_questions: {
    textColumns: ['text'],
    activeFilter: 'is_deleted',
  },
  mast_entries: {
    textColumns: ['text'],
    activeFilter: 'archived_at',
  },
  keel_entries: {
    textColumns: ['text'],
    activeFilter: 'archived_at',
  },
  journal_entries: {
    textColumns: ['text'],
    activeFilter: 'archived_at',
  },
};

const MAX_TEXT_LENGTH = 30000; // ~7500 tokens safety limit
const DEFAULT_BATCH_SIZE = 50;
const OPENAI_EMBEDDING_BATCH = 100; // Max texts per OpenAI API call

interface EmbedRow {
  table: string;
  id: string;
  text: string;
}

/**
 * Fetch rows that need embeddings from a specific table.
 */
async function fetchUnembeddedRows(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  config: TableConfig,
  limit: number,
): Promise<{ rows: EmbedRow[]; totalRemaining: number }> {
  const selectCols = ['id', ...config.textColumns].join(', ');

  let query = supabase
    .from(tableName)
    .select(selectCols, { count: 'exact' })
    .is('embedding', null)
    .limit(limit);

  // Apply active-row filter
  if (config.activeFilter === 'is_deleted') {
    query = query.eq('is_deleted', false);
  } else {
    query = query.is('archived_at', null);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error(`Failed to fetch from ${tableName}:`, error?.message);
    return { rows: [], totalRemaining: 0 };
  }

  const rows: EmbedRow[] = data.map((row: Record<string, unknown>) => ({
    table: tableName,
    id: row.id as string,
    text: config.textColumns
      .map((col) => (row[col] as string) || '')
      .join(' ')
      .trim()
      .slice(0, MAX_TEXT_LENGTH),
  }));

  return { rows, totalRemaining: Math.max(0, (count || 0) - data.length) };
}

/**
 * Call OpenAI text-embedding-3-small for a batch of texts.
 * Returns array of embedding vectors (number[][]).
 */
async function generateEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<number[][] | null> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('OpenAI embedding error:', errBody);
    return null;
  }

  const data = await response.json();
  // OpenAI returns embeddings sorted by index, but explicitly sort to be safe
  const sorted = (data.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Write embedding back to the source table row.
 */
async function writeEmbedding(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  recordId: string,
  embedding: number[],
): Promise<boolean> {
  const { error } = await supabase
    .from(tableName)
    .update({ embedding })
    .eq('id', recordId);

  if (error) {
    console.error(`Failed to write embedding to ${tableName}/${recordId}:`, error.message);
    return false;
  }
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional params
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body — process all tables
    }

    const targetTable = (body.table as string) || null;
    const batchSize = Math.min(
      Math.max((body.batch_size as number) || DEFAULT_BATCH_SIZE, 1),
      200,
    );

    // Collect rows needing embeddings
    const allRows: EmbedRow[] = [];
    const remainingCounts: Record<string, number> = {};

    for (const [tableName, config] of Object.entries(TABLE_CONFIG)) {
      if (targetTable && tableName !== targetTable) continue;
      if (allRows.length >= batchSize) break;

      const { rows, totalRemaining } = await fetchUnembeddedRows(
        supabase,
        tableName,
        config,
        batchSize - allRows.length,
      );

      allRows.push(...rows);
      if (totalRemaining > 0) {
        remainingCounts[tableName] = totalRemaining;
      }
    }

    // Filter out empty texts
    const validRows = allRows.filter((r) => r.text.length > 0);

    if (validRows.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, remaining: remainingCounts, message: 'No rows to embed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Process in OpenAI batch chunks (API supports up to 2048 inputs, we cap at 100)
    let totalProcessed = 0;
    let totalFailed = 0;

    for (let i = 0; i < validRows.length; i += OPENAI_EMBEDDING_BATCH) {
      const batch = validRows.slice(i, i + OPENAI_EMBEDDING_BATCH);
      const texts = batch.map((r) => r.text);

      const embeddings = await generateEmbeddings(texts, openaiApiKey);

      if (!embeddings) {
        totalFailed += batch.length;
        console.error(`Embedding batch failed (${batch.length} rows starting at index ${i})`);
        continue;
      }

      // Write each embedding back to its source table
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const embedding = embeddings[j];

        if (!embedding) {
          totalFailed++;
          continue;
        }

        const success = await writeEmbedding(supabase, row.table, row.id, embedding);
        if (success) {
          totalProcessed++;
        } else {
          totalFailed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        processed: totalProcessed,
        failed: totalFailed,
        remaining: remainingCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Embed function error:', (err as Error).message);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
