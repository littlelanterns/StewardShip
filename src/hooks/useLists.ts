import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { List, ListItem, ListType, ListAiAction } from '../lib/types';

export function useLists() {
  const { user } = useAuthContext();
  const [lists, setLists] = useState<List[]>([]);
  const [currentList, setCurrentList] = useState<List | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (err) throw err;
      setLists((data as List[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load lists';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createList = useCallback(async (data: {
    title: string;
    list_type: ListType;
    ai_action: ListAiAction;
  }): Promise<List | null> => {
    if (!user) return null;
    setError(null);
    try {
      const row = {
        user_id: user.id,
        title: data.title,
        list_type: data.list_type,
        ai_action: data.ai_action,
      };

      const { data: created, error: err } = await supabase
        .from('lists')
        .insert(row)
        .select()
        .single();

      if (err) throw err;
      const list = created as List;
      setLists((prev) => [list, ...prev]);
      return list;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create list';
      setError(msg);
      return null;
    }
  }, [user]);

  const updateList = useCallback(async (
    id: string,
    updates: Partial<List>,
  ): Promise<List | null> => {
    if (!user) return null;
    setError(null);

    // Optimistic update
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    );

    try {
      const { data, error: err } = await supabase
        .from('lists')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as List;
      setLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
      if (currentList?.id === id) setCurrentList(updated);
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update list';
      setError(msg);
      fetchLists();
      return null;
    }
  }, [user, currentList, fetchLists]);

  const archiveList = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('lists')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setLists((prev) => prev.filter((l) => l.id !== id));
      if (currentList?.id === id) setCurrentList(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to archive list';
      setError(msg);
    }
  }, [user, currentList]);

  const fetchListItems = useCallback(async (listId: string): Promise<ListItem[]> => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      const result = (data as ListItem[]) || [];
      setItems(result);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load items';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addListItem = useCallback(async (
    listId: string,
    text: string,
  ): Promise<ListItem | null> => {
    if (!user) return null;
    setError(null);
    try {
      const maxSort = items.reduce((max, i) => Math.max(max, i.sort_order), -1);

      const { data, error: err } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          user_id: user.id,
          text,
          checked: false,
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (err) throw err;
      const item = data as ListItem;
      setItems((prev) => [...prev, item]);
      return item;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add item';
      setError(msg);
      return null;
    }
  }, [user, items]);

  const updateListItem = useCallback(async (
    id: string,
    updates: Partial<ListItem>,
  ): Promise<ListItem | null> => {
    if (!user) return null;
    setError(null);

    // Optimistic
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    );

    try {
      const { data, error: err } = await supabase
        .from('list_items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (err) throw err;
      const updated = data as ListItem;
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update item';
      setError(msg);
      return null;
    }
  }, [user]);

  const toggleListItem = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await updateListItem(id, { checked: !item.checked });
  }, [items, updateListItem]);

  const deleteListItem = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);

    // Optimistic
    setItems((prev) => prev.filter((i) => i.id !== id));

    try {
      const { error: err } = await supabase
        .from('list_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete item';
      setError(msg);
    }
  }, [user]);

  const reorderListItems = useCallback(async (
    listId: string,
    orderedIds: string[],
  ) => {
    if (!user) return;

    // Optimistic
    setItems((prev) => {
      const itemMap = new Map(prev.map((i) => [i.id, i]));
      return orderedIds
        .map((id, index) => {
          const item = itemMap.get(id);
          return item ? { ...item, sort_order: index } : null;
        })
        .filter(Boolean) as ListItem[];
    });

    const updates = orderedIds.map((id, index) =>
      supabase.from('list_items').update({ sort_order: index }).eq('id', id).eq('user_id', user.id),
    );

    try {
      await Promise.all(updates);
    } catch {
      // Revert by refetching
      fetchListItems(listId);
    }
  }, [user, fetchListItems]);

  const generateShareToken = useCallback(async (listId: string): Promise<string | null> => {
    if (!user) return null;
    setError(null);
    try {
      const token = crypto.randomUUID();
      const { error: err } = await supabase
        .from('lists')
        .update({ share_token: token })
        .eq('id', listId)
        .eq('user_id', user.id);

      if (err) throw err;

      setLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, share_token: token } : l)),
      );
      if (currentList?.id === listId) {
        setCurrentList((prev) => prev ? { ...prev, share_token: token } : prev);
      }
      return token;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate share token';
      setError(msg);
      return null;
    }
  }, [user, currentList]);

  // Count checked/total for a list (derived from items state)
  const itemCounts = useCallback((listItems: ListItem[]) => {
    const checked = listItems.filter((i) => i.checked).length;
    return { checked, total: listItems.length };
  }, []);

  return {
    lists,
    currentList,
    setCurrentList,
    items,
    loading,
    error,
    fetchLists,
    createList,
    updateList,
    archiveList,
    fetchListItems,
    addListItem,
    updateListItem,
    toggleListItem,
    deleteListItem,
    reorderListItems,
    generateShareToken,
    itemCounts,
  };
}
