import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { KeelEntry, KeelCategory } from '../lib/types';
import { KEEL_CATEGORY_ORDER } from '../lib/types';

export function useKeel() {
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<KeelEntry[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<KeelEntry[]>([]);
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
        .from('keel_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('category')
        .order('sort_order');

      if (err) throw err;
      setEntries((data as KeelEntry[]) || []);
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
        .from('keel_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (err) throw err;
      setArchivedEntries((data as KeelEntry[]) || []);
    } catch {
      // Silently fail for archived
    }
  }, [user]);

  const createEntry = useCallback(async (data: {
    category: KeelCategory;
    text: string;
    source?: string;
    source_type?: KeelEntry['source_type'];
  }): Promise<KeelEntry | null> => {
    if (!user) return null;

    const sameCat = entries.filter((e) => e.category === data.category);
    const maxSort = sameCat.reduce((max, e) => Math.max(max, e.sort_order), -1);

    const row = {
      user_id: user.id,
      category: data.category,
      text: data.text,
      source: data.source || 'self-observed',
      source_type: data.source_type || 'manual',
      sort_order: maxSort + 1,
    };

    const { data: created, error: err } = await supabase
      .from('keel_entries')
      .insert(row)
      .select()
      .single();

    if (err) throw err;
    const entry = created as KeelEntry;
    setEntries((prev) => [...prev, entry]);
    return entry;
  }, [user, entries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<KeelEntry>) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('keel_entries')
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
      .from('keel_entries')
      .update({ archived_at: now })
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, [user]);

  const permanentlyDelete = useCallback(async (id: string) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('keel_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setArchivedEntries((prev) => prev.filter((e) => e.id !== id));
  }, [user]);

  const restoreEntry = useCallback(async (id: string) => {
    if (!user) return;
    const { error: err } = await supabase
      .from('keel_entries')
      .update({ archived_at: null })
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) throw err;
    setArchivedEntries((prev) => prev.filter((e) => e.id !== id));
    fetchEntries();
  }, [user, fetchEntries]);

  const reorderEntries = useCallback(async (category: KeelCategory, orderedIds: string[]) => {
    // Optimistic update
    setEntries((prev) => {
      const others = prev.filter((e) => e.category !== category);
      const reordered = orderedIds
        .map((id, index) => {
          const entry = prev.find((e) => e.id === id);
          return entry ? { ...entry, sort_order: index } : null;
        })
        .filter((e): e is KeelEntry => e !== null);
      return [...others, ...reordered];
    });

    const updates = orderedIds.map((id, index) =>
      supabase.from('keel_entries').update({ sort_order: index }).eq('id', id).eq('user_id', user!.id)
    );

    try {
      await Promise.all(updates);
    } catch {
      fetchEntries();
    }
  }, [user, fetchEntries]);

  const entriesByCategory = useMemo(() => {
    const grouped: Record<KeelCategory, KeelEntry[]> = {
      personality_assessment: [],
      trait_tendency: [],
      strength: [],
      growth_area: [],
      you_inc: [],
      general: [],
    };
    for (const entry of entries) {
      grouped[entry.category]?.push(entry);
    }
    for (const cat of KEEL_CATEGORY_ORDER) {
      grouped[cat].sort((a, b) => a.sort_order - b.sort_order);
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
    entriesByCategory,
  };
}
