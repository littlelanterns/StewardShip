import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { Victory, VictorySource } from '../lib/types';

export type VictoryTimePeriod = 'today' | 'this_week' | 'this_month' | 'all';

function getDateRange(period: VictoryTimePeriod): { from: string | null; to: string | null } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { from: monday.toISOString().split('T')[0], to: today };
    }
    case 'this_month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: firstOfMonth.toISOString().split('T')[0], to: today };
    }
    case 'all':
      return { from: null, to: null };
  }
}

export function useVictories() {
  const { user } = useAuthContext();
  const [victories, setVictories] = useState<Victory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVictories = useCallback(async (
    period: VictoryTimePeriod = 'all',
    lifeAreaFilter?: string | null,
  ) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('victories')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      const range = getDateRange(period);
      if (range.from) {
        query = query.gte('created_at', `${range.from}T00:00:00`);
      }
      if (range.to) {
        query = query.lte('created_at', `${range.to}T23:59:59`);
      }
      if (lifeAreaFilter) {
        query = query.eq('life_area_tag', lifeAreaFilter);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setVictories((data as Victory[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load victories');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createVictory = useCallback(async (data: {
    description: string;
    celebration_text?: string | null;
    life_area_tag?: string | null;
    source?: VictorySource;
    source_reference_id?: string | null;
    related_mast_entry_id?: string | null;
    related_wheel_id?: string | null;
  }): Promise<Victory | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: created, error: err } = await supabase
        .from('victories')
        .insert({
          user_id: user.id,
          description: data.description,
          celebration_text: data.celebration_text || null,
          life_area_tag: data.life_area_tag || null,
          source: data.source || 'manual',
          source_reference_id: data.source_reference_id || null,
          related_mast_entry_id: data.related_mast_entry_id || null,
          related_wheel_id: data.related_wheel_id || null,
        })
        .select()
        .single();

      if (err) throw err;
      const victory = created as Victory;
      setVictories((prev) => [victory, ...prev]);
      return victory;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create victory');
      return null;
    }
  }, [user]);

  const updateVictory = useCallback(async (
    id: string,
    updates: Partial<Pick<Victory, 'celebration_text' | 'life_area_tag' | 'related_mast_entry_id' | 'related_wheel_id'>>,
  ): Promise<Victory | null> => {
    if (!user) return null;
    setError(null);

    // Optimistic update
    setVictories((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));

    try {
      const { data, error: err } = await supabase
        .from('victories')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as Victory;
      setVictories((prev) => prev.map((v) => (v.id === id ? updated : v)));
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update victory');
      fetchVictories();
      return null;
    }
  }, [user, fetchVictories]);

  const archiveVictory = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('victories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setVictories((prev) => prev.filter((v) => v.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to archive victory');
    }
  }, [user]);

  const getVictoryCount = useCallback(async (period: VictoryTimePeriod): Promise<number> => {
    if (!user) return 0;
    try {
      let query = supabase
        .from('victories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null);

      const range = getDateRange(period);
      if (range.from) query = query.gte('created_at', `${range.from}T00:00:00`);
      if (range.to) query = query.lte('created_at', `${range.to}T23:59:59`);

      const { count } = await query;
      return count || 0;
    } catch {
      return 0;
    }
  }, [user]);

  const getVictoriesByArea = useCallback(async (): Promise<Record<string, number>> => {
    if (!user) return {};
    try {
      const { data, error: err } = await supabase
        .from('victories')
        .select('life_area_tag')
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (err) throw err;
      const breakdown: Record<string, number> = {};
      for (const v of (data || [])) {
        const tag = v.life_area_tag || 'uncategorized';
        breakdown[tag] = (breakdown[tag] || 0) + 1;
      }
      return breakdown;
    } catch {
      return {};
    }
  }, [user]);

  const getRecentVictories = useCallback(async (limit: number = 3): Promise<Victory[]> => {
    if (!user) return [];
    try {
      const { data, error: err } = await supabase
        .from('victories')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (err) throw err;
      return (data as Victory[]) || [];
    } catch {
      return [];
    }
  }, [user]);

  return {
    victories,
    loading,
    error,
    fetchVictories,
    createVictory,
    updateVictory,
    archiveVictory,
    getVictoryCount,
    getVictoriesByArea,
    getRecentVictories,
  };
}
