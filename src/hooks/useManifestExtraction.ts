import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { triggerEmbedding } from '../lib/rag';
import type { SectionInfo } from './useFrameworks';
import { computeMergeStats, mergeShortSections } from '../lib/mergeSections';
import type { MergeStats } from '../lib/mergeSections';
import {
  MANIFEST_SUMMARY_COLUMNS,
  MANIFEST_DECLARATION_COLUMNS,
  MANIFEST_ACTION_STEP_COLUMNS,
  MANIFEST_QUESTION_COLUMNS,
  AI_FRAMEWORK_PRINCIPLE_COLUMNS,
} from '../lib/types';
import type {
  ManifestSummary,
  ManifestDeclaration,
  ManifestActionStep,
  ManifestQuestion,
  AIFrameworkPrinciple,
  BookGenre,
  ManifestExtractionStatus,
  DeclarationStyle,
} from '../lib/types';

export type { SectionInfo } from './useFrameworks';

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

interface ActionStepExtractionItem {
  content_type: string;
  text: string;
  sort_order: number;
}

interface QuestionExtractionItem {
  content_type: string;
  text: string;
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
  const [actionSteps, setActionSteps] = useState<ManifestActionStep[]>([]);
  const [questions, setQuestions] = useState<ManifestQuestion[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractingTab, setExtractingTab] = useState<'summary' | 'framework' | 'mast_content' | 'action_steps' | 'questions' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Section discovery state
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [selectedSectionIndices, setSelectedSectionIndices] = useState<number[]>([]);
  const [discoveringSections, setDiscoveringSections] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    current: number;
    total: number;
    currentType: 'summary' | 'framework' | 'mast_content' | 'action_steps' | 'questions';
  } | null>(null);

  // Merge sections state
  const [originalSections, setOriginalSections] = useState<SectionInfo[]>([]);
  const [isMergeActive, setIsMergeActive] = useState(false);

  // Failed sections tracking — sections that errored during extraction
  const [failedSections, setFailedSections] = useState<Array<{
    sectionIndex: number;
    title: string;
    section: SectionInfo;
    retrying?: boolean;
  }>>([]);

  // --- Fire-and-forget: generate semantic embeddings for newly extracted content ---
  const triggerSemanticEmbeddings = useCallback(() => {
    // Process each table that extractions write to — fire-and-forget, non-blocking
    const tables = ['manifest_summaries', 'manifest_declarations', 'ai_framework_principles', 'manifest_action_steps', 'manifest_questions'];
    for (const table of tables) {
      triggerEmbedding({ table, batchSize: 100 }).catch((err) => {
        console.warn(`[triggerSemanticEmbeddings] Non-fatal error for ${table}:`, err);
      });
    }
  }, []);

  // --- Fire-and-forget: sync extractions to admin's clone ---
  const syncExtractionsToAdmin = useCallback(async (manifestItemId: string) => {
    try {
      await supabase.functions.invoke('manifest-admin', {
        body: { action: 'sync_from_user', manifest_item_id: manifestItemId },
      });
    } catch (err) {
      // Non-fatal — admin sync failure should never affect user experience
      console.warn('[syncExtractionsToAdmin] Failed (non-fatal):', err);
    }
  }, []);

  // --- Fetch existing extracted items for an item ---

  const fetchSummaries = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('manifest_summaries')
      .select(MANIFEST_SUMMARY_COLUMNS)
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
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
      .select(MANIFEST_DECLARATION_COLUMNS)
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (fetchErr) {
      console.error('fetchDeclarations error:', fetchErr);
      return;
    }
    setDeclarations(data || []);
  }, [user]);

  const fetchActionSteps = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('manifest_action_steps')
      .select(MANIFEST_ACTION_STEP_COLUMNS)
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (fetchErr) {
      console.error('fetchActionSteps error:', fetchErr);
      return;
    }
    setActionSteps(data || []);
  }, [user]);

  const fetchQuestions = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('manifest_questions')
      .select(MANIFEST_QUESTION_COLUMNS)
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (fetchErr) {
      console.error('fetchQuestions error:', fetchErr);
      return;
    }
    setQuestions(data || []);
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

  // --- Section discovery ---

  const discoverSections = useCallback(async (
    manifestItemId: string,
  ): Promise<SectionInfo[] | null> => {
    setDiscoveringSections(true);
    setError(null);
    console.log('[discoverSections] Starting discovery for', manifestItemId);
    try {
      // Check DB cache first
      const { data: cachedItem } = await supabase
        .from('manifest_items')
        .select('discovered_sections')
        .eq('id', manifestItemId)
        .single();
      if (cachedItem?.discovered_sections && Array.isArray(cachedItem.discovered_sections) && cachedItem.discovered_sections.length > 0) {
        console.log(`[discoverSections] Using cached sections (${cachedItem.discovered_sections.length} sections)`);
        const cached = cachedItem.discovered_sections as SectionInfo[];
        setSections(cached);
        setOriginalSections(cached);
        setIsMergeActive(false);
        const defaultSelected = cached
          .map((s: SectionInfo, i: number) => ({ index: i, title: s.title }))
          .filter(({ title }: { title: string }) => !title.startsWith('[NON-CONTENT]'))
          .map(({ index }: { index: number }) => index);
        setSelectedSectionIndices(defaultSelected);
        setDiscoveringSections(false);
        return cached;
      }

      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: manifestItemId, extraction_type: 'discover_sections' },
      });
      console.log('[discoverSections] Response:', { data: data ? Object.keys(data) : null, error: invokeErr?.message });
      if (invokeErr || data?.error) {
        const msg = invokeErr?.message || data?.error || 'Section discovery failed';
        console.error('[discoverSections] Error:', msg);
        setError(msg);
        return null;
      }
      const discovered: SectionInfo[] = data.sections || [];
      console.log('[discoverSections] Found', discovered.length, 'sections');
      setSections(discovered);
      setOriginalSections(discovered);
      setIsMergeActive(false);
      // Cache to DB so it survives reloads
      await supabase.from('manifest_items')
        .update({ discovered_sections: discovered })
        .eq('id', manifestItemId);
      // Auto-select content sections, skip [NON-CONTENT]
      const defaultSelected = discovered
        .map((s, i) => ({ index: i, title: s.title }))
        .filter(({ title }) => !title.startsWith('[NON-CONTENT]'))
        .map(({ index }) => index);
      setSelectedSectionIndices(defaultSelected);
      return discovered;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setDiscoveringSections(false);
    }
  }, []);

  const updateSectionTitle = useCallback((index: number, newTitle: string) => {
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, title: newTitle } : s));
  }, []);

  const getSectionOffsets = useCallback((sectionTitle: string): { start: number; end: number; index: number } | null => {
    const match = sections.find((s) => {
      const clean = s.title.replace(/^\[NON-CONTENT\]\s*/i, '');
      return clean === sectionTitle;
    });
    if (!match) return null;
    const index = sections.indexOf(match);
    return { start: match.start_char, end: match.end_char, index };
  }, [sections]);

  // --- Merge sections ---

  const mergeStats = useMemo<MergeStats>(
    () => computeMergeStats(originalSections),
    [originalSections],
  );

  const autoSelectContent = (secs: SectionInfo[]): number[] =>
    secs
      .map((s, i) => ({ index: i, title: s.title }))
      .filter(({ title }) => !title.startsWith('[NON-CONTENT]'))
      .map(({ index }) => index);

  const toggleMergeSections = useCallback(() => {
    const newMerge = !isMergeActive;
    setIsMergeActive(newMerge);

    if (newMerge) {
      const merged = mergeShortSections(originalSections);
      setSections(merged);
      setSelectedSectionIndices(autoSelectContent(merged));
    } else {
      setSections(originalSections);
      setSelectedSectionIndices(autoSelectContent(originalSections));
    }
  }, [isMergeActive, originalSections]);

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
      declaration_style: (['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'].includes(item.declaration_style) ? item.declaration_style : 'choosing_committing') as DeclarationStyle,
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

  // --- Save action step extraction results to DB ---

  const saveActionStepResults = useCallback(async (
    manifestItemId: string,
    items: ActionStepExtractionItem[],
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
      .from('manifest_action_steps')
      .insert(records);

    if (insertErr) {
      console.error('saveActionStepResults error:', insertErr);
      throw insertErr;
    }
  }, [user]);

  // --- Save question extraction results to DB ---

  const saveQuestionResults = useCallback(async (
    manifestItemId: string,
    items: QuestionExtractionItem[],
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
      .from('manifest_questions')
      .insert(records);

    if (insertErr) {
      console.error('saveQuestionResults error:', insertErr);
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

  // --- Extract Action Steps ---

  const extractActionSteps = useCallback(async (
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
    setExtractingTab('action_steps');
    setError(null);
    try {
      const isSection = options?.sectionStart != null;
      const type = isSection ? 'action_steps_section' : 'action_steps';

      const result = await callExtract(manifestItemId, type, genres, options);
      const resultObj = result as { items?: ActionStepExtractionItem[] };
      const items = resultObj?.items || (Array.isArray(result) ? result : []);

      if (items.length > 0) {
        await saveActionStepResults(
          manifestItemId,
          items,
          options?.sectionTitle,
          options?.sectionIndex ?? 0,
          options?.goDeeper ?? false,
        );
        await fetchActionSteps(manifestItemId);
      }
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setExtractingTab(null);
    }
  }, [user, callExtract, saveActionStepResults, fetchActionSteps]);

  // --- Extract Questions ---

  const extractQuestions = useCallback(async (
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
    setExtractingTab('questions');
    setError(null);
    try {
      const isSection = options?.sectionStart != null;
      const type = isSection ? 'questions_section' : 'questions';

      const result = await callExtract(manifestItemId, type, genres, options);
      const resultObj = result as { items?: QuestionExtractionItem[] };
      const items = resultObj?.items || (Array.isArray(result) ? result : []);

      if (items.length > 0) {
        await saveQuestionResults(
          manifestItemId,
          items,
          options?.sectionTitle,
          options?.sectionIndex ?? 0,
          options?.goDeeper ?? false,
        );
        await fetchQuestions(manifestItemId);
      }
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setExtractingTab(null);
    }
  }, [user, callExtract, saveQuestionResults, fetchQuestions]);

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
      if (allOk) {
        syncExtractionsToAdmin(manifestItemId);
        triggerSemanticEmbeddings();
      }
      return allOk;
    } catch (err) {
      setError((err as Error).message);
      await updateExtractionStatus(manifestItemId, 'failed');
      return false;
    } finally {
      setExtracting(false);
    }
  }, [user, extractSummary, extractDeclarations, callExtract, updateExtractionStatus, syncExtractionsToAdmin, triggerSemanticEmbeddings]);

  // --- Combined section result shape from Edge Function ---

  interface CombinedSectionResult {
    summaries?: SummaryExtractionItem[];
    framework?: FrameworkExtractionResult;
    action_steps?: ActionStepExtractionItem[];
    declarations?: DeclarationExtractionItem[];
    questions?: QuestionExtractionItem[];
  }

  // --- Extract All Sections: one combined API call per section ---

  const extractAllSections = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    sectionIndices: number[],
    onFrameworkResult?: (result: FrameworkExtractionResult, sectionTitle: string, sectionIndex: number) => Promise<void>,
  ): Promise<boolean> => {
    if (!user || sections.length === 0 || sectionIndices.length === 0) return false;
    setExtracting(true);
    setError(null);

    try {
      await updateExtractionStatus(manifestItemId, 'extracting');
      const failed: Array<{ sectionIndex: number; title: string; section: SectionInfo }> = [];

      for (let i = 0; i < sectionIndices.length; i++) {
        // Throttle between sections to avoid OpenRouter rate limits
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }

        const secIdx = sectionIndices[i];
        const section = sections[secIdx];
        const cleanTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');

        // Single combined call for all 3 extraction types
        setExtractionProgress({ current: i, total: sectionIndices.length, currentType: 'summary' });
        try {
          console.log(`[extractAllSections] Combined extraction for section ${i + 1}/${sectionIndices.length}: "${cleanTitle}"`);
          const rawResult = await callExtract(manifestItemId, 'combined_section', genres, {
            sectionTitle: cleanTitle,
            sectionStart: section.start_char,
            sectionEnd: section.end_char,
          });

          const combined = rawResult as CombinedSectionResult;
          console.log(`[extractAllSections] Combined result for "${cleanTitle}": summaries=${combined?.summaries?.length || 0}, principles=${combined?.framework?.principles?.length || 0}, action_steps=${combined?.action_steps?.length || 0}, declarations=${combined?.declarations?.length || 0}, questions=${combined?.questions?.length || 0}`);

          // Save summaries
          if (combined?.summaries && combined.summaries.length > 0) {
            await saveSummaryResults(manifestItemId, combined.summaries, cleanTitle, secIdx);
            await fetchSummaries(manifestItemId);
          }

          // Save framework via callback
          if (combined?.framework && onFrameworkResult) {
            await onFrameworkResult(combined.framework, cleanTitle, secIdx);
          }

          // Save action steps
          if (combined?.action_steps && combined.action_steps.length > 0) {
            await saveActionStepResults(manifestItemId, combined.action_steps, cleanTitle, secIdx);
            await fetchActionSteps(manifestItemId);
          }

          // Save declarations
          if (combined?.declarations && combined.declarations.length > 0) {
            await saveDeclarationResults(manifestItemId, combined.declarations, cleanTitle, secIdx);
            await fetchDeclarations(manifestItemId);
          }

          // Save questions
          if (combined?.questions && combined.questions.length > 0) {
            await saveQuestionResults(manifestItemId, combined.questions, cleanTitle, secIdx);
            await fetchQuestions(manifestItemId);
          }
        } catch (err) {
          console.error(`[extractAllSections] Combined extraction failed for section "${cleanTitle}":`, err);
          failed.push({ sectionIndex: secIdx, title: cleanTitle, section });
        }
      }

      // Track which sections failed so user can retry them individually
      setFailedSections(failed);

      // Mark completed even with partial failures — extracted content is still valuable
      await updateExtractionStatus(manifestItemId, 'completed');
      syncExtractionsToAdmin(manifestItemId);
      triggerSemanticEmbeddings();

      setExtractionProgress(null);
      return failed.length === 0;
    } catch (err) {
      setError((err as Error).message);
      // Only mark failed if the entire loop threw (no sections extracted)
      await updateExtractionStatus(manifestItemId, 'failed');
      setExtractionProgress(null);
      return false;
    } finally {
      setExtracting(false);
    }
  }, [user, sections, saveSummaryResults, saveDeclarationResults, saveActionStepResults, saveQuestionResults, fetchSummaries, fetchDeclarations, fetchActionSteps, fetchQuestions, callExtract, updateExtractionStatus, syncExtractionsToAdmin, triggerSemanticEmbeddings]);

  // --- Retry a single failed section ---

  const retrySection = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    sectionIndex: number,
    onFrameworkResult?: (result: FrameworkExtractionResult, sectionTitle: string, sectionIndex: number) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const failed = failedSections.find((f) => f.sectionIndex === sectionIndex);
    if (!failed) return false;

    // Mark this section as retrying
    setFailedSections((prev) =>
      prev.map((f) => f.sectionIndex === sectionIndex ? { ...f, retrying: true } : f),
    );

    try {
      const rawResult = await callExtract(manifestItemId, 'combined_section', genres, {
        sectionTitle: failed.title,
        sectionStart: failed.section.start_char,
        sectionEnd: failed.section.end_char,
      });

      const combined = rawResult as CombinedSectionResult;

      // Save results — same logic as extractAllSections
      if (combined?.summaries && combined.summaries.length > 0) {
        await saveSummaryResults(manifestItemId, combined.summaries, failed.title, sectionIndex);
      }
      if (combined?.framework && onFrameworkResult) {
        await onFrameworkResult(combined.framework, failed.title, sectionIndex);
      }
      if (combined?.action_steps && combined.action_steps.length > 0) {
        await saveActionStepResults(manifestItemId, combined.action_steps, failed.title, sectionIndex);
      }
      if (combined?.declarations && combined.declarations.length > 0) {
        await saveDeclarationResults(manifestItemId, combined.declarations, failed.title, sectionIndex);
      }
      if (combined?.questions && combined.questions.length > 0) {
        await saveQuestionResults(manifestItemId, combined.questions, failed.title, sectionIndex);
      }

      // Re-fetch all extraction data so UI updates
      await Promise.all([
        fetchSummaries(manifestItemId),
        fetchDeclarations(manifestItemId),
        fetchActionSteps(manifestItemId),
        fetchQuestions(manifestItemId),
      ]);

      // Remove from failed list
      setFailedSections((prev) => prev.filter((f) => f.sectionIndex !== sectionIndex));
      triggerSemanticEmbeddings();
      return true;
    } catch (err) {
      console.error(`[retrySection] Failed again for "${failed.title}":`, err);
      // Clear retrying flag but keep in failed list
      setFailedSections((prev) =>
        prev.map((f) => f.sectionIndex === sectionIndex ? { ...f, retrying: false } : f),
      );
      return false;
    }
  }, [user, failedSections, callExtract, saveSummaryResults, saveDeclarationResults, saveActionStepResults, saveQuestionResults, fetchSummaries, fetchDeclarations, fetchActionSteps, fetchQuestions, triggerSemanticEmbeddings]);

  // --- Multi-part helpers: stateless versions for orchestrating across parts ---

  // Discover sections without setting hook state (for multi-part flow)
  const discoverSectionsRaw = useCallback(async (
    manifestItemId: string,
  ): Promise<SectionInfo[] | null> => {
    try {
      // Check DB cache first
      const { data: item } = await supabase
        .from('manifest_items')
        .select('discovered_sections')
        .eq('id', manifestItemId)
        .single();
      if (item?.discovered_sections && Array.isArray(item.discovered_sections) && item.discovered_sections.length > 0) {
        console.log(`[discoverSectionsRaw] Using cached sections for ${manifestItemId} (${item.discovered_sections.length} sections)`);
        return item.discovered_sections as SectionInfo[];
      }

      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-extract', {
        body: { manifest_item_id: manifestItemId, extraction_type: 'discover_sections' },
      });
      if (invokeErr || data?.error) return null;
      const discovered = data.sections || [];
      // Cache to DB
      if (discovered.length > 0) {
        await supabase.from('manifest_items')
          .update({ discovered_sections: discovered })
          .eq('id', manifestItemId);
      }
      return discovered;
    } catch {
      return null;
    }
  }, []);

  // Extract sections for a specific part using provided section data (doesn't use hook state)
  const extractSectionsForPart = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    partSections: SectionInfo[],
    sectionIndices: number[],
    onFrameworkResult?: (result: FrameworkExtractionResult, sectionTitle: string, sectionIndex: number) => Promise<void>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<boolean> => {
    if (!user || sectionIndices.length === 0) return true;

    await updateExtractionStatus(manifestItemId, 'extracting');

    try {
      for (let i = 0; i < sectionIndices.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1500));

        const secIdx = sectionIndices[i];
        const section = partSections[secIdx];
        const cleanTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');

        onProgress?.(i, sectionIndices.length);

        try {
          const rawResult = await callExtract(manifestItemId, 'combined_section', genres, {
            sectionTitle: cleanTitle,
            sectionStart: section.start_char,
            sectionEnd: section.end_char,
          });

          const combined = rawResult as CombinedSectionResult;

          if (combined?.summaries?.length) {
            await saveSummaryResults(manifestItemId, combined.summaries, cleanTitle, secIdx);
          }
          if (combined?.framework && onFrameworkResult) {
            await onFrameworkResult(combined.framework, cleanTitle, secIdx);
          }
          if (combined?.action_steps?.length) {
            await saveActionStepResults(manifestItemId, combined.action_steps, cleanTitle, secIdx);
          }
          if (combined?.declarations?.length) {
            await saveDeclarationResults(manifestItemId, combined.declarations, cleanTitle, secIdx);
          }
          if (combined?.questions?.length) {
            await saveQuestionResults(manifestItemId, combined.questions, cleanTitle, secIdx);
          }
        } catch (err) {
          console.error(`[extractSectionsForPart] Failed for "${cleanTitle}":`, err);
        }
      }

      await updateExtractionStatus(manifestItemId, 'completed');
      syncExtractionsToAdmin(manifestItemId);
      triggerSemanticEmbeddings();
      return true;
    } catch (err) {
      console.error('[extractSectionsForPart] Fatal error:', err);
      await updateExtractionStatus(manifestItemId, 'failed');
      return false;
    }
  }, [user, callExtract, saveSummaryResults, saveDeclarationResults, saveActionStepResults, saveQuestionResults, updateExtractionStatus, syncExtractionsToAdmin, triggerSemanticEmbeddings]);

  // --- Go Deeper: extract additional content for a specific tab/section ---

  const goDeeper = useCallback(async (
    manifestItemId: string,
    tabType: 'summary' | 'framework' | 'mast_content' | 'action_steps' | 'questions',
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

    let ok = false;
    if (tabType === 'summary') {
      ok = await extractSummary(manifestItemId, genres, extractOptions);
    } else if (tabType === 'action_steps') {
      ok = await extractActionSteps(manifestItemId, genres, extractOptions);
    } else if (tabType === 'questions') {
      ok = await extractQuestions(manifestItemId, genres, extractOptions);
    } else if (tabType === 'mast_content') {
      ok = await extractDeclarations(manifestItemId, genres, extractOptions);
    } else if (tabType === 'framework') {
      setExtractingTab('framework');
      try {
        const isSection = options?.sectionStart != null;
        const type = isSection ? 'framework_section' : 'framework';
        const result = await callExtract(manifestItemId, type, genres, extractOptions);
        if (result && options?.onFrameworkResult) {
          await options.onFrameworkResult(result as FrameworkExtractionResult);
        }
        ok = true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setExtractingTab(null);
      }
    }
    if (ok) triggerSemanticEmbeddings();
    return ok;
  }, [user, extractSummary, extractDeclarations, extractActionSteps, callExtract, triggerSemanticEmbeddings]);

  // --- Re-run tab: clear existing items, re-extract ---

  const reRunTab = useCallback(async (
    manifestItemId: string,
    tabType: 'summary' | 'mast_content' | 'action_steps' | 'questions',
    genres: BookGenre[],
    sectionTitle?: string,
    sectionStart?: number,
    sectionEnd?: number,
    sectionIndex?: number,
  ): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    try {
      const table = tabType === 'summary'
        ? 'manifest_summaries'
        : tabType === 'action_steps'
          ? 'manifest_action_steps'
          : tabType === 'questions'
            ? 'manifest_questions'
            : 'manifest_declarations';

      // Soft-delete: scoped to section if provided, otherwise all
      let query = supabase
        .from(table)
        .update({ is_deleted: true })
        .eq('manifest_item_id', manifestItemId)
        .eq('user_id', user.id);
      if (sectionTitle) {
        query = query.eq('section_title', sectionTitle);
      }
      await query;

      const options = sectionTitle ? { sectionTitle, sectionStart, sectionEnd, sectionIndex } : undefined;

      let ok = false;
      if (tabType === 'summary') {
        ok = await extractSummary(manifestItemId, genres, options);
      } else if (tabType === 'action_steps') {
        ok = await extractActionSteps(manifestItemId, genres, options);
      } else if (tabType === 'questions') {
        ok = await extractQuestions(manifestItemId, genres, options);
      } else {
        ok = await extractDeclarations(manifestItemId, genres, options);
      }
      if (ok) triggerSemanticEmbeddings();
      return ok;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, [user, extractSummary, extractDeclarations, extractActionSteps, extractQuestions, triggerSemanticEmbeddings]);

  // --- Extract a single tab for all sections that are missing it ---
  // Useful for adding questions (or action_steps) to books extracted before that tab existed.

  const extractMissingTab = useCallback(async (
    manifestItemId: string,
    tabType: 'action_steps' | 'questions',
    genres: BookGenre[],
  ): Promise<boolean> => {
    if (!user) return false;
    setExtracting(true);
    setExtractingTab(tabType);
    setError(null);

    try {
      // 1. Get section titles that already have this tab (from DB)
      const table = tabType === 'action_steps' ? 'manifest_action_steps' : 'manifest_questions';
      const { data: existing } = await supabase
        .from(table)
        .select('section_title')
        .eq('manifest_item_id', manifestItemId)
        .eq('user_id', user.id)
        .eq('is_deleted', false);
      const existingTitles = new Set((existing || []).map((e: { section_title: string | null }) => e.section_title).filter(Boolean));

      // 2. Get ALL section titles from existing extractions (DB source of truth)
      //    These are sections we know were extracted — use them even if discovery doesn't find them again
      const [{ data: dbSummaries }, { data: dbDeclarations }, { data: dbActionSteps }] = await Promise.all([
        supabase.from('manifest_summaries')
          .select('section_title, section_index')
          .eq('manifest_item_id', manifestItemId)
          .eq('user_id', user.id)
          .eq('is_deleted', false),
        supabase.from('manifest_declarations')
          .select('section_title, section_index')
          .eq('manifest_item_id', manifestItemId)
          .eq('user_id', user.id)
          .eq('is_deleted', false),
        supabase.from('manifest_action_steps')
          .select('section_title, section_index')
          .eq('manifest_item_id', manifestItemId)
          .eq('user_id', user.id)
          .eq('is_deleted', false),
      ]);

      // Build a map of section_title → section_index from existing extractions
      const knownSections = new Map<string, number>();
      for (const row of [...(dbSummaries || []), ...(dbDeclarations || []), ...(dbActionSteps || [])]) {
        if (row.section_title && !knownSections.has(row.section_title)) {
          knownSections.set(row.section_title, row.section_index);
        }
      }

      // 3. Find missing section titles
      const missingSectionTitles = [...knownSections.entries()]
        .filter(([title]) => !existingTitles.has(title))
        .sort((a, b) => a[1] - b[1]); // sort by section_index

      if (missingSectionTitles.length === 0) {
        setExtracting(false);
        setExtractingTab(null);
        return true;
      }

      // 4. We need char offsets for each section. Try discovered sections first, then re-discover.
      let sectionList = sections.length > 0 ? sections : null;
      if (!sectionList) {
        const discovered = await discoverSectionsRaw(manifestItemId);
        if (discovered && discovered.length > 0) {
          sectionList = discovered;
          setSections(discovered);
          setOriginalSections(discovered);
        }
      }

      // 5. Match missing titles to section offsets
      const extractFn = tabType === 'action_steps' ? extractActionSteps : extractQuestions;
      let extracted = 0;

      for (let i = 0; i < missingSectionTitles.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1500));
        const [title, sectionIndex] = missingSectionTitles[i];

        setExtractionProgress({ current: i, total: missingSectionTitles.length, currentType: tabType });

        // Find matching section in discovered list for char offsets
        const matchedSection = sectionList?.find((s) => {
          const clean = s.title.replace(/^\[NON-CONTENT\]\s*/i, '');
          return clean === title;
        });

        try {
          if (matchedSection) {
            // Have char offsets — section-specific extraction
            await extractFn(manifestItemId, genres, {
              sectionTitle: title,
              sectionStart: matchedSection.start_char,
              sectionEnd: matchedSection.end_char,
              sectionIndex,
            });
          } else {
            // No char offsets — fall back to whole-doc extraction tagged with this section title
            console.warn(`[extractMissingTab] No char offsets for "${title}" — using whole-doc extraction`);
            await extractFn(manifestItemId, genres, {
              sectionTitle: title,
              sectionIndex,
            });
          }
          extracted++;
        } catch (err) {
          console.error(`[extractMissingTab] Failed for "${title}":`, err);
        }
      }

      if (extracted > 0) triggerSemanticEmbeddings();
      setExtractionProgress(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      setExtractionProgress(null);
      return false;
    } finally {
      setExtracting(false);
      setExtractingTab(null);
    }
  }, [user, sections, discoverSectionsRaw, extractActionSteps, extractQuestions, triggerSemanticEmbeddings]);

  // --- Re-run Frameworks: discovers sections, extracts only frameworks per section ---

  const reRunFrameworks = useCallback(async (
    manifestItemId: string,
    genres: BookGenre[],
    onFrameworkResult?: (result: FrameworkExtractionResult, sectionTitle: string, sectionIndex: number) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;
    setExtractingTab('framework');
    setError(null);
    try {
      // Discover sections
      const sectionsResult = await discoverSectionsRaw(manifestItemId);

      if (!sectionsResult || sectionsResult.length === 0) {
        // Short book — extract as a whole
        const result = await callExtract(manifestItemId, 'framework', genres);
        if (result && onFrameworkResult) {
          await onFrameworkResult(result as FrameworkExtractionResult, '', 0);
        }
        return true;
      }

      // Filter content sections
      const contentSections = sectionsResult
        .map((s, i) => ({ ...s, originalIndex: i }))
        .filter(s => !s.title.startsWith('[NON-CONTENT]'));

      // Extract framework for each section
      for (let i = 0; i < contentSections.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1500));

        const section = contentSections[i];
        const cleanTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');

        setExtractionProgress({ current: i, total: contentSections.length, currentType: 'framework' });
        try {
          const result = await callExtract(manifestItemId, 'framework_section', genres, {
            sectionTitle: cleanTitle,
            sectionStart: section.start_char,
            sectionEnd: section.end_char,
          });
          if (result && onFrameworkResult) {
            await onFrameworkResult(result as FrameworkExtractionResult, cleanTitle, section.originalIndex);
          }
        } catch (err) {
          console.error(`[reRunFrameworks] Failed for section "${cleanTitle}":`, err);
          // Continue with remaining sections
        }
      }

      setExtractionProgress(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setExtractingTab(null);
      setExtractionProgress(null);
    }
  }, [user, callExtract, discoverSectionsRaw]);

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
    // Optimistic removal from state
    setSummaries((prev) => prev.filter((s) => s.id !== summaryId));
    const { error: updateErr } = await supabase
      .from('manifest_summaries')
      .update({ is_deleted: true })
      .eq('id', summaryId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
    }
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
    // Optimistic removal from state
    setDeclarations((prev) => prev.filter((d) => d.id !== declarationId));
    const { error: updateErr } = await supabase
      .from('manifest_declarations')
      .update({ is_deleted: true })
      .eq('id', declarationId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
    }
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

  // --- CRUD: Action Step items ---

  const updateActionStepText = useCallback(async (actionStepId: string, text: string) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_action_steps')
      .update({ text })
      .eq('id', actionStepId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setActionSteps((prev) => prev.map((a) => a.id === actionStepId ? { ...a, text } : a));
  }, [user]);

  const toggleActionStepHeart = useCallback(async (actionStepId: string) => {
    if (!user) return;
    const item = actionSteps.find((a) => a.id === actionStepId);
    if (!item) return;
    const newVal = !item.is_hearted;
    const { error: updateErr } = await supabase
      .from('manifest_action_steps')
      .update({ is_hearted: newVal })
      .eq('id', actionStepId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setActionSteps((prev) => prev.map((a) => a.id === actionStepId ? { ...a, is_hearted: newVal } : a));
  }, [user, actionSteps]);

  const deleteActionStep = useCallback(async (actionStepId: string) => {
    if (!user) return;
    setActionSteps((prev) => prev.filter((a) => a.id !== actionStepId));
    const { error: updateErr } = await supabase
      .from('manifest_action_steps')
      .update({ is_deleted: true })
      .eq('id', actionStepId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
    }
  }, [user]);

  // --- Send Action Step to Compass ---

  const sendActionStepToCompass = useCallback(async (
    actionStepId: string,
  ): Promise<string | null> => {
    if (!user) return null;
    const step = actionSteps.find((a) => a.id === actionStepId);
    if (!step) return null;

    // Truncate title to ~200 chars for the task title
    const title = step.text.length > 200
      ? step.text.substring(0, 197) + '...'
      : step.text;

    const { data: task, error: taskErr } = await supabase
      .from('compass_tasks')
      .insert({
        user_id: user.id,
        title,
        description: step.text.length > 200 ? step.text : null,
        source: 'manifest_extraction',
        source_reference_id: actionStepId,
        due_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (taskErr || !task) {
      setError(taskErr?.message || 'Failed to create task');
      return null;
    }

    // Auto-tag the task (fire-and-forget)
    supabase.functions
      .invoke('auto-tag', {
        body: { text: step.text, entity_type: 'task' },
      })
      .then(({ data }) => {
        if (data?.tags?.[0]) {
          supabase
            .from('compass_tasks')
            .update({ life_area_tag: data.tags[0] })
            .eq('id', task.id);
        }
      })
      .catch(() => {});

    // Mark action step as sent
    await supabase
      .from('manifest_action_steps')
      .update({ sent_to_compass: true, compass_task_id: task.id })
      .eq('id', actionStepId)
      .eq('user_id', user.id);

    setActionSteps((prev) =>
      prev.map((a) => a.id === actionStepId
        ? { ...a, sent_to_compass: true, compass_task_id: task.id }
        : a),
    );

    return task.id;
  }, [user, actionSteps]);

  // --- CRUD: Question items ---

  const updateQuestionText = useCallback(async (questionId: string, text: string) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('manifest_questions')
      .update({ text })
      .eq('id', questionId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, text } : q));
  }, [user]);

  const toggleQuestionHeart = useCallback(async (questionId: string) => {
    if (!user) return;
    const item = questions.find((q) => q.id === questionId);
    if (!item) return;
    const newVal = !item.is_hearted;
    const { error: updateErr } = await supabase
      .from('manifest_questions')
      .update({ is_hearted: newVal })
      .eq('id', questionId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, is_hearted: newVal } : q));
  }, [user, questions]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    if (!user) return;
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    const { error: updateErr } = await supabase
      .from('manifest_questions')
      .update({ is_deleted: true })
      .eq('id', questionId)
      .eq('user_id', user.id);
    if (updateErr) {
      setError(updateErr.message);
    }
  }, [user]);

  // --- Send Question to Journal Prompts ---

  const sendQuestionToPrompts = useCallback(async (
    questionId: string,
    bookTitle?: string,
  ): Promise<string | null> => {
    if (!user) return null;
    const question = questions.find((q) => q.id === questionId);
    if (!question) return null;

    // Create a journal prompt
    const { data: prompt, error: promptErr } = await supabase
      .from('journal_prompts')
      .insert({
        user_id: user.id,
        prompt_text: question.text,
        source: 'manifest_extraction',
        source_reference_id: questionId,
        source_book_title: bookTitle || null,
      })
      .select('id')
      .single();

    if (promptErr || !prompt) {
      setError(promptErr?.message || 'Failed to create journal prompt');
      return null;
    }

    // Mark question as sent
    await supabase
      .from('manifest_questions')
      .update({ sent_to_prompts: true, journal_prompt_id: prompt.id })
      .eq('id', questionId)
      .eq('user_id', user.id);

    setQuestions((prev) =>
      prev.map((q) => q.id === questionId
        ? { ...q, sent_to_prompts: true, journal_prompt_id: prompt.id }
        : q),
    );

    return prompt.id;
  }, [user, questions]);

  const updateQuestionNote = useCallback(async (questionId: string, note: string | null) => {
    if (!user) return;
    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, user_note: note } : q));
    const { error: updateErr } = await supabase
      .from('manifest_questions')
      .update({ user_note: note })
      .eq('id', questionId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

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
    actionSteps: ManifestActionStep[];
    questions: ManifestQuestion[];
  }> => {
    if (!user) return { summaries: [], declarations: [], principles: [], actionSteps: [], questions: [] };

    const [summaryRes, declRes, principleRes, actionStepRes, questionRes] = await Promise.all([
      supabase
        .from('manifest_summaries')
        .select(MANIFEST_SUMMARY_COLUMNS)
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('manifest_declarations')
        .select(MANIFEST_DECLARATION_COLUMNS)
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_framework_principles')
        .select(AI_FRAMEWORK_PRINCIPLE_COLUMNS)
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('manifest_action_steps')
        .select(MANIFEST_ACTION_STEP_COLUMNS)
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('manifest_questions')
        .select(MANIFEST_QUESTION_COLUMNS)
        .eq('user_id', user.id)
        .eq('is_hearted', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);

    return {
      summaries: summaryRes.data || [],
      declarations: declRes.data || [],
      principles: principleRes.data || [],
      actionSteps: actionStepRes.data || [],
      questions: questionRes.data || [],
    };
  }, [user]);

  // --- Clear all extractions for an item ---

  const clearExtractions = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    // Delete framework + principles for this item
    const { data: fw } = await supabase
      .from('ai_frameworks')
      .select('id')
      .eq('manifest_item_id', manifestItemId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fw) {
      await supabase.from('ai_framework_principles').delete().eq('framework_id', fw.id).eq('user_id', user.id);
      await supabase.from('ai_frameworks').delete().eq('id', fw.id).eq('user_id', user.id);
    }
    // Delete summaries, declarations, action steps, and questions
    await Promise.all([
      supabase.from('manifest_summaries').delete().eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_declarations').delete().eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_action_steps').delete().eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_questions').delete().eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
    ]);
    // Reset extraction status and genres
    await supabase.from('manifest_items').update({
      extraction_status: 'none',
    }).eq('id', manifestItemId).eq('user_id', user.id);
    // Clear local state
    setSummaries([]);
    setDeclarations([]);
    setActionSteps([]);
    setQuestions([]);
    setSections([]);
    setOriginalSections([]);
    setIsMergeActive(false);
    setSelectedSectionIndices([]);
    setExtractionProgress(null);
    setError(null);
  }, [user]);

  // --- Reset extraction status without clearing content (unstick frozen extractions) ---

  const resetExtractionStatus = useCallback(async (manifestItemId: string) => {
    if (!user) return;
    // Check if there's any extracted content — if so, mark completed; if not, mark none
    const [{ count: sCount }, { count: dCount }, { count: aCount }, { count: qCount }] = await Promise.all([
      supabase.from('manifest_summaries').select('id', { count: 'exact', head: true }).eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_declarations').select('id', { count: 'exact', head: true }).eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_action_steps').select('id', { count: 'exact', head: true }).eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
      supabase.from('manifest_questions').select('id', { count: 'exact', head: true }).eq('manifest_item_id', manifestItemId).eq('user_id', user.id),
    ]);
    const hasContent = ((sCount ?? 0) + (dCount ?? 0) + (aCount ?? 0) + (qCount ?? 0)) > 0;
    const newStatus: ManifestExtractionStatus = hasContent ? 'completed' : 'none';

    await supabase.from('manifest_items').update({ extraction_status: newStatus }).eq('id', manifestItemId).eq('user_id', user.id);

    // Reset local state
    setExtracting(false);
    setExtractingTab(null);
    setExtractionProgress(null);
    setFailedSections([]);
    setError(null);
  }, [user]);

  // --- Reset All Extractions (Fresh Start) ---

  const resetAllExtractions = useCallback(async (options?: { removeClones?: boolean }) => {
    if (!user) return;
    setError(null);

    try {
      // Delete all extraction data for this user
      await Promise.all([
        supabase.from('manifest_summaries').delete().eq('user_id', user.id),
        supabase.from('manifest_declarations').delete().eq('user_id', user.id),
        supabase.from('manifest_action_steps').delete().eq('user_id', user.id),
        supabase.from('manifest_questions').delete().eq('user_id', user.id),
      ]);

      // Delete framework principles then frameworks
      const { data: frameworks } = await supabase
        .from('ai_frameworks')
        .select('id')
        .eq('user_id', user.id);

      if (frameworks && frameworks.length > 0) {
        const fwIds = frameworks.map((f: { id: string }) => f.id);
        await supabase.from('ai_framework_principles').delete().in('framework_id', fwIds);
        await supabase.from('ai_frameworks').delete().eq('user_id', user.id);
      }

      // Reset extraction_status on all manifest_items
      await supabase
        .from('manifest_items')
        .update({ extraction_status: 'none' })
        .eq('user_id', user.id);

      // Optionally remove cloned books
      if (options?.removeClones) {
        const { data: clones } = await supabase
          .from('manifest_items')
          .select('id')
          .eq('user_id', user.id)
          .not('source_manifest_item_id', 'is', null);

        if (clones && clones.length > 0) {
          const cloneIds = clones.map((c: { id: string }) => c.id);
          // Clean up chunks for cloned items
          for (const id of cloneIds) {
            await supabase.from('manifest_chunks').delete().eq('manifest_item_id', id);
          }
          await supabase.from('manifest_items').delete().in('id', cloneIds);
        }
      }

      // Clear local state
      setSummaries([]);
      setDeclarations([]);
      setActionSteps([]);
      setQuestions([]);
      setSections([]);
      setSelectedSectionIndices([]);
      setExtractionProgress(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  // --- User notes on extraction items ---
  const updateSummaryNote = useCallback(async (summaryId: string, note: string | null) => {
    if (!user) return;
    setSummaries((prev) => prev.map((s) => s.id === summaryId ? { ...s, user_note: note } : s));
    const { error: updateErr } = await supabase
      .from('manifest_summaries')
      .update({ user_note: note })
      .eq('id', summaryId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  const updateDeclarationNote = useCallback(async (declId: string, note: string | null) => {
    if (!user) return;
    setDeclarations((prev) => prev.map((d) => d.id === declId ? { ...d, user_note: note } : d));
    const { error: updateErr } = await supabase
      .from('manifest_declarations')
      .update({ user_note: note })
      .eq('id', declId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  const updateActionStepNote = useCallback(async (stepId: string, note: string | null) => {
    if (!user) return;
    setActionSteps((prev) => prev.map((a) => a.id === stepId ? { ...a, user_note: note } : a));
    const { error: updateErr } = await supabase
      .from('manifest_action_steps')
      .update({ user_note: note })
      .eq('id', stepId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  const updatePrincipleNote = useCallback(async (principleId: string, note: string | null) => {
    if (!user) return;
    // Note: principles are managed through useFrameworks, but we can update note directly
    const { error: updateErr } = await supabase
      .from('ai_framework_principles')
      .update({ user_note: note })
      .eq('id', principleId)
      .eq('user_id', user.id);
    if (updateErr) setError(updateErr.message);
  }, [user]);

  return {
    // State
    summaries,
    declarations,
    actionSteps,
    questions,
    extracting,
    extractingTab,
    error,
    // Section discovery
    sections,
    selectedSectionIndices,
    setSelectedSectionIndices,
    updateSectionTitle,
    discoveringSections,
    extractionProgress,
    failedSections,
    // Merge sections
    isMergeActive,
    mergeStats,
    toggleMergeSections,
    // Fetch
    fetchSummaries,
    fetchDeclarations,
    fetchActionSteps,
    fetchQuestions,
    fetchHeartedItems,
    // Extraction
    extractAll,
    extractAllSections,
    discoverSections,
    extractSummary,
    extractDeclarations,
    extractActionSteps,
    extractQuestions,
    goDeeper,
    reRunTab,
    extractMissingTab,
    reRunFrameworks,
    retrySection,
    discoverSectionsRaw,
    extractSectionsForPart,
    getSectionOffsets,
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
    // Action Step CRUD
    updateActionStepText,
    toggleActionStepHeart,
    deleteActionStep,
    sendActionStepToCompass,
    // Question CRUD
    updateQuestionText,
    toggleQuestionHeart,
    deleteQuestion,
    sendQuestionToPrompts,
    updateQuestionNote,
    // Framework principle heart/delete
    togglePrincipleHeart,
    deletePrinciple,
    // User notes
    updateSummaryNote,
    updateDeclarationNote,
    updateActionStepNote,
    updatePrincipleNote,
    // Clear / reset
    clearExtractions,
    resetAllExtractions,
    resetExtractionStatus,
  };
}
