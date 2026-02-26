import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { MastEntry, MastEntryType } from '../lib/types';
import { MAST_TYPE_ORDER } from '../lib/types';

export function useMast() {
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<MastEntry[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<MastEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('mast_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('type')
        .order('sort_order');

      if (err) throw err;
      setEntries((data as MastEntry[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load entries';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchArchivedEntries = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('mast_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (err) throw err;
      setArchivedEntries((data as MastEntry[]) || []);
    } catch {
      // Silently fail for archived — not critical
    }
  }, [user]);

  const createEntry = useCallback(async (data: {
    type: MastEntryType;
    text: string;
    category?: string;
    source?: MastEntry['source'];
  }): Promise<MastEntry | null> => {
    if (!user) return null;

    // Determine sort_order: max within this type group + 1
    const sameType = entries.filter((e) => e.type === data.type);
    const maxSort = sameType.reduce((max, e) => Math.max(max, e.sort_order), -1);

    const row = {
      user_id: user.id,
      type: data.type,
      text: data.text,
      category: data.category || null,
      source: data.source || 'manual',
      sort_order: maxSort + 1,
    };

    const { data: created, error: err } = await supabase
      .from('mast_entries')
      .insert(row)
      .select()
      .single();

    if (err) throw err;
    const entry = created as MastEntry;
    setEntries((prev) => [...prev, entry]);
    return entry;
  }, [user, entries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<MastEntry>) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('mast_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }, [user]);

  const archiveEntry = useCallback(async (id: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from('mast_entries')
      .update({ archived_at: now })
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, [user]);

  const permanentlyDelete = useCallback(async (id: string) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('mast_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setArchivedEntries((prev) => prev.filter((e) => e.id !== id));
  }, [user]);

  const restoreEntry = useCallback(async (id: string) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('mast_entries')
      .update({ archived_at: null })
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setArchivedEntries((prev) => prev.filter((e) => e.id !== id));
    fetchEntries();
  }, [user, fetchEntries]);

  const reorderEntries = useCallback(async (type: MastEntryType, orderedIds: string[]) => {
    // Optimistic update
    setEntries((prev) => {
      const others = prev.filter((e) => e.type !== type);
      const reordered = orderedIds
        .map((id, index) => {
          const entry = prev.find((e) => e.id === id);
          return entry ? { ...entry, sort_order: index } : null;
        })
        .filter((e): e is MastEntry => e !== null);
      return [...others, ...reordered];
    });

    // Batch update to DB
    const updates = orderedIds.map((id, index) =>
      supabase.from('mast_entries').update({ sort_order: index }).eq('id', id).eq('user_id', user!.id)
    );

    try {
      await Promise.all(updates);
    } catch {
      // Revert on error
      fetchEntries();
    }
  }, [fetchEntries]);

  const entriesByType = useMemo(() => {
    const grouped: Record<MastEntryType, MastEntry[]> = {
      value: [],
      declaration: [],
      faith_foundation: [],
      scripture_quote: [],
      vision: [],
    };
    for (const entry of entries) {
      grouped[entry.type]?.push(entry);
    }
    // Sort each group by sort_order
    for (const type of MAST_TYPE_ORDER) {
      grouped[type].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [entries]);

  return {
    entries,
    archivedEntries,
    loading,
    error,
    fetchEntries,
    fetchArchivedEntries,
    createEntry,
    updateEntry,
    archiveEntry,
    restoreEntry,
    permanentlyDelete,
    reorderEntries,
    entriesByType,
  };
}
