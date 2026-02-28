import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { ReflectionQuestion, ReflectionResponse } from '../lib/types';

const DEFAULT_QUESTIONS: string[] = [
  'What am I grateful for today?',
  'What obstacle did I face today, and what did I do to overcome it?',
  'What was a moment that made me appreciate another family member?',
  'How did I move toward my divine identity or life purpose today?',
  'What was a moment that inspired awe, wonder, or joy?',
  'What did I love about today?',
  'What was something interesting I learned or discovered?',
  'What goal did I make progress on?',
  'How well did I attend to my duties today?',
  'How did I serve today?',
  'What would my future self thank me for today?',
  'What made me laugh today?',
  'Where did I fall short today, and what would I do differently?',
];

export function useReflections() {
  const { user } = useAuthContext();
  const [questions, setQuestions] = useState<ReflectionQuestion[]>([]);
  const [todaysResponses, setTodaysResponses] = useState<ReflectionResponse[]>([]);
  const [pastResponses, setPastResponses] = useState<ReflectionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTodayDate = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const seedDefaultQuestions = useCallback(async (): Promise<ReflectionQuestion[]> => {
    if (!user) return [];
    try {
      const rows = DEFAULT_QUESTIONS.map((q, i) => ({
        user_id: user.id,
        question_text: q,
        is_default: true,
        is_ai_suggested: false,
        sort_order: i,
      }));

      const { data, error: err } = await supabase
        .from('reflection_questions')
        .insert(rows)
        .select();

      if (err) throw err;
      return (data as ReflectionQuestion[]) || [];
    } catch (e) {
      console.error('Failed to seed default questions:', e);
      return [];
    }
  }, [user]);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('reflection_questions')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });

      if (err) throw err;

      let result = (data as ReflectionQuestion[]) || [];
      if (result.length === 0) {
        result = await seedDefaultQuestions();
      }
      setQuestions(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load questions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, seedDefaultQuestions]);

  const addQuestion = useCallback(async (text: string): Promise<ReflectionQuestion | null> => {
    if (!user) return null;
    setError(null);
    try {
      const maxSort = questions.reduce((max, q) => Math.max(max, q.sort_order), -1);
      const { data, error: err } = await supabase
        .from('reflection_questions')
        .insert({
          user_id: user.id,
          question_text: text,
          is_default: false,
          is_ai_suggested: false,
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (err) throw err;
      const q = data as ReflectionQuestion;
      setQuestions((prev) => [...prev, q]);
      return q;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add question';
      setError(msg);
      return null;
    }
  }, [user, questions]);

  const updateQuestion = useCallback(async (id: string, updates: Partial<ReflectionQuestion>): Promise<void> => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('reflection_questions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update question';
      setError(msg);
    }
  }, [user]);

  const archiveQuestion = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('reflection_questions')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e: unknown) {
      console.error('Failed to archive question:', e);
    }
  }, [user]);

  const deleteQuestion = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    // Default questions can only be archived, not deleted
    const question = questions.find((q) => q.id === id);
    if (question?.is_default) {
      return archiveQuestion(id);
    }
    try {
      const { error: err } = await supabase
        .from('reflection_questions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e: unknown) {
      console.error('Failed to delete question:', e);
    }
  }, [user, questions, archiveQuestion]);

  const restoreQuestion = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('reflection_questions')
        .update({ archived_at: null })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      // Refresh questions list
      fetchQuestions();
    } catch (e: unknown) {
      console.error('Failed to restore question:', e);
    }
  }, [user, fetchQuestions]);

  const fetchTodaysResponses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = getTodayDate();
      const { data, error: err } = await supabase
        .from('reflection_responses')
        .select('*')
        .eq('user_id', user.id)
        .eq('response_date', today)
        .order('created_at', { ascending: true });

      if (err) throw err;
      setTodaysResponses((data as ReflectionResponse[]) || []);
    } catch (e: unknown) {
      console.error('Failed to fetch today responses:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPastResponses = useCallback(async (limit = 50, offset = 0) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('reflection_responses')
        .select('*, reflection_questions(question_text)')
        .eq('user_id', user.id)
        .order('response_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (err) throw err;
      const results = ((data || []) as (ReflectionResponse & { reflection_questions?: { question_text: string } })[]).map((r) => ({
        ...r,
        question_text: r.reflection_questions?.question_text || '',
      }));

      if (offset === 0) {
        setPastResponses(results);
      } else {
        setPastResponses((prev) => [...prev, ...results]);
      }
    } catch (e: unknown) {
      console.error('Failed to fetch past responses:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveResponse = useCallback(async (
    questionId: string,
    text: string,
  ): Promise<ReflectionResponse | null> => {
    if (!user) return null;
    setError(null);
    try {
      const today = getTodayDate();
      const { data, error: err } = await supabase
        .from('reflection_responses')
        .insert({
          user_id: user.id,
          question_id: questionId,
          response_text: text,
          response_date: today,
        })
        .select()
        .single();

      if (err) throw err;
      const response = data as ReflectionResponse;
      setTodaysResponses((prev) => [...prev, response]);
      return response;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save response';
      setError(msg);
      return null;
    }
  }, [user]);

  const updateResponse = useCallback(async (id: string, text: string): Promise<void> => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('reflection_responses')
        .update({ response_text: text })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
      setTodaysResponses((prev) =>
        prev.map((r) => (r.id === id ? { ...r, response_text: text } : r)),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update response';
      setError(msg);
    }
  }, [user]);

  const routeToJournal = useCallback(async (
    responseId: string,
    responseText: string,
    questionText: string,
  ): Promise<string | null> => {
    if (!user) return null;
    try {
      // Create journal entry
      const { data: journalEntry, error: journalErr } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          text: `${questionText}\n\n${responseText}`,
          entry_type: 'reflection',
          source: 'manual_text',
          life_area_tags: [],
          routed_to: [],
          routed_reference_ids: {},
        })
        .select()
        .single();

      if (journalErr) throw journalErr;

      // Update response with journal link
      const { error: updateErr } = await supabase
        .from('reflection_responses')
        .update({
          routed_to_log: true,
          journal_entry_id: journalEntry.id,
        })
        .eq('id', responseId)
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      setTodaysResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, routed_to_log: true, journal_entry_id: journalEntry.id } : r)),
      );

      return journalEntry.id;
    } catch (e: unknown) {
      console.error('Failed to route to Journal:', e);
      return null;
    }
  }, [user]);

  const routeToVictory = useCallback(async (
    responseId: string,
    description: string,
  ): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: victory, error: vicErr } = await supabase
        .from('victories')
        .insert({
          user_id: user.id,
          description,
          source: 'manual',
        })
        .select()
        .single();

      if (vicErr) throw vicErr;

      const { error: updateErr } = await supabase
        .from('reflection_responses')
        .update({
          routed_to_victory: true,
          victory_id: victory.id,
        })
        .eq('id', responseId)
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      setTodaysResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, routed_to_victory: true, victory_id: victory.id } : r)),
      );

      return victory.id;
    } catch (e: unknown) {
      console.error('Failed to route to Victory:', e);
      return null;
    }
  }, [user]);

  const getReflectionSummary = useCallback(async (): Promise<{
    thisWeekCount: number;
    todayCount: number;
    lastResponseDate: string | null;
  }> => {
    if (!user) return { thisWeekCount: 0, todayCount: 0, lastResponseDate: null };
    try {
      const today = getTodayDate();

      // Calculate start of week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekStartDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

      const [todayResult, weekResult, lastResult] = await Promise.all([
        supabase
          .from('reflection_responses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('response_date', today),
        supabase
          .from('reflection_responses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('response_date', weekStartDate),
        supabase
          .from('reflection_responses')
          .select('response_date')
          .eq('user_id', user.id)
          .order('response_date', { ascending: false })
          .limit(1),
      ]);

      return {
        todayCount: todayResult.count || 0,
        thisWeekCount: weekResult.count || 0,
        lastResponseDate: lastResult.data?.[0]?.response_date || null,
      };
    } catch (e) {
      console.error('Failed to get reflection summary:', e);
      return { thisWeekCount: 0, todayCount: 0, lastResponseDate: null };
    }
  }, [user]);

  return {
    questions,
    todaysResponses,
    pastResponses,
    loading,
    error,
    fetchQuestions,
    addQuestion,
    updateQuestion,
    archiveQuestion,
    deleteQuestion,
    restoreQuestion,
    fetchTodaysResponses,
    fetchPastResponses,
    saveResponse,
    updateResponse,
    routeToJournal,
    routeToVictory,
    getReflectionSummary,
  };
}
