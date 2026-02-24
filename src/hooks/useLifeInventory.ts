import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { LifeInventoryArea, LifeInventorySnapshot, SnapshotType } from '../lib/types';
import { DEFAULT_LIFE_AREAS } from '../lib/types';

export function useLifeInventory() {
  const { user } = useAuthContext();
  const [areas, setAreas] = useState<LifeInventoryArea[]>([]);
  const [snapshots, setSnapshots] = useState<LifeInventorySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAreas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('life_inventory_areas')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      if (err) throw err;
      const result = (data as LifeInventoryArea[]) || [];

      // Auto-seed default areas on first visit
      if (result.length === 0) {
        await seedDefaultAreas();
        return;
      }

      setAreas(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const seedDefaultAreas = useCallback(async () => {
    if (!user) return;
    try {
      const inserts = DEFAULT_LIFE_AREAS.map((name, idx) => ({
        user_id: user.id,
        area_name: name,
        is_custom: false,
        display_order: idx,
      }));

      const { data, error: err } = await supabase
        .from('life_inventory_areas')
        .insert(inserts)
        .select();

      if (err) throw err;
      setAreas((data as LifeInventoryArea[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  const createArea = useCallback(async (areaName: string): Promise<LifeInventoryArea | null> => {
    if (!user) return null;
    setError(null);
    try {
      const nextOrder = areas.length > 0 ? Math.max(...areas.map((a) => a.display_order)) + 1 : 0;

      const { data, error: err } = await supabase
        .from('life_inventory_areas')
        .insert({
          user_id: user.id,
          area_name: areaName,
          is_custom: true,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (err) throw err;
      const area = data as LifeInventoryArea;
      setAreas((prev) => [...prev, area]);
      return area;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, areas]);

  const updateArea = useCallback(async (id: string, updates: Partial<LifeInventoryArea>) => {
    if (!user) return;
    setError(null);

    // Optimistic update
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));

    try {
      const { error: err } = await supabase
        .from('life_inventory_areas')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchAreas(); // Revert
    }
  }, [user, fetchAreas]);

  const reorderAreas = useCallback(async (orderedIds: string[]) => {
    if (!user) return;
    setError(null);

    // Optimistic reorder
    const reordered = orderedIds
      .map((id, idx) => {
        const area = areas.find((a) => a.id === id);
        return area ? { ...area, display_order: idx } : null;
      })
      .filter(Boolean) as LifeInventoryArea[];
    setAreas(reordered);

    try {
      const updates = orderedIds.map((id, idx) =>
        supabase
          .from('life_inventory_areas')
          .update({ display_order: idx })
          .eq('id', id)
          .eq('user_id', user.id),
      );
      await Promise.all(updates);
    } catch (err) {
      setError((err as Error).message);
      fetchAreas(); // Revert
    }
  }, [user, areas, fetchAreas]);

  const deleteArea = useCallback(async (id: string) => {
    if (!user) return;
    const area = areas.find((a) => a.id === id);
    if (!area || !area.is_custom) return;

    setError(null);
    setAreas((prev) => prev.filter((a) => a.id !== id));

    try {
      const { error: err } = await supabase
        .from('life_inventory_areas')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchAreas(); // Revert
    }
  }, [user, areas, fetchAreas]);

  const createSnapshot = useCallback(async (
    areaId: string,
    snapshotType: SnapshotType,
    summaryText: string,
    conversationId?: string,
  ): Promise<LifeInventorySnapshot | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('life_inventory_snapshots')
        .insert({
          area_id: areaId,
          user_id: user.id,
          snapshot_type: snapshotType,
          summary_text: summaryText,
          helm_conversation_id: conversationId || null,
        })
        .select()
        .single();

      if (err) throw err;

      // Also update the area's summary column
      const today = new Date().toISOString().split('T')[0];
      const areaUpdates: Partial<LifeInventoryArea> = {};
      if (snapshotType === 'baseline') {
        areaUpdates.baseline_summary = summaryText;
        areaUpdates.baseline_date = today;
      } else if (snapshotType === 'current') {
        areaUpdates.current_summary = summaryText;
        areaUpdates.current_assessed_date = today;
      } else if (snapshotType === 'vision') {
        areaUpdates.vision_summary = summaryText;
        areaUpdates.vision_date = today;
      }
      await updateArea(areaId, areaUpdates);

      const snapshot = data as LifeInventorySnapshot;
      setSnapshots((prev) => [snapshot, ...prev]);
      return snapshot;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, updateArea]);

  const fetchSnapshots = useCallback(async (areaId: string) => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('life_inventory_snapshots')
        .select('*')
        .eq('area_id', areaId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setSnapshots((data as LifeInventorySnapshot[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  return {
    areas,
    snapshots,
    loading,
    error,
    fetchAreas,
    createArea,
    updateArea,
    reorderAreas,
    deleteArea,
    createSnapshot,
    fetchSnapshots,
  };
}
