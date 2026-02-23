import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { StreakInfo, CustomTracker, TrackerEntry } from '../lib/types';

const STREAK_MILESTONES = [7, 30, 90, 365];

function getNextMilestone(current: number): number {
  for (const m of STREAK_MILESTONES) {
    if (current < m) return m;
  }
  return current + 365;
}

export type ChartsPeriod = 'day' | 'week' | 'month' | 'year';

function getPeriodRange(period: ChartsPeriod): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case 'day':
      return { from: today, to: today };
    case 'week': {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { from: monday.toISOString().split('T')[0], to: today };
    }
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: firstOfMonth.toISOString().split('T')[0], to: today };
    }
    case 'year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { from: firstOfYear.toISOString().split('T')[0], to: today };
    }
  }
}

export function useCharts() {
  const { user } = useAuthContext();
  const [trackers, setTrackers] = useState<CustomTracker[]>([]);
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTaskCompletionData = useCallback(async (period: ChartsPeriod) => {
    if (!user) return { completed: 0, total: 0, daily: [] as { date: string; completed: number; total: number }[] };

    const range = getPeriodRange(period);
    const { data } = await supabase
      .from('compass_tasks')
      .select('due_date, status')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .is('parent_task_id', null)
      .gte('due_date', range.from)
      .lte('due_date', range.to);

    const tasks = data || [];
    const completed = tasks.filter((t: { status: string }) => t.status === 'completed').length;

    // Group by day
    const byDay: Record<string, { completed: number; total: number }> = {};
    for (const t of tasks) {
      const d = (t as { due_date: string }).due_date;
      if (!byDay[d]) byDay[d] = { completed: 0, total: 0 };
      byDay[d].total++;
      if ((t as { status: string }).status === 'completed') byDay[d].completed++;
    }

    const daily = Object.entries(byDay)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { completed, total: tasks.length, daily };
  }, [user]);

  const getActiveStreaks = useCallback(async (): Promise<StreakInfo[]> => {
    if (!user) return [];

    // Get recurring tasks
    const { data } = await supabase
      .from('compass_tasks')
      .select('id, title, due_date, status, recurrence_rule')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .is('parent_task_id', null)
      .not('recurrence_rule', 'is', null)
      .order('due_date', { ascending: false });

    if (!data || data.length === 0) return [];

    // Group by title + recurrence to track same habit
    const habitMap: Record<string, { title: string; rule: string; dates: { date: string; completed: boolean }[] }> = {};

    for (const t of data) {
      const task = t as { id: string; title: string; due_date: string; status: string; recurrence_rule: string };
      const key = `${task.title}::${task.recurrence_rule}`;
      if (!habitMap[key]) {
        habitMap[key] = { title: task.title, rule: task.recurrence_rule, dates: [] };
      }
      habitMap[key].dates.push({ date: task.due_date, completed: task.status === 'completed' });
    }

    const streaks: StreakInfo[] = [];

    for (const [, habit] of Object.entries(habitMap)) {
      // Sort dates descending
      const sorted = habit.dates.sort((a, b) => b.date.localeCompare(a.date));

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      let lastCompleted: string | null = null;

      for (const entry of sorted) {
        if (entry.completed) {
          tempStreak++;
          if (!lastCompleted) lastCompleted = entry.date;
        } else {
          if (currentStreak === 0) currentStreak = tempStreak;
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
        }
      }
      if (currentStreak === 0) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);

      if (currentStreak > 0) {
        const nextMilestone = getNextMilestone(currentStreak);
        streaks.push({
          taskId: sorted[0]?.date || '',
          taskTitle: habit.title,
          currentStreak,
          longestStreak,
          lastCompleted,
          isAtMilestone: STREAK_MILESTONES.includes(currentStreak),
          nextMilestone,
        });
      }
    }

    return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
  }, [user]);

  const getJournalActivity = useCallback(async (period: ChartsPeriod) => {
    if (!user) return [] as { date: string; count: number }[];

    const range = getPeriodRange(period);
    const { data } = await supabase
      .from('log_entries')
      .select('created_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .gte('created_at', `${range.from}T00:00:00`)
      .lte('created_at', `${range.to}T23:59:59`);

    const byDay: Record<string, number> = {};
    for (const e of (data || [])) {
      const d = new Date((e as { created_at: string }).created_at).toISOString().split('T')[0];
      byDay[d] = (byDay[d] || 0) + 1;
    }

    return Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [user]);

  // Custom tracker CRUD
  const fetchTrackers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('custom_trackers')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setTrackers((data as CustomTracker[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load trackers');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTracker = useCallback(async (data: {
    name: string;
    tracking_type: CustomTracker['tracking_type'];
    target_value?: number | null;
    visualization?: CustomTracker['visualization'];
    life_area_tag?: string | null;
  }): Promise<CustomTracker | null> => {
    if (!user) return null;
    setError(null);
    try {
      const maxSort = trackers.reduce((max, t) => Math.max(max, t.sort_order), -1);
      const { data: created, error: err } = await supabase
        .from('custom_trackers')
        .insert({
          user_id: user.id,
          name: data.name,
          tracking_type: data.tracking_type,
          target_value: data.target_value ?? null,
          visualization: data.visualization || 'line_graph',
          life_area_tag: data.life_area_tag || null,
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (err) throw err;
      const tracker = created as CustomTracker;
      setTrackers((prev) => [...prev, tracker]);
      return tracker;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create tracker');
      return null;
    }
  }, [user, trackers]);

  const archiveTracker = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await supabase
        .from('custom_trackers')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      setTrackers((prev) => prev.filter((t) => t.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to archive tracker');
    }
  }, [user]);

  const fetchTrackerEntries = useCallback(async (trackerId: string, period: ChartsPeriod) => {
    if (!user) return;
    const range = getPeriodRange(period);
    try {
      const { data, error: err } = await supabase
        .from('tracker_entries')
        .select('*')
        .eq('tracker_id', trackerId)
        .eq('user_id', user.id)
        .gte('entry_date', range.from)
        .lte('entry_date', range.to)
        .order('entry_date', { ascending: true });

      if (err) throw err;
      setTrackerEntries((data as TrackerEntry[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tracker entries');
    }
  }, [user]);

  const logTrackerEntry = useCallback(async (
    trackerId: string,
    value: { numeric?: number; boolean?: boolean },
    date?: string,
  ) => {
    if (!user) return;
    const entryDate = date || new Date().toISOString().split('T')[0];
    try {
      const { error: err } = await supabase
        .from('tracker_entries')
        .upsert({
          tracker_id: trackerId,
          user_id: user.id,
          entry_date: entryDate,
          value_numeric: value.numeric ?? null,
          value_boolean: value.boolean ?? null,
        }, { onConflict: 'tracker_id,entry_date' });

      if (err) throw err;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log entry');
    }
  }, [user]);

  return {
    trackers,
    trackerEntries,
    loading,
    error,
    getTaskCompletionData,
    getActiveStreaks,
    getJournalActivity,
    fetchTrackers,
    createTracker,
    archiveTracker,
    fetchTrackerEntries,
    logTrackerEntry,
  };
}
