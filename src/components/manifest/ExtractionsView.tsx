import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Heart, Download, FileText, FileCode, ChevronDown, ChevronRight, Trash2, Anchor, Compass, RefreshCw, Sparkles, LayoutList, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ManifestItem, ManifestSummary, ManifestDeclaration, ManifestActionStep, AIFrameworkPrinciple, BookGenre } from '../../lib/types';
import { DECLARATION_STYLE_LABELS, ACTION_STEP_CONTENT_TYPE_LABELS } from '../../lib/types';
import type { ActionStepContentType } from '../../lib/types';
import { exportExtractionsMd, exportExtractionsTxt, exportExtractionsDocx } from '../../lib/exportExtractions';
import type { BookExtractionGroup } from '../../lib/exportExtractions';
import { Button } from '../shared';
import './ExtractionsView.css';
import './ExtractionTabs.css';

interface ExtractionsViewProps {
  items: ManifestItem[];
  onBack: () => void;
}

type TabType = 'summary' | 'frameworks' | 'action_steps' | 'mast_content';
type FilterMode = 'all' | 'hearted';
type ViewMode = 'tabs' | 'chapters';

interface BookExtractions {
  bookId: string;
  bookTitle: string;
  genres: BookGenre[];
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps: ManifestActionStep[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
}

// Group items by section_title, sorted by section_index
function groupBySection<T extends { section_title: string | null; section_index?: number }>(
  items: T[],
  fallbackKey = '__full_book__',
): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.section_title || fallbackKey;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => {
    const aIdx = (a[1][0] as { section_index?: number })?.section_index ?? 0;
    const bIdx = (b[1][0] as { section_index?: number })?.section_index ?? 0;
    return aIdx - bIdx;
  });
}

export function ExtractionsView({ items, onBack }: ExtractionsViewProps) {
  const { user } = useAuthContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [bookData, setBookData] = useState<Map<string, BookExtractions>>(new Map());
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedBooks, setCollapsedBooks] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [extractingBookTab, setExtractingBookTab] = useState<string | null>(null);
  const [confirmReRun, setConfirmReRun] = useState<string | null>(null); // bookId or null
  const [sendingToMast, setSendingToMast] = useState<Set<string>>(new Set());
  const [sendingToCompass, setSendingToCompass] = useState<Set<string>>(new Set());

  const extractedItems = useMemo(
    () => items.filter((i) =>
      i.extraction_status === 'completed' ||
      i.extraction_status === 'failed' ||
      i.extraction_status === 'extracting'
    ),
    [items],
  );

  // Auto-select first extracted item
  useEffect(() => {
    if (extractedItems.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set([extractedItems[0].id]));
    }
  }, [extractedItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch extractions for selected books (with fixed sort order)
  const fetchExtractions = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setLoading(true);

    try {
      const [summaryRes, declRes, principleRes, actionStepRes] = await Promise.all([
        supabase
          .from('manifest_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('manifest_item_id', ids)
          .order('manifest_item_id')
          .order('section_index', { ascending: true })
          .order('sort_order', { ascending: true }),
        supabase
          .from('manifest_declarations')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('manifest_item_id', ids)
          .order('manifest_item_id')
          .order('section_index', { ascending: true })
          .order('sort_order', { ascending: true }),
        supabase
          .from('ai_framework_principles')
          .select('*, ai_frameworks!inner(manifest_item_id, name)')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('ai_frameworks.manifest_item_id', ids)
          .order('sort_order', { ascending: true }),
        supabase
          .from('manifest_action_steps')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('manifest_item_id', ids)
          .order('manifest_item_id')
          .order('section_index', { ascending: true })
          .order('sort_order', { ascending: true }),
      ]);

      const summaries = (summaryRes.data || []) as ManifestSummary[];
      const declarations = (declRes.data || []) as ManifestDeclaration[];
      const rawPrinciples = (principleRes.data || []) as Array<AIFrameworkPrinciple & { ai_frameworks: { manifest_item_id: string; name: string } }>;
      const actionSteps = (actionStepRes.data || []) as ManifestActionStep[];

      const newData = new Map<string, BookExtractions>();
      for (const id of ids) {
        const item = extractedItems.find((i) => i.id === id);
        newData.set(id, {
          bookId: id,
          bookTitle: item?.title || 'Unknown Book',
          genres: (item?.genres || []) as BookGenre[],
          summaries: summaries.filter((s) => s.manifest_item_id === id),
          declarations: declarations.filter((d) => d.manifest_item_id === id),
          actionSteps: actionSteps.filter((a) => a.manifest_item_id === id),
          principles: rawPrinciples
            .filter((p) => p.ai_frameworks.manifest_item_id === id)
            .map((p) => ({ ...p, framework_name: p.ai_frameworks.name })),
        });
      }
      setBookData(newData);
    } finally {
      setLoading(false);
    }
  }, [user, extractedItems]);

  useEffect(() => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      fetchExtractions(ids);
    } else {
      setBookData(new Map());
    }
  }, [selectedIds, fetchExtractions]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedData = useMemo(() => {
    const result: BookExtractions[] = [];
    for (const id of selectedIds) {
      const data = bookData.get(id);
      if (data) result.push(data);
    }
    return result;
  }, [selectedIds, bookData]);

  // --- Toggle book collapse ---
  const toggleBook = useCallback((bookId: string) => {
    setCollapsedBooks((prev) => {
      const next = new Set(prev);
      next.has(bookId) ? next.delete(bookId) : next.add(bookId);
      return next;
    });
  }, []);

  // --- Toggle section collapse ---
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // --- Heart toggle ---
  const toggleHeart = useCallback(async (table: string, id: string, currentVal: boolean) => {
    if (!user) return;
    await supabase.from(table).update({ is_hearted: !currentVal }).eq('id', id).eq('user_id', user.id);
  }, [user]);

  const handleHeartSummary = useCallback(async (id: string, currentVal: boolean) => {
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const idx = book.summaries.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const updated = { ...book, summaries: [...book.summaries] };
          updated.summaries[idx] = { ...updated.summaries[idx], is_hearted: !currentVal };
          next.set(bookId, updated);
          break;
        }
      }
      return next;
    });
    await toggleHeart('manifest_summaries', id, currentVal);
  }, [toggleHeart]);

  const handleHeartPrinciple = useCallback(async (id: string, currentVal: boolean) => {
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const idx = book.principles.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const updated = { ...book, principles: [...book.principles] };
          updated.principles[idx] = { ...updated.principles[idx], is_hearted: !currentVal };
          next.set(bookId, updated);
          break;
        }
      }
      return next;
    });
    await toggleHeart('ai_framework_principles', id, currentVal);
  }, [toggleHeart]);

  const handleHeartDeclaration = useCallback(async (id: string, currentVal: boolean) => {
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const idx = book.declarations.findIndex((d) => d.id === id);
        if (idx >= 0) {
          const updated = { ...book, declarations: [...book.declarations] };
          updated.declarations[idx] = { ...updated.declarations[idx], is_hearted: !currentVal };
          next.set(bookId, updated);
          break;
        }
      }
      return next;
    });
    await toggleHeart('manifest_declarations', id, currentVal);
  }, [toggleHeart]);

  const handleHeartActionStep = useCallback(async (id: string, currentVal: boolean) => {
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const idx = book.actionSteps.findIndex((a) => a.id === id);
        if (idx >= 0) {
          const updated = { ...book, actionSteps: [...book.actionSteps] };
          updated.actionSteps[idx] = { ...updated.actionSteps[idx], is_hearted: !currentVal };
          next.set(bookId, updated);
          break;
        }
      }
      return next;
    });
    await toggleHeart('manifest_action_steps', id, currentVal);
  }, [toggleHeart]);

  // --- Animated delete ---
  const handleDeleteItem = useCallback(async (table: string, id: string) => {
    if (!user) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      await supabase.from(table).update({ is_deleted: true }).eq('id', id).eq('user_id', user.id);
      setBookData((prev) => {
        const next = new Map(prev);
        for (const [bookId, book] of next) {
          const updated = { ...book };
          updated.summaries = book.summaries.filter((s) => s.id !== id);
          updated.declarations = book.declarations.filter((d) => d.id !== id);
          updated.actionSteps = book.actionSteps.filter((a) => a.id !== id);
          updated.principles = book.principles.filter((p) => p.id !== id);
          next.set(bookId, updated);
        }
        return next;
      });
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 300);
  }, [user]);

  // --- Send to Mast ---
  const handleSendToMast = useCallback(async (declId: string) => {
    if (!user) return;
    setSendingToMast((prev) => new Set(prev).add(declId));
    try {
      let declData: ManifestDeclaration | undefined;
      for (const book of bookData.values()) {
        declData = book.declarations.find((d) => d.id === declId);
        if (declData) break;
      }
      if (!declData) return;

      const { data: mastEntry } = await supabase
        .from('mast_entries')
        .insert({
          user_id: user.id,
          type: 'declaration',
          text: declData.declaration_text,
          category: declData.value_name || null,
          source: 'manifest_extraction',
        })
        .select('id')
        .single();

      if (mastEntry) {
        await supabase.from('manifest_declarations')
          .update({ sent_to_mast: true, mast_entry_id: mastEntry.id })
          .eq('id', declId).eq('user_id', user.id);

        setBookData((prev) => {
          const next = new Map(prev);
          for (const [bookId, book] of next) {
            const idx = book.declarations.findIndex((d) => d.id === declId);
            if (idx >= 0) {
              const updated = { ...book, declarations: [...book.declarations] };
              updated.declarations[idx] = { ...updated.declarations[idx], sent_to_mast: true, mast_entry_id: mastEntry.id };
              next.set(bookId, updated);
              break;
            }
          }
          return next;
        });
      }
    } finally {
      setSendingToMast((prev) => { const n = new Set(prev); n.delete(declId); return n; });
    }
  }, [user, bookData]);

  // --- Send to Compass ---
  const handleSendToCompass = useCallback(async (actionStepId: string) => {
    if (!user) return;
    setSendingToCompass((prev) => new Set(prev).add(actionStepId));
    try {
      let stepData: ManifestActionStep | undefined;
      for (const book of bookData.values()) {
        stepData = book.actionSteps.find((a) => a.id === actionStepId);
        if (stepData) break;
      }
      if (!stepData) return;

      const title = stepData.text.length > 200 ? stepData.text.substring(0, 200) + '...' : stepData.text;
      const { data: task } = await supabase
        .from('compass_tasks')
        .insert({
          user_id: user.id,
          title,
          description: stepData.text.length > 200 ? stepData.text : null,
          due_date: new Date().toISOString().split('T')[0],
          source: 'manifest_extraction',
          source_reference_id: stepData.id,
        })
        .select('id')
        .single();

      if (task) {
        await supabase.from('manifest_action_steps')
          .update({ sent_to_compass: true, compass_task_id: task.id })
          .eq('id', actionStepId).eq('user_id', user.id);

        setBookData((prev) => {
          const next = new Map(prev);
          for (const [bookId, book] of next) {
            const idx = book.actionSteps.findIndex((a) => a.id === actionStepId);
            if (idx >= 0) {
              const updated = { ...book, actionSteps: [...book.actionSteps] };
              updated.actionSteps[idx] = { ...updated.actionSteps[idx], sent_to_compass: true, compass_task_id: task.id };
              next.set(bookId, updated);
              break;
            }
          }
          return next;
        });

        // Fire-and-forget auto-tag
        supabase.functions.invoke('auto-tag', { body: { entry_id: task.id, text: title, entry_type: 'compass_task' } }).catch(() => {});
      }
    } finally {
      setSendingToCompass((prev) => { const n = new Set(prev); n.delete(actionStepId); return n; });
    }
  }, [user, bookData]);

  // --- Go Deeper ---
  const handleGoDeeper = useCallback(async (
    bookId: string,
    tabType: 'summary' | 'mast_content' | 'action_steps',
    sectionTitle: string | undefined,
    existingItems: string[],
    sectionIndex?: number,
  ) => {
    if (!user) return;
    const book = bookData.get(bookId);
    if (!book) return;

    const key = `${bookId}-${tabType}`;
    setExtractingBookTab(key);

    try {
      const extractionType = tabType === 'summary' ? 'summary' : tabType === 'action_steps' ? 'action_steps' : 'mast_content';
      const body: Record<string, unknown> = {
        manifest_item_id: bookId,
        extraction_type: extractionType,
        genres: book.genres,
        go_deeper: true,
        existing_items: existingItems,
      };
      if (sectionTitle) body.section_title = sectionTitle;

      const { data, error } = await supabase.functions.invoke('manifest-extract', { body });
      if (error || data?.error) {
        console.error('Go Deeper failed:', error?.message || data?.error);
        return;
      }

      const result = data?.result ?? data;
      const items = result?.items || (Array.isArray(result) ? result : []);

      if (items.length > 0) {
        if (tabType === 'summary') {
          const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
            user_id: user.id,
            manifest_item_id: bookId,
            section_title: sectionTitle || null,
            section_index: sectionIndex ?? 0,
            content_type: item.content_type,
            text: item.text,
            sort_order: item.sort_order ?? idx,
            is_from_go_deeper: true,
          }));
          await supabase.from('manifest_summaries').insert(records);
        } else if (tabType === 'action_steps') {
          const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
            user_id: user.id,
            manifest_item_id: bookId,
            section_title: sectionTitle || null,
            section_index: sectionIndex ?? 0,
            content_type: item.content_type || 'practice',
            text: item.text,
            sort_order: item.sort_order ?? idx,
            is_from_go_deeper: true,
          }));
          await supabase.from('manifest_action_steps').insert(records);
        } else {
          const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
          const records = items.map((item: { value_name?: string; declaration_text: string; declaration_style: string; sort_order: number }, idx: number) => ({
            user_id: user.id,
            manifest_item_id: bookId,
            section_title: sectionTitle || null,
            section_index: sectionIndex ?? 0,
            value_name: item.value_name || null,
            declaration_text: item.declaration_text,
            declaration_style: VALID_STYLES.includes(item.declaration_style) ? item.declaration_style : 'choosing_committing',
            sort_order: item.sort_order ?? idx,
            is_from_go_deeper: true,
          }));
          await supabase.from('manifest_declarations').insert(records);
        }

        // Refetch this book's data
        await fetchExtractions(Array.from(selectedIds));
      }
    } finally {
      setExtractingBookTab(null);
    }
  }, [user, bookData, selectedIds, fetchExtractions]);

  // --- Re-run ---
  const handleReRun = useCallback(async (bookId: string, tabType: 'summary' | 'mast_content' | 'action_steps') => {
    if (!user) return;
    const book = bookData.get(bookId);
    if (!book) return;

    const key = `${bookId}-${tabType}`;
    setExtractingBookTab(key);
    setConfirmReRun(null);

    try {
      const table = tabType === 'summary' ? 'manifest_summaries' : tabType === 'action_steps' ? 'manifest_action_steps' : 'manifest_declarations';

      // Soft-delete all items for this book + tab
      await supabase.from(table)
        .update({ is_deleted: true })
        .eq('manifest_item_id', bookId)
        .eq('user_id', user.id);

      // Re-extract from whole document
      const extractionType = tabType === 'summary' ? 'summary' : tabType === 'action_steps' ? 'action_steps' : 'mast_content';
      const { data, error } = await supabase.functions.invoke('manifest-extract', {
        body: {
          manifest_item_id: bookId,
          extraction_type: extractionType,
          genres: book.genres,
        },
      });

      if (!error && !data?.error) {
        const result = data?.result ?? data;
        const items = result?.items || (Array.isArray(result) ? result : []);

        if (items.length > 0) {
          if (tabType === 'summary') {
            const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
              user_id: user.id,
              manifest_item_id: bookId,
              section_title: null,
              section_index: 0,
              content_type: item.content_type,
              text: item.text,
              sort_order: item.sort_order ?? idx,
              is_from_go_deeper: false,
            }));
            await supabase.from('manifest_summaries').insert(records);
          } else if (tabType === 'action_steps') {
            const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
              user_id: user.id,
              manifest_item_id: bookId,
              section_title: null,
              section_index: 0,
              content_type: item.content_type || 'practice',
              text: item.text,
              sort_order: item.sort_order ?? idx,
              is_from_go_deeper: false,
            }));
            await supabase.from('manifest_action_steps').insert(records);
          } else {
            const VALID_STYLES = ['choosing_committing', 'recognizing_awakening', 'claiming_stepping_into', 'learning_striving', 'resolute_unashamed'];
            const records = items.map((item: { value_name?: string; declaration_text: string; declaration_style: string; sort_order: number }, idx: number) => ({
              user_id: user.id,
              manifest_item_id: bookId,
              section_title: null,
              section_index: 0,
              value_name: item.value_name || null,
              declaration_text: item.declaration_text,
              declaration_style: VALID_STYLES.includes(item.declaration_style) ? item.declaration_style : 'choosing_committing',
              sort_order: item.sort_order ?? idx,
              is_from_go_deeper: false,
            }));
            await supabase.from('manifest_declarations').insert(records);
          }
        }
      }

      await fetchExtractions(Array.from(selectedIds));
    } finally {
      setExtractingBookTab(null);
    }
  }, [user, bookData, selectedIds, fetchExtractions]);

  // --- Counts ---
  const totalCounts = useMemo(() => {
    let summaries = 0, frameworks = 0, declarations = 0, actionSteps = 0;
    for (const d of selectedData) {
      summaries += d.summaries.length;
      frameworks += d.principles.length;
      declarations += d.declarations.length;
      actionSteps += d.actionSteps.length;
    }
    return { summaries, frameworks, declarations, actionSteps };
  }, [selectedData]);

  // --- Export ---
  const exportGroups = useMemo((): BookExtractionGroup[] => {
    return selectedData.map((d) => ({
      bookTitle: d.bookTitle,
      summaries: d.summaries,
      declarations: d.declarations,
      actionSteps: d.actionSteps,
      principles: d.principles,
    }));
  }, [selectedData]);

  const singleBookTitle = useMemo(() => {
    if (exportGroups.length === 1) return `${exportGroups[0].bookTitle} - Extractions`;
    return undefined;
  }, [exportGroups]);

  const handleExportMd = useCallback(() => exportExtractionsMd(exportGroups, singleBookTitle), [exportGroups, singleBookTitle]);
  const handleExportTxt = useCallback(() => exportExtractionsTxt(exportGroups, singleBookTitle), [exportGroups, singleBookTitle]);
  const handleExportDocx = useCallback(async () => exportExtractionsDocx(exportGroups, singleBookTitle), [exportGroups, singleBookTitle]);

  // --- Render helpers ---

  const renderSummarySection = (book: BookExtractions) => {
    const visible = filterMode === 'hearted'
      ? book.summaries.filter((s) => s.is_hearted)
      : book.summaries;

    if (visible.length === 0) {
      return <div className="extraction-tab__empty"><p>{filterMode === 'hearted' ? 'No hearted summaries.' : 'No summaries extracted.'}</p></div>;
    }

    const sections = groupBySection(visible);
    const isExtracting = extractingBookTab === `${book.bookId}-summary`;

    return (
      <div className="extraction-tab">
        {isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        <div className="extraction-tab__toolbar">
          {confirmReRun === `${book.bookId}-summary` ? (
            <div className="extraction-tab__confirm">
              <span>Replace all summaries with fresh extraction?</span>
              <Button size="sm" onClick={() => handleReRun(book.bookId, 'summary')}>Re-run</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmReRun(null)}>Cancel</Button>
            </div>
          ) : (
            <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(`${book.bookId}-summary`)} disabled={isExtracting}>
              <RefreshCw size={12} /> Re-run
            </button>
          )}
        </div>

        {sections.map(([sectionKey, items]) => {
          const collapseKey = `${book.bookId}-summary-${sectionKey}`;
          const isCollapsed = collapsedSections.has(collapseKey);
          const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;

          return (
            <div key={sectionKey} className="extraction-tab__section">
              <button type="button" className="extraction-tab__section-header" onClick={() => toggleSection(collapseKey)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="extraction-tab__section-title">{label}</span>
                <span className="extraction-tab__section-count">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="extraction-tab__section-items">
                  {items.map((item) => (
                    <div key={item.id} className={`extraction-item${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(item.id) ? ' extraction-item--deleting' : ''}`}>
                      <div className="extraction-item__type-badge">{item.content_type.replace(/_/g, ' ')}</div>
                      <p className="extraction-item__text">
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {item.text}
                      </p>
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartSummary(item.id, item.is_hearted)}
                          title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_summaries', item.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="extraction-tab__go-deeper"
                    onClick={() => handleGoDeeper(
                      book.bookId,
                      'summary',
                      sectionKey === '__full_book__' ? undefined : sectionKey,
                      items.map((i) => i.text),
                      items[0]?.section_index,
                    )}
                    disabled={isExtracting}
                  >
                    Go Deeper
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFrameworksSection = (book: BookExtractions) => {
    const visible = filterMode === 'hearted'
      ? book.principles.filter((p) => p.is_hearted)
      : book.principles;

    if (visible.length === 0) {
      return <div className="extraction-tab__empty"><p>{filterMode === 'hearted' ? 'No hearted principles.' : 'No framework principles extracted.'}</p></div>;
    }

    const sections = groupBySection(
      visible.map((p) => ({ ...p, section_title: p.section_title || null, section_index: 0 })),
      '__general__',
    );

    return (
      <div className="extraction-tab">
        {sections.map(([sectionKey, items]) => {
          const collapseKey = `${book.bookId}-fw-${sectionKey}`;
          const isCollapsed = collapsedSections.has(collapseKey);
          const label = sectionKey === '__general__' ? 'General' : sectionKey;

          return (
            <div key={sectionKey} className="extraction-tab__section">
              <button type="button" className="extraction-tab__section-header" onClick={() => toggleSection(collapseKey)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="extraction-tab__section-title">{label}</span>
                <span className="extraction-tab__section-count">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="extraction-tab__section-items">
                  {items.map((item) => (
                    <div key={item.id} className={`extraction-item${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(item.id) ? ' extraction-item--deleting' : ''}`}>
                      <p className="extraction-item__text">
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {item.text}
                      </p>
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartPrinciple(item.id, item.is_hearted)}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('ai_framework_principles', item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderActionStepsSection = (book: BookExtractions) => {
    const visible = filterMode === 'hearted'
      ? book.actionSteps.filter((a) => a.is_hearted)
      : book.actionSteps;

    if (visible.length === 0) {
      return <div className="extraction-tab__empty"><p>{filterMode === 'hearted' ? 'No hearted action steps.' : 'No action steps extracted.'}</p></div>;
    }

    const sections = groupBySection(visible);
    const isExtracting = extractingBookTab === `${book.bookId}-action_steps`;

    return (
      <div className="extraction-tab">
        {isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        <div className="extraction-tab__toolbar">
          {confirmReRun === `${book.bookId}-action_steps` ? (
            <div className="extraction-tab__confirm">
              <span>Replace all action steps with fresh extraction?</span>
              <Button size="sm" onClick={() => handleReRun(book.bookId, 'action_steps')}>Re-run</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmReRun(null)}>Cancel</Button>
            </div>
          ) : (
            <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(`${book.bookId}-action_steps`)} disabled={isExtracting}>
              <RefreshCw size={12} /> Re-run
            </button>
          )}
        </div>

        {sections.map(([sectionKey, items]) => {
          const collapseKey = `${book.bookId}-action-${sectionKey}`;
          const isCollapsed = collapsedSections.has(collapseKey);
          const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;

          return (
            <div key={sectionKey} className="extraction-tab__section">
              <button type="button" className="extraction-tab__section-header" onClick={() => toggleSection(collapseKey)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="extraction-tab__section-title">{label}</span>
                <span className="extraction-tab__section-count">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="extraction-tab__section-items">
                  {items.map((item) => (
                    <div key={item.id} className={`extraction-item${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(item.id) ? ' extraction-item--deleting' : ''}`}>
                      <div className="extraction-item__type-badge">
                        {ACTION_STEP_CONTENT_TYPE_LABELS[item.content_type as ActionStepContentType] || item.content_type.replace(/_/g, ' ')}
                      </div>
                      <p className="extraction-item__text">
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {item.text}
                      </p>
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartActionStep(item.id, item.is_hearted)}
                          title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        {item.sent_to_compass ? (
                          <span className="extraction-item__compass-sent">In Compass</span>
                        ) : (
                          <button
                            type="button"
                            className="extraction-item__send-compass"
                            onClick={() => handleSendToCompass(item.id)}
                            disabled={sendingToCompass.has(item.id)}
                            title="Send to Compass"
                          >
                            <Compass size={14} />
                            {sendingToCompass.has(item.id) ? 'Sending...' : 'Send to Compass'}
                          </button>
                        )}
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_action_steps', item.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="extraction-tab__go-deeper"
                    onClick={() => handleGoDeeper(
                      book.bookId,
                      'action_steps',
                      sectionKey === '__full_book__' ? undefined : sectionKey,
                      items.map((i) => i.text),
                      items[0]?.section_index,
                    )}
                    disabled={isExtracting}
                  >
                    Go Deeper
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMastContentSection = (book: BookExtractions) => {
    const visible = filterMode === 'hearted'
      ? book.declarations.filter((d) => d.is_hearted)
      : book.declarations;

    if (visible.length === 0) {
      return <div className="extraction-tab__empty"><p>{filterMode === 'hearted' ? 'No hearted declarations.' : 'No declarations extracted.'}</p></div>;
    }

    const sections = groupBySection(visible);
    const isExtracting = extractingBookTab === `${book.bookId}-mast_content`;

    return (
      <div className="extraction-tab">
        {isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        <div className="extraction-tab__toolbar">
          {confirmReRun === `${book.bookId}-mast_content` ? (
            <div className="extraction-tab__confirm">
              <span>Replace all declarations with fresh extraction?</span>
              <Button size="sm" onClick={() => handleReRun(book.bookId, 'mast_content')}>Re-run</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmReRun(null)}>Cancel</Button>
            </div>
          ) : (
            <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(`${book.bookId}-mast_content`)} disabled={isExtracting}>
              <RefreshCw size={12} /> Re-run
            </button>
          )}
        </div>

        {sections.map(([sectionKey, items]) => {
          const collapseKey = `${book.bookId}-mast-${sectionKey}`;
          const isCollapsed = collapsedSections.has(collapseKey);
          const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;

          return (
            <div key={sectionKey} className="extraction-tab__section">
              <button type="button" className="extraction-tab__section-header" onClick={() => toggleSection(collapseKey)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="extraction-tab__section-title">{label}</span>
                <span className="extraction-tab__section-count">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="extraction-tab__section-items">
                  {items.map((item) => (
                    <div key={item.id} className={`extraction-item extraction-item--declaration${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(item.id) ? ' extraction-item--deleting' : ''}`}>
                      <div className="extraction-item__declaration-meta">
                        {item.value_name && <span className="extraction-item__value-name">{item.value_name}</span>}
                        <span className="extraction-item__style-label">{DECLARATION_STYLE_LABELS[item.declaration_style]}</span>
                      </div>
                      <p className="extraction-item__text extraction-item__text--declaration">
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        &ldquo;{item.declaration_text}&rdquo;
                      </p>
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartDeclaration(item.id, item.is_hearted)}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        {item.sent_to_mast ? (
                          <span className="extraction-item__mast-sent">In Mast</span>
                        ) : (
                          <button
                            type="button"
                            className="extraction-item__send-mast"
                            onClick={() => handleSendToMast(item.id)}
                            disabled={sendingToMast.has(item.id)}
                            title="Send to Mast"
                          >
                            <Anchor size={14} />
                            {sendingToMast.has(item.id) ? 'Sending...' : 'Send to Mast'}
                          </button>
                        )}
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_declarations', item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="extraction-tab__go-deeper"
                    onClick={() => handleGoDeeper(
                      book.bookId,
                      'mast_content',
                      sectionKey === '__full_book__' ? undefined : sectionKey,
                      items.map((i) => i.declaration_text),
                      items[0]?.section_index,
                    )}
                    disabled={isExtracting}
                  >
                    Go Deeper
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="extractions-view">
      <div className="extractions-view__header">
        <button type="button" className="extractions-view__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <h2 className="extractions-view__title">Extractions</h2>
      </div>

      {extractedItems.length === 0 ? (
        <div className="extractions-view__empty">
          No books with extractions yet. Extract content from a book's detail page first.
        </div>
      ) : (
        <>
          {/* Book selector */}
          <div className="extractions-view__books">
            <div className="extractions-view__books-label">
              Select books ({selectedIds.size} of {extractedItems.length})
            </div>
            {extractedItems.map((item) => (
              <label key={item.id} className="extractions-view__book-item">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => handleToggle(item.id)}
                />
                <span className="extractions-view__book-title">{item.title}</span>
              </label>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <>
              {/* Export row */}
              <div className="extractions-view__export-row">
                <button type="button" className="extractions-view__export-btn" onClick={handleExportMd}>
                  <FileCode size={12} /> Export .md
                </button>
                <button type="button" className="extractions-view__export-btn" onClick={handleExportDocx}>
                  <FileText size={12} /> Export .docx
                </button>
                <button type="button" className="extractions-view__export-btn" onClick={handleExportTxt}>
                  <Download size={12} /> Export .txt
                </button>
              </div>

              {/* Tabs + View Toggle */}
              <div className="extractions-view__tabs-row">
                <div className="extractions-view__tabs">
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'summary' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                  >
                    Summary {totalCounts.summaries > 0 && <span className="extractions-view__tab-count">{totalCounts.summaries}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'frameworks' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('frameworks')}
                  >
                    Frameworks {totalCounts.frameworks > 0 && <span className="extractions-view__tab-count">{totalCounts.frameworks}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'action_steps' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('action_steps')}
                  >
                    Action Steps {totalCounts.actionSteps > 0 && <span className="extractions-view__tab-count">{totalCounts.actionSteps}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'mast_content' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('mast_content')}
                  >
                    Mast Content {totalCounts.declarations > 0 && <span className="extractions-view__tab-count">{totalCounts.declarations}</span>}
                  </button>
                </div>
                <div className="extraction-tabs__view-toggle">
                  <button
                    type="button"
                    className={`extraction-tabs__view-btn${viewMode === 'tabs' ? ' extraction-tabs__view-btn--active' : ''}`}
                    onClick={() => setViewMode('tabs')}
                    title="View by tab"
                  >
                    <LayoutList size={14} />
                  </button>
                  <button
                    type="button"
                    className={`extraction-tabs__view-btn${viewMode === 'chapters' ? ' extraction-tabs__view-btn--active' : ''}`}
                    onClick={() => setViewMode('chapters')}
                    title="View by chapter"
                  >
                    <BookOpen size={14} />
                  </button>
                </div>
              </div>

              {/* Filter toggle */}
              <div className="extraction-tabs__filter">
                <button
                  type="button"
                  className={`extraction-tabs__filter-btn${filterMode === 'hearted' ? ' extraction-tabs__filter-btn--active' : ''}`}
                  onClick={() => setFilterMode((m) => m === 'hearted' ? 'all' : 'hearted')}
                >
                  <Heart size={12} fill={filterMode === 'hearted' ? 'currentColor' : 'none'} />
                  {filterMode === 'hearted' ? 'Hearted' : 'All'}
                </button>
              </div>

              {/* Content */}
              {loading ? (
                <div className="extractions-view__loading">Loading extractions...</div>
              ) : viewMode === 'chapters' ? (
                <div className="extractions-view__content">
                  {selectedData.map((group) => {
                    // Collect all unique section titles across all content types
                    const sectionMap = new Map<string, { index: number }>();
                    const addSections = (items: Array<{ section_title: string | null; section_index?: number }>) => {
                      for (const item of items) {
                        const key = item.section_title || '__full_book__';
                        if (!sectionMap.has(key)) sectionMap.set(key, { index: (item as { section_index?: number }).section_index ?? 0 });
                      }
                    };
                    const allItems = filterMode === 'hearted'
                      ? {
                          summaries: group.summaries.filter((s) => s.is_hearted),
                          principles: group.principles.filter((p) => p.is_hearted),
                          actionSteps: group.actionSteps.filter((a) => a.is_hearted),
                          declarations: group.declarations.filter((d) => d.is_hearted),
                        }
                      : group;
                    addSections(allItems.summaries);
                    addSections(allItems.principles.map((p) => ({ ...p, section_title: p.section_title || null })));
                    addSections(allItems.actionSteps);
                    addSections(allItems.declarations);
                    const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => a[1].index - b[1].index);

                    return (
                      <div key={group.bookId} className="extractions-view__book-section">
                        <button
                          type="button"
                          className="extractions-view__book-heading"
                          onClick={() => toggleBook(group.bookId)}
                        >
                          {collapsedBooks.has(group.bookId) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <span>{group.bookTitle}</span>
                        </button>

                        {!collapsedBooks.has(group.bookId) && sortedSections.map(([sectionKey]) => {
                          const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;
                          const collapseKey = `${group.bookId}-ch-${sectionKey}`;
                          const isCollapsed = collapsedSections.has(collapseKey);
                          const secSummaries = allItems.summaries.filter((s) => (s.section_title || '__full_book__') === sectionKey);
                          const secPrinciples = allItems.principles.filter((p) => ((p.section_title as string | null) || '__full_book__') === sectionKey);
                          const secActions = allItems.actionSteps.filter((a) => (a.section_title || '__full_book__') === sectionKey);
                          const secDeclarations = allItems.declarations.filter((d) => (d.section_title || '__full_book__') === sectionKey);

                          return (
                            <div key={sectionKey} className="chapter-view__chapter">
                              <button type="button" className="chapter-view__chapter-header" onClick={() => toggleSection(collapseKey)}>
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                <span className="chapter-view__chapter-title">{label}</span>
                              </button>

                              {!isCollapsed && (
                                <div className="chapter-view__chapter-content">
                                  {secSummaries.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Summary</h5>
                                      {secSummaries.map((s) => (
                                        <div key={s.id} className={`extraction-item${s.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
                                          <div className="extraction-item__type-badge">{s.content_type.replace(/_/g, ' ')}</div>
                                          <p className="extraction-item__text">{s.text}</p>
                                          {s.is_hearted && <Heart size={12} className="chapter-view__heart-indicator" fill="currentColor" />}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secPrinciples.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Frameworks</h5>
                                      {secPrinciples.map((p) => (
                                        <div key={p.id} className={`extraction-item${p.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
                                          <p className="extraction-item__text">{p.text}</p>
                                          {p.is_hearted && <Heart size={12} className="chapter-view__heart-indicator" fill="currentColor" />}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secActions.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Action Steps</h5>
                                      {secActions.map((a) => (
                                        <div key={a.id} className={`extraction-item${a.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
                                          <div className="extraction-item__type-badge">
                                            {ACTION_STEP_CONTENT_TYPE_LABELS[a.content_type as ActionStepContentType] || a.content_type.replace(/_/g, ' ')}
                                          </div>
                                          <p className="extraction-item__text">{a.text}</p>
                                          {a.is_hearted && <Heart size={12} className="chapter-view__heart-indicator" fill="currentColor" />}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secDeclarations.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Mast Content</h5>
                                      {secDeclarations.map((d) => (
                                        <div key={d.id} className={`extraction-item extraction-item--declaration${d.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
                                          <div className="extraction-item__declaration-meta">
                                            {d.value_name && <span className="extraction-item__value-name">{d.value_name}</span>}
                                            <span className="extraction-item__style-label">{DECLARATION_STYLE_LABELS[d.declaration_style]}</span>
                                          </div>
                                          <p className="extraction-item__text extraction-item__text--declaration">&ldquo;{d.declaration_text}&rdquo;</p>
                                          {d.is_hearted && <Heart size={12} className="chapter-view__heart-indicator" fill="currentColor" />}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="extractions-view__content">
                  {selectedData.map((group) => (
                    <div key={group.bookId} className="extractions-view__book-section">
                      <button
                        type="button"
                        className="extractions-view__book-heading"
                        onClick={() => toggleBook(group.bookId)}
                      >
                        {collapsedBooks.has(group.bookId) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        <span>{group.bookTitle}</span>
                      </button>

                      {!collapsedBooks.has(group.bookId) && (
                        <>
                          {activeTab === 'summary' && renderSummarySection(group)}
                          {activeTab === 'frameworks' && renderFrameworksSection(group)}
                          {activeTab === 'action_steps' && renderActionStepsSection(group)}
                          {activeTab === 'mast_content' && renderMastContentSection(group)}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
