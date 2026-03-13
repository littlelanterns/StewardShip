import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { ManifestCollection, ManifestCollectionItem } from '../lib/types';

export function useManifestCollections() {
  const { user } = useAuthContext();
  const [collections, setCollections] = useState<ManifestCollection[]>([]);
  const [collectionItemsMap, setCollectionItemsMap] = useState<Map<string, ManifestCollectionItem[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [colRes, itemsRes] = await Promise.all([
        supabase
          .from('manifest_collections')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('manifest_collection_items')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true }),
      ]);

      if (colRes.data) setCollections(colRes.data);

      if (itemsRes.data) {
        const map = new Map<string, ManifestCollectionItem[]>();
        for (const item of itemsRes.data) {
          const list = map.get(item.collection_id) || [];
          list.push(item);
          map.set(item.collection_id, list);
        }
        setCollectionItemsMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createCollection = useCallback(async (
    name: string,
    description?: string,
  ): Promise<ManifestCollection | null> => {
    if (!user) return null;
    const maxSort = collections.reduce((max, c) => Math.max(max, c.sort_order), -1);
    const { data, error } = await supabase
      .from('manifest_collections')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        sort_order: maxSort + 1,
      })
      .select()
      .single();
    if (error || !data) return null;
    setCollections((prev) => [...prev, data]);
    return data;
  }, [user, collections]);

  const updateCollection = useCallback(async (
    id: string,
    updates: Partial<Pick<ManifestCollection, 'name' | 'description'>>,
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('manifest_collections')
      .update(updates)
      .eq('id', id);
    if (error) return false;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    return true;
  }, []);

  const archiveCollection = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('manifest_collections')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return false;
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setCollectionItemsMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    return true;
  }, []);

  const addToCollection = useCallback(async (
    collectionId: string,
    manifestItemIds: string[],
  ): Promise<boolean> => {
    if (!user || manifestItemIds.length === 0) return false;
    const existing = collectionItemsMap.get(collectionId) || [];
    const maxSort = existing.reduce((max, i) => Math.max(max, i.sort_order), -1);

    const rows = manifestItemIds.map((itemId, idx) => ({
      collection_id: collectionId,
      manifest_item_id: itemId,
      user_id: user.id,
      sort_order: maxSort + 1 + idx,
    }));

    const { data, error } = await supabase
      .from('manifest_collection_items')
      .upsert(rows, { onConflict: 'collection_id,manifest_item_id', ignoreDuplicates: true })
      .select();
    if (error) return false;

    if (data && data.length > 0) {
      setCollectionItemsMap((prev) => {
        const next = new Map(prev);
        const current = next.get(collectionId) || [];
        const existingIds = new Set(current.map((i) => i.manifest_item_id));
        const newItems = data.filter((d) => !existingIds.has(d.manifest_item_id));
        next.set(collectionId, [...current, ...newItems]);
        return next;
      });
    }
    return true;
  }, [user, collectionItemsMap]);

  const removeFromCollection = useCallback(async (
    collectionId: string,
    manifestItemId: string,
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('manifest_collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('manifest_item_id', manifestItemId);
    if (error) return false;
    setCollectionItemsMap((prev) => {
      const next = new Map(prev);
      const current = next.get(collectionId) || [];
      next.set(collectionId, current.filter((i) => i.manifest_item_id !== manifestItemId));
      return next;
    });
    return true;
  }, []);

  const getItemIdsForCollection = useCallback((collectionId: string): string[] => {
    return (collectionItemsMap.get(collectionId) || []).map((i) => i.manifest_item_id);
  }, [collectionItemsMap]);

  const reorderCollectionItems = useCallback(async (
    collectionId: string,
    orderedManifestItemIds: string[],
  ): Promise<boolean> => {
    // Optimistically update local state
    setCollectionItemsMap((prev) => {
      const next = new Map(prev);
      const current = next.get(collectionId) || [];
      const reordered = orderedManifestItemIds
        .map((mid, idx) => {
          const item = current.find((i) => i.manifest_item_id === mid);
          return item ? { ...item, sort_order: idx } : null;
        })
        .filter((i): i is ManifestCollectionItem => i !== null);
      next.set(collectionId, reordered);
      return next;
    });

    // Persist to DB
    const updates = orderedManifestItemIds.map((mid, idx) => (
      supabase
        .from('manifest_collection_items')
        .update({ sort_order: idx })
        .eq('collection_id', collectionId)
        .eq('manifest_item_id', mid)
    ));
    const results = await Promise.all(updates);
    return results.every((r) => !r.error);
  }, []);

  const getCollectionsForItem = useCallback((manifestItemId: string): string[] => {
    const result: string[] = [];
    for (const [colId, items] of collectionItemsMap) {
      if (items.some((i) => i.manifest_item_id === manifestItemId)) {
        result.push(colId);
      }
    }
    return result;
  }, [collectionItemsMap]);

  const pushCollection = useCallback(async (collectionId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { data, error } = await supabase.functions.invoke('manifest-admin', {
      body: { action: 'push_collection', collection_id: collectionId },
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: data?.message || 'Collection pushed to all users' };
  }, []);

  return {
    collections,
    collectionItemsMap,
    loading,
    fetchCollections,
    createCollection,
    updateCollection,
    archiveCollection,
    addToCollection,
    removeFromCollection,
    getItemIdsForCollection,
    getCollectionsForItem,
    reorderCollectionItems,
    pushCollection,
  };
}
