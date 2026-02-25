import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CyranoMessage, CyranoTeachingSkill } from '../lib/types';

export function useCyrano(userId: string | undefined, firstMateId: string | undefined) {
  const [drafts, setDrafts] = useState<CyranoMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('cyrano_messages')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['draft', 'saved_for_later'])
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setDrafts((data as CyranoMessage[]) || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId && firstMateId) {
      fetchDrafts();
    }
  }, [userId, firstMateId, fetchDrafts]);

  const saveDraft = useCallback(async (params: {
    rawInput: string;
    craftedVersion: string;
    finalVersion?: string;
    teachingSkill?: CyranoTeachingSkill;
    teachingNote?: string;
    helmConversationId?: string;
  }): Promise<CyranoMessage | null> => {
    if (!userId || !firstMateId) return null;

    const { data, error: insertErr } = await supabase
      .from('cyrano_messages')
      .insert({
        user_id: userId,
        people_id: firstMateId,
        raw_input: params.rawInput,
        crafted_version: params.craftedVersion,
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

    const msg = data as CyranoMessage;
    setDrafts(prev => [msg, ...prev]);
    return msg;
  }, [userId, firstMateId]);

  const markSent = useCallback(async (id: string): Promise<void> => {
    const { error: updateErr } = await supabase
      .from('cyrano_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId!);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, [userId]);

  const deleteDraft = useCallback(async (id: string): Promise<void> => {
    const { error: deleteErr } = await supabase
      .from('cyrano_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId!);

    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, [userId]);

  const getSkillDistribution = useCallback(async (): Promise<Record<CyranoTeachingSkill, number>> => {
    const { data } = await supabase
      .from('cyrano_messages')
      .select('teaching_skill')
      .eq('user_id', userId!)
      .not('teaching_skill', 'is', null);

    const distribution: Record<string, number> = {
      specificity: 0, her_lens: 0, feeling_over_function: 0,
      timing: 0, callback_power: 0, unsaid_need: 0, presence_proof: 0,
    };

    for (const row of data || []) {
      if (row.teaching_skill) {
        distribution[row.teaching_skill] = (distribution[row.teaching_skill] || 0) + 1;
      }
    }

    return distribution as Record<CyranoTeachingSkill, number>;
  }, [userId]);

  const getMessageCount = useCallback(async (): Promise<number> => {
    const { count } = await supabase
      .from('cyrano_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId!);

    return count || 0;
  }, [userId]);

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
