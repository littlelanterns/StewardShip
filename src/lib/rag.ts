import { supabase } from './supabase';
import type { ManifestSearchResult } from './types';

// --- Embedding ---

/**
 * Generate an embedding vector for text via the manifest-embed Edge Function.
 * The Edge Function calls OpenAI ada-002 server-side where the API key lives.
 */
export async function generateEmbedding(text: string, userId: string): Promise<number[] | null> {
  const { data, error } = await supabase.functions.invoke('manifest-embed', {
    body: { text, user_id: userId },
  });

  if (error || !data?.embedding) {
    console.error('Embedding generation failed:', error || 'No embedding returned');
    return null;
  }

  return data.embedding;
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
  },
): Promise<ManifestSearchResult[]> {
  const { matchThreshold = 0.7, matchCount = 5 } = options || {};

  // Step 1: Get query embedding
  const embedding = await generateEmbedding(query, userId);
  if (!embedding) return [];

  // Step 2: Call the similarity search RPC
  const { data, error } = await supabase.rpc('match_manifest_chunks', {
    query_embedding: embedding,
    p_user_id: userId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('Manifest search failed:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Step 3: Fetch source titles for attribution
  const itemIds = [...new Set(data.map((r: { manifest_item_id: string }) => r.manifest_item_id))];
  const { data: items } = await supabase
    .from('manifest_items')
    .select('id, title')
    .in('id', itemIds);

  const titleMap = new Map(items?.map((i: { id: string; title: string }) => [i.id, i.title]) || []);

  return data.map((r: { id: string; manifest_item_id: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }) => ({
    id: r.id,
    manifest_item_id: r.manifest_item_id,
    chunk_text: r.chunk_text,
    metadata: r.metadata,
    similarity: r.similarity,
    source_title: titleMap.get(r.manifest_item_id) || 'Unknown Source',
  }));
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
