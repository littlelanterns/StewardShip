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
    reset_schedule?: string | null;
    reset_custom_days?: number[] | null;
  }): Promise<List | null> => {
    if (!user) return null;
    setError(null);
    try {
      const row = {
        user_id: user.id,
        title: data.title,
        list_type: data.list_type,
        ai_action: data.ai_action,
        reset_schedule: data.reset_schedule || null,
        reset_custom_days: data.reset_custom_days || null,
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
    parentItemId?: string,
  ): Promise<ListItem | null> => {
    if (!user) return null;
    setError(null);
    try {
      // For sub-items, compute sort_order among siblings only
      const siblings = parentItemId
        ? items.filter((i) => i.parent_item_id === parentItemId)
        : items.filter((i) => !i.parent_item_id);
      const maxSort = siblings.reduce((max, i) => Math.max(max, i.sort_order), -1);

      const { data, error: err } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          user_id: user.id,
          text,
          checked: false,
          sort_order: maxSort + 1,
          parent_item_id: parentItemId || null,
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

    const newChecked = !item.checked;

    // Toggle the item itself
    await updateListItem(id, { checked: newChecked });

    if (newChecked) {
      // Checking: also check all children
      const children = items.filter((i) => i.parent_item_id === id && !i.checked);
      for (const child of children) {
        await updateListItem(child.id, { checked: true });
      }

      // Check if all siblings under the same parent are now checked → auto-check parent
      if (item.parent_item_id) {
        const siblings = items.filter((i) => i.parent_item_id === item.parent_item_id && i.id !== id);
        const allSiblingsChecked = siblings.every((s) => s.checked);
        if (allSiblingsChecked) {
          const parent = items.find((i) => i.id === item.parent_item_id);
          if (parent && !parent.checked) {
            await updateListItem(parent.id, { checked: true });
          }
        }
      }
    } else {
      // Unchecking: also uncheck all children
      const children = items.filter((i) => i.parent_item_id === id && i.checked);
      for (const child of children) {
        await updateListItem(child.id, { checked: false });
      }

      // Uncheck parent if this item has a parent
      if (item.parent_item_id) {
        const parent = items.find((i) => i.id === item.parent_item_id);
        if (parent && parent.checked) {
          await updateListItem(parent.id, { checked: false });
        }
      }
    }
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

  // Hierarchy helper: group items into top-level + children map
  const getItemHierarchy = useCallback((listItems: ListItem[]) => {
    const topLevel = listItems
      .filter((i) => !i.parent_item_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const childMap: Record<string, ListItem[]> = {};
    for (const item of listItems) {
      if (item.parent_item_id) {
        if (!childMap[item.parent_item_id]) childMap[item.parent_item_id] = [];
        childMap[item.parent_item_id].push(item);
      }
    }
    // Sort children within each group
    for (const key of Object.keys(childMap)) {
      childMap[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return { topLevel, childMap };
  }, []);

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
    getItemHierarchy,
    itemCounts,
  };
}
