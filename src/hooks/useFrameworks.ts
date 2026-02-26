import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { AIFramework } from '../lib/types';

export interface FrameworkExtractionResult {
  framework_name: string;
  principles: Array<{ text: string; sort_order: number }>;
}

export interface MastExtractionResult {
  text: string;
  entry_type: string;
}

export interface KeelExtractionResult {
  category: string;
  text: string;
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
        .select('*, ai_framework_principles(*)')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('name');

      if (fetchErr) throw fetchErr;
      setFrameworks((data as AIFramework[]) || []);
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

  // Extract Keel entries from a manifest item
  const extractKeel = useCallback(async (
    itemId: string,
  ): Promise<KeelExtractionResult[] | null> => {
    if (!user) return null;
    setExtracting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: itemId, extraction_type: 'keel', user_id: user.id },
      });
      if (invokeErr || !data?.result) {
        setError(invokeErr?.message || 'Keel extraction failed');
        return null;
      }
      return data.result as KeelExtractionResult[];
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setExtracting(false);
    }
  }, [user]);

  // Save framework + principles to database
  const saveFramework = useCallback(async (
    manifestItemId: string,
    name: string,
    principles: Array<{ text: string; sort_order: number; is_user_added?: boolean }>,
    isActive: boolean,
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

        // Delete AI-extracted principles (keep user-added ones)
        await supabase
          .from('ai_framework_principles')
          .delete()
          .eq('framework_id', frameworkId);
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
      }));

      await supabase.from('ai_framework_principles').insert(principleRecords);

      // Fetch the full framework with principles
      const { data: result } = await supabase
        .from('ai_frameworks')
        .select('*, ai_framework_principles(*)')
        .eq('id', frameworkId)
        .single();

      if (result) {
        const framework = result as AIFramework;
        setFrameworks((prev) => {
          const idx = prev.findIndex((f) => f.id === frameworkId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = framework;
            return updated;
          }
          return [...prev, framework];
        });
        return framework;
      }
      return null;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

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

  // Get framework by manifest item ID
  const getFrameworkForItem = useCallback((manifestItemId: string): AIFramework | undefined => {
    return frameworks.find((f) => f.manifest_item_id === manifestItemId);
  }, [frameworks]);

  return {
    frameworks,
    loading,
    extracting,
    error,
    fetchFrameworks,
    extractFramework,
    extractMast,
    extractKeel,
    saveFramework,
    toggleFramework,
    archiveFramework,
    getFrameworkForItem,
  };
}
