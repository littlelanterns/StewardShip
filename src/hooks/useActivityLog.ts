import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { ActivityLogEvent, ActivityLogEventType } from '../lib/types';

const PAGE_SIZE = 30;

export interface ActivityLogFilters {
  eventType: ActivityLogEventType | null;
  dateRange: 'today' | 'this_week' | 'this_month' | 'all';
  showHidden: boolean;
}

function getDateRangeBounds(range: ActivityLogFilters['dateRange']) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }
    case 'this_week': {
      const day = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      return start.toISOString();
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    default:
      return null;
  }
}

export function useActivityLog() {
  const { user } = useAuthContext();
  const [events, setEvents] = useState<ActivityLogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (filters: ActivityLogFilters, offset = 0) => {
    if (!user) return;
    if (offset === 0) setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (!filters.showHidden) {
        query = query.eq('hidden', false);
      }

      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      const fromDate = getDateRangeBounds(filters.dateRange);
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const results = (data as ActivityLogEvent[]) || [];
      if (offset === 0) {
        setEvents(results);
      } else {
        setEvents((prev) => [...prev, ...results]);
      }
      setHasMore(results.length === PAGE_SIZE);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load activity log';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const hideEvent = useCallback(async (eventId: string) => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('activity_log')
        .update({ hidden: true })
        .eq('id', eventId)
        .eq('user_id', user.id);

      if (err) throw err;
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to hide event';
      setError(msg);
    }
  }, [user]);

  const unhideEvent = useCallback(async (eventId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('activity_log')
        .update({ hidden: false })
        .eq('id', eventId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? (data as ActivityLogEvent) : e)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to unhide event';
      setError(msg);
    }
  }, [user]);

  return {
    events,
    loading,
    hasMore,
    error,
    fetchEvents,
    hideEvent,
    unhideEvent,
  };
}
