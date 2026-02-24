import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  RiggingPlan,
  RiggingPlanStatus,
  RiggingMilestone,
  RiggingObstacle,
  LogEntry,
  HelmConversation,
  CompassTask,
} from '../lib/types';

export function useRigging() {
  const { user } = useAuthContext();
  const [plans, setPlans] = useState<RiggingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<RiggingPlan | null>(null);
  const [milestones, setMilestones] = useState<RiggingMilestone[]>([]);
  const [obstacles, setObstacles] = useState<RiggingObstacle[]>([]);
  const [linkedLogEntries, setLinkedLogEntries] = useState<LogEntry[]>([]);
  const [linkedConversations, setLinkedConversations] = useState<HelmConversation[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<CompassTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async (status?: RiggingPlanStatus) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('rigging_plans')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setPlans((data as RiggingPlan[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPlan = useCallback(async (id: string) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('rigging_plans')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (err) throw err;
      const plan = data as RiggingPlan;
      setSelectedPlan(plan);
      return plan;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPlan = useCallback(async (data: Partial<RiggingPlan>): Promise<RiggingPlan | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('rigging_plans')
        .insert({
          user_id: user.id,
          title: data.title || 'Untitled Plan',
          description: data.description || null,
          status: 'active',
          planning_framework: data.planning_framework || 'milestone',
          frameworks_used: data.frameworks_used || [data.planning_framework || 'milestone'],
          moscow_must_have: data.moscow_must_have || [],
          moscow_should_have: data.moscow_should_have || [],
          moscow_could_have: data.moscow_could_have || [],
          moscow_wont_have: data.moscow_wont_have || [],
          ten_ten_ten_decision: data.ten_ten_ten_decision || null,
          ten_ten_ten_10_days: data.ten_ten_ten_10_days || null,
          ten_ten_ten_10_months: data.ten_ten_ten_10_months || null,
          ten_ten_ten_10_years: data.ten_ten_ten_10_years || null,
          ten_ten_ten_conclusion: data.ten_ten_ten_conclusion || null,
          related_mast_entry_ids: data.related_mast_entry_ids || [],
          related_goal_ids: data.related_goal_ids || [],
          nudge_approaching_milestones: data.nudge_approaching_milestones ?? true,
          nudge_related_conversations: data.nudge_related_conversations ?? false,
          nudge_overdue_milestones: data.nudge_overdue_milestones ?? false,
        })
        .select()
        .single();

      if (err) throw err;
      const plan = result as RiggingPlan;
      setPlans((prev) => [plan, ...prev]);
      return plan;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updatePlan = useCallback(async (id: string, updates: Partial<RiggingPlan>) => {
    if (!user) return;
    setError(null);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    if (selectedPlan?.id === id) {
      setSelectedPlan((prev) => prev ? { ...prev, ...updates } : prev);
    }
    try {
      const { error: err } = await supabase
        .from('rigging_plans')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchPlans();
    }
  }, [user, selectedPlan, fetchPlans]);

  const archivePlan = useCallback(async (id: string) => {
    await updatePlan(id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    });
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, [updatePlan]);

  const completePlan = useCallback(async (id: string) => {
    await updatePlan(id, { status: 'completed' });
  }, [updatePlan]);

  const pausePlan = useCallback(async (id: string) => {
    await updatePlan(id, { status: 'paused' });
  }, [updatePlan]);

  // Milestones
  const fetchMilestones = useCallback(async (planId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('rigging_milestones')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setMilestones((data as RiggingMilestone[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const createMilestone = useCallback(async (
    planId: string,
    data: Partial<RiggingMilestone>,
  ): Promise<RiggingMilestone | null> => {
    if (!user) return null;
    setError(null);
    try {
      const nextOrder = milestones.length > 0
        ? Math.max(...milestones.map((m) => m.sort_order)) + 1
        : 0;

      const { data: result, error: err } = await supabase
        .from('rigging_milestones')
        .insert({
          plan_id: planId,
          user_id: user.id,
          title: data.title || 'Untitled Milestone',
          description: data.description || null,
          status: 'not_started',
          target_date: data.target_date || null,
          sort_order: nextOrder,
          task_breaker_level: data.task_breaker_level || null,
        })
        .select()
        .single();

      if (err) throw err;
      const milestone = result as RiggingMilestone;
      setMilestones((prev) => [...prev, milestone]);
      return milestone;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, milestones]);

  const updateMilestone = useCallback(async (id: string, updates: Partial<RiggingMilestone>) => {
    if (!user) return;
    setError(null);
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    try {
      const { error: err } = await supabase
        .from('rigging_milestones')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const deleteMilestone = useCallback(async (id: string) => {
    if (!user) return;
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    try {
      const { error: err } = await supabase
        .from('rigging_milestones')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const reorderMilestones = useCallback(async (orderedIds: string[]) => {
    if (!user) return;
    const reordered = orderedIds
      .map((id, idx) => {
        const m = milestones.find((ms) => ms.id === id);
        return m ? { ...m, sort_order: idx } : null;
      })
      .filter(Boolean) as RiggingMilestone[];
    setMilestones(reordered);

    try {
      const updates = orderedIds.map((id, idx) =>
        supabase
          .from('rigging_milestones')
          .update({ sort_order: idx })
          .eq('id', id)
          .eq('user_id', user.id),
      );
      await Promise.all(updates);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, milestones]);

  // Obstacles
  const fetchObstacles = useCallback(async (planId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('rigging_obstacles')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (err) throw err;
      setObstacles((data as RiggingObstacle[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const createObstacle = useCallback(async (
    planId: string,
    data: { risk: string; mitigation: string },
  ): Promise<RiggingObstacle | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('rigging_obstacles')
        .insert({
          plan_id: planId,
          user_id: user.id,
          risk: data.risk,
          mitigation: data.mitigation,
          status: 'watching',
        })
        .select()
        .single();

      if (err) throw err;
      const obstacle = result as RiggingObstacle;
      setObstacles((prev) => [...prev, obstacle]);
      return obstacle;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updateObstacle = useCallback(async (id: string, updates: Partial<RiggingObstacle>) => {
    if (!user) return;
    setObstacles((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    try {
      const { error: err } = await supabase
        .from('rigging_obstacles')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const deleteObstacle = useCallback(async (id: string) => {
    if (!user) return;
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    try {
      const { error: err } = await supabase
        .from('rigging_obstacles')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  // Linked data
  const getLinkedLogEntries = useCallback(async (planId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('related_rigging_plan_id', planId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setLinkedLogEntries((data as LogEntry[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const getLinkedConversations = useCallback(async (planId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('helm_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('guided_mode_reference_id', planId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setLinkedConversations((data as HelmConversation[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const getLinkedTasks = useCallback(async (planId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('related_rigging_plan_id', planId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setLinkedTasks((data as CompassTask[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  return {
    plans,
    selectedPlan,
    milestones,
    obstacles,
    linkedLogEntries,
    linkedConversations,
    linkedTasks,
    loading,
    error,
    fetchPlans,
    fetchPlan,
    createPlan,
    updatePlan,
    archivePlan,
    completePlan,
    pausePlan,
    fetchMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones,
    fetchObstacles,
    createObstacle,
    updateObstacle,
    deleteObstacle,
    getLinkedLogEntries,
    getLinkedConversations,
    getLinkedTasks,
    setSelectedPlan,
  };
}
