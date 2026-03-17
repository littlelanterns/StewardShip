import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { type AIFramework, AI_FRAMEWORK_PRINCIPLE_COLUMNS } from '../lib/types';

export interface FrameworkExtractionResult {
  framework_name: string;
  principles: Array<{ text: string; sort_order: number }>;
}

export interface MastExtractionResult {
  text: string;
  entry_type: string;
}

export interface SectionInfo {
  title: string;
  start_char: number;
  end_char: number;
  description: string;
}

export function useFrameworks() {
  const { user } = useAuthContext();
  const [frameworks, setFrameworks] = useState<AIFramework[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFrameworks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('ai_frameworks')
        .select(`*, ai_framework_principles(${AI_FRAMEWORK_PRINCIPLE_COLUMNS})`)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('name');

      if (fetchErr) throw fetchErr;

      // Map Supabase join name to our type property name, filter out soft-deleted principles
      const mapped = (data || []).map((fw: any) => ({
        ...fw,
        principles: (fw.ai_framework_principles || []).filter((p: any) => !p.is_deleted),
      }));
      setFrameworks(mapped as AIFramework[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Extract framework principles from a manifest item
  const extractFramework = useCallback(async (
    itemId: string,
  ): Promise<FrameworkExtractionResult | null> => {
    if (!user) return null;
    setExtracting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: itemId, extraction_type: 'framework', user_id: user.id },
      });
      if (invokeErr || !data?.result) {
        setError(invokeErr?.message || 'Framework extraction failed');
        return null;
      }
      return data.result as FrameworkExtractionResult;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setExtracting(false);
    }
  }, [user]);

  // Extract Mast entries from a manifest item
  const extractMast = useCallback(async (
    itemId: string,
  ): Promise<MastExtractionResult[] | null> => {
    if (!user) return null;
    setExtracting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: itemId, extraction_type: 'mast', user_id: user.id },
      });
      if (invokeErr || !data?.result) {
        setError(invokeErr?.message || 'Mast extraction failed');
        return null;
      }
      return data.result as MastExtractionResult[];
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setExtracting(false);
    }
  }, [user]);

  // Generate topic tags for a framework via AI
  const tagFramework = useCallback(async (
    frameworkId: string,
    frameworkName: string,
    principles: string[],
  ): Promise<void> => {
    if (!user) return;
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-tag-framework', {
        body: {
          framework_id: frameworkId,
          framework_name: frameworkName,
          principles: principles.slice(0, 20),
          user_id: user.id,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.tags) {
        setFrameworks((prev) =>
          prev.map((fw) =>
            fw.id === frameworkId ? { ...fw, tags: data.tags } : fw
          )
        );
      }
    } catch (err) {
      console.error('tagFramework failed (non-fatal):', err);
    }
  }, [user]);

  // Save framework + principles to database
  const saveFramework = useCallback(async (
    manifestItemId: string,
    name: string,
    principles: Array<{ text: string; sort_order: number; is_user_added?: boolean; is_included?: boolean; section_title?: string }>,
    isActive: boolean,
    append?: boolean,
  ): Promise<AIFramework | null> => {
    if (!user) return null;
    setError(null);

    try {
      // Check if framework already exists for this item
      const { data: existing } = await supabase
        .from('ai_frameworks')
        .select('id')
        .eq('manifest_item_id', manifestItemId)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .maybeSingle();

      let frameworkId: string;

      if (existing) {
        await supabase
          .from('ai_frameworks')
          .update({ name, is_active: isActive })
          .eq('id', existing.id);
        frameworkId = existing.id;

        // In append mode, keep existing principles (used by per-section extraction)
        if (!append) {
          // Soft delete existing principles so they can be recovered
          await supabase
            .from('ai_framework_principles')
            .update({ is_deleted: true })
            .eq('framework_id', frameworkId)
            .eq('user_id', user.id);
        }
      } else {
        const { data: fw, error: insertErr } = await supabase
          .from('ai_frameworks')
          .insert({ user_id: user.id, manifest_item_id: manifestItemId, name, is_active: isActive })
          .select()
          .single();
        if (insertErr || !fw) {
          setError(insertErr?.message || 'Failed to create framework');
          return null;
        }
        frameworkId = fw.id;
      }

      // Insert all principles
      const principleRecords = principles.map((p) => ({
        user_id: user.id,
        framework_id: frameworkId,
        text: p.text,
        sort_order: p.sort_order,
        is_user_added: p.is_user_added || false,
        is_included: p.is_included ?? true,
        section_title: p.section_title || null,
      }));

      await supabase.from('ai_framework_principles').insert(principleRecords);

      // Fetch the full framework with principles
      const { data: result } = await supabase
        .from('ai_frameworks')
        .select(`*, ai_framework_principles(${AI_FRAMEWORK_PRINCIPLE_COLUMNS})`)
        .eq('id', frameworkId)
        .single();

      if (result) {
        // Map Supabase join name to our type property name
        const framework = {
          ...result,
          principles: (result as any).ai_framework_principles || [],
        } as AIFramework;
        setFrameworks((prev) => {
          const idx = prev.findIndex((f) => f.id === frameworkId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = framework;
            return updated;
          }
          return [...prev, framework];
        });

        // Auto-tag after save — fire-and-forget, non-blocking
        tagFramework(
          frameworkId,
          name,
          principles.filter((p) => p.is_included !== false).slice(0, 20).map((p) => p.text),
        ).catch((err) => console.error('Auto-tagging after save failed:', err));

        return framework;
      }
      return null;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user, tagFramework]);

  // Toggle framework active/inactive
  const toggleFramework = useCallback(async (frameworkId: string, isActive: boolean) => {
    if (!user) return;
    setError(null);

    const { error: updateErr } = await supabase
      .from('ai_frameworks')
      .update({ is_active: isActive })
      .eq('id', frameworkId)
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setFrameworks((prev) =>
      prev.map((f) => (f.id === frameworkId ? { ...f, is_active: isActive } : f)),
    );
  }, [user]);

  // Batch toggle multiple frameworks active/inactive
  const batchToggleFrameworks = useCallback(async (
    changes: Array<{ frameworkId: string; isActive: boolean }>,
  ) => {
    if (!user || changes.length === 0) return;
    setError(null);

    for (const { frameworkId, isActive } of changes) {
      const { error: updateErr } = await supabase
        .from('ai_frameworks')
        .update({ is_active: isActive })
        .eq('id', frameworkId)
        .eq('user_id', user.id);

      if (updateErr) {
        setError(updateErr.message);
        return;
      }
    }

    setFrameworks((prev) =>
      prev.map((fw) => {
        const change = changes.find((c) => c.frameworkId === fw.id);
        return change ? { ...fw, is_active: change.isActive } : fw;
      }),
    );
  }, [user]);

  // Archive a framework
  const archiveFramework = useCallback(async (frameworkId: string) => {
    if (!user) return;

    const { error: archiveErr } = await supabase
      .from('ai_frameworks')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', frameworkId)
      .eq('user_id', user.id);

    if (archiveErr) {
      setError(archiveErr.message);
      return;
    }

    setFrameworks((prev) => prev.filter((f) => f.id !== frameworkId));
  }, [user]);

  // Check if document needs section-based extraction (>25K chars)
  const checkDocumentLength = useCallback(async (manifestItemId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('manifest_items')
      .select('text_content')
      .eq('id', manifestItemId)
      .single();

    return (data?.text_content?.length || 0) > 25000;
  }, []);

  // Discover sections in a long document
  const discoverSections = useCallback(async (
    manifestItemId: string,
  ): Promise<{ sections: SectionInfo[]; total_chars: number } | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: manifestItemId, extraction_type: 'discover_sections' },
      });
      if (invokeErr || data?.error) {
        console.error('Section discovery failed:', invokeErr || data?.error);
        setError(invokeErr?.message || data?.error || 'Section discovery failed');
        return null;
      }
      return { sections: data.sections, total_chars: data.total_chars };
    } catch (err) {
      console.error('Section discovery failed:', err);
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  // Extract from a specific section
  const extractFromSection = useCallback(async (
    manifestItemId: string,
    sectionStart: number,
    sectionEnd: number,
    sectionTitle: string,
  ): Promise<FrameworkExtractionResult | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: {
          manifest_item_id: manifestItemId,
          extraction_type: 'framework_section',
          section_start: sectionStart,
          section_end: sectionEnd,
          section_title: sectionTitle,
        },
      });
      if (invokeErr || data?.error) {
        console.error('Section extraction failed:', invokeErr || data?.error);
        return null;
      }
      return data?.result as FrameworkExtractionResult;
    } catch (err) {
      console.error('Section extraction failed:', err);
      return null;
    }
  }, [user]);

  // Get framework by manifest item ID
  const getFrameworkForItem = useCallback((manifestItemId: string): AIFramework | undefined => {
    return frameworks.find((f) => f.manifest_item_id === manifestItemId);
  }, [frameworks]);

  // Update tags directly (user editing)
  const updateFrameworkTags = useCallback(async (
    frameworkId: string,
    tags: string[],
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error: updateErr } = await supabase
        .from('ai_frameworks')
        .update({ tags })
        .eq('id', frameworkId)
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;
      setFrameworks((prev) =>
        prev.map((fw) => fw.id === frameworkId ? { ...fw, tags } : fw)
      );
      return true;
    } catch (err) {
      console.error('updateFrameworkTags failed:', err);
      return false;
    }
  }, [user]);

  return {
    frameworks,
    loading,
    extracting,
    error,
    fetchFrameworks,
    extractFramework,
    extractMast,
    saveFramework,
    toggleFramework,
    batchToggleFrameworks,
    archiveFramework,
    getFrameworkForItem,
    checkDocumentLength,
    discoverSections,
    extractFromSection,
    tagFramework,
    updateFrameworkTags,
  };
}
