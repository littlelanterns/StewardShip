import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { CompassTask, CompassLifeArea, TaskStatus, TaskSource, RecurrenceRule } from '../lib/types';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getNextDate(date: string, rule: RecurrenceRule): string {
  const d = new Date(date + 'T00:00:00');
  switch (rule) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    case 'weekdays': {
      d.setDate(d.getDate() + 1);
      // Skip Saturday (6) and Sunday (0)
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
      return d.toISOString().split('T')[0];
    }
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    default:
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
  }
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function useCompass() {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<CompassTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (date?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const targetDate = date || getTodayDate();

      // Fetch tasks for the date OR tasks with no due date
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .or(`due_date.eq.${targetDate},due_date.is.null`)
        .neq('status', 'cancelled')
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setTasks((data as CompassTask[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tasks';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTasksByCategory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .in('status', ['pending', 'completed'])
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setTasks((data as CompassTask[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tasks';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTask = useCallback(async (data: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    recurrence_rule?: RecurrenceRule;
    life_area_tag?: CompassLifeArea | null;
    source?: TaskSource;
    source_reference_id?: string | null;
    related_goal_id?: string | null;
  }): Promise<CompassTask | null> => {
    if (!user) return null;
    setError(null);
    try {
      // Determine sort_order: max + 1
      const maxSort = tasks.reduce((max, t) => Math.max(max, t.sort_order), -1);

      const row = {
        user_id: user.id,
        title: data.title,
        description: data.description || null,
        due_date: data.due_date !== undefined ? data.due_date : getTodayDate(),
        recurrence_rule: data.recurrence_rule || null,
        life_area_tag: data.life_area_tag || null,
        source: data.source || 'manual',
        source_reference_id: data.source_reference_id || null,
        related_goal_id: data.related_goal_id || null,
        sort_order: maxSort + 1,
        status: 'pending',
      };

      const { data: created, error: err } = await supabase
        .from('compass_tasks')
        .insert(row)
        .select()
        .single();

      if (err) throw err;
      const task = created as CompassTask;
      setTasks((prev) => [...prev, task]);
      return task;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      setError(msg);
      return null;
    }
  }, [user, tasks]);

  const updateTask = useCallback(async (
    id: string,
    updates: Partial<CompassTask>,
  ): Promise<CompassTask | null> => {
    if (!user) return null;
    setError(null);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    try {
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as CompassTask;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      setError(msg);
      // Revert optimistic update
      fetchTasks();
      return null;
    }
  }, [user, fetchTasks]);

  const generateNextRecurrence = useCallback(async (task: CompassTask) => {
    if (!user || !task.recurrence_rule || !task.due_date) return;

    // Check for existing pending task with same title and recurrence (no duplicates)
    const { data: existing } = await supabase
      .from('compass_tasks')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', task.title)
      .eq('recurrence_rule', task.recurrence_rule)
      .eq('status', 'pending')
      .is('archived_at', null)
      .limit(1);

    if (existing && existing.length > 0) return;

    const nextDate = getNextDate(task.due_date, task.recurrence_rule);
    const maxSort = tasks.reduce((max, t) => Math.max(max, t.sort_order), -1);

    const { data: created, error: err } = await supabase
      .from('compass_tasks')
      .insert({
        user_id: user.id,
        title: task.title,
        description: task.description,
        life_area_tag: task.life_area_tag,
        recurrence_rule: task.recurrence_rule,
        due_date: nextDate,
        source: 'recurring_generated',
        source_reference_id: task.id,
        sort_order: maxSort + 1,
        status: 'pending',
      })
      .select()
      .single();

    if (!err && created) {
      setTasks((prev) => [...prev, created as CompassTask]);
    }
  }, [user, tasks]);

  const completeTask = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);

    const task = tasks.find((t) => t.id === id);
    const now = new Date().toISOString();

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'completed' as TaskStatus, completed_at: now } : t))
    );

    try {
      const { error: err } = await supabase
        .from('compass_tasks')
        .update({ status: 'completed', completed_at: now })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;

      // Generate next recurrence if applicable
      if (task?.recurrence_rule) {
        await generateNextRecurrence(task);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to complete task';
      setError(msg);
      fetchTasks();
    }
  }, [user, tasks, generateNextRecurrence, fetchTasks]);

  const archiveTask = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('compass_tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to archive task';
      setError(msg);
    }
  }, [user]);

  const carryForwardTask = useCallback(async (
    id: string,
    option: 'tomorrow' | 'reschedule' | 'cancel' | 'keep',
    rescheduleDate?: string,
  ) => {
    if (!user) return;
    setError(null);
    try {
      switch (option) {
        case 'tomorrow': {
          await supabase
            .from('compass_tasks')
            .update({ due_date: getTomorrowDate() })
            .eq('id', id)
            .eq('user_id', user.id);
          setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, due_date: getTomorrowDate() } : t))
          );
          break;
        }
        case 'reschedule': {
          if (!rescheduleDate) return;
          await supabase
            .from('compass_tasks')
            .update({ due_date: rescheduleDate })
            .eq('id', id)
            .eq('user_id', user.id);
          setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, due_date: rescheduleDate } : t))
          );
          break;
        }
        case 'cancel': {
          await supabase
            .from('compass_tasks')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('user_id', user.id);
          setTasks((prev) => prev.filter((t) => t.id !== id));
          break;
        }
        case 'keep':
          // Just dismiss — no changes
          break;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to carry forward task';
      setError(msg);
    }
  }, [user]);

  const reorderTasks = useCallback(async (orderedIds: string[]) => {
    if (!user) return;

    // Optimistic update
    setTasks((prev) => {
      const taskMap = new Map(prev.map((t) => [t.id, t]));
      const reordered: CompassTask[] = [];
      const others: CompassTask[] = [];

      for (const t of prev) {
        if (!orderedIds.includes(t.id)) {
          others.push(t);
        }
      }

      for (let i = 0; i < orderedIds.length; i++) {
        const task = taskMap.get(orderedIds[i]);
        if (task) {
          reordered.push({ ...task, sort_order: i });
        }
      }

      return [...reordered, ...others];
    });

    // Batch update to DB
    const updates = orderedIds.map((id, index) =>
      supabase.from('compass_tasks').update({ sort_order: index }).eq('id', id).eq('user_id', user.id)
    );

    try {
      await Promise.all(updates);
    } catch {
      fetchTasks();
    }
  }, [user, fetchTasks]);

  const getOverdueTasks = useCallback(async (): Promise<CompassTask[]> => {
    if (!user) return [];
    try {
      const today = getTodayDate();
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .is('archived_at', null)
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (err) throw err;
      return (data as CompassTask[]) || [];
    } catch {
      return [];
    }
  }, [user]);

  const taskCount = useMemo(() => {
    const today = getTodayDate();
    const todayTasks = tasks.filter((t) => t.due_date === today || t.due_date === null);
    return {
      completed: todayTasks.filter((t) => t.status === 'completed').length,
      total: todayTasks.length,
    };
  }, [tasks]);

  const tasksByCategory = useMemo(() => {
    const grouped: Record<string, CompassTask[]> = {};
    for (const task of tasks) {
      const key = task.life_area_tag || 'uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    }
    // Sort each group by sort_order
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [tasks]);

  const createSubtasks = useCallback(async (
    parentId: string,
    subtasks: Array<{ title: string; description?: string; sort_order: number }>,
  ): Promise<void> => {
    if (!user) return;
    setError(null);

    const parent = tasks.find((t) => t.id === parentId);

    try {
      const rows = subtasks.map((st) => ({
        user_id: user.id,
        title: st.title,
        description: st.description || null,
        parent_task_id: parentId,
        task_breaker_level: null, // Set by caller if needed
        due_date: parent?.due_date || null,
        life_area_tag: parent?.life_area_tag || null,
        related_goal_id: parent?.related_goal_id || null,
        related_wheel_id: parent?.related_wheel_id || null,
        related_meeting_id: parent?.related_meeting_id || null,
        related_rigging_plan_id: parent?.related_rigging_plan_id || null,
        source: 'manual',
        sort_order: st.sort_order,
        status: 'pending',
      }));

      const { error: err } = await supabase
        .from('compass_tasks')
        .insert(rows);

      if (err) throw err;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create subtasks';
      setError(msg);
    }
  }, [user, tasks]);

  const fetchSubtasks = useCallback(async (parentId: string): Promise<CompassTask[]> => {
    if (!user) return [];
    try {
      const { data, error: err } = await supabase
        .from('compass_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('parent_task_id', parentId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      return (data as CompassTask[]) || [];
    } catch {
      return [];
    }
  }, [user]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    fetchTasksByCategory,
    createTask,
    updateTask,
    completeTask,
    archiveTask,
    carryForwardTask,
    reorderTasks,
    getOverdueTasks,
    taskCount,
    tasksByCategory,
    createSubtasks,
    fetchSubtasks,
  };
}
