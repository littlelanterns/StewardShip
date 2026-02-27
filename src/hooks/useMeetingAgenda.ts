import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { MeetingAgendaItem } from '../lib/types';

export function useMeetingAgenda() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<MeetingAgendaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingItems = useCallback(async (
    meetingType: string,
    relatedPersonId?: string | null,
    templateId?: string | null,
  ): Promise<MeetingAgendaItem[]> => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('meeting_type', meetingType)
        .eq('status', 'pending')
        .order('sort_order', { ascending: true });

      if (relatedPersonId) {
        query = query.eq('related_person_id', relatedPersonId);
      } else {
        query = query.is('related_person_id', null);
      }

      if (templateId) {
        query = query.eq('template_id', templateId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const result = (data || []) as MeetingAgendaItem[];
      setItems(result);
      return result;
    } catch (e) {
      console.error('Failed to fetch agenda items:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addItem = useCallback(async (
    meetingType: string,
    text: string,
    relatedPersonId?: string | null,
    templateId?: string | null,
    notes?: string | null,
  ): Promise<MeetingAgendaItem | null> => {
    if (!user || !text.trim()) return null;
    try {
      // Get max sort_order for this meeting context
      const maxOrder = items.length > 0
        ? Math.max(...items.map(i => i.sort_order))
        : -1;

      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .insert({
          user_id: user.id,
          meeting_type: meetingType,
          related_person_id: relatedPersonId || null,
          template_id: templateId || null,
          text: text.trim(),
          notes: notes?.trim() || null,
          sort_order: maxOrder + 1,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      const item = data as MeetingAgendaItem;
      setItems(prev => [...prev, item]);
      return item;
    } catch (e) {
      console.error('Failed to add agenda item:', e);
      return null;
    }
  }, [user, items]);

  const updateItem = useCallback(async (
    id: string,
    updates: Partial<Pick<MeetingAgendaItem, 'text' | 'notes' | 'sort_order'>>,
  ): Promise<void> => {
    if (!user) return;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    try {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to update agenda item:', e);
    }
  }, [user]);

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to delete agenda item:', e);
    }
  }, [user]);

  const markDiscussed = useCallback(async (
    id: string,
    meetingId: string,
  ): Promise<void> => {
    if (!user) return;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .update({ status: 'discussed', discussed_in_meeting_id: meetingId })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to mark agenda item discussed:', e);
    }
  }, [user]);

  const markDeferred = useCallback(async (_id: string): Promise<void> => {
    if (!user) return;
    // Deferred items stay pending — they just got acknowledged
    // No status change needed; this is a no-op by design
    // (the item remains in the pending queue for next meeting)
  }, [user]);

  const markAllDiscussed = useCallback(async (
    meetingType: string,
    relatedPersonId: string | null,
    meetingId: string,
  ): Promise<void> => {
    if (!user) return;
    setItems([]);
    try {
      let query = supabase
        .from('meeting_agenda_items')
        .update({ status: 'discussed', discussed_in_meeting_id: meetingId })
        .eq('user_id', user.id)
        .eq('meeting_type', meetingType)
        .eq('status', 'pending');

      if (relatedPersonId) {
        query = query.eq('related_person_id', relatedPersonId);
      } else {
        query = query.is('related_person_id', null);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (e) {
      console.error('Failed to mark all agenda items discussed:', e);
    }
  }, [user]);

  const getPendingCount = useCallback(async (
    meetingType: string,
    relatedPersonId?: string | null,
  ): Promise<number> => {
    if (!user) return 0;
    try {
      let query = supabase
        .from('meeting_agenda_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('meeting_type', meetingType)
        .eq('status', 'pending');

      if (relatedPersonId) {
        query = query.eq('related_person_id', relatedPersonId);
      } else {
        query = query.is('related_person_id', null);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Failed to get pending count:', e);
      return 0;
    }
  }, [user]);

  return {
    items,
    loading,
    fetchPendingItems,
    addItem,
    updateItem,
    deleteItem,
    markDiscussed,
    markDeferred,
    markAllDiscussed,
    getPendingCount,
  };
}
