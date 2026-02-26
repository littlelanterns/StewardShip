import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { RoutineAssignment } from '../lib/types';

export function useRoutineAssignment() {
  const { user } = useAuthContext();
  const [assignments, setAssignments] = useState<RoutineAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routine_assignments')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const results = (data as RoutineAssignment[]) || [];

      // Auto-expire assignments past their ends_at date
      const now = new Date().toISOString();
      const expired = results.filter((a) => a.status === 'active' && a.ends_at && a.ends_at < now);
      if (expired.length > 0) {
        await Promise.all(
          expired.map((a) =>
            supabase.from('routine_assignments').update({ status: 'expired' }).eq('id', a.id)
          )
        );
      }

      setAssignments(results.filter((a) => !(a.ends_at && a.ends_at < now && a.status === 'active')));
    } catch (e) {
      console.error('Failed to fetch assignments:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createAssignment = useCallback(async (data: {
    list_id: string;
    recurrence_rule: string;
    custom_days?: number[] | null;
    ends_at?: string | null;
  }): Promise<RoutineAssignment | null> => {
    if (!user) return null;
    try {
      // Check for existing active assignment for this list
      const { data: existing } = await supabase
        .from('routine_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('list_id', data.list_id)
        .eq('status', 'active')
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing instead of creating duplicate
        const { data: updated, error } = await supabase
          .from('routine_assignments')
          .update({
            recurrence_rule: data.recurrence_rule,
            custom_days: data.custom_days || null,
            ends_at: data.ends_at || null,
          })
          .eq('id', existing[0].id)
          .select()
          .single();

        if (error) throw error;
        const assignment = updated as RoutineAssignment;
        setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? assignment : a)));
        return assignment;
      }

      const { data: created, error } = await supabase
        .from('routine_assignments')
        .insert({
          user_id: user.id,
          list_id: data.list_id,
          recurrence_rule: data.recurrence_rule,
          custom_days: data.custom_days || null,
          ends_at: data.ends_at || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      const assignment = created as RoutineAssignment;
      setAssignments((prev) => [assignment, ...prev]);
      return assignment;
    } catch (e) {
      console.error('Failed to create assignment:', e);
      return null;
    }
  }, [user]);

  const pauseAssignment = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('routine_assignments')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'paused' as const, paused_at: new Date().toISOString() } : a))
      );
    } catch (e) {
      console.error('Failed to pause assignment:', e);
    }
  }, [user]);

  const resumeAssignment = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('routine_assignments')
        .update({ status: 'active', paused_at: null })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'active' as const, paused_at: null } : a))
      );
    } catch (e) {
      console.error('Failed to resume assignment:', e);
    }
  }, [user]);

  const removeAssignment = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('routine_assignments')
        .update({ status: 'removed' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error('Failed to remove assignment:', e);
    }
  }, [user]);

  /** Get assignments that should appear today based on their recurrence rule */
  const getTodayAssignments = useCallback((): RoutineAssignment[] => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun ... 6=Sat

    return assignments.filter((a) => {
      if (a.status !== 'active') return false;

      switch (a.recurrence_rule) {
        case 'daily':
          return true;
        case 'weekdays':
          return dayOfWeek >= 1 && dayOfWeek <= 5;
        case 'weekly': {
          // Show on the same day of week as started
          const startDay = new Date(a.started_at).getDay();
          return dayOfWeek === startDay;
        }
        case 'custom':
          return a.custom_days ? a.custom_days.includes(dayOfWeek) : false;
        default:
          return true;
      }
    });
  }, [assignments]);

  /** Get assignment for a specific list */
  const getAssignmentForList = useCallback((listId: string): RoutineAssignment | undefined => {
    return assignments.find((a) => a.list_id === listId && (a.status === 'active' || a.status === 'paused'));
  }, [assignments]);

  return {
    assignments,
    loading,
    fetchAssignments,
    createAssignment,
    pauseAssignment,
    resumeAssignment,
    removeAssignment,
    getTodayAssignments,
    getAssignmentForList,
  };
}
