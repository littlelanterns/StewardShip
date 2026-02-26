import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { List, ListItem, RoutineCompletionHistory, RoutineItemSnapshot } from '../lib/types';

export function useRoutineReset() {
  const { user } = useAuthContext();
  const [history, setHistory] = useState<RoutineCompletionHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const shouldAutoReset = useCallback((list: List): boolean => {
    if (list.list_type !== 'routine' || !list.reset_schedule) return false;
    if (!list.last_reset_at) return false; // Never been reset — don't auto-reset on first view

    const now = new Date();
    const lastReset = new Date(list.last_reset_at);
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...6=Sat

    // Get today's start in local time
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastResetDay = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());

    // Already reset today
    if (todayStart.getTime() <= lastResetDay.getTime()) return false;

    switch (list.reset_schedule) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'weekly': {
        const daysSince = Math.floor((todayStart.getTime() - lastResetDay.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 7;
      }
      case 'custom':
        return list.reset_custom_days ? list.reset_custom_days.includes(dayOfWeek) : false;
      case 'on_completion':
        return false; // Manual trigger only
      default:
        return false;
    }
  }, []);

  const resetRoutine = useCallback(async (
    listId: string,
    items: ListItem[],
  ): Promise<RoutineCompletionHistory | null> => {
    if (!user) return null;

    // Build snapshot
    const snapshot: RoutineItemSnapshot[] = items.map((item) => ({
      id: item.id,
      text: item.text,
      checked: item.checked,
      notes: item.notes,
    }));

    const completedItems = items.filter((i) => i.checked).length;

    try {
      // 1. Save history record
      const { data: historyRecord, error: histErr } = await supabase
        .from('routine_completion_history')
        .insert({
          user_id: user.id,
          list_id: listId,
          items_snapshot: snapshot,
          total_items: items.length,
          completed_items: completedItems,
        })
        .select()
        .single();

      if (histErr) throw histErr;

      // 2. Uncheck all items
      const checkedIds = items.filter((i) => i.checked).map((i) => i.id);
      if (checkedIds.length > 0) {
        const { error: uncheckErr } = await supabase
          .from('list_items')
          .update({ checked: false })
          .in('id', checkedIds)
          .eq('user_id', user.id);

        if (uncheckErr) throw uncheckErr;
      }

      // 3. Update last_reset_at on the list
      const { error: listErr } = await supabase
        .from('lists')
        .update({ last_reset_at: new Date().toISOString() })
        .eq('id', listId)
        .eq('user_id', user.id);

      if (listErr) throw listErr;

      return historyRecord as RoutineCompletionHistory;
    } catch (e) {
      console.error('Failed to reset routine:', e);
      return null;
    }
  }, [user]);

  const fetchHistory = useCallback(async (listId: string, limit = 30) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('routine_completion_history')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (err) throw err;
      setHistory((data as RoutineCompletionHistory[]) || []);
    } catch (e) {
      console.error('Failed to fetch routine history:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getCompletionStats = useCallback((historyData: RoutineCompletionHistory[]) => {
    if (historyData.length === 0) return { avgCompletion: 0, totalResets: 0, streak: 0 };

    const total = historyData.reduce((sum, h) => sum + (h.total_items > 0 ? h.completed_items / h.total_items : 0), 0);
    const avgCompletion = Math.round((total / historyData.length) * 100);

    // Streak: consecutive days with completion records
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < historyData.length; i++) {
      const recordDate = new Date(historyData[i].completed_at);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      const recordDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
      const expectedDay = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), expectedDate.getDate());

      if (recordDay.getTime() === expectedDay.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return { avgCompletion, totalResets: historyData.length, streak };
  }, []);

  return {
    history,
    loading,
    shouldAutoReset,
    resetRoutine,
    fetchHistory,
    getCompletionStats,
  };
}
