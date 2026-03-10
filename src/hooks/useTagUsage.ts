import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Tracks which tags the user clicks most, persisting counts to
 * user_settings.tag_usage_counts for usage-based sorting.
 */
export function useTagUsage() {
  const { user } = useAuthContext();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const loaded = useRef(false);
  const pendingFlush = useRef<Record<string, number>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load counts once
  useEffect(() => {
    if (!user || loaded.current) return;
    loaded.current = true;
    supabase
      .from('user_settings')
      .select('tag_usage_counts')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.tag_usage_counts) {
          setCounts(data.tag_usage_counts as Record<string, number>);
        }
      });
  }, [user]);

  // Flush pending increments to DB (debounced)
  const flush = useCallback(() => {
    if (!user) return;
    const pending = { ...pendingFlush.current };
    if (Object.keys(pending).length === 0) return;
    pendingFlush.current = {};

    // Merge with current counts and save
    setCounts((prev) => {
      const merged = { ...prev };
      for (const [tag, inc] of Object.entries(pending)) {
        merged[tag] = (merged[tag] || 0) + inc;
      }
      // Fire-and-forget save
      supabase
        .from('user_settings')
        .update({ tag_usage_counts: merged })
        .eq('user_id', user.id)
        .then();
      return merged;
    });
  }, [user]);

  // Record a tag click — batches and debounces DB writes
  const recordTagClick = useCallback((tag: string) => {
    pendingFlush.current[tag] = (pendingFlush.current[tag] || 0) + 1;

    // Optimistic local update
    setCounts((prev) => ({ ...prev, [tag]: (prev[tag] || 0) + 1 }));

    // Debounce the DB write
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 2000);
  }, [flush]);

  // Sort tags by usage (highest first), with alphabetical tiebreaker
  const sortByUsage = useCallback(
    <T extends [string, ...unknown[]]>(tags: T[]): T[] => {
      return [...tags].sort((a, b) => {
        const aCount = counts[a[0]] || 0;
        const bCount = counts[b[0]] || 0;
        if (bCount !== aCount) return bCount - aCount;
        return a[0].localeCompare(b[0]);
      });
    },
    [counts],
  );

  return { counts, recordTagClick, sortByUsage };
}
