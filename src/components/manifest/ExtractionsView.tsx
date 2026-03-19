import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Download, ChevronDown, ChevronRight, Trash2, Anchor, Compass, MessageCircle, RefreshCw, Sparkles, LayoutList, BookOpen, StickyNote, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTagUsage } from '../../hooks/useTagUsage';
import type { ManifestItem, ManifestSummary, ManifestDeclaration, ManifestActionStep, ManifestQuestion, AIFrameworkPrinciple, BookGenre } from '../../lib/types';
import { DECLARATION_STYLE_LABELS, ACTION_STEP_CONTENT_TYPE_LABELS, QUESTION_CONTENT_TYPE_LABELS, MANIFEST_SUMMARY_COLUMNS, MANIFEST_DECLARATION_COLUMNS, MANIFEST_ACTION_STEP_COLUMNS, MANIFEST_QUESTION_COLUMNS, AI_FRAMEWORK_PRINCIPLE_COLUMNS } from '../../lib/types';
import type { ActionStepContentType, QuestionContentType } from '../../lib/types';
import type { BookExtractionGroup } from '../../lib/exportExtractions';
import { ExportDialog } from './ExportDialog';
import { Button, TagPills } from '../shared';
import './ExtractionsView.css';
import './ExtractionTabs.css';

interface ExtractionsViewProps {
  items: ManifestItem[];
  onBack?: () => void;
  favoritesMode?: boolean;
  collectionName?: string;
}

type TabType = 'summary' | 'frameworks' | 'action_steps' | 'mast_content' | 'questions';
type FilterMode = 'all' | 'hearted';
type ViewMode = 'tabs' | 'chapters' | 'notes';

interface BookExtractions {
  bookId: string;
  bookTitle: string;
  genres: BookGenre[];
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps: ManifestActionStep[];
  questions: ManifestQuestion[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
  frameworkTags: string[];
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

// --- sessionStorage helpers ---
const evSsGet = (key: string): string | null => { try { return sessionStorage.getItem(key); } catch { return null; } };
const evSsSet = (key: string, v: string) => { try { sessionStorage.setItem(key, v); } catch { /* */ } };

export function ExtractionsView({ items, onBack, favoritesMode, collectionName }: ExtractionsViewProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const handleBack = onBack || (() => navigate('/manifest'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const stored = evSsGet('manifest-ev-active-tab');
    if (stored === 'summary' || stored === 'frameworks' || stored === 'action_steps' || stored === 'mast_content' || stored === 'questions') return stored;
    return 'summary';
  });
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    if (favoritesMode) return 'hearted';
    const stored = evSsGet('manifest-ev-filter-mode');
    return stored === 'hearted' ? 'hearted' : 'all';
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = evSsGet('manifest-ev-extraction-view');
    if (stored === 'tabs' || stored === 'chapters' || stored === 'notes') return stored;
    return 'tabs';
  });
  const [bookData, setBookData] = useState<Map<string, BookExtractions>>(new Map());
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const stored = evSsGet('manifest-ev-collapsed-sections');
    if (stored) { try { return new Set(JSON.parse(stored)); } catch { /* */ } }
    return new Set();
  });
  const [collapsedBooks, setCollapsedBooks] = useState<Set<string>>(() => {
    const stored = evSsGet('manifest-ev-collapsed-books');
    if (stored) { try { return new Set(JSON.parse(stored)); } catch { /* */ } }
    return new Set();
  });
  // Persist ExtractionsView state to sessionStorage on change
  useEffect(() => { evSsSet('manifest-ev-active-tab', activeTab); }, [activeTab]);
  useEffect(() => { evSsSet('manifest-ev-filter-mode', filterMode); }, [filterMode]);
  useEffect(() => { evSsSet('manifest-ev-extraction-view', viewMode); }, [viewMode]);
  useEffect(() => { evSsSet('manifest-ev-collapsed-sections', JSON.stringify([...collapsedSections])); }, [collapsedSections]);
  useEffect(() => { evSsSet('manifest-ev-collapsed-books', JSON.stringify([...collapsedBooks])); }, [collapsedBooks]);

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [extractingBookTab, setExtractingBookTab] = useState<string | null>(null);
  const [confirmReRun, setConfirmReRun] = useState<string | null>(null); // bookId or null
  const [sendingToMast, setSendingToMast] = useState<Set<string>>(new Set());
  const [sendingToCompass, setSendingToCompass] = useState<Set<string>>(new Set());
  const [sendingToPrompts, setSendingToPrompts] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [extractionSearch, setExtractionSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [activeBookTags, setActiveBookTags] = useState<Set<string>>(new Set());
  const [booksExpanded, setBooksExpanded] = useState(true);
  const { counts: tagUsageCounts, recordTagClick } = useTagUsage();

  // Multi-part book support: fetch child parts for parents
  const [childPartsMap, setChildPartsMap] = useState<Map<string, ManifestItem[]>>(new Map());

  const parentItems = useMemo(
    () => items.filter((i) => (i.part_count ?? 0) > 0),
    [items],
  );

  useEffect(() => {
    if (!user || parentItems.length === 0) return;
    let cancelled = false;
    (async () => {
      const parentIds = parentItems.map((p) => p.id);
      const { data } = await supabase
        .from('manifest_items')
        .select('id, user_id, title, file_type, file_name, storage_path, file_size_bytes, usage_designations, tags, folder_group, processing_status, processing_detail, chunk_count, intake_completed, ai_summary, extraction_status, genres, source_manifest_item_id, parent_manifest_item_id, part_number, part_count, archived_at, created_at, updated_at')
        .in('parent_manifest_item_id', parentIds)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('part_number', { ascending: true });
      if (cancelled || !data) return;
      const map = new Map<string, ManifestItem[]>();
      for (const part of data as ManifestItem[]) {
        const pid = part.parent_manifest_item_id!;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(part);
      }
      setChildPartsMap(map);
    })();
    return () => { cancelled = true; };
  }, [user, parentItems]);

  // Single-volume extracted items (no parts)
  const extractedSingleItems = useMemo(
    () => items.filter((i) =>
      (i.part_count ?? 0) === 0 && (
        i.extraction_status === 'completed' ||
        i.extraction_status === 'failed' ||
        i.extraction_status === 'extracting'
      )
    ),
    [items],
  );

  // Parents that have at least one extracted part
  const extractedParents = useMemo(
    () => parentItems.filter((p) => {
      const parts = childPartsMap.get(p.id);
      return parts?.some((c) =>
        c.extraction_status === 'completed' ||
        c.extraction_status === 'failed' ||
        c.extraction_status === 'extracting'
      );
    }),
    [parentItems, childPartsMap],
  );

  // Combined list for counting and tag gathering (singles + extracted parts)
  const allExtractedPartItems = useMemo(() => {
    const parts: ManifestItem[] = [];
    for (const parent of extractedParents) {
      const children = childPartsMap.get(parent.id) || [];
      for (const c of children) {
        if (c.extraction_status === 'completed' || c.extraction_status === 'failed' || c.extraction_status === 'extracting') {
          parts.push(c);
        }
      }
    }
    return parts;
  }, [extractedParents, childPartsMap]);

  const extractedItems = useMemo(
    () => [...extractedSingleItems, ...allExtractedPartItems],
    [extractedSingleItems, allExtractedPartItems],
  );

  // No auto-select: books start unchecked so user picks what they want

  // Unique book-level tags with counts for filtering
  const bookTagData = useMemo(() => {
    const counts: Record<string, number> = {};
    // Count from singles
    for (const item of extractedSingleItems) {
      for (const tag of (item.tags || [])) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    // Count from parents (use parent tags for the whole book)
    for (const parent of extractedParents) {
      for (const tag of (parent.tags || [])) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts);
  }, [extractedSingleItems, extractedParents]);

  // Tag toggle helpers with usage tracking
  const handleBookTagToggle = useCallback((tag: string) => {
    recordTagClick(tag);
    setActiveBookTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, [recordTagClick]);

  const handleFrameworkTagToggle = useCallback((tag: string) => {
    recordTagClick(tag);
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, [recordTagClick]);

  // Helper: get extracted part IDs for a parent
  const getExtractedPartIds = useCallback((parentId: string): string[] => {
    const parts = childPartsMap.get(parentId) || [];
    return parts
      .filter((c) => c.extraction_status === 'completed' || c.extraction_status === 'failed' || c.extraction_status === 'extracting')
      .map((c) => c.id);
  }, [childPartsMap]);

  // Filter singles by search + active book tags
  const filteredSingles = useMemo(() => {
    let result = extractedSingleItems;
    if (bookSearch.trim()) {
      const q = bookSearch.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeBookTags.size > 0) {
      result = result.filter((i) =>
        Array.from(activeBookTags).some((tag) => (i.tags || []).includes(tag))
      );
    }
    return result;
  }, [extractedSingleItems, bookSearch, activeBookTags]);

  // Filter parents by search + tags (use parent title/tags)
  const filteredParents = useMemo(() => {
    let result = extractedParents;
    if (bookSearch.trim()) {
      const q = bookSearch.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeBookTags.size > 0) {
      result = result.filter((i) =>
        Array.from(activeBookTags).some((tag) => (i.tags || []).includes(tag))
      );
    }
    return result;
  }, [extractedParents, bookSearch, activeBookTags]);

  // Combined filtered list for "Select All" and count display — preserves items prop order
  const filteredBooks = useMemo(() => {
    const singleIds = new Set(filteredSingles.map((i) => i.id));
    const parentIds = new Set(filteredParents.map((i) => i.id));
    const all: ManifestItem[] = [];
    for (const item of items) {
      if ((item.part_count ?? 0) > 0) {
        if (parentIds.has(item.id)) {
          const parts = childPartsMap.get(item.id) || [];
          for (const part of parts) {
            if (part.extraction_status === 'completed' || part.extraction_status === 'failed' || part.extraction_status === 'extracting') {
              all.push(part);
            }
          }
        }
      } else if (singleIds.has(item.id)) {
        all.push(item);
      }
    }
    return all;
  }, [items, filteredSingles, filteredParents, childPartsMap]);

  // Ordered book list for rendering — preserves items prop order (collection order)
  type BookListEntry = { type: 'single'; item: ManifestItem } | { type: 'parent'; item: ManifestItem; parts: ManifestItem[] };
  const orderedBookList = useMemo((): BookListEntry[] => {
    const singleIds = new Set(filteredSingles.map((i) => i.id));
    const parentIds = new Set(filteredParents.map((i) => i.id));
    const result: BookListEntry[] = [];
    for (const item of items) {
      if ((item.part_count ?? 0) > 0) {
        if (parentIds.has(item.id)) {
          const parts = (childPartsMap.get(item.id) || []).filter((c) =>
            c.extraction_status === 'completed' || c.extraction_status === 'failed' || c.extraction_status === 'extracting'
          );
          if (parts.length > 0) result.push({ type: 'parent', item, parts });
        }
      } else if (singleIds.has(item.id)) {
        result.push({ type: 'single', item });
      }
    }
    return result;
  }, [items, filteredSingles, filteredParents, childPartsMap]);

  // Fetch extractions for selected books, batched to avoid Supabase row limits
  const fetchExtractions = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setLoading(true);

    try {
      // Batch by 5 books at a time — each batch fetches all 4 tables in parallel
      const BATCH_SIZE = 5;
      const allSummaries: ManifestSummary[] = [];
      const allDeclarations: ManifestDeclaration[] = [];
      const allPrinciples: Array<AIFrameworkPrinciple & { ai_frameworks: { manifest_item_id: string; name: string; tags: string[] | null } }> = [];
      const allActionSteps: ManifestActionStep[] = [];
      const allQuestions: ManifestQuestion[] = [];

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const [summaryRes, declRes, principleRes, actionStepRes, questionRes] = await Promise.all([
          supabase
            .from('manifest_summaries')
            .select(MANIFEST_SUMMARY_COLUMNS)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .in('manifest_item_id', batchIds)
            .order('manifest_item_id')
            .order('section_index', { ascending: true })
            .order('sort_order', { ascending: true })
            .limit(10000),
          supabase
            .from('manifest_declarations')
            .select(MANIFEST_DECLARATION_COLUMNS)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .in('manifest_item_id', batchIds)
            .order('manifest_item_id')
            .order('section_index', { ascending: true })
            .order('sort_order', { ascending: true })
            .limit(10000),
          supabase
            .from('ai_framework_principles')
            .select(`${AI_FRAMEWORK_PRINCIPLE_COLUMNS}, ai_frameworks!inner(manifest_item_id, name, tags)`)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .in('ai_frameworks.manifest_item_id', batchIds)
            .order('sort_order', { ascending: true })
            .limit(10000),
          supabase
            .from('manifest_action_steps')
            .select(MANIFEST_ACTION_STEP_COLUMNS)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .in('manifest_item_id', batchIds)
            .order('manifest_item_id')
            .order('section_index', { ascending: true })
            .order('sort_order', { ascending: true })
            .limit(10000),
          supabase
            .from('manifest_questions')
            .select(MANIFEST_QUESTION_COLUMNS)
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .in('manifest_item_id', batchIds)
            .order('manifest_item_id')
            .order('section_index', { ascending: true })
            .order('sort_order', { ascending: true })
            .limit(10000),
        ]);
        allSummaries.push(...(summaryRes.data || []) as ManifestSummary[]);
        allDeclarations.push(...(declRes.data || []) as ManifestDeclaration[]);
        allPrinciples.push(...(principleRes.data || []) as unknown as typeof allPrinciples);
        allActionSteps.push(...(actionStepRes.data || []) as ManifestActionStep[]);
        allQuestions.push(...(questionRes.data || []) as ManifestQuestion[]);
      }

      const newData = new Map<string, BookExtractions>();
      for (const id of ids) {
        const item = extractedItems.find((i) => i.id === id);
        const bookPrinciples = allPrinciples.filter((p) => p.ai_frameworks.manifest_item_id === id);
        // Collect unique tags from all frameworks associated with this book
        const tagSet = new Set<string>();
        bookPrinciples.forEach((p) => {
          (p.ai_frameworks.tags || []).forEach((t) => tagSet.add(t));
        });
        newData.set(id, {
          bookId: id,
          bookTitle: item?.title || 'Unknown Book',
          genres: (item?.genres || []) as BookGenre[],
          summaries: allSummaries.filter((s) => s.manifest_item_id === id),
          declarations: allDeclarations.filter((d) => d.manifest_item_id === id),
          actionSteps: allActionSteps.filter((a) => a.manifest_item_id === id),
          questions: allQuestions.filter((q) => q.manifest_item_id === id),
          principles: bookPrinciples.map((p) => ({ ...p, framework_name: p.ai_frameworks.name })),
          frameworkTags: Array.from(tagSet),
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

  // Default all chapter sections to collapsed when book data loads
  // Re-runs whenever books change; merges new collapsed keys with existing state
  // so manually expanded sections stay expanded
  const prevBookIdsRef = useRef<string>('');
  useEffect(() => {
    if (bookData.size === 0) return;
    const currentBookIds = Array.from(bookData.keys()).sort().join(',');
    if (currentBookIds === prevBookIdsRef.current) return;
    prevBookIdsRef.current = currentBookIds;

    const keys: string[] = [];
    for (const [bookId, book] of bookData) {
      const allSectionKeys = new Set<string>();
      for (const s of book.summaries) allSectionKeys.add(s.section_title || '__full_book__');
      for (const p of book.principles) allSectionKeys.add(p.section_title || '__general__');
      for (const a of book.actionSteps) allSectionKeys.add(a.section_title || '__full_book__');
      for (const d of book.declarations) allSectionKeys.add(d.section_title || '__full_book__');
      for (const q of book.questions) allSectionKeys.add(q.section_title || '__full_book__');

      if (allSectionKeys.size > 1) {
        const tabTypes = ['summary', 'frameworks', 'action_steps', 'mast_content', 'questions'] as const;
        for (const tab of tabTypes) {
          const items = tab === 'summary' ? book.summaries
            : tab === 'frameworks' ? book.principles
            : tab === 'action_steps' ? book.actionSteps
            : tab === 'questions' ? book.questions
            : book.declarations;
          const tabSectionKeys = new Set(items.map((i: { section_title: string | null }) => i.section_title || (tab === 'frameworks' ? '__general__' : '__full_book__')));
          for (const sk of tabSectionKeys) {
            keys.push(`${bookId}-${tab}-${sk}`);
          }
        }
        for (const sk of allSectionKeys) {
          keys.push(`${bookId}-ch-${sk}`);
        }
      }
    }
    if (keys.length > 0) {
      setCollapsedSections(new Set(keys));
    }
  }, [bookData]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle all extracted parts of a parent at once
  const handleToggleParent = useCallback((parentId: string) => {
    const partIds = getExtractedPartIds(parentId);
    if (partIds.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = partIds.every((id) => next.has(id));
      if (allSelected) {
        partIds.forEach((id) => next.delete(id));
      } else {
        partIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [getExtractedPartIds]);

  // Iterate in items prop order so collection/library order is preserved
  const selectedData = useMemo(() => {
    const result: BookExtractions[] = [];
    for (const item of items) {
      if ((item.part_count ?? 0) > 0) {
        // Multi-part parent: add extracted parts in item order
        const parts = childPartsMap.get(item.id) || [];
        for (const part of parts) {
          if (selectedIds.has(part.id)) {
            const data = bookData.get(part.id);
            if (data) result.push(data);
          }
        }
      } else {
        if (selectedIds.has(item.id)) {
          const data = bookData.get(item.id);
          if (data) result.push(data);
        }
      }
    }
    return result;
  }, [items, selectedIds, bookData, childPartsMap]);

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

  const handleHeartQuestion = useCallback(async (id: string, currentVal: boolean) => {
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const idx = book.questions.findIndex((q) => q.id === id);
        if (idx >= 0) {
          const updated = { ...book, questions: [...book.questions] };
          updated.questions[idx] = { ...updated.questions[idx], is_hearted: !currentVal };
          next.set(bookId, updated);
          break;
        }
      }
      return next;
    });
    await toggleHeart('manifest_questions', id, currentVal);
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
          updated.questions = book.questions.filter((q) => q.id !== id);
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

  // --- Send to Prompts ---
  const handleSendToPrompts = useCallback(async (questionId: string) => {
    if (!user) return;
    setSendingToPrompts((prev) => new Set(prev).add(questionId));
    try {
      let questionData: ManifestQuestion | undefined;
      let bookTitle: string | undefined;
      for (const book of bookData.values()) {
        questionData = book.questions.find((q) => q.id === questionId);
        if (questionData) { bookTitle = book.bookTitle; break; }
      }
      if (!questionData) return;

      const { data: prompt } = await supabase
        .from('journal_prompts')
        .insert({
          user_id: user.id,
          prompt_text: questionData.text,
          source: 'manifest_extraction',
          source_reference_id: questionData.id,
          source_book_title: bookTitle || null,
          tags: [],
          sort_order: 0,
        })
        .select('id')
        .single();

      if (prompt) {
        await supabase.from('manifest_questions')
          .update({ sent_to_prompts: true, journal_prompt_id: prompt.id })
          .eq('id', questionId).eq('user_id', user.id);

        setBookData((prev) => {
          const next = new Map(prev);
          for (const [bookId, book] of next) {
            const idx = book.questions.findIndex((q) => q.id === questionId);
            if (idx >= 0) {
              const updated = { ...book, questions: [...book.questions] };
              updated.questions[idx] = { ...updated.questions[idx], sent_to_prompts: true, journal_prompt_id: prompt.id };
              next.set(bookId, updated);
              break;
            }
          }
          return next;
        });
      }
    } finally {
      setSendingToPrompts((prev) => { const n = new Set(prev); n.delete(questionId); return n; });
    }
  }, [user, bookData]);

  // --- Inline Edit ---
  const startEditing = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  }, []);

  const handleSaveEdit = useCallback(async (table: string, id: string, field: string) => {
    if (!user || !editingText.trim()) { setEditingId(null); return; }
    await supabase.from(table).update({ [field]: editingText.trim() }).eq('id', id).eq('user_id', user.id);
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const updated = { ...book };
        updated.summaries = book.summaries.map((s) => s.id === id ? { ...s, [field]: editingText.trim() } : s);
        updated.principles = book.principles.map((p) => p.id === id ? { ...p, [field]: editingText.trim() } : p);
        updated.actionSteps = book.actionSteps.map((a) => a.id === id ? { ...a, [field]: editingText.trim() } : a);
        updated.questions = book.questions.map((q) => q.id === id ? { ...q, [field]: editingText.trim() } : q);
        updated.declarations = book.declarations.map((d) => d.id === id ? { ...d, [field]: editingText.trim() } : d);
        next.set(bookId, updated);
      }
      return next;
    });
    setEditingId(null);
  }, [user, editingText]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  // --- User Notes ---
  const startNoting = useCallback((id: string, note: string | null) => {
    setNotingId(id);
    setNoteDraft(note || '');
  }, []);

  const handleSaveNote = useCallback(async (table: string, id: string) => {
    if (!user) { setNotingId(null); return; }
    const noteVal = noteDraft.trim() || null;
    await supabase.from(table).update({ user_note: noteVal }).eq('id', id).eq('user_id', user.id);
    setBookData((prev) => {
      const next = new Map(prev);
      for (const [bookId, book] of next) {
        const updated = { ...book };
        updated.summaries = book.summaries.map((s) => s.id === id ? { ...s, user_note: noteVal } : s);
        updated.principles = book.principles.map((p) => p.id === id ? { ...p, user_note: noteVal } : p);
        updated.actionSteps = book.actionSteps.map((a) => a.id === id ? { ...a, user_note: noteVal } : a);
        updated.questions = book.questions.map((q) => q.id === id ? { ...q, user_note: noteVal } : q);
        updated.declarations = book.declarations.map((d) => d.id === id ? { ...d, user_note: noteVal } : d);
        next.set(bookId, updated);
      }
      return next;
    });
    setNotingId(null);
  }, [user, noteDraft]);

  // --- Go Deeper ---
  const handleGoDeeper = useCallback(async (
    bookId: string,
    tabType: 'summary' | 'mast_content' | 'action_steps' | 'questions',
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
      const extractionType = tabType === 'summary' ? 'summary' : tabType === 'action_steps' ? 'action_steps' : tabType === 'questions' ? 'questions' : 'mast_content';
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
        } else if (tabType === 'questions') {
          const VALID_QUESTION_TYPES = ['reflection', 'implementation', 'recognition', 'self_examination', 'discussion', 'scenario'];
          const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
            user_id: user.id,
            manifest_item_id: bookId,
            section_title: sectionTitle || null,
            section_index: sectionIndex ?? 0,
            content_type: VALID_QUESTION_TYPES.includes(item.content_type) ? item.content_type : 'reflection',
            text: item.text,
            sort_order: item.sort_order ?? idx,
            is_from_go_deeper: true,
          }));
          await supabase.from('manifest_questions').insert(records);
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
  const handleReRun = useCallback(async (bookId: string, tabType: 'summary' | 'mast_content' | 'action_steps' | 'questions') => {
    if (!user) return;
    const book = bookData.get(bookId);
    if (!book) return;

    const key = `${bookId}-${tabType}`;
    setExtractingBookTab(key);
    setConfirmReRun(null);

    try {
      const table = tabType === 'summary' ? 'manifest_summaries' : tabType === 'action_steps' ? 'manifest_action_steps' : tabType === 'questions' ? 'manifest_questions' : 'manifest_declarations';

      // Soft-delete all items for this book + tab
      await supabase.from(table)
        .update({ is_deleted: true })
        .eq('manifest_item_id', bookId)
        .eq('user_id', user.id);

      // Re-extract from whole document
      const extractionType = tabType === 'summary' ? 'summary' : tabType === 'action_steps' ? 'action_steps' : tabType === 'questions' ? 'questions' : 'mast_content';
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
          } else if (tabType === 'questions') {
            const VALID_QUESTION_TYPES = ['reflection', 'implementation', 'recognition', 'self_examination', 'discussion', 'scenario'];
            const records = items.map((item: { content_type: string; text: string; sort_order: number }, idx: number) => ({
              user_id: user.id,
              manifest_item_id: bookId,
              section_title: null,
              section_index: 0,
              content_type: VALID_QUESTION_TYPES.includes(item.content_type) ? item.content_type : 'reflection',
              text: item.text,
              sort_order: item.sort_order ?? idx,
              is_from_go_deeper: false,
            }));
            await supabase.from('manifest_questions').insert(records);
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

  // Derive sorted tag list from all selected books' frameworks (most-used first)
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of selectedData) {
      d.frameworkTags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [selectedData]);

  // Filter by tag + favorites mode
  const visibleData = useMemo(() => {
    let data = selectedData;

    // In favorites mode, filter out books with no hearted items
    if (favoritesMode) {
      data = data.filter((d) =>
        d.summaries.some((s) => s.is_hearted) ||
        d.principles.some((p) => p.is_hearted) ||
        d.actionSteps.some((a) => a.is_hearted) ||
        d.questions.some((q) => q.is_hearted) ||
        d.declarations.some((dc) => dc.is_hearted)
      );
    }

    // Filter by active tags (books whose frameworks include any selected tag)
    if (activeTags.size > 0) {
      data = data.filter((d) => Array.from(activeTags).some((t) => d.frameworkTags.includes(t)));
    }

    // Text search filter — filter items within each book group
    if (extractionSearch.trim()) {
      const q = extractionSearch.trim().toLowerCase();
      data = data.map((d) => ({
        ...d,
        summaries: d.summaries.filter((s) => s.text.toLowerCase().includes(q) || s.user_note?.toLowerCase().includes(q)),
        principles: d.principles.filter((p) => p.text.toLowerCase().includes(q) || p.user_note?.toLowerCase().includes(q)),
        actionSteps: d.actionSteps.filter((a) => a.text.toLowerCase().includes(q) || a.user_note?.toLowerCase().includes(q)),
        questions: d.questions.filter((qn) => qn.text.toLowerCase().includes(q) || qn.user_note?.toLowerCase().includes(q)),
        declarations: d.declarations.filter((dc) => dc.declaration_text.toLowerCase().includes(q) || dc.user_note?.toLowerCase().includes(q)),
      })).filter((d) => d.summaries.length > 0 || d.principles.length > 0 || d.actionSteps.length > 0 || d.questions.length > 0 || d.declarations.length > 0);
    }

    return data;
  }, [favoritesMode, activeTags, extractionSearch, selectedData]);

  // Counts that reflect what's actually displayed (respects filter mode + tag)
  const displayCounts = useMemo(() => {
    const useHearted = favoritesMode || filterMode === 'hearted';
    let summaries = 0, frameworks = 0, declarations = 0, actionSteps = 0, questions = 0, notes = 0;
    for (const d of visibleData) {
      const vs = useHearted ? d.summaries.filter((s) => s.is_hearted) : d.summaries;
      const vp = useHearted ? d.principles.filter((p) => p.is_hearted) : d.principles;
      const va = useHearted ? d.actionSteps.filter((a) => a.is_hearted) : d.actionSteps;
      const vq = useHearted ? d.questions.filter((q) => q.is_hearted) : d.questions;
      const vd = useHearted ? d.declarations.filter((dc) => dc.is_hearted) : d.declarations;
      summaries += vs.length;
      frameworks += vp.length;
      actionSteps += va.length;
      questions += vq.length;
      declarations += vd.length;
      notes += vs.filter((s) => s.user_note).length + vp.filter((p) => p.user_note).length + va.filter((a) => a.user_note).length + vq.filter((q) => q.user_note).length + vd.filter((dc) => dc.user_note).length;
    }
    return { summaries, frameworks, declarations, actionSteps, questions, notes };
  }, [favoritesMode, filterMode, visibleData]);

  // --- Export ---
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'extractions' | 'hearted' | 'notes'>('extractions');

  // Build a reverse map: part ID → parent item (for merging multi-part books)
  const partToParent = useMemo(() => {
    const map = new Map<string, ManifestItem>();
    for (const [parentId, parts] of childPartsMap) {
      const parent = parentItems.find((p) => p.id === parentId);
      if (parent) {
        for (const part of parts) map.set(part.id, parent);
      }
    }
    return map;
  }, [childPartsMap, parentItems]);

  const exportGroups = useMemo((): BookExtractionGroup[] => {
    // Merge parts that share a parent into one group, keep singles as-is
    const groupMap = new Map<string, BookExtractionGroup>();
    const order: string[] = [];

    for (const d of selectedData) {
      const parent = partToParent.get(d.bookId);
      if (parent) {
        // This is a part — merge into parent group
        const key = parent.id;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            bookTitle: parent.title,
            summaries: [],
            declarations: [],
            actionSteps: [],
            questions: [],
            principles: [],
          });
          order.push(key);
        }
        const group = groupMap.get(key)!;
        group.summaries.push(...d.summaries);
        group.declarations.push(...d.declarations);
        (group.actionSteps ??= []).push(...d.actionSteps);
        (group.questions ??= []).push(...d.questions);
        group.principles.push(...d.principles);
      } else {
        // Single book — add directly
        const key = d.bookId;
        groupMap.set(key, {
          bookTitle: d.bookTitle,
          summaries: d.summaries,
          declarations: d.declarations,
          actionSteps: d.actionSteps,
          questions: d.questions,
          principles: d.principles,
        });
        order.push(key);
      }
    }

    return order.map((key) => groupMap.get(key)!);
  }, [selectedData, partToParent]);

  const singleBookTitle = useMemo(() => {
    if (collectionName) return collectionName;
    if (exportGroups.length === 1) return `${exportGroups[0].bookTitle} - ${favoritesMode ? 'Favorites' : 'Extractions'}`;
    return undefined;
  }, [exportGroups, favoritesMode, collectionName]);

  const notesTitle = useMemo(() => {
    if (exportGroups.length === 1) return `${exportGroups[0].bookTitle} - My Notes`;
    return undefined;
  }, [exportGroups]);

  const openExportDialog = useCallback((mode: 'extractions' | 'hearted' | 'notes') => {
    setExportMode(mode);
    setShowExportDialog(true);
  }, []);

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
        {!favoritesMode && isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        {!favoritesMode && (
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
        )}

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
                      {editingId === item.id ? (
                        <textarea
                          className="extraction-item__edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit('manifest_summaries', item.id, 'text')}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(item.id, item.text)}>
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                      )}
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartSummary(item.id, item.is_hearted)}
                          title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                          onClick={() => notingId === item.id ? handleSaveNote('manifest_summaries', item.id) : startNoting(item.id, item.user_note)}
                          title={item.user_note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={14} />
                        </button>
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_summaries', item.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {notingId === item.id ? (
                        <textarea
                          className="extraction-item__note-textarea"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => handleSaveNote('manifest_summaries', item.id)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                          autoFocus
                          rows={2}
                          placeholder="Add a note..."
                        />
                      ) : item.user_note ? (
                        <div className="extraction-item__note" onClick={() => startNoting(item.id, item.user_note)}>
                          <span className="extraction-item__note-label">NOTE</span>
                          {item.user_note}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!favoritesMode && (
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
                  )}
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
                      {editingId === item.id ? (
                        <textarea
                          className="extraction-item__edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit('ai_framework_principles', item.id, 'text')}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(item.id, item.text)}>
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                      )}
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartPrinciple(item.id, item.is_hearted)}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                          onClick={() => notingId === item.id ? handleSaveNote('ai_framework_principles', item.id) : startNoting(item.id, item.user_note)}
                          title={item.user_note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={14} />
                        </button>
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('ai_framework_principles', item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {notingId === item.id ? (
                        <textarea
                          className="extraction-item__note-textarea"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => handleSaveNote('ai_framework_principles', item.id)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                          autoFocus
                          rows={2}
                          placeholder="Add a note..."
                        />
                      ) : item.user_note ? (
                        <div className="extraction-item__note" onClick={() => startNoting(item.id, item.user_note)}>
                          <span className="extraction-item__note-label">NOTE</span>
                          {item.user_note}
                        </div>
                      ) : null}
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
        {!favoritesMode && isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        {!favoritesMode && (
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
        )}

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
                      {editingId === item.id ? (
                        <textarea
                          className="extraction-item__edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit('manifest_action_steps', item.id, 'text')}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(item.id, item.text)}>
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                      )}
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartActionStep(item.id, item.is_hearted)}
                          title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                          onClick={() => notingId === item.id ? handleSaveNote('manifest_action_steps', item.id) : startNoting(item.id, item.user_note)}
                          title={item.user_note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={14} />
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

                      {notingId === item.id ? (
                        <textarea
                          className="extraction-item__note-textarea"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => handleSaveNote('manifest_action_steps', item.id)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                          autoFocus
                          rows={2}
                          placeholder="Add a note..."
                        />
                      ) : item.user_note ? (
                        <div className="extraction-item__note" onClick={() => startNoting(item.id, item.user_note)}>
                          <span className="extraction-item__note-label">NOTE</span>
                          {item.user_note}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!favoritesMode && (
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
                  )}
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
        {!favoritesMode && isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        {!favoritesMode && (
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
        )}

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
                      {editingId === item.id ? (
                        <textarea
                          className="extraction-item__edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit('manifest_declarations', item.id, 'declaration_text')}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <p className="extraction-item__text extraction-item__text--declaration extraction-item__text--editable" onClick={() => startEditing(item.id, item.declaration_text)}>
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          &ldquo;{item.declaration_text}&rdquo;
                        </p>
                      )}
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartDeclaration(item.id, item.is_hearted)}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                          onClick={() => notingId === item.id ? handleSaveNote('manifest_declarations', item.id) : startNoting(item.id, item.user_note)}
                          title={item.user_note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={14} />
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

                      {notingId === item.id ? (
                        <textarea
                          className="extraction-item__note-textarea"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => handleSaveNote('manifest_declarations', item.id)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                          autoFocus
                          rows={2}
                          placeholder="Add a note..."
                        />
                      ) : item.user_note ? (
                        <div className="extraction-item__note" onClick={() => startNoting(item.id, item.user_note)}>
                          <span className="extraction-item__note-label">NOTE</span>
                          {item.user_note}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!favoritesMode && (
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
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestionsSection = (book: BookExtractions) => {
    const visible = filterMode === 'hearted'
      ? book.questions.filter((q) => q.is_hearted)
      : book.questions;

    if (visible.length === 0) {
      return <div className="extraction-tab__empty"><p>{filterMode === 'hearted' ? 'No hearted questions.' : 'No questions extracted.'}</p></div>;
    }

    const sections = groupBySection(visible);
    const isExtracting = extractingBookTab === `${book.bookId}-questions`;

    return (
      <div className="extraction-tab">
        {!favoritesMode && isExtracting && (
          <div className="extraction-tab__progress">
            <div className="extraction-tab__progress-bar" />
            <span>Extracting...</span>
          </div>
        )}

        {!favoritesMode && (
          <div className="extraction-tab__toolbar">
            {confirmReRun === `${book.bookId}-questions` ? (
              <div className="extraction-tab__confirm">
                <span>Replace all questions with fresh extraction?</span>
                <Button size="sm" onClick={() => handleReRun(book.bookId, 'questions')}>Re-run</Button>
                <Button size="sm" variant="text" onClick={() => setConfirmReRun(null)}>Cancel</Button>
              </div>
            ) : (
              <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(`${book.bookId}-questions`)} disabled={isExtracting}>
                <RefreshCw size={12} /> Re-run
              </button>
            )}
          </div>
        )}

        {sections.map(([sectionKey, items]) => {
          const collapseKey = `${book.bookId}-questions-${sectionKey}`;
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
                        {QUESTION_CONTENT_TYPE_LABELS[item.content_type as QuestionContentType] || item.content_type.replace(/_/g, ' ')}
                      </div>
                      {editingId === item.id ? (
                        <textarea
                          className="extraction-item__edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit('manifest_questions', item.id, 'text')}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                          autoFocus
                        />
                      ) : (
                        <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(item.id, item.text)}>
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                      )}
                      <div className="extraction-item__actions">
                        <button
                          type="button"
                          className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                          onClick={() => handleHeartQuestion(item.id, item.is_hearted)}
                          title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                        >
                          <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                          onClick={() => notingId === item.id ? handleSaveNote('manifest_questions', item.id) : startNoting(item.id, item.user_note)}
                          title={item.user_note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={14} />
                        </button>
                        {item.sent_to_prompts ? (
                          <span className="extraction-item__compass-sent">In Prompts</span>
                        ) : (
                          <button
                            type="button"
                            className="extraction-item__send-compass"
                            onClick={() => handleSendToPrompts(item.id)}
                            disabled={sendingToPrompts.has(item.id)}
                            title="Send to Journal Prompts"
                          >
                            <MessageCircle size={14} />
                            {sendingToPrompts.has(item.id) ? 'Sending...' : 'Send to Prompts'}
                          </button>
                        )}
                        <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_questions', item.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {notingId === item.id ? (
                        <textarea
                          className="extraction-item__note-textarea"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => handleSaveNote('manifest_questions', item.id)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                          autoFocus
                          rows={2}
                          placeholder="Add a note..."
                        />
                      ) : item.user_note ? (
                        <div className="extraction-item__note" onClick={() => startNoting(item.id, item.user_note)}>
                          <span className="extraction-item__note-label">NOTE</span>
                          {item.user_note}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!favoritesMode && (
                    <button
                      type="button"
                      className="extraction-tab__go-deeper"
                      onClick={() => handleGoDeeper(
                        book.bookId,
                        'questions',
                        sectionKey === '__full_book__' ? undefined : sectionKey,
                        items.map((i) => i.text),
                        items[0]?.section_index,
                      )}
                      disabled={isExtracting}
                    >
                      Go Deeper
                    </button>
                  )}
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
        <button type="button" className="extractions-view__back" onClick={handleBack}>
          <ChevronLeft size={16} />
          {favoritesMode ? 'Back' : 'Back to Library'}
        </button>
        <h2 className="extractions-view__title">{favoritesMode ? 'Favorites' : 'Extractions'}</h2>
      </div>

      {extractedItems.length === 0 ? (
        <div className="extractions-view__empty">
          {favoritesMode
            ? 'No hearted items yet. Heart items you love across your books and they\'ll appear here.'
            : 'No books with extractions yet. Extract content from a book\'s detail page first.'}
        </div>
      ) : (
        <>
          {/* Book selector */}
          <div className="extractions-view__books">
            <button
              type="button"
              className="extractions-view__books-toggle"
              onClick={() => setBooksExpanded((v) => !v)}
            >
              {booksExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="extractions-view__books-label">
                Select books{selectedIds.size > 0 ? ` (${selectedIds.size} selected)` : ` (${extractedSingleItems.length + extractedParents.length} available)`}
              </span>
              <div className="extractions-view__books-actions">
                <span className="extractions-view__select-btn" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set(filteredBooks.map((i) => i.id)));
                  setBooksExpanded(false);
                }}>
                  Select All
                </span>
                <span className="extractions-view__select-btn" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set());
                }}>
                  Clear
                </span>
              </div>
            </button>
            {booksExpanded && extractedItems.length > 4 && (
              <div className="extractions-view__search">
                <Search size={14} />
                <input
                  type="text"
                  className="extractions-view__search-input"
                  placeholder="Search books..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                />
              </div>
            )}
            {booksExpanded && (
              <>
                <TagPills
                  tags={bookTagData}
                  activeTags={activeBookTags}
                  onToggle={handleBookTagToggle}
                  onClear={() => setActiveBookTags(new Set())}
                  usageCounts={tagUsageCounts}
                  collapsible
                  label="Filter by tag"
                />
                <div className="extractions-view__book-list">
                  {/* Books in items prop order (preserves collection order) */}
                  {orderedBookList.map((entry) => {
                    if (entry.type === 'single') {
                      return (
                        <label key={entry.item.id} className="extractions-view__book-item">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.item.id)}
                            onChange={() => handleToggle(entry.item.id)}
                          />
                          <span className="extractions-view__book-title">{entry.item.title}</span>
                        </label>
                      );
                    }
                    const { item: parent, parts } = entry;
                    const allPartsSelected = parts.every((p) => selectedIds.has(p.id));
                    const somePartsSelected = parts.some((p) => selectedIds.has(p.id));
                    return (
                      <div key={parent.id} className="extractions-view__book-group">
                        <label className="extractions-view__book-item extractions-view__book-item--parent">
                          <input
                            type="checkbox"
                            checked={allPartsSelected}
                            ref={(el) => { if (el) el.indeterminate = somePartsSelected && !allPartsSelected; }}
                            onChange={() => handleToggleParent(parent.id)}
                          />
                          <span className="extractions-view__book-title">{parent.title}</span>
                          <span className="extractions-view__part-count">{parts.length} part{parts.length !== 1 ? 's' : ''}</span>
                        </label>
                        {parts.map((part) => (
                          <label key={part.id} className="extractions-view__book-item extractions-view__book-item--part">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(part.id)}
                              onChange={() => handleToggle(part.id)}
                            />
                            <span className="extractions-view__book-title">
                              {part.part_number ? `Part ${part.part_number}` : part.title.replace(`${parent.title} — `, '')}
                            </span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                  {orderedBookList.length === 0 && bookSearch && (
                    <div className="extractions-view__no-match">No books match "{bookSearch}"</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Framework tag filter bar */}
          {allTags.length > 0 && (
            <TagPills
              tags={allTags.map((t) => [t, 0] as [string, number])}
              activeTags={activeTags}
              onToggle={handleFrameworkTagToggle}
              onClear={() => setActiveTags(new Set())}
              usageCounts={tagUsageCounts}
              collapsible
              label="Filter by framework tag"
              showCounts={false}
            />
          )}

          {selectedIds.size > 0 && (
            <>
              {/* Export button */}
              <div className="extractions-view__export-row">
                <button type="button" className="extractions-view__export-btn" onClick={() => openExportDialog(favoritesMode ? 'hearted' : 'extractions')}>
                  <Download size={12} /> Export
                </button>
              </div>

              {/* Tabs + Controls */}
              <div className="extractions-view__tabs-row">
                <div className="extractions-view__tabs">
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'summary' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                  >
                    Summary {displayCounts.summaries > 0 && <span className="extractions-view__tab-count">{displayCounts.summaries}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'frameworks' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('frameworks')}
                  >
                    Frameworks {displayCounts.frameworks > 0 && <span className="extractions-view__tab-count">{displayCounts.frameworks}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'action_steps' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('action_steps')}
                  >
                    Action Steps {displayCounts.actionSteps > 0 && <span className="extractions-view__tab-count">{displayCounts.actionSteps}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'mast_content' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('mast_content')}
                  >
                    Mast {displayCounts.declarations > 0 && <span className="extractions-view__tab-count">{displayCounts.declarations}</span>}
                  </button>
                  <button
                    type="button"
                    className={`extractions-view__tab${activeTab === 'questions' ? ' extractions-view__tab--active' : ''}`}
                    onClick={() => setActiveTab('questions')}
                  >
                    Questions {displayCounts.questions > 0 && <span className="extractions-view__tab-count">{displayCounts.questions}</span>}
                  </button>
                </div>

                <div className="extractions-view__controls-row">
                  {!favoritesMode && (
                    <button
                      type="button"
                      className={`extraction-tabs__filter-btn${filterMode === 'hearted' ? ' extraction-tabs__filter-btn--active' : ''}`}
                      onClick={() => setFilterMode((m) => m === 'hearted' ? 'all' : 'hearted')}
                    >
                      <Heart size={12} fill={filterMode === 'hearted' ? 'currentColor' : 'none'} />
                      {filterMode === 'hearted' ? 'Hearted' : 'All'}
                    </button>
                  )}
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
                    <button
                      type="button"
                      className={`extraction-tabs__view-btn${viewMode === 'notes' ? ' extraction-tabs__view-btn--active' : ''}`}
                      onClick={() => setViewMode('notes')}
                      title={`My notes${displayCounts.notes > 0 ? ` (${displayCounts.notes})` : ''}`}
                    >
                      <StickyNote size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Extraction text search */}
              <div className="extractions-view__search-bar">
                <Search size={14} className="extractions-view__search-icon" />
                <input
                  type="text"
                  className="extractions-view__search-input"
                  placeholder="Search extractions..."
                  value={extractionSearch}
                  onChange={(e) => setExtractionSearch(e.target.value)}
                />
                {extractionSearch && (
                  <button type="button" className="extractions-view__search-clear" onClick={() => setExtractionSearch('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Content */}
              {loading ? (
                <div className="extractions-view__loading">Loading {favoritesMode ? 'favorites' : 'extractions'}...</div>
              ) : favoritesMode && visibleData.length === 0 ? (
                <div className="extractions-view__empty">
                  No hearted items yet. Heart items you love across your books and they'll appear here.
                </div>
              ) : viewMode === 'notes' ? (
                /* --- Notes View: only items with user_note --- */
                <div className="extractions-view__content">
                  {displayCounts.notes > 0 && (
                    <div className="extractions-view__export-row">
                      <button type="button" className="extractions-view__export-btn" onClick={() => openExportDialog('notes')}>
                        <Download size={12} /> Export Notes
                      </button>
                    </div>
                  )}
                  {displayCounts.notes === 0 ? (
                    <div className="extractions-view__tab-empty">No notes yet. Add notes to extraction items using the sticky note button.</div>
                  ) : visibleData.map((group) => {
                    const noted = [
                      ...group.summaries.filter((s) => s.user_note).map((s) => ({ id: s.id, type: 'summary' as const, text: s.text, note: s.user_note!, badge: s.content_type.replace(/_/g, ' '), section: s.section_title, table: 'manifest_summaries' })),
                      ...group.principles.filter((p) => p.user_note).map((p) => ({ id: p.id, type: 'framework' as const, text: p.text, note: p.user_note!, badge: 'framework', section: p.section_title, table: 'ai_framework_principles' })),
                      ...group.actionSteps.filter((a) => a.user_note).map((a) => ({ id: a.id, type: 'action_step' as const, text: a.text, note: a.user_note!, badge: ACTION_STEP_CONTENT_TYPE_LABELS[a.content_type as ActionStepContentType] || a.content_type.replace(/_/g, ' '), section: a.section_title, table: 'manifest_action_steps' })),
                      ...group.questions.filter((q) => q.user_note).map((q) => ({ id: q.id, type: 'question' as const, text: q.text, note: q.user_note!, badge: QUESTION_CONTENT_TYPE_LABELS[q.content_type as QuestionContentType] || q.content_type.replace(/_/g, ' '), section: q.section_title, table: 'manifest_questions' })),
                      ...group.declarations.filter((d) => d.user_note).map((d) => ({ id: d.id, type: 'declaration' as const, text: d.declaration_text, note: d.user_note!, badge: DECLARATION_STYLE_LABELS[d.declaration_style], section: d.section_title, table: 'manifest_declarations' })),
                    ];
                    if (noted.length === 0) return null;

                    // Group by section
                    const sectionMap = new Map<string, typeof noted>();
                    for (const item of noted) {
                      const key = item.section || '__all__';
                      if (!sectionMap.has(key)) sectionMap.set(key, []);
                      sectionMap.get(key)!.push(item);
                    }

                    return (
                      <div key={group.bookId} className="extractions-view__book-section">
                        <button type="button" className="extractions-view__book-heading" onClick={() => toggleBook(group.bookId)}>
                          {collapsedBooks.has(group.bookId) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <span>{group.bookTitle}</span>
                          <span className="extractions-view__tab-count">{noted.length}</span>
                        </button>

                        {!collapsedBooks.has(group.bookId) && Array.from(sectionMap.entries()).map(([sectionKey, items]) => {
                          const label = sectionKey === '__all__' ? null : sectionKey;
                          return (
                            <div key={sectionKey}>
                              {label && <h5 className="chapter-view__type-heading" style={{ marginTop: 'var(--spacing-sm)' }}>{label}</h5>}
                              {items.map((item) => (
                                <div key={item.id} className={`extraction-item${item.type === 'declaration' ? ' extraction-item--declaration' : ''}`}>
                                  <div className="extraction-item__type-badge">{item.badge}</div>
                                  <p className={`extraction-item__text${item.type === 'declaration' ? ' extraction-item__text--declaration' : ''}`}>
                                    {item.type === 'declaration' ? `\u201C${item.text}\u201D` : item.text}
                                  </p>
                                  {notingId === item.id ? (
                                    <textarea
                                      className="extraction-item__note-textarea"
                                      value={noteDraft}
                                      onChange={(e) => setNoteDraft(e.target.value)}
                                      onBlur={() => handleSaveNote(item.table, item.id)}
                                      onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                                      autoFocus
                                      rows={2}
                                      placeholder="Add a note..."
                                    />
                                  ) : (
                                    <div className="extraction-item__note" onClick={() => startNoting(item.id, item.note)}>
                                      <span className="extraction-item__note-label">NOTE</span>
                                      {item.note}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'chapters' ? (
                <div className="extractions-view__content">
                  {visibleData.map((group) => {
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
                          questions: group.questions.filter((q) => q.is_hearted),
                          declarations: group.declarations.filter((d) => d.is_hearted),
                        }
                      : group;
                    addSections(allItems.summaries);
                    addSections(allItems.principles.map((p) => ({ ...p, section_title: p.section_title || null })));
                    addSections(allItems.actionSteps);
                    addSections(allItems.questions);
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
                          const secQuestions = allItems.questions.filter((q) => (q.section_title || '__full_book__') === sectionKey);
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
                                        <div key={s.id} className={`extraction-item${s.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(s.id) ? ' extraction-item--deleting' : ''}`}>
                                          <div className="extraction-item__type-badge">{s.content_type.replace(/_/g, ' ')}</div>
                                          {editingId === s.id ? (
                                            <textarea
                                              className="extraction-item__edit-textarea"
                                              value={editingText}
                                              onChange={(e) => setEditingText(e.target.value)}
                                              onBlur={() => handleSaveEdit('manifest_summaries', s.id, 'text')}
                                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                              autoFocus
                                            />
                                          ) : (
                                            <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(s.id, s.text)}>{s.text}</p>
                                          )}
                                          <div className="extraction-item__actions">
                                            <button type="button" className={`extraction-item__heart${s.is_hearted ? ' extraction-item__heart--active' : ''}`} onClick={() => handleHeartSummary(s.id, s.is_hearted)}>
                                              <Heart size={14} fill={s.is_hearted ? 'currentColor' : 'none'} />
                                            </button>
                                            <button type="button"
                                              className={`extraction-item__note-btn${s.user_note ? ' extraction-item__note-btn--active' : ''}`}
                                              onClick={() => notingId === s.id ? handleSaveNote('manifest_summaries', s.id) : startNoting(s.id, s.user_note)}
                                              title={s.user_note ? 'Edit note' : 'Add note'}
                                            ><StickyNote size={14} /></button>
                                            <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_summaries', s.id)}><Trash2 size={14} /></button>
                                          </div>
                                          {notingId === s.id ? (
                                            <textarea className="extraction-item__note-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => handleSaveNote('manifest_summaries', s.id)} onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }} autoFocus rows={2} placeholder="Add a note..." />
                                          ) : s.user_note ? (
                                            <div className="extraction-item__note" onClick={() => startNoting(s.id, s.user_note)}><span className="extraction-item__note-label">NOTE</span>{s.user_note}</div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secPrinciples.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Frameworks</h5>
                                      {secPrinciples.map((p) => (
                                        <div key={p.id} className={`extraction-item${p.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(p.id) ? ' extraction-item--deleting' : ''}`}>
                                          {editingId === p.id ? (
                                            <textarea
                                              className="extraction-item__edit-textarea"
                                              value={editingText}
                                              onChange={(e) => setEditingText(e.target.value)}
                                              onBlur={() => handleSaveEdit('ai_framework_principles', p.id, 'text')}
                                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                              autoFocus
                                            />
                                          ) : (
                                            <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(p.id, p.text)}>{p.text}</p>
                                          )}
                                          <div className="extraction-item__actions">
                                            <button type="button" className={`extraction-item__heart${p.is_hearted ? ' extraction-item__heart--active' : ''}`} onClick={() => handleHeartPrinciple(p.id, p.is_hearted)}>
                                              <Heart size={14} fill={p.is_hearted ? 'currentColor' : 'none'} />
                                            </button>
                                            <button type="button"
                                              className={`extraction-item__note-btn${p.user_note ? ' extraction-item__note-btn--active' : ''}`}
                                              onClick={() => notingId === p.id ? handleSaveNote('ai_framework_principles', p.id) : startNoting(p.id, p.user_note)}
                                              title={p.user_note ? 'Edit note' : 'Add note'}
                                            ><StickyNote size={14} /></button>
                                            <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('ai_framework_principles', p.id)}><Trash2 size={14} /></button>
                                          </div>
                                          {notingId === p.id ? (
                                            <textarea className="extraction-item__note-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => handleSaveNote('ai_framework_principles', p.id)} onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }} autoFocus rows={2} placeholder="Add a note..." />
                                          ) : p.user_note ? (
                                            <div className="extraction-item__note" onClick={() => startNoting(p.id, p.user_note)}><span className="extraction-item__note-label">NOTE</span>{p.user_note}</div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secActions.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Action Steps</h5>
                                      {secActions.map((a) => (
                                        <div key={a.id} className={`extraction-item${a.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(a.id) ? ' extraction-item--deleting' : ''}`}>
                                          <div className="extraction-item__type-badge">
                                            {ACTION_STEP_CONTENT_TYPE_LABELS[a.content_type as ActionStepContentType] || a.content_type.replace(/_/g, ' ')}
                                          </div>
                                          {editingId === a.id ? (
                                            <textarea
                                              className="extraction-item__edit-textarea"
                                              value={editingText}
                                              onChange={(e) => setEditingText(e.target.value)}
                                              onBlur={() => handleSaveEdit('manifest_action_steps', a.id, 'text')}
                                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                              autoFocus
                                            />
                                          ) : (
                                            <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(a.id, a.text)}>{a.text}</p>
                                          )}
                                          <div className="extraction-item__actions">
                                            <button type="button" className={`extraction-item__heart${a.is_hearted ? ' extraction-item__heart--active' : ''}`} onClick={() => handleHeartActionStep(a.id, a.is_hearted)}>
                                              <Heart size={14} fill={a.is_hearted ? 'currentColor' : 'none'} />
                                            </button>
                                            <button type="button"
                                              className={`extraction-item__note-btn${a.user_note ? ' extraction-item__note-btn--active' : ''}`}
                                              onClick={() => notingId === a.id ? handleSaveNote('manifest_action_steps', a.id) : startNoting(a.id, a.user_note)}
                                              title={a.user_note ? 'Edit note' : 'Add note'}
                                            ><StickyNote size={14} /></button>
                                            {a.sent_to_compass ? (
                                              <span className="extraction-item__compass-sent">In Compass</span>
                                            ) : (
                                              <button type="button" className="extraction-item__send-compass" onClick={() => handleSendToCompass(a.id)} disabled={sendingToCompass.has(a.id)}>
                                                <Compass size={14} /> {sendingToCompass.has(a.id) ? '...' : 'Compass'}
                                              </button>
                                            )}
                                            <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_action_steps', a.id)}><Trash2 size={14} /></button>
                                          </div>
                                          {notingId === a.id ? (
                                            <textarea className="extraction-item__note-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => handleSaveNote('manifest_action_steps', a.id)} onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }} autoFocus rows={2} placeholder="Add a note..." />
                                          ) : a.user_note ? (
                                            <div className="extraction-item__note" onClick={() => startNoting(a.id, a.user_note)}><span className="extraction-item__note-label">NOTE</span>{a.user_note}</div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secQuestions.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Questions</h5>
                                      {secQuestions.map((q) => (
                                        <div key={q.id} className={`extraction-item${q.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(q.id) ? ' extraction-item--deleting' : ''}`}>
                                          <div className="extraction-item__type-badge">
                                            {QUESTION_CONTENT_TYPE_LABELS[q.content_type as QuestionContentType] || q.content_type.replace(/_/g, ' ')}
                                          </div>
                                          {editingId === q.id ? (
                                            <textarea
                                              className="extraction-item__edit-textarea"
                                              value={editingText}
                                              onChange={(e) => setEditingText(e.target.value)}
                                              onBlur={() => handleSaveEdit('manifest_questions', q.id, 'text')}
                                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                              autoFocus
                                            />
                                          ) : (
                                            <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(q.id, q.text)}>{q.text}</p>
                                          )}
                                          <div className="extraction-item__actions">
                                            <button type="button" className={`extraction-item__heart${q.is_hearted ? ' extraction-item__heart--active' : ''}`} onClick={() => handleHeartQuestion(q.id, q.is_hearted)}>
                                              <Heart size={14} fill={q.is_hearted ? 'currentColor' : 'none'} />
                                            </button>
                                            <button type="button"
                                              className={`extraction-item__note-btn${q.user_note ? ' extraction-item__note-btn--active' : ''}`}
                                              onClick={() => notingId === q.id ? handleSaveNote('manifest_questions', q.id) : startNoting(q.id, q.user_note)}
                                              title={q.user_note ? 'Edit note' : 'Add note'}
                                            ><StickyNote size={14} /></button>
                                            {q.sent_to_prompts ? (
                                              <span className="extraction-item__compass-sent">In Prompts</span>
                                            ) : (
                                              <button type="button" className="extraction-item__send-compass" onClick={() => handleSendToPrompts(q.id)} disabled={sendingToPrompts.has(q.id)}>
                                                <MessageCircle size={14} /> {sendingToPrompts.has(q.id) ? '...' : 'Prompts'}
                                              </button>
                                            )}
                                            <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_questions', q.id)}><Trash2 size={14} /></button>
                                          </div>
                                          {notingId === q.id ? (
                                            <textarea className="extraction-item__note-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => handleSaveNote('manifest_questions', q.id)} onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }} autoFocus rows={2} placeholder="Add a note..." />
                                          ) : q.user_note ? (
                                            <div className="extraction-item__note" onClick={() => startNoting(q.id, q.user_note)}><span className="extraction-item__note-label">NOTE</span>{q.user_note}</div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {secDeclarations.length > 0 && (
                                    <div className="chapter-view__type-group">
                                      <h5 className="chapter-view__type-heading">Mast Content</h5>
                                      {secDeclarations.map((d) => (
                                        <div key={d.id} className={`extraction-item extraction-item--declaration${d.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(d.id) ? ' extraction-item--deleting' : ''}`}>
                                          <div className="extraction-item__declaration-meta">
                                            {d.value_name && <span className="extraction-item__value-name">{d.value_name}</span>}
                                            <span className="extraction-item__style-label">{DECLARATION_STYLE_LABELS[d.declaration_style]}</span>
                                          </div>
                                          {editingId === d.id ? (
                                            <textarea
                                              className="extraction-item__edit-textarea"
                                              value={editingText}
                                              onChange={(e) => setEditingText(e.target.value)}
                                              onBlur={() => handleSaveEdit('manifest_declarations', d.id, 'declaration_text')}
                                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                              autoFocus
                                            />
                                          ) : (
                                            <p className="extraction-item__text extraction-item__text--declaration extraction-item__text--editable" onClick={() => startEditing(d.id, d.declaration_text)}>&ldquo;{d.declaration_text}&rdquo;</p>
                                          )}
                                          <div className="extraction-item__actions">
                                            <button type="button" className={`extraction-item__heart${d.is_hearted ? ' extraction-item__heart--active' : ''}`} onClick={() => handleHeartDeclaration(d.id, d.is_hearted)}>
                                              <Heart size={14} fill={d.is_hearted ? 'currentColor' : 'none'} />
                                            </button>
                                            <button type="button"
                                              className={`extraction-item__note-btn${d.user_note ? ' extraction-item__note-btn--active' : ''}`}
                                              onClick={() => notingId === d.id ? handleSaveNote('manifest_declarations', d.id) : startNoting(d.id, d.user_note)}
                                              title={d.user_note ? 'Edit note' : 'Add note'}
                                            ><StickyNote size={14} /></button>
                                            {d.sent_to_mast ? (
                                              <span className="extraction-item__mast-sent">In Mast</span>
                                            ) : (
                                              <button type="button" className="extraction-item__send-mast" onClick={() => handleSendToMast(d.id)} disabled={sendingToMast.has(d.id)}>
                                                <Anchor size={14} /> {sendingToMast.has(d.id) ? '...' : 'Mast'}
                                              </button>
                                            )}
                                            <button type="button" className="extraction-item__delete" onClick={() => handleDeleteItem('manifest_declarations', d.id)}><Trash2 size={14} /></button>
                                          </div>
                                          {notingId === d.id ? (
                                            <textarea className="extraction-item__note-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => handleSaveNote('manifest_declarations', d.id)} onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }} autoFocus rows={2} placeholder="Add a note..." />
                                          ) : d.user_note ? (
                                            <div className="extraction-item__note" onClick={() => startNoting(d.id, d.user_note)}><span className="extraction-item__note-label">NOTE</span>{d.user_note}</div>
                                          ) : null}
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
                  {visibleData.map((group) => (
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
                          {activeTab === 'questions' && renderQuestionsSection(group)}
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

      {showExportDialog && (
        <ExportDialog
          groups={exportGroups}
          onClose={() => setShowExportDialog(false)}
          defaultTitle={exportMode === 'notes' ? notesTitle : singleBookTitle}
          mode={exportMode}
        />
      )}
    </div>
  );
}
