import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { JOURNAL_PROMPT_COLUMNS } from '../lib/types';
import type { JournalPrompt } from '../lib/types';

export function useJournalPrompts() {
  const { user } = useAuthContext();
  const [prompts, setPrompts] = useState<JournalPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all active (non-archived) prompts
  const fetchPrompts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('journal_prompts')
        .select(JOURNAL_PROMPT_COLUMNS)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setPrompts(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a manual prompt
  const createPrompt = useCallback(async (promptText: string, tags?: string[]): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error: insertErr } = await supabase
        .from('journal_prompts')
        .insert({
          user_id: user.id,
          prompt_text: promptText,
          source: 'manual',
          tags: tags || [],
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      await fetchPrompts();
      return data?.id || null;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, fetchPrompts]);

  // Update prompt text
  const updatePromptText = useCallback(async (promptId: string, promptText: string) => {
    if (!user) return;
    setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, prompt_text: promptText } : p));
    const { error: updateErr } = await supabase
      .from('journal_prompts')
      .update({ prompt_text: promptText })
      .eq('id', promptId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  // Update tags
  const updatePromptTags = useCallback(async (promptId: string, tags: string[]) => {
    if (!user) return;
    setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, tags } : p));
    const { error: updateErr } = await supabase
      .from('journal_prompts')
      .update({ tags })
      .eq('id', promptId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  // Archive a prompt (soft delete)
  const archivePrompt = useCallback(async (promptId: string) => {
    if (!user) return;
    setPrompts(prev => prev.filter(p => p.id !== promptId));
    const { error: updateErr } = await supabase
      .from('journal_prompts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', promptId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  // Get a random prompt
  const getRandomPrompt = useCallback((): JournalPrompt | null => {
    if (prompts.length === 0) return null;
    const idx = Math.floor(Math.random() * prompts.length);
    return prompts[idx];
  }, [prompts]);

  // Search prompts by keyword (client-side filter)
  const searchPrompts = useCallback((query: string): JournalPrompt[] => {
    if (!query.trim()) return prompts;
    const lower = query.toLowerCase();
    return prompts.filter(p =>
      p.prompt_text.toLowerCase().includes(lower) ||
      p.source_book_title?.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower))
    );
  }, [prompts]);

  // Get unique book titles from prompts
  const bookTitles = useCallback((): string[] => {
    const titles = new Set<string>();
    for (const p of prompts) {
      if (p.source_book_title) titles.add(p.source_book_title);
    }
    return Array.from(titles).sort();
  }, [prompts]);

  // Filter by book title
  const filterByBook = useCallback((bookTitle: string): JournalPrompt[] => {
    return prompts.filter(p => p.source_book_title === bookTitle);
  }, [prompts]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    prompts,
    loading,
    error,
    fetchPrompts,
    createPrompt,
    updatePromptText,
    updatePromptTags,
    archivePrompt,
    getRandomPrompt,
    searchPrompts,
    bookTitles,
    filterByBook,
  };
}
