import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  ManifestSummary,
  ManifestDeclaration,
  AIFrameworkPrinciple,
  BookGenre,
  ManifestExtractionStatus,
  DeclarationStyle,
} from '../lib/types';

// --- Extraction result shapes from the Edge Function ---

interface SummaryExtractionItem {
  content_type: string;
  text: string;
  sort_order: number;
}

interface DeclarationExtractionItem {
  value_name?: string;
  declaration_text: string;
  declaration_style: DeclarationStyle;
  sort_order: number;
}

interface FrameworkExtractionResult {
  framework_name: string;
  principles: Array<{ text: string; sort_order: number }>;
}

// --- Hook ---

export function useManifestExtraction() {
  const { user } = useAuthContext();
  const [summaries, setSummaries] = useState<ManifestSummary[]>([]);
  const [declarations, setDeclarations] = useState<ManifestDeclaration[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractingTab, setExtractingTab] = useState<'summary' | 'framework' | 'mast_content' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch existing extracted items for an item ---

  const fetchSummaries = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('manifest_summaries')
      .select('*')
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (fetchErr) {
      console.error('fetchSummaries error:', fetchErr);
      return;
    }
    setSummaries(data || []);
  }, [user]);

  const fetchDeclarations = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('manifest_declarations')
      .select('*')
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (fetchErr) {
      console.error('fetchDeclarations error:', fetchErr);
      return;
    }
    setDeclarations(data || []);
  }, [user]);

  // --- Update extraction status on manifest_items ---

  const updateExtractionStatus = useCallback(async (
    manifestItemId: string,
    status: ManifestExtractionStatus,
  ) => {
    if (!user) return;
    await supabase
      .from('manifest_items')
      .update({ extraction_status: status })
      .eq('id', manifestItemId)
      .eq('user_id', user.id);
  }, [user]);

  // --- Update genres on manifest_items ---

  const updateGenres = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
  ): Promise<boolean> => {
    if (!user) return false;
    const { error: updateErr } = await supabase
      .from('manifest_items')
      .update({ genres })
      .eq('id', manifestItemId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return false;
    }
    return true;
  }, [user]);

  // --- Core extraction: calls the Edge Function ---

  const callExtract = useCallback(async (
    manifestItemId: string,
    extractionType: string,
    genres: BookGenre[],
    options?: {
      sectionTitle?: string;
      sectionStart?: number;
      sectionEnd?: number;
      goDeeper?: boolean;
      existingItems?: string[];
    },
  ): Promise<unknown> => {
    const body: Record<string, unknown> = {
      manifest_item_id: manifestItemId,
      extraction_type: extractionType,
      genres,
    };
    if (options?.sectionTitle) body.section_title = options.sectionTitle;
    if (options?.sectionStart != null) body.section_start = options.sectionStart;
    if (options?.sectionEnd != null) body.section_end = options.sectionEnd;
    if (options?.goDeeper) {
      body.go_deeper = true;
      body.existing_items = options.existingItems || [];
    }

    const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', { body });

    if (invokeErr) {
      throw new Error(invokeErr.message || 'Extraction failed');
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return data?.result ?? data?.items ?? data;
  }, []);

  // --- Save summary extraction results to DB ---

  const saveSummaryResults = useCallback(async (
    manifestItemId: string,
    items: SummaryExtractionItem[],
    sectionTitle?: string,
    sectionIndex: number = 0,
    isFromGoDeeper: boolean = false,
  ) => {
    if (!user || items.length === 0) return;

    const records = items.map((item, idx) => ({
      user_id: user.id,
      manifest_item_id: manifestItemId,
      section_title: sectionTitle || null,
      section_index: sectionIndex,
      content_type: item.content_type,
      text: item.text,
      sort_order: item.sort_order ?? idx,
      is_from_go_deeper: isFromGoDeeper,
    }));

    const { error: insertErr } = await supabase
      .from('manifest_summaries')
      .insert(records);

    if (insertErr) {
      console.error('saveSummaryResults error:', insertErr);
      throw insertErr;
    }
  }, [user]);

  // --- Save declaration extraction results to DB ---

  const saveDeclarationResults = useCallback(async (
    manifestItemId: string,
    items: DeclarationExtractionItem[],
    sectionTitle?: string,
    sectionIndex: number = 0,
    isFromGoDeeper: boolean = false,
  ) => {
    if (!user || items.length === 0) return;

    const records = items.map((item, idx) => ({
      user_id: user.id,
      manifest_item_id: manifestItemId,
      section_title: sectionTitle || null,
      section_index: sectionIndex,
      value_name: item.value_name || null,
      declaration_text: item.declaration_text,
      declaration_style: item.declaration_style,
      sort_order: item.sort_order ?? idx,
      is_from_go_deeper: isFromGoDeeper,
    }));

    const { error: insertErr } = await supabase
      .from('manifest_declarations')
      .insert(records);

    if (insertErr) {
      console.error('saveDeclarationResults error:', insertErr);
      throw insertErr;
    }
  }, [user]);

  // --- Extract Summary ---

  const extractSummary = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    options?: {
      sectionTitle?: string;
      sectionStart?: number;
      sectionEnd?: number;
      goDeeper?: boolean;
      existingItems?: string[];
      sectionIndex?: number;
    },
  ): Promise<boolean> => {
    if (!user) return false;
    setExtractingTab('summary');
    setError(null);
    try {
      const isSection = options?.sectionStart != null;
      const type = isSection ? 'summary_section' : 'summary';

      const result = await callExtract(manifestItemId, type, genres, options);
      const resultObj = result as { items?: SummaryExtractionItem[] };
      const items = resultObj?.items || (Array.isArray(result) ? result : []);

      if (items.length > 0) {
        await saveSummaryResults(
          manifestItemId,
          items,
          options?.sectionTitle,
          options?.sectionIndex ?? 0,
          options?.goDeeper ?? false,
        );
        await fetchSummaries(manifestItemId);
      }
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setExtractingTab(null);
    }
  }, [user, callExtract, saveSummaryResults, fetchSummaries]);

  // --- Extract Declarations (Mast Content) ---

  const extractDeclarations = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    options?: {
      sectionTitle?: string;
      sectionStart?: number;
      sectionEnd?: number;
      goDeeper?: boolean;
      existingItems?: string[];
      sectionIndex?: number;
    },
  ): Promise<boolean> => {
    if (!user) return false;
    setExtractingTab('mast_content');
    setError(null);
    try {
      const isSection = options?.sectionStart != null;
      const type = isSection ? 'mast_content_section' : 'mast_content';

      const result = await callExtract(manifestItemId, type, genres, options);
      const resultObj = result as { items?: DeclarationExtractionItem[] };
      const items = resultObj?.items || (Array.isArray(result) ? result : []);

      if (items.length > 0) {
        await saveDeclarationResults(
          manifestItemId,
          items,
          options?.sectionTitle,
          options?.sectionIndex ?? 0,
          options?.goDeeper ?? false,
        );
        await fetchDeclarations(manifestItemId);
      }
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setExtractingTab(null);
    }
  }, [user, callExtract, saveDeclarationResults, fetchDeclarations]);

  // --- Extract All: fires summary + framework + mast_content in parallel ---

  const extractAll = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    onFrameworkResult?: (result: FrameworkExtractionResult) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;
    setExtracting(true);
    setError(null);

    try {
      await updateExtractionStatus(manifestItemId, 'extracting');

      // Fire all three extractions in parallel
      const [summaryOk, , declarationOk] = await Promise.all([
        extractSummary(manifestItemId, genres),
        // Framework extraction — call Edge Function directly, pass result to callback
        (async () => {
          try {
            const result = await callExtract(manifestItemId, 'framework', genres);
            if (result && onFrameworkResult) {
              await onFrameworkResult(result as FrameworkExtractionResult);
            }
            return true;
          } catch (err) {
            console.error('Framework extraction failed:', err);
            return false;
          }
        })(),
        extractDeclarations(manifestItemId, genres),
      ]);

      const allOk = summaryOk && declarationOk;
      await updateExtractionStatus(manifestItemId, allOk ? 'completed' : 'failed');
      return allOk;
    } catch (err) {
      setError((err as Error).message);
      await updateExtractionStatus(manifestItemId, 'failed');
      return false;
    } finally {
      setExtracting(false);
    }
  }, [user, extractSummary, extractDeclarations, callExtract, updateExtractionStatus]);

  // --- Go Deeper: extract additional content for a specific tab/section ---

  const goDeeper = useCallback(async (
    manifestItemId: string,
    tabType: 'summary' | 'framework' | 'mast_content',
    genres: BookGenre[],
    sectionTitle: string | undefined,
    existingItems: string[],
    options?: {
      sectionStart?: number;
      sectionEnd?: number;
      sectionIndex?: number;
      onFrameworkResult?: (result: FrameworkExtractionResult) => Promise<void>;
    },
  ): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    const extractOptions = {
      sectionTitle,
      sectionStart: options?.sectionStart,
      sectionEnd: options?.sectionEnd,
      sectionIndex: options?.sectionIndex,
      goDeeper: true,
      existingItems,
    };

    if (tabType === 'summary') {
      return extractSummary(manifestItemId, genres, extractOptions);
    } else if (tabType === 'mast_content') {
      return extractDeclarations(manifestItemId, genres, extractOptions);
    } else if (tabType === 'framework') {
      setExtractingTab('framework');
      try {
        const isSection = options?.sectionStart != null;
        const type = isSection ? 'framework_section' : 'framework';
        const result = await callExtract(manifestItemId, type, genres, extractOptions);
        if (result && options?.onFrameworkResult) {
          await options.onFrameworkResult(result as FrameworkExtractionResult);
        }
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setExtractingTab(null);
      }
    }
    return false;
  }, [user, extractSummary, extractDeclarations, callExtract]);

  // --- Re-run tab: clear existing items, re-extract ---

  const reRunTab = useCallback(async (
    manifestItemId: string,
    tabType: 'summary' | 'mast_content',
    genres: BookGenre[],
  ): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    try {
      if (tabType === 'summary') {
        // Soft-delete existing summaries
        await supabase
          .from('manifest_summaries')
          .update({ is_deleted: true })
          .eq('manifest_item_id', manifestItemId)
          .eq('user_id', user.id);
        return extractSummary(manifestItemId, genres);
      } else if (tabType === 'mast_content') {
        // Soft-delete existing declarations
        await supabase
          .from('manifest_declarations')
          .update({ is_deleted: true })
          .eq('manifest_item_id', manifestItemId)
          .eq('user_id', user.id);
        return extractDeclarations(manifestItemId, genres);
      }
      return false;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, [user, extractSummary, extractDeclarations]);

  // --- CRUD: Summary items ---

  const updateSummaryText = useCallback(async (summaryId: string, text: string) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_summaries')
      .update({ text })
      .eq('id', summaryId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSummaries((prev) => prev.map((s) => s.id === summaryId ? { ...s, text } : s));
  }, [user]);

  const toggleSummaryHeart = useCallback(async (summaryId: string) => {
    if (!user) return;
    const item = summaries.find((s) => s.id === summaryId);
    if (!item) return;
    const newVal = !item.is_hearted;
    const { error: updateErr } = await supabase
      .from('manifest_summaries')
      .update({ is_hearted: newVal })
      .eq('id', summaryId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSummaries((prev) => prev.map((s) => s.id === summaryId ? { ...s, is_hearted: newVal } : s));
  }, [user, summaries]);

  const deleteSummary = useCallback(async (summaryId: string) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_summaries')
      .update({ is_deleted: true })
      .eq('id', summaryId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSummaries((prev) => prev.map((s) => s.id === summaryId ? { ...s, is_deleted: true } : s));
  }, [user]);

  // --- CRUD: Declaration items ---

  const updateDeclaration = useCallback(async (
    declarationId: string,
    updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>,
  ) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_declarations')
      .update(updates)
      .eq('id', declarationId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDeclarations((prev) => prev.map((d) => d.id === declarationId ? { ...d, ...updates } : d));
  }, [user]);

  const toggleDeclarationHeart = useCallback(async (declarationId: string) => {
    if (!user) return;
    const item = declarations.find((d) => d.id === declarationId);
    if (!item) return;
    const newVal = !item.is_hearted;
    const { error: updateErr } = await supabase
      .from('manifest_declarations')
      .update({ is_hearted: newVal })
      .eq('id', declarationId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDeclarations((prev) => prev.map((d) => d.id === declarationId ? { ...d, is_hearted: newVal } : d));
  }, [user, declarations]);

  const deleteDeclaration = useCallback(async (declarationId: string) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_declarations')
      .update({ is_deleted: true })
      .eq('id', declarationId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDeclarations((prev) => prev.map((d) => d.id === declarationId ? { ...d, is_deleted: true } : d));
  }, [user]);

  // --- Send Declaration to Mast ---

  const sendDeclarationToMast = useCallback(async (
    declarationId: string,
  ): Promise<string | null> => {
    if (!user) return null;
    const decl = declarations.find((d) => d.id === declarationId);
    if (!decl) return null;

    // Create a Mast entry
    const { data: mastEntry, error: mastErr } = await supabase
      .from('mast_entries')
      .insert({
        user_id: user.id,
        type: 'declaration',
        text: decl.declaration_text,
        category: decl.value_name || null,
        source: 'manifest_extraction',
      })
      .select('id')
      .single();

    if (mastErr || !mastEntry) {
      setError(mastErr?.message || 'Failed to create Mast entry');
      return null;
    }

    // Mark declaration as sent
    await supabase
      .from('manifest_declarations')
      .update({ sent_to_mast: true, mast_entry_id: mastEntry.id })
      .eq('id', declarationId)
      .eq('user_id', user.id);

    setDeclarations((prev) =>
      prev.map((d) => d.id === declarationId
        ? { ...d, sent_to_mast: true, mast_entry_id: mastEntry.id }
        : d),
    );

    return mastEntry.id;
  }, [user, declarations]);

  // --- CRUD: Framework principle heart/delete (extends existing ai_framework_principles) ---

  const togglePrincipleHeart = useCallback(async (principleId: string) => {
    if (!user) return;
    const { data: current } = await supabase
      .from('ai_framework_principles')
      .select('is_hearted')
      .eq('id', principleId)
      .single();
    if (!current) return;

    const newVal = !current.is_hearted;
    await supabase
      .from('ai_framework_principles')
      .update({ is_hearted: newVal })
      .eq('id', principleId);
  }, [user]);

  const deletePrinciple = useCallback(async (principleId: string) => {
    if (!user) return;
    await supabase
      .from('ai_framework_principles')
      .update({ is_deleted: true })
      .eq('id', principleId);
  }, [user]);

  // --- Fetch hearted items across all books ---

  const fetchHeartedItems = useCallback(async (): Promise<{
    summaries: ManifestSummary[];
    declarations: ManifestDeclaration[];
    principles: AIFrameworkPrinciple[];
  }> => {
    if (!user) return { summaries: [], declarations: [], principles: [] };

    const [summaryRes, declRes, principleRes] = await Promise.all([
      supabase
        .from('manifest_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('manifest_declarations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_framework_principles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);

    return {
      summaries: summaryRes.data || [],
      declarations: declRes.data || [],
      principles: principleRes.data || [],
    };
  }, [user]);

  return {
    // State
    summaries,
    declarations,
    extracting,
    extractingTab,
    error,
    // Fetch
    fetchSummaries,
    fetchDeclarations,
    fetchHeartedItems,
    // Extraction
    extractAll,
    extractSummary,
    extractDeclarations,
    goDeeper,
    reRunTab,
    // Genres & Status
    updateGenres,
    updateExtractionStatus,
    // Summary CRUD
    updateSummaryText,
    toggleSummaryHeart,
    deleteSummary,
    // Declaration CRUD
    updateDeclaration,
    toggleDeclarationHeart,
    deleteDeclaration,
    sendDeclarationToMast,
    // Framework principle heart/delete
    togglePrincipleHeart,
    deletePrinciple,
  };
}
