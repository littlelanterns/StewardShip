import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { CompassTask, Victory } from '../lib/types';

export type AccomplishmentPeriod = 'today' | 'this_week' | 'this_month' | 'all';

export interface Accomplishment {
  id: string;
  title: string;
  note: string | null;
  life_area: string | null;
  source: 'task' | 'victory';
  source_id: string;
  completed_at: string;
  has_celebration: boolean;
  celebration_text: string | null;
}

function getDateRange(period: AccomplishmentPeriod): { from: string | null; to: string | null } {
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

function taskToAccomplishment(task: CompassTask): Accomplishment {
  return {
    id: `task-${task.id}`,
    title: task.title,
    note: task.completion_note,
    life_area: task.life_area_tag,
    source: 'task',
    source_id: task.id,
    completed_at: task.completed_at || task.updated_at,
    has_celebration: false,
    celebration_text: null,
  };
}

function victoryToAccomplishment(v: Victory): Accomplishment {
  return {
    id: `victory-${v.id}`,
    title: v.description,
    note: v.celebration_text,
    life_area: v.life_area_tag,
    source: 'victory',
    source_id: v.id,
    completed_at: v.created_at,
    has_celebration: !!v.celebration_text,
    celebration_text: v.celebration_text,
  };
}

export function useAccomplishments() {
  const { user } = useAuthContext();
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccomplishments = useCallback(async (period: AccomplishmentPeriod = 'all') => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const range = getDateRange(period);

      // Query completed top-level tasks
      let taskQuery = supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('parent_task_id', null)
        .is('archived_at', null)
        .order('completed_at', { ascending: false });

      if (range.from) taskQuery = taskQuery.gte('completed_at', `${range.from}T00:00:00`);
      if (range.to) taskQuery = taskQuery.lte('completed_at', `${range.to}T23:59:59`);

      // Query manual victories
      let victoryQuery = supabase
        .from('victories')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (range.from) victoryQuery = victoryQuery.gte('created_at', `${range.from}T00:00:00`);
      if (range.to) victoryQuery = victoryQuery.lte('created_at', `${range.to}T23:59:59`);

      const [taskResult, victoryResult] = await Promise.all([taskQuery, victoryQuery]);

      if (taskResult.error) throw taskResult.error;
      if (victoryResult.error) throw victoryResult.error;

      const tasks = (taskResult.data || []) as CompassTask[];
      const victories = (victoryResult.data || []) as Victory[];

      // Build a set of task IDs that already have compass_task victories (to avoid duplicates)
      const victoryTaskIds = new Set(
        victories
          .filter((v) => v.source === 'compass_task' && v.source_reference_id)
          .map((v) => v.source_reference_id!)
      );

      // Convert tasks to accomplishments, skipping ones that have a victory record
      const taskAccomplishments = tasks
        .filter((t) => !victoryTaskIds.has(t.id))
        .map(taskToAccomplishment);

      // Convert all victories to accomplishments
      const victoryAccomplishments = victories.map(victoryToAccomplishment);

      // Merge and sort by date descending
      const merged = [...taskAccomplishments, ...victoryAccomplishments]
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

      setAccomplishments(merged);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load accomplishments');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getAccomplishmentCount = useCallback(async (period: AccomplishmentPeriod): Promise<number> => {
    if (!user) return 0;
    try {
      const range = getDateRange(period);

      let taskQuery = supabase
        .from('compass_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('parent_task_id', null)
        .is('archived_at', null);

      if (range.from) taskQuery = taskQuery.gte('completed_at', `${range.from}T00:00:00`);
      if (range.to) taskQuery = taskQuery.lte('completed_at', `${range.to}T23:59:59`);

      let victoryQuery = supabase
        .from('victories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (range.from) victoryQuery = victoryQuery.gte('created_at', `${range.from}T00:00:00`);
      if (range.to) victoryQuery = victoryQuery.lte('created_at', `${range.to}T23:59:59`);

      const [taskResult, victoryResult] = await Promise.all([taskQuery, victoryQuery]);
      return (taskResult.count || 0) + (victoryResult.count || 0);
    } catch {
      return 0;
    }
  }, [user]);

  const getAccomplishmentsByArea = useCallback(async (period: AccomplishmentPeriod = 'all'): Promise<Record<string, number>> => {
    if (!user) return {};
    try {
      const range = getDateRange(period);

      let taskQuery = supabase
        .from('compass_tasks')
        .select('life_area_tag')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('parent_task_id', null)
        .is('archived_at', null);

      if (range.from) taskQuery = taskQuery.gte('completed_at', `${range.from}T00:00:00`);
      if (range.to) taskQuery = taskQuery.lte('completed_at', `${range.to}T23:59:59`);

      let victoryQuery = supabase
        .from('victories')
        .select('life_area_tag')
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (range.from) victoryQuery = victoryQuery.gte('created_at', `${range.from}T00:00:00`);
      if (range.to) victoryQuery = victoryQuery.lte('created_at', `${range.to}T23:59:59`);

      const [taskResult, victoryResult] = await Promise.all([taskQuery, victoryQuery]);

      const breakdown: Record<string, number> = {};
      for (const row of [...(taskResult.data || []), ...(victoryResult.data || [])]) {
        const tag = row.life_area_tag || 'uncategorized';
        breakdown[tag] = (breakdown[tag] || 0) + 1;
      }
      return breakdown;
    } catch {
      return {};
    }
  }, [user]);

  const getRecentAccomplishments = useCallback(async (limit: number = 3): Promise<Accomplishment[]> => {
    if (!user) return [];
    try {
      const [taskResult, victoryResult] = await Promise.all([
        supabase
          .from('compass_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('parent_task_id', null)
          .is('archived_at', null)
          .order('completed_at', { ascending: false })
          .limit(limit),
        supabase
          .from('victories')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      const tasks = (taskResult.data || []) as CompassTask[];
      const victories = (victoryResult.data || []) as Victory[];

      const victoryTaskIds = new Set(
        victories
          .filter((v) => v.source === 'compass_task' && v.source_reference_id)
          .map((v) => v.source_reference_id!)
      );

      const merged = [
        ...tasks.filter((t) => !victoryTaskIds.has(t.id)).map(taskToAccomplishment),
        ...victories.map(victoryToAccomplishment),
      ]
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        .slice(0, limit);

      return merged;
    } catch {
      return [];
    }
  }, [user]);

  return {
    accomplishments,
    loading,
    error,
    fetchAccomplishments,
    getAccomplishmentCount,
    getAccomplishmentsByArea,
    getRecentAccomplishments,
  };
}
