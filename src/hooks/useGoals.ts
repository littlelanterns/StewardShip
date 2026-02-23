import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { Goal, GoalStatus, GoalProgressType } from '../lib/types';

export function useGoals() {
  const { user } = useAuthContext();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async (status?: GoalStatus) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setGoals((data as Goal[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createGoal = useCallback(async (data: {
    title: string;
    description?: string | null;
    life_area_tag?: string | null;
    target_date?: string | null;
    progress_type?: GoalProgressType;
    progress_target?: number | null;
    related_mast_entry_id?: string | null;
  }): Promise<Goal | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: created, error: err } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          title: data.title,
          description: data.description || null,
          life_area_tag: data.life_area_tag || null,
          target_date: data.target_date || null,
          progress_type: data.progress_type || 'percentage',
          progress_current: 0,
          progress_target: data.progress_target ?? 100,
          related_mast_entry_id: data.related_mast_entry_id || null,
          status: 'active',
        })
        .select()
        .single();

      if (err) throw err;
      const goal = created as Goal;
      setGoals((prev) => [goal, ...prev]);
      return goal;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create goal');
      return null;
    }
  }, [user]);

  const updateGoal = useCallback(async (
    id: string,
    updates: Partial<Pick<Goal, 'title' | 'description' | 'life_area_tag' | 'target_date' | 'status' | 'progress_current' | 'progress_target' | 'related_mast_entry_id'>>,
  ): Promise<Goal | null> => {
    if (!user) return null;
    setError(null);

    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));

    try {
      const { data, error: err } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as Goal;
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update goal');
      fetchGoals();
      return null;
    }
  }, [user, fetchGoals]);

  const updateProgress = useCallback(async (id: string, value: number) => {
    return updateGoal(id, { progress_current: value });
  }, [updateGoal]);

  const archiveGoal = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('goals')
        .update({ archived_at: new Date().toISOString(), status: 'archived' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to archive goal');
    }
  }, [user]);

  return {
    goals,
    loading,
    error,
    fetchGoals,
    createGoal,
    updateGoal,
    updateProgress,
    archiveGoal,
  };
}
