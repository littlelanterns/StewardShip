import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  Person,
  SpouseInsight,
  SpouseInsightCategory,
  SpouseInsightSourceType,
  SpousePrompt,
  SpousePromptType,
  SpousePromptStatus,
  ImportantDate,
  RelationshipType,
} from '../lib/types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS } from '../lib/types';

export function useFirstMate() {
  const { user } = useAuthContext();
  const [spouse, setSpouse] = useState<Person | null>(null);
  const [insights, setInsights] = useState<SpouseInsight[]>([]);
  const [prompts, setPrompts] = useState<SpousePrompt[]>([]);
  const [activePrompt, setActivePrompt] = useState<SpousePrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpouse = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('people')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_first_mate', true)
        .is('archived_at', null)
        .maybeSingle();

      if (err) throw err;
      setSpouse(data as Person | null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createSpouse = useCallback(async (data: {
    name: string;
    relationship_type?: RelationshipType;
    age?: number;
    personality_summary?: string;
    love_language?: string;
    important_dates?: ImportantDate[];
  }): Promise<Person | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('people')
        .insert({
          user_id: user.id,
          name: data.name,
          relationship_type: data.relationship_type || 'spouse',
          is_first_mate: true,
          categories: ['immediate_family'],
          age: data.age || null,
          personality_summary: data.personality_summary || null,
          love_language: data.love_language || null,
          important_dates: data.important_dates || null,
          has_rich_context: true,
        })
        .select()
        .single();

      if (err) throw err;
      const person = result as Person;
      setSpouse(person);
      return person;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const updateSpouse = useCallback(async (updates: Partial<Pick<Person, 'name' | 'age' | 'personality_summary' | 'love_language' | 'important_dates' | 'notes'>>) => {
    if (!user || !spouse) return;
    setError(null);
    // Optimistic update
    setSpouse((prev) => prev ? { ...prev, ...updates } : prev);
    try {
      const { error: err } = await supabase
        .from('people')
        .update(updates)
        .eq('id', spouse.id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      // Revert on failure
      fetchSpouse();
    }
  }, [user, spouse, fetchSpouse]);

  const fetchInsights = useCallback(async (category?: SpouseInsightCategory) => {
    if (!user || !spouse) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('spouse_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('person_id', spouse.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setInsights((data as SpouseInsight[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, spouse]);

  const createInsight = useCallback(async (data: {
    text: string;
    category: SpouseInsightCategory;
    source_type?: SpouseInsightSourceType;
    source_label?: string;
    source_reference_id?: string;
  }): Promise<SpouseInsight | null> => {
    if (!user || !spouse) return null;
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('spouse_insights')
        .insert({
          user_id: user.id,
          person_id: spouse.id,
          category: data.category,
          text: data.text,
          source_type: data.source_type || 'manual',
          source_label: data.source_label || null,
          source_reference_id: data.source_reference_id || null,
          is_rag_indexed: false,
        })
        .select()
        .single();

      if (err) throw err;
      const insight = result as SpouseInsight;
      setInsights((prev) => [insight, ...prev]);
      return insight;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, spouse]);

  const updateInsight = useCallback(async (id: string, updates: { text?: string; category?: SpouseInsightCategory }) => {
    if (!user) return;
    setError(null);
    // Optimistic update
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    try {
      const { error: err } = await supabase
        .from('spouse_insights')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchInsights();
    }
  }, [user, fetchInsights]);

  const archiveInsight = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    setInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      const { error: err } = await supabase
        .from('spouse_insights')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      fetchInsights();
    }
  }, [user, fetchInsights]);

  const fetchPrompts = useCallback(async (limit = 20) => {
    if (!user || !spouse) return;
    try {
      const { data, error: err } = await supabase
        .from('spouse_prompts')
        .select('*')
        .eq('user_id', user.id)
        .eq('person_id', spouse.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (err) throw err;
      setPrompts((data as SpousePrompt[]) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, spouse]);

  const fetchActivePrompt = useCallback(async () => {
    if (!user || !spouse) return;
    try {
      const { data, error: err } = await supabase
        .from('spouse_prompts')
        .select('*')
        .eq('user_id', user.id)
        .eq('person_id', spouse.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;
      setActivePrompt(data as SpousePrompt | null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, spouse]);

  const formatInsightsForPrompt = (insightsList: SpouseInsight[]): string => {
    const byCategory: Record<string, string[]> = {};

    insightsList.forEach((insight) => {
      const label = (SPOUSE_INSIGHT_CATEGORY_LABELS as Record<string, string>)[insight.category] || 'General';
      if (!byCategory[label]) {
        byCategory[label] = [];
      }
      // Truncate to ~150 chars per insight for prompt context
      const truncated = insight.text.length > 150
        ? insight.text.substring(0, 150) + '...'
        : insight.text;
      byCategory[label].push(truncated);
    });

    let formatted = '';
    Object.entries(byCategory).forEach(([category, texts]) => {
      formatted += `\n${category}:\n`;
      texts.forEach((text) => {
        formatted += `- ${text}\n`;
      });
    });

    return formatted || 'No insights recorded yet.';
  };

  const generatePrompt = useCallback(async (promptType: SpousePromptType): Promise<SpousePrompt | null> => {
    if (!user || !spouse) return null;
    setError(null);
    try {
      const typeLabel = promptType === 'ask_them'
        ? 'ask them'
        : promptType === 'reflect'
        ? 'reflect'
        : 'express';

      const systemMessage = `Generate a single ${typeLabel} prompt for the user about their spouse, ${spouse.name}.

${formatInsightsForPrompt(insights)}

Rules:
- Be specific and personal based on what you know. No generic prompts. No emoji.
- For ask_them: A question to ask them in person. Should reveal something meaningful.
- For reflect: Something to reflect on about their relationship or their spouse.
- For express: Generate a specific action IDEA, not scripted words. Give the user a direction — what to express and a nudge toward sincerity — but leave the actual words to him. Good examples: "Text her a memory from when you were first dating that still makes you smile." / "Tonight, tell her how her presence specifically improves one situation in your daily life." / "Think of something she does for the family that nobody ever thanks her for. Thank her for that one thing — out loud, not just in your head." Bad examples (DO NOT generate): "Text her: 'You're the best thing that ever happened to me.'" (scripted) / "Tell her she looks beautiful today." (generic). End express prompts with: "Need help putting it into words? Try Cyrano Me in your Marriage Toolbox."
- Respond with ONLY the prompt text, nothing else. Keep it to 2-4 sentences (including the Cyrano handoff for express).`;

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('helm-chat', {
        body: {
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: `Generate a ${typeLabel} prompt.` },
          ],
          model: 'anthropic/claude-sonnet',
        },
      });

      if (aiError) throw aiError;

      const promptText = aiResponse.message?.content || aiResponse.content || '';
      if (!promptText) throw new Error('No prompt text generated');

      const { data: result, error: err } = await supabase
        .from('spouse_prompts')
        .insert({
          user_id: user.id,
          person_id: spouse.id,
          prompt_type: promptType,
          prompt_text: promptText.trim(),
          status: 'pending',
          response_saved_as_insight: false,
          generation_context: formatInsightsForPrompt(insights).substring(0, 500),
        })
        .select()
        .single();

      if (err) throw err;
      const prompt = result as SpousePrompt;
      setActivePrompt(prompt);
      setPrompts((prev) => [prompt, ...prev]);
      return prompt;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, spouse, insights]);

  const respondToPrompt = useCallback(async (
    id: string,
    response: {
      response_text: string;
      saveAsInsight: boolean;
      insightCategory?: SpouseInsightCategory;
    }
  ) => {
    if (!user) return;
    setError(null);
    try {
      let insightId: string | null = null;

      // Save as insight if requested
      if (response.saveAsInsight && response.insightCategory) {
        const insight = await createInsight({
          text: response.response_text,
          category: response.insightCategory,
          source_type: 'spouse_prompt',
          source_reference_id: id,
        });
        if (insight) {
          insightId = insight.id;
        }
      }

      // Update the prompt
      const { error: err } = await supabase
        .from('spouse_prompts')
        .update({
          status: 'acted_on' as SpousePromptStatus,
          response_text: response.response_text,
          response_saved_as_insight: response.saveAsInsight,
          insight_id: insightId,
          acted_on_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;

      // Refresh state
      await fetchPrompts();
      await fetchActivePrompt();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, createInsight, fetchPrompts, fetchActivePrompt]);

  const skipPrompt = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('spouse_prompts')
        .update({ status: 'skipped' as SpousePromptStatus })
        .eq('id', id)
        .eq('user_id', user.id);

      if (err) throw err;

      await fetchActivePrompt();
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'skipped' as SpousePromptStatus } : p)));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, fetchActivePrompt]);

  const saveGratitude = useCallback(async (text: string): Promise<{ logEntryId: string; insightId: string } | null> => {
    if (!user || !spouse) return null;
    setError(null);
    try {
      // Save to log_entries
      const { data: logEntry, error: logError } = await supabase
        .from('log_entries')
        .insert({
          user_id: user.id,
          text,
          entry_type: 'gratitude',
          life_area_tags: ['marriage'],
          source: 'manual_text',
        })
        .select()
        .single();

      if (logError) throw logError;

      // Save to spouse_insights
      const { data: insight, error: insightError } = await supabase
        .from('spouse_insights')
        .insert({
          user_id: user.id,
          person_id: spouse.id,
          category: 'gratitude',
          text,
          source_type: 'manual',
          is_rag_indexed: false,
        })
        .select()
        .single();

      if (insightError) throw insightError;

      // Update local state
      setInsights((prev) => [insight as SpouseInsight, ...prev]);

      return {
        logEntryId: logEntry.id,
        insightId: insight.id,
      };
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, spouse]);

  return {
    spouse,
    insights,
    prompts,
    activePrompt,
    loading,
    error,
    fetchSpouse,
    createSpouse,
    updateSpouse,
    fetchInsights,
    createInsight,
    updateInsight,
    archiveInsight,
    fetchPrompts,
    fetchActivePrompt,
    generatePrompt,
    respondToPrompt,
    skipPrompt,
    saveGratitude,
  };
}
