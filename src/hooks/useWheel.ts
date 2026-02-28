import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  WheelInstance,
  WheelRimEntry,
  WheelStatus,
  WheelBecomingAction,
  JournalEntry,
  HelmConversation,
} from '../lib/types';

export function useWheel() {
  const { user } = useAuthContext();
  const [wheels, setWheels] = useState<WheelInstance[]>([]);
  const [selectedWheel, setSelectedWheel] = useState<WheelInstance | null>(null);
  const [rimEntries, setRimEntries] = useState<WheelRimEntry[]>([]);
  const [linkedLogEntries, setLinkedLogEntries] = useState<JournalEntry[]>([]);
  const [linkedConversations, setLinkedConversations] = useState<HelmConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWheels = useCallback(async (status?: WheelStatus) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('wheel_instances')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setWheels((data as WheelInstance[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchWheel = useCallback(async (id: string) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('wheel_instances')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (err) throw err;
      const wheel = data as WheelInstance;
      setSelectedWheel(wheel);
      return wheel;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createWheel = useCallback(async (hubText: string, lifeAreaTag?: string): Promise<WheelInstance | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('wheel_instances')
        .insert({
          user_id: user.id,
          hub_text: hubText,
          status: 'in_progress',
          current_spoke: 0,
          rim_interval_days: 14,
          rim_count: 0,
          life_area_tag: lifeAreaTag || null,
        })
        .select()
        .single();

      if (err) throw err;
      const wheel = data as WheelInstance;
      setWheels((prev) => [wheel, ...prev]);
      return wheel;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updateWheel = useCallback(async (id: string, updates: Partial<WheelInstance>) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setWheels((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    if (selectedWheel?.id === id) {
      setSelectedWheel((prev) => prev ? { ...prev, ...updates } : prev);
    }
    try {
      const { error: err } = await supabase
        .from('wheel_instances')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      // Revert on failure
      fetchWheels();
    }
  }, [user, selectedWheel, fetchWheels]);

  const updateSpoke = useCallback(async (
    wheelId: string,
    spokeNumber: number,
    data: Record<string, unknown>,
    advance = true,
  ) => {
    if (!user) return;
    setError(null);
    try {
      const updates: Record<string, unknown> = { ...data };
      if (advance) {
        updates.current_spoke = spokeNumber + 1;
      }
      const { error: err } = await supabase
        .from('wheel_instances')
        .update(updates)
        .eq('id', wheelId)
        .eq('user_id', user.id);

      if (err) throw err;

      // Update local state
      setWheels((prev) =>
        prev.map((w) =>
          w.id === wheelId ? { ...w, ...updates } as WheelInstance : w,
        ),
      );
      if (selectedWheel?.id === wheelId) {
        setSelectedWheel((prev) => prev ? { ...prev, ...updates } as WheelInstance : prev);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, selectedWheel]);

  const activateWheel = useCallback(async (id: string) => {
    const nextRimDate = new Date();
    const wheel = wheels.find((w) => w.id === id);
    const intervalDays = wheel?.rim_interval_days || 14;
    nextRimDate.setDate(nextRimDate.getDate() + intervalDays);

    await updateWheel(id, {
      status: 'active',
      next_rim_date: nextRimDate.toISOString().split('T')[0],
    });
  }, [updateWheel, wheels]);

  const completeWheel = useCallback(async (id: string) => {
    await updateWheel(id, { status: 'completed' });
  }, [updateWheel]);

  const archiveWheel = useCallback(async (id: string) => {
    await updateWheel(id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    });
    setWheels((prev) => prev.filter((w) => w.id !== id));
  }, [updateWheel]);

  const createRimEntry = useCallback(async (
    wheelId: string,
    data: {
      notes?: string;
      spoke_updates?: Record<string, string>;
      evidence_progress?: Record<string, string>;
      new_actions?: WheelBecomingAction[];
      helm_conversation_id?: string;
    },
  ): Promise<WheelRimEntry | null> => {
    if (!user) return null;
    setError(null);
    try {
      const wheel = wheels.find((w) => w.id === wheelId) || selectedWheel;
      if (!wheel) throw new Error('Wheel not found');

      const rimNumber = wheel.rim_count + 1;

      const { data: entry, error: err } = await supabase
        .from('wheel_rim_entries')
        .insert({
          wheel_id: wheelId,
          user_id: user.id,
          rim_number: rimNumber,
          notes: data.notes || null,
          spoke_updates: data.spoke_updates || null,
          evidence_progress: data.evidence_progress || null,
          new_actions: data.new_actions || null,
          helm_conversation_id: data.helm_conversation_id || null,
        })
        .select()
        .single();

      if (err) throw err;

      // Update wheel: increment rim_count, set next_rim_date
      const nextRimDate = new Date();
      nextRimDate.setDate(nextRimDate.getDate() + wheel.rim_interval_days);

      await updateWheel(wheelId, {
        rim_count: rimNumber,
        next_rim_date: nextRimDate.toISOString().split('T')[0],
      });

      const rimEntry = entry as WheelRimEntry;
      setRimEntries((prev) => [rimEntry, ...prev]);
      return rimEntry;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, wheels, selectedWheel, updateWheel]);

  const fetchRimEntries = useCallback(async (wheelId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('wheel_rim_entries')
        .select('*')
        .eq('wheel_id', wheelId)
        .eq('user_id', user.id)
        .order('rim_number', { ascending: false });

      if (err) throw err;
      setRimEntries((data as WheelRimEntry[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const getLinkedLogEntries = useCallback(async (wheelId: string, lifeAreaTag?: string | null) => {
    if (!user) return;
    try {
      // Primary: entries explicitly linked via related_wheel_id
      const { data: linked, error: err1 } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('related_wheel_id', wheelId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (err1) throw err1;

      // Fallback: entries matching the wheel's life_area_tag (not explicitly linked)
      let tagFallback: JournalEntry[] = [];
      if (lifeAreaTag) {
        const wheel = wheels.find((w) => w.id === wheelId) || selectedWheel;
        const createdAfter = wheel?.created_at || '';

        const { data: related, error: err2 } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .is('related_wheel_id', null)
          .contains('life_area_tags', [lifeAreaTag])
          .gte('created_at', createdAfter)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!err2 && related) {
          tagFallback = related as JournalEntry[];
        }
      }

      const linkedEntries = (linked as JournalEntry[]) || [];
      const linkedIds = new Set(linkedEntries.map((e) => e.id));
      const uniqueFallback = tagFallback.filter((e) => !linkedIds.has(e.id));

      setLinkedLogEntries([...linkedEntries, ...uniqueFallback]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, wheels, selectedWheel]);

  const getLinkedConversations = useCallback(async (wheelId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('helm_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('guided_mode_reference_id', wheelId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setLinkedConversations((data as HelmConversation[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  return {
    wheels,
    selectedWheel,
    rimEntries,
    linkedLogEntries,
    linkedConversations,
    loading,
    error,
    fetchWheels,
    fetchWheel,
    createWheel,
    updateWheel,
    updateSpoke,
    activateWheel,
    completeWheel,
    archiveWheel,
    createRimEntry,
    fetchRimEntries,
    getLinkedLogEntries,
    getLinkedConversations,
    setSelectedWheel,
  };
}
