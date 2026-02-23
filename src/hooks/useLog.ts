import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { LogEntry, LogEntryType, LogSource, LogFilters } from '../lib/types';

const PAGE_SIZE = 20;

function getDateRangeBounds(range: LogFilters['dateRange'], dateFrom: string | null, dateTo: string | null) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to: null };
    }
    case 'this_week': {
      const day = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      return { from: start.toISOString(), to: null };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: null };
    }
    case 'custom':
      return { from: dateFrom, to: dateTo };
    default:
      return { from: null, to: null };
  }
}

export function useLog() {
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<LogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (filters: LogFilters, offset = 0) => {
    if (!user) return;
    if (offset === 0) setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (filters.entryType) {
        query = query.eq('entry_type', filters.entryType);
      }

      if (filters.lifeAreaTag) {
        query = query.contains('life_area_tags', [filters.lifeAreaTag]);
      }

      const { from, to } = getDateRangeBounds(filters.dateRange, filters.dateFrom, filters.dateTo);
      if (from) {
        query = query.gte('created_at', from);
      }
      if (to) {
        query = query.lte('created_at', to);
      }

      if (filters.searchQuery.trim()) {
        query = query.textSearch('text', filters.searchQuery.trim(), { type: 'websearch' });
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const results = (data as LogEntry[]) || [];
      if (offset === 0) {
        setEntries(results);
      } else {
        setEntries((prev) => [...prev, ...results]);
      }
      setHasMore(results.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load entries';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchEntry = useCallback(async (entryId: string) => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .select('*')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .single();

      if (err) throw err;
      const entry = data as LogEntry;
      setSelectedEntry(entry);
      return entry;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load entry';
      setError(msg);
      return null;
    }
  }, [user]);

  const createEntry = useCallback(async (
    text: string,
    entryType: LogEntryType = 'journal',
    lifeAreaTags: string[] = [],
    source: LogSource = 'manual_text',
    sourceReferenceId: string | null = null,
  ): Promise<LogEntry | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .insert({
          user_id: user.id,
          text,
          entry_type: entryType,
          life_area_tags: lifeAreaTags,
          source,
          source_reference_id: sourceReferenceId,
        })
        .select()
        .single();

      if (err) throw err;
      const entry = data as LogEntry;
      setEntries((prev) => [entry, ...prev]);
      return entry;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create entry';
      setError(msg);
      return null;
    }
  }, [user]);

  const updateEntry = useCallback(async (
    entryId: string,
    updates: { text?: string; entry_type?: LogEntryType; life_area_tags?: string[] },
  ): Promise<LogEntry | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .update(updates)
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as LogEntry;
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
      setSelectedEntry((prev) => (prev?.id === entryId ? updated : prev));
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update entry';
      setError(msg);
      return null;
    }
  }, [user]);

  const archiveEntry = useCallback(async (entryId: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('log_entries')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (err) throw err;
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setSelectedEntry((prev) => (prev?.id === entryId ? null : prev));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to archive entry';
      setError(msg);
    }
  }, [user]);

  const restoreEntry = useCallback(async (entryId: string) => {
    if (!user) return;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .update({ archived_at: null })
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const restored = data as LogEntry;
      setArchivedEntries((prev) => prev.filter((e) => e.id !== entryId));
      setEntries((prev) => [restored, ...prev]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to restore entry';
      setError(msg);
    }
  }, [user]);

  const fetchArchivedEntries = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (err) throw err;
      setArchivedEntries((data as LogEntry[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load archived entries';
      setError(msg);
    } finally {
      setArchiveLoading(false);
    }
  }, [user]);

  const updateRouting = useCallback(async (
    entryId: string,
    routeTarget: string,
    referenceId: string,
  ) => {
    if (!user) return;
    setError(null);
    try {
      // Fetch current entry to get existing routing data
      const { data: current, error: fetchErr } = await supabase
        .from('log_entries')
        .select('routed_to, routed_reference_ids')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .single();

      if (fetchErr) throw fetchErr;

      const routedTo = [...(current.routed_to || [])];
      if (!routedTo.includes(routeTarget)) {
        routedTo.push(routeTarget);
      }

      const routedRefIds = { ...(current.routed_reference_ids || {}), [routeTarget]: referenceId };

      const { data, error: err } = await supabase
        .from('log_entries')
        .update({
          routed_to: routedTo,
          routed_reference_ids: routedRefIds,
        })
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as LogEntry;
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
      setSelectedEntry((prev) => (prev?.id === entryId ? updated : prev));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update routing';
      setError(msg);
    }
  }, [user]);

  return {
    entries,
    archivedEntries,
    selectedEntry,
    loading,
    archiveLoading,
    hasMore,
    error,
    fetchEntries,
    fetchEntry,
    createEntry,
    updateEntry,
    archiveEntry,
    restoreEntry,
    fetchArchivedEntries,
    updateRouting,
    setSelectedEntry,
  };
}
