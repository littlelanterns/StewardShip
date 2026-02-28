import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { generateJournalPDF, formatDateRangeFilename } from '../lib/journalExport';
import type { JournalEntry } from '../lib/types';

export interface ExportFilters {
  dateRange: { start: string; end: string } | null;
  entryTypes: string[];
  lifeAreas: string[];
  includeRouting: boolean;
  includeSource: boolean;
}

export function useJournalExport() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countMatchingEntries = useCallback(async (filters: ExportFilters): Promise<number> => {
    if (!user) return 0;
    setCounting(true);
    setError(null);

    try {
      const { count, error: err } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null)
        .gte('created_at', filters.dateRange?.start || '1970-01-01')
        .lte('created_at', filters.dateRange?.end || '2099-12-31')
        .in('entry_type', filters.entryTypes.length > 0 ? filters.entryTypes : [
          'journal', 'gratitude', 'reflection', 'quick_note',
          'meeting_notes', 'transcript', 'helm_conversation', 'brain_dump', 'custom',
        ])

      if (err) throw err;
      const result = count ?? 0;
      setMatchCount(result);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to count entries';
      setError(msg);
      setMatchCount(0);
      return 0;
    } finally {
      setCounting(false);
    }
  }, [user]);

  const fetchFilteredEntries = useCallback(async (filters: ExportFilters): Promise<JournalEntry[]> => {
    if (!user) return [];
    setError(null);

    try {
      let query = supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      if (filters.dateRange) {
        query = query.gte('created_at', filters.dateRange.start);
        query = query.lte('created_at', filters.dateRange.end);
      }

      if (filters.entryTypes.length > 0 && filters.entryTypes.length < 9) {
        query = query.in('entry_type', filters.entryTypes);
      }

      if (filters.lifeAreas.length > 0) {
        query = query.overlaps('life_area_tags', filters.lifeAreas);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      return (data as JournalEntry[]) || [];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch entries';
      setError(msg);
      return [];
    }
  }, [user]);

  const generateExport = useCallback(async (
    filters: ExportFilters,
    userName: string,
  ): Promise<void> => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const entries = await fetchFilteredEntries(filters);
      if (entries.length === 0) {
        setError('No entries match your filters');
        return;
      }

      const now = new Date();
      const start = filters.dateRange ? new Date(filters.dateRange.start) : new Date(entries[0].created_at);
      const end = filters.dateRange ? new Date(filters.dateRange.end) : now;

      const blob = generateJournalPDF({
        entries,
        dateRange: { start, end },
        includeRouting: filters.includeRouting,
        includeMood: false,
        includeSource: filters.includeSource,
        userName,
      });

      const dateStr = formatDateRangeFilename(start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StewardShip_Journal_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate PDF';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, fetchFilteredEntries]);

  return {
    loading,
    counting,
    matchCount,
    error,
    countMatchingEntries,
    fetchFilteredEntries,
    generateExport,
  };
}
