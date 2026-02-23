import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { MastEntry, Victory, StreakInfo, CompassTask } from '../lib/types';

interface DashboardData {
  todayTasks: { total: number; completed: number; pending: CompassTask[] };
  streaks: StreakInfo[];
  recentVictories: Victory[];
  weekVictoryCount: number;
  goals: { id: string; title: string; progress: number; target: number | null }[];
  journalThisWeek: number;
  lastJournalDate: string | null;
  lastJournalPreview: string | null;
  mastThought: MastEntry | null;
}

const STREAK_MILESTONES = [7, 30, 90, 365];

function getNextMilestone(current: number): number {
  for (const m of STREAK_MILESTONES) {
    if (current < m) return m;
  }
  return current + 365;
}

export function useCrowsNest() {
  const { user } = useAuthContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    try {
      const [
        tasksResult,
        streakResult,
        victoriesResult,
        weekVictoriesResult,
        goalsResult,
        journalResult,
        lastJournalResult,
        mastResult,
      ] = await Promise.all([
        // Today's tasks
        supabase
          .from('compass_tasks')
          .select('id, title, status, life_area_tag, sort_order')
          .eq('user_id', user.id)
          .eq('due_date', today)
          .is('archived_at', null)
          .is('parent_task_id', null)
          .order('sort_order'),
        // Recurring tasks for streaks
        supabase
          .from('compass_tasks')
          .select('id, title, due_date, status, recurrence_rule')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .is('parent_task_id', null)
          .not('recurrence_rule', 'is', null)
          .order('due_date', { ascending: false }),
        // Recent victories
        supabase
          .from('victories')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(3),
        // Week victory count
        supabase
          .from('victories')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('archived_at', null)
          .gte('created_at', weekStart.toISOString()),
        // Active goals
        supabase
          .from('goals')
          .select('id, title, progress_current, progress_target')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('archived_at', null)
          .limit(5),
        // Journal count this week
        supabase
          .from('log_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('archived_at', null)
          .gte('created_at', weekStart.toISOString()),
        // Last journal entry
        supabase
          .from('log_entries')
          .select('created_at, text')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(1),
        // Random Mast thought
        supabase
          .from('mast_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null),
      ]);

      // Process tasks
      const tasks = (tasksResult.data || []) as CompassTask[];
      const completedCount = tasks.filter((t) => t.status === 'completed').length;
      const pendingTasks = tasks.filter((t) => t.status === 'pending').slice(0, 3);

      // Process streaks
      const streakData = streakResult.data || [];
      const habitMap: Record<string, { title: string; dates: { date: string; completed: boolean }[] }> = {};
      for (const t of streakData) {
        const task = t as { id: string; title: string; due_date: string; status: string; recurrence_rule: string };
        const key = `${task.title}::${task.recurrence_rule}`;
        if (!habitMap[key]) {
          habitMap[key] = { title: task.title, dates: [] };
        }
        habitMap[key].dates.push({ date: task.due_date, completed: task.status === 'completed' });
      }

      const streaks: StreakInfo[] = [];
      for (const [, habit] of Object.entries(habitMap)) {
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
          streaks.push({
            taskId: sorted[0]?.date || '',
            taskTitle: habit.title,
            currentStreak,
            longestStreak,
            lastCompleted,
            isAtMilestone: STREAK_MILESTONES.includes(currentStreak),
            nextMilestone: getNextMilestone(currentStreak),
          });
        }
      }
      streaks.sort((a, b) => b.currentStreak - a.currentStreak);

      // Process goals
      const goalData = (goalsResult.data || []) as { id: string; title: string; progress_current: number; progress_target: number | null }[];
      const goalsSorted = goalData
        .map((g) => ({
          ...g,
          progress: g.progress_current,
          target: g.progress_target,
          pct: g.progress_target ? g.progress_current / g.progress_target : 0,
        }))
        .sort((a, b) => b.pct - a.pct);

      // Random Mast thought — rotate daily based on date seed
      const mastEntries = (mastResult.data || []) as MastEntry[];
      let mastThought: MastEntry | null = null;
      if (mastEntries.length > 0) {
        const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
        mastThought = mastEntries[dayNum % mastEntries.length];
      }

      // Last journal entry
      const lastJournal = (lastJournalResult.data || [])[0] as { created_at: string; text: string } | undefined;

      setData({
        todayTasks: { total: tasks.length, completed: completedCount, pending: pendingTasks },
        streaks: streaks.slice(0, 5),
        recentVictories: (victoriesResult.data || []) as Victory[],
        weekVictoryCount: weekVictoriesResult.count || 0,
        goals: goalsSorted.slice(0, 3),
        journalThisWeek: journalResult.count || 0,
        lastJournalDate: lastJournal?.created_at || null,
        lastJournalPreview: lastJournal ? (lastJournal.text.length > 100 ? lastJournal.text.slice(0, 97) + '...' : lastJournal.text) : null,
        mastThought,
      });
    } catch {
      // Silently fail — dashboard is read-only, stale data is acceptable
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { data, loading, fetchDashboard };
}
