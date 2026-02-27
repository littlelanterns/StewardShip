import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { HigginsMessage, HigginsTeachingSkill, HigginsMode } from '../lib/types';

export function useHiggins(userId: string | undefined, personId: string | undefined) {
  const [drafts, setDrafts] = useState<HigginsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!userId || !personId) return;
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('higgins_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('people_id', personId)
      .in('status', ['draft', 'saved_for_later'])
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setDrafts((data as HigginsMessage[]) || []);
    }
    setLoading(false);
  }, [userId, personId]);

  useEffect(() => {
    if (userId && personId) {
      fetchDrafts();
    } else {
      setDrafts([]);
    }
  }, [userId, personId, fetchDrafts]);

  const saveDraft = useCallback(async (params: {
    rawInput: string;
    mode: HigginsMode;
    craftedVersion?: string;
    finalVersion?: string;
    teachingSkill?: HigginsTeachingSkill;
    teachingNote?: string;
    helmConversationId?: string;
  }): Promise<HigginsMessage | null> => {
    if (!userId || !personId) return null;

    const { data, error: insertErr } = await supabase
      .from('higgins_messages')
      .insert({
        user_id: userId,
        people_id: personId,
        mode: params.mode,
        raw_input: params.rawInput,
        crafted_version: params.craftedVersion || null,
        final_version: params.finalVersion || null,
        teaching_skill: params.teachingSkill || null,
        teaching_note: params.teachingNote || null,
        status: 'draft',
        helm_conversation_id: params.helmConversationId || null,
      })
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
      return null;
    }

    const msg = data as HigginsMessage;
    setDrafts(prev => [msg, ...prev]);
    return msg;
  }, [userId, personId]);

  const markSent = useCallback(async (id: string): Promise<void> => {
    if (!userId) return;
    const { error: updateErr } = await supabase
      .from('higgins_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, [userId]);

  const deleteDraft = useCallback(async (id: string): Promise<void> => {
    if (!userId) return;
    const { error: deleteErr } = await supabase
      .from('higgins_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, [userId]);

  const getSkillDistribution = useCallback(async (): Promise<Record<HigginsTeachingSkill, number>> => {
    if (!userId) return {} as Record<HigginsTeachingSkill, number>;
    const { data } = await supabase
      .from('higgins_messages')
      .select('teaching_skill')
      .eq('user_id', userId)
      .not('teaching_skill', 'is', null);

    const distribution: Record<string, number> = {
      naming_emotion: 0, perspective_shift: 0, validation_first: 0,
      behavior_vs_identity: 0, invitation: 0, repair: 0, boundaries_with_love: 0,
    };

    for (const row of data || []) {
      if (row.teaching_skill) {
        distribution[row.teaching_skill] = (distribution[row.teaching_skill] || 0) + 1;
      }
    }

    return distribution as Record<HigginsTeachingSkill, number>;
  }, [userId]);

  const getMessageCount = useCallback(async (): Promise<number> => {
    if (!userId || !personId) return 0;
    const { count } = await supabase
      .from('higgins_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('people_id', personId);

    return count || 0;
  }, [userId, personId]);

  return {
    drafts,
    loading,
    error,
    fetchDrafts,
    saveDraft,
    markSent,
    deleteDraft,
    getSkillDistribution,
    getMessageCount,
  };
}
