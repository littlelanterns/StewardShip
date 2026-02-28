import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  ReportConfig,
  ReportData,
  ReportPeriod,
  ReportTaskData,
  ReportJournalData,
} from '../lib/types';

function computeDateRange(period: ReportPeriod, dateFrom?: string, dateTo?: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (period) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'this_week': {
      const day = today.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - mondayOffset);
      return { from: fmt(monday), to: fmt(today) };
    }
    case 'this_month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(monthStart), to: fmt(today) };
    }
    case 'last_month': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(lastMonthStart), to: fmt(lastMonthEnd) };
    }
    case 'custom':
      return {
        from: dateFrom || fmt(today),
        to: dateTo || fmt(today),
      };
    default:
      return { from: fmt(today), to: fmt(today) };
  }
}

export function useReportGenerator() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const generateReport = useCallback(async (config: ReportConfig): Promise<ReportData | null> => {
    if (!user) return null;
    setLoading(true);
    setError(null);

    const { from, to } = computeDateRange(config.period, config.dateFrom, config.dateTo);
    const fromISO = `${from}T00:00:00`;
    const toISO = `${to}T23:59:59`;

    const data: ReportData = {
      period: config.period,
      dateFrom: from,
      dateTo: to,
    };

    try {
      const queries: Promise<void>[] = [];

      if (config.sections.includes('tasks')) {
        queries.push((async () => {
          const { data: tasks, error: err } = await supabase
            .from('compass_tasks')
            .select('status, life_area_tag')
            .eq('user_id', user.id)
            .gte('created_at', fromISO)
            .lte('created_at', toISO);

          if (err) throw err;

          const taskData: ReportTaskData = {
            completed: 0,
            pending: 0,
            carried_forward: 0,
            cancelled: 0,
            byLifeArea: {},
          };

          for (const t of tasks || []) {
            if (t.status === 'completed') taskData.completed++;
            else if (t.status === 'pending') taskData.pending++;
            else if (t.status === 'carried_forward') taskData.carried_forward++;
            else if (t.status === 'cancelled') taskData.cancelled++;

            const area = t.life_area_tag || 'uncategorized';
            taskData.byLifeArea[area] = (taskData.byLifeArea[area] || 0) + 1;
          }
          data.tasks = taskData;
        })());
      }

      if (config.sections.includes('routines')) {
        queries.push((async () => {
          const { data: history, error: err } = await supabase
            .from('routine_completion_history')
            .select('list_id, total_items, completed_items, lists(title)')
            .eq('user_id', user.id)
            .gte('completed_at', fromISO)
            .lte('completed_at', toISO);

          if (err) throw err;

          const routineMap: Record<string, { name: string; completions: number; totalRate: number }> = {};
          for (const h of (history || []) as (typeof history extends (infer T)[] | null ? T : never)[]) {
            const listTitle = (h as Record<string, unknown>).lists
              ? ((h as Record<string, unknown>).lists as { title: string }).title
              : 'Unknown';
            if (!routineMap[h.list_id]) {
              routineMap[h.list_id] = { name: listTitle, completions: 0, totalRate: 0 };
            }
            routineMap[h.list_id].completions++;
            routineMap[h.list_id].totalRate += h.total_items > 0 ? h.completed_items / h.total_items : 0;
          }

          data.routines = Object.values(routineMap).map((r) => ({
            routineName: r.name,
            completionCount: r.completions,
            averageCompletion: r.completions > 0 ? Math.round((r.totalRate / r.completions) * 100) : 0,
          }));
        })());
      }

      if (config.sections.includes('journal')) {
        queries.push((async () => {
          const { data: entries, error: err } = await supabase
            .from('journal_entries')
            .select('entry_type')
            .eq('user_id', user.id)
            .is('archived_at', null)
            .gte('created_at', fromISO)
            .lte('created_at', toISO);

          if (err) throw err;

          const journalData: ReportJournalData = { total: (entries || []).length, byType: {} };
          for (const e of entries || []) {
            journalData.byType[e.entry_type] = (journalData.byType[e.entry_type] || 0) + 1;
          }
          data.journal = journalData;
        })());
      }

      if (config.sections.includes('victories')) {
        queries.push((async () => {
          const { data: victories, error: err } = await supabase
            .from('victories')
            .select('description')
            .eq('user_id', user.id)
            .is('archived_at', null)
            .gte('created_at', fromISO)
            .lte('created_at', toISO);

          if (err) throw err;

          data.victories = {
            total: (victories || []).length,
            descriptions: (victories || []).map((v: { description: string }) => v.description),
          };
        })());
      }

      if (config.sections.includes('reflections')) {
        queries.push((async () => {
          const { data: responses, error: err } = await supabase
            .from('reflection_responses')
            .select('response_text, response_date, reflection_questions(question_text)')
            .eq('user_id', user.id)
            .gte('response_date', from)
            .lte('response_date', to)
            .order('response_date', { ascending: false });

          if (err) throw err;

          data.reflections = {
            total: (responses || []).length,
            questions: (responses || []).map((r: Record<string, unknown>) => ({
              question: (r.reflection_questions as { question_text: string })?.question_text || '',
              response: r.response_text as string,
              date: r.response_date as string,
            })),
          };
        })());
      }

      if (config.sections.includes('goals')) {
        queries.push((async () => {
          const { data: goals, error: err } = await supabase
            .from('goals')
            .select('title, progress_current, progress_target, status')
            .eq('user_id', user.id)
            .neq('status', 'archived');

          if (err) throw err;

          data.goals = (goals || []).map((g: { title: string; progress_current: number; progress_target: number | null; status: string }) => ({
            title: g.title,
            progress: g.progress_current,
            target: g.progress_target,
            status: g.status,
          }));
        })());
      }

      if (config.sections.includes('streaks')) {
        queries.push((async () => {
          // Get recurring tasks to compute streaks
          const { data: recurTasks, error: err } = await supabase
            .from('compass_tasks')
            .select('id, title, recurrence_rule, status, completed_at')
            .eq('user_id', user.id)
            .not('recurrence_rule', 'is', null);

          if (err) throw err;

          // Simple streak computation
          const taskStreaks: Record<string, { title: string; current: number; longest: number }> = {};
          for (const t of recurTasks || []) {
            const key = t.title;
            if (!taskStreaks[key]) {
              taskStreaks[key] = { title: t.title, current: 0, longest: 0 };
            }
            if (t.status === 'completed') {
              taskStreaks[key].current++;
            }
            taskStreaks[key].longest = Math.max(taskStreaks[key].longest, taskStreaks[key].current);
          }

          data.streaks = Object.values(taskStreaks)
            .filter((s) => s.current > 0 || s.longest > 0)
            .map((s) => ({
              taskTitle: s.title,
              currentStreak: s.current,
              longestStreak: s.longest,
            }));
        })());
      }

      await Promise.all(queries);
      setReportData(data);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate report';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    reportData,
    loading,
    error,
    generateReport,
  };
}
