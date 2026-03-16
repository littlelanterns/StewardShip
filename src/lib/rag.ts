import { supabase } from './supabase';
import type { ManifestSearchResult } from './types';

// --- Semantic Search Result Types ---

export interface ManifestContentMatch {
  source_table: string;
  record_id: string;
  manifest_item_id: string;
  book_title: string;
  content_preview: string;
  similarity: number;
}

export interface PersonalContextMatch {
  source_table: string;
  record_id: string;
  content_preview: string;
  similarity: number;
}

// --- Embedding ---

/**
 * Generate an embedding vector for text via the manifest-embed Edge Function.
 * Default model: ada-002 (for manifest_chunks RAG search).
 * Pass model: 'text-embedding-3-small' for semantic search on extracted content.
 */
export async function generateEmbedding(
  text: string,
  userId: string,
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small',
): Promise<number[] | null> {
  const { data, error } = await supabase.functions.invoke('manifest-embed', {
    body: { text, user_id: userId, model },
  });

  if (error || !data?.embedding) {
    console.error('Embedding generation failed:', error || 'No embedding returned');
    return null;
  }

  return data.embedding;
}

/**
 * Generate an embedding using text-embedding-3-small for semantic search
 * on extracted content columns (manifest_summaries, declarations, principles, etc.)
 * and personal context (mast, keel, journal).
 */
export async function generateSearchEmbedding(text: string, userId: string): Promise<number[] | null> {
  return generateEmbedding(text, userId, 'text-embedding-3-small');
}

// --- Retrieval ---

/**
 * Search Manifest chunks by semantic similarity.
 * Returns top-k matching chunks with source titles for attribution.
 */
export async function searchManifest(
  query: string,
  userId: string,
  options?: {
    matchThreshold?: number;
    matchCount?: number;
    manifestItemId?: string;   // Filter to chunks from this specific item
    excludeItemId?: string;    // Exclude chunks from this item
  },
): Promise<ManifestSearchResult[]> {
  const { matchThreshold = 0.7, matchCount = 5 } = options || {};

  // Step 1: Get query embedding
  const embedding = await generateEmbedding(query, userId);
  if (!embedding) return [];

  // Step 2: Call the similarity search RPC — request more if we'll be filtering
  const requestCount = (options?.manifestItemId || options?.excludeItemId)
    ? matchCount * 3  // Over-fetch to compensate for post-filtering
    : matchCount;

  const { data, error } = await supabase.rpc('match_manifest_chunks', {
    query_embedding: embedding,
    p_user_id: userId,
    match_threshold: matchThreshold,
    match_count: requestCount,
  });

  if (error) {
    console.error('Manifest search failed:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Step 3: Apply item-level filters
  let results = data as Array<{ id: string; manifest_item_id: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }>;

  if (options?.manifestItemId) {
    results = results.filter((r) => r.manifest_item_id === options.manifestItemId);
  }
  if (options?.excludeItemId) {
    results = results.filter((r) => r.manifest_item_id !== options.excludeItemId);
  }

  // Trim back to requested count after filtering
  results = results.slice(0, matchCount);

  if (results.length === 0) return [];

  // Step 4: Fetch source titles for attribution
  const itemIds = [...new Set(results.map((r) => r.manifest_item_id))];
  const { data: items } = await supabase
    .from('manifest_items')
    .select('id, title')
    .in('id', itemIds);

  const titleMap = new Map(items?.map((i: { id: string; title: string }) => [i.id, i.title]) || []);

  return results.map((r) => ({
    id: r.id,
    manifest_item_id: r.manifest_item_id,
    chunk_text: r.chunk_text,
    metadata: r.metadata,
    similarity: r.similarity,
    source_title: titleMap.get(r.manifest_item_id) || 'Unknown Source',
  }));
}

// --- Semantic Search (extracted content + personal context) ---

/**
 * Search extracted book content (summaries, declarations, principles, action steps)
 * by semantic similarity. Uses text-embedding-3-small embeddings on extracted content.
 */
export async function searchManifestContent(
  query: string,
  userId: string,
  options?: {
    matchThreshold?: number;
    matchCount?: number;
  },
): Promise<ManifestContentMatch[]> {
  const { matchThreshold = 0.3, matchCount = 15 } = options || {};

  const embedding = await generateSearchEmbedding(query, userId);
  if (!embedding) return [];

  const { data, error } = await supabase.rpc('match_manifest_content', {
    query_embedding: embedding,
    target_user_id: userId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('Manifest content search failed:', error);
    return [];
  }

  return (data || []) as ManifestContentMatch[];
}

/**
 * Search personal context (mast entries, keel entries, journal entries)
 * by semantic similarity.
 */
export async function searchPersonalContext(
  query: string,
  userId: string,
  options?: {
    matchThreshold?: number;
    matchCount?: number;
  },
): Promise<PersonalContextMatch[]> {
  const { matchThreshold = 0.3, matchCount = 10 } = options || {};

  const embedding = await generateSearchEmbedding(query, userId);
  if (!embedding) return [];

  const { data, error } = await supabase.rpc('match_personal_context', {
    query_embedding: embedding,
    target_user_id: userId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('Personal context search failed:', error);
    return [];
  }

  return (data || []) as PersonalContextMatch[];
}

/**
 * Trigger embedding generation for unembedded rows.
 * Calls the embed Edge Function which processes rows with NULL embeddings.
 * Returns the number of rows processed and remaining counts.
 */
export async function triggerEmbedding(options?: {
  table?: string;
  batchSize?: number;
}): Promise<{ processed: number; failed: number; remaining: Record<string, number> }> {
  const { data, error } = await supabase.functions.invoke('embed', {
    body: {
      table: options?.table,
      batch_size: options?.batchSize || 50,
    },
  });

  if (error) {
    console.error('Embedding trigger failed:', error);
    return { processed: 0, failed: 0, remaining: {} };
  }

  return data as { processed: number; failed: number; remaining: Record<string, number> };
}

// --- Chunking Utilities ---

/**
 * Approximate token count for a string (~4 characters per token for English).
 */
export function approximateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into overlapping chunks suitable for embedding.
 * Target: 500-1000 tokens per chunk, ~100 token overlap.
 */
export function chunkText(
  text: string,
  options?: { targetTokens?: number; overlapTokens?: number },
): Array<{ text: string; tokenCount: number; index: number }> {
  const { targetTokens = 750, overlapTokens = 100 } = options || {};
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: Array<{ text: string; tokenCount: number; index: number }> = [];

  if (text.length <= targetChars) {
    return [{ text, tokenCount: approximateTokenCount(text), index: 0 }];
  }

  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);

    if (end < text.length) {
      // Prefer paragraph breaks, then sentence breaks
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + targetChars * 0.5) {
        end = paragraphBreak + 2;
      } else {
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + targetChars * 0.5) {
          end = sentenceBreak + 2;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({
        text: chunk,
        tokenCount: approximateTokenCount(chunk),
        index,
      });
      index++;
    }

    // Move forward, minus overlap — but ensure progress
    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}
