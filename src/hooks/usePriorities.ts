import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { Priority, PriorityTier } from '../lib/types';

export function usePriorities() {
  const { user } = useAuthContext();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPriorities = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('priorities')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('tier')
      .order('sort_order');
    if (data) setPriorities(data as Priority[]);
    setLoading(false);
  }, [user]);

  const fetchPriority = useCallback(async (id: string) => {
    if (!user) return null;
    const { data } = await supabase
      .from('priorities')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (data) {
      const p = data as Priority;
      setSelectedPriority(p);
      return p;
    }
    return null;
  }, [user]);

  const createPriority = useCallback(async (input: {
    title: string;
    description?: string | null;
    tier?: PriorityTier;
    linked_plan_id?: string | null;
    linked_goal_id?: string | null;
    linked_wheel_id?: string | null;
    source?: string;
  }) => {
    if (!user) return null;

    // Compute sort_order
    const tierPriorities = priorities.filter((p) => p.tier === (input.tier || 'interested'));
    const maxOrder = tierPriorities.reduce((max, p) => Math.max(max, p.sort_order), -1);

    const { data, error } = await supabase
      .from('priorities')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        tier: input.tier || 'interested',
        sort_order: maxOrder + 1,
        linked_plan_id: input.linked_plan_id || null,
        linked_goal_id: input.linked_goal_id || null,
        linked_wheel_id: input.linked_wheel_id || null,
        source: input.source || 'manual',
      })
      .select()
      .single();

    if (!error && data) {
      const p = data as Priority;
      setPriorities((prev) => [...prev, p]);
      return p;
    }
    return null;
  }, [user, priorities]);

  const updatePriority = useCallback(async (id: string, updates: Partial<Priority>) => {
    if (!user) return;

    // Optimistic update
    setPriorities((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
    if (selectedPriority?.id === id) {
      setSelectedPriority((prev) => prev ? { ...prev, ...updates } : prev);
    }

    const { error } = await supabase
      .from('priorities')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      fetchPriorities();
    }
  }, [user, selectedPriority, fetchPriorities]);

  const moveTier = useCallback(async (id: string, newTier: PriorityTier) => {
    if (!user) return;

    const now = new Date().toISOString();
    const updates: Partial<Priority> = { tier: newTier, sort_order: 0 };

    if (newTier === 'committed_now') {
      updates.promoted_at = now;
    }
    if (newTier === 'achieved') {
      updates.achieved_at = now;
    }

    // Optimistic update
    setPriorities((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));

    const { error } = await supabase
      .from('priorities')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      fetchPriorities();
    }
  }, [user, fetchPriorities]);

  const achievePriority = useCallback(async (id: string) => {
    await moveTier(id, 'achieved');
  }, [moveTier]);

  const archivePriority = useCallback(async (id: string) => {
    if (!user) return;
    const now = new Date().toISOString();

    setPriorities((prev) => prev.filter((p) => p.id !== id));

    await supabase
      .from('priorities')
      .update({ archived_at: now })
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user]);

  const reorderPriorities = useCallback(async (orderedIds: string[]) => {
    if (!user) return;

    // Optimistic reorder
    setPriorities((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      return prev.map((p) => {
        const idx = orderedIds.indexOf(p.id);
        if (idx >= 0) return { ...byId.get(p.id)!, sort_order: idx };
        return p;
      });
    });

    // DB updates
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase
        .from('priorities')
        .update({ sort_order: i })
        .eq('id', orderedIds[i])
        .eq('user_id', user.id);
    }
  }, [user]);

  const getCommittedNowCount = useCallback(() => {
    return priorities.filter((p) => p.tier === 'committed_now' && !p.archived_at).length;
  }, [priorities]);

  const getCommittedLater = useCallback(() => {
    return priorities
      .filter((p) => p.tier === 'committed_later' && !p.archived_at)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [priorities]);

  return {
    priorities,
    selectedPriority,
    loading,
    fetchPriorities,
    fetchPriority,
    createPriority,
    updatePriority,
    moveTier,
    achievePriority,
    archivePriority,
    reorderPriorities,
    setSelectedPriority,
    getCommittedNowCount,
    getCommittedLater,
  };
}
