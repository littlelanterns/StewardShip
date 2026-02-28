import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { VictoryCelebration } from '../lib/types';

export function useCelebrationArchive() {
  const { user } = useAuthContext();
  const [celebrations, setCelebrations] = useState<VictoryCelebration[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCelebrations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('victory_celebrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCelebrations((data as VictoryCelebration[]) || []);
    } catch (err) {
      console.error('Failed to fetch celebrations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveCelebration = useCallback(async (
    narrative: string,
    period: string,
    accomplishmentCount: number,
    accomplishmentSummary: string,
  ) => {
    if (!user) return;
    try {
      await supabase.from('victory_celebrations').insert({
        user_id: user.id,
        narrative,
        period,
        accomplishment_count: accomplishmentCount,
        accomplishment_summary: accomplishmentSummary,
      });
    } catch (err) {
      console.error('Failed to save celebration to archive:', err);
    }
  }, [user]);

  const deleteCelebration = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('victory_celebrations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setCelebrations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete celebration:', err);
    }
  }, [user]);

  return {
    celebrations,
    loading,
    fetchCelebrations,
    saveCelebration,
    deleteCelebration,
  };
}
