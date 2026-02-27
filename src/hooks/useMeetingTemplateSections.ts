import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { getBuiltInSections } from '../lib/meetingAgendas';
import type { MeetingTemplateSection } from '../lib/types';

export function useMeetingTemplateSections() {
  const { user } = useAuthContext();
  const [sections, setSections] = useState<MeetingTemplateSection[]>([]);
  const [archivedSections, setArchivedSections] = useState<MeetingTemplateSection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSections = useCallback(async (meetingType: string, templateId?: string) => {
    if (!user) return [];
    setLoading(true);
    try {
      // Fetch active sections
      let query = supabase
        .from('meeting_template_sections')
        .select('*')
        .eq('user_id', user.id)
        .eq('meeting_type', meetingType)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });

      if (templateId) {
        query = query.eq('template_id', templateId);
      } else {
        query = query.is('template_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      let activeSections = (data || []) as MeetingTemplateSection[];

      // Auto-seed defaults if no sections exist
      if (activeSections.length === 0) {
        activeSections = await seedDefaults(meetingType, templateId);
      }

      setSections(activeSections);

      // Also fetch archived sections
      let archivedQuery = supabase
        .from('meeting_template_sections')
        .select('*')
        .eq('user_id', user.id)
        .eq('meeting_type', meetingType)
        .not('archived_at', 'is', null)
        .order('sort_order', { ascending: true });

      if (templateId) {
        archivedQuery = archivedQuery.eq('template_id', templateId);
      } else {
        archivedQuery = archivedQuery.is('template_id', null);
      }

      const { data: archivedData } = await archivedQuery;
      setArchivedSections((archivedData || []) as MeetingTemplateSection[]);

      return activeSections;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const seedDefaults = useCallback(async (meetingType: string, templateId?: string): Promise<MeetingTemplateSection[]> => {
    if (!user) return [];

    // For custom meetings, seed from the template's JSONB agenda_sections
    if (meetingType === 'custom' && templateId) {
      const { data: template } = await supabase
        .from('meeting_templates')
        .select('agenda_sections')
        .eq('id', templateId)
        .single();

      if (template?.agenda_sections) {
        const jsonSections = template.agenda_sections as Array<{ title: string; ai_prompt_text: string; sort_order: number }>;
        const rows = jsonSections.map((s, i) => ({
          user_id: user.id,
          meeting_type: meetingType,
          template_id: templateId,
          title: s.title,
          ai_prompt_text: s.ai_prompt_text || '',
          sort_order: i,
          is_default: false,
          default_key: null,
        }));

        const { data: inserted } = await supabase
          .from('meeting_template_sections')
          .insert(rows)
          .select();

        return (inserted || []) as MeetingTemplateSection[];
      }
      return [];
    }

    // For built-in types, seed from BUILT_IN_AGENDAS
    const builtIn = getBuiltInSections(meetingType);
    if (builtIn.length === 0) return [];

    const rows = builtIn.map((s, i) => ({
      user_id: user.id,
      meeting_type: meetingType,
      template_id: null,
      title: s.title,
      ai_prompt_text: s.ai_prompt_text,
      sort_order: i,
      is_default: true,
      default_key: s.default_key,
    }));

    // Upsert to handle race conditions (partial unique index on default_key)
    const { data: inserted } = await supabase
      .from('meeting_template_sections')
      .upsert(rows, { onConflict: 'user_id,meeting_type,default_key', ignoreDuplicates: true })
      .select();

    return (inserted || []) as MeetingTemplateSection[];
  }, [user]);

  const addSection = useCallback(async (
    meetingType: string,
    title: string,
    aiPromptText?: string,
    templateId?: string,
  ) => {
    if (!user) return null;

    const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from('meeting_template_sections')
      .insert({
        user_id: user.id,
        meeting_type: meetingType,
        template_id: templateId || null,
        title,
        ai_prompt_text: aiPromptText || '',
        sort_order: maxOrder,
        is_default: false,
        default_key: null,
      })
      .select()
      .single();

    if (error || !data) return null;
    const newSection = data as MeetingTemplateSection;
    setSections(prev => [...prev, newSection]);
    return newSection;
  }, [user, sections]);

  const updateSection = useCallback(async (
    id: string,
    updates: { title?: string; ai_prompt_text?: string },
  ) => {
    if (!user) return;

    // Optimistic update
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    const { error } = await supabase
      .from('meeting_template_sections')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      // Revert on failure
      await fetchSections(sections[0]?.meeting_type || '', sections[0]?.template_id || undefined);
    }
  }, [user, sections, fetchSections]);

  const archiveSection = useCallback(async (id: string) => {
    if (!user) return;

    const section = sections.find(s => s.id === id);
    if (!section) return;

    setSections(prev => prev.filter(s => s.id !== id));
    setArchivedSections(prev => [...prev, { ...section, archived_at: new Date().toISOString() }]);

    await supabase
      .from('meeting_template_sections')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user, sections]);

  const deleteSection = useCallback(async (id: string) => {
    if (!user) return;

    const section = sections.find(s => s.id === id) || archivedSections.find(s => s.id === id);
    // Guard: never hard-delete default sections
    if (section?.is_default) {
      await archiveSection(id);
      return;
    }

    setSections(prev => prev.filter(s => s.id !== id));
    setArchivedSections(prev => prev.filter(s => s.id !== id));

    await supabase
      .from('meeting_template_sections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user, sections, archivedSections, archiveSection]);

  const restoreSection = useCallback(async (id: string) => {
    if (!user) return;

    const section = archivedSections.find(s => s.id === id);
    if (!section) return;

    setArchivedSections(prev => prev.filter(s => s.id !== id));
    const restored = { ...section, archived_at: null };
    setSections(prev => [...prev, restored].sort((a, b) => a.sort_order - b.sort_order));

    await supabase
      .from('meeting_template_sections')
      .update({ archived_at: null })
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user, archivedSections]);

  const restoreAllDefaults = useCallback(async (meetingType: string, templateId?: string) => {
    if (!user) return;

    // Restore all archived default sections
    let query = supabase
      .from('meeting_template_sections')
      .update({ archived_at: null })
      .eq('user_id', user.id)
      .eq('meeting_type', meetingType)
      .eq('is_default', true)
      .not('archived_at', 'is', null);

    if (templateId) {
      query = query.eq('template_id', templateId);
    } else {
      query = query.is('template_id', null);
    }

    await query;

    // Re-fetch to get updated state
    await fetchSections(meetingType, templateId);
  }, [user, fetchSections]);

  const reorderSections = useCallback(async (orderedIds: string[]) => {
    if (!user) return;

    // Optimistic reorder
    const reordered = orderedIds.map((id, i) => {
      const section = sections.find(s => s.id === id);
      return section ? { ...section, sort_order: i } : null;
    }).filter(Boolean) as MeetingTemplateSection[];

    setSections(reordered);

    // Batch update sort_order
    const updates = orderedIds.map((id, i) =>
      supabase
        .from('meeting_template_sections')
        .update({ sort_order: i })
        .eq('id', id)
        .eq('user_id', user.id)
    );

    await Promise.all(updates);
  }, [user, sections]);

  return {
    sections,
    archivedSections,
    loading,
    fetchSections,
    addSection,
    updateSection,
    archiveSection,
    deleteSection,
    restoreSection,
    restoreAllDefaults,
    reorderSections,
  };
}
