#!/usr/bin/env node

/**
 * Backfill embeddings for all extraction tables where embedding IS NULL.
 * Uses OpenAI text-embedding-3-small directly (same as the embed Edge Function).
 *
 * Usage: node scripts/backfill-embeddings.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TABLE_CONFIG = {
  ai_framework_principles: { textCol: 'text', activeFilter: 'is_deleted' },
  manifest_summaries:      { textCol: 'text', activeFilter: 'is_deleted' },
  manifest_declarations:   { textCol: 'declaration_text', activeFilter: 'is_deleted' },
  manifest_action_steps:   { textCol: 'text', activeFilter: 'is_deleted' },
  manifest_questions:      { textCol: 'text', activeFilter: 'is_deleted' },
};

const BATCH_SIZE = 100; // OpenAI supports up to 2048, but 100 is safe for text-embedding-3-small
const MAX_TEXT_LENGTH = 30000;
const DB_FETCH_SIZE = 500; // Rows to fetch from DB per query

let totalTokens = 0;
let totalProcessed = 0;
let totalFailed = 0;

async function generateEmbeddings(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  totalTokens += data.usage?.total_tokens || 0;

  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map(d => d.embedding);
}

async function processTable(tableName, config) {
  console.log(`\n=== Processing ${tableName} ===`);

  let tableProcessed = 0;
  let tableFailed = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch batch of rows needing embeddings
    let query = supabase
      .from(tableName)
      .select(`id, ${config.textCol}`, { count: 'exact' })
      .is('embedding', null)
      .limit(DB_FETCH_SIZE);

    if (config.activeFilter === 'is_deleted') {
      query = query.eq('is_deleted', false);
    } else {
      query = query.is('archived_at', null);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      console.error(`  Error fetching ${tableName}:`, error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    const remaining = (count || 0) - rows.length;
    console.log(`  Fetched ${rows.length} rows (${remaining} more remaining)`);

    // Process in embedding API batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const validBatch = batch.filter(r => {
        const text = r[config.textCol];
        return text && text.trim().length > 0;
      });

      if (validBatch.length === 0) continue;

      const texts = validBatch.map(r => r[config.textCol].trim().slice(0, MAX_TEXT_LENGTH));

      try {
        const embeddings = await generateEmbeddings(texts);

        // Write embeddings back — parallel updates for speed
        const writePromises = validBatch.map((row, j) => {
          return supabase
            .from(tableName)
            .update({ embedding: embeddings[j] })
            .eq('id', row.id)
            .then(({ error }) => {
              if (error) {
                tableFailed++;
                totalFailed++;
                return false;
              }
              tableProcessed++;
              totalProcessed++;
              return true;
            });
        });

        await Promise.all(writePromises);

        // Log progress
        const batchEnd = Math.min(i + BATCH_SIZE, rows.length);
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${validBatch.length} rows | Total: ${tableProcessed} | Tokens: ${totalTokens.toLocaleString()}`);

        // Small delay to be nice to the API
        if (i + BATCH_SIZE < rows.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.error(`  Batch error at index ${i}:`, err.message);
        tableFailed += validBatch.length;
        totalFailed += validBatch.length;

        // If rate limited, wait and retry
        if (err.message.includes('429')) {
          console.log('  Rate limited — waiting 30s...');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          // Wait a bit and continue
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // If we got a full batch, there might be more
    hasMore = remaining > 0;

    // Small delay between DB fetches
    if (hasMore) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`  Done: ${tableProcessed} processed, ${tableFailed} failed`);
  return { processed: tableProcessed, failed: tableFailed };
}

async function main() {
  console.log('Starting embedding backfill...');
  console.log(`Model: text-embedding-3-small`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Tables: ${Object.keys(TABLE_CONFIG).join(', ')}`);

  const startTime = Date.now();

  for (const [tableName, config] of Object.entries(TABLE_CONFIG)) {
    await processTable(tableName, config);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const cost = (totalTokens / 1_000_000) * 0.02;

  console.log('\n========================================');
  console.log('EMBEDDING BACKFILL COMPLETE');
  console.log('========================================');
  console.log(`Total processed: ${totalProcessed.toLocaleString()}`);
  console.log(`Total failed:    ${totalFailed.toLocaleString()}`);
  console.log(`Total tokens:    ${totalTokens.toLocaleString()}`);
  console.log(`Estimated cost:  $${cost.toFixed(4)}`);
  console.log(`Elapsed time:    ${elapsed}s`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
